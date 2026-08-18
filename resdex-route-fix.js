// Force TODO AI's Resdex button to the authenticated Naukri Recruiter portal.
(function(){
  const RECRUITER_PORTAL='https://recruit.naukri.com/';

  function openRecruiter(){
    const w=window.open(RECRUITER_PORTAL,'_blank');
    if(!w) window.location.href=RECRUITER_PORTAL;
  }

  function relabel(){
    const btn=document.getElementById('openResdex');
    if(btn){
      btn.textContent='Open Naukri Recruiter ↗';
      btn.title='Open your authenticated Naukri Recruiter portal, then choose Resdex → Search Resumes';
    }
  }

  // Capture phase prevents the older Resdex login handler from firing at all.
  document.addEventListener('click',function(e){
    const btn=e.target.closest?.('#openResdex');
    if(!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openRecruiter();
  },true);

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(relabel,200));
  else setTimeout(relabel,200);

  new MutationObserver(relabel).observe(document.documentElement,{childList:true,subtree:true});
  window.TSSResdexRouteFix={apply:relabel,openRecruiter};
})();
