(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const BAD_TEXT=[/switch account/i,/private workspace/i,/switch recruiter/i,/workspace & access control/i,/team workspace/i];
function textBad(el){const t=(el?.textContent||'').replace(/\s+/g,' ').trim();return BAD_TEXT.some(r=>r.test(t));}
function removeSwitchUI(){
  const direct=['#workspaceSwitcher','#accountSwitcher','#switchAccountBtn','#workspaceSwitchModal','.workspace-switcher','.account-switcher','.private-workspace-pill','.switch-account-btn','[data-switch-account]','[data-workspace-switch]'];
  direct.forEach(s=>$$(`body ${s}`).forEach(x=>x.remove()));
  $$('button,a,div,section,aside,dialog').forEach(el=>{
    if(!textBad(el))return;
    const t=(el.textContent||'').replace(/\s+/g,' ').trim();
    if(/switch account|private workspace/i.test(t)&&t.length<180){el.remove();return;}
    if(/switch recruiter|workspace & access control|team workspace/i.test(t)){
      const modal=el.closest('dialog,.modal,.todo-modal,[role="dialog"]')||el;
      modal.remove();
    }
  });
}
async function applyProfile(){
  const b=window.TSSBackend;if(!b?.enabled)return;
  const u=await b.currentUser().catch(()=>null);if(!u)return;
  const {data:p}=await b.client.from('profiles').select('full_name,email,role,is_super_admin').eq('id',u.id).maybeSingle();
  if(!p)return;
  const name=$('#profileName');if(name)name.textContent=p.full_name||p.email?.split('@')[0]||'User';
  const small=$('.profile-box small');if(small)small.textContent=p.is_super_admin?'Super Admin workspace':p.role==='admin'?'Admin workspace':'Recruiter workspace';
  removeSwitchUI();
}
function boot(){removeSwitchUI();applyProfile();new MutationObserver(()=>removeSwitchUI()).observe(document.documentElement,{subtree:true,childList:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.TSSAccessRoleCleanup={removeSwitchUI,applyProfile};
})();