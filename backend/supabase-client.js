// Talent Buddy Supabase client wrapper.
// This file is intentionally inactive until window.TSS_SUPABASE_CONFIG is provided.

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

  async function createOrUpdateCandidate(candidate){
    if(!client) throw new Error('Supabase is not configured');
    const user = await currentUser();
    if(!user) throw new Error('Not signed in');

    // duplicate detection: email first, then phone
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
    createOrUpdateCandidate,
    uploadResume,
    saveScreening,
    candidateHistory,
    existingMatches
  };
})();
