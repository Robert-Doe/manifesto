// NeuralTab — options.js (Module 07)
'use strict';

// ── Navigation ───────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`section-${btn.dataset.section}`).classList.add('active');
    if (btn.dataset.section === 'storage') loadStorageSection();
    if (btn.dataset.section === 'messages') loadMessagesSection();
    if (btn.dataset.section === 'sw') loadSwSection();
    if (btn.dataset.section === 'permissions') loadPermissions();
  });
});

// ── General ──────────────────────────────────────────────────────────────────
async function initGeneral() {
  const s = await StorageManager.get(['theme', 'fontSize', 'showWordCount', 'bookmarkFolderName']);
  document.getElementById('opt-theme').value           = s.theme || 'dark';
  document.getElementById('opt-fontsize').value        = s.fontSize || 14;
  document.getElementById('opt-fontsize-val').textContent = `${s.fontSize || 14}px`;
  document.getElementById('opt-wordcount').checked     = s.showWordCount !== false;
  document.getElementById('opt-bookmark-folder').value = s.bookmarkFolderName || 'NeuralTab Saves';

  document.getElementById('opt-fontsize').addEventListener('input', e =>
    document.getElementById('opt-fontsize-val').textContent = `${e.target.value}px`);

  document.getElementById('btn-save-general').addEventListener('click', async () => {
    await StorageManager.set({
      theme:              document.getElementById('opt-theme').value,
      fontSize:           parseInt(document.getElementById('opt-fontsize').value),
      showWordCount:      document.getElementById('opt-wordcount').checked,
      bookmarkFolderName: document.getElementById('opt-bookmark-folder').value.trim()
    });
    const s = document.getElementById('save-status-general');
    s.textContent = '✓ Saved'; setTimeout(() => s.textContent = '', 2000);
  });
}

// ── Storage ──────────────────────────────────────────────────────────────────
async function loadStorageSection() {
  const q = await StorageManager.getQuotaInfo();
  document.getElementById('sq-used').textContent   = `${q.usedKB} KB / ${q.quotaKB} KB`;
  document.getElementById('sq-bar').style.width    = `${Math.min(q.pct, 100)}%`;
  document.getElementById('sq-detail').textContent = `${q.pct}% of local storage quota used`;

  const stats = await chrome.runtime.sendMessage({ action: 'getHistoryStats' });
  if (!stats.error) {
    document.getElementById('idb-stats').textContent =
      `IndexedDB: ${stats.totalVisits.toLocaleString()} / ${stats.maxVisits.toLocaleString()} visits stored`;
  }

  document.getElementById('btn-refresh-storage').addEventListener('click', loadStorageSection);
  document.getElementById('btn-open-history').addEventListener('click', () =>
    chrome.tabs.create({ url: chrome.runtime.getURL('history_db.html') }));
}

// ── Messages ─────────────────────────────────────────────────────────────────
async function loadMessagesSection() {
  const s = await StorageManager.get(['messageCount', 'demoCounter', 'activeStreams', 'messageLog']);
  document.getElementById('ms-count').textContent   = s.messageCount || 0;
  document.getElementById('ms-counter').textContent = s.demoCounter || 0;
  document.getElementById('ms-streams').textContent = s.activeStreams || 0;
  renderMsgLog(s.messageLog || []);

  document.getElementById('btn-refresh-log').addEventListener('click', loadMessagesSection);
  document.getElementById('btn-open-lab').addEventListener('click', () =>
    chrome.tabs.create({ url: chrome.runtime.getURL('message_lab.html') }));
  document.getElementById('btn-clear-log').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'clearMessageLog' });
    loadMessagesSection();
  });
}

function renderMsgLog(log) {
  const c = document.getElementById('msg-log');
  c.innerHTML = '';
  const recent = log.slice(-20).reverse();
  for (const e of recent) {
    const row = document.createElement('div');
    row.className = 'log-entry';
    const t = new Date(e.ts).toLocaleTimeString();
    row.innerHTML = `<span class="dir-${e.dir === 'IN' ? 'in' : 'out'}">${e.dir}</span> [${t}] ${escHtml(e.action)} <span style="color:var(--muted)">${escHtml(e.context)}</span>`;
    c.appendChild(row);
  }
  if (!recent.length) c.textContent = 'No messages yet.';
}

// ── SW ───────────────────────────────────────────────────────────────────────
async function loadSwSection() {
  const s = await StorageManager.get(['swStartCount', 'swLifecycleLog']);
  document.getElementById('sw-starts').textContent    = s.swStartCount || 0;
  document.getElementById('sw-log-count').textContent = (s.swLifecycleLog || []).length;

  const c = document.getElementById('sw-log');
  c.innerHTML = '';
  const log = (s.swLifecycleLog || []).slice(-20).reverse();
  for (const e of log) {
    const row = document.createElement('div');
    row.className = 'log-entry';
    row.innerHTML = `<span style="color:var(--purple)">${escHtml(e.event)}</span> <span style="color:var(--muted)">${new Date(e.ts).toLocaleTimeString()}</span> ${escHtml(e.detail || '')}`;
    c.appendChild(row);
  }
  if (!log.length) c.textContent = 'No lifecycle events yet.';

  document.getElementById('btn-open-swmon').addEventListener('click', () =>
    chrome.tabs.create({ url: chrome.runtime.getURL('sw_monitor.html') }));
}

// ── Permissions ──────────────────────────────────────────────────────────────
async function loadPermissions() {
  const perms = [
    { name: 'storage',          icon: '💾', optional: false },
    { name: 'alarms',           icon: '⏰', optional: false },
    { name: 'scripting',        icon: '📜', optional: false },
    { name: 'tabs',             icon: '🗂️',  optional: true  },
    { name: 'history',          icon: '📖', optional: true  },
    { name: 'bookmarks',        icon: '⭐', optional: true  },
    { name: 'tabGroups',        icon: '📁', optional: false },
    { name: 'unlimitedStorage', icon: '🗄️',  optional: false }
  ];
  const grid = document.getElementById('perm-grid');
  grid.innerHTML = '';
  for (const p of perms) {
    const granted = await chrome.permissions.contains({ permissions: [p.name] }).catch(() => false);
    const card = document.createElement('div');
    card.className = 'perm-card';
    card.innerHTML = `<div class="perm-icon">${p.icon}</div><div>
      <div class="perm-name">${p.name}</div>
      <div class="perm-status ${granted ? 'granted' : 'optional'}">${granted ? '✓ Granted' : '○ Not granted'}</div>
    </div>`;
    grid.appendChild(card);
  }
}

// ── Live updates ─────────────────────────────────────────────────────────────
StorageManager.onChange(changes => {
  if (changes.messageCount    !== undefined) document.getElementById('ms-count').textContent   = changes.messageCount;
  if (changes.demoCounter     !== undefined) document.getElementById('ms-counter').textContent = changes.demoCounter;
  if (changes.activeStreams   !== undefined) document.getElementById('ms-streams').textContent = changes.activeStreams;
  if (changes.messageLog      !== undefined) renderMsgLog(changes.messageLog || []);
});

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

initGeneral();
