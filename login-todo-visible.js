// Final login mascot visibility layer. Uses the bundled Todo asset first so login never depends on late JS globals.
(function(){
  'use strict';
  const FALLBACK_SRC='assets/todo-login.webp';
  function getSource(){
    return FALLBACK_SRC || window.TSS_LOGIN_TODO_EXACT || window.TSS_ASSETS?.todo || document.querySelector('.mini-todo-photo,.modal-todo-photo,.todo-photo')?.src || '';
  }
  function apply(){
    const gate=document.getElementById('loginGate');
    if(!gate||gate.classList.contains('hidden'))return;
    const right=document.querySelector('.login-right');
    if(!right)return;
    if(getComputedStyle(right).position==='static')right.style.position='relative';
    let figure=right.querySelector('.todo-figure');
    if(!figure){
      figure=document.createElement('div');
      figure.className='todo-figure tss-login-todo-forced';
      right.appendChild(figure);
    }
    figure.replaceChildren();
    figure.style.cssText='display:flex!important;position:absolute!important;left:55%!important;bottom:18px!important;transform:translateX(-50%)!important;width:min(430px,48vw)!important;height:455px!important;align-items:flex-end!important;justify-content:center!important;overflow:visible!important;background:transparent!important;border:0!important;box-shadow:none!important;opacity:1!important;visibility:visible!important;z-index:4!important;pointer-events:none!important;';
    const img=document.createElement('img');
    img.src=getSource();
    img.alt='Todo Talent Buddy';
    img.className='login-todo-photo tss-login-todo-image';
    img.loading='eager';
    img.decoding='sync';
    img.setAttribute('fetchpriority','high');
    img.style.cssText='display:block!important;width:auto!important;height:435px!important;max-width:100%!important;object-fit:contain!important;object-position:center bottom!important;background:transparent!important;opacity:1!important;visibility:visible!important;filter:drop-shadow(0 22px 26px rgba(0,0,0,.28))!important;';
    img.onerror=function(){
      const alt=window.TSS_LOGIN_TODO_EXACT||window.TSS_ASSETS?.todo||'';
      if(alt&&this.src!==alt)this.src=alt;
    };
    figure.appendChild(img);
  }
  function schedule(){[0,80,220,500,1000,1800].forEach(ms=>setTimeout(()=>{try{apply()}catch(e){console.warn('Todo login render',e?.message||e)}},ms))}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  window.addEventListener('load',schedule,{once:true});
  window.addEventListener('pageshow',schedule);
  window.TSSLoginTodoVisible={apply,schedule};
})();