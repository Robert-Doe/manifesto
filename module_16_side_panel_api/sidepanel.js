// NeuralTab — sidepanel.js (Module 16)
'use strict';

const startTime = Date.now();
let visitCount = 0;

function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

async function updateTabInfo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  setEl('tab-title', tab.title || '—');
  setEl('tab-url', tab.url || '—');
}

async function updateStats() {
  const bytes = await new Promise(r => chrome.storage.local.getBytesInUse(null, r));
  const data = await new Promise(r => chrome.storage.local.get('historyVisitCount', r));
  setEl('sp-visits', visitCount);
  setEl('sp-pages', data.historyVisitCount || 0);
  setEl('sp-storage', (bytes / 1024).toFixed(1) + ' KB');
  setEl('sp-since', new Date(startTime).toLocaleTimeString());
}

function addNavEvent(url) {
  visitCount++;
  const feed = document.getElementById('nav-feed');
  const ev = document.createElement('div');
  ev.className = 'event';
  const host = (() => { try { return new URL(url).hostname; } catch { return url; } })();
  ev.innerHTML = `<span>${new Date().toLocaleTimeString()}</span> ${host}`;
  feed.insertBefore(ev, feed.firstChild);
  if (feed.children.length > 50) feed.removeChild(feed.lastChild);
  updateStats();
}

// Listen for navigation events via storage pub/sub (Pattern 4)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.networkEvents) return;
  const events = changes.networkEvents.newValue || [];
  const latest = events[events.length - 1];
  if (latest?.type === 'completed') addNavEvent(latest.url);
});

// Update tab info when active tab changes
chrome.tabs.onActivated.addListener(updateTabInfo);
chrome.tabs.onUpdated.addListener((_, info) => {
  if (info.status === 'complete') updateTabInfo();
});

updateTabInfo();
updateStats();
