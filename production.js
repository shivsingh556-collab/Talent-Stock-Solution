(function(){
  const $=id=>document.getElementById(id);
  const backend=()=>window.TSSBackend;
  const assets=()=>window.TSS_ASSETS||{};
  let hydrating=false,hydrated=false,savingScreening=false;
  function status(text,type='on'){let el=document.getElementById('backendIndicator');if(!el){el=document.createElement('div');el.id='backendIndicator';el.className='backend-indicator';el.innerHTML='<i></i><span></span>';document.querySelector('.profile-box')?.before(el)}el.className='backend-indicator '+(type==='on'?'':type);el.querySelector('span').textContent=text}
  function busy(text){let e=document.getElementById('savingOverlay');if(!e){e=document.createElement('div');e.id='savingOverlay';e.className='saving-overlay';document.body.appendChild(e)}e.textContent=text;e.hidden=false;return()=>e.hidden=true}
  function applyBrand(){const a=assets();if(a.logo){document.querySelectorAll('.talent-logo').forEach(el=>{el.innerHTML=`<img class="brand-image ${el.classList.contains('small')?'sidebar-logo-image':'login-logo-image'}" src="${a.logo}" alt="TalentStock Solutions">`})}if(a.todo){const hero=document.querySelector('.todo-figure');if(hero)hero.innerHTML=`<img class="todo-photo login-todo-photo" src="${a.todo}" alt="Todo - Talent Buddy">`;const mini=document.querySelector('.mini-todo');if(mini)mini.outerHTML=`<img class="todo-photo mini-todo-photo" src="${a.todo}" alt="Todo">`;const large=document.querySelector('.todo-large');if(large)large.outerHTML=`<img class="todo-photo modal-todo-photo" src="${a.todo}" alt="Todo Recruiter Assistant">`}}
  function mapReq(row){if(window.TSSRequirementsLiveSync?.mapRow)return window.TSSRequirementsLiveSync.mapRow(row,db.requirements||[]);return{id:row.profile_key||row.tss_id,requirementId:row.tss_id,profileKey:row.profile_key,serverId:row.id,client:row.clients?.name||'Client',title:row.job_title,location:row.location||'Not provided',experience:row.experience_text||'Not provided',salaryRange:row.salary_range||'Not provided',industry:row.industry||'',qualification:row.qualification||'',responsibilities:row.responsibilities||'',jdText:row.jd_text||'',status:row.status||'Active',skills:row.mandatory_skills||[],preferred:row.preferred_skills||[],createdAt:row.created_at||null,updatedAt:row.updated_at||null,submittedAt:row.submitted_at||null,aiSuggested:Boolean(row.ai_suggested_skills?.length&&!row.ai_skills_approved)}}
  function mapCandidate(c,resume){return{id:c.id,serverId:c.id,name:c.candidate_name,email:c.email||'',phone:c.phone||'',location:c.current_location||'',preferredLocation:c.preferred_location||'',totalExperience:c.total_experience??'',relevantExperience:c.relevant_experience??'',currentCompany:c.current_company||'',designation:c.current_designation||'',skills:c.skills||[],education:c.education||'',noticePeriod:c.notice_period||'',currentCTC:c.current_ctc||'',expectedCTC:c.expected_ctc||'',uploadDate:c.created_at,lastScreenedDate:c.last_screened_at,uploadedBy:'Supabase',resumeAvailable:Boolean(resume?.storage_path),resumeVersionId:resume?.id||null,resumePath:resume?.storage_path||'',resumeFilename:resume?.original_filename||'',resumeMimeType:resume?.mime_type||'',resumeUploadedAt:resume?.uploaded_at||null}}
  function mapScreening(s){const req=s.requirements||{};return{id:s.id,serverId:s.id,candidateId:s.candidate_id,requirementId:req.profile_key||req.tss_id||s.requirement_id,date:s.screened_at,score:Number(s.overall_score||0),recommendation:s.final_recommendation||s.ai_recommendation||'Review Recommended',matched:s.matching_skills||[],missing:s.missing_skills||[],metrics:{mandatoryPct:Number(s.mandatory_skill_score||0),prefPct:Number(s.preferred_skill_score||0),expPct:Number(s.experience_score||0),domainPct:Number(s.domain_score||0),locPct:Number(s.location_score||0)},recruiterDecision:s.recruiter_decision||'Pending',notes:s.recruiter_notes||'',manualOverride:Boolean(s.manually_overridden)}}
  function recruiterLabel(profile){const raw=String(profile?.full_name||profile?.email||'').split('@')[0].trim();return raw.replace(/[._-]+/g,' ').replace(/\b\w/g,char=>char.toUpperCase())}
  function mapInterview(i){const d=i.scheduled_at?new Date(i.scheduled_at):null;return{id:i.id,serverId:i.id,scheduledAt:i.scheduled_at||null,date:d&&!isNaN(d)?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):'',time:d&&!isNaN(d)?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:true}).format(d):'',candidate:i.candidate_name_snapshot||i.candidates?.candidate_name||'Candidate',position:i.job_title_snapshot||i.requirements?.job_title||'',client:i.client_name_snapshot||i.requirements?.clients?.name||'',mode:i.interview_type||'Client Interview',status:i.status||'Scheduled',candidateResponse:i.candidate_response||'Pending',outcome:i.outcome||'Pending',outcomeNotes:i.outcome_notes||'',outcomeUpdatedAt:i.outcome_updated_at||null,interviewStage:i.interview_stage||'Scheduled',notes:i.notes||'',archivedAt:i.archived_at||null,createdBy:i.created_by||null,scheduledBy:recruiterLabel(i.scheduled_by_profile),candidateId:i.candidate_id,requirementServerId:i.requirement_id}}
  async function hydrate(){if(hydrating||!backend()?.enabled)return;hydrating=true;const done=hydrated?()=>{}:busy('Loading secure workspace…');try{const user=await backend().currentUser();if(!user){status('Secure backend ready','off');return}const c=backend().client;const [{data:reqs,error:re},{data:cands,error:ce},{data:resumes,error:rve},{data:screens,error:se},{data:ints,error:ie}]=await Promise.all([c.from('requirements').select('*,clients(name)').neq('status','Closed').order('created_at',{ascending:false}).order('tss_id',{ascending:false}),c.from('candidates').select('*').order('created_at',{ascending:false}),c.from('resume_versions').select('id,candidate_id,storage_path,original_filename,mime_type,file_size,uploaded_at,is_current').order('uploaded_at',{ascending:true}),c.from('screenings').select('*,requirements(profile_key,tss_id,job_title)').order('screened_at',{ascending:true}),c.from('interviews').select('*,candidates(candidate_name),requirements(job_title,clients(name)),scheduled_by_profile:profiles!interviews_created_by_fkey(full_name,email)').order('scheduled_at',{ascending:true})]);if(re)throw re;if(ce)throw ce;if(rve)throw rve;if(se)throw se;if(ie)throw ie;const latestResume=new Map();for(const resume of resumes||[])if(resume?.candidate_id&&resume.storage_path)latestResume.set(resume.candidate_id,resume);if(Array.isArray(reqs)){const custom=(db.requirements||[]).filter(r=>String(r.id).startsWith('CUSTOM-'));db.requirements=[...reqs.map(mapReq),...custom]}db.candidates=(cands||[]).map(row=>mapCandidate(row,latestResume.get(row.id)));db.screenings=(screens||[]).map(mapScreening);db.interviews=(ints||[]).map(mapInterview);localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(db));try{renderAll()}catch{}try{renderOldSite()}catch{}hydrated=true;if(!window.TSSRealtimePerformance)status('Supabase connected','on')}catch(err){console.error(err);status('Backend issue','error');try{toast('Backend sync issue: '+(err.message||err))}catch{}}finally{hydrating=false;done()}}
  async function fileHash(file){if(!file||!crypto?.subtle)return null;const buf=await file.arrayBuffer();const h=await crypto.subtle.digest('SHA-256',buf);return[...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('')}
  function hasCandidateValue(v){return !(v==null||v===''||(Array.isArray(v)&&!v.length))}
  function mergeCandidateData(base={},parsed={},local={}){const pick=(...v)=>v.find(hasCandidateValue);return{name:pick(parsed.name,local.name,base.candidate_name,'')||'',email:pick(parsed.email,local.email,base.email,'')||'',phone:pick(parsed.phone,local.phone,base.phone,'')||'',location:pick(parsed.location,local.location,base.current_location,'')||'',preferredLocation:pick(parsed.preferredLocation,local.preferredLocation,base.preferred_location,'')||'',totalExperience:pick(parsed.totalExperience,local.totalExperience,base.total_experience,'')??'',relevantExperience:pick(parsed.relevantExperience,local.relevantExperience,base.relevant_experience,'')??'',currentCompany:pick(parsed.currentCompany,local.currentCompany,base.current_company,'')||'',designation:pick(parsed.designation,local.designation,base.current_designation,'')||'',skills:pick(parsed.skills,local.skills,base.skills,[])||[],education:pick(parsed.education,local.education,base.education,'')||'',noticePeriod:pick(parsed.noticePeriod,local.noticePeriod,base.notice_period,'')||'',currentCTC:pick(parsed.currentCTC,local.currentCTC,base.current_ctc,'')||'',expectedCTC:pick(parsed.expectedCTC,local.expectedCTC,base.expected_ctc,'')||'',resumeText:local.resumeText||''}}
  function assertCandidateQuality(c){const n=String(c.name||'').trim();if(!n||/^(candidate|unknown|n\/?a|not provided)$/i.test(n))throw new Error('Candidate name could not be identified. Review the parsed resume before saving.');if(!String(c.email||'').trim()&&!String(c.phone||'').trim())throw new Error('Candidate email/phone could not be identified. Review the parsed resume before saving.')}
  function setScreeningSaveState(state,message=''){
    const btn=$('saveScreenedCandidate'),hint=$('screeningSaveHint');
    if(btn){
      btn.disabled=state==='saving'||state==='saved';
      btn.textContent=state==='saving'?'Saving…':state==='saved'?'✓ Candidate Saved':state==='failed'?'Retry Save Candidate':'Save Candidate';
    }
    if(hint&&message)hint.textContent=message;
  }
  async function persistLatestScreening(){
    if(savingScreening)return false;
    if(!backend()?.enabled){setScreeningSaveState('failed','Secure database is unavailable. Please reconnect and retry.');toast('Supabase is not connected');return false}
    const localScreen=(db.screenings||[]).at(-1);
    if(!localScreen){setScreeningSaveState('failed','No screening result found. Screen the candidate again.');return false}
    if(localScreen.serverId){setScreeningSaveState('saved','Candidate, CV and screening are stored securely.');return true}
    const localCand=(db.candidates||[]).find(c=>c.id===localScreen.candidateId);
    const localReq=(db.requirements||[]).find(r=>r.id===localScreen.requirementId);
    if(!localCand||!localReq){setScreeningSaveState('failed','Candidate or requirement details are missing. Screen the candidate again.');return false}
    savingScreening=true;
    setScreeningSaveState('saving','Saving candidate, CV and screening securely…');
    const done=busy('Saving candidate, CV and screening securely…');
    try{
      const freshParsed=localCand.resumeText&&window.TSSDocumentParser?.extractResume?window.TSSDocumentParser.extractResume(localCand.resumeText):(window.TSS_PARSED_RESUME||{});
      Object.assign(localCand,mergeCandidateData({},freshParsed,localCand));
      assertCandidateQuality(localCand);
      const file=$('resumeFile')?.files?.[0];
      let hash=null,resumeVersion=null,serverCand=null;
      if(file){
        hash=await fileHash(file);
        if(hash){
          const{data:existingResume,error:resumeReadError}=await backend().client.from('resume_versions').select('id,candidate_id,storage_path,original_filename,mime_type,uploaded_at').eq('file_hash',hash).order('uploaded_at',{ascending:false}).limit(1).maybeSingle();
          if(resumeReadError)throw resumeReadError;
          if(existingResume?.candidate_id){
            const{data:resumeOwner,error:ownerError}=await backend().client.from('candidates').select('*').eq('id',existingResume.candidate_id).maybeSingle();
            if(ownerError)throw ownerError;
            if(resumeOwner){
              const merged=mergeCandidateData(resumeOwner,freshParsed,localCand);
              assertCandidateQuality(merged);
              serverCand=await backend().updateCandidate(resumeOwner.id,merged);
              Object.assign(localCand,merged);
              resumeVersion=existingResume;
              toast('Exact resume already exists — candidate details enriched and reused');
            }
          }
        }
      }
      if(!serverCand){
        const created=await backend().createOrUpdateCandidate(localCand);
        serverCand=created.candidate;
        if(created.duplicate){
          const ok=confirm(`A candidate with the same email/phone already exists: ${serverCand.candidate_name}. Use the existing record and preserve its history?`);
          if(!ok){setScreeningSaveState('idle','Save cancelled. You can retry when ready.');toast('Duplicate candidate not saved');return false}
          const merged=mergeCandidateData(serverCand,freshParsed,localCand);
          assertCandidateQuality(merged);
          serverCand=await backend().updateCandidate(serverCand.id,merged);
          Object.assign(localCand,merged);
        }
      }
      localCand.serverId=serverCand.id;
      localCand.name=serverCand.candidate_name||localCand.name;
      localCand.email=serverCand.email||localCand.email||'';
      localCand.phone=serverCand.phone||localCand.phone||'';
      localCand.location=serverCand.current_location||localCand.location||'';
      localCand.designation=serverCand.current_designation||localCand.designation||'';
      localCand.currentCompany=serverCand.current_company||localCand.currentCompany||'';
      localCand.skills=serverCand.skills||localCand.skills||[];
      localCand.education=serverCand.education||localCand.education||'';
      localCand.noticePeriod=serverCand.notice_period||localCand.noticePeriod||'';
      localCand.currentCTC=serverCand.current_ctc||localCand.currentCTC||'';
      localCand.expectedCTC=serverCand.expected_ctc||localCand.expectedCTC||'';
      localCand.totalExperience=serverCand.total_experience??localCand.totalExperience;
      // Persist the server identity immediately. If resume upload or screening insert fails,
      // Retry must reuse this candidate instead of leaving an unreachable partial record.
      localCand.id=serverCand.id;
      localCand.serverId=serverCand.id;
      localScreen.candidateId=serverCand.id;
      localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(db));
      if(file&&!resumeVersion)resumeVersion=await backend().uploadResume(serverCand.id,file,hash,localCand.resumeText||'');
      if(resumeVersion?.storage_path){
        localCand.resumeAvailable=true;
        localCand.resumeVersionId=resumeVersion.id;
        localCand.resumePath=resumeVersion.storage_path;
        localCand.resumeFilename=resumeVersion.original_filename||file?.name||'';
        localCand.resumeMimeType=resumeVersion.mime_type||file?.type||'';
        localCand.resumeUploadedAt=resumeVersion.uploaded_at||new Date().toISOString();
      }
      let reqServerId=localReq.serverId;
      if(!reqServerId){
        const{data,error}=await backend().client.from('requirements').select('id').eq('profile_key',localReq.profileKey||localReq.id).maybeSingle();
        if(error)throw error;
        reqServerId=data?.id;
      }
      if(!reqServerId)throw new Error('Requirement is not synced to Supabase yet');
      const m=localScreen.metrics||{};
      const saved=await backend().saveScreening({
        candidate_id:serverCand.id,requirement_id:reqServerId,resume_version_id:resumeVersion?.id||null,
        overall_score:localScreen.score,mandatory_skill_score:m.mandatoryPct||0,preferred_skill_score:m.prefPct||0,
        experience_score:m.expPct||0,domain_score:m.domainPct||0,location_score:m.locPct||0,
        matching_skills:localScreen.matched||[],missing_skills:localScreen.missing||[],strengths:[],
        concerns:localScreen.missing||[],explanation:`Score ${localScreen.score}/100 based on skills, experience, role context and location.`,
        ai_recommendation:localScreen.recommendation,final_recommendation:localScreen.recommendation,
        recruiter_decision:'Pending',recruiter_notes:'',manually_overridden:false
      });
      localScreen.serverId=saved.id;
      localScreen.id=saved.id;
      localScreen.candidateId=serverCand.id;
      localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(db));
      try{renderCandidates($('candidateSearch')?.value||'')}catch{}
      if(!window.TSSRealtimePerformance)status('Saved securely','on');
      setScreeningSaveState('saved','Candidate, CV and screening are stored securely in Todo.');
      toast('Candidate details, CV and screening saved to Supabase');
      try{
        await window.TSSSafeBackendFeatures?.upsertLatestMatch?.();
        await window.TSSSafeBackendFeatures?.logAction?.('screening_saved','screening',saved.id,{candidate_id:serverCand.id,requirement_id:reqServerId});
      }catch(logErr){console.warn('Post-save activity log skipped',logErr?.message||logErr)}
      return true;
    }catch(err){
      console.error(err);
      status('Save failed','error');
      setScreeningSaveState('failed','Save failed: '+(err.message||err)+'. Fix the issue and retry.');
      toast('Secure save failed: '+(err.message||err));
      return false;
    }finally{
      savingScreening=false;
      done();
    }
  }
  function validDecision(d){if(d==='Request Updated Resume')return'Updated Resume Requested';if(['Pending','Shortlisted','Rejected','Keep for Future','Updated Resume Requested'].includes(d))return d;return'Pending'}
  async function persistDecision(){const s=(db.screenings||[]).at(-1);if(!s?.serverId||!backend()?.enabled)return;const{error}=await backend().client.from('screenings').update({overall_score:s.score,final_recommendation:s.recommendation,recruiter_decision:validDecision(s.recruiterDecision),recruiter_notes:s.notes||'',manually_overridden:Boolean(s.manualOverride)}).eq('id',s.serverId);if(error){console.warn(error);toast('Decision saved locally; backend update needs review')}else if(!window.TSSRealtimePerformance)status('Decision saved','on')}
  function wire(){applyBrand();document.addEventListener('click',e=>{const save=e.target.closest('#saveScreenedCandidate');if(save){e.preventDefault();persistLatestScreening();return}if(e.target.closest('.decision,#approveAi,#editScore'))setTimeout(persistDecision,180)});const ws=$('workspace');if(ws){new MutationObserver(()=>{if(!ws.classList.contains('hidden'))setTimeout(hydrate,150)}).observe(ws,{attributes:true,attributeFilter:['class']})}if(!ws?.classList.contains('hidden'))setTimeout(hydrate,150);status(backend()?.enabled?'Supabase ready':'Local mode',backend()?.enabled?'on':'off')}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();window.TSSProduction={hydrate,persistLatestScreening,applyBrand};
})();
