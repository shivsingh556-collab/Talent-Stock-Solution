(function(){
'use strict';
if(window.__TSS_WORKFLOW_FINALIZATION__)return;window.__TSS_WORKFLOW_FINALIZATION__=true;
const backend=()=>window.TSSBackend;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const toast=m=>{try{window.toast?.(m)}catch{console.log(m)}};

function normalizeNav(){
  const nav=$('#nav');if(!nav)return;
  const admins=$$('.nav-item').filter(x=>x.textContent.trim().replace(/\s+/g,' ').toLowerCase()==='admin');
  admins.slice(1).forEach(x=>x.remove());
  const reports=$('#reportsNav');if(reports)reports.innerHTML='<span>▤</span>Reports';
  const admin=$('#adminNavBtn')||admins[0];
  if(reports&&admin&&reports.nextElementSibling!==admin)nav.insertBefore(reports,admin);
}

function simplifyReports(){
  const root=$('#reportsRoot');if(!root)return;
  const heading=root.querySelector('.section-head h1');if(heading)heading.textContent='Management Reports';
  const sub=root.querySelector('.section-head p');if(sub)sub.textContent='Team performance, requirement progress and daily candidate submissions in one place.';
  const tabs=root.querySelector('.report-tabs');
  if(tabs){
    const perf=tabs.querySelector('[data-tab="performance"]');if(perf)perf.textContent='Team Performance';
    tabs.querySelector('[data-tab="team"]')?.remove();
    tabs.querySelector('[data-tab="audit"]')?.remove();
  }
  [...root.querySelectorAll('.report-panel')].forEach(p=>{
    const h=p.querySelector('h3');if(h&&/management snapshot/i.test(h.textContent||''))p.remove();
  });
}
function applyReportCleanup(){simplifyReports();normalizeNav();setTimeout(simplifyReports,80);setTimeout(simplifyReports,250);setTimeout(simplifyReports,700)}

const STAGES=['Scheduled','Interview Completed','Client Feedback Pending','Result Received','Joining / Closure'];
const RESULTS=['Pending','Second Round','Selected','Hold','Rejected','Client Rejected','Candidate Declined','Candidate Not Available','No Show','Reschedule','Offer / Joining Formalities','Joined-TSS'];

function outcomeDialog(){
  let d=$('#tssOutcomeDialog');if(d)return d;
  d=document.createElement('dialog');d.id='tssOutcomeDialog';
  d.innerHTML=`<form method="dialog" class="tss-outcome-form"><div class="dialog-head"><div><span class="purple-label">INTERVIEW PROGRESS</span><h3>Update Interview</h3><p style="margin:4px 0 0;color:#68788a;font-size:12px">Track the interview through 5 clear stages. Every saved update is emailed to active Admins and Super Admins.</p></div><button value="cancel" class="icon-btn">×</button></div><label>Interview Stage</label><select id="tssStageSelect">${STAGES.map(x=>`<option>${x}</option>`).join('')}</select><label>Interview Result</label><select id="tssOutcomeSelect">${RESULTS.map(x=>`<option>${x}</option>`).join('')}</select><label>Feedback / Notes</label><textarea id="tssOutcomeNotes" rows="4" placeholder="Client feedback, next round, joining update, reason for rejection, etc."></textarea><div style="font-size:11px;color:#68788a;margin-top:8px">Flow: Scheduled → Completed → Feedback Pending → Result Received → Joining / Closure</div><div class="dialog-actions"><button value="cancel" class="btn ghost">Cancel</button><button type="button" id="tssSaveOutcome" class="btn primary">Save Interview Update</button></div></form>`;
  document.body.appendChild(d);return d;
}

async function updateOutcome(id){
  const c=backend()?.client;if(!c)return toast('Backend not available');
  const {data:iv,error}=await c.from('interviews').select('id,candidate_id,requirement_id,interview_stage,outcome,outcome_notes').eq('id',id).maybeSingle();
  if(error||!iv)return toast('Interview record not found');
  const d=outcomeDialog();d.dataset.id=id;
  $('#tssStageSelect').value=STAGES.includes(iv.interview_stage)?iv.interview_stage:'Scheduled';
  $('#tssOutcomeSelect').value=RESULTS.includes(iv.outcome)?iv.outcome:'Pending';
  $('#tssOutcomeNotes').value=iv.outcome_notes||'';d.showModal();
}

function pipelineFor(outcome){
  if(outcome==='Selected'||outcome==='Offer / Joining Formalities')return 'Final Select';
  if(outcome==='Joined-TSS')return 'Joined-TSS';
  if(['Rejected','Client Rejected','Candidate Declined','No Show'].includes(outcome))return 'Rejected';
  return 'Interview';
}
function statusFor(stage,outcome){
  if(outcome==='No Show')return 'No Show';
  if(outcome==='Reschedule')return 'Scheduled';
  if(outcome==='Hold')return 'On Hold';
  if(['Selected','Rejected','Client Rejected','Candidate Declined','Joined-TSS','Offer / Joining Formalities'].includes(outcome))return 'Completed';
  if(stage==='Client Feedback Pending')return 'Feedback Pending';
  if(stage==='Interview Completed'||stage==='Result Received'||stage==='Joining / Closure')return 'Completed';
  return 'Scheduled';
}

async function saveOutcome(){
  const d=$('#tssOutcomeDialog'),id=d?.dataset.id,c=backend()?.client;if(!id||!c)return;
  const stage=$('#tssStageSelect').value,outcome=$('#tssOutcomeSelect').value,notes=$('#tssOutcomeNotes').value.trim(),now=new Date().toISOString();
  try{
    const {data:iv,error}=await c.from('interviews').update({interview_stage:stage,outcome,outcome_notes:notes,outcome_updated_at:now,status:statusFor(stage,outcome)}).eq('id',id).select('candidate_id,requirement_id').single();
    if(error)throw error;
    const pipeline=pipelineFor(outcome);
    if(iv?.candidate_id&&iv?.requirement_id){
      const {data:s}=await c.from('screenings').select('id').eq('candidate_id',iv.candidate_id).eq('requirement_id',iv.requirement_id).order('screened_at',{ascending:false}).limit(1).maybeSingle();
      if(s?.id)await c.from('screenings').update({recruiter_decision:pipeline}).eq('id',s.id);
    }
    try{
      const user=await backend().currentUser?.();
      if(user)await c.from('activity_logs').insert({actor_id:user.id,action:'Interview stage/result updated',entity_type:'interviews',entity_id:id,details:{stage,outcome,pipeline,management_email_queued:true}});
    }catch{}
    d.close();toast(`Interview updated: ${stage} · ${outcome}`);
    await window.TSSProduction?.hydrate?.();
    setTimeout(()=>window.TSSInterviewActions?.syncStatuses?.(),80);
    setTimeout(decorateInterviewOutcomes,180);
  }catch(e){console.error(e);toast('Could not save interview update: '+(e.message||e))}
}

function decorateInterviewOutcomes(){
  const board=$('#interviewBoard');if(!board)return;
  const rows=[...board.querySelectorAll('tbody tr')];
  rows.forEach((tr,idx)=>{
    const cell=tr.querySelector('[data-ia-actions]');if(!cell||cell.querySelector('.ia-outcome'))return;
    const local=(typeof db!=='undefined'?(db.interviews||[])[idx]:null);
    const id=String(local?.serverId||local?.id||'');if(!id)return;
    const b=document.createElement('button');b.type='button';b.className='ia-btn ia-outcome';b.dataset.iaOutcome=id;b.textContent='Update Interview';cell.prepend(b);
  });
}

function pulse(){normalizeNav();if($('#reportsActivity')?.classList.contains('active'))simplifyReports();if($('#interviews')?.classList.contains('active'))decorateInterviewOutcomes()}
function wire(){
  normalizeNav();
  document.addEventListener('click',e=>{
    const out=e.target.closest('[data-ia-outcome]');if(out){updateOutcome(out.dataset.iaOutcome);return}
    if(e.target.id==='tssSaveOutcome'){saveOutcome();return}
    if(e.target.closest('#reportsNav'))setTimeout(applyReportCleanup,100);
    if(e.target.closest('.nav-item[data-view="interviews"]'))setTimeout(decorateInterviewOutcomes,140);
  });
  setTimeout(()=>{decorateInterviewOutcomes();applyReportCleanup();normalizeNav()},450);
  setInterval(pulse,1200);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
window.TSSWorkflowFinalization={simplifyReports,cleanDuplicateAdmin:normalizeNav,decorateInterviewOutcomes,updateOutcome};
})();