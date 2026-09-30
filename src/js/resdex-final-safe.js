// Final stable Resdex/Naukri launcher handoff for TODO AI.
(function(){
  const NAUKRI_ENTRY='https://www.naukri.com/recruit/login';

  function openNaukri(){
    const w=window.open(NAUKRI_ENTRY,'_blank','noopener');
    if(!w) window.location.href=NAUKRI_ENTRY;
  }

  function fixButton(){
    const old=document.getElementById('openResdex');
    if(!old || old.dataset.finalSafe==='1') return;
    const btn=old.cloneNode(true);
    btn.dataset.finalSafe='1';
    btn.textContent='Open Naukri Recruiter ↗';
    btn.title='Open Naukri Recruiter. Complete Naukri Launcher login if prompted, then choose Resdex → Search Resumes.';
    btn.removeAttribute('onclick');
    old.replaceWith(btn);
    btn.addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      openNaukri();
    });
  }

  function addInstruction(){
    const dlg=document.getElementById('resdexDialog');
    if(!dlg || dlg.querySelector('.resdex-final-instruction')) return;
    const actions=dlg.querySelector('.resdex-actions');
    if(!actions) return;
    const note=document.createElement('div');
    note.className='resdex-note resdex-final-instruction';
    note.style.width='100%';
    note.style.marginTop='4px';
    note.textContent='Naukri Launcher may appear. Complete login, then open Resdex → Search Resumes and paste the copied TODO AI search criteria.';
    actions.appendChild(note);
  }

  function apply(){ fixButton(); addInstruction(); }

  // Finite retries only; no MutationObserver or permanent polling.
  [0,250,700,1500,3000].forEach(ms=>setTimeout(apply,ms));
  document.addEventListener('click',function(e){
    if(e.target.closest?.('.resdex-card-btn, #reqDetailResdex')){
      setTimeout(apply,50);
      setTimeout(apply,250);
    }
  },true);

  window.TSSResdexFinalSafe={apply,openNaukri};
})();
