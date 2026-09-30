(function(){
  'use strict';
  if(window.__TSS_INTERVIEW_ACTIONS_STABLE__)return;
  window.__TSS_INTERVIEW_ACTIONS_STABLE__=true;

  const DB=()=>{try{return typeof db!=='undefined'?db:null}catch{return null}};
  const backend=()=>window.TSSBackend;
  const board=()=>document.getElementById('interviewBoard');
  const statusMap=new Map();
  let lastSignature='';
  let rendererWrapped=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function toastSafe(msg){try{toast(msg)}catch{console.log(msg)}}
  function visibleItems(){return (DB()?.interviews||[]).filter(i=>!i.archivedAt)}
  function localItem(id){return (DB()?.interviews||[]).find(i=>String(i.serverId||i.id)===String(id))}
  function saveLocal(){try{localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(DB()))}catch{}}
  function toIso(date,time){const m=String(time||'11:00 AM').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);if(!date||!m)return null;let h=Number(m[1]),mm=Number(m[2]);const ap=(m[3]||'').toUpperCase();if(ap==='PM'&&h<12)h+=12;if(ap==='AM'&&h===12)h=0;const iso=new Date(`${date}T${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00+05:30`);return isNaN(iso)?null:iso.toISOString()}
  function fmtTime(iso){return new Date(iso).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'}).toLowerCase()}

  function statusBadge(status){
    const s=status||'Scheduled';
    const cls=s==='Cancelled'?'ia-cancelled':s==='Completed'?'ia-confirmed':s==='Confirmed'?'ia-confirmed':s==='Reschedule Requested'?'ia-reschedule':'ia-scheduled';
    return `<span class="ia-status ${cls}">${esc(s)}</span>`;
  }
  function responseBadge(server,item){
    const r=server?.candidate_response||item?.candidateResponse||'Pending';
    if(r==='Confirmed')return '<span class="ia-response ia-available">✓ Candidate available</span>';
    if(r==='Reschedule Requested')return '<span class="ia-response ia-requested">↻ Reschedule requested</span>';
    return '<span class="ia-response ia-pending">Awaiting response</span>';
  }
  function scheduledBy(server,item){return server?.scheduled_by||item?.scheduledBy||item?.scheduled_by_name||'—'}

  function signature(items){
    return JSON.stringify(items.map(i=>{const id=String(i.serverId||i.id||'');const s=statusMap.get(id)||{};return [id,i.date,i.time,i.candidate,i.position,i.client,i.mode,s.candidate_response||i.candidateResponse,s.scheduled_by||i.scheduledBy,s.status||i.status,i.archivedAt]}));
  }

  function renderStable(force=false){
    const b=board();if(!b)return;
    const items=visibleItems();
    const sig=signature(items);
    if(!force&&sig===lastSignature&&b.querySelector('[data-tss-stable-interview-table]'))return;
    lastSignature=sig;
    const html=items.length?`<table class="jobs-table" data-tss-stable-interview-table="1"><thead><tr><th>Date</th><th>Time</th><th>Candidate</th><th>Position</th><th>Client</th><th>Mode</th><th>Candidate Response</th><th>Scheduled By</th><th>Status</th><th>Actions</th></tr></thead><tbody>${items.map(item=>{const id=String(item.serverId||item.id||'');const server=statusMap.get(id)||{};const st=server.status||item.status||item.localStatus||'Scheduled';return `<tr data-interview-id="${esc(id)}"><td>${esc(item.date||'—')}</td><td>${esc(item.time||'—')}</td><td><strong>${esc(item.candidate||'Candidate')}</strong></td><td>${esc(item.position||'')}</td><td>${esc(item.client||'')}</td><td>${esc(item.mode||'Client Interview')}</td><td class="ia-response-cell">${responseBadge(server,item)}</td><td>${esc(scheduledBy(server,item))}</td><td>${statusBadge(st)}</td><td class="ia-actions"><button type="button" class="ia-btn ia-outcome" data-ia-outcome="${esc(id)}">Update Interview</button><button type="button" class="ia-btn ia-edit" data-ia-edit="${esc(id)}">Edit / Reschedule</button><button type="button" class="ia-btn ia-cancel" data-ia-cancel="${esc(id)}" ${st==='Cancelled'?'disabled':''}>Cancel</button><button type="button" class="ia-btn ia-delete" data-ia-delete="${esc(id)}">Remove</button></td></tr>`}).join('')}</tbody></table>`:'<div class="empty-state">No interviews scheduled yet.</div>';
    if(b.innerHTML!==html)b.innerHTML=html;
    const count=document.getElementById('navInterviewCount');if(count)count.textContent=String(items.length);
  }

  function wrapLegacyRenderer(){
    if(rendererWrapped||typeof window.renderOldSite!=='function')return;
    const original=window.renderOldSite;
    if(original.__tssInterviewStable){rendererWrapped=true;return}
    const wrapped=function(){const out=original.apply(this,arguments);renderStable(false);return out};
    wrapped.__tssInterviewStable=true;
    window.renderOldSite=wrapped;
    rendererWrapped=true;
  }

  async function syncStatuses(){
    if(!backend()?.enabled)return renderStable(false);
    try{
      const {data:{session}}=await backend().client.auth.getSession();
      if(!session?.user)return renderStable(false);
      const {data,error}=await backend().client.from('interviews').select('id,status,candidate_response,archived_at');
      if(error)throw error;
      let changed=false;
      (data||[]).forEach(x=>{
        const id=String(x.id),scheduled=localItem(x.id)?.scheduledBy||'—';
        const next={...x,scheduled_by:scheduled};
        if(JSON.stringify(statusMap.get(id)||{})!==JSON.stringify(next))changed=true;
        statusMap.set(id,next);
        const item=localItem(id);if(item){item.status=x.status||item.status;item.candidateResponse=x.candidate_response||item.candidateResponse;item.archivedAt=x.archived_at||null;item.scheduledBy=scheduled;}
      });
      if(changed)saveLocal();
      renderStable(changed);
    }catch(e){console.warn('Interview status sync',e?.message||e);renderStable(false)}
  }

  async function reschedule(id){
    const item=localItem(id);if(!item)return toastSafe('Interview record not found');
    const date=prompt('New interview date (YYYY-MM-DD)',item.date||new Date().toISOString().slice(0,10));if(!date)return;
    const time=prompt('New interview time',item.time||'11:00 AM');if(!time)return;
    const scheduled=toIso(date,time);if(!scheduled)return toastSafe('Invalid date or time');
    if(!confirm(`Reschedule ${item.candidate||'this candidate'} to ${date} at ${time}?\n\nA fresh confirmation email and new reminders will be created.`))return;
    try{
      if(backend()?.enabled){const {error}=await backend().client.from('interviews').update({scheduled_at:scheduled,status:'Scheduled',cancelled_at:null,candidate_response:'Pending',confirmed_at:null,reschedule_requested_at:null,reschedule_preferred_date:null,reschedule_preferred_time:null,confirmation_sent_at:null,reminder_10am_sent_at:null,reminder_1h_sent_at:null,reminder_30m_sent_at:null,reminder_5m_sent_at:null,reminder_status:'Pending',archived_at:null}).eq('id',id);if(error)throw error}
      item.date=date;item.time=fmtTime(scheduled);item.status='Scheduled';item.candidateResponse='Pending';item.archivedAt=null;saveLocal();lastSignature='';renderStable(true);toastSafe('Interview rescheduled · new confirmation and reminders queued');setTimeout(syncStatuses,120);
    }catch(e){console.error(e);toastSafe('Could not reschedule: '+(e.message||e))}
  }

  async function cancelInterview(id){
    const item=localItem(id);if(!item)return toastSafe('Interview record not found');
    if(!confirm(`Cancel interview for ${item.candidate||'this candidate'}?\n\nFuture reminder emails will be stopped. The record will remain saved.`))return;
    try{
      const now=new Date().toISOString();
      if(backend()?.enabled){const {error}=await backend().client.from('interviews').update({status:'Cancelled',cancelled_at:now,reminder_status:'Cancelled'}).eq('id',id);if(error)throw error}
      item.status='Cancelled';item.cancelledAt=now;saveLocal();lastSignature='';renderStable(true);toastSafe('Interview cancelled · record retained');setTimeout(syncStatuses,100);
    }catch(e){console.error(e);toastSafe('Could not cancel interview: '+(e.message||e))}
  }

  async function deleteInterview(id){
    const item=localItem(id);if(!item)return toastSafe('Interview record not found');
    if(!confirm(`Remove interview for ${item.candidate||'this candidate'} from Interview Operations?\n\nThe full record, result and feedback will remain saved in Supabase for reports and audit.`))return;
    try{
      const now=new Date().toISOString();
      if(backend()?.enabled){const {error}=await backend().client.from('interviews').update({archived_at:now,updated_at:now}).eq('id',id);if(error)throw error}
      item.archivedAt=now;saveLocal();lastSignature='';renderStable(true);toastSafe('Removed from Interviews · backend record preserved');
    }catch(e){console.error(e);toastSafe('Could not remove interview: '+(e.message||e))}
  }

  function wire(){
    wrapLegacyRenderer();
    if(!document.getElementById('tssInterviewStableStyle')){const style=document.createElement('style');style.id='tssInterviewStableStyle';style.textContent=`#interviewBoard .ia-actions{white-space:nowrap;min-width:390px}.ia-btn{border:1px solid #c9d9e8;background:#fff;color:#155b91;border-radius:8px;padding:7px 10px;margin:2px 4px 2px 0;font:600 12px/1.2 Arial,sans-serif;cursor:pointer}.ia-btn:disabled{opacity:.45;cursor:not-allowed}.ia-status,.ia-response{display:inline-block;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:800}.ia-scheduled{background:#d9efff;color:#075887}.ia-confirmed,.ia-available{background:#d8f5e9;color:#086347}.ia-reschedule,.ia-requested{background:#fff0cd;color:#845800}.ia-cancelled{background:#ffe1e5;color:#8d2633}.ia-pending{background:#e8eef4;color:#395166}@media(max-width:900px){#interviewBoard .ia-actions{min-width:220px}.ia-btn{display:block;width:100%;margin:4px 0}}`;document.head.appendChild(style)}
    document.addEventListener('click',e=>{const edit=e.target.closest('[data-ia-edit]');if(edit){reschedule(edit.dataset.iaEdit);return}const cancel=e.target.closest('[data-ia-cancel]');if(cancel){cancelInterview(cancel.dataset.iaCancel);return}const del=e.target.closest('[data-ia-delete]');if(del){deleteInterview(del.dataset.iaDelete);return}});
    document.addEventListener('click',e=>{if(e.target.closest?.('.nav-item[data-view="interviews"]')){wrapLegacyRenderer();setTimeout(()=>renderStable(false),0)}});
    setTimeout(()=>{wrapLegacyRenderer();syncStatuses()},180);
    window.addEventListener('focus',()=>setTimeout(syncStatuses,80),{passive:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
  window.TSSInterviewActions={decorate:renderStable,renderStable,syncStatuses,reschedule,cancelInterview,deleteInterview};
})();
