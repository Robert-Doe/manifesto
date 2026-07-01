// NeuralTab — idb_manager.js (Module 07 — new)
// IndexedDB wrapper for neuraltab-history database

'use strict';

const IDBManager = (() => {
  const DB_NAME    = 'neuraltab-history';
  const DB_VERSION = 1;
  const STORE_VISITS = 'page_visits';
  const MAX_VISITS   = 10000;

  let _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_VISITS)) {
          const store = db.createObjectStore(STORE_VISITS, {
            keyPath: 'id', autoIncrement: true
          });
          store.createIndex('url',       'url',       { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('domain',    'domain',    { unique: false });
        }
      };

      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror   = e => reject(e.target.error);
    });
  }

  function tx(storeName, mode = 'readonly') {
    return open().then(db => db.transaction(storeName, mode).objectStore(storeName));
  }

  function idbReq(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function addVisit(visit) {
    const store = await tx(STORE_VISITS, 'readwrite');
    // Enforce MAX_VISITS cap: delete oldest if over limit
    const count = await idbReq(store.count());
    if (count >= MAX_VISITS) {
      const cursor = await idbReq(store.openCursor());
      if (cursor) await idbReq(cursor.delete());
    }
    visit.timestamp = visit.timestamp || Date.now();
    visit.domain    = extractDomain(visit.url);
    return idbReq(store.add(visit));
  }

  async function searchVisits({ query = '', domain = '', limit = 50, offset = 0 } = {}) {
    const store = await tx(STORE_VISITS, 'readonly');
    const all   = [];
    const q     = query.toLowerCase();

    await new Promise((resolve, reject) => {
      // Open cursor in reverse order (newest first)
      const req = store.index('timestamp').openCursor(null, 'prev');
      req.onsuccess = e => {
        const cursor = e.target.result;
        if (!cursor) { resolve(); return; }
        const v = cursor.value;
        const matchQ = !q || v.url.toLowerCase().includes(q) || (v.title || '').toLowerCase().includes(q);
        const matchD = !domain || v.domain === domain;
        if (matchQ && matchD) all.push(v);
        cursor.continue();
      };
      req.onerror = e => reject(e.target.error);
    });

    return { total: all.length, results: all.slice(offset, offset + limit) };
  }

  async function getStats() {
    const store  = await tx(STORE_VISITS, 'readonly');
    const count  = await idbReq(store.count());
    const domains = {};

    await new Promise((resolve, reject) => {
      const req = store.openCursor();
      req.onsuccess = e => {
        const cursor = e.target.result;
        if (!cursor) { resolve(); return; }
        const d = cursor.value.domain;
        domains[d] = (domains[d] || 0) + 1;
        cursor.continue();
      };
      req.onerror = e => reject(e.target.error);
    });

    const topDomains = Object.entries(domains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }));

    return { totalVisits: count, maxVisits: MAX_VISITS, topDomains };
  }

  async function clearAll() {
    const store = await tx(STORE_VISITS, 'readwrite');
    return idbReq(store.clear());
  }

  async function deleteVisit(id) {
    const store = await tx(STORE_VISITS, 'readwrite');
    return idbReq(store.delete(id));
  }

  function extractDomain(url) {
    if (!url) return '(unknown)';
    try {
      const u = new URL(url);
      return u.hostname || '(unknown)';
    } catch { return '(unknown)'; }
  }

  return { open, addVisit, searchVisits, getStats, clearAll, deleteVisit };
})();
