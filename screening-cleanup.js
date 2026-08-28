// Keep Screening focused on candidate upload; requirement/JD entry already lives in Requirements.
(function(){
  'use strict';
  function apply(){
    const notice=document.getElementById('requirementNotice');
    if(notice) notice.style.setProperty('display','none','important');

    const screening=document.getElementById('screening');
    if(!screening)return;
    [...screening.querySelectorAll('.upload-card')].forEach(card=>{
      const title=(card.querySelector('h2')?.textContent||'').trim().toLowerCase();
      if(title.includes('add the job requirement')) card.style.setProperty('display','none','important');
      if(title.includes('upload candidate resumes')){
        card.style.removeProperty('display');
        const n=card.querySelector('.number-title>b');
        if(n)n.textContent='01';
      }
    });
  }
  const style=document.createElement('style');
  style.id='tssScreeningCleanupStyle';
  style.textContent='#screening #requirementNotice{display:none!important}';
  document.head.appendChild(style);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  window.addEventListener('pageshow',apply);
  document.addEventListener('click',e=>{if(e.target.closest('[data-view="screening"],.nav-item[data-view="screening"]'))setTimeout(apply,60)},true);
  window.TSSScreeningCleanup={apply};
})();