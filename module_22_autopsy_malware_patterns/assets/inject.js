// NeuralTab — assets/inject.js (Module 07 — unchanged from M06)
// Runs in page world — NO chrome.* access

'use strict';

(function () {
  if (window.__neuralTab) return;

  window.__neuralTab = {
    relayToBackground(payload) {
      return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).slice(2);
        const timeout   = setTimeout(() => reject(new Error('NeuralTab relay timeout')), 3000);

        window.addEventListener('message', function handler(e) {
          if (e.data?.type !== 'RELAY_RESPONSE' || e.data?.requestId !== requestId) return;
          window.removeEventListener('message', handler);
          clearTimeout(timeout);
          if (e.data.error) reject(new Error(e.data.error));
          else resolve(e.data.result);
        });

        window.postMessage({
          source: 'neuraltab-inject',
          type:   'RELAY_TO_BACKGROUND',
          payload,
          requestId
        }, '*');
      });
    }
  };
})();
