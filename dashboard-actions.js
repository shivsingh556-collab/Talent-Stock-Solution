// Dashboard actions + authoritative candidate count consistency.
(function(){
  function go(view){
    try{
      if(typeof window.gotoView==='function') return window.gotoView(view);
      const btn=document.querySelector(`.nav-item[data-view="${view}"]`);
      if(btn) return btn.click();
      document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===view));
    }catch(e){console.warn('TODO AI dashboard navigation',e)}
  }

  const store=()=>{try{return typeof db!=='undefined'?db:null}catch{return null}};
  const uniqueIds=(rows,predicate=()=>true)=>new Set((rows||[]).filter(predicate).map(x=>String(x?.candidateId||x?.candidate_id||'')).filter(Boolean));

  function syncDashboardCounts(){
    const s=store();if(!s)return;
    const candidates=s.candidates||[],screenings=s.screenings||[],interviews=(s.interviews||[]).filter(i=>!i.archivedAt);
    const total=candidates.length;
    const screened=Math.min(total,uniqueIds(screenings).size);
    const reviewable=Math.min(screened,uniqueIds(screenings,x=>['Strong Match','Review Recommended'].includes(x.recommendation)).size);
    const interviewCandidates=uniqueIds(interviews).size;
    const interviewCount=interviewCandidates||interviews.length;
    const offerIds=uniqueIds(screenings,x=>/(offer|final select|joined-tss)/i.test(String(x.recruiterDecision||'')));
    const offers=Math.min(total,offerIds.size);

    const worth=document.getElementById('worthReviewing');
    if(worth)worth.innerHTML=`${reviewable} candidates<br>worth reviewing`;

    const rows=[...document.querySelectorAll('#pipelineVisual .pipeline-row')];
    const values={sourced:total,screened,shortlisted:reviewable,interview:interviewCount,offer:offers};
    rows.forEach(row=>{
      const label=(row.querySelector('span')?.textContent||'').trim().toLowerCase();
      if(!(label in values))return;
      const n=values[label];
      const shape=row.querySelector('.pipeline-trapezoid');const count=row.querySelector('b');
      if(shape)shape.textContent=String(n);if(count)count.textContent=String(n);
    });

    const nav=document.getElementById('navCandidateCount');if(nav)nav.textContent=String(total);
  }

  function wrapRenderer(){
    const original=window.renderOldSite;
    if(typeof original!=='function'||original.__tssCountConsistent)return;
    const wrapped=function(){const out=original.apply(this,arguments);queueMicrotask(syncDashboardCounts);return out};
    wrapped.__tssCountConsistent=true;
    window.renderOldSite=wrapped;
  }

  function wire(){
    wrapRenderer();
    const pipeline=[...document.querySelectorAll('.pipeline-card .text-btn')]
      .find(b=>(b.textContent||'').trim().toLowerCase().includes('view full pipeline'));
    if(pipeline && !pipeline.dataset.pipelineWired){
      pipeline.dataset.pipelineWired='1';
      pipeline.addEventListener('click',e=>{e.preventDefault();go('candidates')});
    }
    syncDashboardCounts();
  }

  document.addEventListener('click',e=>{if(e.target.closest?.('.nav-item[data-view="dashboard"]'))setTimeout(syncDashboardCounts,60)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
  setTimeout(wire,300);
  window.TSSDashboardActions={wire,syncDashboardCounts};
})();
