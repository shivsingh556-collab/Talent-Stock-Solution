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

    // Remove the old lower privacy card: the approved layout keeps this area for Todo.
    const privacy=right.querySelector('.privacy-card');
    if(privacy)privacy.remove();

    const welcome=right.querySelector('.welcome-card');
    if(welcome){
      welcome.style.setProperty('position','absolute','important');
      welcome.style.setProperty('top','9%','important');
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
    if(!img.getAttribute('src')||!img.getAttribute('src').includes(MASCOT_SRC))img.src=MASCOT_SRC;

    // Approved composition: clean light-blue panel, Todo centered below the welcome card.
    figure.style.cssText='display:flex!important;position:absolute!important;left:50%!important;bottom:0!important;transform:translateX(-50%)!important;width:min(330px,52%)!important;height:64%!important;align-items:flex-end!important;justify-content:center!important;overflow:visible!important;background:transparent!important;border-radius:0!important;box-shadow:none!important;opacity:1!important;visibility:visible!important;z-index:3!important;pointer-events:none!important;';
    img.style.cssText='display:block!important;width:100%!important;height:100%!important;max-width:100%!important;object-fit:contain!important;object-position:center bottom!important;background:transparent!important;opacity:1!important;visibility:visible!important;filter:none!important;';

    // Tablet/mobile safety: keep the same hierarchy without allowing the mascot to cover the welcome copy.
    if(window.innerWidth<=900){
      if(welcome){
        welcome.style.setProperty('top','7%','important');
        welcome.style.setProperty('left','7%','important');
        welcome.style.setProperty('right','7%','important');
      }
      figure.style.setProperty('width','min(300px,56%)','important');
      figure.style.setProperty('height','60%','important');
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
