// TODO AI final login guard: keep signed-out state clean and force approved login mascot.
(function(){
  const LOGIN_TODO='/assets/todo-login.webp?v=20260813';
  const $=id=>document.getElementById(id);

  function loginVisible(){
    const gate=$('loginGate');
    return !!gate && !gate.classList.contains('hidden');
  }

  function forceTodo(){
    const figure=document.querySelector('.todo-figure');
    if(!figure)return;
    figure.innerHTML='';
    figure.style.setProperty('background','none','important');
    figure.style.setProperty('border','0','important');
    figure.style.setProperty('box-shadow','none','important');
    figure.style.setProperty('overflow','visible','important');
    figure.style.setProperty('width','330px','important');
    figure.style.setProperty('height','430px','important');
    figure.style.setProperty('display','flex','important');
    figure.style.setProperty('align-items','flex-end','important');
    figure.style.setProperty('justify-content','center','important');

    const img=document.createElement('img');
    img.src=LOGIN_TODO;
    img.alt='TODO AI mascot';
    img.className='login-todo-photo';
    img.style.setProperty('display','block','important');
    img.style.setProperty('width','auto','important');
    img.style.setProperty('height','405px','important');
    img.style.setProperty('max-width','100%','important');
    img.style.setProperty('object-fit','contain','important');
    img.style.setProperty('object-position','center bottom','important');
    img.style.setProperty('opacity','1','important');
    img.style.setProperty('visibility','visible','important');
    img.style.setProperty('background','transparent','important');
    img.onerror=()=>{
      // Use the embedded approved mascot only if the static file cannot load.
      if(window.TSS_ASSETS?.todo && img.src!==window.TSS_ASSETS.todo) img.src=window.TSS_ASSETS.todo;
    };
    figure.appendChild(img);
  }

  function cleanSignedOutNoise(){
    if(!loginVisible())return;
    const toast=$('toast');
    if(toast && /auth session missing|backend sync issue|session missing/i.test(toast.textContent||'')){
      toast.classList.remove('show');
      toast.textContent='';
    }
    const indicator=$('backendIndicator');
    if(indicator){
      const txt=indicator.querySelector('span');
      if(txt && /issue|missing|failed/i.test(txt.textContent||'')) txt.textContent='Secure login ready';
      indicator.classList.remove('error');
    }
  }

  function apply(){
    if(loginVisible()){
      forceTodo();
      cleanSignedOutNoise();
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,80),{once:true});
  else setTimeout(apply,80);
  window.addEventListener('load',()=>{setTimeout(apply,100);setTimeout(apply,500);},{once:true});

  // A finite observer only while the login screen is visible, to handle late legacy renders.
  let hits=0;
  const timer=setInterval(()=>{
    hits++;
    if(loginVisible()) apply();
    if(hits>=8 || !loginVisible()) clearInterval(timer);
  },350);
})();
