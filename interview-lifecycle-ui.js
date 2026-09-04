// TSS interview lifecycle UI: keeps completed/outcome interviews out of the active list and shows them in history.
(function(){
  'use strict';
  if(window.__TSS_INTERVIEW_LIFECYCLE_UI__)return;
  window.__TSS_INTERVIEW_LIFECYCLE_UI__=true;

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const terminalOutcome=o=>['Rejected','Client Rejected','Candidate Declined','No Show','Selected','Offer / Joining Formalities','Joined-TSS'].includes(String(o||''));
  const terminal=i=>terminalOutcome(i?.outcome)||['Completed','Cancelled','No Show'].includes(String(i?.status||''));

  function fmtUpdated(v){
    if(!v)return '—';
    const d=new Date(v);if(isNaN(d))return '—';
    return d.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }

  function ensureHistory(){
    let wrap=$('interviewHistoryPanel');
    if(wrap)return wrap;
    const board=$('interviewBoard');if(!board)return null;
    wrap=document.createElement('article');
    wrap.id='interviewHistoryPanel';
    wrap.className='old-panel';
    wrap.style.marginTop='18px';
    board.parentElement?.appendChild(wrap);
    return wrap;
  }

  function refresh(){
    const store=typeof db!=='undefined'?db:null;
    const board=$('interviewBoard');if(!store||!board)return;
    const items=store.interviews||[];
    const active=items.filter(i=>!terminal(i));
    const history=items.filter(terminal).slice().sort((a,b)=>new Date(b.outcomeUpdatedAt||b.scheduledAt||b.date||0)-new Date(a.outcomeUpdatedAt||a.scheduledAt||a.date||0));

    const rows=[...board.querySelectorAll('tbody tr')];
    rows.forEach((tr,idx)=>{
      const item=items[idx];
      if(item&&terminal(item))tr.style.display='none';
      else tr.style.display='';
    });

    const count=$('navInterviewCount');if(count)count.textContent=active.length;
    const hist=ensureHistory();if(!hist)return;
    hist.innerHTML=`<div class="panel-title"><div><span class="purple-label">INTERVIEW HISTORY</span><h3>Completed & Closed Interviews</h3></div><b>${history.length}</b></div>`+
      (history.length?`<div style="overflow:auto"><table class="jobs-table"><thead><tr><th>Date</th><th>Candidate</th><th>Position</th><th>Client</th><th>Status</th><th>Outcome</th><th>Feedback / Notes</th><th>Updated</th></tr></thead><tbody>${history.map(i=>`<tr><td>${esc(i.date||'—')}<br><small>${esc(i.time||'')}</small></td><td><strong>${esc(i.candidate||'Candidate')}</strong></td><td>${esc(i.position||'')}</td><td>${esc(i.client||'')}</td><td><span class="ia-status ${String(i.status)==='Cancelled'?'ia-cancelled':'ia-confirmed'}">${esc(i.status||'Completed')}</span></td><td><strong>${esc(i.outcome&&i.outcome!=='Pending'?i.outcome:(i.status==='Completed'?'Feedback Pending':'—'))}</strong></td><td>${esc(i.outcomeNotes||i.notes||'—')}</td><td>${esc(fmtUpdated(i.outcomeUpdatedAt))}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state">No completed interviews yet.</div>');
  }

  function boot(){
    const board=$('interviewBoard');
    if(board)new MutationObserver(()=>setTimeout(refresh,0)).observe(board,{childList:true,subtree:true});
    document.addEventListener('click',e=>{if(e.target.closest?.('.nav-item[data-view="interviews"]'))setTimeout(refresh,120)});
    document.addEventListener('tss:data-changed',()=>setTimeout(refresh,50));
    setTimeout(refresh,300);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.TSSInterviewLifecycleUI={refresh};
})();
