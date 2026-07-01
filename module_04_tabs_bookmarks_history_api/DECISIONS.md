# DECISIONS.md — Module 04: Tab API, Bookmarks, History & Browser API Survey

---

## Decision 1: Service Worker for background.js, Not a Persistent Background Page

**Decision:** The background script is declared as a service worker in the manifest
(`"background": { "service_worker": "background.js" }`), not as a persistent background
page or an event page.

**Why:** Manifest V3 eliminated persistent background pages entirely. The only supported
background execution model in MV3 is the service worker. A persistent background page
ran continuously for the lifetime of the extension, consuming memory even when idle.
Service workers are ephemeral — Chrome spawns them in response to events (alarms, messages,
tab events) and terminates them after roughly five minutes of idle time. This is
deliberately more resource-efficient, but it means you cannot store state in JavaScript
variables across events. Any data that must survive service worker restarts must be
written to `chrome.storage` before the service worker is killed.

**Trade-off:** The service worker lifecycle creates a class of bugs that did not exist
in MV2: "data disappears between events." Developers who come from MV2 often store
important state in module-level variables and are confused when it disappears. The fix is
always `chrome.storage` or another persistent mechanism. In Module 05 we study this
lifecycle in depth — including the exact timing of when Chrome kills a service worker
and how to extend its lifetime when necessary.

---

## Decision 2: chrome.alarms for Periodic Tab Analysis, Not setInterval

**Decision:** The 30-minute tab analysis is scheduled via `chrome.alarms.create()`, not
`setInterval()`.

**Why:** `setInterval()` runs on the JavaScript event loop of the current process.
When the service worker is terminated after five minutes of idle time, every
`setInterval()` callback is cancelled — the timers simply cease to exist. Chrome's
alarm system is external to the service worker process: alarms are registered with
Chrome's alarm scheduler (stored persistently, similar to the OS cron system), which
wakes the service worker and fires the `onAlarm` event at the scheduled time even if
the worker has been dead for hours. This is the only mechanism that reliably schedules
future work in an MV3 extension.

**Trade-off:** `chrome.alarms` has a minimum granularity of one minute — you cannot
schedule sub-minute alarms. In Chrome 120+, you can set `delayInMinutes: 0` for an
immediate one-shot alarm, but the minimum for recurring `periodInMinutes` is 0.5
(30 seconds). For sub-minute work (e.g., polling a WebSocket or checking a flag every
10 seconds), you must keep the service worker alive using a keepalive port — a pattern
we implement in Module 05.

---

## Decision 3: StorageManager Not Available in background.js — Direct chrome.storage Used

**Decision:** `background.js` calls `chrome.storage.local.get()` and `.set()` directly,
without using the `StorageManager` helper defined in `storage_manager.js`.

**Why:** `storage_manager.js` is loaded via `<script src>` tags in HTML pages (popup,
options, tab_manager) and via the `content_scripts.js` array in the manifest for content
scripts. A service worker cannot use `<script src>` and cannot be listed alongside content
scripts in the manifest. Service workers have their own module loading mechanism:
`importScripts()` (classic mode) or ES `import` statements (module mode, enabled by
`"type": "module"` in the background declaration). Since Module 04 uses classic mode for
simplicity, we call `chrome.storage` directly in the background. Module 05 introduces
`importScripts('storage_manager.js')` to share the abstraction across all contexts,
including the background worker.

**Trade-off:** Duplicating the DEFAULTS object between `storage_manager.js` and
`background.js` is a maintenance hazard — if someone adds a new setting to DEFAULTS in
`storage_manager.js` and forgets to update the inline defaults in `background.js`, the
background worker will write stale values. The fix (Module 05's `importScripts`) eliminates
this duplication entirely.

---

## Decision 4: Tab URL Redaction Without the "tabs" Permission

**Decision:** The popup reads `chrome.tabs.query({})` to count all tabs without the
`"tabs"` optional permission. If the permission is not granted, the idle tab count
displays `"?"` rather than crashing.

**Why:** This is the most surprising behaviour in the Chrome tab API: `chrome.tabs.query()`
succeeds and returns Tab objects even without the `"tabs"` permission, but the `url`,
`title`, and `pendingUrl` fields are set to empty strings. You can count the tabs, read
their IDs, check if they are pinned or audible, but you cannot read their URLs. This
distinction matters for the popup: it can always show the total tab count, but it can only
show the idle tab count (which requires knowing which tabs are on background/inactive pages
vs. actively-used pages) when the user has granted the tabs permission. The popup
gracefully downgrades rather than throwing.

**Trade-off:** This "graceful degradation by empty string" behaviour is subtle and can
cause confusing bugs. A developer who expects `tab.url` to throw when the permission is
missing will be surprised that it silently returns an empty string instead. The correct
pattern is always to check `chrome.permissions.contains({ permissions: ['tabs'] })` before
assuming tab URLs are populated — or to test with permission revoked before shipping.

---

## Decision 5: Tab Groups API Requires No Extra Permission

**Decision:** `chrome.tabs.group()` and `chrome.tabGroups.update()` are called from
`background.js` without any additional permission declaration.

**Why:** The Tab Groups API was explicitly designed to require no extra permission beyond
the normal extension-to-browser relationship. Grouping tabs is a cosmetic UI operation —
it doesn't reveal any sensitive user data (the tab's URL is already readable if "tabs" is
granted, and you need the tab IDs to group them anyway). Chrome's philosophy is that APIs
which only rearrange already-accessible data should not require separate permissions.
The Tab Groups API follows this principle: if you already have tab IDs (from `tabs.query()`),
you can group those tabs without additional user consent.

**Trade-off:** Tab Groups is available only from Chrome 89+. On older Chrome versions,
`chrome.tabGroups` is `undefined`. NeuralTab wraps the group operations in a `try/catch`
and a null check (`if (!chrome.tabGroups) return null`) to gracefully degrade on older
versions. In a production extension targeting older Chrome versions, you would add a
`minimum_chrome_version` to the manifest to filter CWS search results appropriately.

---

## Decision 6: Bookmark Folder Created in "Other Bookmarks", Not Bookmark Bar

**Decision:** `chrome.bookmarks.create({ title: 'NeuralTab Saves' })` is called without
a `parentId`, which places the folder in "Other Bookmarks" (node ID `"2"`).

**Why:** The bookmark bar (node ID `"1"`) is prime real estate — users curate it
carefully and are protective of what appears there. An extension that adds a folder
to the bookmark bar without asking is rude. "Other Bookmarks" is the conventional
location for programmatically-created folders: it does not appear in the primary browser
UI (it is collapsed by default in the bookmarks bar) but is easily accessible via the
bookmarks manager. Extensions like Pocket, Evernote Web Clipper, and Instapaper all
follow this convention, placing their saved content in Other Bookmarks folders rather
than polluting the bookmark bar.

**Trade-off:** Users who have many bookmarks in "Other Bookmarks" may not immediately
find the "NeuralTab Saves" folder. A production extension could add a link directly to
the folder in the Tab Manager sidebar using `chrome.bookmarks.getSubTree('2')` to navigate
to the folder's ID. We implement this in Module 07 when we build the full reading history
and bookmarks integration.
