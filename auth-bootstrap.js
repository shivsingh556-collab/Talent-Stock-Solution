// Production authentication boundary. The recruiter application is fetched only
// after Supabase has remotely verified the session and an active TSS profile.
(function(){
  'use strict';

  const DOMAIN='talent-stock.com';
  const BUILD='20260913-hardening-1';
  const gate=document.getElementById('loginGate');
  const mount=document.getElementById('workspaceMount');
  const form=document.getElementById('loginForm');
  const showButton=document.getElementById('showLoginForm');
  const errorNode=document.getElementById('loginError');
  let bootPromise=null;
  let appLoaded=false;

  function setError(message=''){
    if(errorNode) errorNode.textContent=message;
  }

  function setSubmitting(active){
    const button=form?.querySelector('button[type="submit"]');
    if(!button)return;
    button.disabled=active;
    button.firstChild.textContent=active?'Verifying… ':'Continue securely ';
  }

  function lock(){
    window.TSS_AUTH_CONTEXT=null;
    gate?.classList.remove('hidden');
    mount?.replaceChildren();
    document.documentElement.dataset.auth='signed-out';
    localStorage.removeItem('tss_user_session');
    sessionStorage.removeItem('tss_user_session');
  }

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;
      script.defer=false;
      script.onload=resolve;
      script.onerror=()=>reject(new Error(`Application resource failed to load: ${src}`));
      document.body.appendChild(script);
    });
  }

  function loadRuntimeStyles(){
    if(document.querySelector('link[data-tss-runtime]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=`app-runtime.css?v=${BUILD}`;
    link.dataset.tssRuntime='true';
    document.head.appendChild(link);
  }

  async function verifiedIdentity(){
    const backend=window.TSSBackend;
    if(!backend?.enabled||!backend.client)throw new Error('Secure sign-in is temporarily unavailable.');
    // getUser() validates the access token with the Supabase Auth server. Never
    // infer authorization from localStorage or user_metadata.
    const user=await backend.currentUser();
    if(!user)return null;
    const email=String(user.email||'').trim().toLowerCase();
    if(email.split('@')[1]!==DOMAIN)throw new Error('Use your @talent-stock.com company account.');
    const {data:profile,error}=await backend.client.from('profiles')
      .select('id,full_name,email,role,is_active,is_super_admin')
      .eq('id',user.id).maybeSingle();
    if(error)throw error;
    if(!profile)throw new Error('Your employee profile is not provisioned. Contact an administrator.');
    if(profile.is_active!==true)throw new Error('Your account is inactive. Contact an administrator.');
    if(String(profile.email||email).toLowerCase().split('@')[1]!==DOMAIN)throw new Error('This profile is not a TalentStock company account.');
    return Object.freeze({
      user:Object.freeze({id:user.id,email}),
      profile:Object.freeze({...profile}),
      id:user.id,
      email,
      name:profile.full_name||email.split('@')[0],
      role:profile.role||'recruiter',
      isSuperAdmin:profile.is_super_admin===true,
      verifiedAt:new Date().toISOString()
    });
  }

  function isolateBrowserCache(userId){
    const owner=localStorage.getItem('tss_cache_owner');
    if(owner!==userId)localStorage.removeItem('tss_talent_buddy_v1');
    localStorage.setItem('tss_cache_owner',userId);
  }

  async function loadApplication(identity){
    if(appLoaded)return;
    const response=await fetch(`workspace-shell.html?v=${BUILD}`,{credentials:'same-origin',cache:'no-store'});
    if(!response.ok)throw new Error('Secure workspace could not be loaded.');
    const shell=await response.text();
    if(!shell.includes('id="workspace"'))throw new Error('Secure workspace response is invalid.');
    isolateBrowserCache(identity.id);
    window.TSS_AUTH_CONTEXT=identity;
    mount.innerHTML=shell;
    loadRuntimeStyles();
    await loadScript(`app-core.js?v=${BUILD}`);
    await loadScript(`app-runtime.js?v=${BUILD}`);
    appLoaded=true;
    gate?.classList.add('hidden');
    document.getElementById('workspace')?.classList.remove('hidden');
    document.documentElement.dataset.auth='verified';
    bindSignOut();
    window.dispatchEvent(new CustomEvent('tss:auth-ready',{detail:{id:identity.id,role:identity.role}}));
  }

  async function verifyAndBoot(){
    if(appLoaded)return true;
    if(bootPromise)return bootPromise;
    bootPromise=(async()=>{
      const identity=await verifiedIdentity();
      if(!identity){lock();return false;}
      await loadApplication(identity);
      return true;
    })().catch(async error=>{
      console.error('Authentication bootstrap failed',error);
      lock();
      setError(error?.message||'Unable to verify your account.');
      try{await window.TSSBackend?.signOut?.()}catch{}
      return false;
    }).finally(()=>{bootPromise=null;setSubmitting(false)});
    return bootPromise;
  }

  async function signOut(){
    try{await window.TSSBackend.signOut()}finally{
      localStorage.removeItem('tss_talent_buddy_v1');
      localStorage.removeItem('tss_cache_owner');
      localStorage.removeItem('tss_user_session');
      sessionStorage.removeItem('tss_user_session');
      location.reload();
    }
  }

  function bindSignOut(){
    const button=document.getElementById('signOutBtn');
    if(!button||button.dataset.authBound)return;
    button.dataset.authBound='true';
    button.addEventListener('click',async event=>{
      event.preventDefault();
      button.disabled=true;
      await signOut();
    },{capture:true});
  }

  showButton?.addEventListener('click',()=>{
    form?.classList.remove('hidden');
    showButton.classList.add('hidden');
    document.getElementById('loginEmail')?.focus();
  });

  form?.addEventListener('submit',async event=>{
    event.preventDefault();
    setError('');
    const email=String(document.getElementById('loginEmail')?.value||'').trim().toLowerCase();
    const password=String(document.getElementById('loginPassword')?.value||'');
    if(email.split('@')[1]!==DOMAIN){setError('Use your @talent-stock.com company email.');return;}
    setSubmitting(true);
    try{
      await window.TSSBackend.signIn(email,password);
      await verifyAndBoot();
    }catch(error){
      setSubmitting(false);
      setError(error?.message||'Sign-in failed.');
    }finally{
      const passwordInput=document.getElementById('loginPassword');
      if(passwordInput)passwordInput.value='';
    }
  });

  lock();
  window.TSSAuth=Object.freeze({verify:verifyAndBoot,signOut});
  window.TSSBackend?.client?.auth.onAuthStateChange(event=>{
    if(event==='SIGNED_OUT'){if(appLoaded)location.reload();else lock();return;}
    if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED')setTimeout(verifyAndBoot,0);
  });
  verifyAndBoot();
})();
