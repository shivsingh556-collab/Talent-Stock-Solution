// Keep the exact requirement selected when "Screen Candidate" is launched from Requirements.
(function(){
  'use strict';
  if(window.__TSS_REQUIREMENT_SCREENING_SELECTION_FIX__) return;
  window.__TSS_REQUIREMENT_SCREENING_SELECTION_FIX__ = true;

  const $ = id => document.getElementById(id);
  const store = () => (typeof db !== 'undefined' ? db : null);
  let lockedKey = '';
  let lockUntil = 0;

  function same(a,b){ return String(a ?? '') === String(b ?? ''); }
  function reqByKey(key){
    const k=String(key||'');
    return (store()?.requirements||[]).find(r => [r.id,r.serverId,r.requirementId,r.profileKey].some(v=>same(v,k))) || null;
  }
  function optionValueFor(select, r, key){
    if(!select) return '';
    const candidates=[r?.id,r?.serverId,r?.requirementId,r?.profileKey,key].filter(Boolean).map(String);
    return candidates.find(v=>[...select.options].some(o=>o.value===v)) || '';
  }
  function applySelection(key){
    const r=reqByKey(key);
    const screen=$('screenRequirement');
    if(!r || !screen) return false;
    const value=optionValueFor(screen,r,key);
    if(!value) return false;
    if(screen.value!==value){
      screen.value=value;
      screen.dispatchEvent(new Event('change',{bubbles:true}));
    } else {
      try{ if(typeof updateSelectedRequirement==='function') updateSelectedRequirement(); }catch{}
    }
    const top=$('topRequirementSelect');
    if(top){
      const topValue=optionValueFor(top,r,key);
      if(topValue && top.value!==topValue){
        top.value=topValue;
        top.dispatchEvent(new Event('change',{bubbles:true}));
      }
    }
    try{ sessionStorage.setItem('tss_screen_requirement_key', String(r.serverId||r.id||key)); }catch{}
    return true;
  }
  function holdSelection(key){
    lockedKey=String(key||''); lockUntil=Date.now()+2200;
    [0,30,90,180,350,650,1100,1800].forEach(ms=>setTimeout(()=>{
      if(Date.now()<=lockUntil && lockedKey) applySelection(lockedKey);
    },ms));
  }
  function launch(button){
    const key=button?.dataset?.id || button?.dataset?.req || button?.closest('.req-card')?.querySelector('[data-id]')?.dataset?.id;
    const r=reqByKey(key);
    if(!r) return false;
    lockedKey=String(r.serverId||r.id||key);
    try{ if(typeof gotoView==='function') gotoView('screening'); }catch{}
    holdSelection(lockedKey);
    return true;
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest('.screen-req');
    if(!btn) return;
    // Capture the intended requirement before any older click handler can overwrite it.
    e.preventDefault();
    e.stopImmediatePropagation();
    launch(btn);
  },true);

  // Do not fight genuine user changes after the short navigation lock expires.
  document.addEventListener('change',e=>{
    if(e.target?.id==='screenRequirement' && Date.now()>lockUntil){
      lockedKey='';
      try{ sessionStorage.setItem('tss_screen_requirement_key', e.target.value||''); }catch{}
    }
  });

  window.TSSRequirementScreeningSelectionFix={applySelection,launch};
})();