// NeuralTab — storage_manager.js (Module 08)
// Adds: schemaVersion, migrationLog defaults

'use strict';

const StorageManager = (() => {
  const DEFAULTS = {
    theme: 'dark', accentColor: '#f5c842', fontSize: 14, showWordCount: true,
    bookmarkFolderName: 'NeuralTab Saves',
    tabAccessTimes: {}, swStartCount: 0, swLifecycleLog: [],
    keepaliveEnabled: true, heartbeatInterval: 30,
    messageLog: [], messageCount: 0, demoCounter: 0, activeStreams: 0,
    historyEnabled: true, historyVisitCount: 0, storageQuotaWarned: false,
    // Module 08
    schemaVersion: '0.1.0', migrationLog: []
  };

  async function get(keys) {
    const defaults = {};
    if (Array.isArray(keys)) keys.forEach(k => { if (k in DEFAULTS) defaults[k] = DEFAULTS[k]; });
    return chrome.storage.local.get(keys === null ? DEFAULTS : defaults);
  }
  async function set(obj)    { return chrome.storage.local.set(obj); }
  async function remove(k)   { return chrome.storage.local.remove(k); }

  function onChange(callback) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const flat = {};
      for (const [k, { newValue }] of Object.entries(changes)) flat[k] = newValue;
      callback(flat);
    });
  }

  async function sessionGet(keys) { return chrome.storage.session?.get(keys) ?? {}; }
  async function sessionSet(obj)  { return chrome.storage.session?.set(obj); }

  async function getQuotaInfo() {
    const used  = await chrome.storage.local.getBytesInUse(null);
    const quota = chrome.storage.local.QUOTA_BYTES || 5242880;
    return { used, quota, usedKB: Math.round(used/1024), quotaKB: Math.round(quota/1024), pct: Math.round((used/quota)*100) };
  }

  async function logMessage(dir, action, context='background', detail='') {
    const s = await get(['messageLog','messageCount']);
    const log = s.messageLog || [], count = (s.messageCount||0)+1;
    log.push({ ts: Date.now(), dir, action, context, detail });
    if (log.length > 100) log.splice(0, log.length - 100);
    await set({ messageLog: log, messageCount: count });
  }

  async function logSwEvent(event, detail='') {
    const s = await get(['swLifecycleLog']);
    const log = s.swLifecycleLog || [];
    log.push({ ts: Date.now(), event, detail });
    if (log.length > 50) log.splice(0, log.length - 50);
    await set({ swLifecycleLog: log });
  }

  return { get, set, remove, onChange, sessionGet, sessionSet, getQuotaInfo, logMessage, logSwEvent };
})();
