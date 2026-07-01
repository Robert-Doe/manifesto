// NeuralTab — assets/inject.js (Module 06 — unchanged from M05)
// Runs in the PAGE WORLD (world 0). Has access to page's JS globals but NOT chrome.* APIs.
// Communicates with the content script via window.postMessage (cross-world boundary).

(function () {
  'use strict';

  if (window.__neuralTabInjected) return;
  window.__neuralTabInjected = true;

  // ── Helper: post to content script ─────────────────────────────────────────
  function sendToContent(type, payload, requestId) {
    window.postMessage({ source: 'neuraltab-inject', type, payload, requestId }, '*');
  }

  // ── Helper: request/response over postMessage ────────────────────────────────
  // Creates a promise that resolves when the content script echoes back the requestId.
  let _reqId = 0;
  function request(type, payload) {
    return new Promise((resolve, reject) => {
      const id      = 'nt-' + (++_reqId);
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error(`NeuralTab inject: timeout waiting for ${type}`));
      }, 3000);

      function handler(e) {
        if (e.source !== window) return;
        if (!e.data || e.data.source !== 'neuraltab-content') return;
        if (e.data.requestId !== id) return;
        window.removeEventListener('message', handler);
        clearTimeout(timeout);
        resolve(e.data.result);
      }
      window.addEventListener('message', handler);
      sendToContent(type, payload, id);
    });
  }

  // ── Public API exposed on window.__neuralTab ──────────────────────────────────
  // Pages can call window.__neuralTab.getWordCount() etc. from the console for debugging.
  window.__neuralTab = {
    // Get word count from content script's TreeWalker
    getWordCount: () => request('GET_WORD_COUNT', {}),

    // Relay arbitrary data to the background via the 3-hop chain:
    // page world → (postMessage) → content script → (sendMessage) → background
    relayToBackground: (payload) => request('RELAY_TO_BACKGROUND', payload),

    // Expose version for debugging
    version: '0.6.0',
  };

  // ── Listen for responses from content script ──────────────────────────────────
  window.addEventListener('message', e => {
    if (e.source !== window) return;
    if (!e.data || e.data.source !== 'neuraltab-content') return;
    // Handled by individual request() promises above
  });

})();
