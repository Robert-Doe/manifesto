// NeuralTab — browser_polyfill.js (Module 17)
// Minimal WebExtensions browser namespace polyfill for cross-browser compatibility
// In Chrome: chrome.* exists, browser.* may not (or is not promise-based)
// In Firefox: browser.* exists with native Promises
// In Safari: browser.* exists (MV3 only in Safari 16+)
'use strict';

if (typeof browser === 'undefined') {
  // We're in Chrome — create a browser namespace that wraps chrome with Promises
  window.browser = (() => {
    function promisify(fn) {
      return function(...args) {
        return new Promise((resolve, reject) => {
          fn(...args, (...results) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(results.length === 1 ? results[0] : results);
            }
          });
        });
      };
    }

    function wrapNamespace(ns) {
      const wrapped = {};
      for (const key of Object.keys(ns)) {
        const val = ns[key];
        if (typeof val === 'function') {
          // If the function's last param is named 'callback' by convention, promisify it
          wrapped[key] = promisify(val.bind(ns));
        } else if (val && typeof val === 'object' && !Array.isArray(val)) {
          wrapped[key] = wrapNamespace(val);
        } else {
          wrapped[key] = val;
        }
      }
      return wrapped;
    }

    return {
      runtime:  wrapNamespace(chrome.runtime),
      storage:  wrapNamespace(chrome.storage),
      tabs:     wrapNamespace(chrome.tabs),
      scripting: wrapNamespace(chrome.scripting),
      alarms:   wrapNamespace(chrome.alarms),
      bookmarks: wrapNamespace(chrome.bookmarks),
      history:  wrapNamespace(chrome.history),
    };
  })();
}

// Feature detection helpers used throughout the extension
window.NTCompat = {
  hasSidePanel: () => !!chrome.sidePanel,
  hasOffscreen: () => !!chrome.offscreen,
  hasSession:   () => !!chrome.storage?.session,
  isFirefox:    () => typeof InstallTrigger !== 'undefined',
  isSafari:     () => /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
  isChrome:     () => !!window.chrome && !NTCompat.isFirefox() && !NTCompat.isSafari(),
  manifestVersion: () => chrome.runtime.getManifest().manifest_version,
};
