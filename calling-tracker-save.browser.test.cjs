const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

// Isolated browser test: use the production tracker module with controlled,
// deliberately slow/failing backend responses, without unrelated app hydration.
(async () => {
  const executablePath = process.env.TSS_BROWSER_PATH;
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.route('http://tracker.test/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><nav id="nav"><button class="nav-item" data-view="interviews"></button></nav><main class="main-shell"></main>' }));
    await page.goto('http://tracker.test/');
    await page.evaluate(() => {
      window.__test = { reads: [], writes: [], latest: null, fail: false, holdRead: false, holdWrite: false, userId: 'signed-in-recruiter' };
      window.toast = () => {};
      window.TSS_AUTH_CONTEXT = { id: 'stale-other-recruiter', role: 'recruiter' };
      window.TSSBackend = {
        currentUser: async () => ({ id: __test.userId }),
        client: { from(table) {
          const state = { table, filters: [], limit: null };
          const query = {
            select(columns) { state.columns = columns; return query; },
            eq(column, value) { state.filters.push([column, value]); return query; },
            order(column, options) { state.order = [column, options]; return query; },
            limit(value) { state.limit = value; return query; },
            maybeSingle() {
              __test.reads.push(state);
              return __test.holdRead ? new Promise(resolve => { __test.releaseRead = resolve; }) : Promise.resolve({ data: __test.latest, error: null });
            },
            insert(payload) {
              __test.writes.push(payload);
              return __test.holdWrite ? new Promise(resolve => { __test.releaseWrite = resolve; }) : Promise.resolve({ error: __test.fail ? { message: 'Connection unavailable' } : null });
            }
          };
          return query;
        } }
      };
      // randomUUID requires a secure origin. This test origin supplies a fixture.
      if (!crypto.randomUUID) crypto.randomUUID = () => 'test-' + Math.random().toString(16).slice(2);
    });
    await page.addStyleTag({ path: path.join(__dirname, 'recruitment-trackers.css') });
    await page.addScriptTag({ path: path.join(__dirname, 'recruitment-trackers.js') });
    const open = async (name = 'Test Candidate') => page.evaluate(name => {
      window.__result = undefined;
      const started = performance.now();
      window.__pending = TSSCallTracker.promptForCandidate({ candidateId: 'candidate-1', requirementId: 'requirement-1', screeningId: 'screening-1', name });
      window.__openMs = performance.now() - started;
      __pending.then(value => { window.__result = value; });
    }, name);
    const waitResult = async value => page.waitForFunction(expected => window.__result === expected, value);
    const dialog = page.locator('#candidateCallSaveDialog');
    const save = page.locator('#candidateCallSaveContinue');
    const outcome = page.locator('#candidateCallOutcome');

    // A stalled lookup cannot delay modal visibility or the rest of the UI.
    await page.evaluate(() => { __test.holdRead = true; });
    await open('CandidateWithAnIntentionallyLongNameForMobileLayout'.repeat(3));
    assert.equal(await dialog.isVisible(), true);
    const bounds = await dialog.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391, 'Dialog fits the 390px mobile viewport');
    assert.equal(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true, 'Dialog fields do not overflow horizontally');
    assert.ok(await page.evaluate(() => __openMs < 100), 'Dialog opens before backend lookup completes');
    const read = await page.evaluate(() => __test.reads[0]);
    assert.equal(read.table, 'candidate_call_logs');
    assert.equal(read.limit, 1);
    assert.deepEqual(read.filters, [['candidate_id', 'candidate-1'], ['requirement_id', 'requirement-1']]);
    assert.doesNotMatch(read.columns, /profiles|candidates\(|requirements\(/);
    await page.evaluate(() => { __test.samePromise = TSSCallTracker.promptForCandidate({ candidateId: 'candidate-2', requirementId: 'requirement-2' }) === __pending; });
    assert.equal(await page.evaluate(() => __test.samePromise), true, 'Double open coalesces into the current prompt');
    assert.equal(await page.locator('#candidateCallSaveDialog').count(), 1);
    await save.click();
    assert.match(await page.locator('#candidateCallSaveStatus').innerText(), /Choose a contact status/);
    assert.equal(await page.evaluate(() => __test.writes.length), 0);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await waitResult(false);
    await page.evaluate(() => { __test.releaseRead({ data: null, error: null }); __test.holdRead = false; });

    // Pending contact must not count as a completed call.
    await open();
    await outcome.selectOption('Not contacted yet');
    await save.click();
    await waitResult(true);
    assert.equal(await page.evaluate(() => __test.writes.length), 0);

    // Single insert, signed-in attribution, and responsive pending-save state.
    await open();
    await outcome.selectOption('Interested in Job Change');
    await page.locator('#candidateCallNotes').fill('Available for interview');
    await page.evaluate(() => { __test.holdWrite = true; });
    await save.click();
    await page.waitForFunction(() => __test.writes.length === 1);
    assert.equal(await save.isDisabled(), true);
    await page.evaluate(() => { document.querySelector('#candidateCallSaveContinue').onclick(); window.__heartbeat = 42; });
    assert.equal(await page.evaluate(() => __heartbeat), 42, 'UI remains responsive during the write');
    assert.equal(await page.evaluate(() => __test.writes.length), 1);
    const payload = await page.evaluate(() => __test.writes[0]);
    assert.equal(payload.recruiter_id, 'signed-in-recruiter');
    assert.equal(payload.candidate_id, 'candidate-1');
    assert.equal(payload.requirement_id, 'requirement-1');
    assert.equal(payload.screening_id, 'screening-1');
    assert.equal(payload.call_notes, 'Available for interview');
    assert.ok(!Number.isNaN(Date.parse(payload.called_at)));
    await page.evaluate(() => { __test.releaseWrite({ error: null }); __test.holdWrite = false; });
    await waitResult(true);

    // Failure retains details; retry reuses the write UUID to avoid duplicates.
    await open();
    await outcome.selectOption('No Answer');
    await page.locator('#candidateCallNotes').fill('Try tomorrow');
    await page.evaluate(() => { __test.fail = true; });
    await save.click();
    await page.waitForFunction(() => document.querySelector('#candidateCallSaveStatus').textContent.includes('Connection unavailable'));
    assert.equal(await dialog.isVisible(), true);
    assert.equal(await save.isDisabled(), false);
    assert.equal(await page.locator('#candidateCallNotes').inputValue(), 'Try tomorrow');
    await page.evaluate(() => { __test.fail = false; });
    await save.click();
    await waitResult(true);
    assert.equal(await page.evaluate(() => __test.writes.at(-1).id === __test.writes.at(-2).id), true);

    // Saving a prefilled prior call cannot inflate daily activity.
    await page.evaluate(() => { __test.latest = { id: 'prior-call', call_outcome: 'Call Back Later', call_notes: 'After lunch', next_follow_up_at: null }; });
    await open();
    await page.waitForFunction(() => document.querySelector('#candidateCallOutcome').value === 'Call Back Later');
    assert.equal(await page.locator('#candidateCallNotes').inputValue(), 'After lunch');
    const before = await page.evaluate(() => __test.writes.length);
    await save.click();
    await waitResult(true);
    assert.equal(await page.evaluate(() => __test.writes.length), before);
    await open();
    await page.waitForFunction(() => document.querySelector('#candidateNewCallLabel').hidden === false);
    await page.locator('#candidateCallNotes').fill('Called again after lunch');
    assert.equal(await page.locator('#candidateNewCall').isChecked(), true, 'Editing prior notes records a new call');
    await save.click();
    await waitResult(true);
    assert.equal(await page.evaluate(() => __test.writes.length), before + 1);
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('calling tracker save browser test passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
