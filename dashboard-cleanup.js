// TODO AI dashboard trust cleanup: hide non-actionable widgets and keep internal keys out of the UI.
(function(){
  const INTERNAL_ID_RE = /\b(?:manual-[a-z0-9-]+|catalog-[a-z0-9-]+|TSS\d{3}__[A-Z0-9_-]+)\b/gi;

  function displayIdFor(value){
    const raw=String(value||'');
    try{
      const reqs=(typeof db!=='undefined' && Array.isArray(db?.requirements)) ? db.requirements : [];
      const hit=reqs.find(r=>[r.id,r.profileKey,r.profile_key,r.serverId].filter(Boolean).map(String).includes(raw));
      if(hit){
        const clean=String(hit.requirementId||hit.tss_id||'').trim();
        if(/^TSS\d+$/i.test(clean)) return clean.toUpperCase();
      }
    }catch{}
    const tss=raw.match(/TSS\d+/i);
    return tss ? tss[0].toUpperCase() : raw;
  }

  function cleanTextNode(node){
    if(!node?.nodeValue || !INTERNAL_ID_RE.test(node.nodeValue)) return;
    INTERNAL_ID_RE.lastIndex=0;
    node.nodeValue=node.nodeValue.replace(INTERNAL_ID_RE,m=>displayIdFor(m));
  }

  function cleanVisibleIds(root=document.body){
    if(!root) return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let n;
    while((n=walker.nextNode())) cleanTextNode(n);
  }

  function hideDashboardNoise(){
    const health=document.querySelector('.health-card');
    const workload=document.querySelector('.workload-card');
    if(health) health.remove();
    if(workload) workload.remove();
    const lower=document.querySelector('.lower-dashboard-grid');
    if(lower){
      lower.style.gridTemplateColumns='minmax(0,1fr)';
      lower.style.maxWidth='100%';
    }
  }

  function apply(){
    hideDashboardNoise();
    cleanVisibleIds();
  }

  let queued=false;
  const queueApply=()=>{
    if(queued) return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;apply();});
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();

  const observer=new MutationObserver(queueApply);
  const start=()=>{if(document.body) observer.observe(document.body,{childList:true,subtree:true,characterData:true});};
  if(document.body) start(); else document.addEventListener('DOMContentLoaded',start,{once:true});

  window.TSSDashboardCleanup={apply,displayIdFor};
})();
