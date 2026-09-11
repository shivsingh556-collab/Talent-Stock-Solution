(function(){
  try {
    if (typeof db !== 'undefined') {
      Object.defineProperty(window, 'db', {
        configurable: true,
        get: function(){ return db; }
      });
    }
  } catch (error) {
    console.warn('Talent Discovery state bridge unavailable', error);
  }

  try {
    if (typeof gotoView === 'function') window.gotoView = gotoView;
    if (typeof toast === 'function') window.toast = toast;
  } catch (error) {
    console.warn('Talent Discovery navigation bridge unavailable', error);
  }
})();
