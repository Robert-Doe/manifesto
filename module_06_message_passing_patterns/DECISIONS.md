# Module 06 — Design Decisions

## Decision 1: return true is the most dangerous line in extension development

**Choice:** Require every async `onMessage` handler to explicitly `return true` and call `sendResponse` exactly once.

**What happens if you forget `return true`:**
The message channel closes synchronously at the end of the `onMessage` listener. Any subsequent `sendResponse()` call throws `Error: The message port closed before a response was received`. The sender's `sendMessage()` promise rejects. This is one of the most common bugs in MV3 extensions and the error message is confusing — it says "port closed" but has nothing to do with the keepalive port from M05.

**What happens if you call `sendResponse` twice:**
The second call silently fails. This matters when an async handler has both a `catch` and a `then` path that both try to call `sendResponse`. Defensive pattern: use a `responded` flag.

**What happens if you return `true` but never call `sendResponse`:**
The sender hangs until the default timeout (~30 seconds in Chrome), then rejects. Always `sendResponse` even on error paths:
```js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'myAction') {
    doAsyncWork().then(r => sendResponse(r)).catch(e => sendResponse({ error: e.message }));
    return true; // ← always return BEFORE the async operation runs
  }
});
```

**Why one big onMessage listener instead of many small ones:**
Chrome fires ALL registered `onMessage` listeners for every message. If multiple listeners each `return true`, the first `sendResponse` wins and the others throw. A single listener with explicit action routing avoids this race condition.

---

## Decision 2: Port-based streaming uses a Set of ports, not a single reference

**Choice:** `const streamPorts = new Set()` in background.js, storing every connected `'neuraltab-stream'` port.

**Rejected:** Storing a single `let streamPort = null` reference.

**Why the Set:**
- Multiple Message Lab tabs can be open simultaneously, each connecting their own stream port.
- With a single reference, opening a second tab would silently clobber the first — the second connection would overwrite `streamPort`, and the first tab would never receive stream chunks.
- The Set means each port handles its own independent stream. `port.onMessage` and `port.onDisconnect` are closures that capture the specific `port` object, so each connection is self-contained.

**Port lifecycle clarity:**
```
onConnect → add to Set → register port.onMessage + port.onDisconnect
port.onDisconnect → delete from Set → clear that port's interval
```
No global state is shared between ports except `streamPorts.size` (used for display).

**Why not WebSocket for streaming:**
Ports are zero-infrastructure — no server, no URL, no CORS. For intra-extension streaming (background → page), ports are always the right tool. WebSockets belong in modules about external API communication.

---

## Decision 3: Pattern 4 writes directly to storage instead of sending a message to background

**Choice:** The Message Lab's counter buttons call `StorageManager.set({ demoCounter: next })` directly, bypassing the background.

**Alternative considered:** Send `{ action: 'incrementDemoCounter' }` to background, let background write storage, send response.

**Why direct storage write wins:**
- Any extension page (popup, options, content script via `chrome.storage.local`) can write storage directly. No message round-trip is needed.
- The whole point of Pattern 4 is to show that `storage.onChanged` acts as a pub/sub bus — the publisher writes storage and every subscriber reacts. Making the background an intermediary would obscure that point.
- The background `incrementDemoCounter` handler is still included in background.js as an alternative path — it's used when the publisher is a content script that can't rely on popup/options page being open.

**When you DO need to route storage writes through background:**
When the write requires server-side logic (validation, rate limiting, merging concurrent writes from multiple tabs). For simple shared counters, direct write is correct.

---

## Decision 4: The 3-hop relay chain teaches isolation boundaries explicitly

**Choice:** `assets/inject.js` (page world) → `window.postMessage` → `content.js` (isolated world) → `chrome.runtime.sendMessage` → `background.js`.

**Why this chain exists:**
Each hop crosses a security boundary:
1. **Page → Content:** `window.postMessage` because inject.js has no `chrome.*` APIs. The content script validates `e.data.source === 'neuraltab-inject'` before acting on the message (origin check prevents malicious page code from spoofing NeuralTab messages).
2. **Content → Background:** `chrome.runtime.sendMessage` because content scripts have limited chrome.* access (no `chrome.tabs`, no `chrome.alarms`). The background has full API access.

**Security consideration in the relay:**
The content script should never blindly relay arbitrary page data to the background. The `RELAY_TO_BACKGROUND` handler validates that the message source is `'neuraltab-inject'` (our own injected script) before forwarding. A malicious page could call `window.postMessage({ source: 'neuraltab-inject', ... })` to inject fake messages — this is a known attack vector. Production extensions add additional validation (message schemas, HMAC signatures) for sensitive payloads.

---

## Decision 5: messageLog capped at 100, swLifecycleLog at 50

**Choice:** Different caps for the two logs.

**Why 100 for messageLog:**
Messages are the primary observable artifact of this module. A higher cap means you can watch a full Message Lab session without losing early entries. 100 entries × ~80 bytes ≈ 8 KB — well under the storage budget.

**Why 50 for swLifecycleLog:**
SW lifecycle events are less frequent (one per heartbeat alarm = one per 30s). 50 entries covers 25 minutes of heartbeats, which is more than enough to diagnose a restart pattern. The smaller cap keeps the display readable in the Options page log viewer.

**Eviction strategy — oldest first:**
Both logs use `splice(0, log.length - cap)` which removes from the front (oldest entries). This is O(n) but n is small enough to be irrelevant. For high-throughput production logs, a ring buffer or IndexedDB with cursor-based cleanup would be more efficient.

---

## Decision 6: Message Lab opens new tab from popup via chrome.tabs.create, not window.open

**Choice:** `chrome.tabs.create({ url: chrome.runtime.getURL('message_lab.html') })`.

**Rejected:** `window.open(chrome.runtime.getURL('message_lab.html'))`.

**Why `chrome.tabs.create`:**
- `window.open` from a popup often fails or opens a tiny floating window depending on the browser's popup blocker heuristics.
- `chrome.tabs.create` is the canonical, reliable way to open an extension page in a new tab. It always works, always opens in the current window, and the resulting tab is a full-sized browser tab.
- The URL must use `chrome.runtime.getURL()` to construct the full `chrome-extension://[id]/message_lab.html` URL. You cannot navigate to extension pages with relative paths from `window.open`.

**Why `message_lab.html` must be in `web_accessible_resources`:**
Extension pages opened via `chrome.tabs.create` are loaded as first-party extension pages and do NOT need to be in `web_accessible_resources`. The WAR declaration is needed only for resources loaded from web page contexts (e.g., a content script injecting an extension asset into a page). However, declaring it in WAR costs nothing and makes the URL accessible from any context, which is useful for debugging from the DevTools console.
