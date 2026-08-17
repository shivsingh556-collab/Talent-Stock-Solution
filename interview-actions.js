(function(){
  const DB=()=>typeof db!=='undefined'?db:null;
  const backend=()=>window.TSSBackend;
  const board=()=>document.getElementById('interviewBoard');
  const statusMap=new Map();
  let decorating=false;

  function toastSafe(msg){try{toast(msg)}catch{console.log(msg)}}
  function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function localItem(id){return (DB()?.interviews||[]).find(i=>String(i.serverId||i.id)===String(id));}
  function saveLocal(){try{localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(DB()))}catch{}}
  function toIso(date,time){
    const m=String(time||'11:00 AM').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i); if(!date||!m)return null;
    let h=Number(m[1]),mm=Number(m[2]); const ap=(m[3]||'').toUpperCase();
    if(ap==='PM'&&h<12)h+=12; if(ap==='AM'&&h===12)h=0;
    const iso=new Date(`${date}T${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00+05:30`);
    return isNaN(iso)?null:iso.toISOString();
  }
  function fmtTime(iso){return new Date(iso).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'}).toLowerCase();}
  function statusBadge(status){
    const s=status||'Scheduled';
    const cls=s==='Cancelled'?'ia-cancelled':s==='Confirmed'?'ia-confirmed':'ia-scheduled';
    return `<span class="ia-status ${cls}">${esc(s)}</span>`;
  }

  async function syncStatuses(){
    if(!backend()?.enabled)return;
    try{
      const {data,error}=await backend().client.from('interviews').select('id,status,candidate_response,cancelled_at');
      if(error)throw error;
      (data||[]).forEach(x=>statusMap.set(String(x.id),x));
      decorate();
    }catch(e){console.warn('Interview action status sync',e?.message||e)}
  }

  function decorate(){
    if(decorating)return; const b=board(); const store=DB(); if(!b||!store)return;
    const table=b.querySelector('table'); if(!table)return;
    decorating=true;
    try{
      const head=table.querySelector('thead tr');
      if(head&&!head.querySelector('[data-ia-status-head]')){
        const th1=document.createElement('th');th1.dataset.iaStatusHead='1';th1.textContent='Status';head.appendChild(th1);
        const th2=document.createElement('th');th2.dataset.iaActionsHead='1';th2.textContent='Actions';head.appendChild(th2);
      }
      const rows=[...table.querySelectorAll('tbody tr')];
      rows.forEach((tr,idx)=>{
        if(tr.querySelector('[data-ia-actions]'))return;
        const item=(store.interviews||[])[idx]; if(!item)return;
        const id=String(item.serverId||item.id||''); if(!id)return;
        const server=statusMap.get(id)||{}; const st=server.status||item.status||item.localStatus||'Scheduled';
        const tdStatus=document.createElement('td');tdStatus.dataset.iaStatus='1';tdStatus.innerHTML=statusBadge(st);tr.appendChild(tdStatus);
        const td=document.createElement('td');td.dataset.iaActions='1';td.className='ia-actions';
        td.innerHTML=`<button type="button" class="ia-btn ia-edit" data-ia-edit="${esc(id)}">Edit / Reschedule</button><button type="button" class="ia-btn ia-cancel" data-ia-cancel="${esc(id)}" ${st==='Cancelled'?'disabled':''}>Cancel</button><button type="button" class="ia-btn ia-delete" data-ia-delete="${esc(id)}">Delete</button>`;
        tr.appendChild(td);
      });
    }finally{decorating=false;}
  }

  async function reschedule(id){
    const item=localItem(id); if(!item)return toastSafe('Interview record not found');
    const date=prompt('New interview date (YYYY-MM-DD)',item.date||new Date().toISOString().slice(0,10)); if(!date)return;
    const time=prompt('New interview time',item.time||'11:00 AM'); if(!time)return;
    const scheduled=toIso(date,time); if(!scheduled)return toastSafe('Invalid date or time');
    if(!confirm(`Reschedule ${item.candidate||'this candidate'} to ${date} at ${time}?\n\nA fresh confirmation email and new reminders will be created.`))return;
    try{
      if(backend()?.enabled){
        const patch={scheduled_at:scheduled,status:'Scheduled',cancelled_at:null,candidate_response:'Pending',confirmed_at:null,reschedule_requested_at:null,confirmation_sent_at:null,reminder_10am_sent_at:null,reminder_1h_sent_at:null,reminder_30m_sent_at:null,reminder_5m_sent_at:null,reminder_status:'Pending'};
        const {error}=await backend().client.from('interviews').update(patch).eq('id',id); if(error)throw error;
      }
      item.date=date; item.time=fmtTime(scheduled); item.localStatus='Scheduled'; item.candidateResponse='Pending'; saveLocal();
      statusMap.set(String(id),{id,status:'Scheduled',candidate_response:'Pending',cancelled_at:null});
      toastSafe('Interview rescheduled · new email reminders queued');
      if(window.TSSProduction?.hydrate)await window.TSSProduction.hydrate(); else if(window.renderOldSite)window.renderOldSite();
      setTimeout(()=>{syncStatuses();decorate()},200);
    }catch(e){console.error(e);toastSafe('Could not reschedule: '+(e.message||e));}
  }

  async function cancelInterview(id){
    const item=localItem(id); if(!item)return toastSafe('Interview record not found');
    if(!confirm(`Cancel interview for ${item.candidate||'this candidate'}?\n\nFuture reminder emails will be stopped. The interview will remain in history.`))return;
    try{
      const now=new Date().toISOString();
      if(backend()?.enabled){const {error}=await backend().client.from('interviews').update({status:'Cancelled',cancelled_at:now,reminder_status:'Cancelled'}).eq('id',id);if(error)throw error;}
      item.localStatus='Cancelled';item.status='Cancelled';item.cancelledAt=now;saveLocal();statusMap.set(String(id),{id,status:'Cancelled',candidate_response:item.candidateResponse||'Pending',cancelled_at:now});
      toastSafe('Interview cancelled · future reminders stopped');
      if(window.renderOldSite)window.renderOldSite(); setTimeout(decorate,80);
    }catch(e){console.error(e);toastSafe('Could not cancel interview: '+(e.message||e));}
  }

  async function deleteInterview(id){
    const item=localItem(id); if(!item)return toastSafe('Interview record not found');
    if(!confirm(`Delete interview for ${item.candidate||'this candidate'} permanently?\n\nThis cannot be undone and its reminder queue will also be removed.`))return;
    try{
      if(backend()?.enabled){const {error}=await backend().client.from('interviews').delete().eq('id',id);if(error)throw error;}
      const store=DB();store.interviews=(store.interviews||[]).filter(i=>String(i.serverId||i.id)!==String(id));saveLocal();statusMap.delete(String(id));
      toastSafe('Interview permanently deleted');
      if(window.renderOldSite)window.renderOldSite(); setTimeout(decorate,80);
    }catch(e){console.error(e);toastSafe('Could not delete interview: '+(e.message||e));}
  }

  function wire(){
    const style=document.createElement('style');style.textContent=`
      #interviewBoard .ia-actions{white-space:nowrap;min-width:300px}.ia-btn{border:1px solid #2c5270;background:#102b40;color:#cfe9ff;border-radius:8px;padding:7px 10px;margin:2px 4px 2px 0;font:600 12px/1.2 Arial,sans-serif;cursor:pointer}.ia-btn:hover{filter:brightness(1.16)}.ia-btn:disabled{opacity:.45;cursor:not-allowed}.ia-edit{border-color:#237ac1}.ia-cancel{border-color:#b98022;color:#ffd68e}.ia-delete{border-color:#a74451;color:#ffadb7}.ia-status{display:inline-block;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:800}.ia-scheduled{background:#103b5c;color:#73c4ff}.ia-confirmed{background:#123f35;color:#74e6bd}.ia-cancelled{background:#44232a;color:#ff9fab}@media(max-width:900px){#interviewBoard .ia-actions{min-width:220px}.ia-btn{display:block;width:100%;margin:4px 0}}
    `;document.head.appendChild(style);
    document.addEventListener('click',e=>{
      const edit=e.target.closest('[data-ia-edit]');if(edit){reschedule(edit.dataset.iaEdit);return;}
      const cancel=e.target.closest('[data-ia-cancel]');if(cancel){cancelInterview(cancel.dataset.iaCancel);return;}
      const del=e.target.closest('[data-ia-delete]');if(del){deleteInterview(del.dataset.iaDelete);return;}
    });
    const b=board();if(b)new MutationObserver(()=>setTimeout(decorate,0)).observe(b,{childList:true,subtree:true});
    setTimeout(()=>{decorate();syncStatuses()},300);
    window.addEventListener('focus',()=>setTimeout(syncStatuses,80));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
  window.TSSInterviewActions={decorate,syncStatuses,reschedule,cancelInterview,deleteInterview};
})();
