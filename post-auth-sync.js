// Ensures the browser's authoritative 46-profile master is persisted only after Supabase auth exists.
(function(){
  const backend=()=>window.TSSBackend;
  let running=false,lastRun=0;
  async function syncNow(reason='session'){
    if(running||!backend()?.enabled||!Array.isArray(window.db?.requirements)||!db.requirements.length)return;
    const user=await backend().currentUser().catch(()=>null);if(!user)return;
    if(Date.now()-lastRun<3000)return;
    running=true;
    try{
      const result=await backend().syncMasterRequirements(db.requirements);
      lastRun=Date.now();
      console.info('TSS authenticated requirement sync',reason,result);
      if(result.synced){
        try{toast(`${result.synced} job profiles synced securely`)}catch{}
        // Re-hydrate so server UUID/profile_key become authoritative in the UI.
        setTimeout(()=>window.TSSProduction?.hydrate?.(),250);
      }
    }catch(err){console.error('TSS authenticated requirement sync failed',err);try{toast('Job profile backend sync failed: '+(err.message||err))}catch{}}
    finally{running=false}
  }
  function wire(){
    setTimeout(()=>syncNow('page_restore'),500);
    const client=backend()?.client;
    client?.auth?.onAuthStateChange?.((event,session)=>{if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED'||(event==='INITIAL_SESSION'&&session))setTimeout(()=>syncNow(event),250)});
    const ws=document.getElementById('workspace');
    if(ws)new MutationObserver(()=>{if(!ws.classList.contains('hidden'))setTimeout(()=>syncNow('workspace_open'),250)}).observe(ws,{attributes:true,attributeFilter:['class']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
  window.TSSPostAuthSync={syncNow};
})();
