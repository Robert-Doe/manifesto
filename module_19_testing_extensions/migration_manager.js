// NeuralTab — migration_manager.js (Module 08 — new)
// Handles storage schema migrations across extension versions

'use strict';

const MigrationManager = (() => {

  // Each migration runs when upgrading FROM the previous version
  // Key = target version string that requires this migration to run
  const MIGRATIONS = {

    '0.2.0': async (storage) => {
      // M02: introduced theme, accentColor, fontSize
      if (!storage.theme) await StorageManager.set({ theme: 'dark', fontSize: 14, accentColor: '#f5c842' });
    },

    '0.3.0': async (storage) => {
      // M03: introduced bookmarkFolderName
      if (!storage.bookmarkFolderName) await StorageManager.set({ bookmarkFolderName: 'NeuralTab Saves' });
    },

    '0.4.0': async (storage) => {
      // M04: introduced tabAccessTimes, swStartCount
      if (!storage.tabAccessTimes) await StorageManager.set({ tabAccessTimes: {}, swStartCount: 0 });
    },

    '0.5.0': async (storage) => {
      // M05: keepalive settings
      if (storage.keepaliveEnabled === undefined) await StorageManager.set({ keepaliveEnabled: true, heartbeatInterval: 30 });
    },

    '0.6.0': async (storage) => {
      // M06: message passing state
      const updates = {};
      if (!storage.messageLog)   updates.messageLog   = [];
      if (!storage.messageCount) updates.messageCount  = 0;
      if (!storage.demoCounter)  updates.demoCounter   = 0;
      if (!storage.activeStreams) updates.activeStreams = 0;
      if (Object.keys(updates).length) await StorageManager.set(updates);
    },

    '0.7.0': async (storage) => {
      // M07: history tracking
      if (!storage.historyVisitCount) await StorageManager.set({ historyVisitCount: 0, historyEnabled: true });
    },

    '0.8.0': async (storage) => {
      // M08: migration log itself
      if (!storage.migrationLog) await StorageManager.set({ migrationLog: [], schemaVersion: '0.8.0' });
    }
  };

  function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if (pa[i] > pb[i]) return  1;
      if (pa[i] < pb[i]) return -1;
    }
    return 0;
  }

  async function run(previousVersion, currentVersion) {
    const storage = await StorageManager.get(null);
    const log     = storage.migrationLog || [];
    const ran     = [];

    const sortedVersions = Object.keys(MIGRATIONS).sort(compareVersions);

    for (const target of sortedVersions) {
      // Run if previousVersion < target <= currentVersion
      const afterPrev   = !previousVersion || compareVersions(previousVersion, target) < 0;
      const beforeCurr  = compareVersions(target, currentVersion) <= 0;
      const alreadyRan  = log.some(e => e.version === target && e.success);

      if (afterPrev && beforeCurr && !alreadyRan) {
        const entry = { version: target, ts: Date.now(), success: false, error: null };
        try {
          await MIGRATIONS[target](storage);
          entry.success = true;
        } catch (e) {
          entry.error = e.message;
        }
        log.push(entry);
        ran.push(target);
      }
    }

    if (ran.length) {
      log.splice(0, log.length - 50); // cap at 50 migration entries
      await StorageManager.set({ migrationLog: log, schemaVersion: currentVersion });
    }

    return ran;
  }

  return { run };
})();
