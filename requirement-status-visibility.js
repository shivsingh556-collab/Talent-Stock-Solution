// Keep all non-closed requirements visible across TODO AI and provide a status filter.
(function(){
  const $=id=>document.getElementById(id);

  function openRequirements(){
    if(typeof db==='undefined' || !Array.isArray(db.requirements)) return [];
    return db.requirements.filter(r=>String(r.status||'').trim().toLowerCase()!=='closed');
  }

  // Legacy renderers use activeReqs() across requirements, sidebar and selectors.
  // Treat every non-closed requirement as visible/open while preserving its actual status.
  window.activeReqs=openRequirements;

  function ensureStatusOptions(){
    const reqStatus=$('reqStatus');
    if(reqStatus){
      ['Active','Work In Progress','On Hold','Fulfilled','Closed'].forEach(v=>{
        if(![...reqStatus.options].some(o=>o.value===v || o.textContent===v)){
          const o=document.createElement('option');o.value=v;o.textContent=v;reqStatus.appendChild(o);
        }
      });
    }
  }

  function ensureFilter(){
    if($('requirementStatusFilter')) return $('requirementStatusFilter');
    const row=document.querySelector('#requirements .filter-row');
    if(!row) return null;
    const select=document.createElement('select');
    select.id='requirementStatusFilter';
    select.setAttribute('aria-label','Filter requirements by status');
    select.innerHTML=`
      <option value="">All Statuses</option>
      <option value="Active">Active</option>
      <option value="Work In Progress">Work In Progress</option>
      <option value="On Hold">On Hold</option>
      <option value="Fulfilled">Fulfilled</option>`;
    row.appendChild(select);
    select.addEventListener('change',applyStatusFilter);
    return select;
  }

  function requirementForCard(card){
    const id=card.querySelector('[data-id]')?.dataset?.id || card.dataset?.id;
    if(id && typeof db!=='undefined') return (db.requirements||[]).find(r=>r.id===id || r.requirementId===id);
    const txt=(card.textContent||'').toLowerCase();
    return (typeof db!=='undefined'?db.requirements:[]).find(r=>txt.includes(String(r.requirementId||r.id||'').toLowerCase()) && txt.includes(String(r.title||'').toLowerCase()));
  }

  function applyStatusFilter(){
    const chosen=$('requirementStatusFilter')?.value||'';
    document.querySelectorAll('#requirementCards .req-card').forEach(card=>{
      const r=requirementForCard(card);
      if(!r) return;
      const closed=String(r.status||'').trim().toLowerCase()==='closed';
      const statusMatch=!chosen || String(r.status||'').trim()===chosen;
      // Respect the existing search/client/location filter if it has already hidden this card.
      const baseHidden=card.dataset.statusHidden!=='1' && card.style.display==='none';
      const hide=closed || !statusMatch || baseHidden;
      card.dataset.statusHidden=(closed||!statusMatch)?'1':'0';
      if(closed||!statusMatch) card.style.display='none';
      else if(!baseHidden) card.style.display='block';
    });
  }

  function wrapExistingFilter(){
    if(typeof window.applyProfileFilter!=='function' || window.applyProfileFilter.__statusWrapped) return;
    const original=window.applyProfileFilter;
    const wrapped=function(){
      // Clear only status-owned hiding before the normal filters recalculate visibility.
      document.querySelectorAll('#requirementCards .req-card[data-status-hidden="1"]').forEach(card=>{card.style.display='block';card.dataset.statusHidden='0'});
      original.apply(this,arguments);
      applyStatusFilter();
    };
    wrapped.__statusWrapped=true;
    window.applyProfileFilter=wrapped;
  }

  function refresh(){
    ensureStatusOptions();
    ensureFilter();
    wrapExistingFilter();
    try{if(typeof renderAll==='function')renderAll()}catch(e){console.warn('TODO AI status visibility renderAll',e)}
    try{if(typeof renderOldSite==='function')renderOldSite()}catch(e){console.warn('TODO AI status visibility renderOldSite',e)}
    setTimeout(applyStatusFilter,20);
  }

  function observe(){
    const cards=$('requirementCards');
    if(!cards || cards.dataset.statusObserver==='1') return;
    cards.dataset.statusObserver='1';
    new MutationObserver(()=>setTimeout(applyStatusFilter,0)).observe(cards,{childList:true});
  }

  function boot(){refresh();observe();setTimeout(()=>{ensureFilter();wrapExistingFilter();applyStatusFilter();observe()},250)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  window.TSSRequirementStatusVisibility={openRequirements,refresh,applyStatusFilter,ensureFilter};
})();
