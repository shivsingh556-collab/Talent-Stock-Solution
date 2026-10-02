const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require(process.env.TSS_JSDOM_PATH || 'jsdom');

(async () => {
  const dom = new JSDOM('<!doctype html><nav id="nav"><button class="nav-item" data-view="interviews"></button></nav><main class="main-shell"></main>', { url: 'http://localhost/', runScripts: 'outside-only' });
  const w = dom.window;
  // jsdom implements real forms/events/selects, but not the native dialog API.
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
  const state = { reads: [], writes: [], latest: null, fail: false, holdRead: false, holdWrite: false };
  w.toast = () => {};
  w.TSS_AUTH_CONTEXT = { id: 'stale-recruiter', role: 'recruiter' };
  w.TSSBackend = {
    currentUser: async () => ({ id: 'signed-in-recruiter' }),
    client: { from(table) {
      const read = { table, filters: [] };
      const q = {
        select(columns) { read.columns = columns; return q; },
        eq(k, v) { read.filters.push([k, v]); return q; },
        order() { return q; }, limit(n) { read.limit = n; return q; },
        maybeSingle() { state.reads.push(read); return state.holdRead ? new Promise(resolve => { state.releaseRead = resolve; }) : Promise.resolve({ data: state.latest, error: null }); },
        insert(payload) { state.writes.push(payload); return state.holdWrite ? new Promise(resolve => { state.releaseWrite = resolve; }) : Promise.resolve({ error: state.fail ? { message: 'Connection unavailable' } : null }); }
      };
      return q;
    } }
  };
  w.eval(fs.readFileSync(path.join(__dirname, 'recruitment-trackers.js'), 'utf8'));
  const el = id => w.document.getElementById(id);
  const tick = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
  const open = () => w.TSSCallTracker.promptForCandidate({ candidateId: 'candidate', requirementId: 'requirement', screeningId: 'screening', name: 'Candidate' });
  const select = value => { el('candidateCallOutcome').value = value; el('candidateCallOutcome').dispatchEvent(new w.Event('change')); };
  const save = async () => { await el('candidateCallSaveContinue').onclick(); await tick(); };
  try {
    state.holdRead = true;
    const started = performance.now(); const cancelled = open();
    assert.ok(performance.now() - started < 100, 'Modal opens without waiting for the backend');
    assert.equal(el('candidateCallSaveDialog').open, true);
    assert.equal(open(), cancelled, 'Repeated click coalesces the prompt');
    assert.equal(state.reads.length, 1);
    assert.equal(state.reads[0].limit, 1);
    assert.deepEqual(state.reads[0].filters, [['candidate_id', 'candidate'], ['requirement_id', 'requirement']]);
    await save();
    assert.match(el('candidateCallSaveStatus').textContent, /Choose a contact status/);
    assert.equal(state.writes.length, 0);
    const cancel = el('candidateCallSaveDialog').querySelector('button[value="cancel"]');
    assert.equal(cancel.formNoValidate, true, 'Blank required status does not prevent cancellation');
    el('candidateCallSaveDialog').close(); assert.equal(await cancelled, false);
    state.releaseRead({ data: null, error: null }); state.holdRead = false;
    const pending = open(); select('Not contacted yet'); await save();
    assert.equal(await pending, true); assert.equal(state.writes.length, 0);

    const saved = open(); select('Interested in Job Change');
    el('candidateCallNotes').value = 'Available'; state.holdWrite = true;
    const saving = save(); await tick();
    assert.equal(state.writes.length, 1);
    assert.equal(el('candidateCallSaveContinue').disabled, true);
    assert.equal(el('candidateCallOutcome').disabled, true);
    await el('candidateCallSaveContinue').onclick(); assert.equal(state.writes.length, 1);
    assert.equal(state.writes[0].recruiter_id, 'signed-in-recruiter');
    assert.equal(state.writes[0].candidate_id, 'candidate');
    assert.equal(state.writes[0].screening_id, 'screening');
    assert.equal(state.writes[0].call_notes, 'Available');
    assert.ok(!Number.isNaN(Date.parse(state.writes[0].called_at)));
    state.releaseWrite({ error: null }); state.holdWrite = false; await saving;
    assert.equal(await saved, true);

    const retried = open(); select('No Answer'); state.fail = true; await save();
    assert.equal(el('candidateCallSaveDialog').open, true);
    assert.equal(el('candidateCallSaveContinue').disabled, false);
    assert.match(el('candidateCallSaveStatus').textContent, /Connection unavailable/);
    state.fail = false; await save(); assert.equal(await retried, true);
    assert.equal(state.writes.at(-1).id, state.writes.at(-2).id, 'Network retry preserves call UUID');

    state.latest = { id: 'old-call', call_outcome: 'Call Back Later', call_notes: 'After lunch' };
    const kept = open(); await tick();
    assert.equal(el('candidateCallOutcome').value, 'Call Back Later');
    assert.equal(el('candidateCallNotes').value, 'After lunch');
    const before = state.writes.length; await save(); assert.equal(await kept, true);
    assert.equal(state.writes.length, before, 'Keeping earlier details does not inflate activity');
    const updated = open(); await tick();
    el('candidateCallNotes').value = 'Called again'; el('candidateCallNotes').dispatchEvent(new w.Event('input'));
    assert.equal(el('candidateNewCall').checked, true);
    await save(); assert.equal(await updated, true); assert.equal(state.writes.length, before + 1);
    console.log('Calling tracker DOM integration passed: bounded lookup, immediate opening, cancel, validation, pending status, recruiter attribution, double clicks, failed retry, previous history, edited notes.');
  } finally { dom.window.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
