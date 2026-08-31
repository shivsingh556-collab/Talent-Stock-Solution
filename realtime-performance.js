// TSS realtime + performance layer. Keeps Supabase authoritative while avoiding manual refreshes and duplicate renders.
(function(){
  'use strict';
  if(window.__TSS_REALTIME_PERFORMANCE__) return;
  window.__TSS_REALTIME_PERFORMANCE__ = true;

  const STORAGE_KEY='tss_talent_buddy_v1';
  const backend=()=>window.TSSBackend;
  let channel=null;
  let renderQueued=false;
  let requirementTimer=null;
  let lastServerRefresh=0;
  let reconnecting=false;

  const getDB=()=>{ try{return typeof db!=='undefined'?db:null}catch{return null} };
  const persistLocal=()=>{ const store=getDB(); if(store){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(store))}catch{}} };

  function queueRender(){
    if(renderQueued) return;
    renderQueued=true;
    const run=()=>{
      renderQueued=false;
      try{ if(typeof renderAll==='function') renderAll(); }catch(e){ console.warn('TSS live renderAll',e); }
      try{ if(typeof renderOldSite==='function') renderOldSite(); }catch(e){ console.warn('TSS live renderOldSite',e); }
      try{ window.TSSDashboardCleanup?.apply?.(); }catch{}
    };
    if(window.requestAnimationFrame) requestAnimationFrame(run); else setTimeout(run,16);
  }

  // Replace the old save path that rendered the entire app multiple times per click.
  // Persist immediately, render once on the next frame.
  function installOptimizedSave(){
    try{
      window.saveDB=function(){
        persistLocal();
        queueRender();
      };
    }catch{}
  }

  function mapCandidate(c){
    return {
      id:c.id,serverId:c.id,name:c.candidate_name||'Candidate',email:c.email||'',phone:c.phone||'',
      location:c.current_location||'',preferredLocation:c.preferred_location||'',
      totalExperience:c.total_experience??'',relevantExperience:c.relevant_experience??'',
      currentCompany:c.current_company||'',designation:c.current_designation||'',skills:c.skills||[],
      education:c.education||'',noticePeriod:c.notice_period||'',currentCTC:c.current_ctc||'',expectedCTC:c.expected_ctc||'',
      uploadDate:c.created_at,lastScreenedDate:c.last_screened_at,uploadedBy:c.uploaded_by||'Supabase'
    };
  }

  function localRequirementId(serverId){
    const store=getDB();
    const r=(store?.requirements||[]).find(x=>String(x.serverId||'')===String(serverId||''));
    return r?.id||r?.profileKey||serverId;
  }

  function mapScreening(s){
    return {
      id:s.id,serverId:s.id,candidateId:s.candidate_id,requirementId:localRequirementId(s.requirement_id),
      date:s.screened_at,score:Number(s.overall_score||0),
      recommendation:s.final_recommendation||s.ai_recommendation||'Review Recommended',
      matched:s.matching_skills||[],missing:s.missing_skills||[],
      metrics:{mandatoryPct:Number(s.mandatory_skill_score||0),prefPct:Number(s.preferred_skill_score||0),expPct:Number(s.experience_score||0),domainPct:Number(s.domain_score||0),locPct:Number(s.location_score||0)},
      recruiterDecision:s.recruiter_decision||'Pending',notes:s.recruiter_notes||'',manualOverride:Boolean(s.manually_overridden)
    };
  }

  function mapInterview(i){
    const d=i.scheduled_at?new Date(i.scheduled_at):null;
    return {
      id:i.id,serverId:i.id,
      date:d&&!isNaN(d)?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):'',
      time:d&&!isNaN(d)?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:true}).format(d):'',
      candidate:i.candidate_name_snapshot||'Candidate',email:i.candidate_email_snapshot||'',
      position:i.job_title_snapshot||'',client:i.client_name_snapshot||'',mode:i.interview_type||'Client Interview',
      status:i.status||'Scheduled',candidateResponse:i.candidate_response||'Pending',notes:i.notes||'',
      requirementServerId:i.requirement_id,candidateId:i.candidate_id
    };
  }

  function upsert(list,row,key='id'){
    if(!Array.isArray(list)) return [row];
    const idx=list.findIndex(x=>String(x[key]||x.serverId||'')===String(row[key]||row.serverId||''));
    if(idx>=0) list[idx]={...list[idx],...row}; else list.unshift(row);
    return list;
  }

  function remove(list,id){ return (list||[]).filter(x=>String(x.id||x.serverId||'')!==String(id||'')); }

  function handleCandidate(payload){
    const store=getDB(); if(!store)return;
    if(payload.eventType==='DELETE') store.candidates=remove(store.candidates,payload.old?.id);
    else store.candidates=upsert(store.candidates,mapCandidate(payload.new));
    persistLocal(); queueRender();
  }

  function handleScreening(payload){
    const store=getDB(); if(!store)return;
    if(payload.eventType==='DELETE') store.screenings=remove(store.screenings,payload.old?.id);
    else store.screenings=upsert(store.screenings,mapScreening(payload.new));
    persistLocal(); queueRender();
  }

  function handleInterview(payload){
    const store=getDB(); if(!store)return;
    if(payload.eventType==='DELETE') store.interviews=remove(store.interviews,payload.old?.id);
    else store.interviews=upsert(store.interviews,mapInterview(payload.new));
    persistLocal(); queueRender();
  }

  function handleRequirement(){
    clearTimeout(requirementTimer);
    requirementTimer=setTimeout(async()=>{
      try{ await window.TSSRequirementsLiveSync?.syncNow?.(); }
      catch(e){ console.warn('TSS requirement realtime sync',e?.message||e); }
    },120);
  }

  async function subscribe(){
    const b=backend(); if(!b?.enabled||!b.client||channel) return;
    const {data:{session}}=await b.client.auth.getSession();
    if(!session?.user) return;
    channel=b.client.channel('tss-operational-live-v1')
      .on('postgres_changes',{event:'*',schema:'public',table:'requirements'},handleRequirement)
      .on('postgres_changes',{event:'*',schema:'public',table:'candidates'},handleCandidate)
      .on('postgres_changes',{event:'*',schema:'public',table:'screenings'},handleScreening)
      .on('postgres_changes',{event:'*',schema:'public',table:'interviews'},handleInterview)
      .subscribe(status=>{
        if(status==='SUBSCRIBED'){
          reconnecting=false;
          document.documentElement.dataset.tssLive='on';
          console.info('TSS realtime connected');
        }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
          document.documentElement.dataset.tssLive='degraded';
        }
      });
  }

  async function backgroundRefresh(force=false){
    if(reconnecting) return;
    const now=Date.now();
    if(!force && now-lastServerRefresh<180000) return;
    reconnecting=true;
    try{
      await window.TSSProduction?.hydrate?.();
      lastServerRefresh=Date.now();
    }catch(e){ console.warn('TSS background refresh',e?.message||e); }
    finally{ reconnecting=false; }
  }

  function lifecycle(){
    window.addEventListener('online',()=>backgroundRefresh(true),{passive:true});
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible') backgroundRefresh(false);
    });
  }

  async function boot(){
    installOptimizedSave();
    lifecycle();
    await subscribe();
    lastServerRefresh=Date.now();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,50),{once:true});
  else setTimeout(boot,50);

  window.TSSRealtimePerformance={boot,subscribe,backgroundRefresh,queueRender};
})();