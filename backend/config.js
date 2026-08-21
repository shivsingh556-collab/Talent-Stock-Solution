// TODO AI Supabase runtime configuration.
window.TSS_SUPABASE_CONFIG = window.TSS_SUPABASE_CONFIG || {
  url: 'https://wbclpjdjhlsuspojtner.supabase.co',
  anonKey: 'sb_publishable_qx9Xf31udLMuRWmqNAjBFQ_I7woPxap'
};

window.addEventListener('load', () => {
  const BUILD = '20260821-clean-status-filter-v23';
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
    .then(() => loadScript('document-parser.js','tssDocumentParser'))
    .then(() => loadScript('candidate-enrichment.js','tssCandidateEnrichment'))
    .then(() => loadScript('production.js','tssProduction'))
    .then(() => loadScript('interview-sync.js','tssInterviewSync'))
    .then(() => loadScript('interview-actions.js','tssInterviewActions'))
    .then(() => loadScript('stable-runtime.js','tssStableRuntime'))
    .then(() => loadScript('requirement-status-visibility.js','tssRequirementStatusVisibility'))
    .then(() => loadScript('requirements-live-sync.js','tssRequirementsLiveSync'))
    .then(() => loadScript('safe-backend-features.js','tssSafeBackendFeatures'))
    .then(() => loadScript('dashboard-cleanup.js','tssDashboardCleanup'))
    .then(() => loadScript('resdex-assistant.js','tssResdexAssistant'))
    .then(() => loadScript('resdex-final-safe.js','tssResdexFinalSafe'))
    .then(() => loadScript('resdex-import-quick.js','tssResdexQuickImport'))
    .then(() => loadScript('recruitment-workflow.js','tssRecruitmentWorkflow'))
    .then(() => loadScript('assignment-clean-layout.js','tssAssignmentCleanLayout'))
    .then(() => loadScript('requirement-positions-field.js','tssRequirementPositions'))
    .then(() => loadScript('requirement-save-sync.js','tssRequirementSaveSync'))
    .then(() => loadScript('requirement-details-owner-sync.js','tssRequirementDetailsOwnerSync'))
    .then(() => loadScript('admin-role-ui.js','tssAdminRoleUi'))
    .then(() => {
      setTimeout(async () => {
        try {
          const session = await window.TSSBackend?.client?.auth?.getSession?.();
          if (session?.data?.session?.user) {
            window.TSSRequirementsLiveSync?.boot?.();
            setTimeout(() => window.TSSProduction?.hydrate?.(), 220);
            setTimeout(() => window.TSSRequirementStatusVisibility?.refresh?.(), 270);
            setTimeout(() => window.TSSDashboardCleanup?.apply?.(), 320);
            setTimeout(() => window.TSSInterviewActions?.syncStatuses?.(), 380);
            setTimeout(() => window.TSSResdexAssistant?.decorate?.(), 420);
            setTimeout(() => window.TSSResdexFinalSafe?.apply?.(), 520);
            setTimeout(() => window.TSSResdexQuickImport?.decorate?.(), 580);
            setTimeout(() => window.TSSRecruitmentWorkflow?.boot?.(), 650);
            setTimeout(() => window.TSSAssignmentCleanLayout?.boot?.(), 720);
            setTimeout(() => window.TSSRequirementPositions?.ensure?.(), 770);
            setTimeout(() => window.TSSRequirementSaveSync?.wire?.(), 820);
            setTimeout(() => window.TSSRequirementDetailsOwnerSync?.patch?.(), 880);
            setTimeout(() => window.TSSAdminRoleUI?.boot?.(), 940);
          }
        } catch (err) {
          console.warn('TODO AI session restore check', err?.message || err);
        }
      }, 100);
    })
    .then(() => loadScript('todo-ai-branding.js','tssTodoAiBranding'))
    .then(() => loadScript('profile-logout.js','tssProfileLogout'))
    .then(() => loadScript('login-final-guard.js','tssLoginFinalGuard'))
    .catch(err => console.warn('TODO AI production layer load issue', err));
});