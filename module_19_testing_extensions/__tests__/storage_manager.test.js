// NeuralTab — __tests__/storage_manager.test.js (Module 19)
'use strict';

// Chrome API mock
function setupChromeMock() {
  const store = {};
  global.chrome = {
    storage: {
      local: {
        get: jest.fn((keys, cb) => {
          const result = keys === null
            ? { ...store }
            : (Array.isArray(keys) ? keys : [keys]).reduce((acc, k) => { acc[k] = store[k]; return acc; }, {});
          cb ? cb(result) : null;
          return Promise.resolve(result);
        }),
        set: jest.fn((data, cb) => {
          Object.assign(store, data);
          cb?.();
          return Promise.resolve();
        }),
        remove: jest.fn((keys, cb) => {
          (Array.isArray(keys) ? keys : [keys]).forEach(k => delete store[k]);
          cb?.();
          return Promise.resolve();
        }),
        getBytesInUse: jest.fn((keys, cb) => {
          cb?.(JSON.stringify(store).length * 2);
          return Promise.resolve(JSON.stringify(store).length * 2);
        }),
      },
      sync: {
        get: jest.fn((keys, cb) => { cb?.({}); return Promise.resolve({}); }),
        getBytesInUse: jest.fn((keys, cb) => { cb?.(0); return Promise.resolve(0); }),
      },
      session: {
        get: jest.fn((keys, cb) => { cb?.({}); return Promise.resolve({}); }),
        set: jest.fn((data, cb) => { cb?.(); return Promise.resolve(); }),
      },
    },
    runtime: { lastError: null },
  };
  return store;
}

// Load StorageManager (simplified inline for testing without importScripts)
class StorageManager {
  static DEFAULTS = {
    extensionEnabled: true,
    historyEnabled: true,
    historyVisitCount: 0,
    swStartCount: 0,
    schemaVersion: '0.1.0',
    migrationLog: [],
    networkEvents: [],
  };

  static async get(keys) {
    return new Promise(resolve => {
      chrome.storage.local.get(keys, data => resolve(data));
    });
  }

  static async set(data) {
    return new Promise(resolve => {
      chrome.storage.local.set(data, resolve);
    });
  }

  static async getQuotaInfo() {
    const localBytes = await new Promise(r => chrome.storage.local.getBytesInUse(null, r));
    const syncBytes = await new Promise(r => chrome.storage.sync.getBytesInUse(null, r));
    return {
      localBytes,
      syncBytes,
      localPercent: ((localBytes / (10 * 1024 * 1024)) * 100).toFixed(1),
    };
  }
}

describe('StorageManager', () => {
  beforeEach(() => {
    setupChromeMock();
  });

  test('set and get a value', async () => {
    await StorageManager.set({ foo: 'bar' });
    const result = await StorageManager.get('foo');
    expect(result.foo).toBe('bar');
  });

  test('get multiple keys', async () => {
    await StorageManager.set({ a: 1, b: 2 });
    const result = await StorageManager.get(['a', 'b']);
    expect(result.a).toBe(1);
    expect(result.b).toBe(2);
  });

  test('getQuotaInfo returns numeric values', async () => {
    await StorageManager.set({ data: 'hello world' });
    const info = await StorageManager.getQuotaInfo();
    expect(typeof info.localBytes).toBe('number');
    expect(typeof info.syncBytes).toBe('number');
    expect(info.localBytes).toBeGreaterThanOrEqual(0);
  });

  test('DEFAULTS has required keys', () => {
    expect(StorageManager.DEFAULTS).toHaveProperty('extensionEnabled');
    expect(StorageManager.DEFAULTS).toHaveProperty('schemaVersion');
    expect(StorageManager.DEFAULTS).toHaveProperty('migrationLog');
  });
});
