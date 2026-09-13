// Verified Supabase session gate for TODO AI.
(function(){
  'use strict';
  const COMPANY_DOMAIN='@talent-stock.com';
  const INFO_EMAIL='info@talent-stock.com';
  const $=id=>document.getElementById(id);
  let verifying=null;

  function setWorkspaceVisible(visible){
    const workspace=$('workspace'),gate=$('loginGate');
    if(workspace){workspace.classList.toggle('hidden',!visible);workspace.setAttribute('aria-hidden',visible?'false':'true')}
    if(gate){gate.classList.toggle('hidden',visible);gate.setAttribute('aria-hidden',visible?'true':'false')}
  }

  function clearLegacySession(){
    try{localStorage.removeItem('tss_user_session')}catch{}
  }

  function cacheVerifiedSession(user,profile){
    const raw=String(profile?.full_name||user?.email||'Recruiter').split('@')[0];
    const name=raw.replace(/[._-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    try{localStorage.setItem('tss_user_session',JSON.stringify({email:user.email,name,role:String(profile?.role||'recruiter').toLowerCase(),verifiedAt:new Date().toISOString()}))}catch{}
    const profileName=$('profileName');if(profileName)profileName.textContent=name;
  }

  function applyFeatureAccess(user,profile){
    const email=String(user?.email||'').trim().toLowerCase();
    const role=String(profile?.role||'').trim().toLowerCase();
    const quickAllowed=role==='recruiter'||email===INFO_EMAIL;
    document.body.dataset.userRole=role||'unknown';
    document.body.dataset.quickScreeningAccess=quickAllowed?'allowed':'denied';
    window.TSS_AUTH_CONTEXT={user,profile,role,email,quickScreeningAllowed:quickAllowed};
    window.dispatchEvent(new CustomEvent('tss:auth-ready',{detail:window.TSS_AUTH_CONTEXT}));
  }

  function lockWorkspace(reason='signed_out'){
    document.body.dataset.authVerified='false';
    document.body.dataset.authState=reason;
    document.body.dataset.quickScreeningAccess='denied';
    delete document.body.dataset.userRole;
    window.TSS_AUTH_CONTEXT=null;
    clearLegacySession();
    setWorkspaceVisible(false);
  }

  async function verifySession(){
    if(verifying)return verifying;
    verifying=(async()=>{
      const backend=window.TSSBackend;
      if(!backend?.enabled||!backend?.client){lockWorkspace('backend_unavailable');return null}
      document.body.dataset.authState='checking';
      setWorkspaceVisible(false);
      let user=null;
      try{user=await backend.currentUser()}catch{user=null}
      const email=String(user?.email||'').trim().toLowerCase();
      if(!user||!email.endsWith(COMPANY_DOMAIN)){
        lockWorkspace(user?'domain_denied':'signed_out');
        return null;
      }
      let profile=null;
      try{
        const {data,error}=await backend.client.from('profiles').select('id,full_name,email,role').eq('id',user.id).maybeSingle();
        if(error)throw error;
        profile=data||null;
      }catch(error){
        console.warn('Profile verification failed',error?.message||error);
        lockWorkspace('profile_unverified');
        return null;
      }
      cacheVerifiedSession(user,profile);
      applyFeatureAccess(user,profile);
      document.body.dataset.authVerified='true';
      document.body.dataset.authState='authenticated';
      setWorkspaceVisible(true);
      try{window.renderOldSite?.()}catch{}
      return {user,profile};
    })().finally(()=>{verifying=null});
    return verifying;
  }

  function installAuthListener(){
    const client=window.TSSBackend?.client;
    if(!client?.auth?.onAuthStateChange)return;
    client.auth.onAuthStateChange((event)=>{
      if(event==='SIGNED_OUT'){lockWorkspace('signed_out');return}
      if(['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED','INITIAL_SESSION'].includes(event))setTimeout(()=>verifySession().catch(()=>lockWorkspace('verification_failed')),0);
    });
  }

  lockWorkspace('checking');
  verifySession().catch(()=>lockWorkspace('verification_failed'));
  installAuthListener();
  window.addEventListener('focus',()=>verifySession().catch(()=>lockWorkspace('verification_failed')));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)verifySession().catch(()=>lockWorkspace('verification_failed'))});
  window.TSSAuthSessionGuard={verifySession,lockWorkspace,get context(){return window.TSS_AUTH_CONTEXT||null}};
})();
