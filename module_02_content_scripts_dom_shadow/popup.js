// ============================================================
// NeuralTab — popup.js  (Module 02)
//
// New in this module: we use chrome.scripting.executeScript()
// to send commands from the popup to the content script running
// in the active tab. The popup cannot directly call functions
// defined in content.js — they run in different contexts.
// executeScript injects a new script into the tab that can call
// the content script's exposed globals.
//
// In Module 06 we replace this with proper message passing
// (chrome.tabs.sendMessage). For now, executeScript is simpler
// to understand because it's a direct function call.
// ============================================================

'use strict';

const elUrl      = document.getElementById('current-url');
const elCsDot    = document.getElementById('cs-dot');
const elCsStatus = document.getElementById('cs-status');
const elCsNote   = document.getElementById('cs-note');

// ── 1. Get active tab info ────────────────────────────────────
chrome.tabs.query({ active: true, currentWindow: true })
  .then(([tab]) => {
    if (!tab) return;

    elUrl.textContent = tab.url || '(restricted page)';

    // Check if the content script can run on this URL.
    // Content scripts cannot inject into chrome:// or edge:// pages,
    // the Chrome Web Store, or other extension pages.
    const restricted = isRestrictedUrl(tab.url || '');
    if (restricted) {
      setStatus('warn', 'Cannot inject here', restricted);
      return;
    }

    // Ping the tab to confirm content.js is alive.
    // executeScript returns a Promise that resolves with results
    // from each frame the script ran in.
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func:   () => !!window.__neuraltab_injected__
    })
    .then((results) => {
      const injected = results?.[0]?.result;
      if (injected) {
        setStatus('ok', 'Content script active', 'NeuralTab button is live on this page.');
      } else {
        setStatus('warn', 'Not yet injected', 'Reload the page to inject the content script.');
      }
    })
    .catch(() => {
      setStatus('err', 'Injection failed', 'This page may block extension scripts.');
    });

    // Store tabId for button handlers
    popup.activeTabId = tab.id;
  });

// ── 2. Status helper ──────────────────────────────────────────
function setStatus(type, text, note = '') {
  elCsDot.className    = `status-dot dot-${type}`;
  elCsStatus.textContent = text;
  elCsNote.textContent   = note;
}

// ── 3. Detect restricted URLs ─────────────────────────────────
function isRestrictedUrl(url) {
  if (!url)                              return 'No URL available.';
  if (url.startsWith('chrome://'))       return 'Chrome internal pages block all extensions.';
  if (url.startsWith('chrome-extension'))return 'Extension pages cannot be injected into.';
  if (url.startsWith('https://chrome.google.com/webstore')) {
    return 'The Chrome Web Store blocks extension injection for security.';
  }
  if (url.startsWith('edge://'))         return 'Edge internal pages block all extensions.';
  if (url === '' || url === 'about:blank') return 'Blank or empty tabs have no DOM to inject into.';
  return null; // not restricted
}

// ── 4. Extension metadata ─────────────────────────────────────
const manifest = chrome.runtime.getManifest();
document.getElementById('ext-version').textContent = manifest.version;

// ── 5. Popup action state ─────────────────────────────────────
const popup = { activeTabId: null };

// ── 6. Button handlers — send commands to the active tab ──────
//
// We use chrome.scripting.executeScript to call functions that
// were defined by content.js on window.NeuralTabContent.
// This only works because content.js attached NeuralTabContent
// to the window object of the isolated world — visible to
// subsequent executeScript calls targeting the same tab.
//
document.getElementById('btn-toggle-btn').addEventListener('click', () => {
  runInTab(() => {
    const host = document.getElementById('neuraltab-host');
    if (host) {
      host.style.display = host.style.display === 'none' ? '' : 'none';
    }
  });
});

document.getElementById('btn-highlight').addEventListener('click', () => {
  runInTab(() => {
    if (window.NeuralTabContent) {
      window.NeuralTabContent.highlightLongWords();
    }
  });
});

document.getElementById('btn-clear').addEventListener('click', () => {
  runInTab(() => {
    if (window.NeuralTabContent) {
      window.NeuralTabContent.clearHighlights();
      window.NeuralTabContent.hidePanel();
    }
  });
});

// ── Helper: execute a function in the active tab ──────────────
function runInTab(fn) {
  if (!popup.activeTabId) return;
  chrome.scripting.executeScript({
    target: { tabId: popup.activeTabId },
    func:   fn
  }).catch(err => console.warn('[NeuralTab popup] executeScript failed:', err));
}
