// NeuralTab — content.js (Module 07)
// Adds: page visit logging to IndexedDB via background message

'use strict';

let wordCountCache = 0;

function countWords() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: n => {
      const p = n.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      const tag = p.tagName;
      if (['SCRIPT','STYLE','NOSCRIPT','TEMPLATE'].includes(tag)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let words = 0;
  let node;
  while ((node = walker.nextNode())) words += node.textContent.trim().split(/\s+/).filter(Boolean).length;
  return words;
}

function injectUI() {
  if (document.getElementById('neuraltab-root')) return;
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', injectUI); return; }

  const root = document.createElement('div');
  root.id = 'neuraltab-root';
  const shadow = root.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    #nt-bar{position:fixed;bottom:20px;right:20px;background:#0b0f1a;border:1px solid #f5c842;
    border-radius:8px;padding:8px 14px;font-family:sans-serif;font-size:13px;color:#f5c842;
    z-index:2147483647;display:none;align-items:center;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,0.5);}
    #nt-bar.visible{display:flex;}
    #nt-close{cursor:pointer;color:#7a9bbf;font-size:16px;line-height:1;}
    #nt-notice{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#0b0f1a;
    border:1px solid #38bdf8;border-radius:8px;padding:10px 20px;font-family:sans-serif;
    font-size:14px;color:#38bdf8;z-index:2147483647;display:none;animation:fadein 0.3s;}
    #nt-notice.visible{display:block;}
    @keyframes fadein{from{opacity:0;top:10px}to{opacity:1;top:20px}}
  `;
  shadow.appendChild(style);

  const bar = document.createElement('div');
  bar.id = 'nt-bar';
  bar.innerHTML = `<span id="nt-wc">⚡ NeuralTab</span><span id="nt-close">✕</span>`;
  shadow.appendChild(bar);

  const notice = document.createElement('div');
  notice.id = 'nt-notice';
  shadow.appendChild(notice);

  shadow.getElementById('nt-close').addEventListener('click', () => bar.classList.remove('visible'));
  document.documentElement.appendChild(root);

  window.__neuralTabShadow = shadow;
}

function showPageNotice(text) {
  const notice = window.__neuralTabShadow?.getElementById?.('nt-notice');
  if (!notice) return;
  notice.textContent = text;
  notice.classList.add('visible');
  setTimeout(() => notice.classList.remove('visible'), 3000);
}

// Log page visit to background → IndexedDB
async function logVisit() {
  wordCountCache = countWords();
  chrome.runtime.sendMessage({
    action:    'logPageVisit',
    url:       location.href,
    title:     document.title,
    wordCount: wordCountCache
  });
}

// Listen for messages from background
function listenForBackgroundMessages() {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'contentPing') {
      sendResponse({ pong: true, wordCount: wordCountCache, url: location.href });
      return false;
    }
    if (msg.action === 'getWordCount') {
      sendResponse({ wordCount: countWords() });
      return false;
    }
    if (msg.action === 'showPageNotice') {
      showPageNotice(msg.text || '');
      sendResponse({ ok: true });
      return false;
    }
  });
}

// Listen for postMessage from inject.js (page world)
function listenForPageMessages() {
  window.addEventListener('message', async e => {
    if (e.data?.source !== 'neuraltab-inject') return;
    if (e.data?.type !== 'RELAY_TO_BACKGROUND') return;
    const { payload, requestId } = e.data;
    try {
      const result = await chrome.runtime.sendMessage({ action: 'relayFromPage', payload, requestId });
      window.postMessage({ type: 'RELAY_RESPONSE', requestId, result }, '*');
    } catch (err) {
      window.postMessage({ type: 'RELAY_RESPONSE', requestId, error: err.message }, '*');
    }
  });
}

// SPA navigation detection
function watchNavigation() {
  let lastUrl = location.href;
  const obs = new MutationObserver(() => {
    if (location.href !== lastUrl) { lastUrl = location.href; setTimeout(logVisit, 500); }
  });
  obs.observe(document, { subtree: true, childList: true });
}

// Inject page-world script
function injectPageScript() {
  const s = document.createElement('script');
  s.src   = chrome.runtime.getURL('assets/inject.js');
  s.onload = () => s.remove();
  (document.head || document.documentElement).appendChild(s);
}

injectUI();
listenForBackgroundMessages();
listenForPageMessages();
injectPageScript();

if (['complete', 'interactive'].includes(document.readyState)) {
  logVisit();
} else {
  document.addEventListener('DOMContentLoaded', logVisit);
}

watchNavigation();
