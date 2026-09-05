(function(){
  const FIELD_IDS=['candidateName','candidateEmail','candidatePhone','candidateExp','candidateLocation','candidateDesignation','candidateNotice','candidateCTC','candidateExpectedCTC'];
  let clearing=false;

  function clearCandidateIdentity(){
    if(clearing)return;
    clearing=true;
    try{
      FIELD_IDS.forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
      window.TSS_PARSED_RESUME=null;
    }finally{clearing=false}
  }

  function enrichLatest(){
    const p=window.TSS_PARSED_RESUME;if(!p||!window.db?.candidates?.length)return;
    const c=window.db.candidates.at(-1);if(!c)return;
    if(p.skills?.length)c.skills=p.skills;
    if(p.education)c.education=p.education;
    if(p.currentCompany)c.currentCompany=p.currentCompany;
    if(p.totalExperience&&!c.totalExperience)c.totalExperience=p.totalExperience;
    if(p.location&&!c.location)c.location=p.location;
    if(p.designation&&!c.designation)c.designation=p.designation;
    if(p.email&&!c.email)c.email=p.email;
    if(p.phone&&!c.phone)c.phone=p.phone;
    try{localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(window.db))}catch{}
  }

  function normalizeEmail(v){
    const s=String(v||'').trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)?s:'';
  }
  function normalizePhone(v){
    let d=String(v||'').replace(/\D/g,'');
    if(d.length>10)d=d.slice(-10);
    return /^[6-9]\d{9}$/.test(d)?d:'';
  }

  function hardenBackendDuplicateCheck(){
    const B=window.TSSBackend;
    if(!B||B.__strictDuplicateCheck||!B.client||!B.currentUser)return;
    B.__strictDuplicateCheck=true;
    B.createOrUpdateCandidate=async function(candidate){
      const client=B.client;
      const user=await B.currentUser();
      if(!user)throw new Error('Not signed in');

      const email=normalizeEmail(candidate?.email);
      const phone=normalizePhone(candidate?.phone);
      let existing=null;

      if(email){
        const {data,error}=await client.from('candidates').select('*').ilike('email',email).limit(1).maybeSingle();
        if(error)throw error;
        existing=data||null;
      }
      if(!existing&&phone){
        // Check normalized Indian phone forms without treating partial/invalid numbers as duplicates.
        const variants=[phone,`+91${phone}`,`91${phone}`];
        for(const v of variants){
          const {data,error}=await client.from('candidates').select('*').eq('phone',v).limit(1).maybeSingle();
          if(error)throw error;
          if(data){existing=data;break}
        }
      }
      if(existing)return {duplicate:true,candidate:existing};

      const payload={
        candidate_name:String(candidate?.name||'').trim(),
        email:email||null,
        phone:phone||null,
        current_location:candidate?.location||null,
        preferred_location:candidate?.preferredLocation||null,
        total_experience:candidate?.totalExperience||null,
        relevant_experience:candidate?.relevantExperience||null,
        current_company:candidate?.currentCompany||null,
        current_designation:candidate?.designation||null,
        skills:candidate?.skills||[],
        education:candidate?.education||null,
        notice_period:candidate?.noticePeriod||null,
        current_ctc:candidate?.currentCTC||null,
        expected_ctc:candidate?.expectedCTC||null,
        uploaded_by:user.id
      };
      const {data,error}=await client.from('candidates').insert(payload).select().single();
      if(error)throw error;
      return {duplicate:false,candidate:data};
    };
  }

  function wire(){
    const resumeFile=document.getElementById('resumeFile');
    const resumeText=document.getElementById('resumeText');
    // Capture phase runs before the legacy/parser handlers, ensuring a genuinely new resume
    // never inherits the previous candidate's identity/contact values.
    resumeFile?.addEventListener('change',e=>{if(e.target.files?.[0])clearCandidateIdentity()},true);
    resumeText?.addEventListener('paste',()=>clearCandidateIdentity(),true);
    document.getElementById('screenBtn')?.addEventListener('click',()=>setTimeout(enrichLatest,30));
    hardenBackendDuplicateCheck();
    setTimeout(hardenBackendDuplicateCheck,250);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();