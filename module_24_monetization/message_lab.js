// NeuralTab — message_lab.js (Module 07 — unchanged from M06)
'use strict';

let streamPort = null;

// ── Pattern 1: Fire & Forget ─────────────────────────────────────────────────
document.getElementById('p1-send').addEventListener('click', () => {
  const text = document.getElementById('p1-text').value.trim();
  chrome.runtime.sendMessage({ action: 'oneWayLog', text, context: 'message_lab' });
  document.getElementById('p1-result').textContent = `Sent at ${new Date().toLocaleTimeString()} — no response expected`;
});

// ── Pattern 2: Request / Response ────────────────────────────────────────────
document.getElementById('p2-echo').addEventListener('click', async () => {
  const payload = document.getElementById('p2-payload').value.trim();
  const t0 = Date.now();
  try {
    const r = await chrome.runtime.sendMessage({ action: 'echoRequest', payload });
    document.getElementById('p2-result').textContent = `RTT: ${Date.now() - t0}ms\n${JSON.stringify(r, null, 2)}`;
  } catch (e) {
    document.getElementById('p2-result').textContent = `ERROR: ${e.message}`;
  }
});

document.getElementById('p2-stats').addEventListener('click', async () => {
  const t0 = Date.now();
  try {
    const r = await chrome.runtime.sendMessage({ action: 'getMessageStats' });
    document.getElementById('p2-result').textContent = `RTT: ${Date.now() - t0}ms\n${JSON.stringify(r, null, 2)}`;
  } catch (e) {
    document.getElementById('p2-result').textContent = `ERROR: ${e.message}`;
  }
});

// ── Pattern 3: Port Streaming ─────────────────────────────────────────────────
document.getElementById('p3-start').addEventListener('click', () => {
  const chunks  = parseInt(document.getElementById('p3-chunks').value) || 10;
  const delayMs = parseInt(document.getElementById('p3-delay').value)  || 150;

  document.getElementById('p3-feed').innerHTML     = '';
  document.getElementById('p3-progress').style.width = '0%';
  document.getElementById('p3-start').disabled     = true;
  document.getElementById('p3-stop').disabled      = false;

  streamPort = chrome.runtime.connect({ name: 'neuraltab-stream' });

  streamPort.onMessage.addListener(msg => {
    if (msg.type === 'chunk') {
      const pct = Math.round((msg.index / msg.total) * 100);
      document.getElementById('p3-progress').style.width = pct + '%';
      const row = document.createElement('div');
      row.className   = 'stream-chunk';
      row.textContent = `[${msg.index}/${msg.total}] ${msg.data}`;
      const feed = document.getElementById('p3-feed');
      feed.appendChild(row);
      feed.scrollTop = feed.scrollHeight;
    }
    if (msg.type === 'complete') {
      document.getElementById('p3-progress').style.width = '100%';
      document.getElementById('p3-start').disabled = false;
      document.getElementById('p3-stop').disabled  = true;
    }
  });

  streamPort.onDisconnect.addListener(() => {
    streamPort = null;
    document.getElementById('p3-start').disabled = false;
    document.getElementById('p3-stop').disabled  = true;
  });

  streamPort.postMessage({ action: 'startStream', chunks, delayMs });
});

document.getElementById('p3-stop').addEventListener('click', () => {
  streamPort?.postMessage({ action: 'stopStream' });
  document.getElementById('p3-start').disabled = false;
  document.getElementById('p3-stop').disabled  = true;
});

// ── Pattern 4: Storage Pub/Sub ────────────────────────────────────────────────
async function loadCounter() {
  const s = await StorageManager.get(['demoCounter']);
  document.getElementById('p4-counter').textContent = s.demoCounter || 0;
}

document.getElementById('p4-inc').addEventListener('click', async () => {
  const s    = await StorageManager.get(['demoCounter']);
  const next = (s.demoCounter || 0) + 1;
  await StorageManager.set({ demoCounter: next });
});

document.getElementById('p4-dec').addEventListener('click', async () => {
  const s    = await StorageManager.get(['demoCounter']);
  const next = Math.max(0, (s.demoCounter || 0) - 1);
  await StorageManager.set({ demoCounter: next });
});

document.getElementById('p4-reset').addEventListener('click', () =>
  StorageManager.set({ demoCounter: 0 }));

function onDemoCounterChange(val) {
  const el = document.getElementById('p4-counter');
  el.textContent = val ?? 0;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

StorageManager.onChange(changes => {
  if (changes.demoCounter !== undefined) onDemoCounterChange(changes.demoCounter);
  if (changes.messageLog  !== undefined) renderLog(changes.messageLog || []);
});

// ── Log ───────────────────────────────────────────────────────────────────────
async function renderLog(log) {
  const c = document.getElementById('log-entries');
  c.innerHTML = '';
  for (const e of [...log].reverse().slice(0, 30)) {
    const row = document.createElement('div');
    row.className = 'log-entry';
    row.innerHTML = `<span class="dir-${e.dir === 'IN' ? 'in' : 'out'}">${e.dir}</span> ${new Date(e.ts).toLocaleTimeString()} — ${escHtml(e.action)}`;
    c.appendChild(row);
  }
}

document.getElementById('btn-clear-log').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ action: 'clearMessageLog' });
  document.getElementById('log-entries').innerHTML = '';
});

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function init() {
  await loadCounter();
  const s = await StorageManager.get(['messageLog']);
  renderLog(s.messageLog || []);
}
init();
