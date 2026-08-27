// TODO AI — Deep AI Screening Engine v1
// Real AI resume extraction (with per-skill ratings) + expert-level screening
// explanations. Falls back safely to the built-in matcher if AI is unreachable.
(function(){
'use strict';
const API='/api/ai-screen';
const $=id=>document.getElementById(id);
const escA=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const toastA=m=>{try{window.toast?window.toast(m):console.log(m)}catch{}};
let aiUp=null,lastExtractHash='';

async function post(body,timeoutMs=90000){
  const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctrl.signal});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.ok&&body.mode!=='ping')throw new Error(j.error||('HTTP '+r.status));
    return j;
  }finally{clearTimeout(t)}
}
async function ping(){
  if(aiUp!==null)return aiUp;
  try{const j=await post({mode:'ping'},6000);aiUp=!!j.ai}catch{aiUp=false}
  return aiUp;
}
function hashText(s){let h=0;for(let i=0;i<s.length;i++)h=((h<<5)-h)+s.charCodeAt(i)|0;return String(h)}
function ratingColor(n){return n>=8?'#22c55e':n>=6?'#84cc16':n>=4?'#f59e0b':'#ef4444'}
function bar(n,max=10){const pct=Math.max(0,Math.min(100,(n/max)*100));return `<i class="ai-skill-bar"><b style="width:${pct}%;background:${ratingColor(max===10?n:n/10)}"></b></i>`}

/* ---------- 1. AI PRECISION EXTRACTION ---------- */
function setField(id,v,force){const e=$(id);if(!e)return;const val=Array.isArray(v)?v.join(', '):String(v??'').trim();if(!val)return;if(force||!e.value.trim())e.value=val}
function renderExtractPanel(d){
  let panel=$('aiExtractPanel');
  if(!panel){
    panel=document.createElement('div');panel.id='aiExtractPanel';panel.className='ai-extract-panel';
    const grid=document.querySelector('.candidate-detail-grid');
    grid?.parentNode?.insertBefore(panel,grid.nextSibling);
  }
  const skills=(d.skills||[]).slice(0,24);
  panel.innerHTML=`
    <div class="ai-panel-head"><span class="ai-chip">⚡ TODO AI · DEEP EXTRACTION</span><b class="ai-conf">${Math.round(d.confidence||0)}% confidence</b></div>
    ${d.summary?`<p class="ai-summary">${escA(d.summary)}</p>`:''}
    ${skills.length?`<div class="ai-skill-grid">${skills.map(s=>`
      <div class="ai-skill-row" title="${escA(s.evidence||'')}">
        <span class="ai-skill-name">${escA(s.skill)}</span>
        ${bar(Number(s.rating)||0)}
        <b class="ai-skill-score" style="color:${ratingColor(Number(s.rating)||0)}">${Number(s.rating)||0}/10${s.years?` · ${s.years}y`:''}</b>
      </div>`).join('')}</div>`:''}
    ${(d.warnings||[]).length?`<div class="ai-warnings">${d.warnings.map(w=>`<span>⚠ ${escA(w)}</span>`).join('')}</div>`:''}`;
}
async function aiExtract(text){
  if(!text||text.trim().length<40)return;
  const h=hashText(text);if(h===lastExtractHash)return;lastExtractHash=h;
  if(!await ping())return;
  toastA('TODO AI is reading the resume in depth…');
  try{
    const j=await post({mode:'extract',resume:text});
    const d=j.data||{};
    setField('candidateName',d.name,true);
    setField('candidateEmail',d.email,true);
    setField('candidatePhone',d.phone,true);
    setField('candidateExp',d.total_experience_years,true);
    setField('candidateLocation',d.location,true);
    setField('candidateDesignation',d.current_designation,true);
    setField('candidateNotice',d.notice_period,false);
    setField('candidateCTC',d.current_ctc,false);
    setField('candidateExpectedCTC',d.expected_ctc,false);
    window.TSS_AI_EXTRACT=d;
    renderExtractPanel(d);
    toastA(`AI extraction complete · ${Math.round(d.confidence||0)}% confidence · ${(d.skills||[]).length} skills rated`);
  }catch(e){console.warn('AI extract failed',e);toastA('AI extraction unavailable — standard extraction kept')}
}
function watchResumeText(){
  let last='',timer=null;
  const check=()=>{
    const t=$('resumeText')?.value||'';
    if(t.length>40&&t===last){clearInterval(timer);timer=null;aiExtract(t)}
    last=t;
  };
  const arm=()=>{if(timer)clearInterval(timer);last='';timer=setInterval(check,700);setTimeout(()=>{if(timer){clearInterval(timer);timer=null}},45000)};
  $('resumeFile')?.addEventListener('change',arm);
  $('resumeText')?.addEventListener('paste',()=>setTimeout(arm,50));
}

