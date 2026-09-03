(function(){
  'use strict';

  const $ = (s, root=document) => root.querySelector(s);
  const todayIST = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const get = type => parts.find(p => p.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  };

  function isManagementReportsNav(el){
    const nav = el?.closest?.('#reportsNav');
    return nav && /reports/i.test(nav.textContent || '');
  }

  function setDailyActivityHeading(){
    const root = $('#reportsRoot');
    if(!root) return;
    const head = root.querySelector('.section-head');
    const h1 = head?.querySelector('h1');
    const p = head?.querySelector('p');
    if(h1) h1.textContent = 'Daily Team Activity';
    if(p) p.textContent = 'Automatic record of meaningful recruiter and admin work completed today. No manual activity entry is required.';
    const live = head?.querySelector('.report-live-dot');
    if(live) live.textContent = 'Live · Auto captured';
  }

  function openTodayActivity(){
    const root = $('#reportsRoot');
    if(!root) return;

    const date = todayIST();
    const start = $('#reportStart', root);
    const end = $('#reportEnd', root);
    if(start) start.value = date;
    if(end) end.value = date;

    const teamTab = root.querySelector('.report-tabs button[data-tab="team"]');
    if(teamTab){
      teamTab.textContent = 'Daily Activity';
      if(!teamTab.classList.contains('active')) teamTab.click();
    }

    const overview = root.querySelector('.report-tabs button[data-tab="overview"]');
    if(overview) overview.textContent = 'Summary';

    const audit = root.querySelector('.report-tabs button[data-tab="audit"]');
    if(audit) audit.textContent = 'Admin Activity';

    setDailyActivityHeading();
    const title = $('#pageTitle');
    if(title) title.textContent = 'Daily Activity';
  }

  document.addEventListener('click', function(e){
    if(isManagementReportsNav(e.target)){
      setTimeout(openTodayActivity, 180);
      setTimeout(openTodayActivity, 650);
      return;
    }

    const tab = e.target?.closest?.('#reportsRoot .report-tabs button');
    if(!tab) return;
    if(tab.dataset.tab === 'team'){
      setTimeout(setDailyActivityHeading, 0);
      const title = $('#pageTitle');
      if(title) title.textContent = 'Daily Activity';
    }
  }, false);

  window.TSSDailyActivityReport = {
    openToday: openTodayActivity
  };
})();
