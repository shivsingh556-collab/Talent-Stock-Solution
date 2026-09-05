// TODO AI interview lifecycle: one authoritative active/history renderer with lightweight server reconciliation.
(function(){
  'use strict';
  if(window.__TSS_INTERVIEW_LIFECYCLE_UI__)return;
  window.__TSS_INTERVIEW_LIFECYCLE_UI__=true;

  const $=id=>document.getElementById(id);
  const backend=()=>window.TSSBackend;
  const store=()=>{try{return typeof db!=='undefined'?db:null}catch{return null}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let syncing=false;
  let lastSync=0;
  let wrapped=false;

  const terminalOutcome=o=>['Rejected','Client Rejected','Candidate Declined','No Show','Selected','Offer / Joining Formalities','Joined-TSS'].includes(String(o||''));
  const terminal=i=>terminalOutcome(i?.outcome)||['Completed','Cancelled','No Show'].includes(String(i?.status||''));

  function persist(){const s=store();if(!s)return;try{localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(s))}catch{}}
  function fmtUpdated(v){if(!v)return '—';const d=new Date(v);if(isNaN(d))return '—';return d.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}
  function fmtDate(d){if(!d||isNaN(d))return'';return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
  function fmtTime(d){if(!d||isNaN(d))return'';return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:true}).format(d)}

  function ensureHistory(){
    let wrap=$('interviewHistoryPanel');
    if(wrap)return wrap;
    const board=$('interviewBoard');if(!board)return null;
    wrap=document.createElement('article');
    wrap.id='interviewHistoryPanel';wrap.className='old-panel';wrap.style.marginTop='18px';
    board.parentElement?.appendChild(wrap);return wrap;
  }

  function refresh(){
    const s=store(),board=$('interviewBoard');if(!s||!board)return;
    const items=s.interviews||[];
    const active=items.filter(i=>!terminal(i));
    const history=items.filter(terminal).slice().sort((a,b)=>new Date(b.outcomeUpdatedAt||b.scheduledAt||b.date||0)-new Date(a.outcomeUpdatedAt||a.scheduledAt||a.date||0));
    const count=$('navInterviewCount');if(count)count.textContent=active.length;
    const hist=ensureHistory();if(!hist)return;
    hist.innerHTML=`<div class="panel-title"><div><span class="purple-label">INTERVIEW HISTORY</span><h3>Completed & Closed Interviews</h3></div><b>${history.length}</b></div>`+
      (history.length?`<div style="overflow:auto"><table class="jobs-table"><thead><tr><th>Date</th><th>Candidate</th><th>Position</th><th>Client</th><th>Status</th><th>Outcome</th><th>Feedback / Notes</th><th>Updated</th></tr></thead><tbody>${history.map(i=>`<tr><td>${esc(i.date||'—')}<br><small>${esc(i.time||'')}</small></td><td><strong>${esc(i.candidate||'Candidate')}</strong></td><td>${esc(i.position||'')}</td><td>${esc(i.client||'')}</td><td><span class="ia-status ${String(i.status)==='Cancelled'?'ia-cancelled':'ia-confirmed'}">${esc(i.status||'Completed')}</span></td><td><strong>${esc(i.outcome&&i.outcome!=='Pending'?i.outcome:(i.status==='Completed'?'Feedback Pending':'—'))}</strong></td><td>${esc(i.outcomeNotes||i.notes||'—')}</td><td>${esc(fmtUpdated(i.outcomeUpdatedAt))}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state">No completed interviews yet.</div>');
  }

  function wrapLegacyRenderer(){
    if(wrapped||typeof window.renderOldSite!=='function')return;
    const original=window.renderOldSite;
    if(original.__tssLifecycleWrapped){wrapped=true;return}
    const wrappedRender=function(){
      const s=store();if(!s)return original.apply(this,arguments);
      const all=s.interviews||[];
      s.interviews=all.filter(i=>!terminal(i));
      try{return original.apply(this,arguments)}finally{s.interviews=all;setTimeout(refresh,0)}
    };
    wrappedRender.__tssLifecycleWrapped=true;
    window.renderOldSite=wrappedRender;wrapped=true;
  }

  async function syncNow(force=false){
    if(syncing||!backend()?.enabled)return;
    const now=Date.now();if(!force&&now-lastSync<30000)return;
    const s=store();if(!s)return;
    syncing=true;
    try{
      const {data,error}=await backend().client.from('interviews').select('id,scheduled_at,status,interview_stage,outcome,outcome_notes,outcome_updated_at,candidate_response,notes,interview_type,candidate_id,requirement_id,candidate_name_snapshot,job_title_snapshot,client_name_snapshot,candidate_email_snapshot').order('scheduled_at',{ascending:true});
      if(error)throw error;
      const byId=new Map((s.interviews||[]).map(i=>[String(i.serverId||i.id),i]));
      for(const row of data||[]){
        const id=String(row.id);let item=byId.get(id);const d=row.scheduled_at?new Date(row.scheduled_at):null;
        const patch={id:row.id,serverId:row.id,scheduledAt:row.scheduled_at||null,date:fmtDate(d),time:fmtTime(d),candidate:row.candidate_name_snapshot||item?.candidate||'Candidate',email:row.candidate_email_snapshot||item?.email||'',position:row.job_title_snapshot||item?.position||'',client:row.client_name_snapshot||item?.client||'',mode:row.interview_type||item?.mode||'Client Interview',status:row.status||'Scheduled',interviewStage:row.interview_stage||'Scheduled',outcome:row.outcome||'Pending',outcomeNotes:row.outcome_notes||'',outcomeUpdatedAt:row.outcome_updated_at||null,candidateResponse:row.candidate_response||'Pending',notes:row.notes||'',candidateId:row.candidate_id,requirementServerId:row.requirement_id};
        if(item)Object.assign(item,patch);else{item=patch;(s.interviews??=[]).push(item);byId.set(id,item)}
      }
      persist();lastSync=Date.now();wrapLegacyRenderer();
      try{window.renderOldSite?.()}catch{}
      try{window.TSSInterviewActions?.decorate?.(true)}catch{}
      refresh();
    }catch(e){console.warn('Interview lifecycle sync',e?.message||e)}finally{syncing=false}
  }

  function boot(){
    wrapLegacyRenderer();
    setTimeout(()=>syncNow(true),220);
    document.addEventListener('click',e=>{if(e.target.closest?.('.nav-item[data-view="interviews"]'))setTimeout(()=>syncNow(false),40)});
    document.addEventListener('tss:data-changed',()=>setTimeout(refresh,30));
    document.addEventListener('tss:interview-state-synced',()=>setTimeout(refresh,30));
    setTimeout(refresh,300);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.TSSInterviewLifecycleUI={refresh,syncNow,terminal};
})();
