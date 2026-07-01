# Module 05 — Design Decisions

## Decision 1: importScripts() over duplicating StorageManager in background.js

**Choice:** `importScripts('storage_manager.js')` as the first line of `background.js`.

**Rejected:** Copy-pasting StorageManager code into background.js (what Module 04 did as a placeholder).

**Why importScripts wins:**
- Single source of truth: DEFAULTS, `get`, `set`, `logSwEvent`, and every future method live in one file.
- Module 04 already had divergence: background.js had its own `DEFAULTS` object while `storage_manager.js` had another. Two copies, two places to forget to update.
- Chrome's classic-mode service workers support synchronous `importScripts()` without any bundler. It executes before any other code in the file, making the imported globals immediately available.

**Why not ES modules (`import` statement)?**
- Requires `"type":"module"` in the manifest background entry.
- ES module SWs cannot use `importScripts()`.
- Static imports need relative paths and have had minor Chrome bugs with SW re-imports after updates.
- For a no-bundler curriculum, classic + `importScripts()` has zero sharp edges.

**Why not a bundler (Webpack/Rollup)?**
- A bundler would merge everything into one file, eliminating the question entirely.
- That's the right call for production (Module 18 covers this).
- For learning, separate files mean you can read each file in isolation in DevTools.

**Real-world trade-off:** Every large extension eventually moves to a bundler. `importScripts()` is the bridge strategy for small-to-medium projects that want shared code without build tooling.

---

## Decision 2: Keepalive port over alarms-only for worker longevity

**Choice:** `chrome.runtime.connect()` port with 25-second ping loop.

**Rejected:** Relying solely on the `sw-heartbeat` alarm (30-second period) to keep the worker alive.

**Why the port wins:**
- An open port counts as an active event, preventing the idle countdown from starting in the first place.
- The alarm can fire at most every 30 seconds. Chrome's idle timer starts after ~30 seconds of no events. If the alarm fires at second 31, the countdown has already started.
- The port + 25-second ping creates overlapping coverage with no gaps.

**Why not WebSocket?**
- WebSockets can also keep a worker alive but require a server endpoint.
- The port is pure Chrome API, zero infrastructure.

**Why 25 seconds specifically?**
- Chrome's idle threshold is approximately 30 seconds before the countdown begins.
- 25 seconds gives a 5-second safety margin for timer jitter and CPU scheduling delays.
- Values below 10 seconds would drain battery; values above 28 seconds risk missing the window.

**Important caveat:** Keepalive is appropriate for tools where the user is actively using the extension (the SW Monitor page is open). Do not keep the worker alive unconditionally — you would prevent Chrome from reclaiming memory when the extension is idle and the user has closed all NeuralTab pages.

**Real-world trade-off:** The keepalive port is a power tool. Use it only when a page is actively open, disconnect it when the page closes (the `port.onDisconnect` handler fires automatically).

---

## Decision 3: inMemoryEventCounter as proof of restart — not swStartCount

**Choice:** A module-level `let inMemoryEventCounter = 0` that increments on every message, plus a separate `swStartCount` in `chrome.storage.local`.

**Why both?**
- `inMemoryEventCounter` resets to 0 on every worker restart. When the SW Monitor shows this value jumping back to 0 after you waited 5 minutes, the restart is *visually obvious*.
- `swStartCount` never resets because it lives in storage. It gives you the cumulative lifetime restart count.
- Together they answer two different questions: "Did the worker restart since I last looked?" (inMemory) and "How many total times has the worker started since install?" (storage).

