// NeuralTab — popup.js (Module 05 — cumulative)

'use strict';

const $ = id => document.getElementById(id);

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  $('tab-title').textContent = tab?.title || '—';
  $('tab-url').textContent   = tab?.url   || '—';

  const mf = chrome.runtime.getManifest();
  $('popup-version').textContent = 'v' + mf.version;
  $('ext-name').textContent = mf.name;
  $('ext-ver').textContent  = mf.version;
  $('ext-id').textContent   = chrome.runtime.id;

  await pingContentScript(tab);
  await pingServiceWorker();
  await loadQuickSettings();
  await loadTabStats();

  wireButtons(tab);

  StorageManager.onChange(changes => {
    if (changes.highlightColor   !== undefined) { $('quick-color').value = changes.highlightColor; $('quick-color-hex').value = changes.highlightColor; }
    if (changes.buttonVisible    !== undefined) $('quick-visible').checked = changes.buttonVisible;
    if (changes.totalSummaries   !== undefined) $('stat-summaries').textContent = changes.totalSummaries;
    if (changes.swStartCount     !== undefined) { $('stat-wakes').textContent = changes.swStartCount; $('sw-wakes').textContent = changes.swStartCount; }
  });
}

async function pingContentScript(tab) {
  const dot = $('cs-dot'), status = $('cs-status'), note = $('cs-note');
  if (!tab?.id || isRestrictedUrl(tab.url)) {
    dot.className = 'status-dot warn'; status.textContent = 'Restricted page'; note.textContent = 'Extension cannot run here.'; return;
  }
  try {
    const result = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => typeof NeuralTabContent !== 'undefined' });
    if (result?.[0]?.result === true) { dot.className = 'status-dot ok'; status.textContent = 'Running'; note.textContent = ''; }
    else { dot.className = 'status-dot warn'; status.textContent = 'Not injected'; note.textContent = 'Reload the page.'; }
  } catch { dot.className = 'status-dot err'; status.textContent = 'Cannot access page'; }
}

async function pingServiceWorker() {
  try {
    const resp = await chrome.runtime.sendMessage({ action: 'getWorkerState' });
    if (resp) {
      $('sw-dot').className      = 'status-dot alive';
      $('sw-status').textContent = 'Alive';
      $('sw-status').style.color = 'var(--green)';
      $('sw-uptime').textContent = formatUptime(resp.uptime);
    }
  } catch {
    $('sw-dot').className      = 'status-dot err';
    $('sw-status').textContent = 'Dead / restarting';
    $('sw-status').style.color = 'var(--red)';
  }
  const s = await StorageManager.get(['swStartCount']);
  $('sw-wakes').textContent  = s.swStartCount || 0;
  $('stat-wakes').textContent = s.swStartCount || 0;
}

function isRestrictedUrl(url) {
  if (!url) return true;
  return url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:') || url.startsWith('edge://');
}

async function loadQuickSettings() {
  const s = await StorageManager.get(['highlightColor', 'buttonVisible', 'totalSummaries']);
  $('quick-color').value      = s.highlightColor;
  $('quick-color-hex').value  = s.highlightColor;
  $('quick-visible').checked  = s.buttonVisible;
  $('stat-summaries').textContent = s.totalSummaries;
}

async function loadTabStats() {
  const tabs = await chrome.tabs.query({});
  $('popup-tab-total').textContent = tabs.length;
  const hasTabsPerm = await chrome.permissions.contains({ permissions: ['tabs'] });
  $('popup-tab-idle').textContent = hasTabsPerm
    ? tabs.filter(t => !t.active && !t.audible && !t.pinned).length
    : '?';
}

function formatUptime(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
}

function wireButtons(tab) {
  $('quick-color').addEventListener('input', async e => {
    $('quick-color-hex').value = e.target.value;
    await StorageManager.set({ highlightColor: e.target.value });
  });
  $('quick-color-hex').addEventListener('change', async e => {
    const v = e.target.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { $('quick-color').value = v; await StorageManager.set({ highlightColor: v }); }
  });
  $('quick-visible').addEventListener('change', async e => {
    await StorageManager.set({ buttonVisible: e.target.checked });
  });

  $('btn-sw-monitor').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('sw_monitor.html') });
  });
  $('btn-tab-manager').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('tab_manager.html') });
  });
  $('btn-settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('btn-info-toggle').addEventListener('click', () => {
    const info = $('ext-info');
    info.style.display = info.style.display === 'none' ? '' : 'none';
  });

  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn || !tab?.id) return;
    const actionMap = { summarize: 'summarize', highlight: 'highlight', clear: 'clear', inject: 'inject' };
    if (!actionMap[btn.dataset.action]) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func:   (msg) => { if (typeof NeuralTabContent !== 'undefined') NeuralTabContent.handleAction(msg); },
        args:   [{ action: btn.dataset.action }],
      });
    } catch (err) { console.error(err); }
  });
}

init().catch(console.error);
