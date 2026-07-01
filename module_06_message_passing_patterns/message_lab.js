// NeuralTab — message_lab.js (Module 06)
// Demonstrates all 4 Chrome extension message-passing patterns interactively.

'use strict';

// ─── Global port state (Pattern 3) ───────────────────────────────────────────
let streamPort     = null;
let streamTotal    = 0;
let streamReceived = 0;

// ─── Pub/Sub log (Pattern 4) ─────────────────────────────────────────────────
let pubsubEventCount = 0;

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
async function init() {
  // Label this page instance in the header
  document.getElementById('context-id').textContent =
    `Lab · ${new Date().toLocaleTimeString()}`;

  // Load initial state
  await refreshUnifiedLog();
  await loadP1Log();
  await loadP4Counter();

  wireAll();

  // Pattern 4: subscribe to storage changes in THIS page
  StorageManager.onChange(changes => {
    if (changes.demoCounter !== undefined) onDemoCounterChange(changes.demoCounter);
    if (changes.messageLog  !== undefined) refreshUnifiedLogFromData(changes.messageLog || []);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// WIRE ALL CONTROLS
// ─────────────────────────────────────────────────────────────────────────────
function wireAll() {
  // Header
  document.getElementById('btn-clear-log').addEventListener('click', clearAll);
  document.getElementById('btn-open-new-tab').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('message_lab.html') });
  });

  // Pattern 1
  document.getElementById('p1-send').addEventListener('click', pattern1Send);
  document.getElementById('p1-text').addEventListener('keydown', e => {
    if (e.key === 'Enter') pattern1Send();
  });
  document.getElementById('p1-refresh').addEventListener('click', loadP1Log);

  // Pattern 2
  document.getElementById('p2-echo-send').addEventListener('click', pattern2Echo);
  document.getElementById('p2-stats-send').addEventListener('click', pattern2Stats);

  // Pattern 3
  document.getElementById('p3-connect').addEventListener('click', pattern3Connect);
  document.getElementById('p3-disconnect').addEventListener('click', pattern3Disconnect);
  document.getElementById('p3-ping').addEventListener('click', pattern3Ping);
  document.getElementById('p3-start').addEventListener('click', pattern3Start);
  document.getElementById('p3-stop').addEventListener('click', pattern3Stop);

  // Pattern 4
  document.getElementById('p4-plus').addEventListener('click', () => pattern4Increment(1));
  document.getElementById('p4-minus').addEventListener('click', () => pattern4Increment(-1));
  document.getElementById('p4-plus10').addEventListener('click', () => pattern4Increment(10));
  document.getElementById('p4-reset').addEventListener('click', pattern4Reset);

  // Unified log
  document.getElementById('log-refresh').addEventListener('click', refreshUnifiedLog);
  document.getElementById('log-export').addEventListener('click', exportLog);
}

// ─────────────────────────────────────────────────────────────────────────────
// PATTERN 1 — One-Way Fire & Forget
// ─────────────────────────────────────────────────────────────────────────────
async function pattern1Send() {
  const text = document.getElementById('p1-text').value.trim();
  if (!text) return;

  // ★ THE PATTERN: send with no await/then for the response
  chrome.runtime.sendMessage({ action: 'oneWayLog', text });
  // Execution continues IMMEDIATELY — no blocking

  document.getElementById('p1-text').value = '';
  const confirm = document.getElementById('p1-confirm');
  confirm.classList.remove('hidden');
  setTimeout(() => confirm.classList.add('hidden'), 3000);

  // Wait a tick for background to write, then refresh log
  setTimeout(loadP1Log, 300);
}

