// NeuralTab — storage_manager.js (Module 07)
// Adds: quota checking, session storage support, improved error handling

'use strict';

const StorageManager = (() => {
  const DEFAULTS = {
    // Module 03
    theme: 'dark', accentColor: '#f5c842', fontSize: 14, showWordCount: true,
    bookmarkFolderName: 'NeuralTab Saves',
    // Module 04
    tabAccessTimes: {}, swStartCount: 0, swLifecycleLog: [],
    // Module 05
    keepaliveEnabled: true, heartbeatInterval: 30,
    // Module 06
    messageLog: [], messageCount: 0, demoCounter: 0, activeStreams: 0,
    // Module 07
    historyEnabled: true, historyVisitCount: 0,
    storageQuotaWarned: false, sessionData: {}
  };

  async function get(keys) {
    const defaults = {};
    if (Array.isArray(keys)) {
      keys.forEach(k => { if (k in DEFAULTS) defaults[k] = DEFAULTS[k]; });
    }
    return chrome.storage.local.get(keys === null ? DEFAULTS : defaults);
  }

  async function set(obj) {
    return chrome.storage.local.set(obj);
  }

  async function remove(keys) {
    return chrome.storage.local.remove(keys);
  }

  function onChange(callback) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      const flat = {};
      for (const [key, { newValue }] of Object.entries(changes)) flat[key] = newValue;
      callback(flat);
    });
  }

  // Session storage — ephemeral, cleared on browser restart
  async function sessionGet(keys) {
    if (!chrome.storage.session) return {};
    return chrome.storage.session.get(keys);
  }

  async function sessionSet(obj) {
    if (!chrome.storage.session) return;
    return chrome.storage.session.set(obj);
  }

  // Quota information
  async function getQuotaInfo() {
    const used  = await chrome.storage.local.getBytesInUse(null);
    const quota = chrome.storage.local.QUOTA_BYTES || 5242880; // 5 MB default
    return {
      used,
      quota,
      usedKB:   Math.round(used / 1024),
      quotaKB:  Math.round(quota / 1024),
      pct:      Math.round((used / quota) * 100)
    };
  }

  async function logMessage(direction, action, context = 'background', detail = '') {
    const s     = await get(['messageLog', 'messageCount']);
    const log   = s.messageLog || [];
    const count = (s.messageCount || 0) + 1;
    log.push({ ts: Date.now(), dir: direction, action, context, detail });
    if (log.length > 100) log.splice(0, log.length - 100);
    await set({ messageLog: log, messageCount: count });
  }

  async function logSwEvent(event, detail = '') {
    const s   = await get(['swLifecycleLog']);
    const log = s.swLifecycleLog || [];
    log.push({ ts: Date.now(), event, detail });
    if (log.length > 50) log.splice(0, log.length - 50);
    await set({ swLifecycleLog: log });
  }

  return { get, set, remove, onChange, sessionGet, sessionSet, getQuotaInfo, logMessage, logSwEvent };
})();
