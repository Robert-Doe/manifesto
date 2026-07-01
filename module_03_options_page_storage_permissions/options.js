// ============================================================
// NeuralTab — options.js
// Module 03: Options Page, Storage & Permissions UX
//
// This script runs in the options page context — a full
// extension page with complete access to chrome.* APIs.
// It does three jobs:
//   1. Load current settings from StorageManager and populate
//      every form control with the stored (or default) values.
//   2. Save any change immediately — no "Save" button needed.
//      Each input fires an event that calls StorageManager.set()
//      for just the changed key. This is the "autosave" pattern.
//   3. Notify the user of a save with a brief status message.
//      The status fades out after 1.5s.
// ============================================================

'use strict';

// ── DOM references ────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Section navigation ────────────────────────────────────────
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = link.dataset.section;

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.settings-section').forEach(s => s.classList.add('hidden'));

    link.classList.add('active');
    $(target)?.classList.remove('hidden');
  });
});

// ── Save status flash ─────────────────────────────────────────
let saveTimer = null;
function flashSaved(msg = '✓ Saved') {
  const el = $('save-status');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => el.classList.remove('visible'), 1500);
}

// ── 1. LOAD ALL SETTINGS ──────────────────────────────────────
async function loadSettings() {
  const settings = await StorageManager.get();

  // Appearance
  $('highlight-color').value     = settings.highlightColor;
  $('color-hex').textContent     = settings.highlightColor;
  $('highlight-min-len').value   = settings.highlightMinLen;
  $('highlight-min-len-val').textContent = `${settings.highlightMinLen} chars`;
  $('button-position').value     = settings.buttonPosition;
  updatePreview(settings.highlightColor);

  // Behaviour
  $('button-visible').checked    = settings.buttonVisible;
  $('reading-speed').value       = settings.readingSpeed;
  $('reading-speed-val').textContent = `${settings.readingSpeed} wpm`;
  $('blocked-domains').value     = settings.blockedDomains.join('\n');

  // About
  $('about-id').textContent      = chrome.runtime.id;

  // Storage quota
  await loadQuota(settings);

  // Permissions
  await checkAllPermissions();

  // Install date (set on first load if not already set)
  if (!settings.installDate) {
    await StorageManager.set({ installDate: new Date().toISOString() });
  }
  const installDate = settings.installDate || new Date().toISOString();
  $('stat-install').textContent  = new Date(installDate).toLocaleDateString();
  $('stat-summaries').textContent= settings.totalSummaries;
}

// ── 2. LIVE PREVIEW ───────────────────────────────────────────
function updatePreview(color) {
  // Update every preview highlight mark with the new colour
  document.querySelectorAll('.preview-highlight').forEach(el => {
    el.style.background = color;
    // Compute contrast — use dark text on light backgrounds
    el.style.color = isLightColor(color) ? '#0b0f1a' : '#e2e8f0';
  });
  // Update the preview button to match the highlight colour
  $('preview-nt-btn').style.background = color;
  $('preview-nt-btn').style.color = isLightColor(color) ? '#0b0f1a' : '#e2e8f0';
}

// Simple luminance check to pick readable text colour
function isLightColor(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  // Perceived luminance formula (W3C)
  return (0.299 * r + 0.587 * g + 0.114 * b) > 128;
}

// ── 3. AUTOSAVE HANDLERS ─────────────────────────────────────
// Each handler saves ONLY the changed key. No full-form submit.
// This means a partial save always works — no state is lost if
// the user closes the tab mid-edit.

// Highlight colour
$('highlight-color').addEventListener('input', async (e) => {
  const color = e.target.value;
  $('color-hex').textContent = color;
  updatePreview(color);
  await StorageManager.set({ highlightColor: color });
  flashSaved();
  // Mark the matching preset as active (if any)
  document.querySelectorAll('.preset-dot').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.color === color);
  });
});

// Colour presets
document.querySelectorAll('.preset-dot').forEach(dot => {
  dot.addEventListener('click', async () => {
    const color = dot.dataset.color;
    $('highlight-color').value = color;
    $('color-hex').textContent = color;
    updatePreview(color);
    await StorageManager.set({ highlightColor: color });
    flashSaved();
    document.querySelectorAll('.preset-dot').forEach(d => {
      d.classList.toggle('active', d.dataset.color === color);
    });
  });
});

// Minimum word length
$('highlight-min-len').addEventListener('input', async (e) => {
  const val = parseInt(e.target.value);
  $('highlight-min-len-val').textContent = `${val} chars`;
  await StorageManager.set({ highlightMinLen: val });
  flashSaved();
});

// Button position
$('button-position').addEventListener('change', async (e) => {
  await StorageManager.set({ buttonPosition: e.target.value });
  flashSaved();
});

// Show/hide button
$('button-visible').addEventListener('change', async (e) => {
  await StorageManager.set({ buttonVisible: e.target.checked });
  flashSaved();
});

// Reading speed
$('reading-speed').addEventListener('input', async (e) => {
  const val = parseInt(e.target.value);
  $('reading-speed-val').textContent = `${val} wpm`;
  await StorageManager.set({ readingSpeed: val });
  flashSaved();
});

