(()=>{
  function sendPage(type,detail){window.postMessage({source:'todo-linkedin-extension',type,detail},location.origin)}
  window.addEventListener('message',e=>{
    if(e.source!==window||e.origin!==location.origin)return;
    if(e.data?.source!=='todo-ai'||e.data?.type!=='SET_LINKEDIN_REQUIREMENT')return;
    const requirement=e.data.detail||null;
    chrome.storage.local.set({todoRequirement:requirement},()=>{
      const skills=(requirement?.skills||[]).slice(0,4).join(' ');
      const query=[requirement?.title,skills,requirement?.location,'open to work'].filter(Boolean).join(' ');
      chrome.runtime.sendMessage({type:'OPEN_LINKEDIN_SEARCH',query});
    });
  });
  function fillTodo(candidate){
    const set=(id,v)=>{const el=document.getElementById(id);if(el&&v!=null){el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}};
    const req=candidate.requirement;
    const quickReq=document.getElementById('quickRequirement');
    if(req?.id&&quickReq){quickReq.value=String(req.id);quickReq.dispatchEvent(new Event('change',{bubbles:true}))}
    set('candidateName',candidate.name);
    set('candidateLocation',candidate.location);
    set('candidateDesignation',candidate.headline);
    set('resumeText',candidate.profileText);
    set('quickResumeText',candidate.profileText);
    const quickCard=document.getElementById('quickScreenCard');
    if(quickCard){
      quickCard.scrollIntoView({behavior:'smooth',block:'start'});
      const st=document.getElementById('quickScreenStatus');
      if(st)st.textContent=`LinkedIn profile ready · Job-search signal: ${candidate.jobSearchSignal||'Unknown'}`;
    }else{
      const screening=document.getElementById('screening');
      screening?.scrollIntoView({behavior:'smooth',block:'start'});
    }
    sendPage('LINKEDIN_CANDIDATE_IMPORTED',{name:candidate.name,matchScore:candidate.matchScore,jobSearchSignal:candidate.jobSearchSignal});
  }
  chrome.storage.local.get(['todoPendingCandidate'],res=>{
    const c=res.todoPendingCandidate;if(!c)return;
    const timer=setInterval(()=>{if(document.documentElement.dataset.auth==='verified'){clearInterval(timer);fillTodo(c);chrome.storage.local.remove('todoPendingCandidate')}},250);
    setTimeout(()=>clearInterval(timer),15000);
  });
})();