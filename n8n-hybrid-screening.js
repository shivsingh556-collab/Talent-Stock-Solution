(function(){
  const ENDPOINT='http://localhost:5678/webhook/todo-ai-hybrid-screen';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const nameFromFile=n=>String(n||'').replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\b(cv|resume|profile|updated|latest|final)\b/ig,' ').replace(/\s+/g,' ').trim().replace(/\b\w/g,c=>c.toUpperCase())||'Candidate';
  function status(t,c=''){const e=$('quickScreenStatus');if(e){e.textContent=t;e.className=`quick-screen-status ${c}`.trim()}}
  function req(){try{return (db.requirements||[]).find(r=>String(r.id)===String($('quickRequirement')?.value))||null}catch{return null}}
  function candidateName(file,pasted){return $('candidateName')?.value?.trim()||nameFromFile(file?.name)||(pasted.split(/\r?\n/).map(x=>x.trim()).find(Boolean)||'Candidate').slice(0,70)}
  function basePayload(r,name){return {jobTitle:r.title||'',client:r.client||'',experience:r.experience||'',location:r.location||'',qualification:r.qualification||'',mandatorySkills:r.skills||[],preferredSkills:r.preferred||[],responsibilities:r.responsibilities||'',jdText:r.jdText||'',candidateName:name,totalExperience:$('candidateExp')?.value||'',candidateLocation:$('candidateLocation')?.value||'',designation:$('candidateDesignation')?.value||''}}
  async function callN8N(r,file,pasted){
    const name=candidateName(file,pasted),base=basePayload(r,name),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
    try{
      let options={method:'POST',signal:controller.signal};
      if(pasted){options.headers={'Content-Type':'application/json'};options.body=JSON.stringify({...base,resumeText:pasted})}
      else if(file?.type==='application/pdf'||/\.pdf$/i.test(file?.name||'')){
        const f=new FormData();Object.entries(base).forEach(([k,v])=>f.append(k,Array.isArray(v)?v.join(', '):v));f.append('cv',file,file.name);options.body=f;
      }else throw new Error('UNSUPPORTED_FILE');
      const res=await fetch(ENDPOINT,options);if(!res.ok)throw new Error(`HTTP ${res.status}`);const data=await res.json();if(!data?.ok)throw new Error('Invalid n8n response');return {data,name};
    }finally{clearTimeout(timer)}
  }
  function saveResult(data,r,name){
    try{
      db.candidates=db.candidates||[];db.screenings=db.screenings||[];db.activity=db.activity||[];
      let c=db.candidates.find(x=>String(x.name||'').toLowerCase()===String(name).toLowerCase());
      if(!c){c={id:`C${Date.now()}`,name,email:$('candidateEmail')?.value||'',phone:$('candidatePhone')?.value||'',totalExperience:$('candidateExp')?.value||'',location:$('candidateLocation')?.value||'',designation:$('candidateDesignation')?.value||'',noticePeriod:$('candidateNotice')?.value||'',currentCTC:$('candidateCTC')?.value||'',expectedCTC:$('candidateExpectedCTC')?.value||'',uploadDate:new Date().toISOString(),uploadedBy:'Recruiter'};db.candidates.push(c)}
      const s={id:`S${Date.now()}`,candidateId:c.id,requirementId:r.id,date:new Date().toISOString(),score:Number(data.matchScore)||0,recommendation:data.recommendation||'Review Recommended',matched:data.matchedSkills||[],missing:data.missingSkills||[],metrics:{},recruiterDecision:'Pending',notes:data.summary||'',manualOverride:false,source:'n8n-hybrid',aiDetails:data};db.screenings.push(s);c.lastScreenedDate=s.date;db.activity.push({date:s.date,title:'Candidate screened via n8n',detail:`${name} — ${r.title} — ${s.score}/100`});saveDB();return s;
    }catch(e){console.warn('Could not persist n8n screening',e);return null}
  }
  function render(data,r,name,s){
    const node=$('quickResult');if(!node)return;const cls=data.recommendation==='Strong Match'?'strong':data.recommendation==='Not Suitable'?'weak':'review';node.classList.remove('hidden');
    node.innerHTML=`<div class="quick-result-top"><div class="quick-score" style="--q-score:${Math.max(0,Math.min(100,Number(data.matchScore)||0))*3.6}deg"><strong>${esc(data.matchScore)}/100</strong></div><div class="quick-result-copy"><h3>${esc(name)}</h3><p>${esc(r.title)} · ${esc(r.client)}</p></div><span class="quick-verdict ${cls}">${esc(data.recommendation)}</span></div><div class="quick-ai-summary"><span>N8N + GEMINI VERDICT</span><p>${esc(data.summary||data.decisionReason||'')}</p></div><div class="quick-result-columns"><div class="quick-result-box"><strong>Strengths</strong>${(data.strengths||[]).map(x=>`<p>✓ ${esc(x)}</p>`).join('')}</div><div class="quick-result-box"><strong>Gaps / verify</strong>${(data.gaps||[]).map(x=>`<p>• ${esc(x)}</p>`).join('')||'<p>No major gap flagged.</p>'}</div></div><div class="quick-result-box"><strong>Recruiter questions</strong>${(data.recruiterQuestions||[]).map((x,i)=>`<p>${i+1}. ${esc(x)}</p>`).join('')}</div><div class="quick-next-question"><b>Recommended next action:</b> ${esc(data.recommendedAction||'Recruiter review')}</div><div class="quick-result-actions"><button class="primary" data-n8n-decision="Shortlisted">Shortlist</button><button data-n8n-decision="Keep for Future">Keep for Future</button><button data-n8n-decision="Request Updated Resume">Request Updated Resume</button><button class="danger" data-n8n-decision="Rejected">Reject</button><button id="n8nSchedule">Schedule Interview</button><button id="n8nDetailed">Detailed Mode</button></div>`;
    node.querySelectorAll('[data-n8n-decision]').forEach(b=>b.onclick=()=>{if(!s)return; s.recruiterDecision=b.dataset.n8nDecision;s.manualOverride=true;saveDB();status(`Decision saved: ${b.dataset.n8nDecision}`,'ok')});$('n8nSchedule')?.addEventListener('click',()=>$('scheduleInterview')?.click());$('n8nDetailed')?.addEventListener('click',()=>document.querySelector('.nav-item[data-view="screening"]')?.click());
  }
  async function intercept(e){
    const btn=e.target.closest?.('#quickAnalyseBtn');if(!btn)return;e.preventDefault();e.stopImmediatePropagation();const r=req(),pasted=$('quickResumeText')?.value?.trim()||'',file=$('quickResumeFile')?.files?.[0]||null;if(!r){status('Select a requirement first','bad');return}if(!pasted&&!file){status('Drop a CV or paste resume text','bad');return}
    btn.disabled=true;btn.textContent='Analysing with AI…';status('Sending to local n8n + Gemini…','busy');
    try{const {data,name}=await callN8N(r,file,pasted);const s=saveResult(data,r,name);render(data,r,name,s);status('AI screening complete via n8n','ok')}
    catch(err){console.warn('n8n hybrid unavailable, using built-in screening',err);status('n8n unavailable — using built-in screening','busy');setTimeout(()=>window.TSSQuickScreening?.analyse?.(),50)}
    finally{btn.disabled=false;btn.textContent='Analyse Candidate'}
  }
  function mount(){const b=$('quickAnalyseBtn');if(!b||b.dataset.n8nHybrid)return false;b.dataset.n8nHybrid='1';document.addEventListener('click',intercept,true);return true}
  const t=setInterval(()=>{if(mount())clearInterval(t)},250);
  window.TSSN8NHybrid={endpoint:ENDPOINT};
})();