// TODO AI recruitment workflow enhancements: ownership, assignment, database matching and submit actions.
(function(){
  const $=id=>document.getElementById(id);
  const backend=()=>window.TSSBackend;
  const store=()=>typeof db!=='undefined'?db:null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=s=>String(s||'').trim();
  let recruiters=[];
  const ownerNames=current=>[...new Set([current,...recruiters.map(r=>r.name)].filter(Boolean))];

  function toastSafe(m){try{toast(m)}catch{console.log(m)}}
  function reqByKey(key){return (store()?.requirements||[]).find(r=>r.id===key||r.requirementId===key||r.profileKey===key||r.serverId===key)||null}
  function selectedReq(){
    const keys=[$('screenRequirement')?.value,$('topRequirementSelect')?.value];
    for(const k of keys){const r=reqByKey(k);if(r)return r;}
    const title=$('selectedRoleTitle')?.textContent||'';
    return (store()?.requirements||[]).find(r=>title.includes(r.title||''))||null;
  }

  async function loadRecruiters(){
    try{
      const c=backend()?.client;if(!c)return;
      const {data:{session}}=await c.auth.getSession();if(!session?.user)return;
      const {data,error}=await c.from('profiles').select('full_name,email,role,is_active').eq('is_active',true).eq('role','recruiter').order('email');
      if(error)throw error;
      recruiters=(data||[]).map(x=>({email:x.email,name:x.full_name||x.email}));
    }catch(e){console.warn('Recruiter list',e?.message||e);}
    refreshRecruiterOptions();
  }

  function ensureRequirementFields(){
    const form=$('requirementForm');if(!form||$('reqClientOwner'))return;
    const jd=form.querySelector('.jd-actions');if(!jd)return;
    const wrap=document.createElement('div');
    wrap.className='workflow-assignment-grid';
    wrap.innerHTML=`
      <div><label>Client Owner</label><select id="reqClientOwner" required><option value="">Select owner</option>${ownerNames().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></div>
      <div><label>Requirement Handler</label><input id="reqHandler" value="" readonly /></div>
      <div class="workflow-recruiter-field"><label>Assigned Recruiter(s)</label><select id="reqRecruiters" multiple size="3"></select><small>Ctrl/Cmd click to assign more than one recruiter.</small></div>`;
    jd.before(wrap);

    const actions=form.querySelector('.dialog-actions');
    const save=$('saveRequirementBtn');
    if(save){save.textContent='Save Draft';save.classList.add('workflow-save-draft');}
    if(actions&&!$('submitRequirementBtn')){
      const submit=document.createElement('button');
      submit.type='button';submit.id='submitRequirementBtn';submit.className='btn primary workflow-submit-btn';submit.textContent='Submit Requirement';
      actions.appendChild(submit);
    }
    refreshRecruiterOptions();
    observeRequirementDialog();
  }

  function refreshRecruiterOptions(){
    const sel=$('reqRecruiters');if(!sel)return;
    const current=[...sel.selectedOptions].map(o=>o.value);
    sel.innerHTML=recruiters.map(r=>`<option value="${esc(r.email)}">${esc(r.name)} · ${esc(r.email)}</option>`).join('');
    [...sel.options].forEach(o=>o.selected=current.includes(o.value));
  }

  function populateRequirementWorkflow(){
    const id=$('reqId')?.value;const r=reqByKey(id);
    const owner=$('reqClientOwner'),handler=$('reqHandler'),assigned=$('reqRecruiters');
    if(owner){const value=r?.clientOwner||'';if(value&&![...owner.options].some(x=>x.value===value))owner.add(new Option(value,value));owner.value=value}
    if(handler)handler.value=r?.requirementHandler||'';
    if(assigned){
      const vals=Array.isArray(r?.assignedRecruiters)?r.assignedRecruiters:[];
      [...assigned.options].forEach(o=>o.selected=vals.includes(o.value));
    }
  }

  function observeRequirementDialog(){
    const dlg=$('requirementDialog');if(!dlg||dlg.dataset.workflowObserved)return;
    dlg.dataset.workflowObserved='1';
    const obs=new MutationObserver(()=>{if(dlg.open)setTimeout(populateRequirementWorkflow,60)});
    obs.observe(dlg,{attributes:true,attributeFilter:['open']});
  }

  function ensureStyle(){
    if($('recruitmentWorkflowStyle'))return;
    const s=document.createElement('style');s.id='recruitmentWorkflowStyle';s.textContent=`
      .workflow-assignment-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:14px 0 16px;padding:15px;border:1px solid #244761;border-radius:12px;background:#091c2b}.workflow-assignment-grid label{display:block;margin-bottom:6px}.workflow-assignment-grid select,.workflow-assignment-grid input{width:100%;min-height:42px}.workflow-recruiter-field small{display:block;margin-top:5px;color:#829db1}.workflow-submit-btn{min-width:170px}.workflow-strip{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.workflow-chip{font-size:11px;padding:5px 8px;border:1px solid #315b77;border-radius:999px;color:#b8d0e2;background:#0a1e2e}.db-match-btn{background:#123b59!important;border-color:#315f80!important;color:#e9f6ff!important}.db-match-dialog{width:min(1000px,95vw);max-height:88vh;border:1px solid #2c506a;border-radius:16px;background:#071725;color:#eef7ff;padding:0}.db-match-shell{padding:22px}.db-match-tools{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0}.db-match-table{width:100%;border-collapse:collapse;font-size:12px}.db-match-table th,.db-match-table td{padding:11px 9px;border-bottom:1px solid #19354b;text-align:left}.db-match-table th{color:#91abc0;font-weight:600}.match-score{font-weight:800;font-size:15px}.match-strong{color:#79e6ae}.match-review{color:#ffd17a}.match-low{color:#ff9c9c}.candidate-db-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.candidate-db-actions select{min-width:260px}.screen-submit-wrap{display:flex;justify-content:flex-end;margin-top:12px}.workflow-card-buttons{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}@media(max-width:760px){.workflow-assignment-grid{grid-template-columns:1fr}.db-match-table{font-size:11px}}
    `;document.head.appendChild(s);
  }

  function decorateRequirementCards(){
    document.querySelectorAll('#requirementCards .req-card').forEach(card=>{
      const key=card.querySelector('[data-id]')?.dataset.id || card.querySelector('.resdex-card-btn')?.dataset.req;
      if(!key)return;const r=reqByKey(key);if(!r)return;
      if(!card.querySelector('.workflow-strip')){
        const strip=document.createElement('div');strip.className='workflow-strip';
        const assigned=(r.assignedRecruiters||[]).map(x=>recruiters.find(p=>p.email===x)?.name||x).join(', ')||'Unassigned';
        strip.innerHTML=`<span class="workflow-chip">Owner: ${esc(r.clientOwner||'—')}</span><span class="workflow-chip">Handler: ${esc(r.requirementHandler||'—')}</span><span class="workflow-chip">Recruiter: ${esc(assigned)}</span>`;
        const actions=card.querySelector('.card-actions');(actions||card).before?.(strip) || card.appendChild(strip);
      }
      const actions=card.querySelector('.card-actions');
      if(actions&&!card.querySelector('.db-match-btn')){
        const b=document.createElement('button');b.type='button';b.className='btn ghost db-match-btn';b.dataset.matchReq=key;b.textContent='Match Existing DB';actions.prepend(b);
      }
    });
  }

  function ensureGlobalDbMatchActions(){
    const selected=$('selectedRequirementSummary')?.closest('.selected-requirement-card');
    if(selected&&!$('screenExistingDbBtn')){
      const b=document.createElement('button');b.id='screenExistingDbBtn';b.type='button';b.className='btn ghost db-match-btn';b.textContent='Search Existing Candidates';
      selected.appendChild(b);
    }
    const head=$('candidates')?.querySelector('.section-head');
    if(head&&!$('candidateDbMatchControls')){
      const box=document.createElement('div');box.id='candidateDbMatchControls';box.className='candidate-db-actions';
      box.innerHTML=`<select id="candidateDbRequirement"><option value="">Choose requirement for matching</option></select><button id="candidateDbMatchBtn" class="blue-btn" type="button">Match Database</button>`;
      head.appendChild(box);refreshRequirementOptions();
    }
    const result=$('screeningResult');
    if(result&&!$('submitCandidateBtn')){
      const wrap=document.createElement('div');wrap.className='screen-submit-wrap';wrap.id='screenSubmitWrap';
      wrap.innerHTML='<button id="submitCandidateBtn" class="blue-btn" type="button">Submit Candidate</button>';
      result.parentElement?.appendChild(wrap);
    }
  }

  function refreshRequirementOptions(){
    const s=$('candidateDbRequirement');if(!s)return;const old=s.value;
    s.innerHTML='<option value="">Choose requirement for matching</option>'+ (store()?.requirements||[]).map(r=>`<option value="${esc(r.id)}">${esc(r.requirementId||r.id)} · ${esc(r.title)} · ${esc(r.client)}</option>`).join('');
    if([...s.options].some(o=>o.value===old))s.value=old;
  }

  function ensureMatchDialog(){
    if($('dbMatchDialog'))return;
    const d=document.createElement('dialog');d.id='dbMatchDialog';d.className='db-match-dialog';
    d.innerHTML=`<div class="db-match-shell"><div class="dialog-head"><div><span class="purple-label">EXISTING CANDIDATE DATABASE</span><h3 id="dbMatchTitle">Candidate Match</h3></div><button id="closeDbMatch" class="icon-btn">×</button></div><div class="db-match-tools"><input id="dbMatchSearch" placeholder="Search name, skill, location..." /><span id="dbMatchCount"></span></div><div id="dbMatchResults"></div></div>`;
    document.body.appendChild(d);$('closeDbMatch').onclick=()=>d.close();$('dbMatchSearch').addEventListener('input',()=>renderMatchResults());
  }

  let activeMatchReq=null,activeMatches=[];
  function candidateText(c){return [c.name,c.email,c.phone,c.location,c.currentLocation,c.designation,c.currentDesignation,(c.skills||[]).join(' '),c.resumeText].filter(Boolean).join(' ').toLowerCase()}
  function priorScore(c,r){
    const screenings=store()?.screenings||store()?.history||[];
    const cid=c.serverId||c.id,cKeys=[r.serverId,r.id,r.requirementId,r.profileKey].filter(Boolean);
    const s=screenings.find(x=>(x.candidateId===cid||x.candidate_id===cid||x.candidate===cid)&&cKeys.some(k=>x.requirementId===k||x.requirement_id===k||x.requirement===k));
    const score=Number(s?.overall_score??s?.score);return Number.isFinite(score)?score:null;
  }
  function estimateMatch(c,r){
    const prior=priorScore(c,r);if(prior!==null)return {score:Math.round(prior),source:'Previous screening'};
    try{
      if(c.resumeText&&typeof scoreCandidate==='function'){
        const x=scoreCandidate(c.resumeText,r,c);const sc=Number(x?.score);if(Number.isFinite(sc))return {score:Math.round(sc),source:'Resume match'};
      }
    }catch{}
    const hay=candidateText(c);const skills=(r.skills||[]).filter(Boolean);const matched=skills.filter(s=>hay.includes(String(s).toLowerCase()));
    const skillPct=skills.length?matched.length/skills.length*75:35;
    const loc=(r.location&&hay.includes(String(r.location).toLowerCase()))?10:0;
    const title=(r.title&&hay.includes(String(r.title).toLowerCase()))?15:0;
    return {score:Math.max(10,Math.min(95,Math.round(skillPct+loc+title))),source:'Profile match',matched};
  }
  function computeMatches(r){
    const cands=store()?.candidates||[];
    return cands.map(c=>({candidate:c,...estimateMatch(c,r)})).sort((a,b)=>b.score-a.score);
  }
  function recommendation(score){return score>=75?'Strong Match':score>=50?'Review':'Low Match'}
  function renderMatchResults(){
    const q=norm($('dbMatchSearch')?.value).toLowerCase();
    const rows=activeMatches.filter(x=>!q||candidateText(x.candidate).includes(q));
    if($('dbMatchCount'))$('dbMatchCount').textContent=`${rows.length} candidates · ranked for this requirement`;
    const out=$('dbMatchResults');if(!out)return;
    if(!rows.length){out.innerHTML='<div class="empty-state">No candidates found in the existing database.</div>';return;}
    out.innerHTML=`<table class="db-match-table"><thead><tr><th>Candidate</th><th>Experience</th><th>Location</th><th>Match</th><th>Recommendation</th><th>Source</th></tr></thead><tbody>${rows.map(x=>{const c=x.candidate,rec=recommendation(x.score),cls=x.score>=75?'match-strong':x.score>=50?'match-review':'match-low';return `<tr><td><strong>${esc(c.name||'Candidate')}</strong><br><small>${esc(c.email||'')}</small></td><td>${esc(c.totalExperience||c.experience||c.exp||'—')}</td><td>${esc(c.location||c.currentLocation||'—')}</td><td class="match-score ${cls}">${x.score}%</td><td>${esc(rec)}</td><td>${esc(x.source)}</td></tr>`}).join('')}</tbody></table>`;
  }
  function openDatabaseMatch(r){
    if(!r){toastSafe('Select a requirement first');return;}ensureMatchDialog();activeMatchReq=r;activeMatches=computeMatches(r);$('dbMatchTitle').textContent=`${r.requirementId||r.id} · ${r.title} — Existing Candidate Match`;$('dbMatchSearch').value='';renderMatchResults();$('dbMatchDialog').showModal();
  }

  async function submitCandidate(){
    const r=selectedReq();const email=norm($('candidateEmail')?.value).toLowerCase();
    if(!r){toastSafe('Select a requirement first');return;}if(!email){toastSafe('Candidate email is required before submitting');return;}
    const b=backend();if(!b?.enabled){toastSafe('Backend is not ready');return;}
    const btn=$('submitCandidateBtn');if(btn){btn.disabled=true;btn.textContent='Submitting…'}
    try{
      const user=await b.currentUser();if(!user)throw new Error('Please sign in again');
      const c=b.client;
      const cand=await c.from('candidates').select('id,name,email').ilike('email',email).limit(1).maybeSingle();if(cand.error)throw cand.error;if(!cand.data?.id)throw new Error('Screen and save this candidate first');
      const reqId=r.serverId||r.id;
      const sc=await c.from('screenings').select('id').eq('candidate_id',cand.data.id).eq('requirement_id',reqId).order('screened_at',{ascending:false}).limit(1).maybeSingle();if(sc.error)throw sc.error;if(!sc.data?.id)throw new Error('No screening found for this candidate and requirement');
      const up=await c.from('screenings').update({submitted_at:new Date().toISOString(),submitted_by:user.id}).eq('id',sc.data.id);if(up.error)throw up.error;
      toastSafe(`${cand.data.name||'Candidate'} submitted for ${r.title}`);
    }catch(e){console.error(e);toastSafe('Submit failed: '+(e?.message||e));}
    finally{if(btn){btn.disabled=false;btn.textContent='Submit Candidate'}}
  }

  function wireEvents(){
    document.addEventListener('click',e=>{
      const m=e.target.closest?.('[data-match-req]');if(m){e.preventDefault();e.stopPropagation();openDatabaseMatch(reqByKey(m.dataset.matchReq));return;}
      if(e.target.closest?.('#screenExistingDbBtn')){openDatabaseMatch(selectedReq());return;}
      if(e.target.closest?.('#candidateDbMatchBtn')){openDatabaseMatch(reqByKey($('candidateDbRequirement')?.value));return;}
      if(e.target.closest?.('#submitCandidateBtn')){submitCandidate();return;}
    },true);
  }

  function boot(){
    ensureStyle();ensureRequirementFields();ensureMatchDialog();ensureGlobalDbMatchActions();decorateRequirementCards();refreshRequirementOptions();loadRecruiters();wireEvents();
    const cards=$('requirementCards');if(cards&&!cards.dataset.workflowWatch){cards.dataset.workflowWatch='1';new MutationObserver(()=>{decorateRequirementCards();refreshRequirementOptions()}).observe(cards,{childList:true,subtree:true});}
    setTimeout(()=>{decorateRequirementCards();ensureGlobalDbMatchActions();refreshRequirementOptions()},700);
    setTimeout(()=>{decorateRequirementCards();ensureGlobalDbMatchActions();refreshRequirementOptions()},1800);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.TSSRecruitmentWorkflow={boot,openDatabaseMatch,decorateRequirementCards};
})();
