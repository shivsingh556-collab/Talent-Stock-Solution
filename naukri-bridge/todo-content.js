(function(){
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function fields(){
    const out={};
    document.querySelectorAll('#resdexDialog .resdex-field').forEach(el=>{
      const k=(el.querySelector('span')?.textContent||'').trim().toLowerCase();
      const v=(el.querySelector('strong')?.textContent||'').trim();
      if(k) out[k]=v;
    });
    return out;
  }
  function parseExp(text){
    const nums=(String(text||'').match(/\d+(?:\.\d+)?/g)||[]).map(Number);
    return {min:nums[0]??'',max:nums[1]??nums[0]??''};
  }
  function banner(text, ok=true){
    let b=document.getElementById('todoAiBridgeStatus');
    if(!b){
      b=document.createElement('div'); b.id='todoAiBridgeStatus';
      Object.assign(b.style,{position:'fixed',right:'18px',bottom:'18px',zIndex:'999999',padding:'10px 14px',borderRadius:'10px',font:'600 12px/1.4 system-ui',boxShadow:'0 8px 30px rgba(0,0,0,.25)'});
      document.body.appendChild(b);
    }
    b.style.background=ok?'#0f5132':'#842029'; b.style.color='#fff'; b.textContent=text;
    setTimeout(()=>b?.remove(),4500);
  }
  async function buildRequest(){
    for(let i=0;i<10;i++){
      const dlg=document.getElementById('resdexDialog');
      if(dlg && dlg.open){
        const f=fields(); const exp=parseExp(f['experience']);
        return {
          id: Date.now().toString(36),
          createdAt: Date.now(),
          title:(document.getElementById('resdexTitle')?.textContent||'').replace(/^\s*TSS\d+\s*[·-]\s*/i,'').trim(),
          keywords:(document.getElementById('resdexBoolean')?.textContent||'').trim(),
          mandatory:f['mandatory skills']||'',
          preferred:f['preferred skills']||'',
          experience:f['experience']||'',
          minExp:exp.min,
          maxExp:exp.max,
          location:f['location']||'',
          freshness:f['profile freshness']||'30 days',
          qualification:f['qualification']||'',
          industry:f['industry / domain']||'',
          status:'pending'
        };
      }
      await sleep(100);
    }
    return null;
  }
  document.addEventListener('click', async e=>{
    const find=e.target.closest?.('.resdex-card-btn, #reqDetailResdex');
    if(!find) return;
    const req=await buildRequest();
    if(!req){ banner('TODO AI could not prepare the Resdex search.',false); return; }
    await chrome.storage.local.set({todoAiResdexRequest:req});
    banner('Resdex auto-search prepared. Opening Naukri…');
    chrome.runtime.sendMessage({type:'TODO_AI_OPEN_NAUKRI'});
  }, true);

  window.addEventListener('load',()=>banner('TODO AI ↔ Resdex Auto Search bridge ready'));
})();
