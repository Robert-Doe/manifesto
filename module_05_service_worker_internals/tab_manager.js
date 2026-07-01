// NeuralTab — tab_manager.js (Module 05 — adds last-access time display from tabAccessTimes)

'use strict';

let allTabs       = [];
let tabAccessTimes = {};
let filterIdle    = false;
let filterAudible = false;

async function init() {
  const hasPermission = await chrome.permissions.contains({ permissions: ['tabs'] });
  if (!hasPermission) {
    document.getElementById('permission-banner').classList.add('visible');
    renderEmptyState('Grant the tabs permission above to view your open tabs.');
    return;
  }
  document.getElementById('permission-banner').classList.remove('visible');
  // Load last-access times from storage (written by background.js onActivated listener)
  const s = await StorageManager.get(['tabAccessTimes']);
  tabAccessTimes = s.tabAccessTimes || {};
  await loadTabs();
  wireControls();
}

async function loadTabs() {
  showLoading();
  allTabs = await chrome.tabs.query({});
  renderStats();
  renderTabGroups();
}

function showLoading() {
  document.getElementById('tab-groups-container').innerHTML =
    '<div class="loading-state"><span class="spinner">⟳</span>Loading tabs…</div>';
}
function renderEmptyState(msg) {
  document.getElementById('tab-groups-container').innerHTML =
    `<div class="empty-state"><span class="empty-icon">📭</span>${msg}</div>`;
}

function renderStats() {
  const domains   = new Set(allTabs.map(t => extractDomain(t.url)));
  const idleCount = allTabs.filter(t => !t.active && !t.audible && !t.pinned).length;
  document.getElementById('stat-total').textContent   = allTabs.length;
  document.getElementById('stat-domains').textContent = domains.size;
  document.getElementById('stat-idle').textContent    = idleCount;
  document.getElementById('stat-pinned').textContent  = allTabs.filter(t => t.pinned).length;
}

function renderTabGroups() {
  let tabs = [...allTabs];
  if (filterIdle)    tabs = tabs.filter(t => !t.active && !t.audible && !t.pinned);
  if (filterAudible) tabs = tabs.filter(t => t.audible);

  const groups = new Map();
  for (const tab of tabs) {
    const domain = extractDomain(tab.url);
    if (!groups.has(domain)) groups.set(domain, []);
    groups.get(domain).push(tab);
  }

  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  const container = document.getElementById('tab-groups-container');
  container.innerHTML = '';

  if (!sorted.length) { renderEmptyState('No tabs match your current filter.'); return; }
  for (const [domain, domainTabs] of sorted) container.appendChild(buildGroupEl(domain, domainTabs));
}

