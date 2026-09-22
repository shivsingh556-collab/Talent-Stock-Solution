(function(){
  'use strict';
  if(window.__TSS_RECRUITMENT_TRACKERS__)return;
  window.__TSS_RECRUITMENT_TRACKERS__=true;

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const backend=()=>window.TSSBackend;
  const client=()=>backend()?.client||null;
  const identity=()=>window.TSS_AUTH_CONTEXT||{};
  const isAdmin=()=>identity().role==='admin'||identity().isSuperAdmin===true;
  const toast=message=>{try{window.toast(message)}catch{console.log(message)}};
  const OUTCOMES=['Interested in Job Change','Not Interested','No Answer','Call Back Later','Wrong Number','Already Placed','Other'];
  let callingRows=[];
  let submissionRows=[];
  let monthlyData=null;

  function localDate(value=new Date()){
    return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
  }
  function monthBounds(value){
    const [year,month]=String(value||localDate().slice(0,7)).split('-').map(Number);
    const start=`${year}-${String(month).padStart(2,'0')}-01T00:00:00+05:30`;
    const nextMonth=month===12?`${year+1}-01-01`:`${year}-${String(month+1).padStart(2,'0')}-01`;
    return {start,end:`${nextMonth}T00:00:00+05:30`};
  }
  function formatStamp(value){
    if(!value)return '—';
    return new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }
  function safeName(value){return String(value||'file.xlsx').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-120)}
  function showView(id,title){
    $$('.view').forEach(v=>v.classList.toggle('active',v.id===id));
    $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
    const pageTitle=$('#pageTitle');if(pageTitle)pageTitle.textContent=title;
  }
  function ensureShell(){
    const nav=$('#nav'),main=$('.main-shell');if(!nav||!main)return false;
    if(!$('#callingTrackerNav')){
      const button=document.createElement('button');button.id='callingTrackerNav';button.className='nav-item';button.dataset.view='callingTracker';button.innerHTML='<span>☎</span>Calling Tracker';
      const interview=$('.nav-item[data-view="interviews"]');interview?.after(button);
      button.onclick=()=>{showView('callingTracker','Calling Tracker');renderCallingTracker()};
    }
    if(!$('#callingTracker')){
      const section=document.createElement('section');section.id='callingTracker';section.className='view';main.appendChild(section);
    }
    if(isAdmin()&&!$('#clientSubmissionsNav')){
      const button=document.createElement('button');button.id='clientSubmissionsNav';button.className='nav-item';button.dataset.view='clientSubmissions';button.innerHTML='<span>⇧</span>Client Submissions';
      $('#callingTrackerNav')?.after(button);
      button.onclick=()=>{showView('clientSubmissions','Client Submissions');renderClientSubmissions()};
    }
    if(isAdmin()&&!$('#clientSubmissions')){
      const section=document.createElement('section');section.id='clientSubmissions';section.className='view';main.appendChild(section);
    }
    return true;
  }

  async function loadCallingRows(){
    const c=client();if(!c)return [];
    const [screenings,calls]=await Promise.all([
      c.from('screenings').select('id,candidate_id,requirement_id,screened_by,screened_at,overall_score,recruiter_decision,candidates(candidate_name,phone,email),requirements(tss_id,job_title,clients(name)),screened_by_profile:profiles!screenings_screened_by_fkey(full_name,email)').order('screened_at',{ascending:false}).limit(2500),
      c.from('candidate_call_logs').select('id,candidate_id,requirement_id,screening_id,recruiter_id,call_outcome,call_notes,next_follow_up_at,called_at,recruiter:profiles!candidate_call_logs_recruiter_id_fkey(full_name,email)').order('called_at',{ascending:false}).limit(5000)
    ]);
    if(screenings.error)throw screenings.error;if(calls.error)throw calls.error;
    const latestCall=new Map();(calls.data||[]).forEach(row=>{const key=`${row.candidate_id}|${row.requirement_id}`;if(!latestCall.has(key))latestCall.set(key,row)});
    const seen=new Set();callingRows=[];
    for(const s of screenings.data||[]){
      const key=`${s.candidate_id}|${s.requirement_id}`;if(seen.has(key))continue;seen.add(key);
      callingRows.push({...s,lastCall:latestCall.get(key)||null});
    }
    return callingRows;
  }
  function callingFilters(){
    return `<div class="tracker-toolbar"><input id="callSearch" placeholder="Search candidate, client or job"><select id="callStatus"><option value="">All call outcomes</option>${OUTCOMES.map(x=>`<option>${esc(x)}</option>`).join('')}</select><button id="callRefresh" class="btn ghost">Refresh</button><button id="callExport" class="blue-btn">Export Daily Excel</button></div>`;
  }
  async function renderCallingTracker(){
    const root=$('#callingTracker');if(!root)return;
    root.innerHTML=`<div class="section-head"><div><span>POST-SCREENING FOLLOW-UP</span><h1>Calling Tracker</h1><p>Every screened candidate appears here. Save the call result after speaking with the candidate.</p></div><span class="tracker-live">Daily record · Auto-saved</span></div>${callingFilters()}<div id="callingTrackerContent" class="old-panel"><div class="tracker-empty">Loading screened candidates…</div></div>`;
    try{await loadCallingRows();paintCallingRows()}catch(error){console.error(error);$('#callingTrackerContent').innerHTML='<div class="tracker-empty">Calling Tracker tables are not ready yet. Please try again after the database update.</div>'}
    $('#callSearch')?.addEventListener('input',paintCallingRows);$('#callStatus')?.addEventListener('change',paintCallingRows);$('#callRefresh')?.addEventListener('click',renderCallingTracker);$('#callExport')?.addEventListener('click',exportCalls);
  }
  function paintCallingRows(){
    const root=$('#callingTrackerContent');if(!root)return;
    const query=String($('#callSearch')?.value||'').trim().toLowerCase(),status=$('#callStatus')?.value||'';
    const rows=callingRows.filter(row=>{
      const text=[row.candidates?.candidate_name,row.candidates?.phone,row.requirements?.job_title,row.requirements?.clients?.name,row.screened_by_profile?.full_name].join(' ').toLowerCase();
      return (!query||text.includes(query))&&(!status||row.lastCall?.call_outcome===status);
    });
    root.innerHTML=`<div class="tracker-count">${rows.length} screened candidate${rows.length===1?'':'s'}</div><div class="tracker-table-wrap"><table class="tracker-table"><thead><tr><th>Candidate</th><th>Client / Position</th><th>Screened By</th><th>Score</th><th>Latest Call Result</th><th>Last Call</th><th>Next Follow-up</th><th>Action</th></tr></thead><tbody>${rows.length?rows.map(row=>`<tr><td><strong>${esc(row.candidates?.candidate_name||'Candidate')}</strong><small>${esc(row.candidates?.phone||row.candidates?.email||'')}</small></td><td><strong>${esc(row.requirements?.clients?.name||'—')}</strong><small>${esc(row.requirements?.tss_id||'')} · ${esc(row.requirements?.job_title||'—')}</small></td><td>${esc(row.screened_by_profile?.full_name||row.screened_by_profile?.email||'Recruiter')}</td><td><b>${esc(row.overall_score??'—')}${row.overall_score==null?'':'%'}</b></td><td><span class="tracker-chip">${esc(row.lastCall?.call_outcome||'Pending Call')}</span>${row.lastCall?.call_notes?`<small>${esc(row.lastCall.call_notes)}</small>`:''}</td><td>${esc(formatStamp(row.lastCall?.called_at))}</td><td>${esc(formatStamp(row.lastCall?.next_follow_up_at))}</td><td><button class="tracker-action" data-call-update="${esc(row.id)}">Update Call</button></td></tr>`).join(''):'<tr><td colspan="8" class="tracker-empty">No screened candidates match these filters.</td></tr>'}</tbody></table></div>`;
    $$('[data-call-update]',root).forEach(button=>button.onclick=()=>openCallDialog(button.dataset.callUpdate));
  }
  function ensureCallDialog(){
    let dialog=$('#callTrackerDialog');if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='callTrackerDialog';dialog.innerHTML=`<form method="dialog" class="tracker-dialog"><div class="dialog-head"><div><span class="purple-label">CALLING TRACKER</span><h3 id="callDialogTitle">Update Candidate Call</h3></div><button value="cancel" class="icon-btn">×</button></div><label>Call Result</label><select id="callOutcome">${OUTCOMES.map(x=>`<option>${esc(x)}</option>`).join('')}</select><label>Call Notes</label><textarea id="callNotes" rows="4" placeholder="Candidate response or important discussion notes"></textarea><label>Next Follow-up</label><input id="callFollowUp" type="datetime-local"><div class="dialog-actions"><button value="cancel" class="btn ghost">Cancel</button><button type="button" id="saveCallRecord" class="btn primary">Save Call Record</button></div></form>`;document.body.appendChild(dialog);$('#saveCallRecord').onclick=saveCallRecord;return dialog;
  }
  function openCallDialog(screeningId){
    const row=callingRows.find(x=>String(x.id)===String(screeningId));if(!row)return;
    const d=ensureCallDialog();d.dataset.screeningId=row.id;$('#callDialogTitle').textContent=`Call · ${row.candidates?.candidate_name||'Candidate'}`;$('#callOutcome').value=row.lastCall?.call_outcome||OUTCOMES[0];$('#callNotes').value='';$('#callFollowUp').value='';d.showModal();
  }
  async function saveCallRecord(){
    const d=$('#callTrackerDialog'),row=callingRows.find(x=>String(x.id)===String(d?.dataset.screeningId));if(!row)return;
    const button=$('#saveCallRecord');button.disabled=true;
    try{
      const payload={candidate_id:row.candidate_id,requirement_id:row.requirement_id,screening_id:row.id,recruiter_id:identity().id,call_outcome:$('#callOutcome').value,call_notes:$('#callNotes').value.trim()||null,next_follow_up_at:$('#callFollowUp').value?new Date($('#callFollowUp').value).toISOString():null,called_at:new Date().toISOString()};
      const {error}=await client().from('candidate_call_logs').insert(payload);if(error)throw error;
      d.close();toast('Call result saved in the daily record');await renderCallingTracker();
    }catch(error){console.error(error);alert('Could not save the call result: '+(error.message||error))}finally{button.disabled=false}
  }
  function loadXLSX(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.onload=()=>resolve(window.XLSX);s.onerror=reject;document.head.appendChild(s)});
  }
  function autoWidths(rows){return (rows[0]||[]).map((_,i)=>({wch:Math.min(42,Math.max(12,...rows.map(r=>String(r[i]??'').length+2)))}))}
  async function exportCalls(){
    try{
      const c=client(),date=localDate(),{data,error}=await c.from('candidate_call_logs').select('called_at,call_outcome,call_notes,next_follow_up_at,candidates(candidate_name,phone,email),requirements(tss_id,job_title,clients(name)),recruiter:profiles!candidate_call_logs_recruiter_id_fkey(full_name,email)').gte('called_at',date+'T00:00:00+05:30').lte('called_at',date+'T23:59:59+05:30').order('called_at',{ascending:true});if(error)throw error;
      const rows=[['Date','Time','Recruiter','Candidate','Phone','Email','Client','TSS ID','Position','Call Result','Notes','Next Follow-up'],...(data||[]).map(x=>[date,formatStamp(x.called_at),x.recruiter?.full_name||x.recruiter?.email||'',x.candidates?.candidate_name||'',x.candidates?.phone||'',x.candidates?.email||'',x.requirements?.clients?.name||'',x.requirements?.tss_id||'',x.requirements?.job_title||'',x.call_outcome||'',x.call_notes||'',formatStamp(x.next_follow_up_at)])];
      const XLSX=await loadXLSX(),ws=XLSX.utils.aoa_to_sheet(rows),wb=XLSX.utils.book_new();ws['!cols']=autoWidths(rows);XLSX.utils.book_append_sheet(wb,ws,'Daily Calling');XLSX.writeFile(wb,`TODO_AI_Calling_Tracker_${date}.xlsx`);toast('Daily calling Excel downloaded');
    }catch(error){console.error(error);alert('Could not export the calling record.')}
  }

  async function clientSubmissionLookups(){
    const c=client();
    const [clients,requirements,recruiters]=await Promise.all([
      c.from('clients').select('id,name').eq('is_active',true).order('name'),
      c.from('requirements').select('id,tss_id,job_title,client_id,clients(name)').order('created_at',{ascending:false}),
      c.from('profiles').select('id,full_name,email').eq('role','recruiter').eq('is_active',true).order('full_name')
    ]);
    if(clients.error)throw clients.error;if(requirements.error)throw requirements.error;if(recruiters.error)throw recruiters.error;
    return {clients:clients.data||[],requirements:requirements.data||[],recruiters:recruiters.data||[]};
  }
  async function renderClientSubmissions(){
    const root=$('#clientSubmissions');if(!root||!isAdmin())return;
    root.innerHTML='<div class="section-head"><div><span>ADMIN WORKFLOW</span><h1>Client Submissions</h1><p>Upload the final Excel shared with a client and preserve its complete submission record.</p></div><span class="tracker-live">Admin only · Private files</span></div><div id="clientSubmissionForm" class="old-panel tracker-form"><div class="tracker-empty">Loading clients and requirements…</div></div><div id="clientSubmissionHistory" class="old-panel"><div class="tracker-empty">Loading submission history…</div></div>';
    try{
      const lookups=await clientSubmissionLookups();
      $('#clientSubmissionForm').innerHTML=`<h3>Upload Final Client Submission</h3><div class="tracker-form-grid"><label>Client<select id="submissionClient"><option value="">Select client</option>${lookups.clients.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></label><label>Requirement<select id="submissionRequirement"><option value="">Select requirement</option>${lookups.requirements.map(x=>`<option value="${esc(x.id)}" data-client="${esc(x.client_id)}">${esc(x.tss_id||'')} · ${esc(x.job_title)} — ${esc(x.clients?.name||'')}</option>`).join('')}</select></label><label>Source Recruiter<select id="submissionRecruiter"><option value="">Select recruiter</option>${lookups.recruiters.map(x=>`<option value="${esc(x.id)}">${esc(x.full_name||x.email)}</option>`).join('')}</select></label><label>Candidate Count<input id="submissionCount" type="number" min="1" value="1"></label><label class="tracker-full">Final Excel File<input id="submissionFile" type="file" accept=".xlsx,.xls,.csv" /></label><label class="tracker-full">Remarks<textarea id="submissionNotes" rows="3" placeholder="Optional client submission details"></textarea></label></div><button id="saveClientSubmission" class="blue-btn">Upload & Save Submission</button>`;
      $('#submissionClient').onchange=()=>{const id=$('#submissionClient').value;$$('#submissionRequirement option').forEach(o=>{o.hidden=Boolean(o.value&&o.dataset.client!==id)});if($('#submissionRequirement').selectedOptions[0]?.hidden)$('#submissionRequirement').value=''};
      $('#saveClientSubmission').onclick=saveClientSubmission;
      await loadSubmissionHistory();paintSubmissionHistory();
    }catch(error){console.error(error);$('#clientSubmissionForm').innerHTML='<div class="tracker-empty">Client Submission tables are not ready yet. Please try again after the database update.</div>'}
  }
  async function saveClientSubmission(){
    const file=$('#submissionFile')?.files?.[0],clientId=$('#submissionClient')?.value,requirementId=$('#submissionRequirement')?.value,recruiterId=$('#submissionRecruiter')?.value;
    if(!clientId||!requirementId||!recruiterId||!file)return alert('Select the client, requirement, recruiter and final Excel file.');
    if(file.size>10*1024*1024)return alert('Please upload a file smaller than 10 MB.');
    const button=$('#saveClientSubmission');button.disabled=true;
    try{
      const path=`${identity().id}/${crypto.randomUUID()}-${safeName(file.name)}`;
      const upload=await client().storage.from('client-submissions').upload(path,file,{contentType:file.type||'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',upsert:false});if(upload.error)throw upload.error;
      const payload={client_id:clientId,requirement_id:requirementId,recruiter_id:recruiterId,submitted_by:identity().id,original_filename:file.name,storage_path:path,mime_type:file.type||null,file_size:file.size,candidate_count:Math.max(1,Number($('#submissionCount').value)||1),notes:$('#submissionNotes').value.trim()||null,submitted_at:new Date().toISOString()};
      const saved=await client().from('client_submissions').insert(payload);if(saved.error){await client().storage.from('client-submissions').remove([path]);throw saved.error}
      toast('Client submission file and record saved');await renderClientSubmissions();
    }catch(error){console.error(error);alert('Could not save the client submission: '+(error.message||error))}finally{button.disabled=false}
  }
  async function loadSubmissionHistory(){
    const {data,error}=await client().from('client_submissions').select('id,original_filename,storage_path,candidate_count,notes,submitted_at,clients(name),requirements(tss_id,job_title),recruiter:profiles!client_submissions_recruiter_id_fkey(full_name,email),submitted_by_profile:profiles!client_submissions_submitted_by_fkey(full_name,email)').order('submitted_at',{ascending:false}).limit(1000);if(error)throw error;submissionRows=data||[];
  }
  function paintSubmissionHistory(){
    const root=$('#clientSubmissionHistory');if(!root)return;
    root.innerHTML=`<div class="tracker-panel-head"><div><h3>Submission History</h3><p>Every uploaded client Excel remains recorded by date, requirement and recruiter.</p></div></div><div class="tracker-table-wrap"><table class="tracker-table"><thead><tr><th>Date</th><th>Client / Requirement</th><th>Source Recruiter</th><th>Candidates</th><th>Uploaded By</th><th>File</th><th>Remarks</th></tr></thead><tbody>${submissionRows.length?submissionRows.map(x=>`<tr><td>${esc(formatStamp(x.submitted_at))}</td><td><strong>${esc(x.clients?.name||'—')}</strong><small>${esc(x.requirements?.tss_id||'')} · ${esc(x.requirements?.job_title||'—')}</small></td><td>${esc(x.recruiter?.full_name||x.recruiter?.email||'—')}</td><td><b>${esc(x.candidate_count||0)}</b></td><td>${esc(x.submitted_by_profile?.full_name||x.submitted_by_profile?.email||'Admin')}</td><td><button class="tracker-link" data-submission-download="${esc(x.id)}">${esc(x.original_filename)}</button></td><td>${esc(x.notes||'—')}</td></tr>`).join(''):'<tr><td colspan="7" class="tracker-empty">No client submission files uploaded yet.</td></tr>'}</tbody></table></div>`;
    $$('[data-submission-download]',root).forEach(button=>button.onclick=()=>downloadSubmission(button.dataset.submissionDownload));
  }
  async function downloadSubmission(id){
    const row=submissionRows.find(x=>String(x.id)===String(id));if(!row)return;
    const {data,error}=await client().storage.from('client-submissions').createSignedUrl(row.storage_path,60,{download:row.original_filename});if(error)return alert('Could not open this file: '+error.message);window.open(data.signedUrl,'_blank','noopener');
  }

  function injectMonthlyTab(){
    if(!isAdmin())return;
    const tabs=$('#reportsRoot .report-tabs');if(!tabs||tabs.querySelector('[data-tab="monthly-recruiter"]'))return;
    const button=document.createElement('button');button.dataset.tab='monthly-recruiter';button.textContent='Monthly Recruiter Report';tabs.appendChild(button);
    button.onclick=event=>{event.preventDefault();event.stopImmediatePropagation();$$('#reportsRoot .report-tabs button').forEach(x=>x.classList.toggle('active',x===button));renderMonthlyReport()};
  }
  async function monthlyQueries(month){
    const {start,end}=monthBounds(month),c=client();
    const [profiles,candidates,screenings,calls,submissions,interviews]=await Promise.all([
      c.from('profiles').select('id,full_name,email').eq('role','recruiter').eq('is_active',true).order('full_name'),
      c.from('candidates').select('id,uploaded_by,created_at').gte('created_at',start).lt('created_at',end),
      c.from('screenings').select('id,screened_by,screened_at,final_recommendation,recruiter_decision').gte('screened_at',start).lt('screened_at',end),
      c.from('candidate_call_logs').select('id,recruiter_id,call_outcome,next_follow_up_at,called_at').gte('called_at',start).lt('called_at',end),
      c.from('client_submissions').select('id,recruiter_id,candidate_count,submitted_at').gte('submitted_at',start).lt('submitted_at',end),
      c.from('interviews').select('id,created_by,interview_stage,outcome,status,scheduled_at').gte('scheduled_at',start).lt('scheduled_at',end)
    ]);
    for(const result of [profiles,candidates,screenings,calls,submissions,interviews])if(result.error)throw result.error;
    return {profiles:profiles.data||[],candidates:candidates.data||[],screenings:screenings.data||[],calls:calls.data||[],submissions:submissions.data||[],interviews:interviews.data||[]};
  }
  function summarizeRecruiter(data,id){
    const calls=data.calls.filter(x=>x.recruiter_id===id),screens=data.screenings.filter(x=>x.screened_by===id),interviews=data.interviews.filter(x=>x.created_by===id),submissions=data.submissions.filter(x=>x.recruiter_id===id);
    const interested=calls.filter(x=>x.call_outcome==='Interested in Job Change').length,notInterested=calls.filter(x=>x.call_outcome==='Not Interested').length,pendingFollowUps=calls.filter(x=>x.next_follow_up_at&&new Date(x.next_follow_up_at)>new Date()).length;
    const selected=interviews.filter(x=>['Selected','Offer / Joining Formalities','Joined-TSS'].includes(x.outcome)).length,rejected=interviews.filter(x=>['Rejected','Client Rejected','Candidate Declined'].includes(x.outcome)).length,joined=interviews.filter(x=>x.outcome==='Joined-TSS').length;
    const submitted=submissions.reduce((sum,x)=>sum+(Number(x.candidate_count)||0),0),shortlisted=screens.filter(x=>['Strong Match','Review Recommended'].includes(x.final_recommendation)).length;
    return {added:data.candidates.filter(x=>x.uploaded_by===id).length,screened:screens.length,shortlisted,calls:calls.length,interested,notInterested,noResponse:calls.filter(x=>['No Answer','Call Back Later'].includes(x.call_outcome)).length,pendingFollowUps,submitted,submissionFiles:submissions.length,interviews:interviews.length,completed:interviews.filter(x=>x.interview_stage==='Interview Completed').length,secondRound:interviews.filter(x=>x.outcome==='Second Round').length,selected,rejected,joined,interestRate:calls.length?Math.round(interested/calls.length*100):0,interviewRate:submitted?Math.round(interviews.length/submitted*100):0,selectionRate:interviews.length?Math.round(selected/interviews.length*100):0};
  }
  async function renderMonthlyReport(){
    const content=$('#reportContent');if(!content)return;
    const month=($('#monthlyReportMonth')?.value||localDate().slice(0,7));content.innerHTML='<div class="report-panel"><div class="tracker-empty">Preparing clean recruiter-wise monthly records…</div></div>';
    try{
      const data=await monthlyQueries(month);monthlyData=data;
      const previous=$('#monthlyRecruiterSelect')?.value||data.profiles[0]?.id||'';
      content.innerHTML=`<div class="monthly-report-controls report-panel"><label>Month<input id="monthlyReportMonth" type="month" value="${esc(month)}"></label><label>Recruiter<select id="monthlyRecruiterSelect">${data.profiles.map(p=>`<option value="${esc(p.id)}" ${p.id===previous?'selected':''}>${esc(p.full_name||p.email)}</option>`).join('')}</select></label><button id="monthlyReportRefresh" class="blue-btn">View Report</button><button id="monthlyReportExport" class="btn ghost">Export Excel</button></div><div id="monthlyRecruiterRecord"></div>`;
      $('#monthlyReportRefresh').onclick=renderMonthlyReport;$('#monthlyRecruiterSelect').onchange=paintMonthlyRecruiter;$('#monthlyReportExport').onclick=exportMonthlyRecruiter;paintMonthlyRecruiter();
    }catch(error){console.error(error);content.innerHTML='<div class="report-panel"><div class="tracker-empty">Monthly report tables are not ready yet. Please try again after the database update.</div></div>'}
  }
  function paintMonthlyRecruiter(){
    const id=$('#monthlyRecruiterSelect')?.value,profile=monthlyData?.profiles.find(x=>x.id===id),root=$('#monthlyRecruiterRecord');if(!root||!profile)return;
    const m=summarizeRecruiter(monthlyData,id),month=$('#monthlyReportMonth').value;
    root.innerHTML=`<div class="monthly-person report-panel"><div><span>INDIVIDUAL MONTHLY PERFORMANCE</span><h2>${esc(profile.full_name||profile.email)}</h2><p>${esc(new Date(month+'-01T12:00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'}))}</p></div><div class="monthly-rate"><b>${m.selectionRate}%</b><span>Interview to selection</span></div></div><div class="monthly-metrics"><div><span>Candidates Added</span><b>${m.added}</b></div><div><span>Screenings Completed</span><b>${m.screened}</b></div><div><span>Calls Completed</span><b>${m.calls}</b></div><div><span>Interested</span><b>${m.interested}</b></div><div><span>Not Interested</span><b>${m.notInterested}</b></div><div><span>No Response / Callback</span><b>${m.noResponse}</b></div><div><span>Profiles Client Submitted</span><b>${m.submitted}</b></div><div><span>Submission Files</span><b>${m.submissionFiles}</b></div><div><span>Interviews Scheduled</span><b>${m.interviews}</b></div><div><span>Interviews Completed</span><b>${m.completed}</b></div><div><span>Second Round</span><b>${m.secondRound}</b></div><div><span>Selected</span><b>${m.selected}</b></div><div><span>Rejected</span><b>${m.rejected}</b></div><div><span>Joined</span><b>${m.joined}</b></div></div><div class="monthly-bottom"><div class="report-panel"><h3>Pending Actions</h3><p>Calling follow-ups <b>${m.pendingFollowUps}</b></p></div><div class="report-panel"><h3>Conversion Summary</h3><p>Calls → Interested <b>${m.interestRate}%</b></p><p>Client Submission → Interview <b>${m.interviewRate}%</b></p><p>Interview → Selection <b>${m.selectionRate}%</b></p></div></div>`;
  }
  async function exportMonthlyRecruiter(){
    const id=$('#monthlyRecruiterSelect')?.value,profile=monthlyData?.profiles.find(x=>x.id===id);if(!profile)return;
    const m=summarizeRecruiter(monthlyData,id),month=$('#monthlyReportMonth').value;
    const rows=[['Monthly Recruiter Performance',''],['Recruiter',profile.full_name||profile.email],['Month',month],[],['Activity','Total'],['Candidates Added',m.added],['Screenings Completed',m.screened],['Calls Completed',m.calls],['Interested Candidates',m.interested],['Not Interested',m.notInterested],['No Response / Callback',m.noResponse],['Pending Follow-ups',m.pendingFollowUps],['Profiles Submitted to Clients',m.submitted],['Client Submission Files',m.submissionFiles],['Interviews Scheduled',m.interviews],['Interviews Completed',m.completed],['Second Round',m.secondRound],['Selected',m.selected],['Rejected',m.rejected],['Joined',m.joined],[],['Conversion','Rate'],['Calls to Interested',m.interestRate+'%'],['Client Submission to Interview',m.interviewRate+'%'],['Interview to Selection',m.selectionRate+'%']];
    const XLSX=await loadXLSX(),ws=XLSX.utils.aoa_to_sheet(rows),wb=XLSX.utils.book_new();ws['!cols']=autoWidths(rows);XLSX.utils.book_append_sheet(wb,ws,'Monthly Performance');XLSX.writeFile(wb,`TODO_AI_${safeName(profile.full_name||'Recruiter')}_${month}.xlsx`);
  }

  function boot(){
    if(!ensureShell())return setTimeout(boot,150);
    const observer=new MutationObserver(()=>injectMonthlyTab());observer.observe(document.getElementById('workspace')||document.body,{childList:true,subtree:true});injectMonthlyTab();
    window.addEventListener('tss:auth-ready',()=>{ensureShell();injectMonthlyTab()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.TSSRecruitmentTrackers={renderCallingTracker,renderClientSubmissions,renderMonthlyReport};
})();
