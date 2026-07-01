/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }],
  },
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'storage_manager.js',
    'migration_manager.js',
    'idb_manager.js',
    'auth_manager.js',
    'analytics_manager.js',
  ],
  coverageThreshold: {
    global: { lines: 70, functions: 70, branches: 60 },
  },
  // Chrome API mock is set up in each test file via setupChromeMock()
  globals: {
    chrome: undefined,
  },
};
