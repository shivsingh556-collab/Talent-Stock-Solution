// Authoritative active-requirement hydration. Finite retries only; no render loop.
(function(){
  let finished=false;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const keyFor=row=>row.profile_key||`${row.tss_id}::${row.job_title}`;
  const localMatch=(row,locals)=>locals.find(r=>(r.profileKey&&r.profileKey===row.profile_key)||((r.requirementId||r.id)===row.tss_id&&String(r.title||'').trim()===String(row.job_title||'').trim()));
  const safeId=(row,local)=>local?.id||(row.tss_id==='TSS040'&&/service engineer/i.test(row.job_title||'')?'TSS040__INTELMAC':row.tss_id);

  function mapRow(row,locals){
    const local=localMatch(row,locals)||{};
    return {
      ...local,
      id:safeId(row,local),
      requirementId:row.tss_id,
      profileKey:keyFor(row),
      serverId:row.id,
      client:row.clients?.name||local.client||'Client',
      clientOwner:row.client_owner||local.clientOwner||'',
      title:row.job_title||local.title||'Untitled Requirement',
      location:row.location||local.location||'Not provided',
      experience:row.experience_text||local.experience||'Not provided',
      salaryRange:row.salary_range||local.salaryRange||'Not provided',
      industry:row.industry||local.industry||'',
      qualification:row.qualification||local.qualification||'Not provided',
      responsibilities:row.responsibilities||local.responsibilities||'',
      jdText:row.jd_text||local.jdText||'',
      status:'Active',
      skills:Array.isArray(row.mandatory_skills)&&row.mandatory_skills.length?row.mandatory_skills:(local.skills||[]),
      preferred:Array.isArray(row.preferred_skills)&&row.preferred_skills.length?row.preferred_skills:(local.preferred||[]),
      aiSuggested:Boolean(row.ai_suggested_skills?.length&&!row.ai_skills_approved)
    };
  }

  function paintCount(n){
    ['navReqCount','clientReqCount'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=String(n)});
    const chip=document.getElementById('activeReqChip');if(chip)chip.textContent=`${n} active requirements`;
  }

  async function hydrate(){
    if(finished||!window.TSSBackend?.enabled||!window.db)return false;
    const client=window.TSSBackend.client;
    const {data:{session}}=await client.auth.getSession();
    if(!session)return false;
    const {data,error}=await client.from('requirements').select('*,clients(name)').eq('status','Active').order('tss_id',{ascending:true});
    if(error)throw error;
    if(!Array.isArray(data)||data.length<47){console.warn('TODO AI: expected 47 active requirements, received',data?.length||0);return false;}
    const locals=Array.isArray(db.requirements)?db.requirements:[];
    const seen=new Set();
    const rows=[];
    for(const row of data){
      const k=keyFor(row);if(seen.has(k))continue;seen.add(k);rows.push(mapRow(row,locals));
    }
    db.requirements=rows;
    try{localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(db))}catch{}
    try{if(typeof saveDB==='function')saveDB()}catch{}
    try{if(typeof renderAll==='function')renderAll()}catch(e){console.warn('renderAll',e)}
    try{if(typeof renderOldSite==='function')renderOldSite()}catch(e){console.warn('renderOldSite',e)}
    paintCount(rows.length);
    document.querySelectorAll('.client-role').forEach(el=>{
      const r=rows.find(x=>x.id===el.dataset.req);
      const pill=el.querySelector('strong i');if(r&&pill)pill.textContent=r.requirementId||r.id;
    });
    finished=rows.length>=47;
    console.info('TODO AI: hydrated active requirements from Supabase',rows.length);
    return finished;
  }

  async function boot(){
    const delays=[0,250,700,1400,2500,4000];
    for(const d of delays){if(finished)break;if(d)await wait(d);try{if(await hydrate())break}catch(e){console.warn('TODO AI requirement hydrate retry',e?.message||e)}}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('load',()=>setTimeout(()=>{if(!finished)boot()},150),{once:true});
  if(window.TSSBackend?.client?.auth?.onAuthStateChange){window.TSSBackend.client.auth.onAuthStateChange((event,session)=>{if(session&&(event==='SIGNED_IN'||event==='TOKEN_REFRESHED'||event==='INITIAL_SESSION')){finished=false;setTimeout(boot,50)}})}
  window.TSSLiveRequirements47={hydrate,boot};
})();
