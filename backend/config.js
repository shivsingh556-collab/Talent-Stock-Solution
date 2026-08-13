// TODO AI Supabase runtime configuration.
window.TSS_SUPABASE_CONFIG = window.TSS_SUPABASE_CONFIG || {
  url: 'https://wbclpjdjhlsuspojtner.supabase.co',
  anonKey: 'sb_publishable_qx9Xf31udLMuRWmqNAjBFQ_I7woPxap'
};

window.addEventListener('load', () => {
  const BUILD = '20260813-47-authoritative';
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

  // Supabase is the single source of truth for requirements.
  // Do NOT load legacy local profile seed scripts here; they were the source of the stale 42/46 UI.
  loadScript('brand-assets.js','tssBrandAssets')
    .then(() => loadScript('todo-exact.js','tssExactTodo'))
    .then(() => loadScript('document-parser.js','tssDocumentParser'))
    .then(() => loadScript('candidate-enrichment.js','tssCandidateEnrichment'))
    .then(() => loadScript('production.js','tssProduction'))
    .then(() => loadScript('interview-sync.js','tssInterviewSync'))
    .then(() => loadScript('stable-runtime.js','tssStableRuntime'))
    .then(() => loadScript('requirements-live-sync.js','tssRequirementsLiveSync'))
    .then(() => {
      // Force one authoritative hydrate after all runtime code and session restoration are available.
      setTimeout(() => window.TSSRequirementsLiveSync?.boot?.(), 100);
      setTimeout(() => window.TSSProduction?.hydrate?.(), 350);
    })
    .then(() => loadScript('todo-ai-branding.js','tssTodoAiBranding'))
    .then(() => loadScript('profile-logout.js','tssProfileLogout'))
    .catch(err => console.warn('TODO AI production layer load issue', err));
});
