# Module 20 — DECISIONS.md: Performance Monitoring

## Decision 1: `performance.now()` in Service Worker Is Relative to SW Start

`performance.now()` in the service worker context measures milliseconds since the service worker started, not since Chrome launched. Because service workers restart frequently in MV3, comparing timestamps across restarts requires `Date.now()` (wall clock) instead. NeuralTab tracks `SW_START = Date.now()` at module scope to measure per-instance uptime.

## Decision 2: Message Latency as a Proxy for SW Health

The benchmark in perf_monitor.html sends 20 round-trip messages to the background SW and measures P50 latency. Under 5ms = SW is alive and healthy. 5-20ms = SW was sleeping, just woke. Over 20ms = something is blocking the event loop. This indirect measurement reveals SW behavior that's otherwise invisible to the user.

## Decision 3: storage.getBytesInUse(null) Is the Only Quota API

There is no Chrome API to get remaining storage quota (unlike the web's `navigator.storage.estimate()`). `getBytesInUse(null)` tells you how much you're using, and you calculate remaining capacity as `10MB - bytesInUse` for local storage. NeuralTab's performance monitor shows a visual bar against known limits.

## Decision 4: `performance.mark()` and `performance.measure()` Work in Extensions

The User Timing API (`performance.mark`, `performance.measure`) is available in extension pages and service workers. This is useful for instrumenting your own code: mark before an IDB query, mark after, measure the difference. The marks appear in Chrome DevTools Performance timeline when profiling the extension's background page.

## Decision 5: Memory API Is Not Available in Chrome Extensions

`performance.memory` (non-standard, Chrome-only) is available in regular web pages but NOT in extension service workers. There's no API to measure extension memory usage programmatically. The only way to see extension memory is via chrome://task-manager or the Chrome Task Manager (Shift+Esc). This is a known gap in the extension instrumentation API.

## Decision 6: setInterval Wakes the Service Worker

Using `setInterval` or `setTimeout` in the perf monitor page (not the SW) is fine — the page stays alive while visible. But if you put `setInterval` in the service worker to collect metrics, it will keep the SW alive indefinitely, which defeats MV3's battery optimization goals. Use `chrome.alarms` for periodic background tasks instead.
