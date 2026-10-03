// Search loaded requirement options without changing their identity or access filters.
(function(){
  'use strict';
  if(window.TSSRequirementSearch)return;
  const ids=['topRequirementSelect','screenRequirement','quickRequirement','tssIsRequirement'];
  const states=new Map();
  const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const requirements=()=>{try{return (typeof db!=='undefined'?db:window.db)?.requirements||[]}catch{return []}};
  function syncAll(){attach();states.forEach(state=>state.sync())}
  function attach(){
    states.forEach((state,id)=>{if(!state.select.isConnected){state.observer.disconnect();states.delete(id)}});
    ids.forEach(id=>{
      const select=document.getElementById(id);
      if(!select||states.has(id)||select.classList.contains('hidden-support'))return;
      const wrap=document.createElement('div');wrap.className='tss-requirement-search';
      const input=document.createElement('input');input.id=id+'Search';input.type='text';input.autocomplete='off';
      input.placeholder='Search role, client or TSS ID…';
      input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');
      input.setAttribute('aria-label',select.getAttribute('aria-label')||'Search and select requirement');
      input.setAttribute('aria-controls',id+'SearchOptions');
      const list=document.createElement('div');list.id=id+'SearchOptions';list.hidden=true;list.setAttribute('role','listbox');list.setAttribute('aria-label','Requirements');
      const status=document.createElement('small');status.className='tss-requirement-search-status';status.setAttribute('role','status');
      select.before(wrap);wrap.append(input,list,status,select);
      select.classList.add('tss-requirement-search-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
      // Associated labels focus the visible search field; original select IDs remain intact.
      document.querySelectorAll('label[for="'+id+'"]').forEach(label=>label.htmlFor=input.id);
      let rows=[],shown=[],active=-1,open=false,dirty=false;
      const state={select,wrap,close,observer:null,sync};states.set(id,state);
      function rebuild(){
        const aliases=new Map();requirements().forEach(r=>[r.id,r.serverId,r.requirementId,r.profileKey].filter(Boolean).forEach(key=>aliases.set(String(key),r)));
        rows=Array.from(select.options).filter(o=>o.value&&!o.disabled&&!o.hidden&&!o.parentElement?.disabled).map(o=>{
          const r=aliases.get(o.value),meta=[r?.requirementId||r?.id,r?.status].filter(Boolean).join(' · ');
          const label=o.textContent.trim();
          const search=normalize([label,o.value,r?.title,r?.client,r?.id,r?.requirementId,r?.profileKey].filter(Boolean).join(' '));
          return {value:o.value,label,meta,search,compact:search.replace(/ /g,'')};
        });
      }
      function selectedLabel(){return select.selectedOptions[0]?.textContent.trim()||''}
      function close(){open=false;dirty=false;active=-1;list.hidden=true;status.textContent='';input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');input.value=selectedLabel()}
      function sync(){input.disabled=select.disabled;if(!open||!dirty)input.value=selectedLabel()}
      function highlight(){
        Array.from(list.querySelectorAll('[role=option]')).forEach((node,i)=>node.classList.toggle('active',i===active));
        const node=active>=0?document.getElementById(id+'SearchOption'+active):null;
        if(node){input.setAttribute('aria-activedescendant',node.id);node.scrollIntoView({block:'nearest'})}else input.removeAttribute('aria-activedescendant');
      }
      function choose(row){
        if(select.disabled||!Array.from(select.options).some(o=>o.value===row.value&&!o.disabled&&!o.hidden&&!o.parentElement?.disabled))return;
        select.value=row.value;close();select.dispatchEvent(new Event('change',{bubbles:true}));syncAll();
      }
      function render(query=''){
        const tokens=normalize(query).split(' ').filter(Boolean);
        const matches=rows.filter(row=>tokens.every(token=>row.search.includes(token)||row.compact.includes(token)));
        shown=matches.slice(0,100);active=-1;list.replaceChildren();input.removeAttribute('aria-activedescendant');
        shown.forEach((row,i)=>{
          const option=document.createElement('div');option.id=id+'SearchOption'+i;option.setAttribute('role','option');option.setAttribute('aria-selected',String(select.value===row.value));
          const title=document.createElement('strong');title.textContent=row.label;option.append(title);
          if(row.meta){const meta=document.createElement('small');meta.textContent=row.meta;option.append(meta)}
          option.addEventListener('pointerdown',event=>event.preventDefault());option.addEventListener('click',()=>choose(row));list.append(option);
        });
        if(!shown.length){const empty=document.createElement('div');empty.className='tss-requirement-search-empty';empty.textContent='No matching requirements';list.append(empty)}
        status.textContent=matches.length>100?'Showing 100 of '+matches.length+' requirements. Type to narrow the search.':matches.length+' matching requirement'+(matches.length===1?'':'s');
      }
      function show(){if(input.disabled)return;rebuild();sync();open=true;dirty=false;list.hidden=false;input.setAttribute('aria-expanded','true');render();input.select()}
      input.addEventListener('focus',show);
      input.addEventListener('click',()=>{if(!open)show()});
      input.addEventListener('input',()=>{if(!open){rebuild();open=true;list.hidden=false;input.setAttribute('aria-expanded','true')}dirty=true;render(input.value)});
      input.addEventListener('keydown',event=>{
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){
          event.preventDefault();if(!open)show();if(shown.length){active=event.key==='ArrowDown'?(active+1)%shown.length:(active<=0?shown.length-1:active-1);highlight()}
        }else if(event.key==='Enter'&&open){event.preventDefault();if(active>=0)choose(shown[active]);else if(shown.length===1)choose(shown[0])}
        else if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close()}
        else if(event.key==='Tab')close();
      });
      input.addEventListener('blur',close);
      select.addEventListener('change',()=>{close();queueMicrotask(syncAll)});
      state.observer=new MutationObserver(()=>{rebuild();sync();if(open)render(dirty?input.value:'')});
      state.observer.observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','hidden','selected','value','label'],characterData:true});
      rebuild();sync();
    });
  }
  document.addEventListener('tss:data-rendered',syncAll);
  window.addEventListener('tss:hydrated',syncAll);
  document.addEventListener('change',()=>queueMicrotask(syncAll));
  // Dialogs and quick screening are mounted by existing click handlers.
  document.addEventListener('click',event=>{states.forEach(state=>{if(!state.wrap.contains(event.target))state.close()});setTimeout(syncAll,0)});
  window.TSSRequirementSearch={refresh:syncAll};
  syncAll();
})();