/* ---------- 2. AI DEEP SCREENING ---------- */
function dim(d,k){return Math.max(0,Math.min(100,Math.round(Number(d?.dimensions?.[k]?.score)||0)))}
function impactBadge(i){const c=i==='high'?'#ef4444':i==='medium'?'#f59e0b':'#64748b';return `<em style="color:${c};font-style:normal;font-weight:700;text-transform:uppercase;font-size:10px">${escA(i||'')}</em>`}

function renderAIResult(s,c,r){
  const d=s.aiDeep;const m=s.metrics;
  $('screeningEmpty')?.classList.add('hidden');
  const box=$('screeningResult');box.classList.remove('hidden');
  const dims=[['Mandatory Skills','mandatory_skills'],['Preferred Skills','preferred_skills'],['Experience','experience'],['Role Relevance','role_relevance'],['Domain','domain'],['Location','location']];
  box.innerHTML=`
  <div class="result-score">
    <div class="score-ring" style="--score:${s.score*3.6}deg"><strong>${s.score}</strong></div>
    <div>
      <span class="eyebrow">TODO AI · DEEP SCREENING <b class="ai-chip small">⚡ AI</b></span>
      <h3 style="margin:5px 0">${escA(c.name)}</h3>
      ${window.statusBadge?window.statusBadge(s.recommendation):escA(s.recommendation)}
      <p style="color:var(--muted);font-size:12px">${escA(r.client)} · ${escA(r.title)} · AI confidence ${Math.round(d.confidence||0)}%</p>
    </div>
  </div>
  <div class="notes-box ai-exec"><strong>Executive Summary</strong><p>${escA(d.executive_summary||'')}</p></div>
  <div class="metric-grid">${dims.map(([label,k])=>`<div class="metric" title="${escA(d.dimensions?.[k]?.reason||'')}"><small>${label}</small><strong>${dim(d,k)}%</strong><i class="ai-dim-bar"><b style="width:${dim(d,k)}%"></b></i></div>`).join('')}</div>
  ${(d.skill_ratings||[]).length?`<div class="notes-box"><strong>Skill-by-Skill Rating <small style="color:var(--muted)">(hover for evidence)</small></strong>
    <div class="ai-skill-grid">${d.skill_ratings.map(x=>`
      <div class="ai-skill-row" title="${escA(x.evidence||'No evidence found in resume')}">
        <span class="ai-skill-name">${x.required?'<b class="req-dot" title="Mandatory">●</b> ':''}${escA(x.skill)}</span>
        ${bar(Number(x.rating)||0)}
        <b class="ai-skill-score" style="color:${ratingColor(Number(x.rating)||0)}">${Number(x.rating)||0}/10${x.years?` · ${x.years}y`:''}</b>
      </div>`).join('')}</div></div>`:''}
  <div class="ai-two-col">
    <div class="notes-box"><strong>✓ Strengths</strong>${(d.strengths||[]).length?`<ul class="ai-list good">${d.strengths.map(x=>`<li>${escA(x)}</li>`).join('')}</ul>`:'<small>None highlighted</small>'}</div>
    <div class="notes-box"><strong>△ Concerns</strong>${(d.concerns||[]).length?`<ul class="ai-list warn">${d.concerns.map(x=>`<li>${escA(x)}</li>`).join('')}</ul>`:'<small>No major concerns</small>'}</div>
  </div>
  ${(d.missing_skills||[]).length?`<div class="notes-box"><strong>Missing / Weak Skills</strong><div class="ai-missing">${d.missing_skills.map(x=>`<div class="ai-missing-row"><span class="skill ai">${escA(x.skill||x)}</span>${x.impact?impactBadge(x.impact):''}<small>${escA(x.note||'')}</small></div>`).join('')}</div></div>`:''}
  ${(d.red_flags||[]).length?`<div class="notes-box ai-redflags"><strong>🚩 Red Flags</strong><ul class="ai-list bad">${d.red_flags.map(x=>`<li>${escA(x)}</li>`).join('')}</ul></div>`:''}
  ${(d.interview_questions||[]).length?`<div class="notes-box ai-questions"><strong>🎤 Suggested Interview Questions</strong><ol>${d.interview_questions.map(x=>`<li>${escA(x)}</li>`).join('')}</ol></div>`:''}
  ${d.risk_notes?`<div class="notes-box"><strong>🔮 Joining Risk</strong><p>${escA(d.risk_notes)}</p></div>`:''}
  <div class="notes-box"><strong>Final Recommendation</strong><p>${escA(d.recommendation_detail||'')}</p></div>
  <label>Recruiter Notes</label><textarea id="resultNotes" rows="3" placeholder="Add recruiter notes..."></textarea>
  <div class="manual-actions">
    <button class="btn primary decision" data-d="Shortlisted">Shortlist</button>
    <button class="btn ghost decision" data-d="Keep for Future">Keep for Future</button>
    <button class="btn ghost decision" data-d="Request Updated Resume">Request Updated Resume</button>
    <button class="btn ghost decision" data-d="Rejected">Reject</button>
    <button class="btn ghost" id="approveAi">Approve AI Result</button>
    <button class="btn ghost" id="editScore">Edit Score</button>
  </div>`;
  box.querySelectorAll('.decision').forEach(b=>b.onclick=()=>window.updateDecision?.(s.id,b.dataset.d));
  const ap=$('approveAi');if(ap)ap.onclick=()=>window.updateDecision?.(s.id,'AI Result Approved');
  const ed=$('editScore');if(ed)ed.onclick=()=>{const n=prompt('Enter recruiter score (0-100)',s.score);if(n!==null&&!isNaN(n)){s.score=Math.max(0,Math.min(100,Number(n)));s.recommendation=s.score>=75?'Strong Match':s.score>=50?'Review Recommended':'Not Suitable';s.manualOverride=true;s.notes=$('resultNotes')?.value||'';try{saveDB()}catch{}renderAIResult(s,c,r);toastA('Score manually updated')}};
  box.scrollIntoView({behavior:'smooth',block:'start'});
}

