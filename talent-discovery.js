(function(){
  const STORE_KEY='todo_talent_discovery_imports_v1';
  let selectedReqId='';
  let currentRows=[];
  let currentMode='balanced';
  let currentSource='all';

  const esc=v=>String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));
  const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9+#. ]/g,' ');
  const words=v=>[...new Set(norm(v).split(/\s+/).filter(x=>x.length>1))];
  const splitSkills=v=>Array.isArray(v)?v.filter(Boolean):String(v||'').split(/[,;|\n]/).map(x=>x.trim()).filter(Boolean);
  const getImports=()=>{try{return JSON.parse(localStorage.getItem(STORE_KEY)||'[]')}catch{return[]}};
  const setImports=rows=>localStorage.setItem(STORE_KEY,JSON.stringify(rows));
  const getDb=()=>window.db||globalThis.db||null;
  const reqs=()=>getDb()?.requirements||[];
  const candidates=()=>getDb()?.candidates||[];

  function openView(){
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='talentDiscovery'));
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view==='talentDiscovery'));
    const title=document.getElementById('pageTitle'); if(title) title.textContent='Talent Discovery';
    renderRequirementOptions();
    runSearch();
  }

  function setupShell(){
    if(document.getElementById('talentDiscovery')) return;
    const nav=document.getElementById('nav');
    if(nav){
      const btn=document.createElement('button');
      btn.className='nav-item'; btn.dataset.view='talentDiscovery'; btn.innerHTML='<span>✦</span>Talent Discovery';
      btn.addEventListener('click',openView); nav.appendChild(btn);
    }
    const main=document.querySelector('.main-shell');
    if(!main) return;
    const section=document.createElement('section');
    section.id='talentDiscovery'; section.className='view';
    section.innerHTML=`
      <div class="section-head"><div><span>TALENT INTELLIGENCE</span><h1>Ideal Candidate Radar</h1><p>Rank the best available candidates for a live TODO AI requirement.</p></div><div class="td-head-actions"><button id="tdImportBtn" class="btn ghost">Import Profiles</button><button id="tdRun" class="blue-btn">Find Best Candidates</button></div></div>
      <div class="td-controls old-panel">
        <label>Requirement<select id="tdRequirement"></select></label>
        <label>Search Mode<select id="tdMode"><option value="balanced">Balanced · Target 25</option><option value="strict">Strict · Top 10–15</option><option value="broad">Broad · Target 30</option></select></label>
        <label>Source<select id="tdSource"><option value="all">All Sources</option><option value="internal">TODO AI Database</option><option value="linkedin">LinkedIn Import</option><option value="resdex">Naukri / Resdex</option><option value="other">Other Imports</option></select></label>
      </div>
      <div class="td-kpis"><div><small>Profiles evaluated</small><b id="tdEvaluated">0</b></div><div><small>Priority matches</small><b id="tdPriority">0</b></div><div><small>Strong matches</small><b id="tdStrong">0</b></div><div><small>Shortlist target</small><b id="tdTarget">25</b></div></div>
      <div class="td-layout"><section class="old-panel"><div class="panel-title"><div><h3>Ranked Candidates</h3><span id="tdSummary">Select a requirement</span></div><button id="tdExport" class="text-btn">Export shortlist →</button></div><div id="tdResults"></div></section>
      <aside><div class="old-panel"><h3>Ideal Candidate Blueprint</h3><div id="tdBlueprint"></div></div><div class="old-panel td-source-card"><h3>Source Connectors</h3><div class="td-source-row"><b>TODO AI Database</b><span>Live</span></div><p>Existing candidate library is searched automatically.</p><div class="td-source-row"><b>LinkedIn</b><span>Import</span></div><p>Use authorized LinkedIn Recruiter / profile exports or URLs. No scraping.</p><div class="td-source-row"><b>Naukri / Resdex</b><span>Import</span></div><p>Import recruiter-selected profiles or CSV exports for ranking.</p></div></aside></div>
      <dialog id="tdImportDialog"><form method="dialog"><div class="dialog-head"><div><span class="purple-label">EXTERNAL TALENT SOURCE</span><h3>Import Candidate Profiles</h3></div><button class="icon-btn" value="cancel">×</button></div><p class="td-help">Upload a CSV with columns such as name, title, company, location, experience, skills, source, profile_url. This can come from an authorized LinkedIn, Resdex, referral or other export.</p><input id="tdImportFile" type="file" accept=".csv,.txt" /><textarea id="tdImportText" rows="8" placeholder="Or paste CSV rows here"></textarea><div class="actions"><button value="cancel" class="btn ghost">Cancel</button><button type="button" id="tdImportSave" class="blue-btn">Import & Rank</button></div></form></dialog>`;
    main.appendChild(section);
    document.getElementById('tdRun')?.addEventListener('click',runSearch);
    document.getElementById('tdRequirement')?.addEventListener('change',e=>{selectedReqId=e.target.value;runSearch()});
    document.getElementById('tdMode')?.addEventListener('change',e=>{currentMode=e.target.value;runSearch()});
    document.getElementById('tdSource')?.addEventListener('change',e=>{currentSource=e.target.value;runSearch()});
    document.getElementById('tdImportBtn')?.addEventListener('click',()=>document.getElementById('tdImportDialog')?.showModal());
    document.getElementById('tdImportFile')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(f)document.getElementById('tdImportText').value=await f.text()});
    document.getElementById('tdImportSave')?.addEventListener('click',importCsv);
    document.getElementById('tdExport')?.addEventListener('click',exportCsv);
  }

  function enhanceRequirementCards(){
    document.querySelectorAll('.screen-req[data-id]').forEach(btn=>{
      if(btn.parentElement?.querySelector('.td-find-btn')) return;
      const b=document.createElement('button'); b.className='btn ghost td-find-btn'; b.textContent='Find Talent'; b.dataset.id=btn.dataset.id;
      b.onclick=()=>{selectedReqId=b.dataset.id;openView();const sel=document.getElementById('tdRequirement');if(sel)sel.value=selectedReqId;runSearch()};
      btn.before(b);
    });
  }

  function renderRequirementOptions(){
    const select=document.getElementById('tdRequirement'); if(!select) return;
    const active=reqs().filter(r=>!['closed','fulfilled','joined-tss'].includes(String(r.status||'').toLowerCase()));
    if(!selectedReqId||!active.some(r=>String(r.id)===String(selectedReqId))) selectedReqId=active[0]?.id||'';
    select.innerHTML=active.map(r=>`<option value="${esc(r.id)}">${esc(r.requirementId||r.id)} — ${esc(r.client)} — ${esc(r.title)}</option>`).join('');
    select.value=selectedReqId;
  }

  function expRange(text){const nums=String(text||'').match(/\d+(?:\.\d+)?/g)?.map(Number)||[];return{min:nums[0]||0,max:nums[1]||Infinity}}
  function skillMatch(candidateSkills, required){
    const c=splitSkills(candidateSkills).map(norm); const matched=[], missing=[];
    for(const s of required){const n=norm(s);if(c.some(x=>x.includes(n)||n.includes(x)))matched.push(s);else missing.push(s)}
    return{matched,missing,pct:required.length?matched.length/required.length:1};
  }
  function titleSimilarity(a,b){const A=words(a),B=words(b);if(!A.length||!B.length)return 0;return A.filter(x=>B.includes(x)).length/Math.max(A.length,B.length)}
  function scoreRow(c,r){
    const mandatory=splitSkills(r.skills),preferred=splitSkills(r.preferred),sm=skillMatch(c.skills,mandatory),sp=skillMatch(c.skills,preferred);
    const er=expRange(r.experience),ce=Number(c.totalExperience??c.experience??0)||0;let expScore=er.min?Math.max(0,1-Math.abs(ce-er.min)/Math.max(er.min,1)):0.6;if(ce>=er.min&&ce<=er.max)expScore=1;
    const locReq=norm(r.location),loc=norm(c.location||c.currentLocation||'');const locScore=!locReq||locReq.includes('pan india')||locReq.includes('remote')?1:(loc&&locReq.split(' ').some(x=>x.length>2&&loc.includes(x))?1:.35);
    const roleScore=titleSimilarity(c.designation||c.title||'',r.title||'');
    let score=Math.round(sm.pct*55+sp.pct*10+expScore*15+locScore*10+roleScore*10);
    const existing=(getDb()?.screenings||[]).filter(s=>String(s.candidateId)===String(c.id)&&[r.id,r.serverId,r.profileKey,r.requirementId].filter(Boolean).map(String).includes(String(s.requirementId))).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0))[0];
    if(existing?.score!=null)score=Math.round(score*.45+Number(existing.score)*.55);
    return{...c,score,matched:sm.matched,missing:sm.missing,preferredMatched:sp.matched,source:c.source||'TODO AI Database',sourceType:c.sourceType||'internal'};
  }

  function importedRows(){return getImports().map(x=>({...x,id:x.id||`import-${x.source}-${x.profileUrl||x.name}`,sourceType:x.sourceType||(/linkedin/i.test(x.source)?'linkedin':/resdex|naukri/i.test(x.source)?'resdex':'other')}))}
  function target(){return currentMode==='strict'?15:currentMode==='broad'?30:25}
  function threshold(){return currentMode==='strict'?72:currentMode==='broad'?30:45}
  function sourceAllowed(r){return currentSource==='all'||r.sourceType===currentSource}
  function runSearch(){
    renderRequirementOptions(); const r=reqs().find(x=>String(x.id)===String(selectedReqId)); if(!r)return;
    const internal=candidates().map(c=>({...c,source:'TODO AI Database',sourceType:'internal'}));
    const all=[...internal,...importedRows()].map(c=>scoreRow(c,r)).filter(sourceAllowed).sort((a,b)=>b.score-a.score);
    const qualified=all.filter(x=>x.score>=threshold()); currentRows=qualified.slice(0,target());
    renderBlueprint(r); renderRows(r,all,qualified);
  }
  function renderBlueprint(r){
    const box=document.getElementById('tdBlueprint');if(!box)return;
    box.innerHTML=`<div class="td-blueprint-title">${esc(r.title)}</div><small>${esc(r.client)} · ${esc(r.location||'Location flexible')} · ${esc(r.experience||'Experience not set')}</small><div class="td-label">Mandatory</div><div class="skill-cloud">${splitSkills(r.skills).map(s=>`<span class="skill">${esc(s)}</span>`).join('')||'<span class="skill">Not specified</span>'}</div><div class="td-label">Preferred</div><div class="skill-cloud">${splitSkills(r.preferred).map(s=>`<span class="skill">${esc(s)}</span>`).join('')||'<span class="skill">None listed</span>'}</div><div class="td-label">Ranking logic</div><p>Mandatory skills 55% · Experience 15% · Location 10% · Role similarity 10% · Preferred skills 10%</p>`;
  }
  function band(s){return s>=85?'Priority':s>=70?'Strong':'Potential'}
  function renderRows(r,all,qualified){
    const results=document.getElementById('tdResults'); if(!results)return;
    document.getElementById('tdEvaluated').textContent=all.length; document.getElementById('tdPriority').textContent=all.filter(x=>x.score>=85).length; document.getElementById('tdStrong').textContent=all.filter(x=>x.score>=70).length; document.getElementById('tdTarget').textContent=target();
    document.getElementById('tdSummary').textContent=`${currentRows.length} shown from ${qualified.length} qualifying profiles`;
    if(!currentRows.length){results.innerHTML='<div class="empty-state">No suitable profiles found yet. Import LinkedIn / Resdex profiles or switch to Broad mode.</div>';return}
    results.innerHTML=currentRows.map((c,i)=>`<article class="td-candidate"><div class="td-rank">#${i+1} · ${esc(c.source)}</div><div class="td-candidate-head"><div><h3>${esc(c.name||'Candidate')}</h3><p>${esc(c.designation||c.title||'Role not provided')} ${c.currentCompany||c.company?`· ${esc(c.currentCompany||c.company)}`:''}</p><small>${esc(c.location||'Location not provided')} · ${esc(c.totalExperience??c.experience??'—')} yrs</small></div><div class="td-score ${c.score>=85?'good':c.score>=70?'mid':''}">${c.score}%<small>${band(c.score)}</small></div></div><div class="skill-cloud">${c.matched.map(s=>`<span class="skill">✓ ${esc(s)}</span>`).join('')}${c.missing.slice(0,4).map(s=>`<span class="skill td-gap">Gap: ${esc(s)}</span>`).join('')}</div><p class="td-why">Why fit: ${c.matched.length?`${c.matched.length} mandatory skills matched`:'role/experience alignment'}${c.missing.length?`; ${c.missing.length} mandatory gap${c.missing.length===1?'':'s'}`:''}.</p><div class="card-actions">${c.profileUrl?`<button class="btn ghost td-profile" data-url="${esc(c.profileUrl)}">View Profile</button>`:''}<button class="btn ghost td-save" data-id="${esc(c.id)}">Add to Candidate Library</button><button class="btn primary td-screen" data-id="${esc(c.id)}">Screen Candidate</button></div></article>`).join('');
    results.querySelectorAll('.td-profile').forEach(b=>b.onclick=()=>window.open(b.dataset.url,'_blank','noopener'));
    results.querySelectorAll('.td-save').forEach(b=>b.onclick=()=>saveCandidate(b.dataset.id));
    results.querySelectorAll('.td-screen').forEach(b=>b.onclick=()=>screenCandidate(b.dataset.id,r));
  }

  async function saveCandidate(id){
    const c=currentRows.find(x=>String(x.id)===String(id)); if(!c)return;
    if(c.sourceType==='internal'){window.toast?.('Candidate already exists in TODO AI');return}
    try{const backend=window.TSSBackend;if(!backend?.enabled)throw new Error('Backend unavailable');const result=await backend.createOrUpdateCandidate({name:c.name,email:c.email||'',phone:c.phone||'',location:c.location||'',preferredLocation:c.preferredLocation||'',totalExperience:c.totalExperience??c.experience??'',relevantExperience:c.relevantExperience??'',currentCompany:c.currentCompany||c.company||'',designation:c.designation||c.title||'',skills:splitSkills(c.skills),education:c.education||'',noticePeriod:c.noticePeriod||'',currentCTC:c.currentCTC||'',expectedCTC:c.expectedCTC||''});await window.TSSProduction?.hydrate?.();window.toast?.(result.duplicate?'Candidate already exists':'Candidate added to library')}catch(e){window.toast?.('Could not add candidate: '+(e.message||e))}
  }
  function screenCandidate(id,r){
    const c=currentRows.find(x=>String(x.id)===String(id)); if(!c)return;
    if(c.sourceType!=='internal'){window.toast?.('Add this imported profile to Candidate Library first');return}
    const sr=document.getElementById('screenRequirement');if(sr){sr.value=r.id;sr.dispatchEvent(new Event('change'))}
    window.gotoView?.('screening');
    setTimeout(()=>{const n=document.getElementById('candidateName');if(n)n.value=c.name||'';const e=document.getElementById('candidateEmail');if(e)e.value=c.email||'';const p=document.getElementById('candidatePhone');if(p)p.value=c.phone||'';const ex=document.getElementById('candidateExp');if(ex)ex.value=c.totalExperience??'';const l=document.getElementById('candidateLocation');if(l)l.value=c.location||'';const d=document.getElementById('candidateDesignation');if(d)d.value=c.designation||''},100);
  }

  function parseCsv(text){
    const lines=String(text||'').split(/\r?\n/).filter(x=>x.trim());if(lines.length<2)return[];
    const parse=line=>{const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='\"'){if(q&&line[i+1]==='\"'){cur+='\"';i++}else q=!q}else if(ch===','&&!q){out.push(cur.trim());cur=''}else cur+=ch}out.push(cur.trim());return out};
    const head=parse(lines[0]).map(x=>norm(x).replace(/ /g,'_'));
    return lines.slice(1).map((line,i)=>{const vals=parse(line),o={};head.forEach((h,j)=>o[h]=vals[j]||'');const source=o.source||'Other Import';return{id:`import-${Date.now()}-${i}`,name:o.name||o.candidate_name||o.full_name,title:o.title||o.designation||o.current_title,designation:o.title||o.designation||o.current_title,company:o.company||o.current_company,location:o.location||o.current_location,experience:Number(o.experience||o.total_experience)||0,totalExperience:Number(o.experience||o.total_experience)||0,skills:splitSkills(o.skills),source,sourceType:/linkedin/i.test(source)?'linkedin':/resdex|naukri/i.test(source)?'resdex':'other',profileUrl:o.profile_url||o.linkedin_url||o.url||'',email:o.email||'',phone:o.phone||''}}).filter(x=>x.name);
  }
  function importCsv(){const text=document.getElementById('tdImportText')?.value||'';const rows=parseCsv(text);if(!rows.length){window.toast?.('No valid candidate rows found');return}setImports([...getImports(),...rows]);document.getElementById('tdImportDialog')?.close();window.toast?.(`${rows.length} profiles imported`);runSearch()}
  function exportCsv(){if(!currentRows.length){window.toast?.('No shortlist to export');return}const headers=['Rank','Name','Title','Company','Location','Experience','Match Score','Source','Profile URL'];const rows=currentRows.map((c,i)=>[i+1,c.name,c.designation||c.title||'',c.currentCompany||c.company||'',c.location||'',c.totalExperience??c.experience??'',c.score,c.source,c.profileUrl||'']);const csv=[headers,...rows].map(r=>r.map(v=>`\"${String(v??'').replace(/\"/g,'\"\"')}\"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='todo-ai-talent-shortlist.csv';a.click();URL.revokeObjectURL(a.href)}

  function boot(){setupShell();enhanceRequirementCards();renderRequirementOptions();const mo=new MutationObserver(()=>enhanceRequirementCards());const req=document.getElementById('requirementCards');if(req)mo.observe(req,{childList:true,subtree:true});window.TSSTalentDiscovery={open:openView,run:runSearch};}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,700));else setTimeout(boot,700);
})();