/* English font switch: ?en=schibsted | ?en=almoni (remembered in this browser). Loaded in <head>, before paint. */
(function () {
  try {
    var q = new URLSearchParams(location.search).get('en');
    if (q) localStorage.setItem('ds-en', q);
    var v = q || localStorage.getItem('ds-en');
    if (v && v !== 'almoni') document.documentElement.setAttribute('data-en', v);
  } catch (e) {}
})();
