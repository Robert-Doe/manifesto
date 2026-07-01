// NeuralTab — storage_manager.js (Module 05 — cumulative)
// Loaded by: content scripts, popup.html, options.html, tab_manager.html, sw_monitor.html
// Also loaded in background.js via importScripts()

const DEFAULTS = {
  // Appearance
  highlightColor:   '#f5c842',
  highlightMinLen:  8,
  buttonVisible:    true,
  buttonPosition:   'bottom-right',
  theme:            'dark',

  // Behaviour
  readingSpeed:     200,
  blockedDomains:   [],

  // Tab management (Module 04)
  tabAnalysisEnabled:    true,
  idleTabThresholdMins:  30,
  lastTabAnalysis:       null,
  tabAccessTimes:        {},

  // Bookmarks (Module 04)
  bookmarkFolderName:    'NeuralTab Saves',

  // Service worker lifecycle tracking (Module 05)
  swStartCount:     0,        // total number of times the SW has been woken
  swLastStart:      null,     // epoch ms of most recent SW wake
  swLastIdle:       null,     // epoch ms of most recent SW idle detection
  swKeepAlive:      false,    // whether the SW keepalive port is active
  swLifecycleLog:   [],       // last N lifecycle events (capped at 50)

  // Stats
  clickCount:       0,
  installDate:      null,
  totalSummaries:   0,
  totalIdleAlerts:  0,
};

const StorageManager = {
  DEFAULTS,

  async get(keys = null) {
    if (keys === null) return chrome.storage.local.get(DEFAULTS);
    const subset = {};
    (Array.isArray(keys) ? keys : [keys]).forEach(k => {
      if (k in DEFAULTS) subset[k] = DEFAULTS[k];
    });
    return chrome.storage.local.get(subset);
  },

  async set(data) {
    return chrome.storage.local.set(data);
  },

  async reset(keys = null) {
    if (keys === null) return chrome.storage.local.set(DEFAULTS);
    const subset = {};
    (Array.isArray(keys) ? keys : [keys]).forEach(k => {
      if (k in DEFAULTS) subset[k] = DEFAULTS[k];
    });
    return chrome.storage.local.set(subset);
  },

  async getQuota() {
    const used  = await chrome.storage.local.getBytesInUse(null);
    const total = chrome.storage.local.QUOTA_BYTES;
    return { used, total, pct: Math.round((used / total) * 100) };
  },

  onChange(callback) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      const newValues = {};
      for (const [key, change] of Object.entries(changes)) {
        newValues[key] = change.newValue;
      }
      callback(newValues, changes);
    });
  },

  async isBlocked(hostname) {
    const { blockedDomains } = await this.get(['blockedDomains']);
    return blockedDomains.some(d => hostname.endsWith(d));
  },

  async recordSummary() {
    const { totalSummaries } = await this.get(['totalSummaries']);
    return this.set({ totalSummaries: totalSummaries + 1 });
  },

  async recordIdleAlert() {
    const { totalIdleAlerts } = await this.get(['totalIdleAlerts']);
    return this.set({ totalIdleAlerts: totalIdleAlerts + 1 });
  },

  // Append an event to the SW lifecycle log (capped at 50 entries)
  async logSwEvent(event, detail = '') {
    const { swLifecycleLog } = await this.get(['swLifecycleLog']);
    const entry = { ts: Date.now(), event, detail };
    const log = [...(swLifecycleLog || []), entry].slice(-50);
    return this.set({ swLifecycleLog: log });
  },

  _formatBytes(bytes) {
    if (bytes < 1024)    return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  },
};
