// Talent Buddy Supabase runtime configuration.
window.TSS_SUPABASE_CONFIG = window.TSS_SUPABASE_CONFIG || {
  url: 'https://wbclpjdjhlsuspojtner.supabase.co',
  anonKey: 'sb_publishable_qx9Xf31udLMuRWmqNAjBFQ_I7woPxap'
};

window.addEventListener('load', () => {
  const addCss = (href) => {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = href;
    document.head.appendChild(css);
  };
  addCss('production-polish.css');
  addCss('requirements-perfect-fix.css');

  const loadScript = (src, marker) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-${marker}]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.dataset[marker] = '1';
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });

  // Stability-first load order. Avoid repeating timers/observers from legacy hardening layers.
  loadScript('brand-assets.js','tssBrandAssets')
    .then(() => loadScript('todo-exact.js','tssExactTodo'))
    .then(() => loadScript('profile-sync-46.js','tssProfileSync'))
    .then(() => loadScript('profile-sync-47-final.js','tssProfileSync47'))
    .then(() => loadScript('document-parser.js','tssDocumentParser'))
    .then(() => loadScript('candidate-enrichment.js','tssCandidateEnrichment'))
    .then(() => loadScript('production.js','tssProduction'))
    .then(() => loadScript('interview-sync.js','tssInterviewSync'))
    .then(() => loadScript('stable-runtime.js','tssStableRuntime'))
    .catch(err => console.warn('TSS production layer load issue', err));
});
