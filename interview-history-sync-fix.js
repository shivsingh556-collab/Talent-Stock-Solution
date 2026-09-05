// Ensures initial page hydration includes interview status/outcome data so completed interviews move to history automatically.
(function(){
  'use strict';
  if(window.__TSS_INTERVIEW_HISTORY_SYNC_FIX__)return;
  window.__TSS_INTERVIEW_HISTORY_SYNC_FIX__=true;

  const backend=()=>window.TSSBackend;
  const getDB=()=>{try{return typeof db!=='undefined'?db:null}catch{return null}};
  let syncing=false;

  function persist(store){try{localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(store))}catch{}}

  async function syncNow(){
    if(syncing||!backend()?.enabled)return;
    const store=getDB();if(!store)return;
    syncing=true;
    try{
      const {data,error}=await backend().client.from('interviews').select('id,scheduled_at,status,interview_stage,outcome,outcome_notes,outcome_updated_at,candidate_response,notes,interview_type,candidate_id,requirement_id,candidate_name_snapshot,job_title_snapshot,client_name_snapshot,candidate_email_snapshot').order('scheduled_at',{ascending:true});
      if(error)throw error;
      const byId=new Map((store.interviews||[]).map(i=>[String(i.serverId||i.id),i]));
      for(const row of data||[]){
        const id=String(row.id);let item=byId.get(id);
        const d=row.scheduled_at?new Date(row.scheduled_at):null;
        const patch={
          id:row.id,serverId:row.id,scheduledAt:row.scheduled_at||null,
          date:d&&!isNaN(d)?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):(item?.date||''),
          time:d&&!isNaN(d)?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:true}).format(d):(item?.time||''),
          candidate:row.candidate_name_snapshot||item?.candidate||'Candidate',email:row.candidate_email_snapshot||item?.email||'',
          position:row.job_title_snapshot||item?.position||'',client:row.client_name_snapshot||item?.client||'',mode:row.interview_type||item?.mode||'Client Interview',
          status:row.status||'Scheduled',interviewStage:row.interview_stage||'Scheduled',outcome:row.outcome||'Pending',outcomeNotes:row.outcome_notes||'',outcomeUpdatedAt:row.outcome_updated_at||null,
          candidateResponse:row.candidate_response||'Pending',notes:row.notes||'',candidateId:row.candidate_id,requirementServerId:row.requirement_id
        };
        if(item)Object.assign(item,patch);else{item=patch;(store.interviews??=[]).push(item);byId.set(id,item)}
      }
      persist(store);
      try{if(typeof renderOldSite==='function')renderOldSite()}catch{}
      try{window.TSSInterviewActions?.decorate?.(true)}catch{}
      try{window.TSSInterviewLifecycleUI?.refresh?.()}catch{}
      document.dispatchEvent(new CustomEvent('tss:interview-state-synced'));
    }catch(e){console.warn('Interview history sync',e?.message||e)}finally{syncing=false}
  }

  function boot(){
    setTimeout(syncNow,180);
    window.addEventListener('focus',()=>setTimeout(syncNow,50),{passive:true});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(syncNow,50)});
    document.addEventListener('tss:data-changed',()=>setTimeout(syncNow,40));
    document.addEventListener('click',e=>{if(e.target.closest?.('.nav-item[data-view="interviews"]'))setTimeout(syncNow,80)});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.TSSInterviewHistorySync={syncNow};
})();