// Blocked domains
let domainSaveTimer = null;
$('blocked-domains').addEventListener('input', (e) => {
  // Debounce — only save 800ms after the user stops typing
  clearTimeout(domainSaveTimer);
  domainSaveTimer = setTimeout(async () => {
    const raw     = e.target.value;
    const domains = raw
      .split('\n')
      .map(d => d.trim().toLowerCase())
      .filter(d => d.length > 0 && d.includes('.'));
    await StorageManager.set({ blockedDomains: domains });
    flashSaved(`✓ Saved ${domains.length} domain${domains.length !== 1 ? 's' : ''}`);
  }, 800);
});

// ── 4. OPTIONAL PERMISSIONS (Warm Ask Pattern) ───────────────
//
// We do NOT request permissions at install time.
// The user sees a card explaining the feature and why the
// permission is needed BEFORE we call chrome.permissions.request().
// This is the "warm ask" pattern: educate first, then ask.
//
// Key insight: chrome.permissions.request() MUST be called from
// a user gesture (a click event). You cannot call it programmatically
// at page load — Chrome will reject it silently.
//

async function checkAllPermissions() {
  for (const perm of ['tabs', 'bookmarks', 'history']) {
    await checkPermission(perm);
  }
}

async function checkPermission(name) {
  const granted = await chrome.permissions.contains({ permissions: [name] });
  updatePermissionUI(name, granted);
}

function updatePermissionUI(name, granted) {
  const btn    = $(`btn-grant-${name}`);
  const status = $(`status-${name}`);

  if (!btn || !status) return;

  if (granted) {
    btn.textContent = 'Revoke';
    btn.classList.add('revoke');
    status.textContent = '✓ Granted';
    status.classList.add('granted');
  } else {
    btn.textContent = 'Grant';
    btn.classList.remove('revoke');
    status.textContent = 'Not granted';
    status.classList.remove('granted');
  }
}

// Wire up each permission button
['tabs', 'bookmarks', 'history'].forEach(perm => {
  const btn = $(`btn-grant-${perm}`);
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const alreadyGranted = await chrome.permissions.contains({ permissions: [perm] });

    if (alreadyGranted) {
      // Revoke
      const removed = await chrome.permissions.remove({ permissions: [perm] });
      if (removed) {
        updatePermissionUI(perm, false);
        flashSaved(`✓ "${perm}" permission revoked`);
      }
    } else {
      // Request — MUST be from a user gesture (click handler ✓)
      // Chrome shows a native permission dialog here.
      // The user can Accept or Cancel. We handle both outcomes.
      try {
        const granted = await chrome.permissions.request({ permissions: [perm] });
        updatePermissionUI(perm, granted);
        if (granted) {
          flashSaved(`✓ "${perm}" permission granted`);
        } else {
          // User cancelled the Chrome permission dialog
          flashSaved(`Permission request cancelled`);
        }
      } catch (err) {
        // Most common cause: called outside a user gesture
        console.error('[NeuralTab] Permission request failed:', err);
        flashSaved('Permission request failed');
      }
    }
  });
});

// ── 5. STORAGE QUOTA ─────────────────────────────────────────
async function loadQuota(settings) {
  const quota = await StorageManager.getQuota();
  $('quota-used').textContent       = quota.usedHuman;
  $('quota-total').textContent      = `of ${quota.totalHuman}`;
  $('quota-bar-fill').style.width   = `${Math.min(quota.percent, 100)}%`;
  $('quota-percent').textContent    = `${quota.percent}% used`;
}

// ── 6. RESET ─────────────────────────────────────────────────
$('btn-reset').addEventListener('click', async () => {
  const confirmed = window.confirm(
    'Reset ALL NeuralTab settings to defaults?\n\nThis cannot be undone.'
  );
  if (!confirmed) return;

  await StorageManager.reset();
  await loadSettings(); // repopulate all controls with defaults
  flashSaved('✓ All settings reset to defaults');
});

// ── 7. EXPORT ─────────────────────────────────────────────────
$('btn-export').addEventListener('click', async () => {
  const settings = await StorageManager.get();
  const json     = JSON.stringify(settings, null, 2);
  const blob     = new Blob([json], { type: 'application/json' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = `neuraltab-settings-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  flashSaved('✓ Settings exported');
});

// ── 8. REACT TO LIVE STORAGE CHANGES ─────────────────────────
// If the user opens the options page in two tabs simultaneously
// (unlikely but possible), changes in one tab reflect instantly
// in the other via this listener.
StorageManager.onChange((changes) => {
  if (changes.highlightColor) {
    const color = changes.highlightColor.newValue;
    $('highlight-color').value = color;
    $('color-hex').textContent = color;
    updatePreview(color);
  }
  if (changes.buttonVisible) {
    $('button-visible').checked = changes.buttonVisible.newValue;
  }
  if (changes.readingSpeed) {
    const val = changes.readingSpeed.newValue;
    $('reading-speed').value = val;
    $('reading-speed-val').textContent = `${val} wpm`;
  }
});

// ── Bootstrap ─────────────────────────────────────────────────
loadSettings();
