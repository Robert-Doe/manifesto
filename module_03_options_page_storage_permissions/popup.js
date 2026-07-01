// ============================================================
// NeuralTab — popup.js  (Module 03)
//
// New in M03:
//   - Reads settings from StorageManager to populate Quick Settings
//   - Quick colour picker writes directly to storage (live update)
//   - Toggle for buttonVisible writes directly to storage
//   - "Settings" button opens the options page
//   - Displays total summary count from storage
// ============================================================

'use strict';

const $ = id => document.getElementById(id);

// ── Load active tab ───────────────────────────────────────────
chrome.tabs.query({ active: true, currentWindow: true })
  .then(([tab]) => {
    if (!tab) return;
    $('current-url').textContent = tab.url || '(restricted page)';
    popup.activeTabId = tab.id;
  });

// ── Load settings into Quick Settings panel ───────────────────
async function loadQuickSettings() {
  const { highlightColor, buttonVisible, totalSummaries } =
    await StorageManager.get(['highlightColor', 'buttonVisible', 'totalSummaries']);

  $('qs-color').value         = highlightColor;
  $('qs-color-hex').textContent = highlightColor;
  $('qs-visible').checked     = buttonVisible;
  $('qs-summaries').textContent = totalSummaries;
}

loadQuickSettings();

// ── Quick colour picker ───────────────────────────────────────
// Writes to storage immediately — content script's onChange
// listener picks it up and updates highlights without page reload.
$('qs-color').addEventListener('input', async (e) => {
  const color = e.target.value;
  $('qs-color-hex').textContent = color;
  await StorageManager.set({ highlightColor: color });
});

// ── Quick visibility toggle ───────────────────────────────────
$('qs-visible').addEventListener('change', async (e) => {
  await StorageManager.set({ buttonVisible: e.target.checked });
});

// ── Button handlers ───────────────────────────────────────────
const popup = { activeTabId: null };

$('btn-highlight').addEventListener('click', () => runInTab(() => {
  window.NeuralTabContent?.highlightLongWords();
}));

$('btn-clear').addEventListener('click', () => runInTab(() => {
  window.NeuralTabContent?.clearHighlights();
  window.NeuralTabContent?.hidePanel();
}));

// Open the options page — chrome.runtime.openOptionsPage() is the
// correct MV3 API. It opens options.html in a new tab and focuses
// it if already open. Works from any extension context.
$('btn-settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

function runInTab(fn) {
  if (!popup.activeTabId) return;
  chrome.scripting.executeScript({
    target: { tabId: popup.activeTabId },
    func:   fn
  }).catch(err => console.warn('[NeuralTab popup]', err));
}

// ── React to storage changes while popup is open ─────────────
// If the user changes settings in the options page while the popup
// is also open, keep the Quick Settings panel in sync.
StorageManager.onChange((changes) => {
  if (changes.highlightColor) {
    $('qs-color').value            = changes.highlightColor.newValue;
    $('qs-color-hex').textContent  = changes.highlightColor.newValue;
  }
  if (changes.buttonVisible !== undefined) {
    $('qs-visible').checked = changes.buttonVisible.newValue;
  }
  if (changes.totalSummaries !== undefined) {
    $('qs-summaries').textContent = changes.totalSummaries.newValue;
  }
});