function wireScreenButton(){
  const btn=$('screenBtn');if(!btn||btn.dataset.aiWired)return;btn.dataset.aiWired='1';
  const original=btn.onclick;
  btn.onclick=async()=>{
    let r,text;
    try{
      r=db.requirements.find(x=>x.id===$('screenRequirement').value);
      text=$('resumeText').value.trim();
    }catch(e){return original?.()}
    if(!r){toastA('Select requirement');return}
    if(!$('candidateName').value.trim()||!text){toastA('Candidate name and resume text are required');return}
    if(!await ping())return original?.();
    const old=btn.textContent;btn.disabled=true;btn.textContent='⚡ TODO AI analyzing like a senior recruiter…';
    try{
      const payload={name:$('candidateName').value.trim(),email:$('candidateEmail').value.trim(),phone:$('candidatePhone').value.trim(),totalExperience:$('candidateExp').value,location:$('candidateLocation').value.trim(),designation:$('candidateDesignation').value.trim(),noticePeriod:$('candidateNotice').value.trim(),currentCTC:$('candidateCTC').value.trim(),expectedCTC:$('candidateExpectedCTC').value.trim(),resumeText:text,resumeHash:(window.simpleHash||hashText)(text),uploadDate:new Date().toISOString(),uploadedBy:'Recruiter'};
      const j=await post({mode:'screen',resume:text,candidate:payload,requirement:{client:r.client,title:r.title,location:r.location,experience:r.experience,skills:r.skills||[],preferred:r.preferred||[],qualification:r.qualification,responsibilities:r.responsibilities,jdText:r.jdText||''}});
      const d=j.data;
      let c=window.detectDuplicate?.(payload.email,payload.phone,payload.resumeText);
      if(c){Object.assign(c,{...payload,id:c.id,uploadDate:c.uploadDate});toastA('Duplicate candidate detected — existing profile reused')}
      else{c={id:`C${Date.now()}`,...payload};db.candidates.push(c)}
      c.lastScreenedDate=new Date().toISOString();
      if(window.TSS_AI_EXTRACT)c.aiExtract=window.TSS_AI_EXTRACT;
      const metrics={score:d.overall_score,matched:d.matched_skills||[],missing:(d.missing_skills||[]).map(x=>x.skill||x),prefMatched:[],mandatoryPct:dim(d,'mandatory_skills'),prefPct:dim(d,'preferred_skills'),expPct:dim(d,'experience'),domainPct:dim(d,'domain'),locPct:dim(d,'location')};
      const s={id:`S${Date.now()}`,candidateId:c.id,requirementId:r.id,date:new Date().toISOString(),score:d.overall_score,recommendation:d.verdict,matched:metrics.matched,missing:metrics.missing,metrics,aiDeep:d,aiPowered:true,recruiterDecision:'Pending',notes:'',manualOverride:false};
      db.screenings.push(s);
      db.activity.push({date:s.date,title:'AI deep screening',detail:`${c.name} — ${r.title} — ${d.overall_score}/100`});
      try{saveDB()}catch{}
      renderAIResult(s,c,r);
      toastA(`AI deep screening complete · ${d.overall_score}/100 · ${d.verdict}`);
      setTimeout(()=>{try{window.TSSProduction?.persistLatestScreening?.()}catch{}},200);
    }catch(e){
      console.warn('AI screening failed, falling back',e);
      toastA('AI engine unavailable — used standard matching instead');
      original?.();
    }finally{btn.disabled=false;btn.textContent=old}
  };
}

function boot(){wireScreenButton();watchResumeText();ping()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
setTimeout(wireScreenButton,1500);
window.TSSAIScreening={ping,aiExtract,version:'1.0-deep'};
})();
