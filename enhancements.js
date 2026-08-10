// Talent Buddy production enhancements: auth gate, clean job-profile UX, missing product sections.
(function(){
  const allowedDomain='@talent-stock.com';
  const backend=window.TSSBackend;

  function addAuth(){
    const shell=document.createElement('div');
    shell.id='authShell'; shell.className='auth-shell';
    shell.innerHTML=`<div class="auth-card"><div class="auth-brand"><div class="auth-logo">TSS</div><div><h1>Talent Buddy</h1><p>Talent Stock Solutions · Resume Intelligence</p></div></div><h2>Sign in to continue</h2><p>Access is restricted to Talent Stock Solutions team members.</p><label>Company Email</label><input id="authEmail" type="email" autocomplete="username" placeholder="name@talent-stock.com"><label>Password</label><input id="authPassword" type="password" autocomplete="current-password" placeholder="Enter your password"><div id="authError" class="auth-error"></div><button id="authLogin" class="btn primary wide">Sign In</button><div class="auth-note"><span id="backendState" class="backend-pill ${backend?.enabled?'live':''}">${backend?.enabled?'● Supabase connected':'○ Demo storage mode'}</span><br><br>Only email IDs ending with <strong>@talent-stock.com</strong> are allowed.</div></div>`;
    document.body.appendChild(shell);
    document.getElementById('authLogin').onclick=login;
    document.getElementById('authPassword').addEventListener('keydown',e=>{if(e.key==='Enter')login()});
  }

  function validCompanyEmail(email){return String(email||'').trim().toLowerCase().endsWith(allowedDomain)}
  function setIdentity(email){
    const initials=(email.split('@')[0]||'TS').split(/[._-]/).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'TS';
    document.querySelectorAll('.avatar,.top-user').forEach(x=>x.textContent=initials);
    const box=document.querySelector('.user-box'); if(box){const strong=box.querySelector('strong');const small=box.querySelector('small');if(strong)strong.textContent=email.split('@')[0].replace(/[._-]/g,' ');if(small)small.textContent='Talent Partner'}
  }
  async function login(){
    const email=document.getElementById('authEmail').value.trim().toLowerCase(),password=document.getElementById('authPassword').value,err=document.getElementById('authError');
    err.textContent='';
    if(!validCompanyEmail(email)){err.textContent='Use your @talent-stock.com company email.';return}
    if(!password){err.textContent='Enter your password.';return}
    try{
      if(backend?.enabled){await backend.signIn(email,password)}
      else localStorage.setItem('tss_demo_auth',JSON.stringify({email,at:Date.now()}));
      setIdentity(email);document.getElementById('authShell').classList.add('auth-hidden');toast(backend?.enabled?'Signed in securely':'Signed in · demo storage mode');
    }catch(e){err.textContent=e.message||'Sign in failed'}
  }
  async function restoreAuth(){
    addAuth();
    try{
      if(backend?.enabled){const u=await backend.currentUser();if(u?.email&&validCompanyEmail(u.email)){setIdentity(u.email);document.getElementById('authShell').classList.add('auth-hidden');return}if(u)await backend.signOut()}
      else {const s=JSON.parse(localStorage.getItem('tss_demo_auth')||'null');if(s?.email&&validCompanyEmail(s.email)){setIdentity(s.email);document.getElementById('authShell').classList.add('auth-hidden')}}
    }catch(e){console.warn('Auth restore failed',e)}
  }

  function addMissingSections(){
    const nav=document.getElementById('nav'); if(!nav)return;
    const addNav=(view,icon,label)=>{if(nav.querySelector(`[data-view="${view}"]`))return;const b=document.createElement('button');b.className='nav-item';b.dataset.view=view;b.innerHTML=`<span>${icon}</span>${label}`;nav.appendChild(b)};
    addNav('interviews','▦','Interviews');addNav('tracker','▧','Tracker');addNav('analytics','⌁','Analytics');
    const main=document.querySelector('main');
    const addSection=(id,html)=>{if(document.getElementById(id))return;const s=document.createElement('section');s.id=id;s.className='view';s.innerHTML=html;main.appendChild(s)};
    addSection('interviews',`<div class="panel large-page-panel"><div class="panel-head split"><div><span class="eyebrow">INTERVIEW MANAGEMENT</span><h3>Interviews & Follow-ups</h3></div><button class="btn primary" id="addInterviewBtn">+ Schedule Interview</button></div><div id="interviewManager"></div></div>`);
    addSection('tracker',`<div class="panel large-page-panel"><div class="panel-head"><span class="eyebrow">RECRUITER TRACKER</span><h3>Candidate Submission Tracker</h3></div><div id="trackerManager"></div></div>`);
    addSection('analytics',`<div class="panel large-page-panel"><div class="panel-head"><span class="eyebrow">ANALYTICS</span><h3>Recruitment Analytics</h3></div><div id="analyticsManager"></div></div>`);
  }

  const originalGoto=window.gotoView;
  window.gotoView=function(id){
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
    const titles={dashboard:'Recruitment Dashboard',requirements:'Job Profiles & JD Intelligence',screening:'New Resume Screening',candidates:'Candidate CV Library',history:'Candidate History',interviews:'Interview Management',tracker:'Candidate Submission Tracker',analytics:'Recruitment Analytics'};
    const t=document.getElementById('pageTitle');if(t)t.textContent=titles[id]||'Talent Buddy';
    if(id==='interviews')renderInterviews();if(id==='tracker')renderTracker();if(id==='analytics')renderAnalytics();
  };

  function enhanceRequirementHeader(){
    const host=document.getElementById('requirementCards');if(!host||document.getElementById('profileToolbar'))return;
    const toolbar=document.createElement('div');toolbar.id='profileToolbar';toolbar.className='profile-toolbar';toolbar.innerHTML=`<input id="profileSearch" placeholder="Search TSS ID, client, job title or skill"><select id="clientFilter"><option value="">All Clients</option></select><select id="locationFilter"><option value="">All Locations</option></select><select id="industryFilter"><option value="">All Industries</option><option>IT</option><option>NON-IT</option></select>`;host.parentNode.insertBefore(toolbar,host);
    ['profileSearch','clientFilter','locationFilter','industryFilter'].forEach(id=>document.getElementById(id).addEventListener('input',renderRequirements));
  }

  window.renderRequirements=function(){
    const host=document.getElementById('requirementCards');if(!host)return;enhanceRequirementHeader();
    const q=norm(document.getElementById('profileSearch')?.value||''),cf=document.getElementById('clientFilter')?.value||'',lf=document.getElementById('locationFilter')?.value||'',inf=document.getElementById('industryFilter')?.value||'';
    const clients=[...new Set(db.requirements.map(r=>r.client))].sort(),locs=[...new Set(db.requirements.map(r=>r.location).filter(Boolean))].sort();
    const csel=document.getElementById('clientFilter'),lsel=document.getElementById('locationFilter');
    if(csel&&csel.options.length<=1)csel.insertAdjacentHTML('beforeend',clients.map(x=>`<option>${esc(x)}</option>`).join(''));
    if(lsel&&lsel.options.length<=1)lsel.insertAdjacentHTML('beforeend',locs.map(x=>`<option>${esc(x)}</option>`).join(''));
    const rows=db.requirements.filter(r=>r.status==='Active').filter(r=>!q||norm(`${r.id} ${r.client} ${r.title} ${(r.skills||[]).join(' ')}`).includes(q)).filter(r=>!cf||r.client===cf).filter(r=>!lf||r.location===lf).filter(r=>!inf||r.industry===inf);
    const panelHead=host.closest('.panel')?.querySelector('.panel-head h3');if(panelHead)panelHead.innerHTML=`Requirements & JD Intelligence <span class="profile-count">· ${rows.length} active profiles</span>`;
    host.innerHTML=rows.map(r=>{const skills=r.skills||[],visible=skills.slice(0,8),extra=Math.max(0,skills.length-visible.length);return `<article class="req-card"><span class="eyebrow">${esc(r.id)} · ${esc(r.client)}</span><h4>${esc(r.title)}</h4><div class="req-meta"><span>${esc(r.location||'Not provided')}</span><span>•</span><span>${esc(r.experience||'Not provided')}</span><span>•</span>${statusBadge(r.status)}</div><p class="req-summary">${esc(r.responsibilities||`Screen candidates against the client-confirmed requirements for ${r.title}.`)}</p><div class="skill-cloud">${visible.map(s=>`<span class="skill ${r.aiSuggested?'ai':''}">${esc(s)}${r.aiSuggested?' · AI':''}</span>`).join('')}</div>${extra?`<div class="more-skills">+ ${extra} more skills</div>`:''}<div class="card-actions"><button class="btn ghost edit-req" data-id="${r.id}">Edit JD</button><button class="btn primary screen-req" data-id="${r.id}">Screen Candidate</button></div></article>`}).join('')||'<div class="section-empty">No active requirements match these filters.</div>';
    host.querySelectorAll('.edit-req').forEach(b=>b.onclick=()=>openRequirement(b.dataset.id));host.querySelectorAll('.screen-req').forEach(b=>b.onclick=()=>{screenRequirement.value=b.dataset.id;updateSelectedRequirement();gotoView('screening')});
  };

  function renderInterviews(){
    const el=document.getElementById('interviewManager');if(!el)return;const arr=db.interviews||[];
    el.innerHTML=arr.length?arr.map(i=>`<div class="interview-row"><strong>${esc(i.candidate||'Candidate')}</strong><span>${esc(i.position||'-')}</span><span>${esc(i.date||'-')} ${esc(i.time||'')}</span><span>${statusBadge(i.status||'Scheduled')}</span></div>`).join(''):'<div class="section-empty">No interviews scheduled yet. This section will sync with Supabase once backend keys are connected.</div>';
  }
  function renderTracker(){
    const el=document.getElementById('trackerManager');if(!el)return;const screenings=db.screenings||[];
    el.innerHTML=screenings.length?screenings.slice().reverse().map(s=>{const c=db.candidates.find(x=>x.id===s.candidateId),r=db.requirements.find(x=>x.id===s.requirementId);return `<div class="tracker-row"><strong>${esc(c?.name||'Candidate')}</strong><span>${esc(r?.client||'-')} · ${esc(r?.title||'-')}</span><span>${s.score}/100 · ${esc(s.recommendation)}</span><span>${esc(s.recruiterDecision||'Pending')}</span></div>`}).join(''):'<div class="section-empty">Shortlisted/submitted candidates will appear here automatically.</div>';
  }
  function renderAnalytics(){
    const el=document.getElementById('analyticsManager');if(!el)return;const a=activeReqs(),s=db.screenings||[],c=db.candidates||[],strong=s.filter(x=>x.recommendation==='Strong Match').length;
    el.innerHTML=`<div class="analytics-kpis"><div class="analytics-kpi"><span>ACTIVE REQUIREMENTS</span><strong>${a.length}</strong></div><div class="analytics-kpi"><span>CANDIDATES</span><strong>${c.length}</strong></div><div class="analytics-kpi"><span>SCREENINGS</span><strong>${s.length}</strong></div><div class="analytics-kpi"><span>STRONG MATCHES</span><strong>${strong}</strong></div></div><div class="utility-grid"><div class="utility-card"><span class="eyebrow">CLIENT COVERAGE</span><h3>${new Set(a.map(x=>x.client)).size} Active Clients</h3><p>Active requirement distribution across current TSS clients.</p></div><div class="utility-card"><span class="eyebrow">CV REDISCOVERY</span><h3>${calculateExistingMatches()} Existing Matches</h3><p>Previously stored candidates worth reviewing against active roles.</p></div><div class="utility-card"><span class="eyebrow">DATA QUALITY</span><h3>${a.filter(x=>!x.skills?.length||!x.responsibilities).length} Incomplete JDs</h3><p>Requirements needing more client-confirmed JD information.</p></div></div>`;
  }

  function wireGlobalSearch(){const input=document.querySelector('.global-search input');if(!input)return;input.addEventListener('keydown',e=>{if(e.key!=='Enter')return;gotoView('requirements');setTimeout(()=>{const s=document.getElementById('profileSearch');if(s){s.value=input.value;renderRequirements()}},0)})}

  async function syncFromBackend(){
    if(!backend?.enabled)return;
    try{const reqs=await backend.getActiveRequirements();if(reqs.length){db.requirements=reqs.map(r=>({id:r.tss_id||r.id,client:r.clients?.name||'Client',title:r.job_title,location:r.location||'Not provided',experience:r.experience_text||'Not provided',industry:r.industry||'',status:r.status||'Active',skills:r.mandatory_skills||[],preferred:r.preferred_skills||[],qualification:r.qualification||'',responsibilities:r.responsibilities||'',jdText:r.jd_text||'',aiSuggested:Boolean(r.skills_source==='ai_suggested')}));saveDB()}}catch(e){console.warn('Backend sync failed',e)}
  }

  addMissingSections();restoreAuth();wireGlobalSearch();setTimeout(()=>{enhanceRequirementHeader();renderRequirements();renderInterviews();renderTracker();renderAnalytics();syncFromBackend()},250);
})();
