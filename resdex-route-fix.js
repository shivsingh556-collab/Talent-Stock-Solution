// Route TODO AI's Resdex button to the authenticated Naukri Recruiter portal.
(function(){
  const RECRUITER_PORTAL='https://recruit.naukri.com/';
  function apply(){
    const btn=document.getElementById('openResdex');
    if(btn&&!btn.dataset.portalFixed){
      btn.dataset.portalFixed='1';
      btn.onclick=()=>{const w=window.open(RECRUITER_PORTAL,'_blank');if(!w)location.href=RECRUITER_PORTAL};
      btn.textContent='Open Naukri Recruiter ↗';
      btn.title='Open your authenticated Naukri Recruiter portal, then choose Resdex → Search Resumes';
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,700));else setTimeout(apply,700);
  new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});
  window.TSSResdexRouteFix={apply};
})();
