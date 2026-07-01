// NeuralTab — background.js (Module 08)
// Adds: proper onInstalled migration flow using MigrationManager

importScripts('storage_manager.js', 'idb_manager.js', 'migration_manager.js');

'use strict';

const swStartTime        = Date.now();
let   inMemoryEventCounter = 0;
const streamPorts          = new Set();

// ── Installation / Update ───────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
  const currentVersion = chrome.runtime.getManifest().version;

  await StorageManager.logSwEvent('onInstalled', `reason=${reason} prev=${previousVersion||'none'} curr=${currentVersion}`);

  if (reason === 'install') {
    // Fresh install — set swStartCount and run all migrations from scratch
    await StorageManager.set({ swStartCount: 1 });
    const ran = await MigrationManager.run(null, currentVersion);
    await StorageManager.logSwEvent('migrations', `fresh install, ran: ${ran.join(',') || 'none'}`);

  } else if (reason === 'update') {
    // Existing user upgrading — increment SW start count, run new migrations only
    const s = await StorageManager.get(['swStartCount']);
    await StorageManager.set({ swStartCount: (s.swStartCount || 0) + 1 });
    const ran = await MigrationManager.run(previousVersion, currentVersion);
    await StorageManager.logSwEvent('migrations', `update from ${previousVersion}, ran: ${ran.join(',') || 'none'}`);

  } else if (reason === 'chrome_update') {
    await StorageManager.logSwEvent('chrome_update', 'Chrome updated, extension reloaded');
  }

  await IDBManager.open();
});

// ── Startup ──────────────────────────────────────────────────────────────────
chrome.runtime.onStartup.addListener(async () => {
  await StorageManager.logSwEvent('onStartup', 'browser started');
});

// ── Alarm ────────────────────────────────────────────────────────────────────
chrome.alarms.create('neuraltab-heartbeat', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== 'neuraltab-heartbeat') return;
  inMemoryEventCounter++;
  await StorageManager.logSwEvent('heartbeat', `inMemory=${inMemoryEventCounter}`);
});

// ── Message routing ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  inMemoryEventCounter++;
  switch (msg.action) {
    case 'oneWayLog':
      StorageManager.logMessage('IN','oneWayLog',msg.context||'unknown',msg.text||'');
      return false;
    case 'echoRequest':
      StorageManager.logMessage('IN','echoRequest','bg','')
        .then(() => sendResponse({ echo: msg.payload, swTimestamp: Date.now() }));
      return true;
    case 'getMessageStats':
      StorageManager.get(['messageLog','messageCount']).then(s =>
        sendResponse({ messageCount: s.messageCount||0, swStartTime, inMemoryCount: inMemoryEventCounter, streamPortCount: streamPorts.size })
      ).catch(e => sendResponse({ error: e.message }));
      return true;
    case 'incrementDemoCounter':
      StorageManager.get(['demoCounter']).then(s => {
        const next = (s.demoCounter||0)+1;
        return StorageManager.set({ demoCounter: next }).then(() => sendResponse({ demoCounter: next }));
      }).catch(e => sendResponse({ error: e.message }));
      return true;
    case 'resetDemoCounter':
      StorageManager.set({ demoCounter: 0 }).then(() => sendResponse({ demoCounter: 0 }))
        .catch(e => sendResponse({ error: e.message }));
      return true;
    case 'clearMessageLog':
      StorageManager.set({ messageLog: [], messageCount: 0 })
        .then(() => sendResponse({ ok: true })).catch(e => sendResponse({ error: e.message }));
      return true;
    case 'logPageVisit':
      IDBManager.addVisit({ url: msg.url, title: msg.title, wordCount: msg.wordCount||0, timestamp: Date.now() })
        .then(async () => { const s = await StorageManager.get(['historyVisitCount']); await StorageManager.set({ historyVisitCount: (s.historyVisitCount||0)+1 }); })
        .catch(() => {});
      return false;
    case 'searchHistory':
      IDBManager.searchVisits(msg.query||{}).then(r => sendResponse(r)).catch(e => sendResponse({ error: e.message }));
      return true;
    case 'getHistoryStats':
      IDBManager.getStats().then(r => sendResponse(r)).catch(e => sendResponse({ error: e.message }));
      return true;
    case 'clearHistory':
      IDBManager.clearAll().then(() => StorageManager.set({ historyVisitCount: 0 })).then(() => sendResponse({ ok: true }))
        .catch(e => sendResponse({ error: e.message }));
      return true;
    case 'getStorageQuota':
      StorageManager.getQuotaInfo().then(r => sendResponse(r)).catch(e => sendResponse({ error: e.message }));
      return true;
    case 'getMigrationLog':
      StorageManager.get(['migrationLog','schemaVersion']).then(r => sendResponse(r))
        .catch(e => sendResponse({ error: e.message }));
      return true;
    case 'runMigrations':
      MigrationManager.run(msg.fromVersion, chrome.runtime.getManifest().version)
        .then(ran => sendResponse({ ran })).catch(e => sendResponse({ error: e.message }));
      return true;
    case 'relayFromPage':
      StorageManager.logMessage('IN','relayFromPage','content',JSON.stringify(msg.payload||{}));
      sendResponse({ relayed: true, requestId: msg.requestId });
      return false;
    case 'groupTabsByDomain':
      chrome.tabs.group({ tabIds: msg.tabIds }).then(gid =>
        chrome.tabGroups.update(gid, { title: msg.domain, collapsed: false })
      ).then(() => sendResponse({ ok: true })).catch(e => sendResponse({ error: e.message }));
      return true;
    default: return false;
  }
});

// ── Ports ────────────────────────────────────────────────────────────────────
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
        let sent = 0; const total = msg.chunks || 10;
        streamInterval = setInterval(() => {
          sent++;
          port.postMessage({ type: 'chunk', index: sent, total, data: `chunk-${sent}-${Math.random().toString(36).slice(2,8)}` });
          if (sent >= total) { clearInterval(streamInterval); port.postMessage({ type: 'complete', totalSent: sent }); }
        }, msg.delayMs || 150);
      }
      if (msg.action === 'stopStream') clearInterval(streamInterval);
    });
    port.onDisconnect.addListener(() => { clearInterval(streamInterval); streamPorts.delete(port); StorageManager.set({ activeStreams: streamPorts.size }); });
  }
});
