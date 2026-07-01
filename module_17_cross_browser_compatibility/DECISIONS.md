# Module 17 — DECISIONS.md: Cross-Browser Compatibility

## Decision 1: browser.* Polyfill vs. Native Detection

Firefox and Safari expose extension APIs via `browser.*` (Promise-based). Chrome uses `chrome.*` (callback-based). The polyfill in `browser_polyfill.js` wraps Chrome's callback APIs to return Promises when `browser` is undefined, giving you one API surface across all browsers. The trade-off: the polyfill adds ~3KB and a wrapper call overhead. For simple extensions, writing `chrome.*` with `async/await` using explicit `Promise` wrappers is lighter.

## Decision 2: Feature Detection via NTCompat, Not Browser Detection

`NTCompat.hasSidePanel()` checks `!!chrome.sidePanel` — feature detection, not browser detection. This is preferable to `navigator.userAgent` sniffing because it handles Chrome version differences (sidePanel was added in 114), future browser adoption of the API, and works correctly even in polyfilled environments.

## Decision 3: Graceful Degradation for Missing APIs

Every call to `chrome.sidePanel`, `chrome.offscreen`, `chrome.storage.session`, and `chrome.contextMenus` in Module 17's background.js is guarded with `if (chrome.X)`. This allows the extension to install and run on Firefox or Safari (which don't have these APIs) without crashing the service worker. Features simply don't appear rather than throwing errors.

## Decision 4: declarativeNetRequest Parity Is Incomplete

Firefox supports a subset of DNR in MV3 (limited resource types, no modifyHeaders in some versions). Safari supports DNR in MV3 but with its own set of limitations. The `dnr_rules.json` rules NeuralTab uses (block, redirect, modifyHeaders) may not work identically across browsers. Cross-browser extension developers must test DNR rules on each target browser.

## Decision 5: Background Service Worker vs. Event Page

Chrome MV3 requires a service worker. Firefox MV3 supports service workers but also still accepts `event_page` in MV2. If you need maximum Firefox compatibility, MV2 with event_page is more reliable than MV3 service_worker on Firefox as of 2024. For new extensions targeting Chrome as primary with Firefox as secondary, MV3 service_worker is the right call.

## Decision 6: The manifest.json Is the Biggest Cross-Browser Pain Point

Differences in manifest.json across browsers: `side_panel` is Chrome-only, `browser_specific_settings.gecko` is Firefox-only, `safari_extension` is Safari-only. The cleanest approach is one canonical manifest.json for Chrome plus a build step that transforms it for other browsers. Tools like `web-ext` (Mozilla) and browser-specific manifest schema validators help.
