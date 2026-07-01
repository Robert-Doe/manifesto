// NeuralTab — storage_manager.js (Module 06 — adds messageLog, messageCount, demoCounter)

'use strict';

const StorageManager = (() => {
  const DEFAULTS = {
    // Appearance (M01)
    highlightColor:       '#f5c842',
    highlightMinLen:      3,
    buttonPosition:       'bottom-right',
    buttonVisible:        true,
    // Behaviour (M02)
    readingSpeed:         200,
    blockedDomains:       [],
    // Storage (M03)
    installDate:          null,
    totalSummaries:       0,
    // Tabs / Alarms (M04)
    tabAnalysisEnabled:   true,
    idleTabThresholdMins: 30,
    lastTabAnalysis:      null,
    tabAccessTimes:       {},
    bookmarkFolderName:   'NeuralTab Saves',
    totalIdleAlerts:      0,
    // SW Lifecycle (M05)
    swStartCount:         0,
    swLastStart:          null,
    swLastIdle:           null,
    swKeepAlive:          false,
    swLifecycleLog:       [],
    // Message Passing (M06)
    messageLog:           [],   // [{ts, dir, action, context, detail}] — capped at 100
    messageCount:         0,    // lifetime total messages processed by background
    demoCounter:          0,    // shared counter for Pattern 4 pub/sub demo
    activeStreams:        0,    // count of currently open streaming ports
  };

  return {
    // ─── Core get/set/reset ─────────────────────────────────────────────────
    async get(keys = null) {
      const defaults = keys
        ? Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(k => [k, DEFAULTS[k]]))
        : { ...DEFAULTS };
      const stored = await chrome.storage.local.get(keys ?? Object.keys(DEFAULTS));
      return { ...defaults, ...stored };
    },

    async set(data) {
      await chrome.storage.local.set(data);
    },

    async reset() {
      await chrome.storage.local.set({ ...DEFAULTS, installDate: Date.now() });
    },

    // ─── Quota ──────────────────────────────────────────────────────────────
    async getQuota() {
      const used  = await chrome.storage.local.getBytesInUse(null);
      const total = chrome.storage.local.QUOTA_BYTES ?? 5_242_880;
      return { used, total, pct: Math.round((used / total) * 100) };
    },

    _formatBytes(bytes) {
      if (bytes < 1024)       return bytes + ' B';
      if (bytes < 1_048_576)  return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1_048_576).toFixed(2) + ' MB';
    },

    // ─── Reactive onChange ───────────────────────────────────────────────────
    onChange(callback) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        const flat = {};
        for (const [key, { newValue }] of Object.entries(changes)) flat[key] = newValue;
        callback(flat);
      });
    },

    // ─── SW Lifecycle log (M05) ──────────────────────────────────────────────
    async logSwEvent(event, detail = '') {
      const s   = await this.get(['swLifecycleLog']);
      const log = s.swLifecycleLog || [];
      log.push({ ts: Date.now(), event, detail });
      if (log.length > 50) log.splice(0, log.length - 50);
      await this.set({ swLifecycleLog: log });
    },

    // ─── Message log (M06) ───────────────────────────────────────────────────
    // direction: 'IN' | 'OUT' | 'PORT_IN' | 'PORT_OUT' | 'STORAGE'
    async logMessage(direction, action, context = 'background', detail = '') {
      const s    = await this.get(['messageLog', 'messageCount']);
      const log  = s.messageLog || [];
      const count = (s.messageCount || 0) + 1;
      log.push({ ts: Date.now(), dir: direction, action, context, detail });
      if (log.length > 100) log.splice(0, log.length - 100);
      await this.set({ messageLog: log, messageCount: count });
    },

    // ─── Stats helpers ───────────────────────────────────────────────────────
    async recordIdleAlert() {
      const s = await this.get(['totalIdleAlerts']);
      await this.set({ totalIdleAlerts: (s.totalIdleAlerts || 0) + 1 });
    },

    async recordSummary() {
      const s = await this.get(['totalSummaries']);
      await this.set({ totalSummaries: (s.totalSummaries || 0) + 1 });
    },

    // ─── Blocked domain check ────────────────────────────────────────────────
    async isBlocked(hostname) {
      const { blockedDomains } = await this.get(['blockedDomains']);
      return blockedDomains.some(d => hostname === d || hostname.endsWith('.' + d));
    },
  };
})();
