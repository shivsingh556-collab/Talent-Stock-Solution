// Final login mascot visibility layer. Uses the embedded Todo asset already shipped with TODO AI.
(function(){
  'use strict';
  function apply(){
    const gate=document.getElementById('loginGate');
    if(!gate||gate.classList.contains('hidden'))return;
    const figure=document.querySelector('.login-right .todo-figure');
    if(!figure)return;
    const src=window.TSS_LOGIN_TODO_EXACT||window.TSS_ASSETS?.todo;
    if(!src)return;
    figure.innerHTML='';
    figure.style.cssText+=';display:flex!important;position:absolute!important;left:58%!important;bottom:20px!important;transform:translateX(-50%)!important;width:390px!important;height:445px!important;align-items:flex-end!important;justify-content:center!important;overflow:visible!important;background:transparent!important;border:0!important;box-shadow:none!important;opacity:1!important;visibility:visible!important;z-index:5!important;';
    const img=document.createElement('img');
    img.src=src;img.alt='Todo Talent Buddy';img.className='login-todo-photo';
    img.loading='eager';img.decoding='async';img.setAttribute('fetchpriority','high');
    img.style.cssText='display:block!important;width:auto!important;height:430px!important;max-width:100%!important;object-fit:contain!important;object-position:center bottom!important;background:transparent!important;opacity:1!important;visibility:visible!important;filter:drop-shadow(0 22px 26px rgba(0,0,0,.28))!important;';
    figure.appendChild(img);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,120),{once:true});else setTimeout(apply,120);
  window.addEventListener('load',()=>setTimeout(apply,180),{once:true});
  window.addEventListener('pageshow',()=>setTimeout(apply,100));
  window.TSSLoginTodoVisible={apply};
})();