# Module 15 — DECISIONS.md: CDP Part 2

## Decision 1: Network.enable Must Precede Request Events

`Network.requestWillBeSent` events only fire after `Network.enable` is called. This is a common gotcha: you attach the debugger, add a listener to `chrome.debugger.onEvent`, but see no network events. The fix is always calling `Network.enable` explicitly. It's stateful — once enabled per session, it stays on until `Network.disable` or detach.

## Decision 2: Page.captureScreenshot vs. chrome.tabs.captureVisibleTab

CDP's `Page.captureScreenshot` captures the full page (including non-visible areas) and supports more options (format, quality, clip rect, scale). `chrome.tabs.captureVisibleTab` only captures the visible viewport and requires the `<all_urls>` permission separately from the debugger permission. For a DevTools-style tool, CDP screenshot is preferable.

## Decision 3: Tracing Data Arrives as CDP Events, Not in the Response

`Tracing.end` does not return the trace data in its response. Instead, Chrome sends `Tracing.dataCollected` events (which arrive via `chrome.debugger.onEvent`) followed by a `Tracing.tracingComplete` event when done. The complete trace is assembled from the `dataCollected` chunks. NeuralTab's demo shows the concept but doesn't assemble the full trace for brevity.

## Decision 4: CDP Events Need Runtime Message Relay

CDP events (`chrome.debugger.onEvent`) fire in the background service worker. The `cdp_network.html` page needs to display them. The relay is: background SW receives CDP event → `chrome.runtime.sendMessage` to all extension pages → `chrome.runtime.onMessage` in the panel page. This is the standard extension event bus pattern (Pattern 2 from Module 06, fire-and-forget to all contexts).

## Decision 5: Network Response Bodies Require Explicit Fetch

CDP does not stream response bodies automatically. To read a response body, you must call `Network.getResponseBody({ requestId })` after receiving `Network.responseReceived`. This is a separate CDP call per request — not free. Only fetch bodies for requests you actually need to inspect. Fetching all bodies on a busy page will consume significant memory.

## Decision 6: Why CDP Over webRequest for Network Inspection

`chrome.webRequest` (non-blocking) is still available in MV3 for observation. CDP's Network domain provides more: response bodies, resource timing, WebSocket frames, and the ability to continue requests with modifications (via `Network.setRequestInterception`, deprecated in favor of Fetch domain). For a full DevTools replacement, CDP is the correct choice.
