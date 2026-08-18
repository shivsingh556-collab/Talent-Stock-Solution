// Force TODO AI's Resdex button to the authenticated Naukri Recruiter portal.
(function(){
  const RECRUITER_PORTAL='https://recruit.naukri.com/';

  function openRecruiter(){
    const w=window.open(RECRUITER_PORTAL,'_blank');
    if(!w) window.location.href=RECRUITER_PORTAL;
  }

  function relabel(){
    const btn=document.getElementById('openResdex');
    if(!btn) return false;
    if(btn.textContent!=='Open Naukri Recruiter ↗') btn.textContent='Open Naukri Recruiter ↗';
    const title='Open your authenticated Naukri Recruiter portal, then choose Resdex → Search Resumes';
    if(btn.title!==title) btn.title=title;
    return true;
  }

  // Capture phase prevents the older Resdex login handler from firing.
  document.addEventListener('click',function(e){
    const btn=e.target.closest?.('#openResdex');
    if(!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openRecruiter();
  },true);

  // Finite retries only. Never observe the whole DOM continuously.
  function boot(){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      const done=relabel();
      if(done||tries>=8) clearInterval(timer);
    },250);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.TSSResdexRouteFix={apply:relabel,openRecruiter};
})();
