// NeuralTab — sw_monitor.js (Module 06 — unchanged from M05)

'use strict';

let keepalivePort   = null;
let pingInterval    = null;
let lastLogLength   = 0;
let pollIntervalId  = null;

async function init() {
  await pollWorkerState();
  await refreshLog();
  pollIntervalId = setInterval(async () => {
    await pollWorkerState();
    await refreshLog();
  }, 2000);

  document.getElementById('kl-toggle').addEventListener('change', e => {
    e.target.checked ? openKeepalivePort() : closeKeepalivePort();
  });
  document.getElementById('btn-ping').addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'logSwEvent', event: 'MANUAL_PING', detail: 'from SW Monitor' });
    } catch { /* worker dead */ }
    await refreshLog();
  });
  document.getElementById('btn-trigger').addEventListener('click', async () => {
    try { await chrome.runtime.sendMessage({ action: 'triggerTabAnalysis' }); } catch { }
    await refreshLog();
  });
  document.getElementById('btn-options').addEventListener('click', () => chrome.runtime.openOptionsPage());
  document.getElementById('btn-clear-log').addEventListener('click', async () => {
    await StorageManager.set({ swLifecycleLog: [] });
    lastLogLength = 0;
    document.getElementById('log-container').innerHTML = '<div class="log-empty">Log cleared.</div>';
  });

  StorageManager.onChange(changes => {
    if (changes.swStartCount !== undefined)
      document.getElementById('total-wakes').textContent = changes.swStartCount;
  });
}

// ─── Worker state poll (every 2s) ────────────────────────────────────────────
async function pollWorkerState() {
  try {
    const resp = await chrome.runtime.sendMessage({ action: 'getWorkerState' });
    if (!resp) throw new Error('no response');
    setAlive(true);
    document.getElementById('mem-counter').textContent  = resp.inMemoryEventCounter;
    document.getElementById('uptime').textContent       = formatUptime(resp.uptime);
    document.getElementById('stream-ports').textContent = resp.streamPorts ?? 0;
  } catch {
    setAlive(false);
  }

  const s = await StorageManager.get(['swStartCount']);
  document.getElementById('total-wakes').textContent = s.swStartCount || 0;

  const alarms = await chrome.alarms.getAll();
  const next   = alarms.reduce((a, b) => a.scheduledTime < b.scheduledTime ? a : b, alarms[0]);
  document.getElementById('next-alarm').textContent = next
    ? `${next.name} @ ${new Date(next.scheduledTime).toLocaleTimeString()}`
    : '—';
}

function setAlive(alive) {
  document.getElementById('status-dot').className  = 'status-dot' + (alive ? ' alive' : ' dead');
  document.getElementById('status-text').textContent = alive ? 'Alive' : 'Dead';
}

// ─── Log rendering (delta-only) ───────────────────────────────────────────────
async function refreshLog() {
  const s   = await StorageManager.get(['swLifecycleLog']);
  const log = s.swLifecycleLog || [];
  if (log.length === lastLogLength) return;

  const newEntries = log.slice(lastLogLength);
  lastLogLength    = log.length;

  const container = document.getElementById('log-container');
  if (container.querySelector('.log-empty')) container.innerHTML = '';

  for (const entry of newEntries) {
    const el = document.createElement('div');
    el.className = 'log-entry event-NEW';
    el.innerHTML = `<span class="log-ts">${new Date(entry.ts).toLocaleTimeString()}</span>
      <span class="log-event ev-${entry.event}">${entry.event}</span>
      <span class="log-detail">${escHtml(entry.detail || '')}</span>`;
    container.appendChild(el);
  }

  const near = container.scrollHeight - container.parentElement?.scrollTop < container.parentElement?.clientHeight + 80;
  if (near) container.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
}

// ─── Keepalive port pattern (M05) ────────────────────────────────────────────
function openKeepalivePort() {
  if (keepalivePort) return;
  keepalivePort = chrome.runtime.connect({ name: 'neuraltab-keepalive' });
  document.getElementById('kl-status').textContent = 'Open (worker stays alive)';
  document.getElementById('kl-status').style.color = 'var(--green)';

  keepalivePort.onMessage.addListener(msg => {
    if (msg.type === 'pong')
      document.getElementById('last-heartbeat').textContent = new Date().toLocaleTimeString();
  });
  keepalivePort.onDisconnect.addListener(() => {
    keepalivePort = null;
    clearInterval(pingInterval);
    pingInterval  = null;
    document.getElementById('kl-status').textContent = 'Disconnected';
    document.getElementById('kl-status').style.color = 'var(--red)';
    document.getElementById('kl-toggle').checked = false;
  });

  pingInterval = setInterval(() => {
    if (keepalivePort) keepalivePort.postMessage({ type: 'ping' });
  }, 25000);
}

function closeKeepalivePort() {
  if (keepalivePort) { keepalivePort.disconnect(); keepalivePort = null; }
  clearInterval(pingInterval); pingInterval = null;
  document.getElementById('kl-status').textContent = 'Off';
  document.getElementById('kl-status').style.color = '';
}

function formatUptime(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

init();
