// NeuralTab — __tests__/migration_manager.test.js (Module 19)
'use strict';

let store = {};
beforeEach(() => {
  store = { schemaVersion: '0.1.0', migrationLog: [] };
  global.chrome = {
    storage: {
      local: {
        get: jest.fn((keys, cb) => {
          const result = (Array.isArray(keys) ? keys : [keys]).reduce((acc, k) => {
            acc[k] = store[k];
            return acc;
          }, {});
          cb?.(result);
          return Promise.resolve(result);
        }),
        set: jest.fn((data, cb) => { Object.assign(store, data); cb?.(); return Promise.resolve(); }),
      },
    },
    runtime: { lastError: null },
  };
});

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

describe('compareVersions', () => {
  test('equal versions return 0', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  test('higher major version returns 1', () => {
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
  });

  test('lower minor version returns -1', () => {
    expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
  });

  test('patch comparison works', () => {
    expect(compareVersions('0.8.0', '0.7.9')).toBe(1);
  });

  test('sort order', () => {
    const versions = ['0.8.0', '0.2.0', '0.5.0', '0.10.0'];
    const sorted = versions.sort(compareVersions);
    expect(sorted).toEqual(['0.2.0', '0.5.0', '0.8.0', '0.10.0']);
  });
});
