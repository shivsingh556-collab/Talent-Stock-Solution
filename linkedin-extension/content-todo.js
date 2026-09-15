(()=>{
  function sendPage(type,detail){window.postMessage({source:'todo-linkedin-extension',type,detail},location.origin)}

  // Remember the exact Todo AI URL being used (including preview/share query string)
  // so LinkedIn can return to the same authenticated tab instead of another deployment.
  chrome.storage.local.set({todoAppUrl:location.href});

  window.addEventListener('message',e=>{
    if(e.source!==window||e.origin!==location.origin)return;
    if(e.data?.source!=='todo-ai'||e.data?.type!=='SET_LINKEDIN_REQUIREMENT')return;
    const requirement=e.data.detail||null;
    chrome.storage.local.set({todoRequirement:requirement,todoAppUrl:location.href});
  });

  function fillTodo(candidate){
    if(!candidate)return false;
    const set=(id,v)=>{const el=document.getElementById(id);if(el&&v!=null){el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}};
    const req=candidate.requirement;

    // Move the app to Screening before filling fields when possible.
    const screeningNav=document.querySelector('[data-view="screening"], [data-nav="screening"]');
    screeningNav?.click?.();

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
      if(st)st.textContent=`LinkedIn candidate imported: ${candidate.name||'Candidate'} · Fit ${candidate.matchScore??'-'}% · Job-search signal: ${candidate.jobSearchSignal||'Unknown'}`;
    }else{
      document.getElementById('screening')?.scrollIntoView({behavior:'smooth',block:'start'});
      if(window.toast)window.toast(`${candidate.name||'Candidate'} imported from LinkedIn`);
    }

    sendPage('LINKEDIN_CANDIDATE_IMPORTED',{name:candidate.name,matchScore:candidate.matchScore,jobSearchSignal:candidate.jobSearchSignal});
    return true;
  }

  function consumePending(){
    chrome.storage.local.get(['todoPendingCandidate'],res=>{
      const c=res.todoPendingCandidate;
      if(!c)return;
      const tryFill=()=>{
        if(document.documentElement.dataset.auth!=='verified')return false;
        if(fillTodo(c)){
          chrome.storage.local.remove('todoPendingCandidate');
          return true;
        }
        return false;
      };
      if(tryFill())return;
      const timer=setInterval(()=>{if(tryFill())clearInterval(timer)},250);
      setTimeout(()=>clearInterval(timer),15000);
    });
  }

  consumePending();
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='local'&&changes.todoPendingCandidate?.newValue)consumePending();
  });
})();
