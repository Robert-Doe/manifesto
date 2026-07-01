// NeuralTab — history_db.js (Module 07)
'use strict';

const PAGE_SIZE  = 25;
let currentPage  = 0;
let currentQuery = {};

async function init() {
  await loadStats();
  await search({});

  document.getElementById('btn-search').addEventListener('click', () => {
    const q = document.getElementById('search-input').value.trim();
    currentPage = 0;
    search({ query: q });
  });
  document.getElementById('search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-search').click();
  });
  document.getElementById('btn-all').addEventListener('click', () => {
    document.getElementById('search-input').value = '';
    currentPage = 0;
    search({});
  });
  document.getElementById('btn-clear').addEventListener('click', async () => {
    if (!confirm('Delete all browsing history from NeuralTab? This cannot be undone.')) return;
    await chrome.runtime.sendMessage({ action: 'clearHistory' });
    await loadStats();
    await search({});
  });
  document.getElementById('btn-export').addEventListener('click', exportHistory);
}

async function loadStats() {
  const stats = await chrome.runtime.sendMessage({ action: 'getHistoryStats' });
  if (stats.error) return;
  document.getElementById('stat-total').textContent = stats.totalVisits.toLocaleString();
  const pct = Math.min((stats.totalVisits / stats.maxVisits) * 100, 100);
  document.getElementById('cap-bar').style.width = pct + '%';

  const container = document.getElementById('top-domains');
  container.innerHTML = '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">Top Domains</div>';
  for (const { domain, count } of stats.topDomains) {
    const row = document.createElement('div');
    row.className = 'domain-row';
    row.innerHTML = `<div class="domain-name">${escHtml(domain)}</div><div class="domain-count">${count} visits</div>`;
    row.addEventListener('click', () => {
      document.getElementById('search-input').value = '';
      currentPage = 0;
      search({ domain });
    });
    container.appendChild(row);
  }
}

async function search(query) {
  currentQuery = query;
  const result = await chrome.runtime.sendMessage({
    action: 'searchHistory',
    query:  { ...query, limit: PAGE_SIZE, offset: currentPage * PAGE_SIZE }
  });
  if (result.error) { showError(result.error); return; }
  renderResults(result.results, result.total);
}

function renderResults(visits, total) {
  const info = document.getElementById('results-info');
  info.textContent = `${total.toLocaleString()} result${total !== 1 ? 's' : ''}`;

  const list = document.getElementById('results-list');
  list.innerHTML = '';

  if (!visits.length) {
    list.innerHTML = '<div class="empty-state">No history yet. Browse some pages with the extension active.</div>';
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  const start = currentPage * PAGE_SIZE;
  visits.forEach((v, i) => {
    const el    = document.createElement('div');
    el.className = 'visit-item';
    const ago    = formatAgo(v.timestamp);
    el.innerHTML = `
      <div class="visit-num">#${start + i + 1}</div>
      <div class="visit-body">
        <div class="visit-title">${escHtml(v.title || v.url)}</div>
        <div class="visit-url">${escHtml(v.url)}</div>
        <div class="visit-meta">
          <span>${ago}</span>
          ${v.wordCount ? `<span>${v.wordCount.toLocaleString()} words</span>` : ''}
          <span>${escHtml(v.domain)}</span>
        </div>
      </div>
      <button class="visit-delete" title="Delete">✕</button>`;
    el.querySelector('.visit-url').addEventListener('click', () => chrome.tabs.create({ url: v.url }));
    el.querySelector('.visit-delete').addEventListener('click', async () => {
      await IDBManager.deleteVisit(v.id);
      el.remove();
      await loadStats();
    });
    list.appendChild(el);
  });

  renderPagination(total);
}

function renderPagination(total) {
  const pages = Math.ceil(total / PAGE_SIZE);
  const pag   = document.getElementById('pagination');
  pag.innerHTML = '';
  if (pages <= 1) return;

  for (let i = 0; i < Math.min(pages, 10); i++) {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (i === currentPage ? ' active' : '');
    btn.textContent = i + 1;
    btn.addEventListener('click', () => { currentPage = i; search(currentQuery); });
    pag.appendChild(btn);
  }
}

async function exportHistory() {
  const result = await chrome.runtime.sendMessage({ action: 'searchHistory', query: { limit: 10000 } });
  const data   = JSON.stringify(result.results, null, 2);
  const blob   = new Blob([data], { type: 'application/json' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href = url; a.download = `neuraltab-history-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showError(msg) {
  document.getElementById('results-list').innerHTML = `<div class="empty-state" style="color:var(--red)">${escHtml(msg)}</div>`;
}

init();
