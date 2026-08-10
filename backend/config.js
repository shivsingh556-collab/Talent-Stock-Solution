// Talent Buddy Supabase runtime configuration.
window.TSS_SUPABASE_CONFIG = window.TSS_SUPABASE_CONFIG || {
  url: 'https://wbclpjdjhlsuspojtner.supabase.co',
  anonKey: 'sb_publishable_qx9Xf31udLMuRWmqNAjBFQ_I7woPxap'
};

// Load the latest 46-profile master after the core application scripts finish.
// This keeps the uploaded workbook data authoritative without wiping candidates/screenings.
window.addEventListener('load', () => {
  if (document.querySelector('script[data-tss-profile-sync]')) return;
  const s = document.createElement('script');
  s.src = 'profile-sync-46.js';
  s.dataset.tssProfileSync = '1';
  document.body.appendChild(s);
});
