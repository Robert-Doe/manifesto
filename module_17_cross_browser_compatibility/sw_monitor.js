// NeuralTab — sw_monitor.js (Module 07 — unchanged from M06)
'use strict';

async function load() {
  const s     = await StorageManager.get(['swStartCount', 'swLifecycleLog', 'messageCount', 'activeStreams']);
  const stats = await chrome.runtime.sendMessage({ action: 'getMessageStats' }).catch(() => ({}));

  document.getElementById('sw-starts').textContent  = s.swStartCount || 0;
  document.getElementById('stream-ports').textContent = s.activeStreams || 0;
  document.getElementById('msg-count').textContent  = s.messageCount || 0;
  const uptime = stats.swStartTime ? Math.floor((Date.now() - stats.swStartTime) / 1000) : '—';
  document.getElementById('sw-uptime').textContent  = uptime;

  const log  = (s.swLifecycleLog || []).slice().reverse();
  const cont = document.getElementById('sw-log');
  cont.innerHTML = '';
  for (const e of log) {
    const row = document.createElement('div');
    row.className = `log-row ev-${e.event}`;
    row.textContent = `[${new Date(e.ts).toLocaleTimeString()}] ${e.event}  ${e.detail || ''}`;
    cont.appendChild(row);
  }
  if (!log.length) cont.textContent = 'No lifecycle events recorded yet.';
}

document.getElementById('btn-refresh').addEventListener('click', load);
StorageManager.onChange(changes => {
  if (changes.swLifecycleLog || changes.messageCount || changes.activeStreams) load();
});
load();
