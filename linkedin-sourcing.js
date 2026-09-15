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
  function queryFor(r){
    const top=[...(Array.isArray(r.skills)?r.skills:[]),...(Array.isArray(r.preferred)?r.preferred:[])].filter(Boolean).slice(0,5);
    return [r.title,...top,r.location,'open to work'].filter(Boolean).join(' ');
  }
  function notify(msg){if(window.toast)window.toast(msg);else console.info(msg)}
  function launch(){
    if(document.documentElement.dataset.auth!=='verified')return;
    const r=currentRequirement();
    if(!r){notify('Select a requirement first');return}

    // Store the exact requirement in the extension when available so scoring/import
    // can use the same requirement, but never depend on the extension to open search.
    window.postMessage({source:'todo-ai',type:'SET_LINKEDIN_REQUIREMENT',detail:payload(r)},location.origin);

    const q=encodeURIComponent(queryFor(r));
    const url=`https://www.linkedin.com/search/results/people/?keywords=${q}`;
    const opened=window.open(url,'_blank','noopener,noreferrer');
    if(!opened)location.href=url;
    notify(`Searching LinkedIn for ${r.title||'selected role'}`);
  }
  function mount(){
    if(document.documentElement.dataset.auth!=='verified')return;
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