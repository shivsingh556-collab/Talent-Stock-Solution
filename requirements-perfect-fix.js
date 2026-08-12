(function(){
  const $=id=>document.getElementById(id);
  const C=()=>window.TSSBackend?.client;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const toastSafe=m=>{try{toast(m)}catch{console.log(m)}};

  function getReq(id){return (window.db?.requirements||[]).find(r=>String(r.id)===String(id)||String(r.profileKey||'')===String(id)||String(r.requirementId||'')===String(id));}

  function renameRequirements(){
    const nav=document.querySelector('#nav .nav-item[data-view="requirements"]');
    if(nav){const count=nav.querySelector('b');nav.innerHTML='<span>▣</span>Requirements';if(count)nav.appendChild(count)}
    document.querySelectorAll('.jobs-table-card h3').forEach(h=>{if(/active job profiles/i.test(h.textContent))h.textContent='Active Requirements'});
    const section=$('requirements');
    if(section){const eyebrow=section.querySelector('.section-head span');const h=section.querySelector('.section-head h1');const p=section.querySelector('.section-head p');if(eyebrow)eyebrow.textContent='REQUIREMENT MASTER';if(h)h.textContent='Requirements';if(p)p.textContent='Open any requirement to review complete client details, JD, skills and ownership.'}
    const ph=$('jobProfileSearch');if(ph)ph.placeholder='Search TSS ID, client, requirement or skill';
    const side=$('requirementSidebarSearch');if(side)side.placeholder='Search TSS ID or requirement';
  }

  function ensureLogout(){
    if($('sidebarLogoutBtn'))return;
    const btn=document.createElement('button');btn.id='sidebarLogoutBtn';btn.className='sidebar-logout';btn.innerHTML='<span>↪</span><strong>Log out</strong>';
    const note=document.querySelector('.workspace-note');
    (note?.parentNode||document.querySelector('.sidebar'))?.insertBefore(btn,note?.nextSibling||null);
    btn.onclick=logout;
    const top=$('signOutBtn');if(top)top.onclick=logout;
  }
  async function logout(){
    if(!confirm('Log out from TSS Resume Intelligence?'))return;
    try{if(window.TSSBackend?.enabled)await window.TSSBackend.signOut()}catch(e){console.warn(e)}
    localStorage.removeItem('tss_user_session');localStorage.removeItem('tss_demo_auth');
    window.location.reload();
  }

  function ensureDetailDialog(){
    if($('requirementDetailDialog'))return;
    const d=document.createElement('dialog');d.id='requirementDetailDialog';d.className='requirement-detail-dialog';
    d.innerHTML=`<div class="req-detail-shell"><div class="req-detail-head"><div><span id="rdTss">REQUIREMENT</span><h2 id="rdTitle">Requirement Details</h2><p id="rdClient"></p></div><button id="rdClose" class="req-detail-close">×</button></div><div id="rdBody"></div><div class="req-detail-actions"><button id="rdEdit" class="btn ghost">Edit Requirement</button><button id="rdScreen" class="blue-btn">Screen Candidate</button></div></div>`;
    document.body.appendChild(d);$('rdClose').onclick=()=>d.close();d.addEventListener('click',e=>{if(e.target===d)d.close()});
  }

  async function loadOwners(){
    if(!C())return;try{const{data,error}=await C().from('requirements').select('id,profile_key,tss_id,client_owner');if(error)throw error;(data||[]).forEach(row=>{const r=(db.requirements||[]).find(x=>String(x.serverId||'')===String(row.id)||String(x.profileKey||x.id)===String(row.profile_key));if(r){r.serverId=row.id;r.clientOwner=row.client_owner||''}})}catch(e){console.warn('client owner load',e)}
  }

  function chips(items,empty='Not provided'){const a=Array.isArray(items)?items.filter(Boolean):[];return a.length?`<div class="rd-chips">${a.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:`<span class="rd-empty">${empty}</span>`}

  function openDetail(id){
    ensureDetailDialog();const r=getReq(id);if(!r)return;
    const d=$('requirementDetailDialog');d.dataset.req=String(r.id);$('rdTss').textContent=`${r.requirementId||r.id} · ${r.status||'Active'}`;$('rdTitle').textContent=r.title||'Requirement';$('rdClient').textContent=r.client||'Client';
    $('rdBody').innerHTML=`
      <div class="rd-summary-grid">
        <div><span>Client</span><strong>${esc(r.client||'Not provided')}</strong></div>
        <div class="rd-owner-card"><span>Client Owner / Account Owner</span><div><input id="rdOwnerInput" value="${esc(r.clientOwner||'')}" placeholder="Type who owns this client"/><button id="rdSaveOwner" class="btn ghost">Save</button></div><small>Manual field · use recruiter/manager name responsible for this client.</small></div>
        <div><span>Location</span><strong>${esc(r.location||'Not provided')}</strong></div>
        <div><span>Experience</span><strong>${esc(r.experience||'Not provided')}</strong></div>
        <div><span>Salary / Budget</span><strong>${esc(r.salaryRange||'Not provided')}</strong></div>
        <div><span>Qualification</span><strong>${esc(r.qualification||'Not provided')}</strong></div>
      </div>
      <section class="rd-section"><h3>Mandatory Skills</h3>${chips(r.skills)}</section>
      <section class="rd-section"><h3>Preferred Skills</h3>${chips(r.preferred)}</section>
      <section class="rd-section"><h3>Job Description / Responsibilities</h3><div class="rd-longtext">${esc((r.responsibilities||r.jdText||'Not provided').replace(/_x000D_/g,'\n'))}</div></section>
      ${r.jdText&&r.jdText!==r.responsibilities?`<section class="rd-section"><h3>Full JD Text</h3><div class="rd-longtext">${esc(r.jdText.replace(/_x000D_/g,'\n'))}</div></section>`:''}`;
    $('rdSaveOwner').onclick=()=>saveOwner(r,$('rdOwnerInput').value.trim());
    $('rdEdit').onclick=()=>{d.close();const b=document.querySelector(`.edit-req[data-id="${CSS.escape(String(r.id))}"]`);if(b)b.click();else if(window.openRequirement)window.openRequirement(r.id)};
    $('rdScreen').onclick=()=>{d.close();const sel=$('screenRequirement');if(sel){sel.value=r.id;try{updateSelectedRequirement()}catch{}}document.querySelector('.nav-item[data-view="screening"]')?.click()};
    d.showModal();
  }

  async function saveOwner(r,owner){
    r.clientOwner=owner;try{saveDB()}catch{}
    try{if(C()){
      let q=C().from('requirements').update({client_owner:owner||null});
      q=r.serverId?q.eq('id',r.serverId):q.eq('profile_key',r.profileKey||r.id);
      const{error}=await q;if(error)throw error;
    }toastSafe('Client owner saved');openDetail(r.id)}catch(e){toastSafe('Could not save client owner: '+e.message)}
  }

  function injectOwnerInEdit(){
    const form=$('requirementForm');if(!form||$('reqClientOwner'))return;
    const grid=form.querySelector('.form-grid');if(!grid)return;const wrap=document.createElement('div');wrap.innerHTML='<label>Client Owner / Account Owner</label><input id="reqClientOwner" placeholder="Type recruiter/manager responsible for this client" />';grid.appendChild(wrap);
    document.addEventListener('click',e=>{const b=e.target.closest('.edit-req');if(!b)return;setTimeout(()=>{const r=getReq(b.dataset.id);if(r&&$('reqClientOwner'))$('reqClientOwner').value=r.clientOwner||''},30)},true);
    $('saveRequirementBtn')?.addEventListener('click',()=>setTimeout(async()=>{const id=$('reqId')?.value;const r=getReq(id)||(db.requirements||[]).at(-1);if(!r)return;r.clientOwner=$('reqClientOwner')?.value.trim()||r.clientOwner||'';try{saveDB()}catch{};try{if(C()){let q=C().from('requirements').update({client_owner:r.clientOwner||null});q=r.serverId?q.eq('id',r.serverId):q.eq('profile_key',r.profileKey||r.id);await q}}catch(e){console.warn(e)}},250));
  }

  function addViewButtons(){
    document.querySelectorAll('#requirementCards .req-card').forEach(card=>{if(card.querySelector('.view-req-details'))return;const edit=card.querySelector('.edit-req');const id=edit?.dataset.id;if(!id)return;const actions=card.querySelector('.card-actions')||card;const b=document.createElement('button');b.className='btn ghost view-req-details';b.dataset.id=id;b.textContent='View Details';actions.insertBefore(b,actions.firstChild);b.onclick=e=>{e.stopPropagation();openDetail(id)}})
  }

  function interceptSidebar(){
    document.addEventListener('click',e=>{
      const role=e.target.closest('.client-role');if(role){e.preventDefault();e.stopImmediatePropagation();openDetail(role.dataset.req);return}
      const card=e.target.closest('#requirementCards .req-card');if(card&&!e.target.closest('button,input,select,a')){const id=card.querySelector('.edit-req')?.dataset.id;if(id){e.preventDefault();openDetail(id)}}
    },true);
  }

  function observeRenders(){const mo=new MutationObserver(()=>{renameRequirements();addViewButtons();ensureLogout()});mo.observe(document.body,{subtree:true,childList:true});}

  function updateCounts(){const n=(db.requirements||[]).filter(r=>r.status==='Active').length;['navReqCount','clientReqCount'].forEach(id=>{if($(id))$(id).textContent=n});if($('activeReqChip'))$('activeReqChip').textContent=`${n} active requirements`}

  async function init(){renameRequirements();ensureLogout();ensureDetailDialog();injectOwnerInEdit();interceptSidebar();observeRenders();await loadOwners();updateCounts();addViewButtons();setTimeout(()=>{renameRequirements();updateCounts();addViewButtons()},800)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.TSSRequirementsUX={openDetail,loadOwners};
})();