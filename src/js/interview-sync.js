(function(){
  const DB=()=>typeof db!=='undefined'?db:null;
  const inFlight=new Map();

  function parseDateTime(date,time){
    if(!date)return null;
    const m=String(time||'11:00 AM').match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    let h=m?Number(m[1]):11,mm=m?Number(m[2]):0,ap=m?.[3]?.toUpperCase();
    if(ap==='PM'&&h<12)h+=12;
    if(ap==='AM'&&h===12)h=0;
    const d=new Date(`${date}T${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`);
    return isNaN(d)?null:d.toISOString();
  }

  function newRequestId(){
    if(crypto?.randomUUID)return crypto.randomUUID();
    const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const hex=[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }

  async function persistItem(item){
    const b=window.TSSBackend,store=DB();
    if(!b?.enabled||!store)throw new Error('Secure backend is unavailable. Please reconnect and try again.');
    if(!item)throw new Error('Interview details are missing.');
    if(item.serverId)return item;
    item.clientRequestId=item.clientRequestId||newRequestId();
    if(inFlight.has(item.clientRequestId))return inFlight.get(item.clientRequestId);

    const operation=(async()=>{
      const user=await b.currentUser();
      if(!user)throw new Error('Your session has expired. Please sign in again.');
      let cand=(store.candidates||[]).find(c=>String(c.serverId||c.id)===String(item.candidateId))||(store.candidates||[]).find(c=>String(c.name).toLowerCase()===String(item.candidate).toLowerCase());
      let candId=item.candidateId||cand?.serverId||cand?.id;
      if(!candId||!String(candId).includes('-')){
        const created=await b.createOrUpdateCandidate({name:item.candidate||'Candidate',email:cand?.email||item.email||'',phone:cand?.phone||'',location:cand?.location||'',totalExperience:cand?.totalExperience||null,designation:cand?.designation||'',noticePeriod:cand?.noticePeriod||''});
        candId=created.candidate.id;
        cand={...(cand||{}),serverId:candId,email:created.candidate.email||cand?.email||item.email||''};
      }

      let req=(store.requirements||[]).find(r=>String(r.serverId||'')===String(item.requirementServerId||''))||(store.requirements||[]).find(r=>String(r.id||'')===String(item.requirementId||''));
      if(!req)req=(store.requirements||[]).find(r=>r.title===item.position&&r.client===item.client);
      let reqId=item.requirementServerId||req?.serverId;
      if(!reqId&&req){
        const {data,error}=await b.client.from('requirements').select('id,job_title,clients(name)').eq('profile_key',req?.profileKey||req?.id).maybeSingle();
        if(error)throw error;reqId=data?.id;
      }
      if(!reqId)throw new Error('Exact requirement not synced. Please select the position again.');
      const scheduled=parseDateTime(item.date,item.time);
      if(!scheduled)throw new Error('Invalid interview date/time.');
      const exactPosition=item.position||req?.title||'',exactClient=item.client||req?.client||'';
      if(!exactPosition)throw new Error('Interview position is required.');

      const payload={id:item.clientRequestId,candidate_id:candId,requirement_id:reqId,scheduled_at:scheduled,status:'Scheduled',interview_type:item.mode||'Client Interview',interviewer:item.interviewer||null,location_or_link:item.locationOrLink||item.link||item.location||null,notes:item.notes||null,created_by:user.id,candidate_name_snapshot:item.candidate||cand?.name||'Candidate',candidate_email_snapshot:item.email||cand?.email||null,job_title_snapshot:exactPosition,client_name_snapshot:exactClient,timezone:'Asia/Kolkata',candidate_response:'Pending',reminder_status:'Pending'};
      let {data,error}=await b.client.from('interviews').insert(payload).select().single();
      if(error?.code==='23505'){
        const existing=await b.client.from('interviews').select('*').eq('id',item.clientRequestId).maybeSingle();
        if(existing.error||!existing.data)throw error;
        data=existing.data;error=null;
      }
      if(error)throw error;
      item.serverId=data.id;item.id=data.id;item.candidateId=candId;item.requirementServerId=reqId;item.email=payload.candidate_email_snapshot;item.reminderStatus='Pending';item.candidateResponse='Pending';item.status='Scheduled';item.syncState='synced';delete item.syncError;
      if((store.interviews||[]).includes(item))localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(store));
      return item;
    })();

    inFlight.set(item.clientRequestId,operation);
    try{return await operation}finally{inFlight.delete(item.clientRequestId)}
  }

  async function persistLatest(){
    const interviews=DB()?.interviews||[];
    const item=interviews.findLast?.(entry=>!entry.serverId)||interviews.slice().reverse().find(entry=>!entry.serverId);
    if(!item)return null;
    try{return await persistItem(item)}
    catch(error){item.syncState='failed';item.syncError=error?.message||String(error);console.warn(error);try{toast('Interview not scheduled: '+item.syncError)}catch{}throw error}
  }

  window.TSSInterviewSync={persistItem,persistLatest,newRequestId};
})();
