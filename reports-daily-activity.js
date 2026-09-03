(function(){
  'use strict';

  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const client=()=>window.TSSBackend?.client||null;
  let lastRows=[];

  function localDate(d=new Date()){
    const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const g=t=>p.find(x=>x.type===t)?.value;
    return `${g('year')}-${g('month')}-${g('day')}`;
  }
  function displayDate(v){try{return new Date(v).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric'})}catch{return '-'}}
  function displayTime(v){try{return new Date(v).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit'})}catch{return '-'}}
  function humanAction(v=''){return String(v).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
  function roleLabel(p){return p?.is_super_admin?'Super Admin':p?.role==='admin'?'Admin':'Recruiter'}

  function ensureActivityTab(){
    const root=$('#reportsRoot');
    const tabs=root?.querySelector('.report-tabs');
    if(!root||!tabs)return false;
    let b=tabs.querySelector('button[data-tab="allactivity"]');
    if(!b){
      b=document.createElement('button');
      b.dataset.tab='allactivity';
      b.textContent='All Activity';
      tabs.insertBefore(b,tabs.firstChild);
      b.addEventListener('click',()=>{
        $$('.report-tabs button',root).forEach(x=>x.classList.toggle('active',x===b));
        renderAllActivity();
      });
    }
    return true;
  }

  function setHeading(){
    const root=$('#reportsRoot');
    if(!root)return;
    const h1=root.querySelector('.section-head h1');
    const p=root.querySelector('.section-head p');
    const live=root.querySelector('.report-live-dot');
    if(h1)h1.textContent='Daily Team Activity';
    if(p)p.textContent='Every captured recruiter, admin and Super Admin action is listed below in chronological order.';
    if(live)live.textContent='Live · Every captured action';
    const title=$('#pageTitle'); if(title) title.textContent='Daily Activity';
  }

  async function loadActivity(){
    const c=client(); if(!c) return {rows:[],profiles:[],candidates:[],requirements:[],screenings:[]};
    const root=$('#reportsRoot');
    const start=$('#reportStart',root)?.value||localDate();
    const end=$('#reportEnd',root)?.value||start;
    const [logs,profiles,candidates,requirements,screenings]=await Promise.all([
      c.from('activity_logs').select('*').gte('created_at',start+'T00:00:00+05:30').lte('created_at',end+'T23:59:59+05:30').order('created_at',{ascending:false}).limit(2000),
      c.from('profiles').select('id,full_name,email,role,is_super_admin').order('full_name'),
      c.from('candidates').select('id,candidate_name'),
      c.from('requirements').select('id,tss_id,job_title,clients(name)'),
      c.from('screenings').select('id,candidate_id,requirement_id,overall_score,recruiter_decision').limit(5000)
    ]);
    return {rows:logs.data||[],profiles:profiles.data||[],candidates:candidates.data||[],requirements:requirements.data||[],screenings:screenings.data||[]};
  }

  function readableRow(log,maps){
    const d=log.details||{};
    const p=maps.profiles.get(log.actor_id);
    const screening=maps.screenings.get(log.entity_id);
    const candidateId=d.candidate_id||screening?.candidate_id||(log.entity_type==='candidate'||log.entity_type==='candidates'?log.entity_id:null);
    const requirementId=d.requirement_id||screening?.requirement_id||(log.entity_type==='requirements'?log.entity_id:null);
    const cand=maps.candidates.get(String(candidateId||''));
    const req=maps.requirements.get(String(requirementId||''));
    const clientName=req?.clients?.name||d.client||'-';
    const reqName=req?`${req.tss_id||''}${req.tss_id&&req.job_title?' · ':''}${req.job_title||''}`:(d.tss_id||d.job_title||'-');
    let activity=humanAction(log.action||'Activity');
    if(/resume viewed/i.test(activity))activity='Resume Viewed';
    if(/screening saved/i.test(activity))activity='Screening Saved';
    if(/screening decision updated/i.test(activity))activity='Screening Decision Updated';
    const score=d.score??screening?.overall_score;
    const decision=d.decision??screening?.recruiter_decision;
    const details=[
      score!=null?`Score ${score}%`:'',
      decision?`Decision: ${decision}`:'',
      d.status?`Status: ${d.status}`:'',
      d.detail||'',
      d.operation?`Operation: ${d.operation}`:''
    ].filter(Boolean).join(' · ')||'-';
    return {
      stamp:new Date(log.created_at).getTime(),
      date:displayDate(log.created_at),
      time:displayTime(log.created_at),
      actor:log.actor_id,
      employee:p?.full_name||p?.email||'Team Member',
      role:roleLabel(p),
      activity,
      entity:humanAction(log.entity_type||'Workspace'),
      client:clientName,
      requirement:reqName,
      candidate:cand?.candidate_name||d.candidate_name||'-',
      details
    };
  }

  async function renderAllActivity(){
    const root=$('#reportsRoot'); if(!root)return;
    setHeading();
    const content=$('#reportContent',root); if(!content)return;
    content.innerHTML='<div class="report-panel"><div class="report-empty">Loading every captured activity…</div></div>';
    try{
      const data=await loadActivity();
      const maps={
        profiles:new Map(data.profiles.map(x=>[x.id,x])),
        candidates:new Map(data.candidates.map(x=>[x.id,x])),
        requirements:new Map(data.requirements.map(x=>[x.id,x])),
        screenings:new Map(data.screenings.map(x=>[x.id,x]))
      };
      const employee=$('#reportRecruiter',root)?.value||'';
      const clientQ=($('#reportClient',root)?.value||'').trim().toLowerCase();
      const workQ=($('#reportActivity',root)?.value||'').trim().toLowerCase();
      let rows=data.rows.map(x=>readableRow(x,maps));
      rows=rows.filter(r=>(!employee||r.actor===employee)&&(!clientQ||r.client.toLowerCase().includes(clientQ))&&(!workQ||`${r.activity} ${r.entity} ${r.details}`.toLowerCase().includes(workQ)));
      lastRows=rows;
      const count=rows.length;
      content.innerHTML=`
        <div class="report-panel" style="margin-bottom:14px"><div class="panel-title"><div><h3>Every Captured Activity</h3><p class="report-note">${count} action${count===1?'':'s'} in the selected period. Nothing is deduplicated or hidden from this activity feed.</p></div></div></div>
        <div class="report-panel"><div class="report-table-wrap"><table class="report-table report-auto-table"><thead><tr><th>Date</th><th>Time</th><th>Employee</th><th>Role</th><th>Activity</th><th>Entity</th><th>Client</th><th>Requirement</th><th>Candidate</th><th>Details / Result</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.time)}</td><td><strong>${esc(r.employee)}</strong></td><td>${esc(r.role)}</td><td><strong>${esc(r.activity)}</strong></td><td>${esc(r.entity)}</td><td>${esc(r.client)}</td><td>${esc(r.requirement)}</td><td>${esc(r.candidate)}</td><td>${esc(r.details)}</td></tr>`).join(''):'<tr><td colspan="10" class="report-empty">No captured activity for the selected filters.</td></tr>'}</tbody></table></div></div>`;
    }catch(err){
      console.error('Daily activity report failed',err);
      content.innerHTML='<div class="report-panel"><div class="report-empty">Could not load activity. Please press Refresh.</div></div>';
    }
  }

  function activateAllActivity(){
    const root=$('#reportsRoot'); if(!root)return;
    const date=localDate();
    const start=$('#reportStart',root),end=$('#reportEnd',root);
    if(start)start.value=date; if(end)end.value=date;
    if(!ensureActivityTab())return;
    const b=root.querySelector('.report-tabs button[data-tab="allactivity"]');
    if(b){
      $$('.report-tabs button',root).forEach(x=>x.classList.toggle('active',x===b));
      renderAllActivity();
    }
  }

  document.addEventListener('click',e=>{
    const nav=e.target.closest?.('#reportsNav');
    if(nav){
      [180,450,900].forEach(ms=>setTimeout(activateAllActivity,ms));
      return;
    }
    const refresh=e.target.closest?.('#reportRefresh');
    if(refresh&&$('#reportsRoot .report-tabs button[data-tab="allactivity"].active')){
      e.preventDefault(); e.stopPropagation(); renderAllActivity();
    }
  },true);

  window.TSSDailyActivityReport={openToday:activateAllActivity,refresh:renderAllActivity,getRows:()=>lastRows};
})();
