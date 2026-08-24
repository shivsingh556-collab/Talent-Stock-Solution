// TSS in-app recruiter automation: auto-match, chases, queues, digest.
(function () {
  const KEY = "tss_site_automations_v1";
  const LOG_KEY = "tss_site_automation_runs_v1";
  const PLAYBOOKS = [
    { id: "auto-match", name: "Library Auto-Match", blurb: "Rank every stored CV against remaining requirements and raise matches >= 55.", when: "On requirement save" },
    { id: "pending-chase", name: "Pending Decision Chase", blurb: "Flag screenings still sitting on Pending so recruiters close the loop.", when: "On every data change" },
    { id: "strong-queue", name: "Strong Match Queue", blurb: "Keep a live shortlist of Strong Match candidates that have no recruiter decision yet.", when: "Continuous" },
    { id: "incomplete-jd", name: "Incomplete JD Watch", blurb: "Surface remaining requirements missing skills or responsibilities.", when: "Continuous" },
    { id: "stale-req", name: "Quiet Requirement Pulse", blurb: "Call out remaining requirements with no screening in the last 7 days.", when: "Continuous" }
  ];
  const remainingStatuses = new Set(["Work In Progress", "On Hold"]);
  function isRemaining(r) { return !!r && remainingStatuses.has(String(r.status || "").trim()); }
  function loadState() {
    try { return { enabled: { "auto-match": true, "pending-chase": true, "strong-queue": true, "incomplete-jd": true, "stale-req": true }, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
    catch { return { enabled: {} }; }
  }
  function saveState(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  function loadRuns() { try { return JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); } catch { return []; } }
  function pushRun(entry) { const runs = loadRuns(); runs.unshift(entry); localStorage.setItem(LOG_KEY, JSON.stringify(runs.slice(0, 40))); }
  let state = loadState();
  function store() { return typeof db !== "undefined" ? db : { requirements: [], candidates: [], screenings: [], activity: [] }; }
  function score(c, r) {
    if (typeof scoreCandidate === "function") return scoreCandidate(c.resumeText || "", r, c);
    return { score: 0 };
  }
  function runAutoMatch() {
    const data = store();
    const remaining = (data.requirements || []).filter(isRemaining);
    const hits = [];
    remaining.forEach(r => {
      (data.candidates || []).forEach(c => {
        const s = score(c, r).score;
        if (s >= 55) hits.push({ name: c.name, title: r.title, score: s });
      });
    });
    hits.sort((a,b) => b.score - a.score);
    return { summary: hits.length + " library matches >= 55 across " + remaining.length + " remaining requirements", rows: hits.slice(0, 12) };
  }
  function runPending() {
    const pending = (store().screenings || []).filter(s => !s.recruiterDecision || s.recruiterDecision === "Pending");
    return { summary: pending.length + " screenings waiting on a recruiter decision", rows: pending.slice(-12).reverse().map(s => { const c = (store().candidates || []).find(x => x.id === s.candidateId); const r = (store().requirements || []).find(x => x.id === s.requirementId); return { name: c && c.name || "Candidate", title: r && r.title || s.requirementId, score: s.score }; }) };
  }
  function runStrong() {
    const rows = (store().screenings || []).filter(s => s.recommendation === "Strong Match" && (!s.recruiterDecision || s.recruiterDecision === "Pending"));
    return { summary: rows.length + " strong matches still open", rows: rows.slice(-12).reverse().map(s => { const c = (store().candidates || []).find(x => x.id === s.candidateId); const r = (store().requirements || []).find(x => x.id === s.requirementId); return { name: c && c.name || "Candidate", title: r && r.title || "", score: s.score }; }) };
  }
  function runIncomplete() {
    const rows = (store().requirements || []).filter(r => isRemaining(r) && (!(r.skills || []).length || !r.responsibilities));
    return { summary: rows.length + " remaining requirements missing skills or responsibilities", rows: rows.map(r => ({ name: r.requirementId || r.id, title: r.title, score: null })) };
  }
  function runStale() {
    const week = Date.now() - 7 * 864e5;
    const rows = (store().requirements || []).filter(r => {
      if (!isRemaining(r)) return false;
      const keys = [r.id, r.requirementId, r.serverId].filter(Boolean);
      const related = (store().screenings || []).filter(s => keys.includes(s.requirementId) || keys.includes(s.requirement_id));
      const last = related.slice().sort((a,b) => new Date(a.date || a.screened_at || 0) - new Date(b.date || b.screened_at || 0)).at(-1);
      const t = last ? new Date(last.date || last.screened_at).getTime() : 0;
      return t < week;
    });
    return { summary: rows.length + " remaining requirements with no screening in 7 days", rows: rows.map(r => ({ name: r.client, title: r.title, score: null })) };
  }
  const RUNNERS = { "auto-match": runAutoMatch, "pending-chase": runPending, "strong-queue": runStrong, "incomplete-jd": runIncomplete, "stale-req": runStale };
  function execute(id, silent) {
    const book = PLAYBOOKS.find(p => p.id === id); const fn = RUNNERS[id]; if (!book || !fn) return null;
    const result = fn();
    pushRun({ id: Date.now(), playbookId: id, name: book.name, summary: result.summary, at: new Date().toISOString(), count: result.rows.length });
    if (!silent && typeof toast === "function") toast(result.summary);
    render(); return result;
  }
  function runEnabled() { PLAYBOOKS.forEach(p => { if (state.enabled[p.id]) execute(p.id, true); }); render(); }
  function ensureView() {
    const nav = document.getElementById("nav");
    if (nav && !nav.querySelector('[data-view="automation"]')) {
      const b = document.createElement("button"); b.className = "nav-item"; b.dataset.view = "automation"; b.innerHTML = "<span>◎</span>Automation"; nav.appendChild(b);
    }
    if (!document.getElementById("automation")) {
      const sec = document.createElement("section"); sec.id = "automation"; sec.className = "view";
      sec.innerHTML = '<div class="section-head"><div><span>RECRUITER AUTOMATION</span><h1>Automation Center</h1><p>Playbooks that watch remaining requirements, the CV library, and screening decisions on this workspace.</p></div><button id="runAllAutomations" class="blue-btn" type="button">Run all armed playbooks</button></div><div id="automationStats" class="dashboard-grid"></div><div id="automationPlaybooks" class="profile-grid"></div><article class="old-panel" style="margin-top:18px"><div class="panel-title"><h3>Run log</h3></div><div id="automationLog"></div></article>';
      const interviews = document.getElementById("interviews"); if (interviews && interviews.parentElement) interviews.parentElement.insertBefore(sec, interviews.nextSibling);
    }
    const orig = window.gotoView;
    if (typeof orig === "function" && !orig.__tssAuto) {
      window.gotoView = function (id) {
        orig(id);
        const titles = { dashboard: "Recruitment Dashboard", requirements: "Job Profiles & JD Intelligence", screening: "New Resume Screening", candidates: "Candidate CV Library", history: "Candidate History", interviews: "Interviews", automation: "Automation Center" };
        const el = document.getElementById("pageTitle"); if (el && titles[id]) el.textContent = titles[id];
        if (id === "automation") render();
      };
      window.gotoView.__tssAuto = true;
    }
  }
  function render() {
    ensureView();
    const stats = document.getElementById("automationStats"); const grid = document.getElementById("automationPlaybooks"); const log = document.getElementById("automationLog");
    if (!grid) return;
    const armed = PLAYBOOKS.filter(p => state.enabled[p.id]).length;
    if (stats) {
      const pending = runPending(); const strong = runStrong(); const match = runAutoMatch();
      stats.innerHTML = [["Armed playbooks", armed],["Library matches", match.rows.length],["Pending decisions", pending.rows.length],["Open strong matches", strong.rows.length]].map(function(pair){ return '<article class="old-panel"><span class="eyebrow">'+pair[0]+'</span><h2 style="margin:8px 0 0">'+pair[1]+'</h2></article>'; }).join("");
    }
    grid.innerHTML = PLAYBOOKS.map(function(p){ const on = !!state.enabled[p.id]; return '<article class="req-card"><span class="eyebrow">'+p.when+'</span><h4>'+p.name+'</h4><small style="color:var(--muted)">'+p.blurb+'</small><div class="card-actions"><button class="btn ghost auto-toggle" data-id="'+p.id+'">'+(on?"Armed":"Off")+'</button><button class="btn primary auto-run" data-id="'+p.id+'">Run now</button></div></article>'; }).join("");
    const runs = loadRuns();
    if (log) {
      log.innerHTML = runs.length ? '<table class="data-table"><thead><tr><th>When</th><th>Playbook</th><th>Result</th></tr></thead><tbody>'+runs.map(function(r){ return '<tr><td>'+new Date(r.at).toLocaleString()+'</td><td>'+r.name+'</td><td>'+r.summary+'</td></tr>'; }).join("")+'</tbody></table>' : '<div class="empty-state">No automation runs yet. Arm a playbook and press Run now.</div>';
    }
  }
  function wire() {
    document.addEventListener("click", function(e) {
      const tog = e.target.closest && e.target.closest(".auto-toggle");
      if (tog) { state.enabled[tog.dataset.id] = !state.enabled[tog.dataset.id]; saveState(state); render(); return; }
      const run = e.target.closest && e.target.closest(".auto-run");
      if (run) { execute(run.dataset.id, false); return; }
      if (e.target.closest && e.target.closest("#runAllAutomations")) { runEnabled(); if (typeof toast === "function") toast("All armed playbooks ran"); }
    });
  }
  function hookSave() {
    if (typeof window.saveDB !== "function" || window.saveDB.__tssAuto) return;
    const orig = window.saveDB;
    window.saveDB = function () { orig.apply(this, arguments); if (state.enabled["auto-match"]) execute("auto-match", true); if (state.enabled["pending-chase"]) execute("pending-chase", true); };
    window.saveDB.__tssAuto = true;
  }
  function boot() { ensureView(); hookSave(); wire(); runEnabled(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true }); else boot();
  window.TSSSiteAutomation = { run: execute, render, runEnabled };
})();
