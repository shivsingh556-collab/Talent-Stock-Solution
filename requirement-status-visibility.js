// Keep all non-closed requirements visible across TODO AI while preserving their real status.
(function(){
  function openRequirements(){
    if(typeof db==='undefined' || !Array.isArray(db.requirements)) return [];
    return db.requirements.filter(r=>String(r.status||'').trim().toLowerCase()!=='closed');
  }

  // Legacy renderers use activeReqs() for sidebar, filters, selectors and dashboard.
  // Override it so On Hold stays visible; Closed remains excluded by the sync layer.
  window.activeReqs=openRequirements;

  function refresh(){
    try{if(typeof renderAll==='function')renderAll()}catch(e){console.warn('TODO AI status visibility renderAll',e)}
    try{if(typeof renderOldSite==='function')renderOldSite()}catch(e){console.warn('TODO AI status visibility renderOldSite',e)}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,50),{once:true});
  else setTimeout(refresh,50);

  window.TSSRequirementStatusVisibility={openRequirements,refresh};
})();
