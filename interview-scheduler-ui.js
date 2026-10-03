(function(){
  const DB=()=>typeof db!=='undefined'?db:null;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=v=>String(v||'').trim().toLowerCase();
  let open=false,submitting=false,pendingSubmission=null;
  let candidateOptions=[],candidateMatches=[],selectedCandidateKey='',activeCandidate=-1;

  function candidates(){
    const store=DB();
    return (store?.candidates||[]).slice().sort((a,b)=>String(a.name||a.candidate_name||'').localeCompare(String(b.name||b.candidate_name||'')));
  }
  function requirements(){
    const store=DB();
    return (store?.requirements||[]).filter(r=>!['closed','fulfilled'].includes(norm(r.status))).slice().sort((a,b)=>`${a.client} ${a.title}`.localeCompare(`${b.client} ${b.title}`));
  }
  function reqKey(r){return String(r.serverId||r.id||r.profileKey||'')}
  function candKey(c){return String(c.serverId||c.id||c.email||c.name||'')}
  function formatReq(r){return `${r.id||''} · ${r.title||'Position'} — ${r.client||'Client'}`}
  function emailOf(c){return c?.email||c?.candidate_email||''}
  function nameOf(c){return c?.name||c?.candidate_name||'Candidate'}

  function ensureModal(){
    if($('tssInterviewSchedulerModal'))return;
    const wrap=document.createElement('div');
    wrap.id='tssInterviewSchedulerModal';
    wrap.className='tss-is-modal hidden';
    wrap.innerHTML=`<div class="tss-is-card" role="dialog" aria-modal="true" aria-labelledby="tssIsTitle">
      <div class="tss-is-head"><div><small>TODO AI · INTERVIEW OPERATIONS</small><h2 id="tssIsTitle">Schedule Interview</h2></div><button type="button" data-is-close aria-label="Close">×</button></div>
      <div class="tss-is-grid">
        <div class="tss-is-full tss-is-candidate-field"><label for="tssIsCandidate"><span>Candidate <b>*</b></span></label><div class="tss-is-combobox"><input id="tssIsCandidate" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="tssIsCandidateOptions" aria-describedby="tssIsCandidateMeta" autocomplete="off" placeholder="Select or type to search candidate…"><div id="tssIsCandidateOptions" role="listbox" aria-label="Saved candidates" hidden></div></div><small id="tssIsCandidateMeta"></small></div>
        <label class="tss-is-full"><span>Position / Requirement <b>*</b></span><select id="tssIsRequirement"></select><small id="tssIsReqMeta"></small></label>
        <label><span>Date <b>*</b></span><input id="tssIsDate" type="date"></label>
        <label><span>Time <b>*</b></span><input id="tssIsTime" type="time" value="11:00"></label>
        <label><span>Mode</span><select id="tssIsMode"><option>Client Interview</option><option>Video Interview</option><option>Telephonic Interview</option><option>Face to Face</option></select></label>
        <label><span>Interviewer</span><input id="tssIsInterviewer" placeholder="Optional"></label>
        <label class="tss-is-full"><span>Interview Link / Location</span><input id="tssIsLocation" placeholder="Teams/Meet link or office location"></label>
        <label class="tss-is-full"><span>Notes</span><textarea id="tssIsNotes" rows="3" placeholder="Optional instructions"></textarea></label>
      </div>
      <div class="tss-is-warning">The confirmation email will use the exact candidate and requirement selected here. Please verify both before scheduling.</div>
      <div class="tss-is-actions"><button type="button" data-is-close class="secondary">Cancel</button><button type="button" id="tssIsSubmit">Schedule & Send Confirmation</button></div>
    </div>`;
    document.body.appendChild(wrap);
    const style=document.createElement('style');
    style.textContent=`.tss-is-modal{position:fixed;inset:0;z-index:100000;background:rgba(2,11,20,.76);display:grid;place-items:center;padding:22px}.tss-is-modal.hidden{display:none}.tss-is-card{width:min(760px,96vw);max-height:92vh;overflow:auto;background:#0c2235;border:1px solid #2e5878;border-radius:18px;box-shadow:0 28px 80px rgba(0,0,0,.45);color:#eef7ff;padding:24px}.tss-is-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:20px}.tss-is-head small{color:#65bfff;font-weight:800;letter-spacing:1.4px}.tss-is-head h2{margin:6px 0 0;font-size:25px}.tss-is-head button{border:0;background:transparent;color:#bdd5e7;font-size:30px;cursor:pointer}.tss-is-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.tss-is-grid label{display:flex;flex-direction:column;gap:7px}.tss-is-grid label span{font-weight:750;font-size:13px;color:#d5e7f5}.tss-is-grid label span b{color:#ff9b9b}.tss-is-grid input,.tss-is-grid select,.tss-is-grid textarea{width:100%;box-sizing:border-box;border:1px solid #315b79;border-radius:10px;background:#081a29;color:#f5fbff;padding:11px 12px;font:inherit;outline:none}.tss-is-grid input:focus,.tss-is-grid select:focus,.tss-is-grid textarea:focus{border-color:#35a8ff;box-shadow:0 0 0 3px rgba(53,168,255,.12)}.tss-is-grid label small{min-height:16px;color:#8fb2ca;font-size:11px}.tss-is-full{grid-column:1/-1}.tss-is-warning{margin-top:16px;padding:11px 13px;border-radius:10px;background:#102f46;border:1px solid #2e648b;color:#bcdcf2;font-size:12px;line-height:1.45}.tss-is-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.tss-is-actions button{border:1px solid #1987d8;background:#1987d8;color:white;border-radius:10px;padding:11px 16px;font-weight:800;cursor:pointer}.tss-is-actions button:disabled{opacity:.6;cursor:wait}.tss-is-actions button.secondary{background:transparent;border-color:#3a6079;color:#c6d9e7}@media(max-width:700px){.tss-is-grid{grid-template-columns:1fr}.tss-is-full{grid-column:auto}.tss-is-card{padding:18px}}`;
    document.head.appendChild(style);
    wrap.addEventListener('click',e=>{if(e.target===wrap||e.target.closest('[data-is-close]'))closeModal()});
    const comboStyle=document.createElement('style');
    comboStyle.textContent=`.tss-is-candidate-field{display:flex;flex-direction:column;gap:7px}.tss-is-candidate-field>small{min-height:16px;color:#8fb2ca;font-size:11px}.tss-is-combobox{position:relative}.tss-is-combobox [role=listbox]{position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:10;max-height:240px;overflow:auto;background:#081a29;border:1px solid #315b79;border-radius:10px;box-shadow:0 12px 28px rgba(0,0,0,.4)}.tss-is-combobox [role=option]{padding:10px 12px;cursor:pointer;overflow-wrap:anywhere}.tss-is-combobox [role=option]:hover,.tss-is-combobox [role=option].active{background:#174668}.tss-is-combobox [role=option][aria-selected=true]{box-shadow:inset 3px 0 #35a8ff}.tss-is-combobox [role=option] strong{display:block;font-size:13px}.tss-is-combobox [role=option] small{display:block;color:#a9c9df;font-size:11px;margin-top:3px}.tss-is-candidate-empty{padding:12px;color:#a9c9df;font-size:12px}`;
    document.head.appendChild(comboStyle);
    const input=$('tssIsCandidate'),options=$('tssIsCandidateOptions');
    input.addEventListener('focus',()=>{input.select();showCandidates(selectedCandidateKey?'':input.value)});
    input.addEventListener('click',()=>{if(selectedCandidateKey)input.select();showCandidates(selectedCandidateKey?'':input.value)});
    input.addEventListener('input',()=>{selectedCandidateKey='';pendingSubmission=null;updateCandidateMeta();showCandidates(input.value)});
    input.addEventListener('blur',hideCandidates);
    input.addEventListener('keydown',candidateKeydown);
    options.addEventListener('pointerdown',e=>{if(e.target.closest('[role=option]'))e.preventDefault()});
    options.addEventListener('click',e=>{const option=e.target.closest('[role=option]');if(option)chooseCandidate(Number(option.dataset.index))});
    $('tssIsRequirement')?.addEventListener('change',updateReqMeta);
    $('tssIsSubmit')?.addEventListener('click',submit);
  }

  function hideCandidates(){const input=$('tssIsCandidate');$('tssIsCandidateOptions').hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');activeCandidate=-1}
  function showCandidates(query=''){
    const text=norm(query),digits=text.replace(/\D/g,'');
    candidateMatches=candidateOptions.filter(option=>!text||option.search.includes(text)||(digits.length>=3&&option.phone.includes(digits)));
    activeCandidate=-1;
    const list=$('tssIsCandidateOptions'),input=$('tssIsCandidate');
    list.innerHTML=candidateMatches.length?candidateMatches.slice(0,100).map((option,index)=>`<div id="tssIsCandidateOption${index}" role="option" aria-selected="${option.key===selectedCandidateKey}" data-index="${index}"><strong>${esc(nameOf(option.candidate))}</strong><small>${esc([emailOf(option.candidate),option.candidate.phone||'',option.candidate.id||''].filter(Boolean).join(' · '))}</small></div>`).join('')+(candidateMatches.length>100?'<div class="tss-is-candidate-empty">Type to find more candidates.</div>':''):'<div class="tss-is-candidate-empty">No matching saved candidates.</div>';
    list.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');
  }
  function chooseCandidate(index){
    const option=candidateMatches[index];if(!option)return;
    selectedCandidateKey=option.key;$('tssIsCandidate').value=option.label;
    pendingSubmission=null;updateCandidateMeta();hideCandidates();
  }
  function candidateKeydown(e){
    const list=$('tssIsCandidateOptions');
    if(e.key==='Escape'&&!list.hidden){e.preventDefault();e.stopPropagation();hideCandidates();return}
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();if(list.hidden)showCandidates(selectedCandidateKey?'':e.target.value);
      const count=Math.min(candidateMatches.length,100);if(!count)return;
      activeCandidate=activeCandidate<0?(e.key==='ArrowDown'?0:count-1):(activeCandidate+(e.key==='ArrowDown'?1:-1)+count)%count;
      list.querySelectorAll('[role=option]').forEach((option,index)=>option.classList.toggle('active',index===activeCandidate));
      const option=$('tssIsCandidateOption'+activeCandidate);e.target.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});
    }else if(e.key==='Enter'&&!list.hidden){e.preventDefault();if(activeCandidate>=0)chooseCandidate(activeCandidate)}
  }

  function populate(){
    const cs=candidates(),rs=requirements();
    const csel=$('tssIsCandidate'),rsel=$('tssIsRequirement');
    candidateOptions=cs.map(candidate=>({candidate,key:candKey(candidate),label:`${nameOf(candidate)}${emailOf(candidate)?' — '+emailOf(candidate):candidate.phone?' — '+candidate.phone:''}`,search:norm([nameOf(candidate),emailOf(candidate),candidate.phone,candidate.id].join(' ')),phone:String(candidate.phone||'').replace(/\D/g,'')}));
    selectedCandidateKey='';csel.value='';csel.placeholder=cs.length?'Select or type to search candidate…':'No saved candidates found';hideCandidates();
    rsel.innerHTML=rs.length?'<option value="">Select position / requirement…</option>'+rs.map(r=>`<option value="${esc(reqKey(r))}">${esc(formatReq(r))}</option>`).join(''):'<option value="">No open requirements found</option>';
    const current=DB()?.requirements?.find(r=>String(r.id)===$('screenRequirement')?.value);
    if(current&&rs.some(r=>reqKey(r)===reqKey(current)))rsel.value=reqKey(current);
    $('tssIsDate').value=new Date().toISOString().slice(0,10);
    updateCandidateMeta();updateReqMeta();
  }
  function selectedCandidate(){return (DB()?.candidates||[]).find(c=>candKey(c)===selectedCandidateKey)}
  function selectedRequirement(){const key=$('tssIsRequirement')?.value;return requirements().find(r=>reqKey(r)===key)}
  function updateCandidateMeta(){const c=selectedCandidate();$('tssIsCandidateMeta').textContent=c?`${emailOf(c)||'No email saved'}${c.phone?` · ${c.phone}`:''}`:'Choose a candidate already saved in Candidate Records.'}
  function updateReqMeta(){const r=selectedRequirement();$('tssIsReqMeta').textContent=r?`${r.status||''}${r.location?` · ${r.location}`:''}${r.positionsCount||r.positions_count?` · ${r.positionsCount||r.positions_count} position(s)`:''}`:'The selected requirement controls the role/client shown in the email.'}
  function openModal(){ensureModal();populate();pendingSubmission=null;$('tssInterviewSchedulerModal').classList.remove('hidden');open=true}
  function closeModal(){$('tssInterviewSchedulerModal')?.classList.add('hidden');hideCandidates();open=false}
  function localTimeLabel(value){if(!value)return'';const [h0,m='00']=value.split(':');let h=Number(h0),ap=h>=12?'PM':'AM';h=h%12||12;return `${h}:${m} ${ap}`}
  async function submit(){
    if(submitting)return;
    const c=selectedCandidate(),r=selectedRequirement();
    const date=$('tssIsDate').value,time=$('tssIsTime').value;
    if(!c)return alert('Please select a saved candidate.');
    if(!r)return alert('Please select the exact position / requirement.');
    if(!date||!time)return alert('Please select interview date and time.');
    if(!emailOf(c))return alert('This candidate has no email saved. Add the candidate email first so confirmation can be sent.');
    const store=DB(); if(!store)return;
    const nameIssue=window.TSSDocumentParser?.candidateNameIssue?.(nameOf(c));if(nameIssue){try{toast(nameIssue+' Edit the candidate profile before scheduling.')}catch{}return;}
    const item={candidate:nameOf(c),email:emailOf(c),candidateId:c.serverId||c.id||null,date,time:localTimeLabel(time),position:r.title||'',client:r.client||'',requirementId:r.id||'',requirementServerId:r.serverId||null,mode:$('tssIsMode').value||'Client Interview',interviewer:$('tssIsInterviewer').value.trim(),locationOrLink:$('tssIsLocation').value.trim(),notes:$('tssIsNotes').value.trim()};
    const submissionKey=JSON.stringify([item.candidateId,item.requirementServerId,item.date,item.time,item.mode,item.interviewer,item.locationOrLink,item.notes]);
    if(pendingSubmission?.submissionKey===submissionKey)item.clientRequestId=pendingSubmission.item.clientRequestId;
    else item.clientRequestId=window.TSSInterviewSync?.newRequestId?.();
    const confirmation=`Schedule interview?\n\nCandidate: ${item.candidate}\nPosition: ${item.position}\nClient: ${item.client}\nDate: ${item.date}\nTime: ${item.time}\n\nThe email will be sent using THIS exact position.`;
    if(!confirm(confirmation))return;
    const button=$('tssIsSubmit'),originalText=button?.textContent||'Schedule & Send Confirmation';
    submitting=true;pendingSubmission={submissionKey,item};
    if(button){button.disabled=true;button.textContent='Scheduling…'}
    try{
      if(!window.TSSInterviewSync?.persistItem)throw new Error('Interview sync is not ready. Please refresh and try again.');
      await window.TSSInterviewSync.persistItem(item);
      store.interviews=store.interviews||[];
      if(!store.interviews.some(existing=>String(existing.serverId||existing.id)===String(item.serverId)))store.interviews.push(item);
      localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(store));
      pendingSubmission=null;closeModal();
      try{window.TSSInterviewActions?.renderStable?.(true)}catch{}
      try{toast(`Interview scheduled for ${item.position} · confirmation + reminders queued`)}catch{}
    }catch(error){
      item.syncState='failed';item.syncError=error?.message||String(error);console.warn(error);
      try{toast('Interview was not scheduled: '+item.syncError)}catch{}
    }finally{
      submitting=false;if(button){button.disabled=false;button.textContent=originalText}
    }
  }

  function intercept(e){
    const btn=e.target.closest?.('#scheduleInterview');
    if(!btn)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openModal();
  }
  document.addEventListener('click',intercept,true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureModal,{once:true});else ensureModal();
  window.TSSInterviewScheduler={open:openModal,close:closeModal,populate};
})();
