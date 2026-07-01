// NeuralTab — content.js (Module 04 — cumulative)
// Injected into every page. Runs in isolated world (world 1).

'use strict';

const NeuralTabContent = (() => {

  let settings  = {};
  let host      = null;
  let shadow    = null;
  let panel     = null;
  let summarizeBtn = null;
  let observer  = null;
  let lastUrl   = location.href;

  // ─── Init ─────────────────────────────────────────────────────────────────

  async function init() {
    settings = await StorageManager.get();

    if (await StorageManager.isBlocked(location.hostname)) return;
    if (!settings.buttonVisible) return;

    injectFloatingButton();
    injectMainWorldScript();
    watchForSPANavigation();

    StorageManager.onChange(onSettingsChange);
  }

  // ─── Floating Button + Shadow DOM Panel ───────────────────────────────────

  function injectFloatingButton() {
    if (document.getElementById('neuraltab-host')) return;

    host   = document.createElement('div');
    host.id = 'neuraltab-host';
    shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = getButtonStyles();
    shadow.appendChild(style);

    summarizeBtn = document.createElement('button');
    summarizeBtn.id = 'nt-btn';
    summarizeBtn.textContent = '⚡';
    summarizeBtn.title = 'NeuralTab — Summarize';
    summarizeBtn.addEventListener('click', onSummarizeClick);
    shadow.appendChild(summarizeBtn);

    panel = buildSummaryPanel();
    shadow.appendChild(panel);

    applyButtonPosition(settings.buttonPosition);
    document.body.appendChild(host);
  }

  function buildSummaryPanel() {
    const p = document.createElement('div');
    p.id = 'nt-panel';
    p.innerHTML = `
      <div id="nt-panel-header">
        <span id="nt-panel-title">NeuralTab</span>
        <button id="nt-close">✕</button>
      </div>
      <div id="nt-panel-body">
        <div id="nt-stats"></div>
        <div id="nt-framework"></div>
        <div id="nt-actions">
          <button class="nt-action-btn" id="nt-btn-highlight">Highlight words</button>
          <button class="nt-action-btn" id="nt-btn-clear">Clear highlights</button>
          <button class="nt-action-btn" id="nt-btn-settings">⚙ Settings</button>
        </div>
      </div>
    `;
    p.style.display = 'none';

    p.querySelector('#nt-close').addEventListener('click', () => {
      p.style.display = 'none';
    });
    p.querySelector('#nt-btn-highlight').addEventListener('click', highlightLongWords);
    p.querySelector('#nt-btn-clear').addEventListener('click', clearHighlights);
    p.querySelector('#nt-btn-settings').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openOptions' });
    });
    return p;
  }

  function applyButtonPosition(position) {
    if (!summarizeBtn) return;
    const pos = position || 'bottom-right';
    const isLeft = pos.includes('left');
    const isTop  = pos.includes('top');
    summarizeBtn.style.cssText = `
      position: fixed;
      ${isTop ? 'top: 20px' : 'bottom: 20px'};
      ${isLeft ? 'left: 20px' : 'right: 20px'};
    `;
    if (panel) {
      panel.style.cssText = `
        position: fixed;
        ${isTop ? 'top: 70px' : 'bottom: 70px'};
        ${isLeft ? 'left: 14px' : 'right: 14px'};
      `;
    }
  }

  // ─── Summarize Action ─────────────────────────────────────────────────────

  async function onSummarizeClick() {
    const wordCount = countWords();
    const readingMins = Math.ceil(wordCount / (settings.readingSpeed || 200));

    const statsEl = shadow.getElementById('nt-stats');
    statsEl.innerHTML = `
      <div class="nt-stat-row">Words: <strong>${wordCount.toLocaleString()}</strong></div>
      <div class="nt-stat-row">Reading time: <strong>~${readingMins} min</strong></div>
      <div class="nt-stat-row">Speed: <strong>${settings.readingSpeed} wpm</strong></div>
      <div class="nt-stat-row">Highlight colour: <span class="nt-color-swatch" style="background:${settings.highlightColor}"></span></div>
    `;

    panel.style.display = '';
    await StorageManager.recordSummary();
  }

  // ─── Word Counter (TreeWalker) ────────────────────────────────────────────

  function countWords() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const tag = node.parentElement?.tagName?.toLowerCase();
          if (['script','style','noscript','iframe'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          // Skip our own injected content
          if (node.parentElement?.closest?.('#neuraltab-host')) {
            return NodeFilter.FILTER_REJECT;
          }
          return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        },
      }
    );
    let count = 0;
    while (walker.nextNode()) {
      count += walker.currentNode.textContent.trim().split(/\s+/).filter(Boolean).length;
    }
    return count;
  }

  // ─── Highlight Long Words ─────────────────────────────────────────────────

  function highlightLongWords() {
    clearHighlights();
    const minLen = settings.highlightMinLen || 8;
    const color  = settings.highlightColor  || '#f5c842';
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const tag = node.parentElement?.tagName?.toLowerCase();
          if (['script','style','noscript','iframe'].includes(tag)) return NodeFilter.FILTER_REJECT;
          if (node.parentElement?.closest?.('#neuraltab-host'))      return NodeFilter.FILTER_REJECT;
          if (node.parentElement?.dataset?.ntHighlight)               return NodeFilter.FILTER_REJECT;
          return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        },
      }
    );

    const nodesToProcess = [];
    while (walker.nextNode()) nodesToProcess.push(walker.currentNode);

    const pattern = new RegExp(`(\\b\\w{${minLen},}\\b)`, 'g');

    for (const node of nodesToProcess) {
      if (!pattern.test(node.textContent)) continue;
      pattern.lastIndex = 0;

      const frag = document.createDocumentFragment();
      let last = 0;
      let match;

      while ((match = pattern.exec(node.textContent)) !== null) {
        if (match.index > last) {
          frag.appendChild(document.createTextNode(node.textContent.slice(last, match.index)));
        }
        const mark = document.createElement('mark');
        mark.dataset.ntHighlight = '1';
        mark.style.cssText = `
          background: ${color};
          color: ${isLightColor(color) ? '#000' : '#fff'};
          border-radius: 3px;
          padding: 0 2px;
        `;
        mark.textContent = match[0];
        frag.appendChild(mark);
        last = pattern.lastIndex;
      }

      if (last < node.textContent.length) {
        frag.appendChild(document.createTextNode(node.textContent.slice(last)));
      }
      node.parentNode.replaceChild(frag, node);
    }
  }

  function clearHighlights() {
    document.querySelectorAll('[data-nt-highlight]').forEach(el => {
      el.replaceWith(document.createTextNode(el.textContent));
    });
  }

  function isLightColor(hex) {
    try {
      const r = parseInt(hex.slice(1,3), 16) / 255;
      const g = parseInt(hex.slice(3,5), 16) / 255;
      const b = parseInt(hex.slice(5,7), 16) / 255;
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.5;
    } catch { return false; }
  }

  // ─── MAIN World Injection (world 0) ──────────────────────────────────────

  function injectMainWorldScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('assets/inject.js');
    (document.head || document.documentElement).appendChild(script);
    script.remove();

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (event.data?.source !== 'neuraltab-inject') return;
      const payload = event.data.payload;
      const frameworkEl = shadow?.getElementById('nt-framework');
      if (!frameworkEl) return;
      if (payload.frameworks?.length) {
        frameworkEl.innerHTML = `<div class="nt-stat-row">Frameworks: <strong>${payload.frameworks.join(', ')}</strong></div>`;
      }
    });
  }

  // ─── SPA Navigation Watch ─────────────────────────────────────────────────

  function watchForSPANavigation() {
    observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        clearHighlights();
        if (panel) panel.style.display = 'none';
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ─── Settings Change Handler ───────────────────────────────────────────────

  function onSettingsChange(changes) {
    if (changes.highlightColor !== undefined) {
      settings.highlightColor = changes.highlightColor;
    }
    if (changes.highlightMinLen !== undefined) {
      settings.highlightMinLen = changes.highlightMinLen;
    }
    if (changes.buttonVisible !== undefined) {
      settings.buttonVisible = changes.buttonVisible;
      if (host) host.style.display = changes.buttonVisible ? '' : 'none';
    }
    if (changes.buttonPosition !== undefined) {
      settings.buttonPosition = changes.buttonPosition;
      applyButtonPosition(changes.buttonPosition);
    }
    if (changes.readingSpeed !== undefined) {
      settings.readingSpeed = changes.readingSpeed;
    }
  }

  // ─── External Action Handler (called from popup via scripting.executeScript) ─

  function handleAction(msg) {
    switch (msg.action) {
      case 'summarize': onSummarizeClick(); break;
      case 'highlight': highlightLongWords(); break;
      case 'clear':     clearHighlights();   break;
      case 'inject':
        injectMainWorldScript();
        if (panel) panel.style.display = '';
        break;
    }
  }

  // ─── Shadow DOM Styles ────────────────────────────────────────────────────

  function getButtonStyles() {
    return `
      #nt-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 44px; height: 44px;
        background: #f5c842;
        color: #000;
        border: none; border-radius: 50%;
        font-size: 20px; cursor: pointer;
        box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        z-index: 2147483646;
        display: flex; align-items: center; justify-content: center;
        transition: transform 0.15s;
      }
      #nt-btn:hover { transform: scale(1.1); }

      #nt-panel {
        position: fixed;
        bottom: 70px; right: 14px;
        width: 260px;
        background: #141c2e;
        border: 1px solid #1e3a5f;
        border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        z-index: 2147483645;
        font-family: 'Lato', sans-serif;
        font-size: 13px;
        color: #e2e8f0;
        overflow: hidden;
      }
      #nt-panel-header {
        background: #0f1623;
        padding: 10px 14px;
        display: flex; justify-content: space-between; align-items: center;
        border-bottom: 1px solid #1e3a5f;
      }
      #nt-panel-title { color: #f5c842; font-weight: 700; font-size: 13px; }
      #nt-close {
        background: none; border: none; color: #7a9bbf;
        cursor: pointer; font-size: 14px; line-height: 1;
      }
      #nt-close:hover { color: #e2e8f0; }
      #nt-panel-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
      .nt-stat-row { display: flex; justify-content: space-between; font-size: 12px; color: #7a9bbf; }
      .nt-stat-row strong { color: #e2e8f0; }
      .nt-color-swatch {
        display: inline-block; width: 14px; height: 14px;
        border-radius: 3px; vertical-align: middle;
        border: 1px solid #1e3a5f;
      }
      #nt-actions { display: flex; flex-direction: column; gap: 5px; margin-top: 4px; }
      .nt-action-btn {
        background: #1a2540; border: 1px solid #1e3a5f;
        color: #e2e8f0; font-size: 12px; font-weight: 700;
        padding: 6px 10px; border-radius: 6px; cursor: pointer;
        transition: border-color 0.15s;
        font-family: 'Lato', sans-serif;
      }
      .nt-action-btn:hover { border-color: #38bdf8; color: #38bdf8; }
    `;
  }

  // ─── Bootstrap ───────────────────────────────────────────────────────────

  init().catch(console.error);

  return { handleAction, countWords, highlightLongWords, clearHighlights };

})();
