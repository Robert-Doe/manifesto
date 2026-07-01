// NeuralTab — background.js (Module 14)
'use strict';
importScripts('storage_manager.js', 'migration_manager.js', 'idb_manager.js', 'auth_manager.js');

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

// ── CDP State ─────────────────────────────────────────────────────────────────
let attachedTabId = null;

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function cdpAttach() {
  const tabId = await getActiveTabId();
  if (!tabId) throw new Error('No active tab');
  if (attachedTabId && attachedTabId !== tabId) {
    await chrome.debugger.detach({ tabId: attachedTabId }).catch(() => {});
  }
  await chrome.debugger.attach({ tabId }, '1.3');
  attachedTabId = tabId;
  return { ok: true, tabId };
}

async function cdpDetach() {
  if (attachedTabId) {
    await chrome.debugger.detach({ tabId: attachedTabId }).catch(() => {});
    attachedTabId = null;
  }
  return { ok: true };
}

async function cdpSend(method, params = {}) {
  if (!attachedTabId) throw new Error('Debugger not attached');
  return chrome.debugger.sendCommand({ tabId: attachedTabId }, method, params);
}

chrome.debugger.onEvent.addListener((source, method, params) => {
  chrome.runtime.sendMessage({ type: 'cdpEvent', event: method, params }).catch(() => {});
});

chrome.debugger.onDetach.addListener(() => { attachedTabId = null; });

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  const h = {
    logPageVisit:    () => IDBManager.ready().then(m => m.addVisit(msg.visit)),
    searchHistory:   () => IDBManager.ready().then(m => m.searchVisits(msg.query, msg.page)),
    getHistoryStats: () => IDBManager.ready().then(m => m.getStats()),
    clearHistory:    () => IDBManager.ready().then(m => m.clearAll()),
    runMigrations:   () => MigrationManager.run(msg.from, msg.to),
    getMigrationLog: () => StorageManager.get(['migrationLog', 'schemaVersion']),
    getStorageQuota: () => StorageManager.getQuotaInfo(),
    getWorldInfo:    () => Promise.resolve({ version: chrome.runtime.getManifest().version }),
    oauthLogin:      () => AuthManager.login(),
    oauthLogout:     () => AuthManager.logout(),
    oauthGetToken:   () => AuthManager.getToken().then(t => ({ token: t })),
    oauthGetUserInfo:() => AuthManager.getUserInfo(),
    // Module 14 — CDP
    cdpAttach:  () => cdpAttach(),
    cdpDetach:  () => cdpDetach(),
    cdpSend:    () => cdpSend(msg.method, msg.params),
  };
  const handler = h[msg.type];
  if (!handler) return false;
  handler().then(sendResponse).catch(e => sendResponse({ error: e.message }));
  return true;
});
