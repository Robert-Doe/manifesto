// NeuralTab — background.js (Module 19) — Testing
'use strict';
importScripts('storage_manager.js', 'migration_manager.js', 'idb_manager.js', 'auth_manager.js');

const SW_START = Date.now();

chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
  const current = chrome.runtime.getManifest().version;
  if (reason === 'install') {
    await StorageManager.set({ swInstallTime: Date.now() });
    await MigrationManager.run(null, current);
    if (chrome.sidePanel?.setPanelBehavior) await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } else if (reason === 'update') {
    const d = await StorageManager.get('swStartCount');
    await StorageManager.set({ swStartCount: (d.swStartCount || 0) + 1 });
    await MigrationManager.run(previousVersion, current);
  }
  if (chrome.contextMenus) {
    chrome.contextMenus.create({ id: 'neuraltab-sidepanel', title: 'Open NeuralTab Panel', contexts: ['page'] }).catch(() => {});
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const d = await StorageManager.get('swStartCount');
  await StorageManager.set({ swStartCount: (d.swStartCount || 0) + 1 });
});

function logNetworkEvent(type, url) {
  StorageManager.get('networkEvents').then(({ networkEvents = [] }) => {
    networkEvents.push({ type, url, ts: Date.now() });
    if (networkEvents.length > 500) networkEvents = networkEvents.slice(-500);
    StorageManager.set({ networkEvents });
  });
}
chrome.webNavigation.onBeforeNavigate.addListener(d => { if (d.frameId === 0) logNetworkEvent('beforenavigate', d.url); });
chrome.webNavigation.onCompleted.addListener(d => { if (d.frameId === 0) logNetworkEvent('completed', d.url); });
chrome.webNavigation.onErrorOccurred.addListener(d => { if (d.frameId === 0) logNetworkEvent('error', d.url); });

// Test-instrumented handlers — same as production but with testMode flag support
chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  const h = {
    logPageVisit:    () => IDBManager.ready().then(m => m.addVisit(msg.visit)),
    searchHistory:   () => IDBManager.ready().then(m => m.searchVisits(msg.query, msg.page)),
    getHistoryStats: () => IDBManager.ready().then(m => m.getStats()),
    clearHistory:    () => IDBManager.ready().then(m => m.clearAll()),
    runMigrations:   () => MigrationManager.run(msg.from, msg.to),
    getMigrationLog: () => StorageManager.get(['migrationLog', 'schemaVersion']),
    getStorageQuota: () => StorageManager.getQuotaInfo(),
    getWorldInfo:    () => Promise.resolve({ version: chrome.runtime.getManifest().version, swUptime: Date.now() - SW_START }),
    oauthLogin:      () => AuthManager.login(),
    oauthLogout:     () => AuthManager.logout(),
    oauthGetToken:   () => AuthManager.getToken().then(t => ({ token: t })),
    oauthGetUserInfo:() => AuthManager.getUserInfo(),
    // Test utility — reset all storage
    _testReset: () => chrome.storage.local.clear().then(() => ({ ok: true })),
  };
  const handler = h[msg.type];
  if (!handler) return false;
  handler().then(sendResponse).catch(e => sendResponse({ error: e.message }));
  return true;
});
