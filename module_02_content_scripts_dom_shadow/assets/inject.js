// ============================================================
// NeuralTab — assets/inject.js
// Module 02: Content Scripts, DOM Surgery & Web Accessible Resources
//
// THIS FILE RUNS IN THE PAGE'S MAIN WORLD (world 0).
//
// It is NOT a content script — it is a regular script injected
// into the page via a <script src="..."> tag from content.js.
// Chrome serves this file from the extension package because
// it is declared in manifest.json under web_accessible_resources.
//
// Why this file exists:
//   Content scripts run in isolated world 1. They share the DOM
//   with the page but have a completely separate JavaScript heap.
//   This means content scripts CANNOT read page-defined variables:
//
//     window.React         → undefined in content script
//     window.__NEXT_DATA__ → undefined in content script
//     window.angular       → undefined in content script
//
//   inject.js runs in world 0 alongside the page's own JS. From
//   here, window.React IS accessible. We read it and communicate
//   the results back to content.js via window.postMessage — the
//   only channel that crosses the world boundary.
//
// Security note: Because this script runs with the PAGE's trust
// level (not the extension's), it has NO access to chrome.* APIs.
// chrome.runtime, chrome.storage, etc. are all undefined here.
// ============================================================

(function () {
  'use strict';

  // Collect everything interesting from the page's main world
  const payload = {};

  // ── Detect front-end frameworks ──────────────────────────────
  payload.frameworks = [];

  if (window.React)                  payload.frameworks.push('React');
  if (window.Vue)                    payload.frameworks.push('Vue');
  if (window.angular)                payload.frameworks.push('Angular');
  if (window.__NEXT_DATA__)          payload.frameworks.push('Next.js');
  if (window.Nuxt)                   payload.frameworks.push('Nuxt');
  if (window.svelte)                 payload.frameworks.push('Svelte');
  if (window.Ember)                  payload.frameworks.push('Ember');
  if (window.Backbone)               payload.frameworks.push('Backbone');
  if (window.jQuery || window.$)     payload.frameworks.push('jQuery');

  // ── Read Next.js page data (if present) ─────────────────────
  // Next.js injects a JSON blob into window.__NEXT_DATA__ that
  // contains the page's server-side props. Pure gold for AI summarization.
  if (window.__NEXT_DATA__) {
    try {
      payload.nextData = {
        page:   window.__NEXT_DATA__.page,
        query:  window.__NEXT_DATA__.query,
        // Grab the first 500 chars of page props as a preview
        propsPreview: JSON.stringify(window.__NEXT_DATA__.props).slice(0, 500)
      };
    } catch (_) { /* ignore serialization errors */ }
  }

  // ── Read Nuxt page data (if present) ────────────────────────
  if (window.__NUXT__) {
    try {
      payload.nuxtData = { detected: true };
    } catch (_) {}
  }

  // ── Read the page's meta tags ────────────────────────────────
  // Meta tags are in the DOM so content.js could read them, but
  // we demonstrate that inject.js can also do it from world 0.
  payload.meta = {};
  document.querySelectorAll('meta[name], meta[property]').forEach(el => {
    const key = el.getAttribute('name') || el.getAttribute('property');
    const val = el.getAttribute('content');
    if (key && val) payload.meta[key] = val;
  });

  // ── Detect if the page has a Service Worker registered ───────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      payload.serviceWorkers = regs.length;
      sendToContentScript(payload);
    }).catch(() => sendToContentScript(payload));
  } else {
    sendToContentScript(payload);
  }

  // ── Send results to content.js via postMessage ───────────────
  //
  // Both worlds share the same window object, so postMessage
  // crosses the isolated-world boundary. content.js listens for
  // this event with event.data.source === 'neuraltab-inject'.
  //
  // We wrap in a try/catch because some pages override postMessage.
  //
  function sendToContentScript(data) {
    try {
      window.postMessage({
        source:  'neuraltab-inject',
        payload: data
      }, '*');
    } catch (e) {
      // Cannot communicate — page may have locked down postMessage
    }
  }

})();