**What is NOT a good proof of restart:**
- Checking the timestamp alone (you'd need a reference point).
- Using a random ID generated at import time (same idea as inMemory counter, but less intuitive to read in a UI).
- Using `chrome.alarms.getAll()` — alarms persist across restarts; they prove nothing about the current worker instance.

**Real-world application:** This same pattern is used in production extensions to detect unexpected worker restarts during long operations (e.g., a background sync job that should complete in one worker lifetime).

---

## Decision 4: 30-second heartbeat alarm period — not longer

**Choice:** `'sw-heartbeat'` alarm with `periodInMinutes: 0.5` (30 seconds, the Chrome minimum).

**Rejected:** Longer periods like 1 minute or 5 minutes.

**Why the minimum?**
- The heartbeat alarm is the fallback for when the keepalive port is NOT open (user hasn't opened the SW Monitor page).
- If the alarm fires every 5 minutes, the worker could be dead for 4 minutes and 59 seconds before being woken. Any queued storage events or pending tasks accumulate.
- At 30 seconds, worst-case worker downtime is 30 seconds — acceptable for background maintenance tasks.
- Chrome enforces the 30-second minimum anyway; values below `0.5` are silently clamped.

**Power consumption trade-off:**
- Waking a worker every 30 seconds is not free: there's ~1–5ms CPU overhead per wake.
- In production, if your extension has no time-sensitive background work, you might drop the heartbeat alarm entirely and only use `chrome.alarms` for actual scheduled tasks (tab analysis at 30 minutes).
- For Module 05, the heartbeat's value is pedagogical — it's the "wakes" increment you see counting up in the popup.

**Real-world trade-off:** Battery-conscious extensions on laptops push alarm periods as long as possible. Extensions that need guaranteed freshness (real-time stock tickers, live sports scores) keep periods short and accept the power cost.

---

## Decision 5: tabAccessTimes capped at 200 entries

**Choice:** In `chrome.tabs.onActivated`, write tab access timestamps to `tabAccessTimes` in storage, but evict the oldest entries when the map exceeds 200.

**Why a cap?**
- Tab IDs are session-scoped: they reset when Chrome restarts. Storing them forever just wastes storage.
- Users with many tabs open and closed over a long Chrome session could accumulate thousands of stale entries.
- 200 entries × ~30 bytes per entry ≈ 6 KB — trivial compared to the 5 MB `chrome.storage.local` quota.

**Why not session storage (`chrome.storage.session`)?**
- Session storage would be perfect for tab IDs (they're session-scoped), but session storage was introduced in Chrome 102 and the minimum Chrome target for MV3 is 88.
- Session storage is covered in Module 07 alongside full Storage Mastery.

**Eviction strategy — oldest first:**
```js
const entries = Object.entries(times).sort(([,a],[,b]) => a - b);
while (entries.length > 200) entries.shift();
```
Sorting by timestamp and dropping the smallest (oldest) values is O(n log n) but n ≤ 200, so negligible.

**Real-world trade-off:** In a production extension tracking tab analytics, you'd pair tabAccessTimes with tab close events to clean up removed tabs proactively rather than waiting for eviction.

---

## Decision 6: SW Monitor polls every 2 seconds instead of using storage.onChanged

**Choice:** `setInterval(pollWorkerState, 2000)` in `sw_monitor.js`, which calls `sendMessage({ action: 'getWorkerState' })`.

**Rejected:** Relying on `StorageManager.onChange()` to update the live metrics display.

**Why polling wins here:**
- `inMemoryEventCounter` and `uptime` are **in-memory** values — they don't exist in storage and can never trigger `onChanged`.
- Only a direct `sendMessage` to the running worker can retrieve these ephemeral values.
- `uptime` must be recalculated on every read (`Date.now() - SW_START_TIME`) — you can't store it.

**Hybrid approach used:**
- The lifecycle log and `swStartCount` are in storage → `StorageManager.onChange()` handles those.
- Live worker metrics (counter, uptime, ports, status) → 2-second poll via sendMessage.
- This is the minimum hybrid: use reactive updates where possible, poll only for what genuinely can't be reactive.

**2 seconds specifically:**
- Fast enough to show the counter incrementing naturally.
- Slow enough to avoid spamming the message channel (Chrome DevTools shows message traffic).
- The worker's HEARTBEAT alarm fires every 30 seconds; we don't need sub-second polling to catch that.

**Real-world trade-off:** Polling is simpler to implement and debug but less efficient than events. For a developer-tool page that's only open when you're actively debugging the extension, a 2-second poll is perfectly appropriate. For a page that's always open (like a sidebar), you'd want to minimize polling and maximize event-driven updates.
