// ============================================================
// NeuralTab — storage_manager.js
// Module 03: Options Page, chrome.storage & Permissions UX
//
// This file is injected BEFORE content.js (declared first in
// manifest.json content_scripts.js array). It creates a single
// shared StorageManager object available in the isolated world.
//
// It is also loaded directly by popup.js and options.js via
// <script src="storage_manager.js"> — same code, all three
// contexts use the same abstraction layer.
//
// WHY a separate abstraction file?
// chrome.storage.local.get() and .set() are async. Without
// a central manager, every file that needs settings would
// scatter chrome.storage calls throughout the codebase —
// inconsistent key names, duplicate default handling, and
// no single source of truth for what the default values are.
// StorageManager is that single source of truth.
// ============================================================

'use strict';

const StorageManager = {

  // ── Default settings ────────────────────────────────────────
  // These are the values used when a user has never changed a
  // setting, or when a key does not yet exist in storage.
  // ALWAYS define defaults here — never scatter them across files.
  DEFAULTS: {
    highlightColor:   '#f5c842',  // colour used for word highlights
    highlightMinLen:  9,          // words shorter than this are not highlighted
    buttonVisible:    true,       // show/hide the floating Summarize button
    buttonPosition:   'bottom-right', // 'bottom-right' | 'bottom-left'
    readingSpeed:     238,        // words per minute (average adult reader)
    blockedDomains:   [],         // array of hostnames where NeuralTab is disabled
    theme:            'dark',     // 'dark' | 'light' (future use)
    clickCount:       0,          // persisted badge counter from Module 01 Exercise 4
    installDate:      null,       // ISO date string set on first install
    totalSummaries:   0,          // lifetime count of Summarize button clicks
  },

  // ── get(keys?) ──────────────────────────────────────────────
  // Returns a Promise resolving to the stored values merged with
  // defaults. If keys is omitted, returns ALL settings.
  // If keys is a string or array, returns only those keys.
  //
  // Usage:
  //   const { highlightColor } = await StorageManager.get('highlightColor');
  //   const settings = await StorageManager.get();
  //
  get(keys = null) {
    return new Promise((resolve) => {
      // Build a defaults object for the requested keys only
      let defaultsForRequest;

      if (keys === null) {
        defaultsForRequest = { ...this.DEFAULTS };
      } else if (typeof keys === 'string') {
        defaultsForRequest = { [keys]: this.DEFAULTS[keys] };
      } else {
        defaultsForRequest = {};
        keys.forEach(k => { defaultsForRequest[k] = this.DEFAULTS[k]; });
      }

      // chrome.storage.local.get() takes a defaults object.
      // For each key, if the key is not in storage, the default
      // value from the object is returned instead. This is the
      // idiomatic way to handle defaults in Chrome extensions.
      chrome.storage.local.get(defaultsForRequest, (result) => {
        if (chrome.runtime.lastError) {
          console.error('[StorageManager] get error:', chrome.runtime.lastError);
          resolve(defaultsForRequest); // fall back to defaults on error
          return;
        }
        resolve(result);
      });
    });
  },

  // ── set(data) ────────────────────────────────────────────────
  // Persists the provided key-value pairs to chrome.storage.local.
  // Returns a Promise that resolves when the write is confirmed.
  //
  // Usage:
  //   await StorageManager.set({ highlightColor: '#38bdf8' });
  //
  set(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          console.error('[StorageManager] set error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        resolve();
      });
    });
  },

  // ── reset(keys?) ─────────────────────────────────────────────
  // Resets specific keys (or ALL keys) to their default values.
  // Does NOT clear keys that don't have a default defined here.
  //
  // Usage:
  //   await StorageManager.reset();             // reset everything
  //   await StorageManager.reset('highlightColor'); // reset one key
  //
  reset(keys = null) {
    let toReset;
    if (keys === null) {
      toReset = { ...this.DEFAULTS };
    } else if (typeof keys === 'string') {
      toReset = { [keys]: this.DEFAULTS[keys] };
    } else {
      toReset = {};
      keys.forEach(k => { toReset[k] = this.DEFAULTS[k]; });
    }
    return this.set(toReset);
  },

  // ── getQuota() ────────────────────────────────────────────────
  // Returns storage usage information.
  // chrome.storage.local.getBytesInUse() tells us how many bytes
  // we are currently using. The quota limit is 10MB (10,485,760 bytes).
  //
  getQuota() {
    return new Promise((resolve) => {
      chrome.storage.local.getBytesInUse(null, (bytesUsed) => {
        if (chrome.runtime.lastError) {
          resolve({ bytesUsed: 0, bytesTotal: 10485760, percent: 0 });
          return;
        }
        const bytesTotal = 10485760; // chrome.storage.local.QUOTA_BYTES
        resolve({
          bytesUsed,
          bytesTotal,
          percent:     Math.round((bytesUsed / bytesTotal) * 100 * 100) / 100,
          usedHuman:   formatBytes(bytesUsed),
          totalHuman:  formatBytes(bytesTotal),
        });
      });
    });
  },

  // ── onChange(callback) ────────────────────────────────────────
  // Registers a listener that fires whenever ANY storage key changes.
  // The callback receives (changes, areaName) where:
  //   changes = { keyName: { oldValue, newValue } }
  //   areaName = 'local' | 'sync' | 'session'
  //
  // This is how options.js live-previews changes and how content.js
  // reacts when the user changes settings without reloading the page.
  //
  // Usage:
  //   StorageManager.onChange((changes) => {
  //     if (changes.highlightColor) {
  //       applyNewColor(changes.highlightColor.newValue);
  //     }
  //   });
  //
  onChange(callback) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return; // only react to local storage changes
      callback(changes, areaName);
    });
  },

  // ── isBlocked(hostname) ───────────────────────────────────────
  // Checks whether NeuralTab should be disabled on the given domain.
  // Returns a Promise<boolean>.
  //
  async isBlocked(hostname) {
    const { blockedDomains } = await this.get('blockedDomains');
    return blockedDomains.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );
  },

  // ── recordSummary() ──────────────────────────────────────────
  // Increments the lifetime summary counter.
  // Used by content.js every time the user clicks Summarize.
  // Returns the new total.
  //
  async recordSummary() {
    const { totalSummaries } = await this.get('totalSummaries');
    const newTotal = totalSummaries + 1;
    await this.set({ totalSummaries: newTotal });
    return newTotal;
  },

};

// ── Private helper ────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k     = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i     = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
