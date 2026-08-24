// Hydrate stored candidate resume text so Existing Candidate Match uses the same scoring engine as normal Screening.
(function(){
  let running=false;
  const backend=()=>window.TSSBackend;

  async function hydrateResumeText(){
    if(running || !backend()?.enabled || !window.db?.candidates?.length) return;
    running=true;
    try{
      const c=backend().client;
      const ids=window.db.candidates.map(x=>x.serverId||x.id).filter(Boolean);
      if(!ids.length) return;
      const {data,error}=await c.from('resume_versions')
        .select('candidate_id,extracted_text,uploaded_at,is_current,is_outdated')
        .in('candidate_id',ids)
        .eq('is_current',true)
        .eq('is_outdated',false)
        .order('uploaded_at',{ascending:false});
      if(error) throw error;
      const latest=new Map();
      for(const r of (data||[])){
        if(!latest.has(r.candidate_id) && String(r.extracted_text||'').trim()) latest.set(r.candidate_id,r.extracted_text);
      }
      let added=0;
      for(const cand of window.db.candidates){
        const id=cand.serverId||cand.id;
        const text=latest.get(id);
        if(text){cand.resumeText=text;added++;}
      }
      try{localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(window.db))}catch{}
      window.TSSCandidateResumeHydration.lastCount=added;
    }catch(e){
      console.warn('Stored resume hydration',e?.message||e);
    }finally{running=false;}
  }

  function boot(){
    setTimeout(hydrateResumeText,350);
    document.addEventListener('click',e=>{
      if(e.target.closest('.db-match-btn,#candidateDbMatchBtn,#screenExistingDbBtn')) hydrateResumeText();
    },true);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.TSSCandidateResumeHydration={hydrateResumeText,lastCount:0};
})();
