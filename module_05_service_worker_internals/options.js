// NeuralTab — options.js (Module 05 — cumulative + SW lifecycle section)

'use strict';

const PERMISSIONS = ['tabs', 'bookmarks', 'history', 'notifications'];

// ─── Navigation ──────────────────────────────────────────────────────────────

const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.settings-section');

navLinks.forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const targetId = link.getAttribute('href').slice(1);
    navLinks.forEach(l => l.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    link.classList.add('active');
    document.getElementById(targetId).classList.add('active');
    history.replaceState(null, '', link.getAttribute('href'));
  });
});

const hash    = location.hash || '#appearance';
const initial = document.querySelector(`[href="${hash}"]`);
if (initial) initial.click();

// ─── Load all settings ────────────────────────────────────────────────────────

async function loadSettings() {
  const s = await StorageManager.get();

  // Appearance
  document.getElementById('highlight-color').value     = s.highlightColor;
  document.getElementById('color-hex').value           = s.highlightColor;
  document.getElementById('min-len-range').value       = s.highlightMinLen;
  document.getElementById('min-len-value').textContent = s.highlightMinLen;
  document.getElementById('btn-position').value        = s.buttonPosition;
  updatePreview(s.highlightColor);

  // Behaviour
  document.getElementById('btn-visible').checked       = s.buttonVisible;
  document.getElementById('reading-speed').value       = s.readingSpeed;
  document.getElementById('speed-value').textContent   = s.readingSpeed;
  document.getElementById('blocked-domains').value     = s.blockedDomains.join('\n');

  // Tabs
  document.getElementById('tab-analysis-enabled').checked           = s.tabAnalysisEnabled;
  document.getElementById('idle-threshold').value                   = s.idleTabThresholdMins;
  document.getElementById('idle-threshold-value').textContent       = s.idleTabThresholdMins;

  // About
  const mf = chrome.runtime.getManifest();
  document.getElementById('about-name').textContent    = mf.name;
  document.getElementById('about-version').textContent = mf.version;
  document.getElementById('about-id').textContent      = chrome.runtime.id;
  document.getElementById('about-install').textContent = s.installDate ? new Date(s.installDate).toLocaleDateString() : 'Today';

  // Storage
  await loadQuota();
  document.getElementById('stat-summaries').textContent  = s.totalSummaries;
  document.getElementById('stat-idle-alerts').textContent = s.totalIdleAlerts;
  if (s.installDate) document.getElementById('stat-install').textContent = Math.floor((Date.now() - s.installDate) / 86400000);

  // Permissions
  await loadAllPermissions();
  // Alarm
  await loadAlarmStatus();
  // SW
  await loadSwSection(s);
}

// ─── Colour ───────────────────────────────────────────────────────────────────

function isLightColor(hex) {
  try {
    const r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255;
    return (0.2126*r+0.7152*g+0.0722*b) > 0.5;
  } catch { return false; }
}
function updatePreview(color) {
  const p = document.getElementById('color-preview');
  p.style.background = color;
  p.style.color = isLightColor(color) ? '#000' : '#fff';
  p.textContent = color;
}
document.getElementById('highlight-color').addEventListener('input', async e => {
  document.getElementById('color-hex').value = e.target.value;
  updatePreview(e.target.value);
  await StorageManager.set({ highlightColor: e.target.value });
});
document.getElementById('color-hex').addEventListener('change', async e => {
  const v = e.target.value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) { document.getElementById('highlight-color').value = v; updatePreview(v); await StorageManager.set({ highlightColor: v }); }
});
document.querySelectorAll('.preset-dot').forEach(dot => {
  dot.addEventListener('click', async () => {
    const c = dot.dataset.color;
    document.getElementById('highlight-color').value = c;
    document.getElementById('color-hex').value = c;
    updatePreview(c);
    await StorageManager.set({ highlightColor: c });
  });
});

// ─── Appearance ───────────────────────────────────────────────────────────────

