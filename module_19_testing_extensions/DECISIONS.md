# Module 19 — DECISIONS.md: Testing

## Decision 1: Unit Tests for Pure Logic, Not Chrome APIs

The test suite tests pure functions: `compareVersions`, `StorageManager.get/set` with a chrome mock, and migration logic. We do not try to test the actual `chrome.storage` API — that's Chrome's code, not ours. The mock verifies that our code calls the API correctly. Integration testing (actual Chrome behavior) is handled by Playwright E2E tests.

## Decision 2: Chrome Mock via jest.fn(), Not sinon or jest-chrome

NeuralTab's tests use plain `jest.fn()` to mock `global.chrome`. Some developers use `jest-chrome` (a typed Chrome API mock) or `sinon`. The manual mock approach keeps dependencies minimal and makes the mock behavior explicit in each test file. The downside: verbose setup. The upside: no transitive dependency on a mock library that may lag behind Chrome API changes.

## Decision 3: Playwright for E2E, Not Puppeteer

Playwright supports Chrome extensions via `chromium.launchPersistentContext` with `args: ['--load-extension=...']`. Puppeteer also supports this but Playwright's API is cleaner for multi-browser testing and has better async support. E2E tests verify the golden path: install the extension, open the popup, verify the history count, search history, check the side panel updates.

## Decision 4: Coverage Threshold Set at 70%

The Jest config sets a 70% line coverage threshold. Higher thresholds (90%+) incentivize testing trivial code and mocking internals to hit numbers rather than testing meaningful behavior. 70% with well-chosen tests is better than 90% with shallow tests. The uncovered 30% is typically: error handling branches, edge cases in async timing, and chrome API failure paths that are hard to trigger in unit tests.

## Decision 5: Testing Service Worker Logic Requires Extraction

Service worker (`background.js`) uses `importScripts` which isn't available in Jest's Node environment. The solution: extract testable logic into pure modules (StorageManager, MigrationManager) that don't directly reference `chrome.*` in their module scope. The background.js itself is an integration point that is integration-tested via Playwright, not unit-tested.

## Decision 6: CI Must Not Have Chrome Available — Use Mock Tests

The GitHub Actions CI job in Module 25 runs Jest unit tests (no Chrome needed) in the `lint-and-validate` job. Playwright E2E tests require a full Chrome binary and are typically run locally or in a separate CI job with `uses: chromium/playwright-browsers@v1`. Don't block the primary CI pipeline on E2E — E2E tests are slower and more brittle.
