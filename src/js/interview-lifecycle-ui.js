// TODO AI interview visibility: no history UI. Archived rows stay in Supabase but are hidden from Interview Operations.
(function(){
  'use strict';
  if(window.__TSS_INTERVIEW_VISIBILITY__)return;
  window.__TSS_INTERVIEW_VISIBILITY__=true;

  const store=()=>{try{return typeof db!=='undefined'?db:null}catch{return null}};
  let wrapped=false;

  function removeHistoryPanel(){
    document.getElementById('interviewHistoryPanel')?.remove();
  }

  function visibleItems(){
    return (store()?.interviews||[]).filter(i=>!i.archivedAt);
  }

  function wrapLegacyRenderer(){
    if(wrapped||typeof window.renderOldSite!=='function')return;
    const original=window.renderOldSite;
    if(original.__tssArchiveWrapped){wrapped=true;return}
    const wrappedRender=function(){
      const s=store();
      if(!s)return original.apply(this,arguments);
      const all=s.interviews||[];
      s.interviews=all.filter(i=>!i.archivedAt);
      try{return original.apply(this,arguments)}finally{
        s.interviews=all;
        removeHistoryPanel();
        setTimeout(()=>window.TSSInterviewActions?.decorate?.(true),0);
      }
    };
    wrappedRender.__tssArchiveWrapped=true;
    window.renderOldSite=wrappedRender;
    wrapped=true;
  }

  function refresh(){
    wrapLegacyRenderer();
    removeHistoryPanel();
    const s=store();if(!s)return;
    const count=document.getElementById('navInterviewCount');
    if(count)count.textContent=String(visibleItems().length);
    try{window.renderOldSite?.()}catch{}
  }

  function boot(){
    wrapLegacyRenderer();
    removeHistoryPanel();
    setTimeout(refresh,180);
    document.addEventListener('click',e=>{
      if(e.target.closest?.('.nav-item[data-view="interviews"]'))setTimeout(refresh,40);
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.TSSInterviewLifecycleUI={refresh,visibleItems};
})();