async function loadP1Log() {
  const s   = await StorageManager.get(['messageLog']);
  const log = (s.messageLog || []).filter(e => e.action === 'oneWayLog').slice(-15);
  const el  = document.getElementById('p1-log');
  if (!log.length) { el.innerHTML = '<div class="log-empty">No oneWayLog entries yet.</div>'; return; }
  el.innerHTML = '';
  for (const entry of [...log].reverse()) {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<span class="log-ts">${fmtTime(entry.ts)}</span>
      <span class="log-dir dir-${entry.dir}">${entry.dir}</span>
      <span class="log-action">${escHtml(entry.action)}</span>
      <span class="log-detail">${escHtml(entry.detail || '')}</span>`;
    el.appendChild(div);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATTERN 2 — Request / Response
// ─────────────────────────────────────────────────────────────────────────────
async function pattern2Echo() {
  const raw = document.getElementById('p2-echo-input').value.trim();
  let payload;
  try { payload = raw ? JSON.parse(raw) : { hello: 'world', ts: Date.now() }; }
  catch { payload = { raw }; }

  const t0  = Date.now();
  const btn = document.getElementById('p2-echo-send');
  btn.textContent = 'Awaiting…'; btn.disabled = true;

  try {
    // ★ THE PATTERN: await the response — background must return true + call sendResponse
    const result = await chrome.runtime.sendMessage({ action: 'echoRequest', payload });
    const rtt    = Date.now() - t0;

    showResult('p2-echo-result', result);
    document.getElementById('p2-timing').classList.remove('hidden');
    document.getElementById('p2-rt-ms').textContent = `${rtt}ms`;
    document.getElementById('p2-rt-at').textContent  = new Date(result.respondedAt).toLocaleTimeString();
  } catch (e) {
    showResult('p2-echo-result', { error: e.message });
  } finally {
    btn.textContent = 'Send & Await →'; btn.disabled = false;
  }
}

async function pattern2Stats() {
  const btn = document.getElementById('p2-stats-send');
  btn.textContent = 'Awaiting…'; btn.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({ action: 'getMessageStats' });
    showResult('p2-stats-result', result);
  } catch (e) {
    showResult('p2-stats-result', { error: e.message });
  } finally {
    btn.textContent = 'Request Stats →'; btn.disabled = false;
  }
}

function showResult(id, data) {
  const el = document.getElementById(id);
  el.classList.remove('hidden');
  el.textContent = JSON.stringify(data, null, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// PATTERN 3 — Port-Based Streaming
// ─────────────────────────────────────────────────────────────────────────────
function pattern3Connect() {
  if (streamPort) return;

  // ★ THE PATTERN: chrome.runtime.connect() opens a persistent port
  streamPort = chrome.runtime.connect({ name: 'neuraltab-stream' });

  setP3Status('connected', 'Port connected — waiting for stream');
  document.getElementById('p3-connect').disabled    = true;
  document.getElementById('p3-disconnect').disabled = false;
  document.getElementById('p3-ping').disabled       = false;
  document.getElementById('p3-start').disabled      = false;

  appendFeed({ type: 'start', text: '⬆ Port opened to background worker' });

  streamPort.onMessage.addListener(handleStreamMessage);

  streamPort.onDisconnect.addListener(() => {
    streamPort = null;
    setP3Status('', 'Port disconnected (worker may have restarted)');
    document.getElementById('p3-connect').disabled    = false;
    document.getElementById('p3-disconnect').disabled = true;
    document.getElementById('p3-ping').disabled       = true;
    document.getElementById('p3-start').disabled      = true;
    document.getElementById('p3-stop').disabled       = true;
    appendFeed({ type: 'error', text: '⬇ Port closed' });
  });
}

function handleStreamMessage(msg) {
  if (msg.type === 'streamStart') {
    streamTotal    = msg.total;
    streamReceived = 0;
    setP3Status('streaming', `Streaming ${msg.total} chunks every ${msg.delay}ms`);
    document.getElementById('p3-progress-wrap').classList.remove('hidden');
    document.getElementById('p3-stop').disabled  = false;
    document.getElementById('p3-start').disabled = true;
    appendFeed({ type: 'start', text: `▶ Stream started: ${msg.total} chunks, ${msg.delay}ms interval` });
  }
  if (msg.type === 'chunk') {
    streamReceived = msg.index;
    const pct = Math.round((msg.index / msg.total) * 100);
    document.getElementById('p3-progress-fill').style.width = pct + '%';
    document.getElementById('p3-progress-text').textContent = `${msg.index} / ${msg.total}`;
    appendFeed({ type: 'chunk', text: msg.data, done: msg.done });
    if (msg.done) {
      setP3Status('connected', 'Stream complete');
      document.getElementById('p3-stop').disabled  = true;
      document.getElementById('p3-start').disabled = false;
    }
  }
  if (msg.type === 'streamStopped') {
    setP3Status('connected', 'Stream stopped by client');
    document.getElementById('p3-stop').disabled  = true;
    document.getElementById('p3-start').disabled = false;
    appendFeed({ type: 'stopped', text: '■ Stream stopped' });
  }
  if (msg.type === 'portPong') {
    appendFeed({ type: 'pong', text: `← Pong · in-memory counter: ${msg.counter} · ts: ${fmtTime(msg.ts)}` });
  }
}

function pattern3Disconnect() {
  if (streamPort) { streamPort.disconnect(); streamPort = null; }
}

function pattern3Ping() {
  if (streamPort) streamPort.postMessage({ action: 'portPing' });
}

function pattern3Start() {
  if (!streamPort) return;
  const chunks  = parseInt(document.getElementById('p3-chunks').value, 10)  || 20;
  const delayMs = parseInt(document.getElementById('p3-delay').value,  10)  || 150;
  document.getElementById('p3-feed').innerHTML = '';
  document.getElementById('p3-progress-fill').style.width = '0';
  streamPort.postMessage({ action: 'startStream', chunks, delayMs });
}

function pattern3Stop() {
  if (streamPort) streamPort.postMessage({ action: 'stopStream' });
}

function setP3Status(cls, text) {
  const dot = document.getElementById('p3-dot');
  dot.className = 'status-dot' + (cls ? ' ' + cls : '');
  document.getElementById('p3-status-text').textContent = text;
}

function appendFeed(item) {
  const feed = document.getElementById('p3-feed');
  if (feed.querySelector('.log-empty')) feed.innerHTML = '';
  const div = document.createElement('div');
  div.className = `stream-chunk type-${item.type}${item.done ? ' done' : ''} new-chunk`;
  div.textContent = item.text;
  feed.appendChild(div);
  // Auto-scroll if near bottom
  if (feed.scrollHeight - feed.scrollTop < feed.clientHeight + 60) {
    feed.scrollTop = feed.scrollHeight;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATTERN 4 — Storage Pub/Sub
// ─────────────────────────────────────────────────────────────────────────────
async function loadP4Counter() {
  const s = await StorageManager.get(['demoCounter']);
  document.getElementById('p4-counter').textContent = s.demoCounter || 0;
}

async function pattern4Increment(delta) {
  // ★ THE PATTERN (option A): write directly to storage — no message needed
  // Every page listening via storage.onChanged will react automatically.
  const s    = await StorageManager.get(['demoCounter']);
  const next = (s.demoCounter || 0) + delta;
  await StorageManager.set({ demoCounter: next });
  // NOTE: The onChange listener in init() will update the display.
  // We do NOT need to update the display here — that would be double-updating.
}

async function pattern4Reset() {
  await StorageManager.set({ demoCounter: 0 });
}

function onDemoCounterChange(newValue) {
  const el = document.getElementById('p4-counter');
  el.textContent = newValue;
  // Brief scale bump animation
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 150);

  // Log the change event
  pubsubEventCount++;
  const log = document.getElementById('p4-log');
  if (log.querySelector('.log-empty')) log.innerHTML = '';
  const entry = document.createElement('div');
  entry.className = 'pubsub-entry new-pub';
  entry.innerHTML = `<span class="pub-ts">${new Date().toLocaleTimeString()}</span>
    <span class="pub-key">demoCounter</span>
    <span class="pub-val">→ ${newValue}</span>
    <span style="color:var(--muted);margin-left:8px;">(event #${pubsubEventCount})</span>`;
  log.insertBefore(entry, log.firstChild);
  if (log.children.length > 20) log.removeChild(log.lastChild);
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED LOG
// ─────────────────────────────────────────────────────────────────────────────
async function refreshUnifiedLog() {
  const s = await StorageManager.get(['messageLog', 'messageCount']);
  refreshUnifiedLogFromData(s.messageLog || [], s.messageCount || 0);
}

function refreshUnifiedLogFromData(log, totalCount) {
  const total   = totalCount ?? log.length;
  const inbound = log.filter(e => e.dir === 'IN').length;
  const outbound= log.filter(e => e.dir === 'OUT').length;
  const ports   = log.filter(e => e.dir.startsWith('PORT')).length;

  document.getElementById('ls-total').textContent = total;
  document.getElementById('ls-in').textContent    = inbound;
  document.getElementById('ls-out').textContent   = outbound;
  document.getElementById('ls-port').textContent  = ports;

  const container = document.getElementById('message-log');
  container.innerHTML = '';

  if (!log.length) {
    container.innerHTML = '<div class="log-empty">No messages yet.</div>';
    return;
  }
  for (const entry of [...log].reverse()) {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<span class="log-ts">${fmtTime(entry.ts)}</span>
      <span class="log-dir dir-${entry.dir}">${entry.dir}</span>
      <span class="log-action">${escHtml(entry.action)}</span>
      <span style="color:var(--muted);min-width:80px;flex-shrink:0">${escHtml(entry.context || '')}</span>
      <span class="log-detail">${escHtml(entry.detail || '')}</span>`;
    container.appendChild(div);
  }
}

async function clearAll() {
  await chrome.runtime.sendMessage({ action: 'clearMessageLog' });
  await StorageManager.set({ demoCounter: 0 });
  document.getElementById('p4-log').innerHTML = '<div class="log-empty">No changes yet.</div>';
  document.getElementById('p1-log').innerHTML = '<div class="log-empty">No oneWayLog entries yet.</div>';
  document.getElementById('message-log').innerHTML = '<div class="log-empty">No messages yet.</div>';
  document.getElementById('ls-total').textContent  = 0;
  document.getElementById('ls-in').textContent     = 0;
  document.getElementById('ls-out').textContent    = 0;
  document.getElementById('ls-port').textContent   = 0;
  pubsubEventCount = 0;
}

async function exportLog() {
  const s    = await StorageManager.get(['messageLog', 'messageCount']);
  const json = JSON.stringify({ exported: new Date().toISOString(), total: s.messageCount, log: s.messageLog }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `neuraltab-message-log-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init();