document.getElementById('min-len-range').addEventListener('input', async e => {
  const v = parseInt(e.target.value, 10);
  document.getElementById('min-len-value').textContent = v;
  await StorageManager.set({ highlightMinLen: v });
});
document.getElementById('btn-position').addEventListener('change', async e => {
  await StorageManager.set({ buttonPosition: e.target.value });
});

// ─── Behaviour ────────────────────────────────────────────────────────────────

document.getElementById('btn-visible').addEventListener('change', async e => {
  await StorageManager.set({ buttonVisible: e.target.checked });
});
document.getElementById('reading-speed').addEventListener('input', async e => {
  const v = parseInt(e.target.value, 10);
  document.getElementById('speed-value').textContent = v;
  await StorageManager.set({ readingSpeed: v });
});
let domainsDebounce;
document.getElementById('blocked-domains').addEventListener('input', e => {
  clearTimeout(domainsDebounce);
  domainsDebounce = setTimeout(async () => {
    const domains = e.target.value.split('\n').map(d => d.trim().toLowerCase()).filter(Boolean);
    await StorageManager.set({ blockedDomains: domains });
  }, 400);
});

// ─── Tabs & Alarms ────────────────────────────────────────────────────────────

document.getElementById('tab-analysis-enabled').addEventListener('change', async e => {
  await StorageManager.set({ tabAnalysisEnabled: e.target.checked });
});
document.getElementById('idle-threshold').addEventListener('input', async e => {
  const v = parseInt(e.target.value, 10);
  document.getElementById('idle-threshold-value').textContent = v;
  await StorageManager.set({ idleTabThresholdMins: v });
});
document.getElementById('btn-run-analysis').addEventListener('click', async () => {
  const btn = document.getElementById('btn-run-analysis');
  btn.textContent = 'Running…'; btn.disabled = true;
  await chrome.runtime.sendMessage({ action: 'triggerTabAnalysis' });
  await loadAlarmStatus();
  btn.textContent = 'Run now'; btn.disabled = false;
});
document.getElementById('btn-open-tab-manager').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('tab_manager.html') });
});
async function loadAlarmStatus() {
  const alarm = await chrome.alarms.get('tab-analysis');
  const box   = document.getElementById('alarm-status');
  box.textContent = alarm
    ? `Next run: ${new Date(alarm.scheduledTime).toLocaleTimeString()} · Period: ${alarm.periodInMinutes} min`
    : 'Alarm not set — reload extension.';
}

// ─── Service Worker section ──────────────────────────────────────────────────

async function loadSwSection(s) {
  // Live worker state via message
  try {
    const resp = await chrome.runtime.sendMessage({ action: 'getWorkerState' });
    const dot  = document.getElementById('sw-status-dot');
    const txt  = document.getElementById('sw-status-text');
    if (resp) {
      dot.className = 'status-dot alive';
      txt.textContent = `Alive · uptime ${formatUptime(resp.uptime)} · in-memory counter: ${resp.inMemoryEventCounter}`;
      txt.style.color = 'var(--green)';
    }
    document.getElementById('sw-detail').textContent =
      `Start time: ${new Date(resp.swStartTime).toLocaleTimeString()} · Keepalive ports: ${resp.keepalivePorts}`;
  } catch {
    document.getElementById('sw-status-dot').className = 'status-dot dead';
    document.getElementById('sw-status-text').textContent = 'Dead (will wake on next event)';
    document.getElementById('sw-detail').textContent = 'Worker is in idle state.';
  }

  // Persistent stats
  document.getElementById('sw-wake-count').textContent  = s.swStartCount || 0;
  document.getElementById('sw-idle-alerts').textContent = s.totalIdleAlerts || 0;

  // Render lifecycle log
  renderSwLog(s.swLifecycleLog || []);
}

