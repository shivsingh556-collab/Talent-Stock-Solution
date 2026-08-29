// Bridge for role visibility
(function(){
  if (!document.querySelector('script[src*="role-access-visibility.js"]')) {
    const s = document.createElement('script');
    s.src = 'role-access-visibility.js';
    document.head.appendChild(s);
  }
})();
