// Authoritative one-time/event-driven Supabase requirement sync.
(function(){
  const $=id=>document.getElementById(id);
  const backend=()=>window.TSSBackend;
  let syncing=false;

  async function syncNow(){
    if(syncing||!backend()?.enabled)return;
    const c=backend().client;
    const {data:{session}}=await c.auth.getSession();
    if(!session?.user)return;
    syncing=true;
    try{
      const {data:reqs,error}=await c.from('requirements').select('*,clients(name)').eq('status','Active').order('tss_id');
      if(error)throw error;
      if(!Array.isArray(reqs))return;
      db.requirements=reqs.map(row=>({
        id:row.profile_key||row.tss_id,
        requirementId:row.tss_id,
        profileKey:row.profile_key,
        serverId:row.id,
        client:row.clients?.name||'Client',
        clientOwner:row.client_owner||'',
        title:row.job_title,
        location:row.location||'Not provided',
        experience:row.experience_text||'Not provided',
        salaryRange:row.salary_range||'Not provided',
        industry:row.industry||'',
        qualification:row.qualification||'',
        responsibilities:row.responsibilities||'',
        jdText:row.jd_text||'',
        status:'Active',
        skills:row.mandatory_skills||[],
        preferred:row.preferred_skills||[],
        aiSuggested:Boolean(row.ai_suggested_skills?.length&&!row.ai_skills_approved)
      }));
      localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(db));
      try{renderAll()}catch(e){console.warn('renderAll after live sync',e)}
      try{renderOldSite()}catch(e){console.warn('renderOldSite after live sync',e)}
      const n=reqs.length;
      if($('navReqCount'))$('navReqCount').textContent=n;
      if($('clientReqCount'))$('clientReqCount').textContent=n;
      if($('activeReqChip'))$('activeReqChip').textContent=`${n} active requirements`;
      document.querySelectorAll('[data-live-requirement-count]').forEach(el=>el.textContent=n);
      console.info(`TODO.AI requirements synced from Supabase: ${n}`);
    } finally { syncing=false; }
  }

  function boot(){
    syncNow().catch(e=>console.error('Initial live requirement sync failed',e));
    const c=backend()?.client;
    if(c?.auth?.onAuthStateChange){
      c.auth.onAuthStateChange((event,session)=>{
        if(session?.user && (event==='SIGNED_IN'||event==='TOKEN_REFRESHED'||event==='INITIAL_SESSION')){
          setTimeout(()=>syncNow().catch(e=>console.error('Auth live requirement sync failed',e)),150);
        }
      });
    }
    // Single delayed retry for scripts/session that finish restoring after DOM load. No interval/observer loop.
    setTimeout(()=>syncNow().catch(e=>console.error('Delayed live requirement sync failed',e)),1200);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.TSSRequirementsLiveSync={syncNow};
})();
