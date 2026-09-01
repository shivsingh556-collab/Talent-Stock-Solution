// Final login mascot visibility layer. Restores the previous approved split-login look with Todo clearly visible.
(function(){
  'use strict';
  function getSource(){return window.TSS_LOGIN_TODO_EXACT||window.TSS_ASSETS?.todo||document.querySelector('.mini-todo-photo,.modal-todo-photo,.todo-photo')?.src||''}
  function apply(){
    const gate=document.getElementById('loginGate');
    if(!gate||gate.classList.contains('hidden'))return;
    const right=document.querySelector('.login-right');
    if(!right)return;
    const src=getSource();
    if(!src)return;
    if(getComputedStyle(right).position==='static')right.style.position='relative';
    right.style.setProperty('overflow','hidden','important');
    let figure=right.querySelector('.todo-figure');
    if(!figure){figure=document.createElement('div');figure.className='todo-figure';right.appendChild(figure)}
    figure.replaceChildren();
    figure.style.cssText='display:flex!important;position:absolute!important;left:58%!important;bottom:-8px!important;transform:translateX(-50%)!important;width:min(470px,46vw)!important;height:500px!important;align-items:flex-end!important;justify-content:center!important;overflow:visible!important;background:transparent!important;border:0!important;box-shadow:none!important;opacity:1!important;visibility:visible!important;z-index:3!important;pointer-events:none!important;';
    const img=document.createElement('img');
    img.src=src;img.alt='Todo Talent Buddy';img.className='login-todo-photo tss-login-todo-image';
    img.loading='eager';img.decoding='sync';img.setAttribute('fetchpriority','high');
    img.style.cssText='display:block!important;width:auto!important;height:475px!important;max-width:100%!important;object-fit:contain!important;object-position:center bottom!important;background:transparent!important;opacity:1!important;visibility:visible!important;filter:drop-shadow(0 22px 28px rgba(0,0,0,.26))!important;';
    figure.appendChild(img);
    const welcome=right.querySelector('.welcome-card');if(welcome)welcome.style.setProperty('z-index','5','important');
    const privacy=right.querySelector('.privacy-card');if(privacy)privacy.style.setProperty('z-index','6','important');
  }
  function schedule(){[0,80,180,350,700,1200,2000].forEach(ms=>setTimeout(()=>{try{apply()}catch(e){console.warn('Todo login render',e?.message||e)}},ms))}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  window.addEventListener('load',schedule,{once:true});
  window.addEventListener('pageshow',schedule);
  window.TSSLoginTodoVisible={apply,schedule};
})();