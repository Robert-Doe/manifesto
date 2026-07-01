// ============================================================
// NeuralTab — content.js
// Module 02: Content Scripts, DOM Surgery & Web Accessible Resources
//
// This file is injected into EVERY page that matches the pattern
// "<all_urls>" (declared in manifest.json under content_scripts).
// Chrome injects it after the page's DOM is ready ("document_idle").
//
// CRITICAL: This script runs in an ISOLATED WORLD.
//   - It CAN read and modify document, window.location, DOM nodes.
//   - It CANNOT access JavaScript variables defined by the page.
//   - It CANNOT access window.React, window.Vue, window.__NEXT_DATA__, etc.
//   - The page's JS cannot access our variables either.
//   - Both worlds share the SAME DOM tree but have separate JS heaps.
//
// To access the page's JS variables, use assets/inject.js which runs
// in the MAIN world via a <script> tag injection. See injectMainWorldScript().
// ============================================================

'use strict';

// ── Guard: avoid running twice on the same page ──────────────
// Chrome re-injects content scripts on soft navigation in some
// cases. A guard constant on window prevents duplicate UI.
if (window.__neuraltab_injected__) {
  // Already running — exit silently
} else {
  window.__neuraltab_injected__ = true;
  NeuralTabContent.init();
}

// ── Namespace everything under one object ────────────────────
// Global variables in a content script are scoped to the isolated
// world, not shared with the page. However, namespacing is still
// good practice to keep the code organized and testable.
const NeuralTabContent = {

  // ── State ───────────────────────────────────────────────────
  floatingBtn:    null,   // the injected button element
  summaryPanel:   null,   // the injected summary panel
  shadowRoot:     null,   // shadow DOM root for style isolation
  highlightActive: false, // whether word highlighting is on
  observer:       null,   // MutationObserver for SPA navigation

  // ── init() — called once per page load ──────────────────────
  init() {
    this.injectFloatingButton();
    this.watchForSPANavigation();
    this.injectMainWorldScript();
  },

  // ── 1. Inject the floating "Summarize" button ───────────────
  //
  // We attach the button to a Shadow DOM host element.
  // Shadow DOM creates a style boundary — the page's CSS cannot
  // reach inside our shadow root, and our CSS cannot bleed out
  // into the page. This is essential for reliable UI injection.
  //
  injectFloatingButton() {
    // Create a host element — a neutral <div> that sits in the
    // page's real DOM but whose interior is a Shadow DOM tree.
    const host = document.createElement('div');
    host.id = 'neuraltab-host';

    // attachShadow creates an isolated subtree.
    // mode: 'open' means page JS can reach the shadow root via
    // host.shadowRoot. Use 'closed' to block that access.
    // We use 'open' to make DevTools inspection easier during dev.
    this.shadowRoot = host.attachShadow({ mode: 'open' });

    // Inject styles into the shadow root.
    // Because we're inside a shadow tree, these styles are
    // completely isolated — they will NOT affect the host page.
    const style = document.createElement('style');
    style.textContent = this.getButtonStyles();
    this.shadowRoot.appendChild(style);

    // Build the floating button
    this.floatingBtn = document.createElement('button');
    this.floatingBtn.id = 'nt-btn';
    this.floatingBtn.innerHTML = `
      <span class="nt-icon">⚡</span>
      <span class="nt-label">Summarize</span>
    `;
    this.floatingBtn.setAttribute('aria-label', 'NeuralTab: Summarize this page');
    this.floatingBtn.addEventListener('click', () => this.onSummarizeClick());

    this.shadowRoot.appendChild(this.floatingBtn);

    // Mount the host into the actual page DOM.
    // We append to document.body so it floats above page content.
    // This is the ONE moment our code touches the real DOM.
    document.body.appendChild(host);

    // Build the summary panel (hidden by default)
    this.buildSummaryPanel();
  },

  // ── 2. Summary panel ────────────────────────────────────────
  buildSummaryPanel() {
    this.summaryPanel = document.createElement('div');
    this.summaryPanel.id = 'nt-panel';
    this.summaryPanel.setAttribute('aria-live', 'polite');
    this.summaryPanel.innerHTML = `
      <div class="nt-panel-header">
        <span class="nt-panel-title">⚡ NeuralTab Analysis</span>
        <button class="nt-panel-close" aria-label="Close">✕</button>
      </div>
      <div class="nt-panel-body">
        <div class="nt-stat-row">
          <span class="nt-stat-label">Word count</span>
          <span class="nt-stat-value" id="nt-word-count">—</span>
        </div>
        <div class="nt-stat-row">
          <span class="nt-stat-label">Reading time</span>
          <span class="nt-stat-value" id="nt-read-time">—</span>
        </div>
        <div class="nt-stat-row">
          <span class="nt-stat-label">Page title</span>
          <span class="nt-stat-value" id="nt-page-title">—</span>
        </div>
        <div class="nt-divider"></div>
        <div class="nt-summary-label">Page summary (AI — Module 09)</div>
        <div class="nt-summary-placeholder">
          AI summarization connects in Module 09 when we add OAuth2 and the Claude API.
          For now, this panel shows real page statistics computed entirely client-side.
        </div>
        <div class="nt-actions">
          <button class="nt-action-btn" id="nt-highlight-btn">Highlight long words</button>
          <button class="nt-action-btn" id="nt-clear-btn">Clear highlights</button>
        </div>
      </div>
    `;

    // Close button
    this.summaryPanel.querySelector('.nt-panel-close')
      .addEventListener('click', () => this.hidePanel());

    // Highlight buttons
    this.summaryPanel.querySelector('#nt-highlight-btn')
      .addEventListener('click', () => this.highlightLongWords());

    this.summaryPanel.querySelector('#nt-clear-btn')
      .addEventListener('click', () => this.clearHighlights());

    this.shadowRoot.appendChild(this.summaryPanel);
  },

  // ── 3. Show panel and compute page stats ────────────────────
  onSummarizeClick() {
    // Gather stats from the REAL DOM (content script can do this)
    const wordCount  = this.countWords();
    const readTime   = Math.ceil(wordCount / 238); // avg reading speed
    const pageTitle  = document.title;

    this.summaryPanel.querySelector('#nt-word-count').textContent = wordCount.toLocaleString();
    this.summaryPanel.querySelector('#nt-read-time').textContent  = `~${readTime} min`;
    this.summaryPanel.querySelector('#nt-page-title').textContent = pageTitle;

    this.summaryPanel.classList.add('nt-panel-visible');
    this.floatingBtn.classList.add('nt-btn-active');
  },

  hidePanel() {
    this.summaryPanel.classList.remove('nt-panel-visible');
    this.floatingBtn.classList.remove('nt-btn-active');
  },

  // ── 4. Word counting ────────────────────────────────────────
  // We walk the DOM's text nodes rather than reading innerHTML.
  // innerHTML includes tag names and attributes in the count —
  // text nodes give us only the actual readable content.
  countWords() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          // Skip script and style tag content
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (tag === 'script' || tag === 'style' || tag === 'noscript') {
            return NodeFilter.FILTER_REJECT;
          }
          // Skip our own injected elements
          if (parent.closest('#neuraltab-host')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let count = 0;
    let node;
    while ((node = walker.nextNode())) {
      const words = node.textContent.trim().split(/\s+/).filter(w => w.length > 0);
      count += words.length;
    }
    return count;
  },

  // ── 5. Word highlighting ────────────────────────────────────
  // We wrap target words in <mark> tags with a custom class.
  // This modifies the real DOM — the page's JS can see these marks.
  // We highlight words longer than 8 characters as a demo.
  highlightLongWords() {
    this.clearHighlights(); // reset first

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'mark'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.closest('#neuraltab-host')) return NodeFilter.FILTER_REJECT;
          if (node.textContent.trim().length === 0) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    // Collect nodes first — do NOT modify DOM while walking,
    // as that invalidates the TreeWalker's position.
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);

    textNodes.forEach(textNode => {
      const text = textNode.textContent;
      // Only process nodes that contain at least one long word
      if (!/\b\w{9,}\b/.test(text)) return;

      const fragment = document.createDocumentFragment();
      const parts    = text.split(/(\b\w{9,}\b)/);

      parts.forEach(part => {
        if (/^\w{9,}$/.test(part)) {
          const mark = document.createElement('mark');
          mark.className  = 'nt-highlight';
          mark.textContent = part;
          // Inline styles bypass the page's CSS — no class conflict
          mark.style.cssText = `
            background: rgba(245, 200, 66, 0.35) !important;
            color: inherit !important;
            border-radius: 3px !important;
            padding: 0 2px !important;
          `;
          fragment.appendChild(mark);
        } else {
          fragment.appendChild(document.createTextNode(part));
        }
      });

      textNode.parentNode.replaceChild(fragment, textNode);
    });

    this.highlightActive = true;
  },

  clearHighlights() {
    document.querySelectorAll('mark.nt-highlight').forEach(mark => {
      // Replace <mark> with its text content
      mark.replaceWith(mark.textContent);
    });
    this.highlightActive = false;
  },

  // ── 6. SPA navigation watcher ───────────────────────────────
  //
  // Single-Page Applications (React, Next.js, Vue, Angular) change
  // the URL and re-render content WITHOUT a real page navigation.
  // Chrome does NOT re-inject content scripts on soft navigation —
  // the script only injects once on the initial page load.
  //
  // We use a MutationObserver on document.body to detect when the
  // page's content is replaced. When detected, we check if the URL
  // changed and re-run our panel reset.
  //
  watchForSPANavigation() {
    let lastUrl = location.href;

    this.observer = new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        this.onSPANavigate();
      }
    });

    // Observe the body for child additions/removals — SPAs typically
    // swap out large DOM subtrees when navigating between routes.
    this.observer.observe(document.body, {
      childList: true,
      subtree:   true
    });
  },

  onSPANavigate() {
    // URL changed (SPA route change) — hide our panel and clear highlights
    this.hidePanel();
    this.clearHighlights();
    // The floating button stays — only reset its state
    this.floatingBtn.classList.remove('nt-btn-active');
  },

  // ── 7. Main world script injection ──────────────────────────
  //
  // Content scripts run in isolated world 1. They CANNOT read
  // page JavaScript variables like window.React, window.__data__.
  //
  // To read page JS state, we inject a <script> tag pointing to
  // assets/inject.js — Chrome serves this file from the extension
  // because we declared it in web_accessible_resources.
  //
  // The injected script runs in the page's main world (world 0)
  // where it CAN access all page JS variables. It communicates
  // results back to us via window.postMessage, which crosses the
  // isolated world boundary because both worlds share the window object.
  //
  injectMainWorldScript() {
    const scriptUrl = chrome.runtime.getURL('assets/inject.js');
    const script    = document.createElement('script');
    script.src      = scriptUrl;
    script.onload   = () => script.remove(); // cleanup after execution
    document.documentElement.appendChild(script);

    // Listen for messages sent back from the main world
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (!event.data || event.data.source !== 'neuraltab-inject') return;

      // inject.js found something interesting in page JS — log it for now.
      // In later modules this data feeds into the AI summary.
      console.log('[NeuralTab] Main world data:', event.data.payload);
    });
  },

  // ── Shadow DOM styles ────────────────────────────────────────
  // These are injected into the shadow root, fully isolated from
  // the host page. They can use any class names without conflict.
  getButtonStyles() {
    return `
      :host {
        all: initial;
        position: fixed;
        bottom: 28px;
        right: 28px;
        z-index: 2147483647; /* max z-index */
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      #nt-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #f5c842;
        color: #0b0f1a;
        border: none;
        border-radius: 24px;
        padding: 10px 18px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(245, 200, 66, 0.4),
                    0 2px 8px rgba(0, 0, 0, 0.3);
        transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
        white-space: nowrap;
        letter-spacing: 0.3px;
      }

      #nt-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 28px rgba(245, 200, 66, 0.55),
                    0 3px 12px rgba(0, 0, 0, 0.3);
      }

      #nt-btn:active { transform: scale(0.97); }

      #nt-btn.nt-btn-active {
        background: #0b0f1a;
        color: #f5c842;
        border: 2px solid #f5c842;
      }

      .nt-icon  { font-size: 16px; line-height: 1; }
      .nt-label { font-size: 13px; }

      /* ── Summary panel ───────────────────────────────────── */
      #nt-panel {
        position: fixed;
        bottom: 84px;
        right: 28px;
        width: 320px;
        background: #0b0f1a;
        border: 1px solid #1e3a5f;
        border-radius: 12px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.6);
        font-size: 13px;
        color: #e2e8f0;
        opacity: 0;
        transform: translateY(12px) scale(0.97);
        pointer-events: none;
        transition: opacity 0.2s, transform 0.2s;
        overflow: hidden;
      }

      #nt-panel.nt-panel-visible {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: all;
      }

      .nt-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 16px;
        background: #111827;
        border-bottom: 1px solid #1e3a5f;
      }

      .nt-panel-title {
        font-weight: 700;
        font-size: 13px;
        color: #f5c842;
        letter-spacing: 0.3px;
      }

      .nt-panel-close {
        background: none;
        border: none;
        color: #7a9bbf;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        padding: 2px 4px;
        border-radius: 4px;
        transition: color 0.15s;
      }

      .nt-panel-close:hover { color: #e2e8f0; }

      .nt-panel-body { padding: 14px 16px; }

      .nt-stat-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
        border-bottom: 1px solid #1a2235;
      }

      .nt-stat-row:last-of-type { border-bottom: none; }

      .nt-stat-label { color: #7a9bbf; font-size: 12px; }

      .nt-stat-value {
        font-family: 'Courier New', monospace;
        font-size: 12px;
        color: #38bdf8;
        font-weight: 600;
      }

      .nt-divider {
        height: 1px;
        background: #1e3a5f;
        margin: 12px 0;
      }

      .nt-summary-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: #7a9bbf;
        margin-bottom: 8px;
      }

      .nt-summary-placeholder {
        font-size: 12px;
        color: #7a9bbf;
        line-height: 1.6;
        font-style: italic;
        margin-bottom: 14px;
      }

      .nt-actions {
        display: flex;
        gap: 8px;
        margin-top: 4px;
      }

      .nt-action-btn {
        flex: 1;
        padding: 7px 0;
        background: #141c2e;
        border: 1px solid #1e3a5f;
        border-radius: 6px;
        color: #e2e8f0;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
        letter-spacing: 0.2px;
      }

      .nt-action-btn:hover {
        background: #1a2235;
        border-color: #38bdf8;
        color: #38bdf8;
      }
    `;
  }

};
