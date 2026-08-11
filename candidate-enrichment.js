(function(){
  function enrichLatest(){
    const p=window.TSS_PARSED_RESUME;if(!p||!window.db?.candidates?.length)return;
    const c=window.db.candidates.at(-1);if(!c)return;
    if(p.skills?.length)c.skills=p.skills;
    if(p.education)c.education=p.education;
    if(p.currentCompany)c.currentCompany=p.currentCompany;
    if(p.totalExperience&&!c.totalExperience)c.totalExperience=p.totalExperience;
    if(p.location&&!c.location)c.location=p.location;
    if(p.designation&&!c.designation)c.designation=p.designation;
    if(p.email&&!c.email)c.email=p.email;
    if(p.phone&&!c.phone)c.phone=p.phone;
    try{localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(window.db))}catch{}
  }
  function wire(){document.getElementById('screenBtn')?.addEventListener('click',()=>setTimeout(enrichLatest,30))}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();