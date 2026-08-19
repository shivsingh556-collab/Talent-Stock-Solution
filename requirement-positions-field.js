// TODO AI requirement positions field.
(function(){
  const $=id=>document.getElementById(id);

  function findRequirement(){
    if(typeof db==='undefined')return null;
    const key=$('reqId')?.value;
    return (db.requirements||[]).find(r=>r.id===key||r.requirementId===key||r.profileKey===key||r.serverId===key)||null;
  }

  function ensure(){
    const exp=$('reqExperience');
    if(!exp)return;
    let input=$('reqPositions');
    if(!input){
      const holder=document.createElement('div');
      holder.id='reqPositionsField';
      holder.innerHTML='<label>No. of Positions</label><input id="reqPositions" type="number" min="1" step="1" inputmode="numeric" placeholder="e.g. 3" />';
      const expHolder=exp.closest('div');
      expHolder?.insertAdjacentElement('afterend',holder);
      input=$('reqPositions');
    }
    const r=findRequirement();
    input.value=r?.positionsCount??'';
  }

  function boot(){
    ensure();
    const dlg=$('requirementDialog');
    if(dlg&&!dlg.dataset.positionsObserved){
      dlg.dataset.positionsObserved='1';
      new MutationObserver(()=>{if(dlg.open)setTimeout(ensure,60)}).observe(dlg,{attributes:true,attributeFilter:['open']});
    }
    [300,800,1600].forEach(ms=>setTimeout(()=>{if($('requirementDialog')?.open)ensure()},ms));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.TSSRequirementPositions={ensure,boot};
})();