// Assignment fields are mapped in the production hydration before the single render.
(function(){
  async function resync(){
    await window.TSSProduction?.hydrate?.();
    if(document.getElementById('requirementDialog')?.open)window.TSSAssignmentCleanLayout?.build?.();
    window.TSSRequirementDetailsOwnerSync?.patch?.();
    return true;
  }
  // Kept for callers; do not wrap hydrate with a competing second fetch.
  function wrap(){}
  function boot(){}
  window.TSSRequirementAssignmentHydrationFix={boot,resync,wrap};
})();
