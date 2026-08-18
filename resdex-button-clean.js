// Clean final Resdex launcher: replaces any old button handler with a fresh button.
(function(){
  const PORTAL='https://recruit.naukri.com/';
  function cleanButton(){
    const oldBtn=document.getElementById('openResdex');
    if(!oldBtn || oldBtn.dataset.cleanFinal==='1') return;
    const btn=oldBtn.cloneNode(true);
    btn.dataset.cleanFinal='1';
    btn.textContent='Open Naukri Recruiter ↗';
    btn.title='Open your Naukri Recruiter dashboard, then choose Resdex';
    btn.onclick=null;
    btn.addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      const w=window.open(PORTAL,'_blank');
      if(!w) window.location.href=PORTAL;
    });
    oldBtn.replaceWith(btn);
  }
  document.addEventListener('click',function(e){
    if(e.target.closest?.('.resdex-card-btn')) setTimeout(cleanButton,0);
  },true);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(cleanButton,300));
  window.TSSResdexButtonClean={apply:cleanButton};
})();
