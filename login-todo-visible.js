// Stable login mascot renderer. One implementation, one class, no repeated layout rewrites.
(function(){
  'use strict';
  function getSource(){
    return window.TSS_LOGIN_TODO_EXACT||window.TSS_ASSETS?.todo||document.querySelector('.mini-todo-photo,.modal-todo-photo,.todo-photo')?.src||'';
  }
  function apply(){
    const gate=document.getElementById('loginGate');
    if(!gate||gate.classList.contains('hidden'))return false;
    const right=document.querySelector('.login-right');
    if(!right)return false;
    const src=getSource();
    if(!src)return false;
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
    if(img.src!==src)img.src=src;
    figure.style.cssText='display:flex!important;position:absolute!important;left:58%!important;bottom:-8px!important;transform:translateX(-50%)!important;width:min(470px,46vw)!important;height:500px!important;align-items:flex-end!important;justify-content:center!important;overflow:visible!important;background:transparent!important;border:0!important;box-shadow:none!important;opacity:1!important;visibility:visible!important;z-index:3!important;pointer-events:none!important;';
    img.style.cssText='display:block!important;width:auto!important;height:475px!important;max-width:100%!important;object-fit:contain!important;object-position:center bottom!important;background:transparent!important;opacity:1!important;visibility:visible!important;filter:drop-shadow(0 22px 28px rgba(0,0,0,.26))!important;';
    const welcome=right.querySelector('.welcome-card');if(welcome)welcome.style.setProperty('z-index','5','important');
    const privacy=right.querySelector('.privacy-card');if(privacy)privacy.style.setProperty('z-index','6','important');
    return true;
  }
  function schedule(){
    if(apply())return;
    let attempts=0;
    const timer=setInterval(()=>{attempts++;if(apply()||attempts>=8)clearInterval(timer)},100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  window.addEventListener('pageshow',apply);
  window.addEventListener('tss:auth-ready',apply);
  window.TSSLoginTodoVisible={apply,schedule};
})();
