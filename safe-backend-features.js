// TODO AI — safe backend features. Event-driven only; no repeating render loops.
(function(){
  const $=id=>document.getElementById(id);
  const B=()=>window.TSSBackend;
  const C=()=>B()?.client;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const notify=m=>{try{toast(m)}catch{console.log(m)}};
  let identity=null;

  async function getIdentity(){
    if(identity)return identity;
    if(!C())return null;
    const {data:{session}}=await C().auth.getSession();
    const u=session?.user;if(!u)return null;
    const {data:p}=await C().from('profiles').select('id,full_name,email,role,is_active').eq('id',u.id).maybeSingle();
    identity={id:u.id,name:p?.full_name||u.email?.split('@')[0]||'Recruiter',email:u.email,role:p?.role||'recruiter',is_active:p?.is_active!==false};
    return identity;
  }

  async function logAction(action,entityType='',entityId='',details={}){
    try{const me=await getIdentity();if(!me||!C())return;await C().from('activity_logs').insert({actor_id:me.id,action,entity_type:entityType,entity_id:String(entityId||''),details});}catch(e){console.warn('activity log skipped',e?.message||e)}
  }

  function localReqForScreen(s){return (db.requirements||[]).find(r=>r.id===s.requirementId||r.profileKey===s.requirementId||r.requirementId===s.requirementId)}
  function localCandForScreen(s){return (db.candidates||[]).find(c=>c.id===s.candidateId||c.serverId===s.candidateId)}

  async function upsertLatestMatch(){
    try{
      if(!C())return;
      const s=(db.screenings||[]).at(-1);if(!s?.serverId)return;
      const c=localCandForScreen(s),r=localReqForScreen(s);if(!c||!r)return;
      const candidateId=c.serverId||c.id;
      let requirementId=r.serverId;
      if(!requirementId){const {data}=await C().from('requirements').select('id').eq('profile_key',r.profileKey||r.id).maybeSingle();requirementId=data?.id}
      if(!candidateId||!requirementId)return;
      const {error}=await C().from('candidate_requirement_matches').upsert({candidate_id:candidateId,requirement_id:requirementId,match_score:Number(s.score||0),matching_skills:s.matched||[],missing_skills:s.missing||[],recommendation:s.recommendation||'Review Recommended',last_calculated_at:new Date().toISOString(),ignored:false},{onConflict:'candidate_id,requirement_id'});
      if(error)throw error;
      await logAction('candidate_match_saved','candidate',candidateId,{requirement_id:requirementId,score:Number(s.score||0)});
    }catch(e){console.warn('match persistence skipped',e?.message||e)}
  }

  const norm=x=>String(x||'').trim().toLowerCase().replace(/[^a-z0-9+#.]/g,'');
  function candidateSkillScore(c,r){
    const cset=new Set((c.skills||[]).map(norm).filter(Boolean));
    const mand=(r.skills||[]).map(norm).filter(Boolean),pref=(r.preferred||[]).map(norm).filter(Boolean);
    const hit=a=>a.filter(x=>cset.has(x));
    const mh=hit(mand),ph=hit(pref);
    const mandatoryPct=mand.length?mh.length/mand.length*100:70;
    const preferredPct=pref.length?ph.length/pref.length*100:70;
    let expPct=70;const years=Number(c.totalExperience||0);const nums=String(r.experience||'').match(/\d+(?:\.\d+)?/g)?.map(Number)||[];if(nums.length&&years){const min=nums[0],max=nums[1]||999;expPct=years>=min&&years<=max?100:years>=min*.8?75:45}
    const score=Math.max(0,Math.min(100,Math.round(mandatoryPct*.6+preferredPct*.15+expPct*.25)));
    return{score,matching:[...new Set([...mh,...ph])],missing:mand.filter(x=>!cset.has(x)),recommendation:score>=75?'Strong Match':score>=50?'Review Recommended':'Not Suitable'};
  }

  async function rematchRequirement(localReq){
    try{
      if(!C()||!localReq)return;
      let requirementId=localReq.serverId;if(!requirementId){const {data}=await C().from('requirements').select('id').eq('profile_key',localReq.profileKey||localReq.id).maybeSingle();requirementId=data?.id}if(!requirementId)return;
      const {data:cands,error}=await C().from('candidates').select('*');if(error)throw error;
      if(!cands?.length)return;
      const rows=cands.map(raw=>{const c={id:raw.id,totalExperience:raw.total_experience,skills:raw.skills||[]};const m=candidateSkillScore(c,localReq);return{candidate_id:raw.id,requirement_id:requirementId,match_score:m.score,matching_skills:m.matching,missing_skills:m.missing,recommendation:m.recommendation,last_calculated_at:new Date().toISOString(),ignored:false}});
      const {error:ue}=await C().from('candidate_requirement_matches').upsert(rows,{onConflict:'candidate_id,requirement_id'});if(ue)throw ue;
      const strong=rows.filter(x=>x.match_score>=75).length;
      if(strong)notify(`${strong} existing CV match${strong===1?'':'es'} found for this requirement`);
      await logAction('requirement_rematched','requirement',requirementId,{candidates:rows.length,strong_matches:strong});
    }catch(e){console.warn('rematch skipped',e?.message||e)}
  }

  async function syncLatestNote(){
    try{
      if(!C())return;const s=(db.screenings||[]).at(-1);if(!s?.serverId||!String(s.notes||'').trim())return;
      const c=localCandForScreen(s),r=localReqForScreen(s);if(!c)return;const candidateId=c.serverId||c.id;let requirementId=r?.serverId||null;
      const me=await getIdentity();if(!me)return;
      const note=String(s.notes).trim();
      const {data:exists}=await C().from('candidate_notes').select('id').eq('candidate_id',candidateId).eq('created_by',me.id).eq('note',note).limit(1);
      if(exists?.length)return;
      const {error}=await C().from('candidate_notes').insert({candidate_id:candidateId,requirement_id:requirementId,note,created_by:me.id});if(error)throw error;
      await logAction('candidate_note_added','candidate',candidateId,{requirement_id:requirementId});
    }catch(e){console.warn('note sync skipped',e?.message||e)}
  }

  async function latestResume(c){const id=c.serverId||c.id;if(!C()||!id)return null;const {data,error}=await C().from('resume_versions').select('*').eq('candidate_id',id).order('uploaded_at',{ascending:false}).limit(1).maybeSingle();if(error)throw error;return data}
  async function viewResume(c){try{const r=await latestResume(c);if(!r)return notify('No stored resume found');const {data,error}=await C().storage.from('candidate-resumes').createSignedUrl(r.storage_path,120);if(error)throw error;window.open(data.signedUrl,'_blank','noopener');await logAction('resume_viewed','candidate',c.serverId||c.id,{resume_version:r.id})}catch(e){notify('Unable to open resume: '+e.message)}}
  async function markOutdated(c){try{const r=await latestResume(c);if(!r)return notify('No stored resume found');const {error}=await C().from('resume_versions').update({is_outdated:true,is_current:false}).eq('id',r.id);if(error)throw error;notify('Resume marked outdated');await logAction('resume_marked_outdated','candidate',c.serverId||c.id,{resume_version:r.id})}catch(e){notify('Could not mark resume outdated: '+e.message)}}
  async function deleteEverywhere(c){
    if(!confirm(`Delete ${c.name||'this candidate'} everywhere?\n\nThis permanently removes the candidate, CV versions, screenings, matches, notes and interviews. This cannot be undone.`))return;
    try{const id=c.serverId||c.id;if(!C()||!id)return;const {data:versions}=await C().from('resume_versions').select('storage_path').eq('candidate_id',id);const paths=(versions||[]).map(x=>x.storage_path).filter(Boolean);if(paths.length){const {error:se}=await C().storage.from('candidate-resumes').remove(paths);if(se)throw se}const {error}=await C().from('candidates').delete().eq('id',id);if(error)throw error;
      db.candidates=(db.candidates||[]).filter(x=>(x.serverId||x.id)!==id);db.screenings=(db.screenings||[]).filter(x=>x.candidateId!==id);db.interviews=(db.interviews||[]).filter(x=>x.candidateId!==id);localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(db));try{renderAll()}catch{}try{renderOldSite()}catch{}notify('Candidate deleted everywhere');await logAction('candidate_deleted','candidate',id,{})
    }catch(e){notify('Delete Everywhere failed: '+e.message)}
  }

  function findCandidateFromRow(tr){const text=tr.innerText||'';const email=(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)||[])[0];return (db.candidates||[]).find(c=>email&&c.email?.toLowerCase()===email.toLowerCase())||(db.candidates||[]).find(c=>c.name&&text.includes(c.name))}
  function enhanceCandidateTable(){
    const wrap=$('candidateTableWrap');if(!wrap)return;
    const head=wrap.querySelector('thead tr');if(head&&!head.querySelector('.safe-actions-head')){const th=document.createElement('th');th.className='safe-actions-head';th.textContent='Actions';head.appendChild(th)}
    wrap.querySelectorAll('tbody tr').forEach(tr=>{if(tr.querySelector('.safe-candidate-actions'))return;const c=findCandidateFromRow(tr);if(!c)return;const td=document.createElement('td');td.className='safe-candidate-actions';td.innerHTML='<div class="safe-action-row"><button class="btn ghost" data-a="view">View Resume</button><button class="btn ghost" data-a="old">Mark Outdated</button><button class="btn ghost safe-danger" data-a="delete">Delete Everywhere</button></div>';tr.appendChild(td);td.querySelector('[data-a="view"]').onclick=()=>viewResume(c);td.querySelector('[data-a="old"]').onclick=()=>markOutdated(c);td.querySelector('[data-a="delete"]').onclick=()=>deleteEverywhere(c)})
  }

  function ensureAdminUI(){
    getIdentity().then(me=>{if(me?.role!=='admin')return;const nav=document.querySelector('.sidebar nav');if(nav&&!nav.querySelector('[data-view="admin"]')){const b=document.createElement('button');b.className='nav-item';b.dataset.view='admin';b.innerHTML='<span>⚙</span>Admin';b.onclick=()=>{try{gotoView('admin')}catch{}renderAdmin()};nav.appendChild(b)}if(!$('admin')){const s=document.createElement('section');s.id='admin';s.className='view';s.innerHTML='<div class="section-head"><div><span>ADMINISTRATION</span><h1>Recruiter Access & System Overview</h1><p>Manage existing TSS users and review company-wide data.</p></div></div><div id="adminKpis" class="safe-kpis"></div><div class="old-panel"><div class="panel-title"><h3>Recruiter Accounts</h3></div><div id="adminUsers"></div></div>';document.querySelector('.main-shell')?.appendChild(s)}}).catch(()=>{})
  }
  async function renderAdmin(){
    try{const me=await getIdentity();if(me?.role!=='admin'||!C())return;const [{data:p},{count:cCount},{count:sCount},{count:rCount}]=await Promise.all([C().from('profiles').select('*').order('created_at'),C().from('candidates').select('*',{count:'exact',head:true}),C().from('screenings').select('*',{count:'exact',head:true}),C().from('requirements').select('*',{count:'exact',head:true}).eq('status','Active')]);$('adminKpis').innerHTML=[['Active Requirements',rCount||0],['Stored Candidates',cCount||0],['Screenings',sCount||0],['TSS Users',(p||[]).length]].map(x=>`<div><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');$('adminUsers').innerHTML=`<div class="safe-table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th></th></tr></thead><tbody>${(p||[]).map(u=>`<tr><td>${esc(u.full_name||'-')}</td><td>${esc(u.email||'-')}</td><td><select data-role="${u.id}"><option ${u.role==='recruiter'?'selected':''}>recruiter</option><option ${u.role==='admin'?'selected':''}>admin</option></select></td><td><input type="checkbox" data-active="${u.id}" ${u.is_active?'checked':''}></td><td><button class="btn ghost" data-save-user="${u.id}">Save</button></td></tr>`).join('')}</tbody></table></div>`;document.querySelectorAll('[data-save-user]').forEach(b=>b.onclick=async()=>{const id=b.dataset.saveUser,role=document.querySelector(`[data-role="${id}"]`).value,is_active=document.querySelector(`[data-active="${id}"]`).checked;const {error}=await C().from('profiles').update({role,is_active}).eq('id',id);if(error)return notify(error.message);notify('User access updated');await logAction('admin_user_updated','profile',id,{role,is_active})})}catch(e){notify('Admin view failed: '+e.message)}
  }

  function styles(){if($('safeBackendStyles'))return;const s=document.createElement('style');s.id='safeBackendStyles';s.textContent='.safe-action-row{display:flex;gap:6px;flex-wrap:wrap}.safe-action-row .btn{font-size:12px;padding:7px 9px}.safe-danger{border-color:#743647!important;color:#ffb8c4!important}.safe-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}.safe-kpis>div{border:1px solid #1d3d58;background:#0b2032;border-radius:10px;padding:16px}.safe-kpis span{display:block;color:#8aa8c3;font-size:12px}.safe-kpis strong{display:block;font-size:26px;margin-top:8px}.safe-table-wrap{overflow:auto}.safe-table-wrap table{width:100%;border-collapse:collapse}.safe-table-wrap th,.safe-table-wrap td{padding:10px;border-bottom:1px solid #173149;text-align:left}@media(max-width:800px){.safe-kpis{grid-template-columns:1fr 1fr}}';document.head.appendChild(s)}

  function wire(){
    styles();ensureAdminUI();
    document.addEventListener('click',e=>{
      const nav=e.target.closest('.nav-item');if(nav?.dataset.view==='candidates')setTimeout(enhanceCandidateTable,120);
      if(e.target.closest('#screenBtn'))setTimeout(()=>{upsertLatestMatch();logAction('screening_saved','screening',(db.screenings||[]).at(-1)?.serverId||'',{})},800);
      if(e.target.closest('.decision,#approveAi,#editScore'))setTimeout(()=>{syncLatestNote();logAction('screening_decision_updated','screening',(db.screenings||[]).at(-1)?.serverId||'',{})},500);
      if(e.target.closest('#saveRequirementBtn'))setTimeout(()=>{const id=$('reqId')?.value;const r=(db.requirements||[]).find(x=>x.id===id||x.profileKey===id||x.requirementId===id);if(r)rematchRequirement(r)},900);
    },false);
    if(document.querySelector('.nav-item.active')?.dataset.view==='candidates')setTimeout(enhanceCandidateTable,150);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
  window.TSSSafeBackendFeatures={upsertLatestMatch,rematchRequirement,viewResume,markOutdated,deleteEverywhere,renderAdmin,logAction};
})();