// NeuralTab — background.js (Module 07)
// Adds: IndexedDB history tracking, quota monitoring, session storage demos

importScripts('storage_manager.js', 'idb_manager.js');

'use strict';

const swStartTime        = Date.now();
let   inMemoryEventCounter = 0;
const streamPorts          = new Set();

// ── Initialization ───────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
  await StorageManager.logSwEvent('onInstalled', `reason=${reason} prev=${previousVersion || 'none'}`);
  if (reason === 'install') {
    await StorageManager.set({ swStartCount: 1, historyVisitCount: 0 });
  }
  // Pre-open IDB so first visit is fast
  await IDBManager.open();
});

chrome.alarms.create('neuraltab-heartbeat', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== 'neuraltab-heartbeat') return;
  inMemoryEventCounter++;
  await StorageManager.logSwEvent('heartbeat', `inMemory=${inMemoryEventCounter}`);
  // Check quota and warn if > 80%
  const q = await StorageManager.getQuotaInfo();
  if (q.pct >= 80) await StorageManager.set({ storageQuotaWarned: true });
});

// ── Message routing ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  inMemoryEventCounter++;

  switch (msg.action) {

    // Pattern 1 — fire & forget
    case 'oneWayLog':
      StorageManager.logMessage('IN', 'oneWayLog', msg.context || 'unknown', msg.text || '');
      return false;

    // Pattern 2 — async req/res
    case 'echoRequest':
      StorageManager.logMessage('IN', 'echoRequest', 'bg', '')
        .then(() => sendResponse({ echo: msg.payload, swTimestamp: Date.now() }));
      return true;

    case 'getMessageStats':
      StorageManager.get(['messageLog', 'messageCount']).then(s =>
        sendResponse({
          messageCount:    s.messageCount || 0,
          swStartTime,
          inMemoryCount:   inMemoryEventCounter,
          streamPortCount: streamPorts.size
        })
      ).catch(e => sendResponse({ error: e.message }));
      return true;

    case 'incrementDemoCounter':
      StorageManager.get(['demoCounter']).then(s => {
        const next = (s.demoCounter || 0) + 1;
        return StorageManager.set({ demoCounter: next }).then(() => sendResponse({ demoCounter: next }));
      }).catch(e => sendResponse({ error: e.message }));
      return true;

    case 'resetDemoCounter':
      StorageManager.set({ demoCounter: 0 }).then(() => sendResponse({ demoCounter: 0 }))
        .catch(e => sendResponse({ error: e.message }));
      return true;

    case 'clearMessageLog':
      StorageManager.set({ messageLog: [], messageCount: 0 })
        .then(() => sendResponse({ ok: true }))
        .catch(e => sendResponse({ error: e.message }));
      return true;

    // Module 07 — IndexedDB history
    case 'logPageVisit':
      IDBManager.addVisit({
        url:       msg.url,
        title:     msg.title,
        wordCount: msg.wordCount || 0,
        timestamp: Date.now()
      }).then(async () => {
        const s = await StorageManager.get(['historyVisitCount']);
        await StorageManager.set({ historyVisitCount: (s.historyVisitCount || 0) + 1 });
      }).catch(() => {}); // fire & forget — history loss is acceptable
      return false;

    case 'searchHistory':
      IDBManager.searchVisits(msg.query || {})
        .then(r => sendResponse(r))
        .catch(e => sendResponse({ error: e.message }));
      return true;

    case 'getHistoryStats':
      IDBManager.getStats()
        .then(r => sendResponse(r))
        .catch(e => sendResponse({ error: e.message }));
      return true;

    case 'clearHistory':
      IDBManager.clearAll()
        .then(() => StorageManager.set({ historyVisitCount: 0 }))
        .then(() => sendResponse({ ok: true }))
        .catch(e => sendResponse({ error: e.message }));
      return true;

    case 'getStorageQuota':
      StorageManager.getQuotaInfo()
        .then(r => sendResponse(r))
        .catch(e => sendResponse({ error: e.message }));
      return true;

    // Relay from page world (3-hop chain)
    case 'relayFromPage':
      StorageManager.logMessage('IN', 'relayFromPage', 'content', JSON.stringify(msg.payload || {}));
      sendResponse({ relayed: true, requestId: msg.requestId });
      return false;

    case 'groupTabsByDomain':
      chrome.tabs.group({ tabIds: msg.tabIds }).then(groupId =>
        chrome.tabGroups.update(groupId, { title: msg.domain, collapsed: false })
      ).then(() => sendResponse({ ok: true }))
        .catch(e => sendResponse({ error: e.message }));
      return true;

    case 'contentPing':
      sendResponse({ pong: true, url: sender.url, wordCount: msg.wordCount || 0 });
      return false;

    default:
      return false;
  }
});

// ── Port connections ─────────────────────────────────────────────────────────
chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'neuraltab-keepalive') {
    port.onMessage.addListener(() => port.postMessage({ pong: true, ts: Date.now() }));
    return;
  }

  if (port.name === 'neuraltab-stream') {
    streamPorts.add(port);
    StorageManager.set({ activeStreams: streamPorts.size });
    let streamInterval = null;

    port.onMessage.addListener(msg => {
      if (msg.action === 'startStream') {
        let sent = 0;
        const total = msg.chunks || 10;
        streamInterval = setInterval(() => {
          sent++;
          port.postMessage({
            type: 'chunk', index: sent, total,
            data: `chunk-${sent}-${Math.random().toString(36).slice(2, 8)}`
          });
          if (sent >= total) {
            clearInterval(streamInterval);
            port.postMessage({ type: 'complete', totalSent: sent });
          }
        }, msg.delayMs || 150);
      }
      if (msg.action === 'stopStream') clearInterval(streamInterval);
      if (msg.action === 'portPing')   port.postMessage({ type: 'pong', ts: Date.now() });
    });

    port.onDisconnect.addListener(() => {
      clearInterval(streamInterval);
      streamPorts.delete(port);
      StorageManager.set({ activeStreams: streamPorts.size });
    });
  }
});
