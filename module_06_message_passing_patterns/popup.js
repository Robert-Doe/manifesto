// NeuralTab — popup.js (Module 06 — adds message stats)

'use strict';

async function init() {
  await pingServiceWorker();
  await loadStorageStats();
  wireButtons();
}

async function pingServiceWorker() {
  try {
    const resp = await chrome.runtime.sendMessage({ action: 'getWorkerState' });
    if (resp) {
      document.getElementById('sw-dot').className    = 'status-dot alive';
      document.getElementById('sw-status').textContent = 'Alive';
      document.getElementById('sw-uptime').textContent = formatUptime(resp.uptime);
    }
  } catch {
    document.getElementById('sw-dot').className    = 'status-dot';
    document.getElementById('sw-status').textContent = 'Dead';
    document.getElementById('sw-uptime').textContent = '—';
  }
}

async function loadStorageStats() {
  const s = await StorageManager.get([
    'totalSummaries', 'totalIdleAlerts', 'swStartCount',
    'messageCount', 'demoCounter', 'activeStreams',
  ]);

  document.getElementById('stat-summaries').textContent    = s.totalSummaries   || 0;
  document.getElementById('stat-wakes').textContent        = s.totalIdleAlerts  || 0;
  document.getElementById('sw-wakes').textContent          = s.swStartCount     || 0;
  document.getElementById('stat-msg-count').textContent    = s.messageCount     || 0;
  document.getElementById('stat-demo-counter').textContent = s.demoCounter      || 0;
  document.getElementById('stat-streams').textContent      = s.activeStreams     || 0;

  // Tab count — needs permission
  try {
    const tabs = await chrome.tabs.query({});
    document.getElementById('stat-tabs').textContent = tabs.length;
  } catch {
    document.getElementById('stat-tabs').textContent = '—';
  }

  // Content script word count via getTabInfo message
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      const info = await chrome.tabs.sendMessage(tab.id, { action: 'getWordCount' }).catch(() => null);
      if (info) {
        document.getElementById('stat-words').textContent   = info.wordCount?.toLocaleString() ?? '—';
        document.getElementById('stat-reading').textContent = info.readingTime ? `~${info.readingTime} min` : '—';
      }
    }
  } catch { /* tab may not have content script */ }
}

function wireButtons() {
  document.getElementById('btn-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
  document.getElementById('btn-tab-manager').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('tab_manager.html') });
    window.close();
  });
  document.getElementById('btn-sw-monitor').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('sw_monitor.html') });
    window.close();
  });
  document.getElementById('btn-msg-lab').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('message_lab.html') });
    window.close();
  });
}

function formatUptime(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

init();
