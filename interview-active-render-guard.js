// Final guard against legacy renderInterviews() re-inserting completed/closed interviews into the active board.
(function(){
  'use strict';
  if(window.__TSS_INTERVIEW_ACTIVE_RENDER_GUARD__)return;
  window.__TSS_INTERVIEW_ACTIVE_RENDER_GUARD__=true;

  const terminalOutcome=o=>['Rejected','Client Rejected','Candidate Declined','No Show','Selected','Offer / Joining Formalities','Joined-TSS'].includes(String(o||''));
  const terminal=i=>terminalOutcome(i?.outcome)||['Completed','Cancelled','No Show'].includes(String(i?.status||''));
  let reconciling=false;

  function store(){try{return typeof db!=='undefined'?db:null}catch{return null}}

  function reconcile(){
    if(reconciling)return;
    const s=store(),board=document.getElementById('interviewBoard');
    if(!s||!board)return;
    reconciling=true;
    try{
      const all=s.interviews||[];
      const active=all.filter(i=>!terminal(i));
      const activeIds=new Set(active.map(i=>String(i.serverId||i.id||'')));
      const activeCandidates=new Set(active.map(i=>String(i.candidate||'').trim().toLowerCase()));

      const rows=[...board.querySelectorAll('tbody tr')];
      rows.forEach((tr,idx)=>{
        const candidate=(tr.children[2]?.textContent||'').trim().toLowerCase();
        const status=(tr.querySelector('[data-ia-status]')?.textContent||'').trim();
        const byIndex=all[idx];
        const indexTerminal=byIndex&&terminal(byIndex);
        const statusTerminal=['Completed','Cancelled','No Show'].includes(status);
        const candidateIsActive=activeCandidates.has(candidate);
        if(indexTerminal||statusTerminal||(!candidateIsActive&&candidate)) tr.remove();
      });

      const badge=document.getElementById('navInterviewCount');
      if(badge)badge.textContent=String(active.length);
      try{window.TSSInterviewLifecycleUI?.refresh?.()}catch{}
    }finally{reconciling=false}
  }

  function schedule(){
    queueMicrotask(reconcile);
    requestAnimationFrame(()=>reconcile());
    setTimeout(reconcile,40);
    setTimeout(reconcile,140);
  }

  function boot(){
    const board=document.getElementById('interviewBoard');
    if(board)new MutationObserver(schedule).observe(board,{childList:true,subtree:true});
    document.addEventListener('tss:interview-state-synced',schedule);
    document.addEventListener('tss:data-changed',schedule);
    document.addEventListener('click',e=>{if(e.target.closest?.('.nav-item[data-view="interviews"]'))schedule()});
    window.addEventListener('focus',schedule,{passive:true});
    setInterval(()=>{if(!document.hidden)reconcile()},2000);
    schedule();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.TSSInterviewActiveRenderGuard={reconcile};
})();
