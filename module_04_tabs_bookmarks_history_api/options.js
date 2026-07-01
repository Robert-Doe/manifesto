// NeuralTab — options.js (Module 04 — cumulative)

'use strict';

const PERMISSIONS = ['tabs', 'bookmarks', 'history', 'notifications'];

// ─── Section navigation ───────────────────────────────────────────────────────

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

const hash = location.hash || '#appearance';
const initial = document.querySelector(`[href="${hash}"]`);
if (initial) initial.click();

// ─── Load settings ────────────────────────────────────────────────────────────

async function loadSettings() {
  const s = await StorageManager.get();

  // Appearance
  document.getElementById('highlight-color').value  = s.highlightColor;
  document.getElementById('color-hex').value        = s.highlightColor;
  document.getElementById('min-len-range').value    = s.highlightMinLen;
  document.getElementById('min-len-value').textContent = s.highlightMinLen;
  document.getElementById('btn-position').value     = s.buttonPosition;
  updatePreview(s.highlightColor);

  // Behaviour
  document.getElementById('btn-visible').checked    = s.buttonVisible;
  document.getElementById('reading-speed').value    = s.readingSpeed;
  document.getElementById('speed-value').textContent = s.readingSpeed;
  document.getElementById('blocked-domains').value  = s.blockedDomains.join('\n');

  // Tabs & Alarms
  document.getElementById('tab-analysis-enabled').checked = s.tabAnalysisEnabled;
  document.getElementById('idle-threshold').value         = s.idleTabThresholdMins;
  document.getElementById('idle-threshold-value').textContent = s.idleTabThresholdMins;
  document.getElementById('bookmark-folder-name').value  = s.bookmarkFolderName;

  // About
  const mf = chrome.runtime.getManifest();
  document.getElementById('about-name').textContent    = mf.name;
  document.getElementById('about-version').textContent = mf.version;
  document.getElementById('about-id').textContent      = chrome.runtime.id;
  document.getElementById('about-install').textContent =
    s.installDate ? new Date(s.installDate).toLocaleDateString() : 'Today';

  // Storage quota
  await loadQuota();
  // Stats
  document.getElementById('stat-summaries').textContent  = s.totalSummaries;
  document.getElementById('stat-idle-alerts').textContent = s.totalIdleAlerts;
  if (s.installDate) {
    const days = Math.floor((Date.now() - s.installDate) / 86400000);
    document.getElementById('stat-install').textContent = days;
  }

  // Permissions
  await loadAllPermissions();
  // Alarm status
  await loadAlarmStatus();
}

// ─── Colour controls ──────────────────────────────────────────────────────────

function isLightColor(hex) {
  try {
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    return (0.2126*r + 0.7152*g + 0.0722*b) > 0.5;
  } catch { return false; }
}

function updatePreview(color) {
  const preview = document.getElementById('color-preview');
  preview.style.background = color;
  preview.style.color      = isLightColor(color) ? '#000' : '#fff';
  preview.textContent      = color;
}

document.getElementById('highlight-color').addEventListener('input', async e => {
  const c = e.target.value;
  document.getElementById('color-hex').value = c;
  updatePreview(c);
  await StorageManager.set({ highlightColor: c });
});

document.getElementById('color-hex').addEventListener('change', async e => {
  const v = e.target.value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
    document.getElementById('highlight-color').value = v;
    updatePreview(v);
    await StorageManager.set({ highlightColor: v });
  }
});

document.querySelectorAll('.preset-dot').forEach(dot => {
  dot.addEventListener('click', async () => {
    const c = dot.dataset.color;
    document.getElementById('highlight-color').value = c;
    document.getElementById('color-hex').value       = c;
    updatePreview(c);
    await StorageManager.set({ highlightColor: c });
  });
});

// ─── Appearance controls ──────────────────────────────────────────────────────

document.getElementById('min-len-range').addEventListener('input', async e => {
  const v = parseInt(e.target.value, 10);
  document.getElementById('min-len-value').textContent = v;
  await StorageManager.set({ highlightMinLen: v });
});

document.getElementById('btn-position').addEventListener('change', async e => {
  await StorageManager.set({ buttonPosition: e.target.value });
});

// ─── Behaviour controls ───────────────────────────────────────────────────────

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

// ─── Tabs & Alarms controls ───────────────────────────────────────────────────

document.getElementById('tab-analysis-enabled').addEventListener('change', async e => {
  await StorageManager.set({ tabAnalysisEnabled: e.target.checked });
});

document.getElementById('idle-threshold').addEventListener('input', async e => {
  const v = parseInt(e.target.value, 10);
  document.getElementById('idle-threshold-value').textContent = v;
  await StorageManager.set({ idleTabThresholdMins: v });
});

