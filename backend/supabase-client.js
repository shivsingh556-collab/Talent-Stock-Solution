// Talent Buddy Supabase client wrapper.
(function(){
  const cfg = window.TSS_SUPABASE_CONFIG || {};
  const hasConfig = Boolean(cfg.url && cfg.anonKey && window.supabase?.createClient);
  const client = hasConfig ? window.supabase.createClient(cfg.url, cfg.anonKey) : null;

  async function currentUser(){
    if(!client) return null;
    const { data, error } = await client.auth.getUser();
    if(error) throw error;
    return data.user || null;
  }

  async function signIn(email,password){
    if(!client) throw new Error('Supabase is not configured');
    const { data, error } = await client.auth.signInWithPassword({email,password});
    if(error) throw error;
    return data;
  }

  async function signOut(){
    if(!client) return;
    const { error } = await client.auth.signOut();
    if(error) throw error;
  }

  async function getActiveRequirements(){
    if(!client) return [];
    const { data, error } = await client
      .from('requirements')
      .select('*, clients(name)')
      .eq('status','Active')
      .order('created_at',{ascending:true});
    if(error) throw error;
    return data || [];
  }

  // Seeds/updates the browser master into Supabase after an authenticated TSS user signs in.
  // profile_key is the true unique identifier because the uploaded workbook contains a duplicate visible TSS040.
  async function syncMasterRequirements(requirements=[]){
    if(!client || !Array.isArray(requirements) || !requirements.length) return {synced:0, skipped:0};
    const user = await currentUser();
    if(!user) return {synced:0, skipped:requirements.length, reason:'not_signed_in'};

    const { data:existingClients, error:clientReadError } = await client.from('clients').select('id,name');
    if(clientReadError) throw clientReadError;
    const clientMap = new Map((existingClients||[]).map(c=>[String(c.name).toLowerCase(),c.id]));

    for(const name of [...new Set(requirements.map(r=>String(r.client||'').trim()).filter(Boolean))]){
      const key=name.toLowerCase();
      if(clientMap.has(key)) continue;
      const { data, error } = await client.from('clients').insert({name,created_by:user.id}).select('id,name').single();
      if(error){
        // Another session may have inserted the same client; re-read it instead of failing the whole sync.
        const { data:again } = await client.from('clients').select('id,name').eq('name',name).maybeSingle();
        if(!again) throw error;
        clientMap.set(key,again.id);
      } else clientMap.set(key,data.id);
    }

    const { data:existingReqs, error:reqReadError } = await client.from('requirements').select('id,profile_key,tss_id');
    if(reqReadError) throw reqReadError;
    const reqMap = new Map((existingReqs||[]).map(r=>[r.profile_key||r.tss_id,r]));
    let synced=0, skipped=0;

    for(const r of requirements){
      if(r.status && r.status!=='Active'){ skipped++; continue; }
      const profileKey=r.profileKey || r.id;
      const clientId=clientMap.get(String(r.client||'').toLowerCase());
      if(!profileKey || !clientId){ skipped++; continue; }
      const payload={
        profile_key:profileKey,
        tss_id:r.requirementId || r.id,
        client_id:clientId,
        job_title:r.title || 'Untitled Requirement',
        location:r.location || null,
        experience_text:r.experience || null,
        salary_range:r.salaryRange || null,
        industry:r.industry || null,
        qualification:r.qualification || null,
        responsibilities:r.responsibilities || null,
        jd_text:r.jdText || null,
        status:'Active',
        mandatory_skills:Array.isArray(r.skills)?r.skills:[],
        preferred_skills:Array.isArray(r.preferred)?r.preferred:[],
        ai_suggested_skills:r.aiSuggested && Array.isArray(r.skills)?r.skills:[],
        ai_skills_approved:!r.aiSuggested,
        updated_by:user.id
      };
      const existing=reqMap.get(profileKey);
      if(existing){
        const { error }=await client.from('requirements').update(payload).eq('id',existing.id);
        // Requirement may have been created by another recruiter; RLS can block updates. Read access still works, so skip safely.
        if(error){ skipped++; continue; }
      } else {
        const { data, error }=await client.from('requirements').insert({...payload,created_by:user.id}).select('id,profile_key,tss_id').single();
        if(error) throw error;
        reqMap.set(profileKey,data);
      }
      synced++;
    }
    return {synced,skipped};
  }

  async function createOrUpdateCandidate(candidate){
    if(!client) throw new Error('Supabase is not configured');
    const user = await currentUser();
    if(!user) throw new Error('Not signed in');
    let existing = null;
    if(candidate.email){
      const { data } = await client.from('candidates').select('*').ilike('email',candidate.email).maybeSingle();
      existing = data;
    }
    if(!existing && candidate.phone){
      const { data } = await client.from('candidates').select('*').eq('phone',candidate.phone).maybeSingle();
      existing = data;
    }
    if(existing) return { duplicate:true, candidate:existing };
    const payload = {
      candidate_name:candidate.name,
      email:candidate.email || null,
      phone:candidate.phone || null,
      current_location:candidate.location || null,
      preferred_location:candidate.preferredLocation || null,
      total_experience:candidate.totalExperience || null,
      relevant_experience:candidate.relevantExperience || null,
      current_company:candidate.currentCompany || null,
      current_designation:candidate.designation || null,
      skills:candidate.skills || [],
      education:candidate.education || null,
      notice_period:candidate.noticePeriod || null,
      current_ctc:candidate.currentCTC || null,
      expected_ctc:candidate.expectedCTC || null,
      uploaded_by:user.id
    };
    const { data, error } = await client.from('candidates').insert(payload).select().single();
    if(error) throw error;
    return { duplicate:false, candidate:data };
  }

  async function uploadResume(candidateId,file,hash){
    if(!client) throw new Error('Supabase is not configured');
    const user = await currentUser();
    if(!user) throw new Error('Not signed in');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const path = `${user.id}/${candidateId}/${Date.now()}-${safeName}`;
    const { error:uploadError } = await client.storage.from('candidate-resumes').upload(path,file,{upsert:false});
    if(uploadError) throw uploadError;
    const { data, error } = await client.from('resume_versions').insert({
      candidate_id:candidateId,
      storage_path:path,
      original_filename:file.name,
      mime_type:file.type,
      file_size:file.size,
      file_hash:hash || null,
      uploaded_by:user.id
    }).select().single();
    if(error) throw error;
    return data;
  }

  async function saveScreening(screening){
    if(!client) throw new Error('Supabase is not configured');
    const user = await currentUser();
    if(!user) throw new Error('Not signed in');
    const payload = {...screening, screened_by:user.id};
    const { data, error } = await client.from('screenings').insert(payload).select().single();
    if(error) throw error;
    await client.from('candidates').update({last_screened_at:new Date().toISOString()}).eq('id',screening.candidate_id);
    return data;
  }

  async function candidateHistory(candidateId){
    if(!client) return [];
    const { data, error } = await client
      .from('screenings')
      .select('*, requirements(tss_id,job_title,clients(name)), resume_versions(original_filename,uploaded_at)')
      .eq('candidate_id',candidateId)
      .order('screened_at',{ascending:false});
    if(error) throw error;
    return data || [];
  }

  async function existingMatches(requirementId){
    if(!client) return [];
    const { data, error } = await client
      .from('candidate_requirement_matches')
      .select('*, candidates(*)')
      .eq('requirement_id',requirementId)
      .eq('ignored',false)
      .order('match_score',{ascending:false});
    if(error) throw error;
    return data || [];
  }

  window.TSSBackend = {
    enabled:hasConfig,
    client,
    currentUser,
    signIn,
    signOut,
    getActiveRequirements,
    syncMasterRequirements,
    createOrUpdateCandidate,
    uploadResume,
    saveScreening,
    candidateHistory,
    existingMatches
  };
})();
