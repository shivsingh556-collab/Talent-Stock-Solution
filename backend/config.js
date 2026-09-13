// TODO AI Supabase runtime configuration.
window.TSS_SUPABASE_CONFIG = window.TSS_SUPABASE_CONFIG || {
  url: 'https://wbclpjdjhlsuspojtner.supabase.co',
  anonKey: 'sb_publishable_qx9Xf31udLMuRWmqNAjBFQ_I7woPxap'
};

// Paint-time access gate. Legacy localStorage can no longer reveal the workspace
// before a verified Supabase session has been checked by auth-session-guard.js.
(function installAuthPaintGate(){
  if(document.getElementById('tssAuthPaintGate'))return;
  const style=document.createElement('style');
  style.id='tssAuthPaintGate';
  style.textContent='body:not([data-auth-verified="true"]) #workspace{display:none!important}body:not([data-quick-screening-access="allowed"]) #quickScreenCard{display:none!important}';
  document.head.appendChild(style);
})();

(function loadReportingModule(){
  if (!document.querySelector('link[data-tss-reports]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'reports-activity.css?v=20260913-hardening-v22';
    css.dataset.tssReports = '1';
    document.head.appendChild(css);
  }
  if (!document.querySelector('script[data-tss-reports]')) {
    const script = document.createElement('script');
    script.src = 'reports-activity.js?v=20260913-hardening-v22';
    script.async = false;
    script.dataset.tssReports = '1';
    script.onload = () => {
      if (!document.querySelector('script[data-tss-daily-activity]')) {
        const daily = document.createElement('script');
        daily.src = 'reports-daily-activity.js?v=20260913-hardening-v22';
        daily.async = false;
        daily.dataset.tssDailyActivity = '1';
        document.head.appendChild(daily);
      }
    };
    document.head.appendChild(script);
  }
})();

window.addEventListener('load', () => {
  const BUILD = '20260913-hardening-v22';
  const addCss = (href) => {
    const clean = href.split('?')[0];
    if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(x => (x.getAttribute('href')||'').split('?')[0] === clean)) return;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${href}?v=${BUILD}`;
    document.head.appendChild(css);
  };
  addCss('production-polish.css');
  addCss('requirements-perfect-fix.css');
  addCss('todo-ai-branding.css');
  addCss('login-perfect.css');
  addCss('reports-activity.css');
  addCss('quick-screening.css');
  addCss('quick-screening-next.css');
  const professional=document.querySelector('link[href^="professional-ui.css"]');
  if(professional)document.head.appendChild(professional);else addCss('professional-ui.css');

  const loadScript = (src, marker) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-${marker}]`)) return resolve();
    const s = document.createElement('script');
    s.src = `${src}?v=${BUILD}`;
    s.dataset[marker] = '1';
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });

  loadScript('auth-session-guard.js','tssAuthSessionGuard')
    .then(() => loadScript('brand-assets.js','tssBrandAssets'))
    .then(() => loadScript('login-todo-exact.js','tssLoginTodoExact'))
    .then(() => loadScript('login-todo-visible.js','tssLoginTodoVisible'))
    .then(() => window.TSSLoginTodoVisible?.apply?.())
    .then(() => loadScript('todo-exact.js','tssExactTodo'))
    .then(() => loadScript('extraction-accuracy.js','tssExtractionAccuracy'))
    .then(() => loadScript('candidate-enrichment.js','tssCandidateEnrichment'))
    .then(() => loadScript('production.js','tssProduction'))
    .then(() => loadScript('candidate-resume-hydration.js','tssCandidateResumeHydration'))
    .then(() => loadScript('interview-sync.js','tssInterviewSync'))
    .then(() => loadScript('interview-actions.js','tssInterviewActions'))
    .then(() => loadScript('interview-lifecycle-ui.js','tssInterviewLifecycleUi'))
    .then(() => loadScript('interview-scheduler-ui.js','tssInterviewSchedulerUi'))
    .then(() => loadScript('stable-runtime.js','tssStableRuntime'))
    .then(() => loadScript('requirement-status-visibility.js','tssRequirementStatusVisibility'))
    .then(() => loadScript('requirements-live-sync.js','tssRequirementsLiveSync'))
    .then(() => loadScript('requirement-assignment-hydration-fix.js','tssRequirementAssignmentHydrationFix'))
    .then(() => loadScript('safe-backend-features.js','tssSafeBackendFeatures'))
    .then(() => loadScript('dashboard-cleanup.js','tssDashboardCleanup'))
    .then(() => loadScript('dashboard-actions.js','tssDashboardActions'))
    .then(() => loadScript('resdex-assistant.js','tssResdexAssistant'))
    .then(() => loadScript('resdex-final-safe.js','tssResdexFinalSafe'))
    .then(() => loadScript('resdex-import-quick.js','tssResdexQuickImport'))
    .then(() => loadScript('recruitment-workflow.js','tssRecruitmentWorkflow'))
    .then(() => loadScript('assignment-clean-layout.js','tssAssignmentCleanLayout'))
    .then(() => loadScript('client-owner-auto.js','tssClientOwnerAuto'))
    .then(() => loadScript('requirement-acknowledgement-ui.js','tssRequirementAcknowledgementUi'))
    .then(() => loadScript('requirement-positions-field.js','tssRequirementPositions'))
    .then(() => loadScript('requirement-save-sync.js','tssRequirementSaveSync'))
    .then(() => loadScript('requirement-details-owner-sync.js','tssRequirementDetailsOwnerSync'))
    .then(() => loadScript('admin-role-ui.js','tssAdminRoleUi'))
    .then(() => loadScript('screening-cleanup.js','tssScreeningCleanup'))
    .then(() => loadScript('quick-screening.js','tssQuickScreening'))
    .then(() => loadScript('n8n-hybrid-screening.js','tssN8NHybridScreening'))
    .then(() => loadScript('quick-screening-next.js','tssQuickScreeningNext'))
    .then(() => loadScript('todo-chatbot-upgrade.js','tssTodoChatbotUpgrade'))
    .then(() => loadScript('role-visibility.js','tssRoleVisibility'))
    .then(() => loadScript('realtime-performance.js','tssRealtimePerformance'))
    .then(() => loadScript('workflow-finalization.js','tssWorkflowFinalization'))
    .then(() => loadScript('requirement-screening-selection-fix.js','tssRequirementScreeningSelectionFix'))
    .then(() => loadScript('todo-ai-branding.js','tssTodoAiBranding'))
    .then(() => loadScript('profile-logout.js','tssProfileLogout'))
    .catch(err => console.warn('TODO AI production layer load issue', err));
});
