(function(){
  const byId=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  let quickFile=null;

  function activeRequirements(){
    try{return (db.requirements||[]).filter(r=>['active','work in progress','on hold'].includes(String(r.status||'').trim().toLowerCase()))}catch{return []}
  }
  function selectedRequirement(){
    const id=byId('quickRequirement')?.value;
    try{return (db.requirements||[]).find(r=>String(r.id)===String(id))||null}catch{return null}
  }
  function setStatus(text,cls=''){
    const el=byId('quickScreenStatus'); if(!el)return;
    el.textContent=text; el.className=`quick-screen-status ${cls}`.trim();
  }
  function populateQuickRequirements(){
    const select=byId('quickRequirement'); if(!select)return;
    const current=select.value||byId('screenRequirement')?.value||byId('topRequirementSelect')?.value;
    const items=activeRequirements();
    select.innerHTML=items.map(r=>`<option value="${esc(r.id)}">${esc(r.title)} — ${esc(r.client)}</option>`).join('');
    if(current&&items.some(r=>String(r.id)===String(current)))select.value=current;
  }
  function deriveNameFromFilename(name=''){
    return name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\b(cv|resume|profile|updated|latest|final)\b/ig,' ').replace(/\s+/g,' ').trim().replace(/\b\w/g,c=>c.toUpperCase());
  }
  function syncRequirementToCore(){
    const id=byId('quickRequirement')?.value; if(!id)return;
    const s=byId('screenRequirement'),t=byId('topRequirementSelect');
    if(s){s.value=id;s.dispatchEvent(new Event('change',{bubbles:true}))}
    if(t){t.value=id;t.dispatchEvent(new Event('change',{bubbles:true}))}
  }
  async function feedFileToCore(file){
    const input=byId('resumeFile'); if(!input||!file)return false;
    try{
      const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;
      input.dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    }catch(e){console.warn('Quick screening file handoff failed',e);return false}
  }
  async function waitForExtraction(previousText=''){
    const started=Date.now();
    while(Date.now()-started<10000){
      const text=byId('resumeText')?.value?.trim()||'';
      if(text && text!==previousText)return text;
      await sleep(250);
    }
    return byId('resumeText')?.value?.trim()||'';
  }
  async function waitForScreening(beforeCount){
    const started=Date.now();
    while(Date.now()-started<8000){
      try{if((db.screenings||[]).length>beforeCount)return (db.screenings||[]).at(-1)}catch{}
      await sleep(200);
    }
    try{return (db.screenings||[]).at(-1)||null}catch{return null}
  }
  function summaryFor(s,c,r){
    const m=s?.metrics||{};
    const strengths=[]; const risks=[];
    if((m.mandatoryPct||0)>=75)strengths.push(`${m.mandatoryPct}% mandatory skill coverage`);
    if((m.expPct||0)>=90)strengths.push('experience meets the role requirement');
    if((m.domainPct||0)>=55)strengths.push('good role/domain overlap');
    if((m.locPct||0)>=80)strengths.push('location alignment');
    if((s?.missing||[]).length)risks.push(`${s.missing.length} mandatory skill${s.missing.length===1?'':'s'} not clearly evidenced`);
    if((m.expPct||100)<75)risks.push('experience depth needs verification');
    if((m.locPct||100)<60)risks.push('location/work-mode fit needs confirmation');
    const opening=s?.recommendation==='Strong Match'?'This profile is a strong shortlist candidate.':s?.recommendation==='Review Recommended'?'This profile is worth a recruiter review before submission.':'This profile has meaningful gaps against the selected requirement.';
    return `${opening} The candidate scored ${s?.score??0}/100 for ${r?.title||'the selected role'}. ${strengths.length?`Key strengths: ${strengths.join(', ')}. `:''}${risks.length?`Verify before submission: ${risks.join('; ')}.`:'No major mandatory gap is visible from the available resume evidence.'}`;
  }
  function screeningQuestion(s,r){
    const missing=(s?.missing||[])[0];
    if(missing)return `Can you describe your hands-on experience with ${missing}?`;
    const skill=(r?.skills||[])[0];
    return skill?`Can you describe a recent project where you used ${skill}?`:`Can you walk me through your most relevant experience for ${r?.title||'this role'}?`;
  }
  function renderResult(s){
    if(!s)return;
    let c=null,r=null;
    try{c=(db.candidates||[]).find(x=>String(x.id)===String(s.candidateId));r=(db.requirements||[]).find(x=>String(x.id)===String(s.requirementId))}catch{}
    const node=byId('quickResult'); if(!node)return;
    const cls=s.recommendation==='Strong Match'?'strong':s.recommendation==='Review Recommended'?'review':'weak';
    node.classList.remove('hidden');
    node.innerHTML=`
      <div class="quick-result-top">
        <div class="quick-score" style="--q-score:${Math.max(0,Math.min(100,Number(s.score)||0))*3.6}deg"><strong>${esc(s.score)}/100</strong></div>
        <div class="quick-result-copy"><h3>${esc(c?.name||'Candidate')}</h3><p>${esc(r?.title||'Role')} · ${esc(r?.client||'Client')}</p></div>
        <span class="quick-verdict ${cls}">${esc(s.recommendation)}</span>
      </div>
      <div class="quick-ai-summary"><span>QUICK VERDICT</span><p>${esc(summaryFor(s,c,r))}</p></div>
      <div class="quick-result-columns">
        <div class="quick-result-box"><strong>Matching skills</strong><div class="skill-cloud">${(s.matched||[]).map(x=>`<span class="skill">${esc(x)}</span>`).join('')||'<small>No exact match captured</small>'}</div></div>
        <div class="quick-result-box"><strong>Missing / verify</strong><div class="skill-cloud">${(s.missing||[]).map(x=>`<span class="skill ai">${esc(x)}</span>`).join('')||'<small>No major mandatory gaps</small>'}</div></div>
      </div>
      <div class="quick-next-question"><b>Best recruiter question:</b> ${esc(screeningQuestion(s,r))}</div>
      <div class="quick-result-actions">
        <button class="primary" data-qdecision="Shortlisted">Shortlist</button>
        <button data-qdecision="Keep for Future">Keep for Future</button>
        <button data-qdecision="Request Updated Resume">Request Updated Resume</button>
        <button class="danger" data-qdecision="Rejected">Reject</button>
        <button id="quickScheduleInterview">Schedule Interview</button>
        <button id="quickOpenDetailed">Open Detailed Result</button>
      </div>`;
    node.querySelectorAll('[data-qdecision]').forEach(btn=>btn.addEventListener('click',()=>applyDecision(btn.dataset.qdecision)));
    byId('quickScheduleInterview')?.addEventListener('click',()=>byId('scheduleInterview')?.click());
    byId('quickOpenDetailed')?.addEventListener('click',()=>document.querySelector('.nav-item[data-view="screening"]')?.click());
  }
  function applyDecision(decision){
    const source=document.querySelector(`#screeningResult .decision[data-d="${CSS.escape(decision)}"]`);
    if(source){source.click();setStatus(`Decision saved: ${decision}`,'ok');return}
    try{
      const s=(db.screenings||[]).at(-1); if(!s)return;
      s.recruiterDecision=decision; s.manualOverride=true;
      db.activity=db.activity||[];db.activity.push({date:new Date().toISOString(),title:'Recruiter decision',detail:`${decision} — screening ${s.id}`});
      saveDB();setStatus(`Decision saved: ${decision}`,'ok');
    }catch{setStatus('Could not save decision','bad')}
  }
  async function analyse(){
    const button=byId('quickAnalyseBtn'); if(!button)return;
    const req=selectedRequirement();
    if(!req){setStatus('Select a requirement first','bad');return}
    const pasted=(byId('quickResumeText')?.value||'').trim();
    if(!quickFile&&!pasted){setStatus('Drop a CV or paste resume text','bad');return}
    button.disabled=true;button.textContent='Analysing…';setStatus('Reading candidate profile…','busy');
    syncRequirementToCore();
    const previous=byId('resumeText')?.value||'';
    if(pasted){byId('resumeText').value=pasted}
    if(quickFile){
      const quickName=deriveNameFromFilename(quickFile.name);
      if(byId('candidateName')&&!byId('candidateName').value.trim()&&quickName)byId('candidateName').value=quickName;
      await feedFileToCore(quickFile);
      setStatus('Extracting CV details…','busy');
      await waitForExtraction(previous);
    }
    if(pasted && byId('candidateName')&&!byId('candidateName').value.trim()){
      const first=pasted.split(/\r?\n/).map(x=>x.trim()).find(Boolean)||'';
      if(first.length<70)byId('candidateName').value=first;
    }
    const text=byId('resumeText')?.value?.trim()||'';
    if(!text){button.disabled=false;button.textContent='Analyse Candidate';setStatus('Resume text could not be extracted. Paste the resume text once and try again.','bad');return}
    if(byId('candidateName')&&!byId('candidateName').value.trim())byId('candidateName').value='Candidate';
    const before=(()=>{try{return (db.screenings||[]).length}catch{return 0}})();
    setStatus('Matching skills, experience and role fit…','busy');
    byId('screenBtn')?.click();
    const result=await waitForScreening(before);
    button.disabled=false;button.textContent='Analyse Candidate';
    if(!result){setStatus('Screening did not complete. Open Detailed Mode to review the input.','bad');return}
    renderResult(result);setStatus('Screening complete — no download needed','ok');
  }
  function mount(){
    const dash=byId('dashboard'); if(!dash||byId('quickScreenCard'))return false;
    const anchor=dash.querySelector('.dashboard-title-row');
    if(!anchor)return false;
    const card=document.createElement('article');
    card.id='quickScreenCard';card.className='old-panel quick-screen-card';
    card.innerHTML=`
      <div class="quick-screen-hero">
        <div><span class="quick-screen-kicker">⚡ QUICK SCREENING</span><h2>Drop a CV. Get the full answer.</h2><p>No jumping between pages and no compulsory download. Select the role, add the CV, and get the recruiter-ready verdict here.</p></div>
        <span class="quick-screen-mode">1-screen mode</span>
      </div>
      <div class="quick-screen-body">
        <div class="quick-screen-grid">
          <div class="quick-screen-block"><label>1 · Select requirement</label><select id="quickRequirement" class="quick-screen-select"></select><label for="quickResumeFile" class="quick-screen-drop" id="quickDropZone"><div><strong>2 · Drop candidate CV here</strong><small>PDF, DOCX, TXT or image-supported CV</small><small id="quickFileName" class="quick-screen-file-name"></small></div></label><input id="quickResumeFile" class="quick-screen-file" type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp" /></div>
          <div class="quick-screen-block paste-block"><span class="quick-paste-label">Or paste resume text</span><textarea id="quickResumeText" class="quick-screen-text" placeholder="Paste the resume here if you don't want to upload a file…"></textarea><div class="quick-shortcuts"><button type="button" data-qprompt="fit">Is this candidate fit?</button><button type="button" data-qprompt="gaps">Show skill gaps</button><button type="button" data-qprompt="questions">What should I ask?</button></div></div>
        </div>
        <div class="quick-screen-actions"><button id="quickAnalyseBtn" class="quick-analyse-btn" type="button">Analyse Candidate</button><button id="quickDetailedBtn" class="quick-detailed-btn" type="button">Detailed Mode</button><span id="quickScreenStatus" class="quick-screen-status">Ready</span></div>
        <div id="quickResult" class="quick-result hidden"></div>
      </div>`;
    anchor.insertAdjacentElement('afterend',card);
    populateQuickRequirements();
    byId('quickAnalyseBtn').addEventListener('click',analyse);
    byId('quickDetailedBtn').addEventListener('click',()=>document.querySelector('.nav-item[data-view="screening"]')?.click());
    byId('quickRequirement').addEventListener('change',syncRequirementToCore);
    const input=byId('quickResumeFile'),drop=byId('quickDropZone');
    input.addEventListener('change',()=>{quickFile=input.files?.[0]||null;byId('quickFileName').textContent=quickFile?quickFile.name:'';setStatus(quickFile?'CV ready to analyse':'Ready',quickFile?'ok':'')});
    ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag')}));
    ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('drag')}));
    drop.addEventListener('drop',e=>{quickFile=e.dataTransfer?.files?.[0]||null;if(quickFile){byId('quickFileName').textContent=quickFile.name;setStatus('CV ready to analyse','ok')}});
    document.querySelectorAll('[data-qprompt]').forEach(b=>b.addEventListener('click',()=>{if(!byId('quickResult').classList.contains('hidden'))byId('quickResult').scrollIntoView({behavior:'smooth',block:'nearest'});else setStatus('Add a CV and analyse once — the answer will appear here.','busy')}));
    return true;
  }
  function refresh(){populateQuickRequirements()}
  const timer=setInterval(()=>{if(mount()){clearInterval(timer);setTimeout(refresh,800)}},250);
  window.addEventListener('tss:hydrated',refresh);
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
  window.TSSQuickScreening={refresh,analyse};
})();