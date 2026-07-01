// ============================================================
// NeuralTab — content.js  (Module 03 — cumulative M01+M02+M03)
//
// NEW in Module 03:
//   - Reads settings from StorageManager on startup
//   - Respects blockedDomains — exits early if this domain is blocked
//   - Uses stored highlightColor and highlightMinLen from settings
//   - Listens for storage changes and updates the UI live without reload
//   - Counts summary clicks and persists the total via StorageManager
// ============================================================

'use strict';

// ── Guard against double-injection ───────────────────────────
if (window.__neuraltab_injected__) {
  // Already running — abort
} else {
  window.__neuraltab_injected__ = true;
  // Async init — wait for settings before touching the DOM
  NeuralTabContent.init();
}

const NeuralTabContent = {

  floatingBtn:   null,
  summaryPanel:  null,
  shadowRoot:    null,
  observer:      null,
  settings:      null,   // loaded from StorageManager on init

  // ── init ──────────────────────────────────────────────────
  async init() {
    // 1. Load all settings first
    this.settings = await StorageManager.get();

    // 2. Check if this domain is blocked
    const blocked = await StorageManager.isBlocked(location.hostname);
    if (blocked) {
      // User has blocked this domain — do nothing
      return;
    }

    // 3. Inject UI
    this.injectFloatingButton();
    this.watchForSPANavigation();
    this.injectMainWorldScript();

    // 4. Apply initial settings
    this.applySettings(this.settings);

    // 5. Listen for live settings changes
    // When the user changes a setting in the options page, this fires
    // in the content script WITHOUT a page reload — live updates.
    StorageManager.onChange((changes) => {
      this.onSettingsChange(changes);
    });
  },

  // ── applySettings ─────────────────────────────────────────
  applySettings(settings) {
    if (!this.floatingBtn) return;

    // Show/hide based on buttonVisible setting
    const host = document.getElementById('neuraltab-host');
    if (host) {
      host.style.display = settings.buttonVisible ? '' : 'none';
    }

    // Apply button position
    const hostStyle = host?.style;
    if (hostStyle) {
      if (settings.buttonPosition === 'bottom-left') {
        hostStyle.right = 'auto';
        hostStyle.left  = '28px';
      } else {
        hostStyle.left  = 'auto';
        hostStyle.right = '28px';
      }
    }
  },

  // ── onSettingsChange ──────────────────────────────────────
  // Called whenever a setting changes in chrome.storage.
  // Updates the UI live — no page reload needed.
  onSettingsChange(changes) {
    if (changes.highlightColor) {
      this.settings.highlightColor = changes.highlightColor.newValue;
      // If highlights are currently active, reapply with new colour
      if (document.querySelector('mark.nt-highlight')) {
        this.clearHighlights();
        this.highlightLongWords();
      }
    }

    if (changes.highlightMinLen) {
      this.settings.highlightMinLen = changes.highlightMinLen.newValue;
    }

    if (changes.buttonVisible !== undefined) {
      this.settings.buttonVisible = changes.buttonVisible.newValue;
      const host = document.getElementById('neuraltab-host');
      if (host) host.style.display = changes.buttonVisible.newValue ? '' : 'none';
    }

    if (changes.buttonPosition) {
      this.settings.buttonPosition = changes.buttonPosition.newValue;
      this.applySettings(this.settings);
    }

    if (changes.readingSpeed) {
      this.settings.readingSpeed = changes.readingSpeed.newValue;
    }
  },

  // ── injectFloatingButton ──────────────────────────────────
  injectFloatingButton() {
    const host = document.createElement('div');
    host.id    = 'neuraltab-host';

    this.shadowRoot = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = this.getButtonStyles();
    this.shadowRoot.appendChild(style);

    this.floatingBtn = document.createElement('button');
    this.floatingBtn.id        = 'nt-btn';
    this.floatingBtn.innerHTML = `<span class="nt-icon">⚡</span><span class="nt-label">Summarize</span>`;
    this.floatingBtn.setAttribute('aria-label', 'NeuralTab: Summarize this page');
    this.floatingBtn.addEventListener('click', () => this.onSummarizeClick());

    this.shadowRoot.appendChild(this.floatingBtn);
    this.buildSummaryPanel();
    document.body.appendChild(host);
  },

  // ── buildSummaryPanel ─────────────────────────────────────
  buildSummaryPanel() {
    this.summaryPanel = document.createElement('div');
    this.summaryPanel.id = 'nt-panel';
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
          <span class="nt-stat-label">Summaries today</span>
          <span class="nt-stat-value" id="nt-summary-count">—</span>
        </div>
        <div class="nt-divider"></div>
        <div class="nt-summary-label">Highlight colour (from settings)</div>
        <div class="nt-color-preview" id="nt-color-preview"></div>
        <div class="nt-actions">
          <button class="nt-action-btn" id="nt-highlight-btn">Highlight words</button>
          <button class="nt-action-btn" id="nt-clear-btn">Clear</button>
        </div>
        <button class="nt-settings-link" id="nt-settings-link">⚙ Open Settings</button>
      </div>
    `;

    this.summaryPanel.querySelector('.nt-panel-close')
      .addEventListener('click', () => this.hidePanel());
    this.summaryPanel.querySelector('#nt-highlight-btn')
      .addEventListener('click', () => this.highlightLongWords());
    this.summaryPanel.querySelector('#nt-clear-btn')
      .addEventListener('click', () => this.clearHighlights());

    // Open the options page from within a content script
    this.summaryPanel.querySelector('#nt-settings-link')
      .addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openOptions' });
      });

    this.shadowRoot.appendChild(this.summaryPanel);
  },

  // ── onSummarizeClick ──────────────────────────────────────
  async onSummarizeClick() {
    const wordCount = this.countWords();
    // Use stored reading speed (from settings) not a hardcoded value
    const readTime  = Math.ceil(wordCount / (this.settings.readingSpeed || 238));

    this.summaryPanel.querySelector('#nt-word-count').textContent = wordCount.toLocaleString();
    this.summaryPanel.querySelector('#nt-read-time').textContent  = `~${readTime} min`;

    // Show current highlight colour from settings
    const preview = this.summaryPanel.querySelector('#nt-color-preview');
    if (preview) {
      preview.style.cssText = `
        height: 18px; border-radius: 4px; margin-bottom: 12px;
        background: ${this.settings.highlightColor};
        border: 1px solid rgba(255,255,255,0.1);
      `;
    }

    // Persist the summary count
    const total = await StorageManager.recordSummary();
    this.summaryPanel.querySelector('#nt-summary-count').textContent = total;

    this.summaryPanel.classList.add('nt-panel-visible');
    this.floatingBtn.classList.add('nt-btn-active');
  },

  hidePanel() {
    this.summaryPanel.classList.remove('nt-panel-visible');
    this.floatingBtn.classList.remove('nt-btn-active');
  },

  // ── countWords ────────────────────────────────────────────
  countWords() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (['script','style','noscript'].includes(tag)) return NodeFilter.FILTER_REJECT;
          if (parent.closest('#neuraltab-host'))           return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    let count = 0, node;
    while ((node = walker.nextNode())) {
      count += node.textContent.trim().split(/\s+/).filter(w => w.length > 0).length;
    }
    return count;
  },

  // ── highlightLongWords ────────────────────────────────────
  // Now uses settings.highlightColor and settings.highlightMinLen
  highlightLongWords() {
    this.clearHighlights();
    const minLen = this.settings.highlightMinLen || 9;
    const color  = this.settings.highlightColor  || '#f5c842';
    const pattern = new RegExp(`\\b\\w{${minLen},}\\b`);

    const walker = document.createTreeWalker(
      document.body, NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (['script','style','noscript','mark'].includes(tag)) return NodeFilter.FILTER_REJECT;
          if (parent.closest('#neuraltab-host')) return NodeFilter.FILTER_REJECT;
          if (node.textContent.trim().length === 0) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);

    textNodes.forEach(textNode => {
      if (!pattern.test(textNode.textContent)) return;
      const splitPattern = new RegExp(`(\\b\\w{${minLen},}\\b)`);
      const fragment = document.createDocumentFragment();
      textNode.textContent.split(splitPattern).forEach(part => {
        if (new RegExp(`^\\w{${minLen},}$`).test(part)) {
          const mark = document.createElement('mark');
          mark.className    = 'nt-highlight';
          mark.textContent  = part;
          mark.style.cssText = `
            background: ${color} !important;
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
  },

  clearHighlights() {
    document.querySelectorAll('mark.nt-highlight').forEach(mark => {
      mark.replaceWith(mark.textContent);
    });
  },

  // ── SPA watcher ───────────────────────────────────────────
  watchForSPANavigation() {
    let lastUrl = location.href;
    this.observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        this.hidePanel();
        this.clearHighlights();
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  },

  // ── Main world injector ───────────────────────────────────
  injectMainWorldScript() {
    const script = document.createElement('script');
    script.src   = chrome.runtime.getURL('assets/inject.js');
    script.onload = () => script.remove();
    document.documentElement.appendChild(script);

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (event.data?.source !== 'neuraltab-inject') return;
      console.log('[NeuralTab] Main world data:', event.data.payload);
    });
  },

  // ── Shadow DOM styles ──────────────────────────────────────
  getButtonStyles() {
    return `
      :host {
        all: initial; position: fixed; bottom: 28px; right: 28px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      #nt-btn {
        display: flex; align-items: center; gap: 8px;
        background: #f5c842; color: #0b0f1a;
        border: none; border-radius: 24px; padding: 10px 18px;
        font-size: 14px; font-weight: 700; cursor: pointer;
        box-shadow: 0 4px 20px rgba(245,200,66,0.4), 0 2px 8px rgba(0,0,0,0.3);
        transition: transform 0.15s, box-shadow 0.15s;
        white-space: nowrap;
      }
      #nt-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 28px rgba(245,200,66,0.55), 0 3px 12px rgba(0,0,0,0.3); }
      #nt-btn:active { transform: scale(0.97); }
      #nt-btn.nt-btn-active { background: #0b0f1a; color: #f5c842; border: 2px solid #f5c842; }
      .nt-icon { font-size: 16px; } .nt-label { font-size: 13px; }
      #nt-panel {
        position: fixed; bottom: 84px; right: 28px; width: 300px;
        background: #0b0f1a; border: 1px solid #1e3a5f; border-radius: 12px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.6); font-size: 13px; color: #e2e8f0;
        opacity: 0; transform: translateY(12px) scale(0.97); pointer-events: none;
        transition: opacity 0.2s, transform 0.2s; overflow: hidden;
      }
      #nt-panel.nt-panel-visible { opacity: 1; transform: translateY(0) scale(1); pointer-events: all; }
      .nt-panel-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: #111827; border-bottom: 1px solid #1e3a5f; }
      .nt-panel-title { font-weight: 700; font-size: 13px; color: #f5c842; }
      .nt-panel-close { background: none; border: none; color: #7a9bbf; cursor: pointer; font-size: 16px; line-height: 1; padding: 2px 4px; border-radius: 4px; }
      .nt-panel-close:hover { color: #e2e8f0; }
      .nt-panel-body { padding: 12px 14px; }
      .nt-stat-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid #1a2235; }
      .nt-stat-label { color: #7a9bbf; font-size: 12px; }
      .nt-stat-value { font-family: 'Courier New', monospace; font-size: 12px; color: #38bdf8; font-weight: 600; }
      .nt-divider { height: 1px; background: #1e3a5f; margin: 10px 0; }
      .nt-summary-label { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #7a9bbf; margin-bottom: 6px; }
      .nt-actions { display: flex; gap: 8px; margin-bottom: 10px; }
      .nt-action-btn { flex: 1; padding: 6px 0; background: #141c2e; border: 1px solid #1e3a5f; border-radius: 6px; color: #e2e8f0; font-size: 11px; font-weight: 600; cursor: pointer; }
      .nt-action-btn:hover { background: #1a2235; border-color: #38bdf8; color: #38bdf8; }
      .nt-settings-link { display: block; width: 100%; padding: 7px 0; background: none; border: 1px solid #1e3a5f; border-radius: 6px; color: #7a9bbf; font-size: 11px; font-weight: 600; cursor: pointer; text-align: center; }
      .nt-settings-link:hover { color: #f5c842; border-color: #f5c842; }
    `;
  }
};
