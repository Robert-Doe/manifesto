// NeuralTab — analytics_manager.js (Module 24)
// Privacy-first, local-only analytics — no data leaves the device
'use strict';

const AnalyticsManager = (() => {
  const KEY = 'localAnalytics';

  const EVENTS = {
    POPUP_OPEN:    'popup_open',
    FEATURE_USE:   'feature_use',
    HISTORY_SEARCH:'history_search',
    OPTION_CHANGE: 'option_change',
    ERROR:         'error',
  };

  async function track(event, props = {}) {
    const { localAnalytics: data = {} } = await chrome.storage.local.get(KEY);
    const today = new Date().toISOString().substring(0, 10);

    if (!data[today]) data[today] = {};
    if (!data[today][event]) data[today][event] = { count: 0, props: {} };

    data[today][event].count++;
    for (const [k, v] of Object.entries(props)) {
      data[today][event].props[k] = (data[today][event].props[k] || 0) + (typeof v === 'number' ? v : 1);
    }

    // Keep only last 30 days
    const days = Object.keys(data).sort();
    if (days.length > 30) delete data[days[0]];

    await chrome.storage.local.set({ [KEY]: data });
  }

  async function getReport() {
    const { localAnalytics: data = {} } = await chrome.storage.local.get(KEY);
    const days = Object.keys(data).sort();
    const totals = {};
    for (const day of days) {
      for (const [event, info] of Object.entries(data[day])) {
        totals[event] = (totals[event] || 0) + info.count;
      }
    }
    return { days: data, totals, dayCount: days.length };
  }

  async function clear() {
    await chrome.storage.local.remove(KEY);
  }

  return { track, getReport, clear, EVENTS };
})();
