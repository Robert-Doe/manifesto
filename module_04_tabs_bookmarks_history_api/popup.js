// NeuralTab — popup.js (Module 04 — cumulative)

'use strict';

const $ = id => document.getElementById(id);

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Active tab display
  $('tab-title').textContent = tab?.title || '—';
  $('tab-url').textContent   = tab?.url   || '—';

  // Version
  const mf = chrome.runtime.getManifest();
  $('popup-version').textContent = 'v' + mf.version;

  // Content script ping
  await pingContentScript(tab);

  // Quick settings from storage
  await loadQuickSettings();

  // Tab overview stats
  await loadTabStats();

  // Extension info section
  $('ext-name').textContent = mf.name;
  $('ext-ver').textContent  = mf.version;
  $('ext-id').textContent   = chrome.runtime.id;

  // Wire controls
  wireButtons(tab);

  // Live storage updates
  StorageManager.onChange(changes => {
    if (changes.highlightColor !== undefined) {
      $('quick-color').value     = changes.highlightColor;
      $('quick-color-hex').value = changes.highlightColor;
    }
    if (changes.buttonVisible !== undefined) {
      $('quick-visible').checked = changes.buttonVisible;
    }
    if (changes.totalSummaries !== undefined) {
      $('stat-summaries').textContent = changes.totalSummaries;
    }
  });
}

async function pingContentScript(tab) {
  const dot    = $('cs-dot');
  const status = $('cs-status');
  const note   = $('cs-note');

  if (!tab?.id || isRestrictedUrl(tab.url)) {
    dot.className   = 'status-dot warn';
    status.textContent = 'Restricted page';
    note.textContent   = 'Extension cannot run on this URL.';
    return;
  }

  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func:   () => typeof NeuralTabContent !== 'undefined',
    });
    if (result?.[0]?.result === true) {
      dot.className      = 'status-dot ok';
      status.textContent = 'Running';
      note.textContent   = '';
    } else {
      dot.className      = 'status-dot warn';
      status.textContent = 'Not injected';
      note.textContent   = 'Reload the page to activate NeuralTab.';
    }
  } catch {
    dot.className      = 'status-dot err';
    status.textContent = 'Cannot access page';
    note.textContent   = 'Check for CSP restrictions.';
  }
}

function isRestrictedUrl(url) {
  if (!url) return true;
  return url.startsWith('chrome://') ||
         url.startsWith('chrome-extension://') ||
         url.startsWith('about:') ||
         url.startsWith('edge://');
}

async function loadQuickSettings() {
  const s = await StorageManager.get(['highlightColor', 'buttonVisible', 'totalSummaries']);
  $('quick-color').value      = s.highlightColor;
  $('quick-color-hex').value  = s.highlightColor;
  $('quick-visible').checked  = s.buttonVisible;
  $('stat-summaries').textContent = s.totalSummaries;
}

async function loadTabStats() {
  // chrome.tabs.query() returns all tabs WITHOUT url/title if "tabs" permission
  // is not granted — but we can still count them.
  const tabs = await chrome.tabs.query({});
  $('popup-tab-total').textContent = tabs.length;

  const hasTabsPermission = await chrome.permissions.contains({ permissions: ['tabs'] });
  if (hasTabsPermission) {
    const idle = tabs.filter(t => !t.active && !t.audible && !t.pinned).length;
    $('popup-tab-idle').textContent = idle;
  } else {
    $('popup-tab-idle').textContent = '?';
  }
}

function wireButtons(tab) {
  // Colour picker
  $('quick-color').addEventListener('input', async (e) => {
    const colour = e.target.value;
    $('quick-color-hex').value = colour;
    await StorageManager.set({ highlightColor: colour });
  });

  $('quick-color-hex').addEventListener('change', async (e) => {
    const v = e.target.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      $('quick-color').value = v;
      await StorageManager.set({ highlightColor: v });
    }
  });

  // Button visibility toggle
  $('quick-visible').addEventListener('change', async (e) => {
    await StorageManager.set({ buttonVisible: e.target.checked });
  });

  // Tab Manager button
  $('btn-tab-manager').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('tab_manager.html') });
  });

  // Settings button
  $('btn-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Info toggle
  $('btn-info-toggle').addEventListener('click', () => {
    const info = $('ext-info');
    info.style.display = info.style.display === 'none' ? '' : 'none';
  });

  // Action buttons (summarize / highlight / clear / inject)
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || !tab?.id) return;

    const action = btn.dataset.action;
    const actionMap = {
      summarize: () => ({ action: 'summarize' }),
      highlight: () => ({ action: 'highlight' }),
      clear:     () => ({ action: 'clear' }),
      inject:    () => ({ action: 'inject' }),
    };

    if (!actionMap[action]) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func:   (msg) => {
          if (typeof NeuralTabContent !== 'undefined') {
            NeuralTabContent.handleAction(msg);
          }
        },
        args: [actionMap[action]()],
      });
    } catch (err) {
      console.error('NeuralTab popup action error:', err);
    }
  });
}

init().catch(console.error);
