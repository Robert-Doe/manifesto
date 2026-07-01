// NeuralTab — popup.js (Module 07)
'use strict';

async function init() {
  const s = await StorageManager.get(['messageCount', 'historyVisitCount', 'demoCounter', 'activeStreams']);
  document.getElementById('stat-messages').textContent = s.messageCount || 0;
  document.getElementById('stat-visits').textContent   = s.historyVisitCount || 0;
  document.getElementById('stat-counter').textContent  = s.demoCounter || 0;
  document.getElementById('stat-streams').textContent  = s.activeStreams || 0;

  const q = await StorageManager.getQuotaInfo();
  document.getElementById('quota-text').textContent = `${q.usedKB} KB / ${q.quotaKB} KB (${q.pct}%)`;
  document.getElementById('quota-bar').style.width  = `${Math.min(q.pct, 100)}%`;

  StorageManager.onChange(changes => {
    if (changes.messageCount     !== undefined) document.getElementById('stat-messages').textContent = changes.messageCount;
    if (changes.historyVisitCount !== undefined) document.getElementById('stat-visits').textContent  = changes.historyVisitCount;
    if (changes.demoCounter      !== undefined) document.getElementById('stat-counter').textContent  = changes.demoCounter;
    if (changes.activeStreams    !== undefined) document.getElementById('stat-streams').textContent   = changes.activeStreams;
  });

  document.getElementById('btn-lab').addEventListener('click', () =>
    chrome.tabs.create({ url: chrome.runtime.getURL('message_lab.html') }));
  document.getElementById('btn-history').addEventListener('click', () =>
    chrome.tabs.create({ url: chrome.runtime.getURL('history_db.html') }));
  document.getElementById('btn-options').addEventListener('click', () =>
    chrome.runtime.openOptionsPage());
  document.getElementById('btn-monitor').addEventListener('click', () =>
    chrome.tabs.create({ url: chrome.runtime.getURL('sw_monitor.html') }));
}

init();
