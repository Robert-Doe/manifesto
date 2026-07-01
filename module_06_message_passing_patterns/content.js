// NeuralTab — content.js (Module 06 — adds relay pattern + contentPing handler)
// Runs in the ISOLATED WORLD (world 1). Has access to chrome.* APIs but not the page's JS.

'use strict';

// ─── Guard: check if blocked ──────────────────────────────────────────────────
(async () => {
  try {
    const hostname = location.hostname;
    const resp     = await chrome.runtime.sendMessage({ action: 'getTabInfo' });
    if (!resp) return; // background not ready
  } catch { return; }

  await initContentScript();
})();

async function initContentScript() {
  injectPageScript();
  injectFloatingButton();
  listenForPageMessages();
  listenForBackgroundMessages();
  observeSPANavigation();
}

// ─── Inject page-world script (M01) ──────────────────────────────────────────
function injectPageScript() {
  if (document.getElementById('neuraltab-inject')) return;
  const s  = document.createElement('script');
  s.id     = 'neuraltab-inject';
  s.src    = chrome.runtime.getURL('assets/inject.js');
  s.onload = () => s.remove();
  (document.head || document.documentElement).appendChild(s);
}

// ─── Floating button (M02) ───────────────────────────────────────────────────
let shadowHost = null;

async function injectFloatingButton() {
  if (document.getElementById('neuraltab-host')) return;
  const s = await chrome.storage.local.get(['buttonVisible', 'buttonPosition', 'highlightColor', 'blockedDomains']);
  if (!s.buttonVisible) return;
  const blocked = (s.blockedDomains || []).some(d =>
    location.hostname === d || location.hostname.endsWith('.' + d));
  if (blocked) return;

  shadowHost = document.createElement('div');
  shadowHost.id = 'neuraltab-host';
  document.body.appendChild(shadowHost);
  const shadow = shadowHost.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    #nt-btn {
      position: fixed; z-index: 2147483647; cursor: pointer;
      width: 44px; height: 44px; border-radius: 50%;
      background: ${s.highlightColor || '#f5c842'};
      border: none; font-size: 20px; display: flex;
      align-items: center; justify-content: center;
      box-shadow: 0 2px 12px rgba(0,0,0,0.35);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    #nt-btn:hover { transform: scale(1.1); box-shadow: 0 4px 20px rgba(0,0,0,0.45); }
  `;
  const positions = { 'bottom-right': 'bottom:20px;right:20px', 'bottom-left': 'bottom:20px;left:20px',
                       'top-right': 'top:20px;right:20px', 'top-left': 'top:20px;left:20px' };
  style.textContent += `#nt-btn { ${positions[s.buttonPosition] || positions['bottom-right']}; }`;

  const btn = document.createElement('button');
  btn.id = 'nt-btn'; btn.textContent = '⚡';
  btn.setAttribute('title', 'NeuralTab');
  btn.addEventListener('click', onButtonClick);

  shadow.appendChild(style);
  shadow.appendChild(btn);

  // React to settings changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.buttonVisible?.newValue === false) shadowHost?.remove();
    if (changes.highlightColor) btn.style.background = changes.highlightColor.newValue;
  });
}

async function onButtonClick() {
  const wordCount  = countWords();
  const readingTime = calcReadingTime(wordCount);
  chrome.runtime.sendMessage({ action: 'openOptions' });
  await chrome.storage.local.set({
    lastPageWordCount: wordCount,
    lastPageUrl: location.href,
  });
}

// ─── Word counting (M02) ─────────────────────────────────────────────────────
function countWords() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    { acceptNode: n => {
      const p = n.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      const tag = p.tagName?.toLowerCase();
      if (['script','style','noscript','svg','head'].includes(tag)) return NodeFilter.FILTER_REJECT;
      if (getComputedStyle(p).display === 'none') return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }}
  );
  let count = 0;
  while (walker.nextNode()) count += (walker.currentNode.textContent.match(/\S+/g) || []).length;
  return count;
}

function calcReadingTime(wordCount) {
  return Math.max(1, Math.ceil(wordCount / 200));
}

// ─── Listen for page-world messages (M01 + M06) ───────────────────────────────
// Pattern: inject.js (page world) → window.postMessage → content script → background relay
function listenForPageMessages() {
  window.addEventListener('message', async e => {
    if (e.source !== window) return;
    if (!e.data || e.data.source !== 'neuraltab-inject') return;

    const payload = e.data.payload;

    // M06 Pattern 3-hop relay: page → content → background
    if (e.data.type === 'RELAY_TO_BACKGROUND') {
      try {
        const result = await chrome.runtime.sendMessage({
          action:  'relayFromPage',
          payload,
          tabId:   null, // background can read sender.tab.id
        });
        // Echo result back to the page world if requested
        if (e.data.requestId) {
          window.postMessage({
            source:    'neuraltab-content',
            requestId: e.data.requestId,
            result,
          }, '*');
        }
      } catch (err) {
        console.warn('[NeuralTab content] relay failed:', err.message);
      }
      return;
    }

    // Page requesting word count
    if (e.data.type === 'GET_WORD_COUNT') {
      const wc = countWords();
      window.postMessage({
        source:    'neuraltab-content',
        requestId: e.data.requestId,
        result:    { wordCount: wc, readingTime: calcReadingTime(wc) },
      }, '*');
    }
  });
}

// ─── Listen for background → content messages (M06) ──────────────────────────
// Background can send messages TO content scripts via chrome.tabs.sendMessage().
// This handler receives and responds to them.
function listenForBackgroundMessages() {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Background pinging the content script
    if (msg.action === 'contentPing') {
      sendResponse({
        pong:      true,
        url:       location.href,
        wordCount: countWords(),
        ts:        Date.now(),
      });
      return false;
    }

    // Popup requesting word count via background relay
    if (msg.action === 'getWordCount') {
      const wc = countWords();
      sendResponse({ wordCount: wc, readingTime: calcReadingTime(wc) });
      return false;
    }

    // Background sending a notification to display on the page
    if (msg.action === 'showPageNotice') {
      showPageNotice(msg.text, msg.color);
      return false;
    }

    return false;
  });
}

// ─── Transient page notice (used by background relay demo) ───────────────────
function showPageNotice(text, color = '#f5c842') {
  const existing = document.getElementById('neuraltab-notice');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'neuraltab-notice';
  Object.assign(el.style, {
    position: 'fixed', top: '16px', right: '16px', zIndex: '2147483646',
    background: '#0b0f1a', border: `2px solid ${color}`, borderRadius: '8px',
    padding: '12px 16px', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif',
    fontSize: '13px', fontWeight: '700', maxWidth: '320px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)', lineHeight: '1.4',
  });
  el.innerHTML = `<span style="color:${color}">⚡ NeuralTab</span><br>${escHtml(text)}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ─── SPA navigation observer (M02) ───────────────────────────────────────────
function observeSPANavigation() {
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // Re-check blocked status for new URL
      chrome.storage.local.get(['blockedDomains']).then(s => {
        const blocked = (s.blockedDomains || []).some(d =>
          location.hostname === d || location.hostname.endsWith('.' + d));
        if (shadowHost) shadowHost.style.display = blocked ? 'none' : '';
      });
    }
  }).observe(document.body, { childList: true, subtree: true });
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
