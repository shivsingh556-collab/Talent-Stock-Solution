// TODO AI authoritative active requirement sync. Finite retries only; Supabase is source of truth.
(function(){
  const $=id=>document.getElementById(id);
  let finished=false,running=false;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const backend=()=>window.TSSBackend;
  const serverKey=row=>row.profile_key||`${row.tss_id}::${row.job_title}`;

  function findLocal(row,locals){
    return locals.find(r=>(r.profileKey&&r.profileKey===row.profile_key)||((r.requirementId||r.id)===row.tss_id&&String(r.title||'').trim()===String(row.job_title||'').trim()));
  }
  function internalId(row,local){
    if(local?.id)return local.id;
    if(row.tss_id==='TSS040'&&/service engineer/i.test(row.job_title||''))return 'TSS040__INTELMAC';
    return row.tss_id;
  }
  function mapRow(row,locals){
    const local=findLocal(row,locals)||{};
    return {...local,
      id:internalId(row,local),requirementId:row.tss_id,profileKey:serverKey(row),serverId:row.id,
      client:row.clients?.name||local.client||'Client',clientOwner:row.client_owner||local.clientOwner||'',
      title:row.job_title||local.title||'Untitled Requirement',location:row.location||local.location||'Not provided',
      experience:row.experience_text||local.experience||'Not provided',salaryRange:row.salary_range||local.salaryRange||'Not provided',
      industry:row.industry||local.industry||'',qualification:row.qualification||local.qualification||'Not provided',
      responsibilities:row.responsibilities||local.responsibilities||'',jdText:row.jd_text||local.jdText||'',status:'Active',
      skills:Array.isArray(row.mandatory_skills)&&row.mandatory_skills.length?row.mandatory_skills:(local.skills||[]),
      preferred:Array.isArray(row.preferred_skills)&&row.preferred_skills.length?row.preferred_skills:(local.preferred||[]),
      aiSuggested:Boolean(row.ai_suggested_skills?.length&&!row.ai_skills_approved)
    };
  }
  function paint(n){
    if($('navReqCount'))$('navReqCount').textContent=String(n);
    if($('clientReqCount'))$('clientReqCount').textContent=String(n);
    if($('activeReqChip'))$('activeReqChip').textContent=`${n} active requirements`;
  }
  function fixVisibleIds(rows){
    document.querySelectorAll('.client-role').forEach(el=>{const r=rows.find(x=>x.id===el.dataset.req);const pill=el.querySelector('strong i');if(r&&pill)pill.textContent=r.requirementId||r.id;});
  }

  async function syncNow(){
    if(running||!backend()?.enabled||!window.db)return false;
    running=true;
    try{
      const c=backend().client;
      const {data:{session},error:sessionError}=await c.auth.getSession();
      if(sessionError||!session?.user)return false;
      const {data:reqs,error}=await c.from('requirements').select('*,clients(name)').eq('status','Active').order('tss_id',{ascending:true});
      if(error)throw error;
      if(!Array.isArray(reqs)||reqs.length<47){console.warn('TODO AI expected 47 active requirements but received',reqs?.length||0);return false;}
      const locals=Array.isArray(db.requirements)?db.requirements:[];
      const seen=new Set();const rows=[];
      for(const row of reqs){const k=serverKey(row);if(seen.has(k))continue;seen.add(k);rows.push(mapRow(row,locals));}
      db.requirements=rows;
      try{localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(db))}catch{}
      try{if(typeof saveDB==='function')saveDB()}catch{}
      try{if(typeof renderAll==='function')renderAll()}catch(e){console.warn('TODO AI renderAll',e)}
      try{if(typeof renderOldSite==='function')renderOldSite()}catch(e){console.warn('TODO AI renderOldSite',e)}
      paint(rows.length);fixVisibleIds(rows);
      finished=rows.length>=47;
      console.info('TODO AI active requirements hydrated:',rows.length);
      return finished;
    }finally{running=false;}
  }

  async function boot(){
    const delays=[0,250,600,1200,2200,3800];
    for(const delay of delays){if(finished)break;if(delay)await sleep(delay);try{if(await syncNow())break}catch(e){console.warn('TODO AI requirement sync retry',e?.message||e)}}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('load',()=>setTimeout(()=>{if(!finished)boot()},120),{once:true});
  const c=backend()?.client;
  if(c?.auth?.onAuthStateChange)c.auth.onAuthStateChange((event,session)=>{if(session?.user&&(event==='SIGNED_IN'||event==='TOKEN_REFRESHED'||event==='INITIAL_SESSION')){finished=false;setTimeout(boot,50)}});
  window.TSSRequirementsLiveSync={syncNow,boot};
})();
