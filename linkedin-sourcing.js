(()=>{
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function currentRequirement(){
    try{
      const id=document.getElementById('screenRequirement')?.value||document.getElementById('topRequirementSelect')?.value;
      return (window.db||db)?.requirements?.find(r=>String(r.id)===String(id))||null;
    }catch{return null}
  }
  function payload(r){return{id:r.id,title:r.title||'',client:r.client||'',location:r.location||'',experience:r.experience||'',skills:Array.isArray(r.skills)?r.skills:[],preferred:Array.isArray(r.preferred)?r.preferred:[],qualification:r.qualification||'',responsibilities:r.responsibilities||''}}
  function notify(msg){if(window.toast)window.toast(msg);else console.info(msg)}
  function launch(){
    if(document.documentElement.dataset.userRole!=='recruiter')return;
    const r=currentRequirement();
    if(!r){notify('Select a requirement first');return}
    window.postMessage({source:'todo-ai',type:'SET_LINKEDIN_REQUIREMENT',detail:payload(r)},location.origin);
    notify(`Opening LinkedIn sourcing for ${r.title||'selected role'}`);
  }
  function mount(){
    if(document.documentElement.dataset.userRole!=='recruiter')return;
    const card=document.querySelector('.selected-requirement-card .panel-title');
    if(!card||document.getElementById('findLinkedInCandidates'))return;
    const btn=document.createElement('button');
    btn.id='findLinkedInCandidates';
    btn.type='button';
    btn.className='blue-btn';
    btn.innerHTML='in&nbsp;&nbsp; Find candidates on LinkedIn';
    btn.style.cssText='margin-left:auto;white-space:nowrap';
    btn.addEventListener('click',launch);
    card.appendChild(btn);
  }
  const timer=setInterval(()=>{mount();if(document.getElementById('findLinkedInCandidates'))clearInterval(timer)},250);
  window.addEventListener('tss:auth-ready',mount);
  window.addEventListener('tss:hydrated',mount);
  window.addEventListener('message',e=>{
    if(e.source!==window||e.origin!==location.origin||e.data?.source!=='todo-linkedin-extension')return;
    if(e.data?.type==='LINKEDIN_CANDIDATE_IMPORTED')notify(`${esc(e.data.detail?.name||'Candidate')} imported from LinkedIn`);
  });
  window.TSSLinkedInSourcing={launch,mount};
})();