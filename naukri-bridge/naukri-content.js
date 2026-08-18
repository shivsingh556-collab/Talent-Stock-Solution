(function(){
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
  const visible=el=>!!(el && (el.offsetWidth||el.offsetHeight||el.getClientRects().length));
  function toast(text){
    let b=document.getElementById('todoAiNaukriBridgeStatus');
    if(!b){b=document.createElement('div');b.id='todoAiNaukriBridgeStatus';Object.assign(b.style,{position:'fixed',right:'18px',bottom:'18px',zIndex:'2147483647',padding:'11px 14px',borderRadius:'10px',background:'#0b5ed7',color:'#fff',font:'600 12px/1.4 system-ui',boxShadow:'0 8px 30px rgba(0,0,0,.25)'});document.documentElement.appendChild(b)}
    b.textContent=text; setTimeout(()=>b?.remove(),5000);
  }
  function textMatches(el, words){const t=norm(el?.innerText||el?.textContent);return words.some(w=>t===norm(w)||t.includes(norm(w)))}
  function findClickable(words){return [...document.querySelectorAll('a,button,[role="button"],[role="menuitem"]')].find(el=>visible(el)&&textMatches(el,words));}
  function dispatch(el){['input','change','blur'].forEach(type=>el.dispatchEvent(new Event(type,{bubbles:true})));}
  function setValue(el,val){if(!el||val===undefined||val===null||val==='')return false;const proto=Object.getPrototypeOf(el);const desc=Object.getOwnPropertyDescriptor(proto,'value');if(desc?.set)desc.set.call(el,String(val));else el.value=String(val);dispatch(el);return true;}
  function labelText(el){
    const id=el.id; let txt='';
    if(id){const l=document.querySelector(`label[for="${CSS.escape(id)}"]`); if(l)txt+=' '+l.textContent;}
    const p=el.closest('label,.form-group,.field,.form-field,.MuiFormControl-root,[class*="field"],[class*="form"]');
    if(p)txt+=' '+(p.textContent||'');
    txt+=' '+(el.getAttribute('placeholder')||'')+' '+(el.getAttribute('name')||'')+' '+(el.getAttribute('aria-label')||'')+' '+(el.id||'');
    return norm(txt);
  }
  function findField(patterns,selectors='input,textarea,select'){
    return [...document.querySelectorAll(selectors)].find(el=>visible(el)&&patterns.some(p=>labelText(el).includes(norm(p))));
  }
  async function chooseFirstAutocomplete(input){
    if(!input)return; input.focus(); input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',code:'ArrowDown',bubbles:true})); await sleep(180); input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));
  }
  function isLoginPage(){return /\/recruit\/login/i.test(location.pathname)||!!findClickable(['register/log in','log in','login']);}
  function isLikelySearchPage(){
    const body=norm(document.body.innerText);
    return body.includes('search resumes') && ([...document.querySelectorAll('input,textarea,select')].some(el=>labelText(el).includes('keyword'))||body.includes('advanced search'));
  }
  async function openSearchPage(){
    if(isLikelySearchPage())return true;
    const resdex=findClickable(['resdex']);
    if(resdex){resdex.click();await sleep(700);}
    const search=findClickable(['search resumes','search resume']);
    if(search){search.click();await sleep(1200);return true;}
    return false;
  }
  async function handleSubuser(){
    const body=norm(document.body.innerText);
    if(!body.includes('available sub-user')&&!body.includes('sub-user'))return false;
    const sels=[...document.querySelectorAll('select')].filter(visible);
    for(const s of sels){const opts=[...s.options].filter(o=>o.value&&norm(o.textContent)!=='select');if(opts.length===1){s.value=opts[0].value;dispatch(s);const login=findClickable(['login','log in']);if(login){login.click();toast('Resdex sub-user selected automatically.');return true;}}}
    toast('Select your Resdex sub-user once; TODO AI auto-search will continue automatically.');return true;
  }
  async function fillAndSearch(req){
    let keyword=findField(['keyword','keywords','key skill','key skills']);
    if(!keyword){keyword=[...document.querySelectorAll('input[type="text"],textarea')].find(el=>visible(el)&&!labelText(el).includes('location'));}
    const keywordText=req.keywords||[req.title,req.mandatory].filter(Boolean).join(' ');
    if(keyword)setValue(keyword,keywordText);

    const loc=findField(['location','current location','preferred location']);
    if(loc&&req.location&&norm(req.location)!=='not provided'){setValue(loc,req.location);await sleep(250);await chooseFirstAutocomplete(loc);}

    const min=findField(['minimum experience','min experience','experience min','min exp']);
    const max=findField(['maximum experience','max experience','experience max','max exp']);
    if(min&&req.minExp!=='')setValue(min,req.minExp);
    if(max&&req.maxExp!=='')setValue(max,req.maxExp);

    const freshness=findField(['resume freshness','freshness']);
    if(freshness&&freshness.tagName==='SELECT'){
      const opt=[...freshness.options].find(o=>/30\s*day/i.test(o.textContent));if(opt){freshness.value=opt.value;dispatch(freshness);}
    }

    await sleep(500);
    const searchBtn=findClickable(['search resumes','search resume']);
    if(searchBtn){
      searchBtn.click();
      req.status='submitted';req.submittedAt=Date.now();
      await chrome.storage.local.set({todoAiResdexRequest:req});
      toast('TODO AI search submitted — loading matching candidates…');
      return true;
    }
    toast('Resdex search form found, but Search Resumes button was not detected.');
    return false;
  }
  async function run(){
    const {todoAiResdexRequest:req}=await chrome.storage.local.get('todoAiResdexRequest');
    if(!req||Date.now()-(req.createdAt||0)>15*60*1000||req.status==='completed')return;
    if(isLoginPage()){toast('Complete Naukri Launcher/login. TODO AI will continue automatically after login.');return;}
    for(let i=0;i<12;i++){
      if(await handleSubuser())return;
      if(isLikelySearchPage()){await fillAndSearch(req);return;}
      await openSearchPage();
      await sleep(700);
      if(isLikelySearchPage()){await fillAndSearch(req);return;}
    }
    toast('Could not reach Resdex Advanced Search automatically. Open Resdex → Search Resumes once; TODO AI will continue.');
  }
  setTimeout(run,600);
})();
