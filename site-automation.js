// In-app Automation Center removed. Microsoft 365/Outlook workflow automation remains separate.
(function(){
  function removeAutomation(){
    document.querySelectorAll('[data-view="automation"]').forEach(el=>el.remove());
    document.getElementById('automation')?.remove();
    try{
      localStorage.removeItem('tss_site_automations_v1');
      localStorage.removeItem('tss_site_automation_runs_v1');
    }catch{}
    if(window.TSSSiteAutomation) delete window.TSSSiteAutomation;
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',removeAutomation,{once:true});
  else removeAutomation();
  setTimeout(removeAutomation,300);
  setTimeout(removeAutomation,1200);
})();
