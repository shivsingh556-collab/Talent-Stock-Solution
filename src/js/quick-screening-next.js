(function(){
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let lastSignature='';
  function latest(){try{return (db.screenings||[]).at(-1)||null}catch{return null}}
  function candidateFor(s){try{return (db.candidates||[]).find(c=>String(c.id)===String(s?.candidateId))||null}catch{return null}}
  function requirementFor(s){try{return (db.requirements||[]).find(r=>String(r.id)===String(s?.requirementId))||null}catch{return null}}
  function details(s){return s?.aiDetails||{}}
  function text(v,fallback='Needs verification'){return String(v||fallback)}
  function riskText(s,d){
    const risks=[...(d.redFlags||[]),...(d.gaps||[])];
    if(!risks.length&&(s?.missing||[]).length)risks.push(`${s.missing.length} mandatory skill(s) are not clearly evidenced.`);
    return risks[0]||'No major red flag detected from the available resume evidence.';
  }
  function brief(s,c,r,d){
    const strengths=(d.strengths||[]).slice(0,2).join(' ');
    const gaps=(d.gaps||[]).slice(0,1).join(' ');
    const opening=`${c?.name||'Candidate'} scored ${s?.score||0}/100 for ${r?.title||'the role'} and is marked ${s?.recommendation||'for review'}.`;
    return [opening,strengths,gaps?`Key verification point: ${gaps}`:''].filter(Boolean).join(' ');
  }
  async function copyText(value,button,label='Copied'){
    try{await navigator.clipboard.writeText(value);const old=button.textContent;button.textContent=label;button.classList.add('quick-copy-ok');setTimeout(()=>{button.textContent=old;button.classList.remove('quick-copy-ok')},1400)}catch{button.textContent='Copy failed'}
  }
  function resetQuick(){
    const file=$('quickResumeFile'),paste=$('quickResumeText'),result=$('quickResult'),name=$('candidateName');
    if(file)file.value='';if(paste)paste.value='';if(result){result.innerHTML='';result.classList.add('hidden')}if(name)name.value='';
    const fn=$('quickFileName');if(fn)fn.textContent='';
    const st=$('quickScreenStatus');if(st){st.textContent='Ready for next candidate';st.className='quick-screen-status ok'}
    $('quickScreenCard')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function addEnhancements(){
    const node=$('quickResult'),s=latest();if(!node||node.classList.contains('hidden')||!s)return;
    const sig=`${s.id}-${s.score}-${s.recommendation}`;if(sig===lastSignature&&node.querySelector('.quick-copilot-bar'))return;lastSignature=sig;
    const c=candidateFor(s),r=requirementFor(s),d=details(s);
    const fitValues=[['Experience',text(d.experienceFit,s.metrics?.expPct!=null?`${s.metrics.expPct}% match`:undefined)],['Location',text(d.locationFit,s.metrics?.locPct!=null?`${s.metrics.locPct}% match`:undefined)],['Qualification',text(d.qualificationFit)],['Rating',d.rating?`${d.rating}/5`:s.score>=80?'Strong':s.score>=55?'Review':'Weak']];
    const top=node.querySelector('.quick-ai-summary')||node.querySelector('.quick-result-top');
    if(top&&!node.querySelector('.quick-fit-grid'))top.insertAdjacentHTML('afterend',`<div class="quick-fit-grid">${fitValues.map(([k,v])=>`<div class="quick-fit-card"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>`);
    const briefText=brief(s,c,r,d);
    const actions=node.querySelector('.quick-result-actions');
    if(actions&&!node.querySelector('.quick-submission-brief'))actions.insertAdjacentHTML('beforebegin',`<div class="quick-risk-line"><b>Verify before client submission:</b> ${esc(riskText(s,d))}</div><div class="quick-submission-brief"><div class="quick-submission-brief-head"><span>CLIENT-SUBMISSION READY BRIEF</span><button type="button" id="quickCopyBrief">Copy Summary</button></div><p>${esc(briefText)}</p></div><div class="quick-copilot-bar"><b>Recruiter Copilot</b><button type="button" data-copy="questions">Copy Screening Questions</button><button type="button" data-copy="whatsapp">Copy WhatsApp Summary</button><button type="button" data-copy="reason">Why this score?</button></div>`);
    if(actions&&!actions.querySelector('.quick-new-screen'))actions.insertAdjacentHTML('beforeend','<button type="button" class="quick-new-screen">＋ New Screening</button>');
    const copyBrief=$('quickCopyBrief');if(copyBrief)copyBrief.onclick=()=>copyText(briefText,copyBrief,'Copied ✓');
    node.querySelectorAll('[data-copy]').forEach(btn=>btn.onclick=()=>{
      const type=btn.dataset.copy;
      const questions=(d.recruiterQuestions||[]).length?(d.recruiterQuestions||[]).map((q,i)=>`${i+1}. ${q}`).join('\n'):`1. ${s.missing?.[0]?`Please explain your hands-on experience with ${s.missing[0]}.`:`Walk me through your most relevant experience for ${r?.title||'this role'}.`}`;
      const value=type==='questions'?questions:type==='whatsapp'?`${c?.name||'Candidate'} | ${r?.title||'Role'} | Match: ${s.score}/100 | ${s.recommendation}. ${d.summary||briefText}`:`Score ${s.score}/100. ${d.decisionReason||d.summary||briefText}`;
      copyText(value,btn,'Copied ✓');
    });
    node.querySelector('.quick-new-screen')?.addEventListener('click',resetQuick);
  }
  function mountTip(){const body=$('quickScreenCard')?.querySelector('.quick-screen-body');if(body&&!body.querySelector('.quick-screen-tip'))body.insertAdjacentHTML('beforeend','<div class="quick-screen-tip">Tip: press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to analyse instantly.</div>')}
  const observer=new MutationObserver(()=>{addEnhancements();mountTip()});
  const timer=setInterval(()=>{const card=$('quickScreenCard'),result=$('quickResult');if(card&&result){clearInterval(timer);observer.observe(result,{childList:true,subtree:true});mountTip();addEnhancements()}},250);
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!$('quickAnalyseBtn')?.disabled){e.preventDefault();$('quickAnalyseBtn')?.click()}});
  window.TSSQuickScreeningNext={refresh:addEnhancements,reset:resetQuick};
})();