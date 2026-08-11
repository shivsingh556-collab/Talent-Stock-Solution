(function(){
  const $=id=>document.getElementById(id);
  const monthMap={jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11};
  const currentMonth=()=>{const d=new Date();return d.getFullYear()*12+d.getMonth()};

  function parseMonthToken(raw){
    if(!raw)return null;const s=String(raw).trim().toLowerCase().replace(/[,.]/g,' ');
    if(/present|current|till date|till now|now/.test(s))return currentMonth();
    let m=s.match(/\b(0?[1-9]|1[0-2])[\/-](19\d{2}|20\d{2})\b/);if(m)return Number(m[2])*12+(Number(m[1])-1);
    m=s.match(/\b(19\d{2}|20\d{2})[\/-](0?[1-9]|1[0-2])\b/);if(m)return Number(m[1])*12+(Number(m[2])-1);
    m=s.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(19\d{2}|20\d{2})\b/i);
    if(m)return Number(m[2])*12+monthMap[m[1].toLowerCase()];
    m=s.match(/\b(19\d{2}|20\d{2})\b/);if(m)return Number(m[1])*12;
    return null;
  }
  function rangeIntervals(text){
    const intervals=[];
    const token='(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[\\s,.\\/-]+(?:19\\d{2}|20\\d{2})|(?:0?[1-9]|1[0-2])[\\/-](?:19\\d{2}|20\\d{2})|(?:19\\d{2}|20\\d{2})[\\/-](?:0?[1-9]|1[0-2])|(?:19\\d{2}|20\\d{2})';
    const re=new RegExp('('+token+')\\s*(?:–|—|-|to|until|till)\\s*((?:Present|Current|Till Date|Till Now|Now)|'+token+')','gi');
    let m;while((m=re.exec(text))){let a=parseMonthToken(m[1]),b=parseMonthToken(m[2]);if(a==null||b==null)continue;if(b<a)[a,b]=[b,a];if(a>currentMonth()||b<1990*12)continue;b=Math.min(b,currentMonth());intervals.push([a,b+1]);}
    return intervals;
  }
  function unionMonths(intervals){if(!intervals.length)return 0;intervals.sort((a,b)=>a[0]-b[0]);let total=0,[s,e]=intervals[0];for(let i=1;i<intervals.length;i++){const [ns,ne]=intervals[i];if(ns<=e)e=Math.max(e,ne);else{total+=Math.max(0,e-s);[s,e]=[ns,ne]}}return total+Math.max(0,e-s)}
  function perfectExperience(text){
    const clean=String(text||'').replace(/\s+/g,' ');
    let m=clean.match(/(?:total\s+(?:professional\s+)?experience|overall\s+experience|professional\s+experience|work\s+experience)\s*(?:of|:|-)?\s*(\d{1,2}(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/i);
    if(m){const n=Number(m[1]);if(n>=0&&n<60)return Math.round(n*10)/10}
    m=clean.match(/\b(\d{1,2})\s*(?:years?|yrs?)\s*(?:and|,)?\s*(\d{1,2})\s*(?:months?|mos?)\b/i);
    if(m){const n=Number(m[1])+Number(m[2])/12;if(n<60)return Math.round(n*10)/10}
    m=clean.match(/\b(?:with|having|possess(?:ing)?|over)\s+(\d{1,2}(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?experience\b/i);
    if(m){const n=Number(m[1]);if(n<60)return Math.round(n*10)/10}
    const months=unionMonths(rangeIntervals(text));if(months>=1&&months<60*12)return Math.round((months/12)*10)/10;
    m=clean.match(/\b(\d{1,2}(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?experience\b/i);if(m){const n=Number(m[1]);if(n<60)return Math.round(n*10)/10}
    return '';
  }

  function patchExtractor(){
    if(!window.TSSStructured?.extractResume)return;
    const base=window.TSSStructured.extractResume;
    window.TSSStructured.extractResume=function(text){const out=base(text)||{};const exp=perfectExperience(text);if(exp!==''&&exp!=null)out.totalExperience=exp;return out};
  }

  function renderCandidateRows(filter=''){
    if(!window.db)return;const normFn=window.norm||((v='')=>String(v).toLowerCase());const escFn=window.esc||((v='')=>String(v));const q=normFn(filter);const rows=(db.candidates||[]).filter(c=>!q||normFn(`${c.name} ${c.email} ${c.phone} ${c.designation} ${c.location}`).includes(q));const wrap=$('candidateTableWrap');if(!wrap)return;
    wrap.innerHTML=rows.length?`<div style="overflow:auto"><table class="data-table"><thead><tr><th>Candidate</th><th>Experience</th><th>Location</th><th>Notice</th><th>Last Screened</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(c=>{const history=(db.screenings||[]).filter(s=>s.candidateId===c.id);const last=history.at(-1);return `<tr><td><strong>${escFn(c.name||'Candidate')}</strong><br><small>${escFn(c.email||'')} · ${escFn(c.phone||'')}</small><br><small>${escFn(c.designation||'')}</small></td><td><strong>${escFn(c.totalExperience||'-')}</strong> yrs</td><td>${escFn(c.location||'-')}</td><td>${escFn(c.noticePeriod||'-')}</td><td>${c.lastScreenedDate?new Date(c.lastScreenedDate).toLocaleDateString():'Never'}</td><td>${last?`<span class="badge blue">${escFn(last.recommendation||'Screened')}</span>`:'<span class="badge blue">Stored</span>'}</td><td><button class="btn danger delete-candidate-everywhere" data-id="${escFn(c.id)}">Delete Everywhere</button></td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty-state">No candidates stored yet</div>';
  }

  async function deleteEverywhere(id){
    const c=(db.candidates||[]).find(x=>String(x.id)===String(id));if(!c)return;
    if(!confirm(`Delete ${c.name||'this candidate'} everywhere? This will permanently remove the candidate, all resume versions/files, screenings, matches, notes and interviews. This cannot be undone.`))return;
    let done=()=>{};try{if(window.TSSProduction&&document.body){let e=document.getElementById('savingOverlay');if(!e){e=document.createElement('div');e.id='savingOverlay';e.className='saving-overlay';document.body.appendChild(e)}e.textContent='Deleting candidate securely…';e.hidden=false;done=()=>e.hidden=true}
      if(window.TSSBackend?.enabled&&window.TSSBackend.client){
        const client=window.TSSBackend.client;const serverId=c.serverId||c.id;
        const {data:versions,error:ve}=await client.from('resume_versions').select('storage_path').eq('candidate_id',serverId);if(ve)throw ve;
        const paths=(versions||[]).map(v=>v.storage_path).filter(Boolean);if(paths.length){const {error:se}=await client.storage.from('candidate-resumes').remove(paths);if(se)throw se}
        const {error:de}=await client.from('candidates').delete().eq('id',serverId);if(de)throw de;
      }
      const ids=new Set([String(c.id),String(c.serverId||'')]);db.screenings=(db.screenings||[]).filter(s=>!ids.has(String(s.candidateId)));db.candidates=(db.candidates||[]).filter(x=>String(x.id)!==String(c.id));db.interviews=(db.interviews||[]).filter(i=>String(i.candidateId||'')!==String(c.id)&&String(i.candidate||'')!==String(c.name||''));localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(db));try{renderAll()}catch{};try{renderOldSite()}catch{};renderCandidateRows($('candidateSearch')?.value||'');toast('Candidate deleted from everywhere');
    }catch(err){console.error(err);toast('Delete failed: '+(err.message||err))}finally{done()}
  }

  function wire(){patchExtractor();setTimeout(patchExtractor,1000);window.renderCandidates=renderCandidateRows;const search=$('candidateSearch');if(search)search.oninput=e=>renderCandidateRows(e.target.value);document.addEventListener('click',e=>{const b=e.target.closest('.delete-candidate-everywhere');if(b)deleteEverywhere(b.dataset.id)});const nav=$('nav');nav?.addEventListener('click',e=>{if(e.target.closest('[data-view="candidates"]'))setTimeout(()=>renderCandidateRows(search?.value||''),80)});setTimeout(()=>renderCandidateRows(search?.value||''),600)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
  window.TSSExperience={perfectExperience,rangeIntervals,unionMonths};
})();
