// Final clean assignment layout for requirement form. Removes duplicate legacy workflow controls.
(function(){
  const $=id=>document.getElementById(id);
  const OWNERS=['Akash Mistry','Shraddha Sharma','Pooja Wara'];
  const HANDLER='Shweta Tiwari';
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  let people=[];

  function toastSafe(m){try{toast(m)}catch{console.log(m)}}
  function reqByKey(key){
    if(typeof db==='undefined')return null;
    return (db.requirements||[]).find(r=>r.id===key||r.requirementId===key||r.profileKey===key||r.serverId===key)||null;
  }

  async function loadPeople(){
    try{
      const c=window.TSSBackend?.client;
      if(!c)return;
      const {data,error}=await c.from('profiles').select('full_name,email,role,is_active').eq('is_active',true).order('email');
      if(error)throw error;
      people=(data||[]).filter(x=>x.email).map(x=>({name:x.full_name||x.email,email:x.email,role:x.role||''}));
    }catch(e){console.warn('Clean assignment people load',e?.message||e);}
  }

  function style(){
    if($('assignmentCleanStyle'))return;
    const s=document.createElement('style');s.id='assignmentCleanStyle';
    s.textContent=`
      #reqAssignmentClean{display:grid;grid-template-columns:1fr 1fr 1.5fr;gap:16px;margin:14px 0 18px;padding:16px;border:1px solid #244761;border-radius:12px;background:#091c2b;align-items:start}
      #reqAssignmentClean .clean-field{min-width:0}
      #reqAssignmentClean label{display:block;margin:0 0 7px;color:#eaf4fb;font-size:13px;font-weight:600}
      #reqAssignmentClean select,#reqAssignmentClean input{width:100%;min-height:44px;box-sizing:border-box;border-radius:8px}
      #reqAssignmentClean input[readonly]{opacity:.92}
      .clean-assignee-wrap{position:relative}
      .clean-assignee-suggestions{position:absolute;left:0;right:0;top:calc(100% + 5px);z-index:99999;background:#081b2a;border:1px solid #31556f;border-radius:10px;box-shadow:0 14px 34px rgba(0,0,0,.32);max-height:220px;overflow:auto;display:none}
      .clean-assignee-suggestions.open{display:block}
      .clean-assignee-option{padding:10px 12px;cursor:pointer;border-bottom:1px solid #18364b}
      .clean-assignee-option:hover{background:#102b40}.clean-assignee-option:last-child{border-bottom:0}
      .clean-assignee-option strong{display:block;color:#eef7ff}.clean-assignee-option small{color:#8eacc1}
      .clean-assignee-chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
      .clean-assignee-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid #315b77;border-radius:999px;padding:6px 9px;background:#0a1e2e;color:#d8ecfb;font-size:11px;max-width:100%}
      .clean-assignee-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.clean-assignee-chip button{border:0;background:transparent;color:#9fc5df;cursor:pointer;font-size:14px;line-height:1}
      #reqRecruiters{position:absolute!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important;overflow:hidden!important}
      .clean-help{display:block;margin-top:6px;color:#829db1;font-size:11px;line-height:1.35}
      @media(max-width:900px){#reqAssignmentClean{grid-template-columns:1fr 1fr}.clean-assignee-field{grid-column:1/-1}}
      @media(max-width:640px){#reqAssignmentClean{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function selectedEmails(sel){return [...(sel?.selectedOptions||[])].map(o=>o.value).filter(Boolean)}
  function ensureSelectOptions(sel,selected){
    const all=new Map();
    people.forEach(p=>all.set(p.email,p));
    selected.forEach(email=>{if(!all.has(email))all.set(email,{name:email,email,role:''})});
    sel.innerHTML=[...all.values()].map(p=>`<option value="${esc(p.email)}">${esc(p.name)} · ${esc(p.email)}</option>`).join('');
    [...sel.options].forEach(o=>o.selected=selected.includes(o.value));
  }

  function renderChips(sel){
    const chips=$('reqRecruiterCleanChips');if(!chips)return;
    const selected=selectedEmails(sel);
    chips.innerHTML=selected.map(email=>{
      const p=people.find(x=>x.email===email);
      return `<span class="clean-assignee-chip" data-email="${esc(email)}"><span>${esc(p?.name||email)} · ${esc(email)}</span><button type="button" aria-label="Remove">×</button></span>`;
    }).join('');
    chips.querySelectorAll('button').forEach(b=>b.onclick=()=>{
      const email=b.closest('[data-email]')?.dataset.email;
      [...sel.options].forEach(o=>{if(o.value===email)o.selected=false});
      sel.dispatchEvent(new Event('change',{bubbles:true}));renderChips(sel);
    });
  }

  function wireSearch(sel){
    const input=$('reqRecruiterCleanSearch'),list=$('reqRecruiterCleanSuggestions');if(!input||!list)return;
    function render(q){
      q=String(q||'').trim().toLowerCase();
      if(!q){list.classList.remove('open');list.innerHTML='';return;}
      const chosen=selectedEmails(sel);
      const matches=people.filter(p=>!chosen.includes(p.email)&&(`${p.name} ${p.email} ${p.role}`).toLowerCase().includes(q)).slice(0,8);
      list.innerHTML=matches.length?matches.map(p=>`<div class="clean-assignee-option" data-email="${esc(p.email)}"><strong>${esc(p.name)}</strong><small>${esc(p.email)}${p.role?` · ${esc(p.role)}`:''}</small></div>`).join(''):`<div class="clean-assignee-option"><small>No matching active user found</small></div>`;
      list.classList.add('open');
      list.querySelectorAll('[data-email]').forEach(x=>x.onclick=()=>{
        const email=x.dataset.email;
        let opt=[...sel.options].find(o=>o.value===email);
        if(!opt){const p=people.find(p=>p.email===email);opt=document.createElement('option');opt.value=email;opt.textContent=`${p?.name||email} · ${email}`;sel.appendChild(opt)}
        opt.selected=true;sel.dispatchEvent(new Event('change',{bubbles:true}));input.value='';list.classList.remove('open');renderChips(sel);
      });
    }
    input.oninput=e=>render(e.target.value);
    input.onfocus=e=>{if(e.target.value)render(e.target.value)};
    input.onkeydown=e=>{if(e.key==='Escape')list.classList.remove('open')};
    sel.onchange=()=>renderChips(sel);
    document.addEventListener('click',e=>{const wrap=input.closest('.clean-assignee-wrap');if(wrap&&!wrap.contains(e.target))list.classList.remove('open')},{once:false});
  }

  function currentValues(){
    const r=reqByKey($('reqId')?.value);
    const owner=$('reqClientOwner')?.value||r?.clientOwner||OWNERS[0];
    const handler=$('reqHandler')?.value||r?.requirementHandler||HANDLER;
    const assigned=$('reqRecruiters')?selectedEmails($('reqRecruiters')):(Array.isArray(r?.assignedRecruiters)?r.assignedRecruiters:[]);
    return {r,owner,handler,assigned};
  }

  async function persistOwner(owner){
    const r=reqByKey($('reqId')?.value);
    if(!r?.serverId)return; // new requirement: normal Save/Submit will persist it.
    const c=window.TSSBackend?.client;if(!c)return;
    try{
      const user=await window.TSSBackend?.currentUser?.();
      const payload={client_owner:owner,updated_at:new Date().toISOString()};
      if(user?.id)payload.updated_by=user.id;
      const {error}=await c.from('requirements').update(payload).eq('id',r.serverId);
      if(error)throw error;
      r.clientOwner=owner;
      try{localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(db))}catch{}
      await window.TSSRequirementsLiveSync?.syncNow?.();
      setTimeout(()=>window.TSSProduction?.hydrate?.(),100);
      toastSafe(`Client Owner updated to ${owner}`);
    }catch(e){
      console.error('Client owner auto-save failed',e);
      toastSafe('Client Owner update failed: '+(e?.message||e));
    }
  }

  function removeLegacy(){
    document.querySelectorAll('.workflow-assignment-grid,#reqAssignmentPanel').forEach(el=>el.remove());
    document.querySelectorAll('#reqRecruiterSearch,#reqRecruiterSuggestions,#reqRecruiterChips').forEach(el=>el.closest('.assignee-auto-wrap')?.remove()||el.remove());
    document.querySelectorAll('select#reqRecruiters').forEach((el,i)=>{if(i>0)el.closest('div')?.remove()});
  }

  function build(){
    const form=$('requirementForm');if(!form)return;
    const vals=currentValues();
    removeLegacy();
    $('reqAssignmentClean')?.remove();

    const oldOwner=$('reqClientOwner');if(oldOwner){const holder=oldOwner.closest('div');if(holder)holder.style.display='none';}
    const oldHandler=$('reqHandler');if(oldHandler){const holder=oldHandler.closest('div');if(holder)holder.style.display='none';}

    const panel=document.createElement('div');panel.id='reqAssignmentClean';
    panel.innerHTML=`
      <div class="clean-field"><label>Client Owner</label><select id="reqClientOwnerClean">${OWNERS.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></div>
      <div class="clean-field"><label>Requirement Handler</label><input id="reqHandlerClean" value="${esc(vals.handler||HANDLER)}" readonly /></div>
      <div class="clean-field clean-assignee-field"><label>Assigned Recruiter(s)</label><div class="clean-assignee-wrap"><input id="reqRecruiterCleanSearch" autocomplete="off" placeholder="Type name or talent-stock email" /><div id="reqRecruiterCleanSuggestions" class="clean-assignee-suggestions"></div></div><div id="reqRecruiterCleanChips" class="clean-assignee-chips"></div><small class="clean-help">Type a name or email and select the matching user.</small><select id="reqRecruiters" multiple aria-hidden="true"></select></div>`;

    const anchor=form.querySelector('.jd-actions')||form.querySelector('[id="reqJdText"]')?.closest('div');
    if(anchor)anchor.insertAdjacentElement('beforebegin',panel);else form.appendChild(panel);

    const ownerClean=$('reqClientOwnerClean');ownerClean.value=OWNERS.includes(vals.owner)?vals.owner:OWNERS[0];
    const sel=$('reqRecruiters');ensureSelectOptions(sel,vals.assigned);renderChips(sel);wireSearch(sel);

    if(!oldOwner){const hidden=document.createElement('input');hidden.type='hidden';hidden.id='reqClientOwner';form.appendChild(hidden)}
    if(!oldHandler){const hidden=document.createElement('input');hidden.type='hidden';hidden.id='reqHandler';form.appendChild(hidden)}
    $('reqClientOwner').value=ownerClean.value;$('reqHandler').value=$('reqHandlerClean').value;
    ownerClean.onchange=async()=>{
      $('reqClientOwner').value=ownerClean.value;
      await persistOwner(ownerClean.value);
    };
  }

  async function boot(){style();await loadPeople();build();
    const dlg=$('requirementDialog');
    if(dlg&&!dlg.dataset.cleanAssignmentObserved){dlg.dataset.cleanAssignmentObserved='1';new MutationObserver(()=>{if(dlg.open)setTimeout(build,80)}).observe(dlg,{attributes:true,attributeFilter:['open']});}
    [600,1400,2600].forEach(ms=>setTimeout(()=>{if($('requirementDialog')?.open)build()},ms));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,900),{once:true});else setTimeout(boot,900);
  window.TSSAssignmentCleanLayout={boot,build,persistOwner};
})();