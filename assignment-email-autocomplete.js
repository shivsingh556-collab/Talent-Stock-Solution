// TODO AI searchable email/name autocomplete for requirement assignees.
(function(){
  const $=id=>document.getElementById(id);
  const backend=()=>window.TSSBackend;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let people=[];

  async function loadPeople(){
    try{
      const c=backend()?.client;if(!c)return;
      const {data,error}=await c.from('profiles').select('full_name,email,role,is_active').eq('is_active',true).order('email');
      if(error)throw error;
      people=(data||[]).filter(x=>x.email).map(x=>({name:x.full_name||x.email,email:x.email,role:x.role||''}));
    }catch(e){console.warn('Assignee autocomplete people load',e?.message||e);}
  }

  function ensureStyle(){
    if($('assigneeAutocompleteStyle'))return;
    const s=document.createElement('style');s.id='assigneeAutocompleteStyle';s.textContent=`
      .assignee-auto-wrap{position:relative}.assignee-search{width:100%;min-height:42px}.assignee-suggestions{position:absolute;left:0;right:0;top:calc(100% + 5px);z-index:99999;background:#081b2a;border:1px solid #31556f;border-radius:10px;box-shadow:0 14px 34px rgba(0,0,0,.32);max-height:220px;overflow:auto;display:none}.assignee-suggestions.open{display:block}.assignee-option{padding:10px 12px;cursor:pointer;border-bottom:1px solid #18364b}.assignee-option:last-child{border-bottom:0}.assignee-option:hover{background:#102b40}.assignee-option strong{display:block;color:#eef7ff}.assignee-option small{color:#8eacc1}.assignee-chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.assignee-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid #315b77;border-radius:999px;padding:5px 9px;background:#0a1e2e;color:#d8ecfb;font-size:11px}.assignee-chip button{border:0;background:transparent;color:#9fc5df;cursor:pointer;font-size:14px;line-height:1}.assignee-native-hidden{position:absolute!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important;overflow:hidden!important}
    `;document.head.appendChild(s);
  }

  function selectedEmails(sel){return [...sel.selectedOptions].map(o=>o.value)}
  function syncChips(sel,chips){
    const selected=selectedEmails(sel);
    chips.innerHTML=selected.map(email=>{const p=people.find(x=>x.email===email);return `<span class="assignee-chip" data-email="${esc(email)}"><span>${esc(p?.name||email)} · ${esc(email)}</span><button type="button" aria-label="Remove">×</button></span>`}).join('');
    chips.querySelectorAll('.assignee-chip button').forEach(b=>b.onclick=()=>{
      const email=b.closest('.assignee-chip')?.dataset.email;
      [...sel.options].forEach(o=>{if(o.value===email)o.selected=false});
      sel.dispatchEvent(new Event('change',{bubbles:true}));
      syncChips(sel,chips);
    });
  }
  function ensureOptions(sel){
    const selected=selectedEmails(sel);
    sel.innerHTML=people.map(p=>`<option value="${esc(p.email)}">${esc(p.name)} · ${esc(p.email)}</option>`).join('');
    [...sel.options].forEach(o=>o.selected=selected.includes(o.value));
  }

  function enhance(){
    ensureStyle();
    const sel=$('reqRecruiters');if(!sel||sel.dataset.autocomplete==='1')return;
    sel.dataset.autocomplete='1';ensureOptions(sel);sel.classList.add('assignee-native-hidden');
    const field=sel.closest('.workflow-recruiter-field')||sel.parentElement;if(!field)return;
    const oldSmall=field.querySelector('small');if(oldSmall)oldSmall.textContent='Type a name or talent-stock email. New recruiters will appear automatically after their account is added.';
    const wrap=document.createElement('div');wrap.className='assignee-auto-wrap';
    wrap.innerHTML=`<input id="reqRecruiterSearch" class="assignee-search" autocomplete="off" placeholder="Type name or email, e.g. pooja@talent-stock.com" /><div id="reqRecruiterSuggestions" class="assignee-suggestions"></div><div id="reqRecruiterChips" class="assignee-chips"></div>`;
    sel.before(wrap);
    const input=$('reqRecruiterSearch'),list=$('reqRecruiterSuggestions'),chips=$('reqRecruiterChips');
    syncChips(sel,chips);
    function render(q){
      q=String(q||'').trim().toLowerCase();
      if(!q){list.classList.remove('open');list.innerHTML='';return;}
      const selected=selectedEmails(sel);
      const matches=people.filter(p=>!selected.includes(p.email)&&(`${p.name} ${p.email} ${p.role}`).toLowerCase().includes(q)).slice(0,8);
      list.innerHTML=matches.length?matches.map(p=>`<div class="assignee-option" data-email="${esc(p.email)}"><strong>${esc(p.name)}</strong><small>${esc(p.email)}${p.role?` · ${esc(p.role)}`:''}</small></div>`).join(''):`<div class="assignee-option"><small>No matching active user found</small></div>`;
      list.classList.add('open');
      list.querySelectorAll('[data-email]').forEach(x=>x.onclick=()=>{
        const email=x.dataset.email;
        const option=[...sel.options].find(o=>o.value===email);if(option)option.selected=true;
        sel.dispatchEvent(new Event('change',{bubbles:true}));
        input.value='';list.classList.remove('open');syncChips(sel,chips);
      });
    }
    input.addEventListener('input',e=>render(e.target.value));
    input.addEventListener('focus',e=>{if(e.target.value)render(e.target.value)});
    document.addEventListener('click',e=>{if(!wrap.contains(e.target))list.classList.remove('open')});
    sel.addEventListener('change',()=>syncChips(sel,chips));
  }

  async function boot(){await loadPeople();for(let i=0;i<12;i++){enhance();if($('reqRecruiterSearch'))break;await new Promise(r=>setTimeout(r,250));}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,700),{once:true});else setTimeout(boot,700);
  window.TSSAssignmentEmailAutocomplete={boot,enhance,loadPeople};
})();
