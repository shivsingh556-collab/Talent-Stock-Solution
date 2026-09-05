// Stability-first runtime for TSS Resume Intelligence.
(function(){
  const $=id=>document.getElementById(id);
  const backend=()=>window.TSSBackend;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let booted=false;

  function renameUI(){
    document.querySelectorAll('.nav-item').forEach(b=>{if(b.dataset.view==='requirements'){const count=b.querySelector('b')?.outerHTML||'';b.innerHTML=`<span>▣</span>Requirements ${count}`;}});
    document.querySelectorAll('*').forEach(el=>{
      if(el.children.length===0&&el.textContent==='Active Job Profiles')el.textContent='Active Requirements';
    });
    const search=$('requirementSidebarSearch');if(search)search.placeholder='Search TSS ID or requirement';
  }

  function makeSidebarUsable(){
    const side=document.querySelector('.sidebar');
    const tree=$('clientRequirementTree');
    if(side){side.style.overflow='hidden';side.style.minHeight='0'}
    if(tree){tree.style.overflowY='auto';tree.style.overflowX='hidden';tree.style.minHeight='160px';tree.style.flex='1 1 auto';tree.style.maxHeight='calc(100vh - 560px)';tree.style.paddingRight='6px'}
  }

  async function refreshFromSupabase(){
    if(!backend()?.enabled)return;
    const user=await backend().currentUser().catch(()=>null);if(!user)return;
    const c=backend().client;
    const {data:reqs,error}=await c.from('requirements').select('*,clients(name)').neq('status','Closed').order('tss_id');
    if(error)throw error;
    if(Array.isArray(reqs)){
      db.requirements=reqs.map(row=>({
        id:row.profile_key||row.tss_id, requirementId:row.tss_id, profileKey:row.profile_key, serverId:row.id,
        client:row.clients?.name||'Client', clientOwner:row.client_owner||'', title:row.job_title,
        location:row.location||'Not provided', experience:row.experience_text||'Not provided',
        salaryRange:row.salary_range||'Not provided', industry:row.industry||'', qualification:row.qualification||'',
        responsibilities:row.responsibilities||'', jdText:row.jd_text||'', status:row.status||'Active',
        skills:row.mandatory_skills||[], preferred:row.preferred_skills||[],
        aiSuggested:Boolean(row.ai_suggested_skills?.length&&!row.ai_skills_approved)
      }));
      localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(db));
      try{renderAll()}catch{}
      try{renderOldSite()}catch{}
      const total=reqs.length;
      const active=reqs.filter(r=>String(r.status||'').toLowerCase()==='active').length;
      if($('navReqCount'))$('navReqCount').textContent=total;
      if($('clientReqCount'))$('clientReqCount').textContent=total;
      if($('activeReqChip'))$('activeReqChip').textContent=`${active} active · ${total-active} on hold`;
    }
  }

  async function logout(){
    try{await backend()?.signOut?.()}catch(e){console.warn(e)}
    localStorage.removeItem('tss_user_session');
    localStorage.removeItem('tss_demo_auth');
    $('workspace')?.classList.add('hidden');
    $('loginGate')?.classList.remove('hidden');
    if($('loginPassword'))$('loginPassword').value='';
    location.reload();
  }

  function ensureLogout(){
    const top=$('signOutBtn');if(top){top.onclick=e=>{e.preventDefault();logout()};top.title='Logout'}
    if(!$('sidebarLogout')){
      const b=document.createElement('button');b.id='sidebarLogout';b.className='add-client-btn';b.style.marginTop='4px';b.textContent='↪  Logout';b.onclick=logout;
      const note=document.querySelector('.workspace-note');note?.after(b);
    }
  }

  function ensureOwnerField(){
    if($('reqClientOwner'))return;
    const client=$('reqClient')?.closest('div');if(!client)return;
    const wrap=document.createElement('div');wrap.innerHTML='<label>Client Owner / Account Owner</label><input id="reqClientOwner" placeholder="Type recruiter / account owner name" />';
    client.after(wrap);
  }

  function ensureDetailsDialog(){
    if($('requirementDetailsDialog'))return;
    const d=document.createElement('dialog');d.id='requirementDetailsDialog';d.className='requirement-details-dialog';d.innerHTML=`<div class="req-detail-shell"><div class="dialog-head"><div><span class="purple-label">REQUIREMENT DETAILS</span><h3 id="reqDetailTitle">Requirement</h3></div><button id="closeReqDetails" class="icon-btn">×</button></div><div id="reqDetailBody"></div><div class="dialog-actions"><button id="reqDetailEdit" class="btn ghost">Edit Requirement</button><button id="reqDetailScreen" class="btn primary">Screen Candidate</button></div></div>`;document.body.appendChild(d);$('closeReqDetails').onclick=()=>d.close();
  }

  function openDetails(r){
    ensureDetailsDialog();if(!r)return;
    $('reqDetailTitle').textContent=`${r.requirementId||r.id} · ${r.title}`;
    const chips=a=>(a||[]).length?(a||[]).map(x=>`<span class="skill">${esc(x)}</span>`).join(''):'<span class="muted">Not provided</span>';
    $('reqDetailBody').innerHTML=`<div class="req-detail-grid"><div><span>Client</span><strong>${esc(r.client)}</strong></div><div><span>Client Owner</span><strong>${esc(r.clientOwner||'Not assigned')}</strong></div><div><span>Location</span><strong>${esc(r.location||'Not provided')}</strong></div><div><span>Experience</span><strong>${esc(r.experience||'Not provided')}</strong></div><div><span>Salary / Budget</span><strong>${esc(r.salaryRange||'Not provided')}</strong></div><div><span>Qualification</span><strong>${esc(r.qualification||'Not provided')}</strong></div></div><h4>Mandatory Skills</h4><div class="skill-cloud">${chips(r.skills)}</div><h4>Preferred Skills</h4><div class="skill-cloud">${chips(r.preferred)}</div><h4>Roles & Responsibilities / JD</h4><div class="req-detail-text">${esc(r.responsibilities||r.jdText||'Not provided')}</div>`;
    $('reqDetailEdit').onclick=()=>{ $('requirementDetailsDialog').close(); try{openRequirement(r.id)}catch{} };
    $('reqDetailScreen').onclick=()=>{ $('requirementDetailsDialog').close(); if($('screenRequirement'))$('screenRequirement').value=r.id; try{updateSelectedRequirement()}catch{}; try{gotoView('screening')}catch{} };
    $('requirementDetailsDialog').showModal();
  }

  function wireRequirementClicks(){
    document.addEventListener('click',e=>{
      const role=e.target.closest('.client-role');
      if(role){e.preventDefault();e.stopPropagation();const key=role.dataset.id||role.dataset.req||role.getAttribute('data-requirement');const text=role.innerText;const r=(db.requirements||[]).find(x=>x.id===key)||(db.requirements||[]).find(x=>text.includes(x.requirementId||x.id)&&text.includes(x.title));if(r)openDetails(r);return;}
      const card=e.target.closest('#requirementCards .req-card');
      if(card&&!e.target.closest('button,input,select,textarea')){const edit=card.querySelector('[data-id]');const key=edit?.dataset.id;const r=(db.requirements||[]).find(x=>x.id===key);if(r)openDetails(r)}
    },true);
  }

  async function saveOwnerFromDialog(){
    const id=$('reqId')?.value;const r=(db.requirements||[]).find(x=>x.id===id);if(!r)return;
    r.clientOwner=$('reqClientOwner')?.value.trim()||'';
    if(r.serverId&&backend()?.enabled){const {error}=await backend().client.from('requirements').update({client_owner:r.clientOwner,updated_at:new Date().toISOString()}).eq('id',r.serverId);if(error)throw error;}
  }

  function wireOwnerSave(){
    const save=$('saveRequirementBtn');if(!save||save.dataset.stableOwner)return;save.dataset.stableOwner='1';save.addEventListener('click',()=>setTimeout(()=>saveOwnerFromDialog().catch(e=>console.warn('Owner save',e)),250));
    const dialog=$('requirementDialog');dialog?.addEventListener('close',()=>{const id=$('reqId')?.value;const r=(db.requirements||[]).find(x=>x.id===id);if(r&&$('reqClientOwner'))$('reqClientOwner').value=r.clientOwner||''});
  }

  function css(){
    if($('stableRuntimeStyle'))return;const s=document.createElement('style');s.id='stableRuntimeStyle';s.textContent=`
      .client-tree{scrollbar-width:thin;scrollbar-color:#2b79b5 transparent}.client-tree::-webkit-scrollbar{width:8px}.client-tree::-webkit-scrollbar-thumb{background:#235f8d;border-radius:8px}
      #sidebarLogout{width:100%;border-color:#5d3140;color:#ffd6df;background:#2a1720}.requirement-details-dialog{width:min(900px,92vw);max-height:88vh;border:1px solid #28506f;border-radius:16px;background:#081725;color:#eef7ff;padding:0}.req-detail-shell{padding:22px}.req-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0}.req-detail-grid>div{border:1px solid #1d3d58;background:#0b2032;padding:14px;border-radius:10px}.req-detail-grid span{display:block;color:#8aa8c3;font-size:12px;margin-bottom:5px}.req-detail-grid strong{font-size:15px}.req-detail-shell h4{margin:18px 0 9px}.req-detail-text{white-space:pre-wrap;line-height:1.6;color:#bdd0df;border:1px solid #1d3d58;background:#091b2b;border-radius:10px;padding:14px;max-height:240px;overflow:auto}@media(max-width:700px){.req-detail-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  async function boot(){if(booted)return;booted=true;css();renameUI();makeSidebarUsable();ensureLogout();ensureOwnerField();ensureDetailsDialog();wireRequirementClicks();wireOwnerSave();renameUI();makeSidebarUsable();}

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,300));else setTimeout(boot,300);
  window.TSSStableRuntime={boot,refreshFromSupabase,openDetails,logout};
})();
