// Stable login guard: keep one Todo image and never swap it after first paint.
(function(){
  'use strict';
  function apply(){
    const gate=document.getElementById('loginGate');
    if(!gate||gate.classList.contains('hidden'))return;
    const figure=document.querySelector('.todo-figure');
    if(figure){
      let img=figure.querySelector('img.todo-login-image');
      if(!img){
        figure.innerHTML='';
        img=document.createElement('img');
        img.className='todo-login-image';
        img.src='assets/todo-login.webp';
        img.alt='Todo Talent Buddy';
        img.loading='eager';
        img.decoding='async';
        img.setAttribute('fetchpriority','high');
        figure.appendChild(img);
      }
      figure.querySelectorAll('img').forEach((node,index)=>{if(index>0)node.remove();});
    }
    const toast=document.getElementById('toast');
    if(toast&&/auth session missing|backend sync issue|session missing/i.test(toast.textContent||'')){
      toast.classList.remove('show');
      toast.textContent='';
    }
    const indicator=document.getElementById('backendIndicator');
    if(indicator)indicator.style.display='none';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  window.addEventListener('pageshow',apply);
})();
