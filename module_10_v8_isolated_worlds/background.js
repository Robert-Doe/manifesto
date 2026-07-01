// NeuralTab — background.js (Module 10)
'use strict';
importScripts('storage_manager.js', 'migration_manager.js', 'idb_manager.js');

// ── Lifecycle ─────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
  const current = chrome.runtime.getManifest().version;
  if (reason === 'install') {
    await StorageManager.set({ swInstallTime: Date.now() });
    await MigrationManager.run(null, current);
  } else if (reason === 'update') {
    const d = await StorageManager.get('swStartCount');
    await StorageManager.set({ swStartCount: (d.swStartCount || 0) + 1 });
    await MigrationManager.run(previousVersion, current);
  }
  console.log(`[NeuralTab] onInstalled reason=${reason} v${current}`);
});

chrome.runtime.onStartup.addListener(async () => {
  const d = await StorageManager.get('swStartCount');
  await StorageManager.set({ swStartCount: (d.swStartCount || 0) + 1 });
  console.log('[NeuralTab] onStartup');
});

// ── webNavigation (Module 09 carry-forward) ───────────────────────────────────
function logNetworkEvent(type, url) {
  StorageManager.get('networkEvents').then(({ networkEvents = [] }) => {
    networkEvents.push({ type, url, ts: Date.now() });
    if (networkEvents.length > 500) networkEvents = networkEvents.slice(-500);
    StorageManager.set({ networkEvents });
  });
}

chrome.webNavigation.onBeforeNavigate.addListener(details => {
  if (details.frameId === 0) logNetworkEvent('beforenavigate', details.url);
});
chrome.webNavigation.onCompleted.addListener(details => {
  if (details.frameId === 0) logNetworkEvent('completed', details.url);
});
chrome.webNavigation.onErrorOccurred.addListener(details => {
  if (details.frameId === 0) logNetworkEvent('error', details.url);
});

// ── Message Router ────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handlers = {
    // Module 07 — IDB history
    logPageVisit:   () => IDBManager.ready().then(m => m.addVisit(msg.visit)),
    searchHistory:  () => IDBManager.ready().then(m => m.searchVisits(msg.query, msg.page)),
    getHistoryStats:() => IDBManager.ready().then(m => m.getStats()),
    clearHistory:   () => IDBManager.ready().then(m => m.clearAll()),
    // Module 08 — migrations
    runMigrations:  () => MigrationManager.run(msg.from, msg.to),
    getMigrationLog:() => StorageManager.get(['migrationLog', 'schemaVersion']),
    // Module 09 — DNR
    getDNRRules:    () => chrome.declarativeNetRequest.getSessionRules(),
    getDynamicRules:() => chrome.declarativeNetRequest.getDynamicRules(),
    getNetworkEvents:() => StorageManager.get('networkEvents'),
    // Storage / quota
    getStorageQuota: () => StorageManager.getQuotaInfo(),
    // Module 10 — world execution (called from world_demo.js via chrome.scripting directly)
    getWorldInfo: () => Promise.resolve({ version: chrome.runtime.getManifest().version }),
  };

  const handler = handlers[msg.type];
  if (!handler) return false;
  handler().then(sendResponse).catch(e => sendResponse({ error: e.message }));
  return true;
});
