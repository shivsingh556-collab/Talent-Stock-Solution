// TODO AI - authoritative top-right profile logout behavior
(function(){
  const button=()=>document.getElementById('signOutBtn');
  const profileBox=()=>document.querySelector('.profile-box');

  function showLogin(){
    document.getElementById('workspace')?.classList.add('hidden');
    document.getElementById('loginGate')?.classList.remove('hidden');
    window.scrollTo({top:0,left:0,behavior:'auto'});
  }

  async function logout(e){
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const btn=button();
    if(btn){btn.disabled=true;btn.setAttribute('aria-busy','true');}
    try{
      if(window.TSSBackend?.enabled){
        await window.TSSBackend.signOut();
      } else if(window.supabaseClient?.auth?.signOut){
        await window.supabaseClient.auth.signOut();
      }
    }catch(err){
      console.warn('TODO AI logout backend warning',err?.message||err);
    }
    try{
      localStorage.removeItem('tss_user_session');
      sessionStorage.removeItem('tss_user_session');
    }catch{}
    showLogin();
    if(btn){btn.disabled=false;btn.removeAttribute('aria-busy');}
  }

  function wire(){
    const btn=button();
    const box=profileBox();
    if(!btn||!box)return;

    btn.type='button';
    btn.title='Logout';
    btn.setAttribute('aria-label','Logout');
    btn.textContent='↪';

    // Clone to remove any stale/broken listeners from older runtime layers.
    if(!btn.dataset.todoLogoutWired){
      const clean=btn.cloneNode(true);
      clean.dataset.todoLogoutWired='1';
      btn.replaceWith(clean);
      clean.addEventListener('click',logout,{capture:true});
    }

    box.classList.add('todo-profile-logout-ready');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wire,{once:true}); else wire();
  window.addEventListener('load',()=>setTimeout(wire,100),{once:true});
})();
