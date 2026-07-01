// NeuralTab — sw_monitor.js (Module 05)
// Real-time service worker lifecycle visualiser.

'use strict';

// ─── State ──────────────────────────────────────────────────────────────────

let keepalivePort  = null;
let pingInterval   = null;
let pollInterval   = null;
let lastLogLength  = 0;

// ─── Keepalive Port ──────────────────────────────────────────────────────────

function openKeepalivePort() {
  if (keepalivePort) return;
  keepalivePort = chrome.runtime.connect({ name: 'neuraltab-keepalive' });

  keepalivePort.onDisconnect.addListener(() => {
    keepalivePort = null;
    clearInterval(pingInterval);
    pingInterval  = null;
    document.getElementById('m-keepalive').textContent = 'Inactive (port disconnected)';
    document.getElementById('m-keepalive').style.color = 'var(--muted)';
  });

  keepalivePort.onMessage.addListener((msg) => {
    if (msg.type === 'pong') {
      document.getElementById('m-counter').textContent = msg.counter;
      document.getElementById('m-heartbeat').textContent = new Date(msg.ts).toLocaleTimeString();
    }
  });

  // Send a ping every 25 seconds — safely under the 30-second idle threshold.
  // Each ping triggers the SW's port.onMessage handler, keeping the worker awake.
  pingInterval = setInterval(() => {
    if (keepalivePort) {
      keepalivePort.postMessage({ type: 'ping' });
    }
  }, 25_000);

  document.getElementById('m-keepalive').textContent = 'Active ✓';
  document.getElementById('m-keepalive').style.color = 'var(--green)';
}

function closeKeepalivePort() {
  clearInterval(pingInterval);
  pingInterval = null;
  if (keepalivePort) {
    keepalivePort.disconnect();
    keepalivePort = null;
  }
  document.getElementById('m-keepalive').textContent = 'Inactive';
  document.getElementById('m-keepalive').style.color = 'var(--muted)';
}

// ─── Poll Worker State ───────────────────────────────────────────────────────

async function pollWorkerState() {
  // Try to reach the service worker via sendMessage.
  // If the worker is dead, Chrome wakes it to handle the message.
  // We get the in-memory counter — if it dropped since last poll, the worker restarted.
  try {
    const resp = await chrome.runtime.sendMessage({ action: 'getWorkerState' });
    if (resp) {
      document.getElementById('m-counter').textContent = resp.inMemoryEventCounter;
      document.getElementById('m-uptime').textContent  = formatUptime(resp.uptime);
      document.getElementById('status-dot').className  = 'status-dot alive';
      document.getElementById('status-text').textContent = 'Alive';
      document.getElementById('status-text').style.color = 'var(--green)';
    }
  } catch {
    document.getElementById('status-dot').className  = 'status-dot dead';
    document.getElementById('status-text').textContent = 'Dead (sending message woke it)';
    document.getElementById('status-text').style.color = 'var(--red)';
  }

  // Read persistent metrics from storage
  const s = await StorageManager.get(['swStartCount', 'swLastStart', 'swKeepAlive']);
  document.getElementById('m-wakes').textContent = s.swStartCount || 0;

  // Check alarms
  const alarms = await chrome.alarms.getAll();
  if (alarms.length > 0) {
    const next = alarms.reduce((a, b) => a.scheduledTime < b.scheduledTime ? a : b);
    const delta = Math.round((next.scheduledTime - Date.now()) / 1000);
    document.getElementById('m-next-alarm').textContent =
      `${next.name} in ${delta}s (${new Date(next.scheduledTime).toLocaleTimeString()})`;
  }

  // Read log
  await refreshLog();
}

// ─── Lifecycle Log ───────────────────────────────────────────────────────────

async function refreshLog() {
  const { swLifecycleLog } = await StorageManager.get(['swLifecycleLog']);
  const log = swLifecycleLog || [];
  if (log.length === lastLogLength) return;

  const container = document.getElementById('log-container');
  const isScrolledToBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight < 30;

  // Add only new entries (don't re-render all)
  const newEntries = log.slice(lastLogLength);
  const empty = container.querySelector('.log-empty');
  if (empty) empty.remove();

  for (const entry of newEntries) {
    const el = document.createElement('div');
    el.className = 'log-entry event-NEW';
    el.innerHTML = `
      <span class="log-ts">${new Date(entry.ts).toLocaleTimeString()}</span>
      <span class="log-event event-${entry.event}">${entry.event}</span>
      <span class="log-detail">${escHtml(entry.detail || '')}</span>
    `;
    container.appendChild(el);
    setTimeout(() => el.classList.remove('event-NEW'), 800);
  }

  lastLogLength = log.length;
  document.getElementById('log-count').textContent = `${log.length} events`;

  if (isScrolledToBottom) {
    container.scrollTop = container.scrollHeight;
  }
}

// ─── Controls ─────────────────────────────────────────────────────────────────

document.getElementById('keepalive-checkbox').addEventListener('change', (e) => {
  if (e.target.checked) openKeepalivePort();
  else closeKeepalivePort();
});

document.getElementById('btn-ping').addEventListener('click', async () => {
  if (keepalivePort) {
    keepalivePort.postMessage({ type: 'ping' });
  } else {
    // No port open — use sendMessage (wakes the worker if dead)
    await chrome.runtime.sendMessage({ action: 'getWorkerState' });
  }
  await StorageManager.logSwEvent('PING', 'manual from SW Monitor');
  await refreshLog();
});

document.getElementById('btn-force-alarm').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ action: 'triggerTabAnalysis' });
  await StorageManager.logSwEvent('ALARM', 'tab-analysis (manual trigger)');
  await refreshLog();
});

document.getElementById('btn-open-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('btn-clear-log').addEventListener('click', async () => {
  await StorageManager.set({ swLifecycleLog: [] });
  lastLogLength = 0;
  document.getElementById('log-container').innerHTML = '<div class="log-empty">Log cleared. Waiting for events…</div>';
  document.getElementById('log-count').textContent = '0 events';
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatUptime(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Start ───────────────────────────────────────────────────────────────────

// Poll every 2 seconds so the monitor feels live
pollInterval = setInterval(pollWorkerState, 2000);
pollWorkerState(); // immediate first read
