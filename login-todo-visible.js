// Final login mascot visibility layer. Creates its own safe container if older login markup omitted Todo.
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
    if(getComputedStyle(right).position==='static') right.style.position='relative';
    let figure=right.querySelector('.todo-figure');
    if(!figure){
      figure=document.createElement('div');
      figure.className='todo-figure tss-login-todo-forced';
      right.appendChild(figure);
    }
    figure.replaceChildren();
    figure.style.cssText='display:flex!important;position:absolute!important;left:52%!important;bottom:18px!important;transform:translateX(-50%)!important;width:min(430px,48vw)!important;height:455px!important;align-items:flex-end!important;justify-content:center!important;overflow:visible!important;background:transparent!important;border:0!important;box-shadow:none!important;opacity:1!important;visibility:visible!important;z-index:4!important;pointer-events:none!important;';
    const img=document.createElement('img');
    img.src=src;img.alt='Todo Talent Buddy';img.className='login-todo-photo tss-login-todo-image';
    img.loading='eager';img.decoding='async';img.setAttribute('fetchpriority','high');
    img.style.cssText='display:block!important;width:auto!important;height:435px!important;max-width:100%!important;object-fit:contain!important;object-position:center bottom!important;background:transparent!important;opacity:1!important;visibility:visible!important;filter:drop-shadow(0 22px 26px rgba(0,0,0,.28))!important;';
    figure.appendChild(img);
  }
  function schedule(){[0,120,350,900].forEach(ms=>setTimeout(()=>{try{apply()}catch(e){console.warn('Todo login render',e?.message||e)}},ms))}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  window.addEventListener('load',schedule,{once:true});
  window.addEventListener('pageshow',schedule);
  window.TSSLoginTodoVisible={apply,schedule};
})();