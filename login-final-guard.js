// TODO AI final login guard: exact Todo, clean logo, signed-out state without backend noise.
(function(){
  const $=id=>document.getElementById(id);
  const loginVisible=()=>!!$('loginGate')&&!$('loginGate').classList.contains('hidden');

  function forceLogo(){
    const holder=document.querySelector('.login-left .talent-logo');
    if(!holder)return;
    const img=holder.querySelector('img');
    if(img){
      holder.style.setProperty('width','348px','important');
      holder.style.setProperty('max-width','100%','important');
      holder.style.setProperty('background','#fff','important');
      holder.style.setProperty('padding','0','important');
      holder.style.setProperty('overflow','hidden','important');
      img.style.setProperty('display','block','important');
      img.style.setProperty('width','348px','important');
      img.style.setProperty('max-width','100%','important');
      img.style.setProperty('height','139px','important');
      img.style.setProperty('object-fit','contain','important');
      img.style.setProperty('image-rendering','auto','important');
      img.style.setProperty('transform','none','important');
      img.style.setProperty('filter','none','important');
    }
  }

  function forceTodo(){
    const figure=document.querySelector('.todo-figure');
    if(!figure)return;
    const src=window.TSS_LOGIN_TODO_EXACT||window.TSS_ASSETS?.todo;
    if(!src)return;
    figure.innerHTML='';
    ['background','border','box-shadow','outline','filter'].forEach(p=>figure.style.setProperty(p,'none','important'));
    figure.style.setProperty('overflow','visible','important');
    figure.style.setProperty('position','absolute','important');
    figure.style.setProperty('left','58%','important');
    figure.style.setProperty('bottom','34px','important');
    figure.style.setProperty('transform','translateX(-50%)','important');
    figure.style.setProperty('width','340px','important');
    figure.style.setProperty('height','430px','important');
    figure.style.setProperty('display','flex','important');
    figure.style.setProperty('align-items','flex-end','important');
    figure.style.setProperty('justify-content','center','important');
    const img=document.createElement('img');
    img.src=src;
    img.alt='TODO AI mascot';
    img.className='login-todo-photo';
    img.style.cssText='display:block!important;width:auto!important;height:410px!important;max-width:100%!important;object-fit:contain!important;object-position:center bottom!important;opacity:1!important;visibility:visible!important;background:transparent!important;filter:drop-shadow(0 18px 24px rgba(0,0,0,.22))!important;';
    figure.appendChild(img);
  }

  function cleanSignedOutNoise(){
    if(!loginVisible())return;
    const toast=$('toast');
    if(toast&&/auth session missing|backend sync issue|session missing/i.test(toast.textContent||'')){toast.classList.remove('show');toast.textContent='';}
    const indicator=$('backendIndicator');
    if(indicator)indicator.style.display='none';
  }

  function apply(){if(!loginVisible())return;forceLogo();forceTodo();cleanSignedOutNoise();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,50),{once:true});else setTimeout(apply,50);
  window.addEventListener('load',()=>{setTimeout(apply,80);setTimeout(apply,350);},{once:true});
  let tries=0;const timer=setInterval(()=>{tries++;if(loginVisible())apply();if(tries>=10||!loginVisible())clearInterval(timer);},250);
})();
