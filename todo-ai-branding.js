(function(){
  const PRODUCT='TODO AI';
  const LOGIN_TODO='/assets/todo-login.webp';
  const replacements=[
    ['TODO.AI','TODO AI'],
    ['Resume intelligence','TODO AI'],
    ['Resume Intelligence','TODO AI'],
    ['RESUME INTELLIGENCE','TODO AI'],
    ['TSS Resume Intelligence','TODO AI']
  ];
  function replaceText(root=document.body){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n=>{let t=n.nodeValue; replacements.forEach(([a,b])=>{t=t.split(a).join(b)}); n.nodeValue=t;});
  }
  function applyLoginTodo(){
    const figure=document.querySelector('.todo-figure');
    if(!figure)return;
    let img=figure.querySelector('img.login-todo-photo, img');
    if(!img){
      img=document.createElement('img');
      img.className='login-todo-photo';
      img.alt='TODO AI mascot';
      figure.appendChild(img);
    }
    img.classList.add('login-todo-photo');
    if(!img.src.endsWith(LOGIN_TODO)) img.src=LOGIN_TODO;
    img.alt='TODO AI mascot';
  }
  function apply(){
    document.title=PRODUCT;
    replaceText();
    const loginHeading=document.querySelector('.login-left h1');
    if(loginHeading) loginHeading.textContent='TODO AI for TalentStock teams.';
    const loginCopy=document.querySelector('.login-left > p');
    if(loginCopy) loginCopy.textContent='Sign in to access your requirements, candidate records, screening results and reports.';
    document.querySelectorAll('.sidebar-caption strong').forEach(el=>el.textContent=PRODUCT);
    document.querySelectorAll('.brand-image').forEach(img=>{
      img.classList.add('todoai-logo');
      const parent=img.parentElement;
      if(parent) parent.classList.add('todoai-logo-frame');
    });
    applyLoginTodo();
    const pageTitle=document.getElementById('pageTitle');
    if(pageTitle&&pageTitle.textContent.trim()==='Job Profiles') pageTitle.textContent='Requirements';
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply); else apply();
  setTimeout(apply,350);
  window.addEventListener('load',apply,{once:true});
})();
