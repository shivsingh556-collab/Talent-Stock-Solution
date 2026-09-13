// Stable login mascot renderer using the approved transparent Todo artwork.
(function(){
  'use strict';
  const MASCOT_SRC='assets/todo-login-approved.webp?v=20260913b';
  function apply(){
    const gate=document.getElementById('loginGate');
    if(!gate||gate.classList.contains('hidden'))return false;
    const right=document.querySelector('.login-right');
    if(!right)return false;

    if(getComputedStyle(right).position==='static')right.style.position='relative';
    right.style.setProperty('overflow','hidden','important');

    const privacy=right.querySelector('.privacy-card');
    if(privacy)privacy.remove();

    const welcome=right.querySelector('.welcome-card');
    if(welcome){
      welcome.style.setProperty('position','absolute','important');
      welcome.style.setProperty('top','8%','important');
      welcome.style.setProperty('left','9%','important');
      welcome.style.setProperty('right','9%','important');
      welcome.style.setProperty('margin','0','important');
      welcome.style.setProperty('z-index','5','important');
    }

    let figure=right.querySelector('.todo-figure');
    if(!figure){
      figure=document.createElement('div');
      figure.className='todo-figure';
      right.appendChild(figure);
    }
    figure.className='todo-figure login-todo-figure';
    figure.replaceChildren();

    const img=document.createElement('img');
    img.className='login-todo-photo';
    img.alt='Todo Talent Buddy';
    img.loading='eager';
    img.decoding='async';
    img.setAttribute('fetchpriority','high');
    img.src=MASCOT_SRC;
    figure.appendChild(img);

    figure.style.cssText='display:flex!important;position:absolute!important;left:50%!important;bottom:0!important;transform:translateX(-50%)!important;width:min(310px,49%)!important;height:63%!important;align-items:flex-end!important;justify-content:center!important;overflow:visible!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;opacity:1!important;visibility:visible!important;z-index:4!important;pointer-events:none!important;';
    img.style.cssText='display:block!important;width:auto!important;height:100%!important;max-width:100%!important;object-fit:contain!important;object-position:center bottom!important;background:transparent!important;opacity:1!important;visibility:visible!important;filter:drop-shadow(0 15px 20px rgba(8,49,82,.12))!important;';

    img.addEventListener('error',()=>{
      console.warn('Approved Todo mascot asset failed to load');
      const fallback=window.TSS_LOGIN_TODO_EXACT||window.TSS_ASSETS?.todo||'';
      if(fallback&&img.src!==fallback)img.src=fallback;
    },{once:true});

    if(window.innerWidth<=900){
      if(welcome){
        welcome.style.setProperty('top','7%','important');
        welcome.style.setProperty('left','7%','important');
        welcome.style.setProperty('right','7%','important');
      }
      figure.style.setProperty('width','min(295px,52%)','important');
      figure.style.setProperty('height','61%','important');
    }
    return true;
  }
  function schedule(){
    if(apply())return;
    let attempts=0;
    const timer=setInterval(()=>{attempts++;if(apply()||attempts>=6)clearInterval(timer)},120);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  window.addEventListener('pageshow',apply);
  window.addEventListener('resize',apply,{passive:true});
  window.addEventListener('tss:auth-ready',apply);
  window.TSSLoginTodoVisible={apply,schedule};
})();
