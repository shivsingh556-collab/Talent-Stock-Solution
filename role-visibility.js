// Bridge for role visibility
(function(){
  if (!document.querySelector('script[src*="role-access-visibility.js"]')) {
    const s = document.createElement('script');
    const version = new URL(document.currentScript?.src || location.href).searchParams.get('v');
    s.src = `role-access-visibility.js${version ? `?v=${encodeURIComponent(version)}` : ''}`;
    document.head.appendChild(s);
  }
})();
