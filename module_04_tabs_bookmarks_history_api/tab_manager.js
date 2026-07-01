// NeuralTab — tab_manager.js (Module 04)
// Full tab manager: reads all open tabs, groups by domain, shows history and bookmarks.

'use strict';

// ─── State ──────────────────────────────────────────────────────────────────

let allTabs      = [];
let filterIdle   = false;
let filterAudible = false;

// ─── Init ───────────────────────────────────────────────────────────────────

async function init() {
  const hasPermission = await chrome.permissions.contains({ permissions: ['tabs'] });
  if (!hasPermission) {
    document.getElementById('permission-banner').classList.add('visible');
    renderEmptyState('Grant the tabs permission above to view your open tabs.');
    return;
  }
  document.getElementById('permission-banner').classList.remove('visible');
  await loadTabs();
  wireControls();
}

// ─── Load & Render Tabs ─────────────────────────────────────────────────────

async function loadTabs() {
  showLoading();
  allTabs = await chrome.tabs.query({});
  renderStats();
  renderTabGroups();
}

function showLoading() {
  const container = document.getElementById('tab-groups-container');
  container.innerHTML = '<div class="loading-state"><span class="spinner">⟳</span>Loading tabs…</div>';
}

function renderEmptyState(msg) {
  const container = document.getElementById('tab-groups-container');
  container.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span>${msg}</div>`;
}

function renderStats() {
  const domains   = new Set(allTabs.map(t => extractDomain(t.url)));
  const idleCount = allTabs.filter(t => !t.active && !t.audible && !t.pinned).length;
  const pinned    = allTabs.filter(t => t.pinned).length;

  document.getElementById('stat-total').textContent   = allTabs.length;
  document.getElementById('stat-domains').textContent = domains.size;
  document.getElementById('stat-idle').textContent    = idleCount;
  document.getElementById('stat-pinned').textContent  = pinned;
}

function renderTabGroups() {
  let tabs = [...allTabs];
  if (filterIdle)    tabs = tabs.filter(t => !t.active && !t.audible && !t.pinned);
  if (filterAudible) tabs = tabs.filter(t => t.audible);

  // Group by domain
  const groups = new Map();
  for (const tab of tabs) {
    const domain = extractDomain(tab.url);
    if (!groups.has(domain)) groups.set(domain, []);
    groups.get(domain).push(tab);
  }

  // Sort groups: most tabs first
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  const container = document.getElementById('tab-groups-container');
  container.innerHTML = '';

  if (sorted.length === 0) {
    renderEmptyState('No tabs match your current filter.');
    return;
  }

  for (const [domain, domainTabs] of sorted) {
    container.appendChild(buildGroupEl(domain, domainTabs));
  }
}

function buildGroupEl(domain, tabs) {
  const group = document.createElement('div');
  group.className = 'tab-group';

  // Header
  const header = document.createElement('div');
  header.className = 'tab-group-header';
  header.innerHTML = `
    <span class="tab-group-domain">${escHtml(domain)}</span>
    <div style="display:flex;gap:8px;align-items:center;">
      <span class="tab-group-count">${tabs.length} tab${tabs.length !== 1 ? 's' : ''}</span>
      <div class="tab-group-actions">
        <button class="btn btn-sm btn-ghost btn-group-tabs" data-domain="${escHtml(domain)}">Group</button>
        <button class="btn btn-sm btn-danger btn-close-domain" data-domain="${escHtml(domain)}">Close all</button>
      </div>
    </div>
  `;

  // Collapse toggle
  const tabList = document.createElement('div');
  tabList.className = 'tab-list';
  header.addEventListener('click', (e) => {
    if (e.target.closest('button')) return; // don't collapse when clicking buttons
    tabList.style.display = tabList.style.display === 'none' ? '' : 'none';
  });

  // Tab items
  for (const tab of tabs) {
    tabList.appendChild(buildTabEl(tab));
  }

  // Button handlers
  header.querySelector('.btn-group-tabs').addEventListener('click', async (e) => {
    e.stopPropagation();
    const tabIds = tabs.map(t => t.id);
    await chrome.runtime.sendMessage({ action: 'groupTabsByDomain', tabIds, domain });
    await loadTabs();
  });

  header.querySelector('.btn-close-domain').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm(`Close all ${tabs.length} tab(s) from ${domain}?`)) return;
    const tabIds = tabs.map(t => t.id);
    await chrome.tabs.remove(tabIds);
    await loadTabs();
  });

  group.appendChild(header);
  group.appendChild(tabList);
  return group;
}

function buildTabEl(tab) {
  const isIdle    = !tab.active && !tab.audible && !tab.pinned;
  const isActive  = tab.active;
  const isAudible = tab.audible;
  const isPinned  = tab.pinned;

  let itemClass = 'tab-item';
  if (isActive)  itemClass += ' active-tab';
  else if (isAudible) itemClass += ' audible-tab';
  else if (isIdle)    itemClass += ' idle-tab';

  const el = document.createElement('div');
  el.className = itemClass;
  el.dataset.tabId = tab.id;

  // Favicon
  const favicon = document.createElement(tab.favIconUrl ? 'img' : 'div');
  if (tab.favIconUrl) {
    favicon.className = 'tab-favicon';
    favicon.src = tab.favIconUrl;
    favicon.onerror = () => { favicon.replaceWith(placeholderFavicon()); };
  } else {
    favicon.className = 'tab-favicon-placeholder';
    favicon.textContent = '🌐';
  }

  // Info
  const info = document.createElement('div');
  info.className = 'tab-info';
  info.innerHTML = `
    <div class="tab-title">${escHtml(tab.title || '(no title)')}</div>
    <div class="tab-url">${escHtml(tab.url || '')}</div>
  `;

  // Badges
  const badges = document.createElement('div');
  badges.className = 'tab-badges';
  if (isActive)  badges.innerHTML += '<span class="badge badge-active">active</span>';
  if (isAudible) badges.innerHTML += '<span class="badge badge-audible">♪ audio</span>';
  if (isIdle)    badges.innerHTML += '<span class="badge badge-idle">idle</span>';
  if (isPinned)  badges.innerHTML += '<span class="badge badge-pinned">pinned</span>';

  // Actions
  const actions = document.createElement('div');
  actions.className = 'tab-actions';

  const switchBtn = document.createElement('button');
  switchBtn.className = 'tab-action-btn';
  switchBtn.textContent = 'Switch';
  switchBtn.addEventListener('click', async () => {
    await chrome.tabs.update(tab.id, { active: true });
    const winId = tab.windowId;
    await chrome.windows.update(winId, { focused: true }).catch(() => {});
  });

  const bookmarkBtn = document.createElement('button');
  bookmarkBtn.className = 'tab-action-btn';
  bookmarkBtn.textContent = '★ Save';
  bookmarkBtn.addEventListener('click', () => bookmarkTab(tab));

  const closeBtn = document.createElement('button');
  closeBtn.className = 'tab-action-btn close-btn';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', async () => {
    await chrome.tabs.remove(tab.id);
    el.style.opacity = '0.3';
    el.style.pointerEvents = 'none';
    setTimeout(() => el.remove(), 300);
    allTabs = allTabs.filter(t => t.id !== tab.id);
    renderStats();
  });

  actions.appendChild(switchBtn);
  actions.appendChild(bookmarkBtn);
  actions.appendChild(closeBtn);

  el.appendChild(favicon);
  el.appendChild(info);
  el.appendChild(badges);
  el.appendChild(actions);
  return el;
}

function placeholderFavicon() {
  const d = document.createElement('div');
  d.className = 'tab-favicon-placeholder';
  d.textContent = '🌐';
  return d;
}

// ─── Close Idle Tabs ─────────────────────────────────────────────────────────

async function closeAllIdleTabs() {
  const idleTabs = allTabs.filter(t => !t.active && !t.audible && !t.pinned);
  if (idleTabs.length === 0) { alert('No idle tabs found.'); return; }
  if (!confirm(`Close ${idleTabs.length} idle tab(s)?`)) return;
  await chrome.tabs.remove(idleTabs.map(t => t.id));
  await loadTabs();
}

// ─── Group All by Domain ──────────────────────────────────────────────────────

async function groupAllByDomain() {
  const hasPermission = await chrome.permissions.contains({ permissions: ['tabs'] });
  if (!hasPermission) { alert('Tabs permission required.'); return; }

  // Group by domain in bulk
  const domainMap = new Map();
  for (const tab of allTabs) {
    const d = extractDomain(tab.url);
    if (!domainMap.has(d)) domainMap.set(d, []);
    domainMap.get(d).push(tab.id);
  }
  // Only group domains with 2+ tabs
  for (const [domain, tabIds] of domainMap) {
    if (tabIds.length < 2) continue;
    await chrome.runtime.sendMessage({ action: 'groupTabsByDomain', tabIds, domain });
  }
  await loadTabs();
}

// ─── History ─────────────────────────────────────────────────────────────────

async function searchHistory(query) {
  const hasHistory = await chrome.permissions.contains({ permissions: ['history'] });
  if (!hasHistory) {
    document.getElementById('history-results').innerHTML =
      '<div style="color:var(--muted);font-size:12px;padding:6px;">History permission not granted. Grant it in Settings → Permissions.</div>';
    return;
  }

  const results = await chrome.history.search({ text: query, maxResults: 10 });
  const container = document.getElementById('history-results');
  container.innerHTML = '';

  if (results.length === 0) {
    container.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:6px;">No results.</div>';
    return;
  }

  for (const item of results) {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.title = item.url;
    el.innerHTML = `
      <div>${escHtml(item.title || item.url)}</div>
      <div class="history-url">${escHtml(item.url)}</div>
    `;
    el.addEventListener('click', () => chrome.tabs.create({ url: item.url }));
    container.appendChild(el);
  }
}

// ─── Bookmarks ───────────────────────────────────────────────────────────────

async function loadRecentBookmarks() {
  const hasBookmarks = await chrome.permissions.contains({ permissions: ['bookmarks'] });
  if (!hasBookmarks) {
    document.getElementById('bookmark-results').innerHTML =
      '<div style="color:var(--muted);font-size:12px;padding:6px;">Bookmarks permission not granted. Grant it in Settings → Permissions.</div>';
    return;
  }

  // Get recently added bookmarks (search with empty string returns recent ones)
  const results = await chrome.bookmarks.getRecent(10);
  const container = document.getElementById('bookmark-results');
  container.innerHTML = '';

  if (results.length === 0) {
    container.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:6px;">No bookmarks found.</div>';
    return;
  }

  for (const bm of results) {
    if (!bm.url) continue; // skip folders
    const el = document.createElement('div');
    el.className = 'bookmark-item';
    el.title = bm.url;
    el.innerHTML = `
      <div>★ ${escHtml(bm.title || bm.url)}</div>
      <div class="bookmark-url">${escHtml(bm.url)}</div>
    `;
    el.addEventListener('click', () => chrome.tabs.create({ url: bm.url }));
    container.appendChild(el);
  }
}

async function bookmarkTab(tab) {
  const hasBookmarks = await chrome.permissions.contains({ permissions: ['bookmarks'] });
  if (!hasBookmarks) {
    alert('Grant the bookmarks permission in NeuralTab Settings → Permissions to save tabs.');
    return;
  }

  // Find or create the NeuralTab Saves folder
  const { bookmarkFolderName } = await StorageManager.get(['bookmarkFolderName']);
  const searchResults = await chrome.bookmarks.search({ title: bookmarkFolderName });
  let folderId;

  const existingFolder = searchResults.find(r => !r.url); // folders have no url
  if (existingFolder) {
    folderId = existingFolder.id;
  } else {
    const newFolder = await chrome.bookmarks.create({ title: bookmarkFolderName });
    folderId = newFolder.id;
  }

  await chrome.bookmarks.create({
    parentId: folderId,
    title:    tab.title || tab.url,
    url:      tab.url,
  });

  // Flash the button
  const btn = document.querySelector(`[data-tab-id="${tab.id}"] .tab-action-btn:nth-child(2)`);
  if (btn) { btn.textContent = '✓ Saved'; btn.style.color = 'var(--green)'; }
}

// ─── Controls ────────────────────────────────────────────────────────────────

function wireControls() {
  document.getElementById('btn-refresh').addEventListener('click', loadTabs);

  document.getElementById('btn-close-idle').addEventListener('click', closeAllIdleTabs);

  document.getElementById('btn-group-domains').addEventListener('click', groupAllByDomain);

  document.getElementById('filter-idle').addEventListener('change', (e) => {
    filterIdle = e.target.checked;
    renderTabGroups();
  });

  document.getElementById('filter-audible').addEventListener('change', (e) => {
    filterAudible = e.target.checked;
    renderTabGroups();
  });

  document.getElementById('btn-history-search').addEventListener('click', () => {
    const q = document.getElementById('history-search').value.trim();
    if (q) searchHistory(q);
  });
  document.getElementById('history-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      if (q) searchHistory(q);
    }
  });

  document.getElementById('btn-load-bookmarks').addEventListener('click', loadRecentBookmarks);

  document.getElementById('btn-grant-tabs').addEventListener('click', async () => {
    const granted = await chrome.permissions.request({ permissions: ['tabs'] });
    if (granted) init();
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractDomain(url) {
  if (!url) return '(unknown)';
  try {
    const u = new URL(url);
    if (u.protocol === 'chrome:') return 'chrome://';
    if (u.protocol === 'chrome-extension:') return 'extension://';
    return u.hostname || url;
  } catch {
    return url.slice(0, 40);
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Start ───────────────────────────────────────────────────────────────────
init();
