// Stable login mascot renderer using the user-approved Todo artwork.
(function(){
  'use strict';
  const MASCOT_SRC='assets/todo-login.webp';
  function apply(){
    const gate=document.getElementById('loginGate');
    if(!gate||gate.classList.contains('hidden'))return false;
    const right=document.querySelector('.login-right');
    if(!right)return false;
    if(getComputedStyle(right).position==='static')right.style.position='relative';
    right.style.setProperty('overflow','hidden','important');
    let figure=right.querySelector('.todo-figure');
    if(!figure){figure=document.createElement('div');figure.className='todo-figure';right.appendChild(figure)}
    figure.className='todo-figure login-todo-figure';
    let img=figure.querySelector('img.login-todo-photo');
    if(!img){
      figure.replaceChildren();
      img=document.createElement('img');
      img.className='login-todo-photo';
      img.alt='Todo Talent Buddy';
      img.loading='eager';
      img.decoding='async';
      img.setAttribute('fetchpriority','high');
      figure.appendChild(img);
    }
    if(!img.getAttribute('src')||!img.getAttribute('src').includes('assets/todo-login.webp'))img.src=MASCOT_SRC;
    figure.style.cssText='display:flex!important;position:absolute!important;left:50%!important;bottom:16px!important;transform:translateX(-50%)!important;width:min(360px,40vw)!important;height:500px!important;align-items:flex-end!important;justify-content:center!important;overflow:hidden!important;background:#05080d!important;border-radius:28px!important;box-shadow:0 24px 54px rgba(7,39,68,.24)!important;opacity:1!important;visibility:visible!important;z-index:3!important;pointer-events:none!important;';
    img.style.cssText='display:block!important;width:100%!important;height:100%!important;max-width:100%!important;object-fit:cover!important;object-position:center center!important;background:#05080d!important;opacity:1!important;visibility:visible!important;';
    const welcome=right.querySelector('.welcome-card');if(welcome)welcome.style.setProperty('z-index','5','important');
    const privacy=right.querySelector('.privacy-card');if(privacy)privacy.style.setProperty('z-index','6','important');
    return true;
  }
  function schedule(){
    if(apply())return;
    let attempts=0;
    const timer=setInterval(()=>{attempts++;if(apply()||attempts>=6)clearInterval(timer)},120);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  window.addEventListener('pageshow',apply);
  window.addEventListener('tss:auth-ready',apply);
  window.TSSLoginTodoVisible={apply,schedule};
})();
