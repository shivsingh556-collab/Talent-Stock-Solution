// TODO AI Supabase runtime configuration.
window.TSS_SUPABASE_CONFIG = window.TSS_SUPABASE_CONFIG || {
  url: 'https://wbclpjdjhlsuspojtner.supabase.co',
  anonKey: 'sb_publishable_qx9Xf31udLMuRWmqNAjBFQ_I7woPxap'
};

(function loadReportingModule(){
  if (!document.querySelector('link[data-tss-reports]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'reports-activity.css?v=20260903-auto-activity-v1';
    css.dataset.tssReports = '1';
    document.head.appendChild(css);
  }
  if (!document.querySelector('script[data-tss-reports]')) {
    const script = document.createElement('script');
    script.src = 'reports-activity.js?v=20260903-auto-activity-v1';
    script.async = false;
    script.dataset.tssReports = '1';
    script.onload = () => {
      if (!document.querySelector('script[data-tss-reports-auto-activity]')) {
        const auto = document.createElement('script');
        auto.src = 'reports-auto-activity.js?v=20260903-auto-activity-v1';
        auto.async = false;
        auto.dataset.tssReportsAutoActivity = '1';
        document.head.appendChild(auto);
      }
    };
    document.head.appendChild(script);
  }
})();

window.addEventListener('load', () => {
  const BUILD = '20260903-auto-activity-v1';
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
  addCss('light-theme.css');
  addCss('minimal-content-theme.css');

  const loadScript = (src, marker) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-${marker}]`)) return resolve();
    const s = document.createElement('script');
    s.src = `${src}?v=${BUILD}`;
    s.dataset[marker] = '1';
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });

  loadScript('brand-assets.js','tssBrandAssets')
    .then(() => loadScript('login-todo-exact.js','tssLoginTodoExact'))
    .then(() => loadScript('todo-exact.js','tssExactTodo'))
    .then(() => loadScript('extraction-accuracy.js','tssExtractionAccuracy'))
    .then(() => loadScript('candidate-enrichment.js','tssCandidateEnrichment'))
    .then(() => loadScript('production.js','tssProduction'))
    .then(() => loadScript('candidate-resume-hydration.js','tssCandidateResumeHydration'))
    .then(() => loadScript('interview-sync.js','tssInterviewSync'))
    .then(() => loadScript('interview-actions.js','tssInterviewActions'))
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
    .then(() => loadScript('todo-chatbot-upgrade.js','tssTodoChatbotUpgrade'))
    .then(() => loadScript('role-visibility.js','tssRoleVisibility'))
    .then(() => loadScript('realtime-performance.js','tssRealtimePerformance'))
    .then(() => loadScript('workflow-finalization.js','tssWorkflowFinalization'))
    .then(() => loadScript('requirement-screening-selection-fix.js','tssRequirementScreeningSelectionFix'))
    .then(() => {
      setTimeout(async () => {
        try {
          const session = await window.TSSBackend?.client?.auth?.getSession?.();
          if (session?.data?.session?.user) {
            window.TSSRequirementsLiveSync?.boot?.();
            setTimeout(() => window.TSSProduction?.hydrate?.(), 220);
            setTimeout(() => window.TSSCandidateResumeHydration?.hydrateResumeText?.(), 255);
            setTimeout(() => window.TSSRequirementStatusVisibility?.refresh?.(), 270);
            setTimeout(() => window.TSSDashboardCleanup?.apply?.(), 320);
            setTimeout(() => window.TSSDashboardActions?.wire?.(), 350);
            setTimeout(() => window.TSSInterviewActions?.syncStatuses?.(), 380);
            setTimeout(() => window.TSSResdexAssistant?.decorate?.(), 420);
            setTimeout(() => window.TSSResdexFinalSafe?.apply?.(), 520);
            setTimeout(() => window.TSSResdexQuickImport?.decorate?.(), 580);
            setTimeout(() => window.TSSRecruitmentWorkflow?.boot?.(), 650);
            setTimeout(() => window.TSSAssignmentCleanLayout?.boot?.(), 720);
            setTimeout(() => window.TSSClientOwnerAuto?.applyOwnerForCurrentClient?.({silent:true}), 735);
            setTimeout(() => window.TSSRequirementAcknowledgementUI?.refresh?.(), 745);
            setTimeout(() => window.TSSRequirementPositions?.ensure?.(), 770);
            setTimeout(() => window.TSSRequirementSaveSync?.wire?.(), 820);
            setTimeout(() => window.TSSRequirementDetailsOwnerSync?.patch?.(), 880);
            setTimeout(() => window.TSSAdminRoleUI?.boot?.(), 940);
            setTimeout(() => window.TSSScreeningCleanup?.apply?.(), 980);
            setTimeout(() => window.TSSRoleVisibility?.apply?.(), 1020);
            setTimeout(() => window.TSSRealtimePerformance?.subscribe?.(), 1100);
            setTimeout(() => window.TSSWorkflowFinalization?.cleanDuplicateAdmin?.(), 1160);
            setTimeout(() => window.TSSWorkflowFinalization?.decorateInterviewOutcomes?.(), 1200);
          }
        } catch (err) {
          console.warn('TODO AI session restore check', err?.message || err);
        }
      }, 100);
    })
    .then(() => loadScript('todo-ai-branding.js','tssTodoAiBranding'))
    .then(() => loadScript('profile-logout.js','tssProfileLogout'))
    .then(() => loadScript('login-final-guard.js','tssLoginFinalGuard'))
    .then(() => loadScript('login-todo-visible.js','tssLoginTodoVisible'))
    .then(() => window.TSSLoginTodoVisible?.schedule?.())
    .catch(err => console.warn('TODO AI production layer load issue', err));
});