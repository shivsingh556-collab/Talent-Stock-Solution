(function(){
  const apply=()=>{
    const left=document.querySelector('.login-left');
    const right=document.querySelector('.login-right');
    if(left && !left.querySelector('.login-brand-note')){
      const logo=left.querySelector('.talent-logo');
      if(logo){const note=document.createElement('div');note.className='login-brand-note';note.textContent='TalentStock Solutions · Secure Recruitment Workspace';logo.insertAdjacentElement('afterend',note);}
    }
    if(right){
      let figure=right.querySelector('.todo-figure');
      if(!figure){figure=document.createElement('div');figure.className='todo-figure';right.appendChild(figure);}
      let img=figure.querySelector('.login-todo-photo');
      const src=window.TSS_LOGIN_TODO_EXACT||window.TSS_ASSETS?.todo;
      if(!img && src){img=document.createElement('img');img.className='login-todo-photo';img.alt='Todo - Talent Buddy';figure.replaceChildren(img);}
      if(img && src && img.src!==src)img.src=src;
      if(figure)figure.style.display='flex';
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  [100,400,1000,2000].forEach(ms=>setTimeout(apply,ms));
  const gate=document.getElementById('loginGate');
  if(gate)new MutationObserver(apply).observe(gate,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  window.TSSLoginVisualFix={apply};
})();