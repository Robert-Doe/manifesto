// NeuralTab — assets/inject.js (Module 05 — unchanged from M04)
// Runs in the page's main world (world 0). No chrome.* APIs available.

(function () {
  'use strict';
  const payload = {};
  payload.frameworks = [];
  if (window.React)         payload.frameworks.push('React');
  if (window.Vue)           payload.frameworks.push('Vue');
  if (window.angular)       payload.frameworks.push('Angular');
  if (window.__NEXT_DATA__) payload.frameworks.push('Next.js');
  if (window.Nuxt)          payload.frameworks.push('Nuxt');
  if (window.jQuery || window.$) payload.frameworks.push('jQuery');
  if (window.__NEXT_DATA__) {
    try { payload.nextData = { page: window.__NEXT_DATA__.page, query: window.__NEXT_DATA__.query }; } catch (_) {}
  }
  payload.meta = {};
  document.querySelectorAll('meta[name],meta[property]').forEach(el => {
    const key = el.getAttribute('name') || el.getAttribute('property');
    const val = el.getAttribute('content');
    if (key && val) payload.meta[key] = val;
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(regs => { payload.serviceWorkers = regs.length; send(payload); })
      .catch(() => send(payload));
  } else { send(payload); }
  function send(data) { try { window.postMessage({ source: 'neuraltab-inject', payload: data }, '*'); } catch (_) {} }
})();
