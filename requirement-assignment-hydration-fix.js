// Preserve authoritative assignment fields after any generic production hydration.
(function(){
  let wrapped=false;
  async function resync(){
    try{
      await window.TSSRequirementsLiveSync?.syncNow?.();
      try{window.renderOldSite?.()}catch{}
      try{window.TSSAssignmentCleanLayout?.build?.()}catch{}
      try{window.TSSRequirementDetailsOwnerSync?.patch?.()}catch{}
      return true;
    }catch(e){console.warn('Requirement assignment resync',e?.message||e);return false;}
  }
  function wrap(){
    if(wrapped)return;
    const prod=window.TSSProduction;
    if(!prod?.hydrate)return;
    const original=prod.hydrate.bind(prod);
    prod.hydrate=async function(){
      const out=await original(...arguments);
      await resync();
      return out;
    };
    wrapped=true;
  }
  function boot(){wrap();setTimeout(resync,120);setTimeout(resync,650);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,700),{once:true});else setTimeout(boot,700);
  window.TSSRequirementAssignmentHydrationFix={boot,resync,wrap};
})();