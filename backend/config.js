// Talent Buddy Supabase runtime configuration.
window.TSS_SUPABASE_CONFIG = window.TSS_SUPABASE_CONFIG || {
  url: 'https://wbclpjdjhlsuspojtner.supabase.co',
  anonKey: 'sb_publishable_qx9Xf31udLMuRWmqNAjBFQ_I7woPxap'
};

// Load production brand + polish + 46-profile sync after the core application scripts finish.
window.addEventListener('load', () => {
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'production-polish.css';
  document.head.appendChild(css);

  const loadScript = (src, marker) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-${marker}]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.dataset[marker] = '1';
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });

  loadScript('brand-assets.js','tssBrandAssets')
    .then(() => loadScript('profile-sync-46.js','tssProfileSync'))
    .then(() => loadScript('production.js','tssProduction'))
    .catch(err => console.warn('TSS production layer load issue', err));
});
