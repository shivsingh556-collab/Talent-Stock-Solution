// Broad, deterministic TODO AI recruiter copilot for common TSS questions, navigation and safe recruiter actions.
(function(){
  'use strict';
  const $=s=>document.querySelector(s), E=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const N=v=>String(v??'').toLowerCase().replace(/[^a-z0-9+#. ]/g,' ').replace(/\s+/g,' ').trim();
  const data=()=>{try{return typeof db!=='undefined'?db:null}catch{return null}};
  const reqs=()=>data()?.requirements||[], cands=()=>data()?.candidates||[], screens=()=>data()?.screenings||[], ints=()=>data()?.interviews||[];
  let mode='help';

  function resultBox(){let out=$('.todo-help .todo-ai-results');if(!out){out=document.createElement('div');out.className='todo-ai-results';$('.todo-help')?.appendChild(out)}return out}
  function say(html){const out=resultBox();if(out)out.innerHTML=`<div class="todo-ai-msg">${html}</div>`}
  function openView(v){document.querySelector(`.nav-item[data-view="${v}"]`)?.click()}
  function currentReq(){const id=$('#screenRequirement')?.value||$('#topRequirementSelect')?.value;return reqs().find(r=>String(r.id)===String(id))||reqs().find(r=>/work in progress|active/i.test(r.status||''))||reqs()[0]}
  function byReq(q){const n=N(q);return reqs().find(r=>n.includes(N(r.id))||n.includes(N(r.requirementId)))||reqs().find(r=>n.includes(N(r.title))&&N(r.title).length>3)||reqs().find(r=>n.includes(N(r.client))&&N(r.client).length>3)||currentReq()}
  function byCand(q){const n=N(q);return cands().find(c=>n.includes(N(c.name))&&N(c.name).length>2)||cands().find(c=>c.email&&n.includes(N(c.email)))||cands().find(c=>n.includes(N(c.id)))}
  function counts(){const r=reqs(),s=screens(),i=ints();const w=r.filter(x=>/work in progress|active/i.test(x.status||'')).length,h=r.filter(x=>/on hold/i.test(x.status||'')).length,f=r.filter(x=>/fulfilled/i.test(x.status||'')).length;return {r:r.length,w,h,f,c:cands().length,s:s.length,i:i.length,review:s.filter(x=>x.recommendation==='Review Recommended').length,strong:s.filter(x=>x.recommendation==='Strong Match').length}}
  function guide(topic){const guides={screen:'Go to Screening, select the exact requirement, upload the candidate CV, verify extracted details, then run Screen & Rank. The result shows match score, evidence, gaps and recruiter actions.',candidate:'Candidate Records stores saved candidate profiles and CV history. You can search by name, email, phone, location, designation or skill.',duplicate:'A duplicate alert is triggered when the same candidate is already stored, typically by email or phone, so you do not create duplicate profiles.',interview:'Open Interviews → Schedule Interview. Select the saved candidate and exact requirement/position, then date, time, mode and interview details. Confirmation and reminder emails are queued automatically.',requirement:'Requirements is the master place to add or edit client requirements, JD, owner, handler, recruiters, positions and status.',owner:'Client Owner is mapped client-wise. Once an owner is saved for a client, the same owner is automatically applied to that client’s requirements.',assignment:'When a recruiter is assigned to a requirement, the recruiter receives an assignment email. New assignments are tracked separately and acknowledgement can be recorded.',ack:'The recruiter clicks Acknowledge Assignment in the assignment email. TODO AI then shows whether the assignment is Pending acknowledgement or Acknowledged.',email:'Interview confirmations, reminders and requirement assignment alerts are sent through Microsoft Graph from the configured TSS mailbox. Sent/failed events are tracked by the backend.',reminder:'Interview reminders are queued for 10:00 AM on interview day, 1 hour before, 30 minutes before and 5 minutes before. Reschedule or cancellation updates the reminder flow.',score:'The screening score compares the candidate against the selected requirement using mandatory/preferred skills, experience, title relevance, responsibilities/domain evidence and location. Always review evidence, not just the number.',reschedule:'If a candidate requests reschedule from the email, TODO AI records Reschedule Requested and the candidate’s preferred date/time. The recruiter can then confirm a revised slot.',pipeline:'Pipeline stages help track candidate progress such as shortlisted, interview, final select and joined. Use recruiter actions on the candidate/screening record to update stage.',ctc:'Current CTC, Expected CTC, Notice Period, Current Location, interview availability and relevant experience are common screening questions for every candidate.',report:'Use Master Excel / exports for consolidated recruitment data and screening records. Candidate and requirement data remain linked to their exact records.'};return guides[topic]}

  function selectRequirement(raw){
    const r=byReq(raw);if(!r)return false;
    const id=String(r.id||r.requirementId||'');
    const screen=$('#screenRequirement'),top=$('#topRequirementSelect');
    if(screen&&[...screen.options].some(o=>String(o.value)===id)){screen.value=id;screen.dispatchEvent(new Event('change',{bubbles:true}))}
    if(top&&[...top.options].some(o=>String(o.value)===id)){top.value=id;top.dispatchEvent(new Event('change',{bubbles:true}))}
    openView('screening');
    return r;
  }

  function safeAction(raw){
    const q=N(raw);if(!q)return say('<b>Type an action.</b><br>Example: “Open Interviews” or “Select TSS055 for screening”.');
    if(/open .*screen|go to .*screen|start .*screen/.test(q)){openView('screening');return say('✅ Opened <b>Screening</b>.')}
    if(/open .*candidate|go to .*candidate/.test(q)){openView('candidates');return say('✅ Opened <b>Candidate Records</b>.')}
    if(/open .*interview|go to .*interview/.test(q)){openView('interviews');return say('✅ Opened <b>Interviews</b>.')}
    if(/open .*requirement|go to .*requirement|open .*job profile/.test(q)){openView('requirements');return say('✅ Opened <b>Requirements</b>.')}
    if(/select .*tss|screen .*tss|requirement .*tss|select .*requirement/.test(q)){
      const r=selectRequirement(raw);if(!r)return say('I could not find that requirement. Use the exact TSS ID, client or role.');
      return say(`✅ Selected <b>${E(r.requirementId||r.id)} · ${E(r.client)} — ${E(r.title)}</b> and opened Screening.`)
    }
    if(/schedule .*interview|new interview/.test(q)){
      openView('interviews');setTimeout(()=>$('#scheduleInterview')?.click(),120);
      return say('✅ Opened <b>Schedule Interview</b>. Review candidate, requirement, date and time before saving.')
    }
    if(/final select|joined|rejected|hold|submit.*client|shortlist|pipeline/.test(q)){
      const c=byCand(raw);
      const who=c?` for <b>${E(c.name)}</b>`:'';
      return say(`⚠️ This changes recruitment data${who}. TODO AI will not silently modify a candidate record. Open the candidate/interview record, choose the exact stage and confirm the update there.`)
    }
    return say('<b>Safe Commands can perform navigation and setup actions.</b><br>Try: “Open Screening”, “Select TSS055 for screening”, “Open Interviews”, or “Schedule interview”. Data-changing pipeline actions still require an explicit confirmation in the relevant record.');
  }

  function answer(raw){const q=N(raw);if(!q)return;if(mode==='safe')return safeAction(raw);
    if(/^(hi|hello|hey|hii|hiii|good morning|good afternoon|good evening|namaste)\b/.test(q))return say('<b>Hi! I’m Todo AI.</b><br>Ask me about candidates, requirements, screening, interviews, email alerts, recruiter assignments, acknowledgements, client owners, pipeline or reports.');
    if(/what can you do|help|commands|how can you help/.test(q))return say('<b>I can help with:</b><ul><li>Requirements & JD workflow</li><li>Candidate search and screening</li><li>Scores, gaps and duplicate alerts</li><li>Interview scheduling, confirmation and reschedule flow</li><li>Email reminders and assignment alerts</li><li>Client owner / recruiter assignment / acknowledgement</li><li>Pipeline and recruitment summary</li><li>Opening the correct TODO AI section</li></ul><small>Try: “How do I schedule interview?”, “Show requirement TSS055”, “How many candidates?”, “What is acknowledgement?”</small>');
    const c=counts();
    if(/recruitment summary|dashboard summary|today summary|give.*summary/.test(q))return say(`<b>Recruitment summary</b><ul><li>${c.r} requirements total</li><li>${c.w} work in progress · ${c.h} on hold · ${c.f} fulfilled</li><li>${c.c} saved candidates</li><li>${c.s} screenings · ${c.strong} strong matches · ${c.review} need review</li><li>${c.i} interviews saved</li></ul>`);
    if(/how many.*candidate|candidate count|number of candidates/.test(q))return say(`<b>${c.c}</b> saved candidates are currently available in TODO AI.`);
    if(/how many.*requirement|requirement count|number of requirements/.test(q))return say(`<b>${c.r}</b> requirements total: ${c.w} work in progress, ${c.h} on hold and ${c.f} fulfilled.`);
    if(/how many.*interview|interview count/.test(q))return say(`<b>${c.i}</b> interviews are currently saved.`);
    if(/open .*screen|go to .*screen/.test(q)){openView('screening');return say('Opened <b>Screening</b>.')}
    if(/open .*candidate|go to .*candidate/.test(q)){openView('candidates');return say('Opened <b>Candidate Records</b>.')}
    if(/open .*interview|go to .*interview/.test(q)){openView('interviews');return say('Opened <b>Interviews</b>.')}
    if(/open .*requirement|go to .*requirement|open .*job profile/.test(q)){openView('requirements');return say('Opened <b>Requirements</b>.')}
    if(/show.*requirement|jd for|requirement details|job profile/.test(q)){const r=byReq(q);if(!r)return say('I could not find that requirement. Try the TSS ID, client name or role.');return say(`<b>${E(r.requirementId||r.id)} · ${E(r.client)} — ${E(r.title)}</b><ul><li>Status: ${E(r.status||'Not set')}</li><li>Location: ${E(r.location||'Not provided')}</li><li>Experience: ${E(r.experience||'Not provided')}</li><li>Owner: ${E(r.clientOwner||'Not assigned')}</li><li>Mandatory skills: ${E((r.skills||[]).join(', ')||'Not confirmed')}</li><li>Preferred skills: ${E((r.preferred||[]).join(', ')||'Not confirmed')}</li></ul>`)}
    if(/show.*candidate|candidate details|find candidate/.test(q)){const x=byCand(q);if(x)return say(`<b>${E(x.name)}</b><ul><li>Email: ${E(x.email||'—')}</li><li>Phone: ${E(x.phone||'—')}</li><li>Location: ${E(x.location||'—')}</li><li>Designation: ${E(x.designation||'—')}</li><li>Experience: ${E(x.totalExperience||'—')}</li></ul>`);return say('Mention the candidate name, email or candidate ID and I’ll look in saved Candidate Records.')}
    if(/duplicate/.test(q))return say(guide('duplicate'));
    if(/acknowledge|acknowledgement|acknowledgment/.test(q))return say(guide('ack'));
    if(/assign.*recruiter|recruiter assignment|assigned recruiter/.test(q))return say(guide('assignment'));
    if(/client owner|account owner|owner mapping/.test(q))return say(guide('owner'));
    if(/reschedule/.test(q))return say(guide('reschedule'));
    if(/reminder/.test(q))return say(guide('reminder'));
    if(/email|mail alert|mail notification/.test(q))return say(guide('email'));
    if(/schedule.*interview|how.*interview|interview process/.test(q))return say(guide('interview'));
    if(/screen.*cv|screen.*resume|how.*screen|screening process/.test(q))return say(guide('screen'));
    if(/score|match score|why.*low|why.*high/.test(q))return say(guide('score'));
    if(/requirement|jd/.test(q))return say(guide('requirement'));
    if(/pipeline|stage|final select|joined/.test(q))return say(guide('pipeline'));
    if(/current ctc|expected ctc|notice period|availability question|screening question/.test(q))return say(guide('ctc'));
    if(/report|excel|export/.test(q))return say(guide('report'));
    if(/candidate/.test(q))return say(guide('candidate'));
    return say(`<b>I can help with that inside the recruitment workflow.</b><br>For the clearest result, include the candidate name, TSS requirement ID, client, role or action you want.<small>Examples: “Show TSS055”, “How do I reschedule an interview?”, “What is recruiter acknowledgement?”, “How many candidates?”, “Open interviews”.</small>`);
  }

  function setMode(next){
    mode=next;
    const help=$('.todo-help');if(!help)return;
    const tabs=[...help.querySelectorAll('.todo-tabs button')];
    tabs.forEach((b,i)=>b.classList.toggle('active',(next==='help'&&i===0)||(next==='safe'&&i===1)));
    const p=help.querySelector(':scope > p');
    const input=help.querySelector('.todo-command input');
    const chips=help.querySelector('.chips');
    const small=help.querySelector(':scope > small');
    if(next==='safe'){
      if(p)p.textContent='Run controlled recruiter actions. Navigation happens immediately; data-changing actions require confirmation.';
      if(input)input.placeholder='Try: Select TSS055 for screening';
      if(chips)chips.innerHTML='<button>Open Screening</button><button>Open Requirements</button><button>Schedule interview</button><button>Open Candidates</button>';
      if(small)small.textContent='Safe Commands never silently change candidate or requirement data.';
      say('<b>Safe Commands is active.</b><br>Try an action such as “Open Screening” or “Select TSS055 for screening”.');
    }else{
      if(p)p.textContent='Ask me to find candidates, explain scores, open profiles, schedule interviews, or understand TSS workflows.';
      if(input)input.placeholder='How do I screen a CV?';
      if(chips)chips.innerHTML='<button>How do I screen a CV?</button><button>What is a duplicate alert?</button><button>How do I submit a candidate to a client?</button><button>How do I schedule an interview?</button>';
      if(small)small.textContent='Help mode explains and guides. Use Safe Commands for controlled actions.';
      say('<b>Todo AI help is active.</b><br>Ask a recruitment question or use one of the quick prompts.');
    }
    wireChips();
  }

  function wireChips(){
    const input=$('.todo-command input');if(!input)return;
    document.querySelectorAll('.todo-help .chips button').forEach(b=>{b.onclick=e=>{e.preventDefault();e.stopPropagation();input.value=b.textContent||'';answer(input.value)}})
  }
  function wire(){
    const input=$('.todo-command input'),btn=$('.todo-command button');if(!input||!btn)return;
    btn.onclick=e=>{e.preventDefault();e.stopPropagation();answer(input.value)};
    input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();answer(input.value)}};
    const tabs=[...document.querySelectorAll('.todo-help .todo-tabs button')];
    if(tabs[0]){tabs[0].textContent='Todo AI';tabs[0].onclick=e=>{e.preventDefault();setMode('help')}}
    if(tabs[1]){tabs[1].textContent='Safe Commands';tabs[1].onclick=e=>{e.preventDefault();setMode('safe')}}
    wireChips();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(wire,250),{once:true});else setTimeout(wire,250);
  window.addEventListener('load',()=>setTimeout(wire,600),{once:true});
  window.TSSTodoChatbot={answer,wire,setMode,safeAction};
})();