function buildGroupEl(domain, tabs) {
  const group  = document.createElement('div');
  group.className = 'tab-group';

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
    </div>`;

  const tabList = document.createElement('div');
  tabList.className = 'tab-list';
  header.addEventListener('click', e => {
    if (e.target.closest('button')) return;
    tabList.style.display = tabList.style.display === 'none' ? '' : 'none';
  });
  for (const tab of tabs) tabList.appendChild(buildTabEl(tab));

  header.querySelector('.btn-group-tabs').addEventListener('click', async e => {
    e.stopPropagation();
    await chrome.runtime.sendMessage({ action: 'groupTabsByDomain', tabIds: tabs.map(t => t.id), domain });
    await loadTabs();
  });
  header.querySelector('.btn-close-domain').addEventListener('click', async e => {
    e.stopPropagation();
    if (!confirm(`Close all ${tabs.length} tab(s) from ${domain}?`)) return;
    await chrome.tabs.remove(tabs.map(t => t.id));
    await loadTabs();
  });

  group.appendChild(header);
  group.appendChild(tabList);
  return group;
}

function buildTabEl(tab) {
  const isActive  = tab.active;
  const isAudible = tab.audible;
  const isIdle    = !tab.active && !tab.audible && !tab.pinned;
  const isPinned  = tab.pinned;

  // Module 05: last-access time from background's tabAccessTimes
  const lastAccess = tabAccessTimes[tab.id];
  const agoMs      = lastAccess ? Date.now() - lastAccess : null;
  const agoMin     = agoMs ? Math.floor(agoMs / 60000) : null;
  const isStale    = agoMin !== null && agoMin > 30;

  let itemClass = 'tab-item';
  if (isActive)  itemClass += ' active-tab';
  else if (isAudible) itemClass += ' audible-tab';
  else if (isIdle)    itemClass += ' idle-tab';

  const el = document.createElement('div');
  el.className = itemClass;
  el.dataset.tabId = tab.id;

  // Favicon
  let favicon;
  if (tab.favIconUrl) {
    favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    favicon.src = tab.favIconUrl;
    favicon.onerror = () => favicon.replaceWith(placeholderFavicon());
  } else {
    favicon = placeholderFavicon();
  }

  // Info + last-access
  const info = document.createElement('div');
  info.className = 'tab-info';
  const lastAccessHtml = lastAccess
    ? `<div class="tab-last-access${isStale ? ' stale' : ''}">Last active: ${agoMin === 0 ? 'just now' : `${agoMin}m ago`}${isStale ? ' ⚠' : ''}</div>`
    : '';
  info.innerHTML = `
    <div class="tab-title">${escHtml(tab.title || '(no title)')}</div>
    <div class="tab-url">${escHtml(tab.url || '')}</div>
    ${lastAccessHtml}`;

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
    await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
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
    el.style.opacity = '0.3'; el.style.pointerEvents = 'none';
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

async function closeAllIdleTabs() {
  const idleTabs = allTabs.filter(t => !t.active && !t.audible && !t.pinned);
  if (!idleTabs.length) { alert('No idle tabs found.'); return; }
  if (!confirm(`Close ${idleTabs.length} idle tab(s)?`)) return;
  await chrome.tabs.remove(idleTabs.map(t => t.id));
  await loadTabs();
}

async function groupAllByDomain() {
  const domainMap = new Map();
  for (const tab of allTabs) {
    const d = extractDomain(tab.url);
    if (!domainMap.has(d)) domainMap.set(d, []);
    domainMap.get(d).push(tab.id);
  }
  for (const [domain, tabIds] of domainMap) {
    if (tabIds.length < 2) continue;
    await chrome.runtime.sendMessage({ action: 'groupTabsByDomain', tabIds, domain });
  }
  await loadTabs();
}

async function searchHistory(query) {
  const hasHistory = await chrome.permissions.contains({ permissions: ['history'] });
  const container  = document.getElementById('history-results');
  if (!hasHistory) { container.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:6px;">Grant history permission in Settings → Permissions.</div>'; return; }
  const results = await chrome.history.search({ text: query, maxResults: 10 });
  container.innerHTML = '';
  if (!results.length) { container.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:6px;">No results.</div>'; return; }
  for (const item of results) {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.title = item.url;
    el.innerHTML = `<div>${escHtml(item.title || item.url)}</div><div class="history-url">${escHtml(item.url)}</div>`;
    el.addEventListener('click', () => chrome.tabs.create({ url: item.url }));
    container.appendChild(el);
  }
}

async function loadRecentBookmarks() {
  const hasBookmarks = await chrome.permissions.contains({ permissions: ['bookmarks'] });
  const container    = document.getElementById('bookmark-results');
  if (!hasBookmarks) { container.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:6px;">Grant bookmarks permission in Settings → Permissions.</div>'; return; }
  const results = await chrome.bookmarks.getRecent(10);
  container.innerHTML = '';
  for (const bm of results) {
    if (!bm.url) continue;
    const el = document.createElement('div');
    el.className = 'bookmark-item';
    el.title = bm.url;
    el.innerHTML = `<div>★ ${escHtml(bm.title || bm.url)}</div><div class="bookmark-url">${escHtml(bm.url)}</div>`;
    el.addEventListener('click', () => chrome.tabs.create({ url: bm.url }));
    container.appendChild(el);
  }
}

async function bookmarkTab(tab) {
  const hasBookmarks = await chrome.permissions.contains({ permissions: ['bookmarks'] });
  if (!hasBookmarks) { alert('Grant bookmarks permission in Settings → Permissions.'); return; }
  const { bookmarkFolderName } = await StorageManager.get(['bookmarkFolderName']);
  const results = await chrome.bookmarks.search({ title: bookmarkFolderName });
  const folder  = results.find(r => !r.url) || await chrome.bookmarks.create({ title: bookmarkFolderName });
  await chrome.bookmarks.create({ parentId: folder.id, title: tab.title || tab.url, url: tab.url });
  const btn = document.querySelector(`[data-tab-id="${tab.id}"] .tab-action-btn:nth-child(2)`);
  if (btn) { btn.textContent = '✓ Saved'; btn.style.color = 'var(--green)'; }
}

function wireControls() {
  document.getElementById('btn-refresh').addEventListener('click', loadTabs);
  document.getElementById('btn-close-idle').addEventListener('click', closeAllIdleTabs);
  document.getElementById('btn-group-domains').addEventListener('click', groupAllByDomain);
  document.getElementById('filter-idle').addEventListener('change', e => { filterIdle = e.target.checked; renderTabGroups(); });
  document.getElementById('filter-audible').addEventListener('change', e => { filterAudible = e.target.checked; renderTabGroups(); });
  document.getElementById('btn-history-search').addEventListener('click', () => {
    const q = document.getElementById('history-search').value.trim();
    if (q) searchHistory(q);
  });
  document.getElementById('history-search').addEventListener('keydown', e => {
    if (e.key === 'Enter') { const q = e.target.value.trim(); if (q) searchHistory(q); }
  });
  document.getElementById('btn-load-bookmarks').addEventListener('click', loadRecentBookmarks);
  document.getElementById('btn-grant-tabs').addEventListener('click', async () => {
    const granted = await chrome.permissions.request({ permissions: ['tabs'] });
    if (granted) init();
  });
}

function extractDomain(url) {
  if (!url) return '(unknown)';
  try {
    const u = new URL(url);
    if (u.protocol === 'chrome:') return 'chrome://';
    if (u.protocol === 'chrome-extension:') return 'extension://';
    return u.hostname || url;
  } catch { return url.slice(0, 40); }
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
