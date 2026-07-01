// NeuralTab — network_monitor.js (Module 09)
'use strict';

let events = [], blockedCount = 0, navCount = 0;
let filterType = 'all';

async function init() {
  await loadRules();
  StorageManager.onChange(changes => {
    if (changes.networkEvents) renderEvents(changes.networkEvents || []);
    if (changes.networkBlocked !== undefined) {
      blockedCount = changes.networkBlocked;
      document.getElementById('stat-blocked').textContent = blockedCount;
    }
  });
  const s = await StorageManager.get(['networkEvents','networkBlocked']);
  events = s.networkEvents || [];
  blockedCount = s.networkBlocked || 0;
  document.getElementById('stat-blocked').textContent = blockedCount;
  renderEvents(events);

  document.getElementById('btn-clear').addEventListener('click', async () => {
    await StorageManager.set({ networkEvents: [], networkBlocked: 0 });
    events = []; blockedCount = 0;
    document.getElementById('stat-blocked').textContent = 0;
    document.getElementById('event-log').innerHTML = '<div class="empty-state">Cleared.</div>';
    document.getElementById('event-count').textContent = '0 events';
  });
  document.getElementById('btn-reload-rules').addEventListener('click', loadRules);
  document.getElementById('filter-type').addEventListener('change', e => {
    filterType = e.target.value; renderEvents(events);
  });
  document.getElementById('tog-block').addEventListener('change', async e => {
    if (e.target.checked) {
      await chrome.declarativeNetRequest.enableRulesets(['neuraltab_rules']);
    } else {
      await chrome.declarativeNetRequest.disableRulesets(['neuraltab_rules']);
    }
  });
}

async function loadRules() {
  try {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    const static_rules = await chrome.declarativeNetRequest.getSessionRules();
    const allRules = rules.concat(static_rules);
    document.getElementById('stat-rules').textContent = allRules.length || '5';
    renderRules();
  } catch (e) {
    document.getElementById('stat-rules').textContent = '5';
    renderRules();
  }
}

function renderRules() {
  const list = document.getElementById('rule-list');
  const rules = [
    { action: 'block', filter: '||doubleclick.net^' },
    { action: 'block', filter: '||googlesyndication.com^' },
    { action: 'block', filter: '||adservice.google.com^' },
    { action: 'headers', filter: '||example.com^ → X-NeuralTab-Version' },
    { action: 'redirect', filter: 'google.com/search → duckduckgo' }
  ];
  list.innerHTML = '';
  for (const r of rules) {
    const el = document.createElement('div');
    el.className = 'rule-item';
    const cls = r.action === 'block' ? 'r-block' : r.action === 'redirect' ? 'r-redirect' : 'r-headers';
    el.innerHTML = `<div class="r-action ${cls}">${r.action}</div><div class="r-filter">${escHtml(r.filter)}</div>`;
    list.appendChild(el);
  }
}

function renderEvents(evts) {
  navCount = evts.filter(e => e.type === 'beforenavigate').length;
  document.getElementById('stat-nav').textContent = navCount;
  const filtered = filterType === 'all' ? evts : evts.filter(e => e.type === filterType);
  document.getElementById('event-count').textContent = `${filtered.length} events`;
  const log = document.getElementById('event-log');
  log.innerHTML = '';
  if (!filtered.length) { log.innerHTML = '<div class="empty-state">No events match filter.</div>'; return; }
  for (const ev of [...filtered].reverse().slice(0, 200)) {
    const row = document.createElement('div');
    row.className = 'event-row';
    row.innerHTML = `<span class="ev-time">${new Date(ev.ts).toLocaleTimeString()}</span>
      <span class="ev-type type-${ev.type}">${ev.type}</span>
      <span class="ev-url" title="${escHtml(ev.url)}">${escHtml(ev.url)}</span>`;
    log.appendChild(row);
  }
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

init();
