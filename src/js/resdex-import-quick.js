// One-click Resdex CV import for TODO AI requirement cards.
(function(){
  const store=()=>typeof db!=='undefined'?db:null;
  const byKey=key=>(store()?.requirements||[]).find(r=>r.id===key||r.profileKey===key||r.serverId===key||r.requirementId===key);

  function toastSafe(msg){
    try{ if(typeof toast==='function') return toast(msg); }catch{}
    let el=document.getElementById('resdexQuickToast');
    if(!el){
      el=document.createElement('div'); el.id='resdexQuickToast';
      Object.assign(el.style,{position:'fixed',right:'18px',bottom:'18px',zIndex:'2147483647',padding:'10px 14px',borderRadius:'10px',background:'#0b5ed7',color:'#fff',font:'600 12px/1.4 system-ui',boxShadow:'0 8px 30px rgba(0,0,0,.25)'});
      document.body.appendChild(el);
    }
    el.textContent=msg; setTimeout(()=>el?.remove(),3200);
  }

  function decorate(){
    document.querySelectorAll('#requirementCards .req-card').forEach(card=>{
      const actions=card.querySelector('.card-actions');
      const key=card.querySelector('[data-id]')?.dataset.id;
      if(!actions||!key||card.querySelector('.resdex-import-quick-btn')) return;
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='btn ghost resdex-import-quick-btn';
      btn.dataset.req=key;
      btn.textContent='Import Resdex CVs';
      btn.title='Upload downloaded Resdex resumes and screen them against this requirement';
      actions.insertBefore(btn, actions.children[1]||null);
    });
  }

  async function openImport(key){
    const req=byKey(key);
    if(!req){ toastSafe('Could not identify this requirement. Refresh once and try again.'); return; }
    const api=window.TSSResdexAssistant;
    if(!api?.openAssistant){ toastSafe('Resdex importer is still loading. Try again in a moment.'); return; }

    api.openAssistant(req);
    await new Promise(r=>setTimeout(r,80));
    const input=document.getElementById('resdexFiles');
    if(!input){ toastSafe('Resume importer did not load. Refresh once and try again.'); return; }
    toastSafe(`Importing for ${req.requirementId||req.id} · ${req.title}`);
    input.click();
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('.resdex-import-quick-btn');
    if(!btn) return;
    e.preventDefault();
    e.stopPropagation();
    openImport(btn.dataset.req);
  },true);

  function boot(){
    decorate();
    const cards=document.getElementById('requirementCards');
    if(cards){
      const observer=new MutationObserver(()=>decorate());
      observer.observe(cards,{childList:true,subtree:true});
    }
    [250,700,1500,3000].forEach(ms=>setTimeout(decorate,ms));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.TSSResdexQuickImport={decorate,openImport};
})();