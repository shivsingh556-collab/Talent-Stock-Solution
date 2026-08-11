(function(){
  const $=id=>document.getElementById(id);
  const backend=()=>window.TSSBackend;
  const assets=()=>window.TSS_ASSETS||{};
  let hydrating=false;

  function status(text,type='on'){
    let el=document.getElementById('backendIndicator');
    if(!el){el=document.createElement('div');el.id='backendIndicator';el.className='backend-indicator';el.innerHTML='<i></i><span></span>';document.querySelector('.profile-box')?.before(el)}
    el.className='backend-indicator '+(type==='on'?'':type);el.querySelector('span').textContent=text;
  }
  function busy(text){let e=document.getElementById('savingOverlay');if(!e){e=document.createElement('div');e.id='savingOverlay';e.className='saving-overlay';document.body.appendChild(e)}e.textContent=text;e.hidden=false;return()=>e.hidden=true}

  function applyBrand(){
    const a=assets();
    if(a.logo){
      document.querySelectorAll('.talent-logo').forEach((el,i)=>{el.innerHTML=`<img class="brand-image ${el.classList.contains('small')?'sidebar-logo-image':'login-logo-image'}" src="${a.logo}" alt="TalentStock Solutions">`});
    }
    if(a.todo){
      const hero=document.querySelector('.todo-figure'); if(hero) hero.innerHTML=`<img class="todo-photo login-todo-photo" src="${a.todo}" alt="Todo - Talent Buddy">`;
      const mini=document.querySelector('.mini-todo'); if(mini) mini.outerHTML=`<img class="todo-photo mini-todo-photo" src="${a.todo}" alt="Todo">`;
      const large=document.querySelector('.todo-large'); if(large) large.outerHTML=`<img class="todo-photo modal-todo-photo" src="${a.todo}" alt="Todo Recruiter Assistant">`;
    }
  }

  function mapReq(row){return {id:row.profile_key||row.tss_id,requirementId:row.tss_id,profileKey:row.profile_key,serverId:row.id,client:row.clients?.name||row.client_name||'Client',title:row.job_title,location:row.location||'Not provided',experience:row.experience_text||'Not provided',salaryRange:row.salary_range||'Not provided',industry:row.industry||'',qualification:row.qualification||'',responsibilities:row.responsibilities||'',jdText:row.jd_text||'',status:row.status||'Active',skills:row.mandatory_skills||[],preferred:row.preferred_skills||[],aiSuggested:Boolean(row.ai_suggested_skills?.length&&!row.ai_skills_approved)}}
  function mapCandidate(c){return {id:c.id,serverId:c.id,name:c.candidate_name,email:c.email||'',phone:c.phone||'',location:c.current_location||'',preferredLocation:c.preferred_location||'',totalExperience:c.total_experience||'',relevantExperience:c.relevant_experience||'',currentCompany:c.current_company||'',designation:c.current_designation||'',skills:c.skills||[],education:c.education||'',noticePeriod:c.notice_period||'',currentCTC:c.current_ctc||'',expectedCTC:c.expected_ctc||'',uploadDate:c.created_at,lastScreenedDate:c.last_screened_at,uploadedBy:'Supabase'}}
  function mapScreening(s){const req=s.requirements||{};return {id:s.id,serverId:s.id,candidateId:s.candidate_id,requirementId:req.profile_key||req.tss_id||s.requirement_id,date:s.screened_at,score:Number(s.overall_score||0),recommendation:s.final_recommendation||s.ai_recommendation||'Review Recommended',matched:s.matching_skills||[],missing:s.missing_skills||[],metrics:{mandatoryPct:Number(s.mandatory_skill_score||0),prefPct:Number(s.preferred_skill_score||0),expPct:Number(s.experience_score||0),domainPct:Number(s.domain_score||0),locPct:Number(s.location_score||0)},recruiterDecision:s.recruiter_decision||'Pending',notes:s.recruiter_notes||'',manualOverride:Boolean(s.manually_overridden)}}

  async function hydrate(){
    if(hydrating||!backend()?.enabled) return;
    hydrating=true; const done=busy('Loading secure workspace…');
    try{
      const user=await backend().currentUser(); if(!user){status('Secure backend ready','off');return}
      const c=backend().client;
      const [{data:reqs,error:re},{data:cands,error:ce},{data:screens,error:se},{data:ints,error:ie}]=await Promise.all([
        c.from('requirements').select('*,clients(name)').eq('status','Active').order('created_at'),
        c.from('candidates').select('*').order('created_at',{ascending:false}),
        c.from('screenings').select('*,requirements(profile_key,tss_id,job_title)').order('screened_at',{ascending:true}),
        c.from('interviews').select('*,candidates(candidate_name),requirements(job_title,clients(name))').order('scheduled_at',{ascending:true})
      ]);
      if(re) throw re;if(ce) throw ce;if(se) throw se;if(ie) throw ie;
      if(Array.isArray(reqs)&&reqs.length){const custom=(db.requirements||[]).filter(r=>String(r.id).startsWith('CUSTOM-'));db.requirements=[...reqs.map(mapReq),...custom]}
      db.candidates=(cands||[]).map(mapCandidate);
      db.screenings=(screens||[]).map(mapScreening);
      db.interviews=(ints||[]).map(i=>({id:i.id,date:i.scheduled_at?.slice(0,10),time:new Date(i.scheduled_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),candidate:i.candidates?.candidate_name||'Candidate',position:i.requirements?.job_title||'',client:i.requirements?.clients?.name||'',mode:i.interview_type||'Client Interview',serverId:i.id}));
      localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(db));
      try{renderAll()}catch{};try{renderOldSite()}catch{};
      status('Supabase connected','on');
    }catch(err){console.error(err);status('Backend issue','error');try{toast('Backend sync issue: '+(err.message||err))}catch{}}
    finally{hydrating=false;done()}
  }

  async function fileHash(file){if(!file||!crypto?.subtle)return null;const buf=await file.arrayBuffer();const h=await crypto.subtle.digest('SHA-256',buf);return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('')}
  async function persistLatestScreening(){
    if(!backend()?.enabled) return;
    const localScreen=(db.screenings||[]).at(-1); if(!localScreen||localScreen.serverId) return;
    const localCand=(db.candidates||[]).find(c=>c.id===localScreen.candidateId);const localReq=(db.requirements||[]).find(r=>r.id===localScreen.requirementId);if(!localCand||!localReq)return;
    const done=busy('Saving candidate, CV and screening securely…');
    try{
      let created=await backend().createOrUpdateCandidate(localCand);
      let serverCand=created.candidate;
      if(created.duplicate){
        const ok=confirm(`A candidate with the same email/phone already exists: ${serverCand.candidate_name}. Use the existing record and preserve its history?`);if(!ok){toast('Duplicate candidate not saved');return}
        const patch={candidate_name:localCand.name,current_location:localCand.location||null,total_experience:Number(localCand.totalExperience)||null,current_designation:localCand.designation||null,notice_period:localCand.noticePeriod||null,current_ctc:localCand.currentCTC||null,expected_ctc:localCand.expectedCTC||null,updated_at:new Date().toISOString()};
        const {data,error}=await backend().client.from('candidates').update(patch).eq('id',serverCand.id).select().single();if(error)throw error;serverCand=data;
      }
      localCand.serverId=serverCand.id;
      const file=$('resumeFile')?.files?.[0];let resumeVersion=null;if(file){resumeVersion=await backend().uploadResume(serverCand.id,file,await fileHash(file))}
      let reqServerId=localReq.serverId;
      if(!reqServerId){const {data,error}=await backend().client.from('requirements').select('id').eq('profile_key',localReq.profileKey||localReq.id).maybeSingle();if(error)throw error;reqServerId=data?.id}
      if(!reqServerId) throw new Error('Requirement is not synced to Supabase yet');
      const m=localScreen.metrics||{};
      const saved=await backend().saveScreening({candidate_id:serverCand.id,requirement_id:reqServerId,resume_version_id:resumeVersion?.id||null,overall_score:localScreen.score,mandatory_skill_score:m.mandatoryPct||0,preferred_skill_score:m.prefPct||0,experience_score:m.expPct||0,domain_score:m.domainPct||0,location_score:m.locPct||0,matching_skills:localScreen.matched||[],missing_skills:localScreen.missing||[],strengths:[],concerns:localScreen.missing||[],explanation:`Score ${localScreen.score}/100 based on skills, experience, role context and location.`,ai_recommendation:localScreen.recommendation,final_recommendation:localScreen.recommendation,recruiter_decision:'Pending',recruiter_notes:'',manually_overridden:false});
      localScreen.serverId=saved.id;localScreen.id=saved.id;localScreen.candidateId=serverCand.id;localCand.id=serverCand.id;localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(db));status('Saved securely','on');toast('Candidate, CV and screening saved to Supabase');
    }catch(err){console.error(err);status('Save failed','error');toast('Secure save failed: '+(err.message||err))}
    finally{done()}
  }

  async function persistDecision(){
    const s=(db.screenings||[]).at(-1);if(!s?.serverId||!backend()?.enabled)return;const {error}=await backend().client.from('screenings').update({overall_score:s.score,final_recommendation:s.recommendation,recruiter_decision:s.recruiterDecision==='Request Updated Resume'?'Updated Resume Requested':s.recruiterDecision,recruiter_notes:s.notes||'',manually_overridden:Boolean(s.manualOverride)}).eq('id',s.serverId);if(error){console.warn(error);toast('Decision saved locally; backend update needs review')}else status('Decision saved','on');
  }

  function wire(){
    applyBrand();
    $('screenBtn')?.addEventListener('click',()=>setTimeout(persistLatestScreening,120));
    document.addEventListener('click',e=>{if(e.target.closest('.decision,#approveAi,#editScore'))setTimeout(persistDecision,180)});
    const ws=$('workspace');if(ws){new MutationObserver(()=>{if(!ws.classList.contains('hidden'))setTimeout(hydrate,150)}).observe(ws,{attributes:true,attributeFilter:['class']})}
    if(!ws?.classList.contains('hidden'))setTimeout(hydrate,150);
    status(backend()?.enabled?'Supabase ready':'Local mode',backend()?.enabled?'on':'off');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
  window.TSSProduction={hydrate,persistLatestScreening,applyBrand};
})();
