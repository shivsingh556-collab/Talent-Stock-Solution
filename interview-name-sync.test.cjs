const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

(async () => {
  const rows = {
    candidates: [{id: 'candidate-1', candidate_name: 'Corrected Candidate'}],
    interviews: [
      {id: 'interview-1', candidate_id: 'candidate-1', candidate_name_snapshot: 'Sales Executive', candidates: {candidate_name: 'Corrected Candidate'}, scheduled_at: '2026-10-06T08:30:00Z'},
      {id: 'interview-2', candidate_id: 'missing-candidate', candidate_name_snapshot: 'Historical Candidate', scheduled_at: '2026-10-07T08:30:00Z'}
    ]
  };
  const board = {innerHTML: '', querySelector: () => true};
  const nodes = {interviewBoard: board, savingOverlay: {}, backendIndicator: {querySelector: () => ({})}};
  const context = {
    window: {TSSBackend: {enabled: true, currentUser: async () => ({id: 'recruiter'}), client: {from(table) {
      const query = {select: () => query, neq: () => query, order: () => query, then(resolve, reject) {
        return Promise.resolve({data: rows[table] || [], error: null}).then(resolve, reject);
      }};
      return query;
    }}}},
    db: {candidates: [], requirements: [], screenings: [], interviews: []},
    document: {readyState: 'loading', addEventListener() {}, getElementById: id => nodes[id] || null},
    localStorage: {setItem() {}}, console, setTimeout, clearTimeout,
    renderAll() {}, renderOldSite() {}, toast() {}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('production.js', 'utf8'), context);
  await context.window.TSSProduction.hydrate();
  assert.equal(context.db.interviews[0].candidate, 'Corrected Candidate', 'hydration prefers the current linked profile');
  assert.equal(context.db.interviews[1].candidate, 'Historical Candidate', 'snapshot remains a fallback when the linked profile is unavailable');

  vm.runInContext(fs.readFileSync('interview-actions.js', 'utf8'), context);
  const originalDate = context.db.interviews[0].date;
  context.db.interviews[0].candidate = 'Sales Executive';
  context.db.candidates[0].name = 'Edited Again';
  context.window.TSSInterviewActions.renderStable();
  assert.match(board.innerHTML, /Edited Again/);
  assert.doesNotMatch(board.innerHTML, /Sales Executive/);
  assert.equal(context.db.interviews[0].candidate, 'Edited Again', 'local edit reaches interview actions through candidate ID');
  assert.equal(context.db.interviews[0].date, originalDate, 'renaming does not change the interview schedule');
  assert.equal(context.db.interviews[1].candidate, 'Historical Candidate', 'unrelated candidates are untouched');
  context.db.candidates[0].name = 'Final Correction';
  context.window.TSSInterviewActions.renderStable();
  assert.match(board.innerHTML, /Final Correction/, 'name changes invalidate the render signature');
  console.log('Interview name sync passed: hydration, edited profile, candidate-ID isolation, snapshot fallback and preserved schedule.');
})().catch(error => {console.error(error); process.exitCode = 1;});