function renderSwLog(log) {
  const container = document.getElementById('sw-log');
  if (!log.length) { container.textContent = 'No events yet. Interact with the extension to generate events.'; return; }
  container.innerHTML = '';
  for (const entry of [...log].reverse()) {
    const el = document.createElement('div');
    el.className = 'sw-log-entry';
    el.innerHTML = `
      <span class="sw-log-ts">${new Date(entry.ts).toLocaleTimeString()}</span>
      <span class="sw-log-event ev-${entry.event}">${entry.event}</span>
      <span class="sw-log-detail">${escHtml(entry.detail || '')}</span>`;
    container.appendChild(el);
  }
}

document.getElementById('btn-clear-sw-log').addEventListener('click', async () => {
  await StorageManager.set({ swLifecycleLog: [] });
  document.getElementById('sw-log').textContent = 'Log cleared.';
});
document.getElementById('btn-open-sw-monitor').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('sw_monitor.html') });
});

function formatUptime(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
}

// ─── Permissions ──────────────────────────────────────────────────────────────

async function loadAllPermissions() {
  for (const perm of PERMISSIONS) {
    const granted = await chrome.permissions.contains({ permissions: [perm] });
    updatePermissionUI(perm, granted);
  }
}
function updatePermissionUI(name, granted) {
  const grantBtn  = document.querySelector(`.perm-grant[data-perm="${name}"]`);
  const revokeBtn = document.querySelector(`.perm-revoke[data-perm="${name}"]`);
  const status    = document.getElementById(`perm-status-${name}`);
  if (!grantBtn) return;
  grantBtn.style.display  = granted ? 'none' : '';
  revokeBtn.style.display = granted ? ''     : 'none';
  status.textContent      = granted ? '✓ Granted' : 'Not granted';
  status.className        = granted ? 'perm-status granted' : 'perm-status';
}
document.querySelectorAll('.perm-grant').forEach(btn => {
  btn.addEventListener('click', async () => {
    const perm    = btn.dataset.perm;
    const granted = await chrome.permissions.request({ permissions: [perm] });
    updatePermissionUI(perm, granted);
  });
});
document.querySelectorAll('.perm-revoke').forEach(btn => {
  btn.addEventListener('click', async () => {
    await chrome.permissions.remove({ permissions: [btn.dataset.perm] });
    updatePermissionUI(btn.dataset.perm, false);
  });
});

// ─── Storage ──────────────────────────────────────────────────────────────────

async function loadQuota() {
  const { used, total, pct } = await StorageManager.getQuota();
  document.getElementById('quota-fill').style.width = pct + '%';
  document.getElementById('quota-text').textContent =
    `${StorageManager._formatBytes(used)} of ${StorageManager._formatBytes(total)} used (${pct}%)`;
}
document.getElementById('btn-export').addEventListener('click', async () => {
  const data = await StorageManager.get();
  const json = JSON.stringify({ _version: 5, _exported: new Date().toISOString(), ...data }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `neuraltab-settings-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
});
document.getElementById('btn-reset').addEventListener('click', async () => {
  if (!confirm('Reset ALL NeuralTab settings to defaults?')) return;
  await StorageManager.reset(); await loadSettings();
});

// ─── Live sync ────────────────────────────────────────────────────────────────

StorageManager.onChange(async changes => {
  if (changes.highlightColor !== undefined) { document.getElementById('highlight-color').value = changes.highlightColor; document.getElementById('color-hex').value = changes.highlightColor; updatePreview(changes.highlightColor); }
  if (changes.buttonVisible  !== undefined) document.getElementById('btn-visible').checked = changes.buttonVisible;
  if (changes.totalSummaries !== undefined) document.getElementById('stat-summaries').textContent = changes.totalSummaries;
  if (changes.swStartCount   !== undefined) document.getElementById('sw-wake-count').textContent = changes.swStartCount;
  if (changes.swLifecycleLog !== undefined) renderSwLog(changes.swLifecycleLog || []);
  if (changes.totalIdleAlerts !== undefined) { document.getElementById('stat-idle-alerts').textContent = changes.totalIdleAlerts; document.getElementById('sw-idle-alerts').textContent = changes.totalIdleAlerts; }
});

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

loadSettings().catch(console.error);
