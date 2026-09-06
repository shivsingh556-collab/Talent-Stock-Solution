// Remaining requirements include every open status; fulfilled and closed are review-only.
(function(){
  const $=id=>document.getElementById(id);
  const norm=s=>String(s||'').trim().toLowerCase();
  const remainingStatus=s=>['active','work in progress','on hold'].includes(norm(s));

  function openRequirements(){
    if(typeof db==='undefined' || !Array.isArray(db.requirements)) return [];
    return db.requirements.filter(r=>remainingStatus(r.status));
  }

  // Legacy renderers use activeReqs() for sidebar, selectors and counts.
  // Active, WIP and On Hold requirements must remain visible in operational views.
  window.activeReqs=openRequirements;

  function ensureStatusOptions(){
    const reqStatus=$('reqStatus');
    if(reqStatus){
      const current=reqStatus.value;
      reqStatus.innerHTML=`
        <option value="Work In Progress">Work In Progress</option>
        <option value="On Hold">On Hold</option>
        <option value="Closed">Closed</option>
        <option value="Fulfilled">Joined TSS</option>`;
      reqStatus.value=['Work In Progress','On Hold','Closed','Fulfilled'].includes(current)?current:'Work In Progress';
    }
  }

  function ensureFilter(){
    let select=$('requirementStatusFilter');
    if(!select){
      const row=document.querySelector('#requirements .filter-row');
      if(!row) return null;
      select=document.createElement('select');
      select.id='requirementStatusFilter';
      select.setAttribute('aria-label','Filter requirements by status');
      row.appendChild(select);
      select.addEventListener('change',applyStatusFilter);
    }
    const current=select.value;
    select.innerHTML=`
      <option value="Remaining">Remaining Requirements</option>
      <option value="Work In Progress">Work In Progress</option>
      <option value="On Hold">On Hold</option>
      <option value="Closed">Closed</option>
      <option value="Fulfilled">Joined TSS</option>`;
    select.value=['Remaining','Work In Progress','On Hold','Closed','Fulfilled'].includes(current)?current:'Remaining';
    return select;
  }

  function requirementForCard(card){
    const id=card.querySelector('[data-id]')?.dataset?.id || card.dataset?.id;
    if(id && typeof db!=='undefined') return (db.requirements||[]).find(r=>r.id===id || r.requirementId===id);
    const txt=(card.textContent||'').toLowerCase();
    return (typeof db!=='undefined'?db.requirements:[]).find(r=>txt.includes(String(r.requirementId||r.id||'').toLowerCase()) && txt.includes(String(r.title||'').toLowerCase()));
  }

  function applyStatusFilter(){
    const chosen=norm($('requirementStatusFilter')?.value||'Remaining');
    const query=norm($('jobProfileSearch')?.value);
    const client=norm($('clientFilter')?.value);
    const location=norm($('locationFilter')?.value);
    document.querySelectorAll('#requirementCards .req-card').forEach(card=>{
      const r=requirementForCard(card);
      if(!r)return;
      const status=norm(r.status);
      const statusMatch=chosen==='remaining'?remainingStatus(status):
        chosen==='work in progress'?['active','work in progress'].includes(status):status===chosen;
      const text=norm(`${r.id} ${r.requirementId||''} ${r.client} ${r.title} ${r.location} ${(r.skills||[]).join(' ')}`);
      const matches=statusMatch&&(!query||text.includes(query))&&(!client||norm(r.client)===client)&&(!location||norm(r.location)===location);
      const display=matches?'block':'none';
      if(card.style.display!==display)card.style.display=display;
    });
    updateRemainingCount();
  }

  function updateRemainingCount(){
    const remaining=openRequirements();
    const n=remaining.length;
    const positions=remaining.reduce((sum,r)=>sum+(Number(r.positionsCount||r.positions_count)||0),0);
    if($('navReqCount'))$('navReqCount').textContent=String(n);
    if($('clientReqCount'))$('clientReqCount').textContent=String(n);
    if($('activeReqChip'))$('activeReqChip').textContent=`${n} remaining requirements · ${positions} positions`;
  }

  function refresh(){
    ensureStatusOptions();
    ensureFilter();
    try{if(typeof renderAll==='function')renderAll()}catch(e){console.warn('TODO AI status visibility renderAll',e)}
    try{if(typeof renderOldSite==='function')renderOldSite()}catch(e){console.warn('TODO AI status visibility renderOldSite',e)}
    applyStatusFilter();
  }

  function observe(){
    const cards=$('requirementCards');
    if(!cards || cards.dataset.statusObserver==='1') return;
    cards.dataset.statusObserver='1';
    new MutationObserver(applyStatusFilter).observe(cards,{childList:true});
  }

  function boot(){refresh();observe();setTimeout(()=>{ensureFilter();applyStatusFilter();observe()},250)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  window.TSSRequirementStatusVisibility={openRequirements,refresh,applyStatusFilter,ensureFilter,updateRemainingCount};
})();

