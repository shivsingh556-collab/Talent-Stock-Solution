// Ensure requirement ownership/assignment controls are always visible near the top of the form.
(function(){
  const $=id=>document.getElementById(id);
  const OWNERS=['Akash Mistry','Shraddha Sharma','Pooja Wara'];
  const HANDLER='Shweta Tiwari';
  const FALLBACK_RECRUITERS=[
    {name:'Shraddha Sharma',email:'shraddha.s@talent-stock.com'},
    {name:'Pooja Wara',email:'pooja.w@talent-stock.com'},
    {name:'Shweta Tiwari',email:'shweta.t@talent-stock.com'}
  ];
  const FRIENDLY={
    'shraddha.s@talent-stock.com':'Shraddha Sharma',
    'pooja.w@talent-stock.com':'Pooja Wara',
    'shweta.t@talent-stock.com':'Shweta Tiwari'
  };
  let recruiters=[];

  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function reqByKey(key){
    if(typeof db==='undefined')return null;
    return (db.requirements||[]).find(r=>r.id===key||r.requirementId===key||r.profileKey===key||r.serverId===key)||null;
  }

  async function loadRecruiters(){
    try{
      const c=window.TSSBackend?.client;
      if(c){
        const {data,error}=await c.from('profiles').select('full_name,email,role,is_active').eq('is_active',true).eq('role','recruiter').order('email');
        if(!error) recruiters=(data||[]).map(x=>({email:x.email,name:FRIENDLY[String(x.email||'').toLowerCase()]||x.full_name||x.email}));
      }
    }catch(e){console.warn('Assignment recruiter load',e?.message||e)}
    if(!recruiters.length)recruiters=FALLBACK_RECRUITERS;
    fillRecruiters();
  }

  function convertOwnerToDropdown(){
    const old=$('reqClientOwner');
    if(!old || old.tagName==='SELECT')return old;
    const select=document.createElement('select');
    select.id='reqClientOwner';
    select.required=true;
    select.innerHTML=OWNERS.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    const current=String(old.value||'').trim();
    if(OWNERS.includes(current))select.value=current;
    old.replaceWith(select);
    return select;
  }

  function ensureFields(){
    const form=$('requirementForm');if(!form)return;
    const owner=convertOwnerToDropdown();
    if(!owner)return;

    // Insert immediately after the row containing the existing Client Owner field.
    if(!$('reqAssignmentPanel')){
      const panel=document.createElement('div');
      panel.id='reqAssignmentPanel';
      panel.className='assignment-fields-panel';
      panel.innerHTML=`
        <div><label>Requirement Handler</label><input id="reqHandler" value="${HANDLER}" readonly /></div>
        <div><label>Assigned Recruiter(s)</label><select id="reqRecruiters" multiple size="3"></select><small>Ctrl/Cmd click to assign more than one recruiter.</small></div>`;
      const ownerContainer=owner.closest('div');
      const topGrid=owner.closest('.form-grid');
      if(topGrid) topGrid.insertAdjacentElement('afterend',panel);
      else if(ownerContainer) ownerContainer.insertAdjacentElement('afterend',panel);
      else form.prepend(panel);
    }

    if(!$('assignmentFieldsStyle')){
      const s=document.createElement('style');s.id='assignmentFieldsStyle';
      s.textContent=`
        .assignment-fields-panel{display:grid;grid-template-columns:1fr 1.6fr;gap:14px;margin:12px 0 16px;padding:14px;border:1px solid #244761;border-radius:12px;background:#091c2b}
        .assignment-fields-panel label{display:block;margin-bottom:6px}
        .assignment-fields-panel input,.assignment-fields-panel select{width:100%;min-height:42px}
        .assignment-fields-panel small{display:block;margin-top:5px;color:#829db1}
        @media(max-width:760px){.assignment-fields-panel{grid-template-columns:1fr}}
      `;document.head.appendChild(s);
    }
    fillRecruiters();
  }

  function fillRecruiters(){
    const sel=$('reqRecruiters');if(!sel)return;
    const selected=[...sel.selectedOptions].map(o=>o.value);
    sel.innerHTML=recruiters.map(r=>`<option value="${esc(r.email)}">${esc(r.name)} · ${esc(r.email)}</option>`).join('');
    [...sel.options].forEach(o=>o.selected=selected.includes(o.value));
  }

  function populate(){
    ensureFields();
    const r=reqByKey($('reqId')?.value);
    const owner=$('reqClientOwner'),handler=$('reqHandler'),assigned=$('reqRecruiters');
    if(owner){
      const val=r?.clientOwner;
      owner.value=OWNERS.includes(val)?val:OWNERS[0];
    }
    if(handler)handler.value=r?.requirementHandler||HANDLER;
    if(assigned){
      const vals=Array.isArray(r?.assignedRecruiters)?r.assignedRecruiters:[];
      [...assigned.options].forEach(o=>o.selected=vals.includes(o.value));
    }
  }

  function boot(){
    ensureFields();
    loadRecruiters();
    const dlg=$('requirementDialog');
    if(dlg && !dlg.dataset.assignmentFixObserved){
      dlg.dataset.assignmentFixObserved='1';
      new MutationObserver(()=>{if(dlg.open)setTimeout(populate,40)}).observe(dlg,{attributes:true,attributeFilter:['open']});
    }
    // Finite retries for late-rendered form only.
    [200,600,1200,2200].forEach(ms=>setTimeout(ensureFields,ms));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.TSSAssignmentFieldsFix={ensureFields,populate};
})();