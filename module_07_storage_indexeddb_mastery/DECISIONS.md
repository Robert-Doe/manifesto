# Module 07 — Design Decisions

## Decision 1: IndexedDB instead of chrome.storage.local for page history

**Choice:** `neuraltab-history` IndexedDB database with a `page_visits` object store, indexes on `url`, `timestamp`, and `domain`.

**Rejected:** Storing visits as a JSON array in `chrome.storage.local`.

**Why IndexedDB wins for this use case:**
- `chrome.storage.local` has a 5 MB default quota (lifted with `unlimitedStorage`, but reads/writes still serialize the entire value). A 10,000-entry array encoded as JSON is ~2-3 MB — approaching the quota and getting slower on every read because Chrome deserializes the whole blob.
- IndexedDB lets you open a cursor on the `timestamp` index to read only the N most recent records. You never deserialize the entire dataset.
- IndexedDB supports indexes: finding all visits to a domain is O(log n) via the `domain` index, not O(n) linear scan.
- The background service worker can write to the same IDB database that the `history_db.html` page reads from — no storage.onChanged round-trip needed.

**Why the 10,000-entry cap:**
Space is cheap, but unbounded growth has non-obvious costs: longer IDB open times, larger browser backup files, user confusion. The `addVisit()` function checks `store.count()` before each insert and deletes the oldest cursor entry when at cap. This is O(1) cursor access (oldest entry is first by `autoIncrement` key) — not a full scan.

---

## Decision 2: Four storage types with distinct roles — not one type for everything

**Choice:** Use all four storage mechanisms with clear ownership:
- `chrome.storage.local` → all NeuralTab operational state (logs, counters, settings)
- `chrome.storage.sync` → future: user preferences small enough to sync across devices
- `chrome.storage.session` → future: transient per-browser-session state that should not survive restart
- `IndexedDB` → structured data at scale (page visit history)

**Why not store everything in chrome.storage.local:**
It is tempting to use one storage type for everything because the API is simple. The real costs appear at scale:
1. `chrome.storage.local.get(null)` (get everything) grows O(n) with data size. Callers that do this to check settings will accidentally read the entire message log.
2. `storage.onChanged` fires for every write to any key. High-frequency IDB data written through `chrome.storage.local` would flood all `onChanged` listeners in all open extension pages.
3. There is no queryability. Searching 10,000 entries requires full deserialization + JS filter. IndexedDB's cursor-on-index avoids this entirely.

**chrome.storage.session (MV3 only):**
Available in Chrome 102+. Cleared when the browser session ends (restart). Quota is 10 MB. Perfect for: per-session in-progress work, temporary UI state, and service worker → page communication that should not persist. NeuralTab uses it for `sessionData` as a demonstration in the options page.

---

## Decision 3: IDBManager is a plain IIFE, not a class

**Choice:** `const IDBManager = (() => { ... return { open, addVisit, searchVisits, ... }; })();`

**Rejected:** `class IDBManager { constructor() { ... } }`

**Why the module pattern:**
- `idb_manager.js` is loaded with `importScripts()` in the service worker and with a `<script>` tag in `history_db.html`. In the service worker, there is no `class` syntax concern, but the IIFE pattern makes `IDBManager` a global singleton automatically — no `new IDBManager()` call needed, no risk of multiple instances opening the same database simultaneously.
- The `_db` private variable in the closure captures the connection once and reuses it on every subsequent call. A class would require explicit instance management or a static member to achieve the same singleton behavior.
- The pattern mirrors `StorageManager`, keeping the codebase consistent.

**Connection reuse:** `IDBManager.open()` checks `if (_db) return Promise.resolve(_db)` before calling `indexedDB.open()`. This means the database is opened at most once per extension context lifetime. In the service worker, `onInstalled` calls `IDBManager.open()` eagerly to pay the connection cost upfront, so the first `logPageVisit` message does not incur it.

---

## Decision 4: Page visits are logged fire-and-forget from content.js

**Choice:** `content.js` calls `chrome.runtime.sendMessage({ action: 'logPageVisit', ... })` with no `await` and no error handler. Background processes the write asynchronously.

**Alternative considered:** Await the response and retry on failure.

**Why fire-and-forget is correct here:**
- A missing visit log entry is not a correctness failure. The user will not notice if one out of 10,000 visits is not recorded.
- Awaiting the IDB write inside the content script adds latency to every page load for no user-visible benefit.
- If the service worker has not started yet (first wake after idle), the message will fail. Retrying would require keepalive logic inside the content script, adding complexity for a low-value guarantee.
- The background's `logPageVisit` case also does fire-and-forget internally (`IDBManager.addVisit(...).catch(() => {})`). Storage failures are silently swallowed. This is intentional: a page history tool should never crash the extension.

**Contrast with Pattern 2 (echoRequest):** That requires `return true` and guaranteed response because the popup is waiting to display live data. Page visit logging has no waiting UI component — it is background bookkeeping.

---

## Decision 5: IDB cursor eviction is oldest-first (autoincrement order), not LRU

**Choice:** When the visit store hits 10,000 entries, delete the entry at the lowest autoincrement `id` (the oldest insert).

**Alternative:** Track a `lastSeen` timestamp and delete the least-recently-visited URL.

**Why insert-order eviction:**
- LRU requires reading all entries to find the minimum `lastSeen` — an O(n) scan on every write. At 10,000 entries this is noticeable.
- The `autoIncrement` primary key is already a cursor the IDB engine maintains. Opening it with `store.openCursor()` (no range, no direction) returns the oldest entry in O(log n) time.
- Insert-order approximately equals chronological order for a page history tool. The oldest inserts are almost always the oldest visits. The edge case (visiting a site repeatedly, never seeing it in the deleted batch) is acceptable for a learning tool.
- Production history tools (Chrome's own history, Firefox's Places) use time-based expiry, not LRU, for the same reason: simple, fast, predictable.

---

## Decision 6: getQuotaInfo() is a real-time call, not a cached value

**Choice:** `StorageManager.getQuotaInfo()` calls `chrome.storage.local.getBytesInUse(null)` on every invocation. It is not cached in a storage key.

**Why no caching:**
- `getBytesInUse` is a single IPC call to the browser process — it is fast (< 5ms) and does not deserialize any storage content.
- Caching quota in storage would itself consume quota and introduce staleness: if the message log grows by 1 KB, the cached value is wrong immediately.
- The popup and options page call this at most once on open. The SW monitor calls it periodically. The access pattern is low-frequency enough that caching adds complexity for no benefit.

**The 80% threshold:**
When `getQuotaInfo` returns `pct >= 80`, the heartbeat alarm sets `storageQuotaWarned: true` in storage, which triggers a `storage.onChanged` event. All open extension pages (popup, options) can react to display a warning badge. This is Pattern 4 (storage pub/sub) applied to operational monitoring.
