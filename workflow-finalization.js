(function(){
'use strict';
if(window.__TSS_WORKFLOW_FINALIZATION__)return;window.__TSS_WORKFLOW_FINALIZATION__=true;
const backend=()=>window.TSSBackend;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const toast=m=>{try{window.toast?.(m)}catch{console.log(m)}};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function cleanDuplicateAdmin(){
  const nav=$('#nav');if(!nav)return;
  const admins=$$('.nav-item').filter(x=>x.textContent.trim().replace(/\s+/g,' ').toLowerCase()==='admin');
  admins.slice(1).forEach(x=>x.remove());
}

function simplifyReports(){
  const root=$('#reportsRoot');if(!root)return;
  const heading=root.querySelector('.section-head h1');if(heading)heading.textContent='Management Reports';
  const sub=root.querySelector('.section-head p');if(sub)sub.textContent='Team performance, requirement progress and daily candidate submissions in one place.';
  const tabs=root.querySelector('.report-tabs');if(tabs){
    const perf=tabs.querySelector('[data-tab="performance"]');if(perf)perf.textContent='Team Performance';
    tabs.querySelector('[data-tab="team"]')?.remove();
    tabs.querySelector('[data-tab="audit"]')?.remove();
  }
  [...root.querySelectorAll('.report-panel')].forEach(p=>{
    const h=p.querySelector('h3');if(h&&/management snapshot/i.test(h.textContent||''))p.remove();
  });
}

function reportsWatch(){
  const root=$('#reportsRoot');if(!root)return;
  simplifyReports();
  if(root.__tssReportWatch)return;root.__tssReportWatch=true;
  new MutationObserver(()=>simplifyReports()).observe(root,{childList:true,subtree:true});
}

function outcomeLabel(v){return({
  'Feedback Pending':'Feedback Pending','Second Round':'Second Round','Selected':'Selected','Rejected':'Rejected','Hold':'Hold','Candidate Declined':'Candidate Declined','No Show':'No Show','Joined-TSS':'Joined-TSS'
})[v]||v}

function outcomeDialog(){let d=$('#tssOutcomeDialog');if(d)return d;d=document.createElement('dialog');d.id='tssOutcomeDialog';d.innerHTML=`<form method="dialog" class="tss-outcome-form"><div class="dialog-head"><div><span class="purple-label">INTERVIEW RESULT</span><h3>Update Interview Outcome</h3></div><button value="cancel" class="icon-btn">×</button></div><label>Outcome</label><select id="tssOutcomeSelect"><option>Feedback Pending</option><option>Second Round</option><option>Selected</option><option>Rejected</option><option>Hold</option><option>Candidate Declined</option><option>No Show</option><option>Joined-TSS</option></select><label>Notes</label><textarea id="tssOutcomeNotes" rows="4" placeholder="Client feedback / next step"></textarea><div class="dialog-actions"><button value="cancel" class="btn ghost">Cancel</button><button type="button" id="tssSaveOutcome" class="btn primary">Save Outcome</button></div></form>`;document.body.appendChild(d);return d}

async function updateOutcome(id){
  const c=backend()?.client;if(!c)return toast('Backend not available');
  const {data:iv,error}=await c.from('interviews').select('id,candidate_id,requirement_id,outcome,outcome_notes').eq('id',id).maybeSingle();if(error||!iv)return toast('Interview record not found');
  const d=outcomeDialog();d.dataset.id=id;$('#tssOutcomeSelect').value=iv.outcome||'Feedback Pending';$('#tssOutcomeNotes').value=iv.outcome_notes||'';d.showModal();
}

async function saveOutcome(){
  const d=$('#tssOutcomeDialog'),id=d?.dataset.id,c=backend()?.client;if(!id||!c)return;
  const outcome=$('#tssOutcomeSelect').value,notes=$('#tssOutcomeNotes').value.trim(),now=new Date().toISOString();
  const statusMap={'Feedback Pending':'Feedback Pending','Second Round':'Second Round','Selected':'Completed','Rejected':'Completed','Hold':'On Hold','Candidate Declined':'Completed','No Show':'No Show','Joined-TSS':'Completed'};
  try{
    const {data:iv,error}=await c.from('interviews').update({outcome,outcome_notes:notes,outcome_updated_at:now,status:statusMap[outcome]||'Completed'}).eq('id',id).select('candidate_id,requirement_id').single();if(error)throw error;
    let pipeline=null;if(outcome==='Selected')pipeline='Final Select';else if(outcome==='Joined-TSS')pipeline='Joined-TSS';else if(outcome==='Rejected'||outcome==='Candidate Declined'||outcome==='No Show')pipeline='Rejected';else pipeline='Interview';
    if(iv?.candidate_id&&iv?.requirement_id){const {data:s}=await c.from('screenings').select('id').eq('candidate_id',iv.candidate_id).eq('requirement_id',iv.requirement_id).order('screened_at',{ascending:false}).limit(1).maybeSingle();if(s?.id)await c.from('screenings').update({recruiter_decision:pipeline}).eq('id',s.id)}
    d.close();toast(`Interview outcome: ${outcomeLabel(outcome)}`);
    await window.TSSProduction?.hydrate?.();setTimeout(()=>window.TSSInterviewActions?.syncStatuses?.(),80);
  }catch(e){console.error(e);toast('Could not save outcome: '+(e.message||e))}
}

function decorateInterviewOutcomes(){
  const board=$('#interviewBoard');if(!board)return;
  const rows=[...board.querySelectorAll('tbody tr')];
  rows.forEach((tr,idx)=>{
    const cell=tr.querySelector('[data-ia-actions]');if(!cell||cell.querySelector('.ia-outcome'))return;
    let id='';const local=(typeof db!=='undefined'?(db.interviews||[])[idx]:null);id=String(local?.serverId||local?.id||'');if(!id)return;
    const b=document.createElement('button');b.type='button';b.className='ia-btn ia-outcome';b.dataset.iaOutcome=id;b.textContent='Update Outcome';cell.prepend(b);
  });
}

function wire(){
  cleanDuplicateAdmin();
  const nav=$('#nav');if(nav&&!nav.__tssFinalWatch){nav.__tssFinalWatch=true;new MutationObserver(()=>cleanDuplicateAdmin()).observe(nav,{childList:true})}
  document.addEventListener('click',e=>{
    const out=e.target.closest('[data-ia-outcome]');if(out){updateOutcome(out.dataset.iaOutcome);return}
    if(e.target.id==='tssSaveOutcome'){saveOutcome();return}
    if(e.target.closest('#reportsNav'))setTimeout(reportsWatch,120);
    if(e.target.closest('.nav-item[data-view="interviews"]'))setTimeout(decorateInterviewOutcomes,180);
  });
  const ib=$('#interviewBoard');if(ib&&!ib.__tssOutcomeWatch){ib.__tssOutcomeWatch=true;new MutationObserver(()=>decorateInterviewOutcomes()).observe(ib,{childList:true,subtree:true})}
  setTimeout(()=>{decorateInterviewOutcomes();reportsWatch();cleanDuplicateAdmin()},500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
window.TSSWorkflowFinalization={simplifyReports,cleanDuplicateAdmin,decorateInterviewOutcomes,updateOutcome};
})();