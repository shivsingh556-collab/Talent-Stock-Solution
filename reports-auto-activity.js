(function(){
  'use strict';

  function enhanceReports(){
    const root=document.getElementById('reportsRoot');
    if(!root)return;
    const teamTab=root.querySelector('.report-tabs button[data-tab="team"]');
    if(teamTab) teamTab.textContent='All Activity';
    const heading=root.querySelector('.section-head p');
    if(heading && /recruiter submissions|team progress|admin work/i.test(heading.textContent||'')){
      heading.textContent='Every meaningful recruiter, admin and Super Admin action is captured automatically in one live management report.';
    }
  }

  function openAutomaticActivity(){
    setTimeout(()=>{
      enhanceReports();
      const root=document.getElementById('reportsRoot');
      const teamTab=root?.querySelector('.report-tabs button[data-tab="team"]');
      if(teamTab && !teamTab.classList.contains('active')) teamTab.click();
    },350);
  }

  document.addEventListener('click',e=>{
    const nav=e.target.closest?.('#reportsNav');
    if(nav) openAutomaticActivity();
  },true);

  const observer=new MutationObserver(()=>{
    if(document.getElementById('reportsRoot')) enhanceReports();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  window.TSSReportsAutoActivity={enhance:enhanceReports,open:openAutomaticActivity};
})();