let folderDebounce;
document.getElementById('bookmark-folder-name').addEventListener('input', e => {
  clearTimeout(folderDebounce);
  folderDebounce = setTimeout(async () => {
    await StorageManager.set({ bookmarkFolderName: e.target.value.trim() || 'NeuralTab Saves' });
  }, 400);
});

document.getElementById('btn-run-analysis').addEventListener('click', async () => {
  const btn = document.getElementById('btn-run-analysis');
  btn.textContent = 'Running…'; btn.disabled = true;
  await chrome.runtime.sendMessage({ action: 'triggerTabAnalysis' });
  await loadAlarmStatus();
  btn.textContent = 'Run analysis now'; btn.disabled = false;
});

document.getElementById('btn-open-tab-manager').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('tab_manager.html') });
});

async function loadAlarmStatus() {
  const alarm = await chrome.alarms.get('tab-analysis');
  const box   = document.getElementById('alarm-status');
  if (alarm) {
    const next = new Date(alarm.scheduledTime);
    box.textContent = `Next run: ${next.toLocaleTimeString()} · Period: ${alarm.periodInMinutes} min`;
  } else {
    box.textContent = 'Alarm not set. Reload the extension to create it.';
  }
}

// ─── Permission management ────────────────────────────────────────────────────

async function checkPermission(name) {
  return chrome.permissions.contains({ permissions: [name] });
}

async function loadAllPermissions() {
  for (const perm of PERMISSIONS) {
    const granted = await checkPermission(perm);
    updatePermissionUI(perm, granted);
  }
}

function updatePermissionUI(name, granted) {
  const grantBtn  = document.querySelector(`.perm-grant[data-perm="${name}"]`);
  const revokeBtn = document.querySelector(`.perm-revoke[data-perm="${name}"]`);
  const status    = document.getElementById(`perm-status-${name}`);
  if (!grantBtn) return;

  if (granted) {
    grantBtn.style.display  = 'none';
    revokeBtn.style.display = '';
    status.textContent = '✓ Granted';
    status.className   = 'perm-status granted';
  } else {
    grantBtn.style.display  = '';
    revokeBtn.style.display = 'none';
    status.textContent = 'Not granted';
    status.className   = 'perm-status';
  }
}

// Grant buttons — MUST be called from direct click handler (user gesture requirement)
document.querySelectorAll('.perm-grant').forEach(btn => {
  btn.addEventListener('click', async () => {
    const perm = btn.dataset.perm;
    const granted = await chrome.permissions.request({ permissions: [perm] });
    updatePermissionUI(perm, granted);
    if (granted) {
      const status = document.getElementById(`perm-status-${perm}`);
      status.textContent = '✓ Just granted!';
      setTimeout(() => updatePermissionUI(perm, true), 2000);
    }
  });
});

// Revoke buttons
document.querySelectorAll('.perm-revoke').forEach(btn => {
  btn.addEventListener('click', async () => {
    const perm = btn.dataset.perm;
    await chrome.permissions.remove({ permissions: [perm] });
    updatePermissionUI(perm, false);
  });
});

// ─── Storage quota ────────────────────────────────────────────────────────────

async function loadQuota() {
  const { used, total, pct } = await StorageManager.getQuota();
  const usedStr  = StorageManager._formatBytes(used);
  const totalStr = StorageManager._formatBytes(total);
  document.getElementById('quota-fill').style.width = pct + '%';
  document.getElementById('quota-text').textContent = `${usedStr} of ${totalStr} used (${pct}%)`;
}

// ─── Export ───────────────────────────────────────────────────────────────────

document.getElementById('btn-export').addEventListener('click', async () => {
  const data = await StorageManager.get();
  const json = JSON.stringify({ _version: 4, _exported: new Date().toISOString(), ...data }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `neuraltab-settings-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// ─── Reset ────────────────────────────────────────────────────────────────────

document.getElementById('btn-reset').addEventListener('click', async () => {
  if (!confirm('Reset ALL NeuralTab settings to defaults? This cannot be undone.')) return;
  await StorageManager.reset();
  await loadSettings();
});

// ─── Live sync from any context ───────────────────────────────────────────────

StorageManager.onChange(async changes => {
  if (changes.highlightColor !== undefined) {
    document.getElementById('highlight-color').value = changes.highlightColor;
    document.getElementById('color-hex').value       = changes.highlightColor;
    updatePreview(changes.highlightColor);
  }
  if (changes.buttonVisible !== undefined) {
    document.getElementById('btn-visible').checked = changes.buttonVisible;
  }
  if (changes.totalSummaries !== undefined) {
    document.getElementById('stat-summaries').textContent = changes.totalSummaries;
  }
  if (changes.totalIdleAlerts !== undefined) {
    document.getElementById('stat-idle-alerts').textContent = changes.totalIdleAlerts;
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

loadSettings().catch(console.error);
