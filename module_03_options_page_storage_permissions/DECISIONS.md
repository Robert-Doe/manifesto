# DECISIONS.md — Module 03: Options Page, chrome.storage & Permissions UX Psychology

---

## Decision 1: chrome.storage.local Over localStorage

**Decision:** NeuralTab uses `chrome.storage.local` for all persistent data, never
`localStorage` or `sessionStorage`.

**Why:** `localStorage` is origin-scoped — it is partitioned by the page's origin
(`https://example.com`). A content script running on `https://example.com` has access
to that page's `localStorage`, but NeuralTab's popup and options page run at the
`chrome-extension://[id]/` origin — a completely different partition. If the content
script writes to `localStorage`, the popup cannot read it. `chrome.storage.local` is
extension-scoped: any context within the extension (popup, options, content script,
background worker, side panel) reads and writes the same key-value store, regardless
of which page it is injected into. This cross-context availability is what makes it
the correct choice for extension-wide state.

**Trade-off:** `chrome.storage.local` is asynchronous — every read and write is a
Promise. `localStorage` is synchronous — `localStorage.getItem('key')` returns
immediately. The async nature of `chrome.storage` means you cannot read settings in
the top-level synchronous scope of a content script; you must await them inside an
`async init()` function, which is why Module 03 introduces the `async init()` pattern.
In production, some teams cache the most-recently-read settings in a module-level
variable so that synchronous access is possible after the first async load. We
implement that caching layer in Module 07 alongside `chrome.storage.session`.

---

## Decision 2: StorageManager as a Shared File Loaded in Multiple Contexts

**Decision:** `storage_manager.js` is a plain JavaScript file (no `import`/`export`)
loaded by `manifest.json` content_scripts, by `popup.html`, and by `options.html`
all via `<script src>` tags — same file, three contexts.

**Why:** In Module 18 we switch to ES modules bundled by Vite, where we can `import`
a shared module cleanly. Until then, ES module syntax (`import`/`export`) does not
work in content scripts injected via `manifest.json` — Chrome requires a `"type":
"module"` attribute on `<script>` tags for ES modules, which the manifest injection
mechanism does not support. The `<script src>` approach works everywhere: the browser
executes the file in the current context, and the `StorageManager` object is attached
to the context's global scope. Each context gets its own copy of the object, but since
they all call the same `chrome.storage` API, they see the same data.

**Trade-off:** Loading `storage_manager.js` via `content_scripts` means it is injected
into every matching page alongside `content.js`. Every extra file injected into a page
adds a small startup cost (file parse + execution time). `storage_manager.js` is ~4KB
and executes in under 1ms on modern hardware, so the cost is negligible here. In a
production extension with many shared utilities, the correct solution is to bundle
everything into a single `content.bundle.js` with tree-shaking to eliminate unused
code — exactly what Module 18's Vite configuration does.

---

## Decision 3: Autosave on Every Input Change, No "Save" Button

**Decision:** `options.js` saves each setting immediately on its `input` or `change`
event. There is no Save button and no concept of "pending" or "unsaved" changes.

**Why:** The autosave pattern eliminates an entire class of user frustration — the
"I changed a setting and forgot to save" experience that plagues most desktop
applications. Because `chrome.storage.local.set()` is fast (typically under 5ms for
small payloads), the write is effectively instantaneous. Chrome's SQLite backend
handles durability: if the browser crashes immediately after a write, the data is
still safe because SQLite uses write-ahead logging (WAL) to guarantee atomic
commits. The `chrome.storage.onChanged` listener then propagates the new value to
all other open extension contexts — the popup and content script update their local
state without any explicit coordination.

**Trade-off:** Autosave makes it harder to implement "Cancel" or "Undo" because there
is no clean rollback point. Production extensions that need undo (e.g., dangerous
operations like "delete all reading history") should snapshot the current value before
making a change and provide an explicit undo action within a time window (the "toast
with undo" pattern). We implement this pattern in Module 07 when we build the full
IndexedDB storage layer for reading history.

---

## Decision 4: Optional Permissions with the "Warm Ask" Pattern

**Decision:** The `"tabs"`, `"bookmarks"`, and `"history"` permissions are NOT declared
in `manifest.json`. They are requested at runtime via `chrome.permissions.request()`
only after the user clicks a Grant button on the Permissions settings page — which is
shown after a full explanation of what the permission enables.

**Why:** Chrome's install-time permission prompt shows a generic list of everything
the extension requests. Users routinely click "Cancel" when they see entries like
"Read your browsing history" without context for why. Research consistently shows
that the grant rate for optional permissions requested at the moment of use is
significantly higher than for required permissions declared upfront. The "warm ask"
has three steps: (1) show the feature and its value before asking, (2) trigger the
ask from a deliberate user action (a button click — Chrome requires a user gesture
for `chrome.permissions.request()`), (3) handle the denial gracefully without
punishing the user.

**Trade-off:** Managing optional permissions adds complexity. Every piece of code
that uses an optionally-granted API must check at runtime whether the permission has
been granted, and degrade gracefully if not. A background worker that tries to call
`chrome.tabs.query({})` without the `"tabs"` permission will throw a runtime error.
We add permission guards throughout the codebase starting in Module 04, where
`"tabs"` is granted and used for the full tab manager.

---

## Decision 5: "options_page" Over "options_ui" in the Manifest

**Decision:** We declare `"options_page": "options.html"` rather than
`"options_ui": { "page": "options.html", "open_in_tab": false }`.

**Why:** `options_page` always opens in a new tab, giving us a full-page layout with
a sidebar navigation, a wide content area, and unrestricted viewport. `options_ui`
with `open_in_tab: false` embeds the options page inside the `chrome://extensions`
panel in a small fixed-size iframe — severely limiting the layout. Our settings page
has a sidebar, quota charts, colour pickers, and permission cards — it needs space.
`options_ui` with `open_in_tab: true` is functionally equivalent to `options_page`
but was introduced as a more explicit API in later Chrome versions. Either works;
`options_page` is simpler and has wider compatibility.

**Trade-off:** Opening in a tab means the user leaves the context of whatever they
were doing when they right-clicked the extension icon. Extensions with minimal settings
(one or two toggles) should use `options_ui` with `open_in_tab: false` to avoid this
context switch. NeuralTab's settings are too rich for an embedded panel, so the tab
approach is correct here.

---

## Decision 6: chrome.storage.onChanged for Live Cross-Context Updates

**Decision:** Both `options.js` and `content.js` register `StorageManager.onChange()`
listeners that react to storage changes from any other context.

**Why:** Without `onChange` listeners, a setting change in the options page would only
take effect the next time the content script runs (i.e., on the next page load).
The user experience would be: change highlight colour → switch back to the page →
see the old colour → reload → see the new colour. That is broken behaviour.
`chrome.storage.onChanged` is Chrome's native pub/sub mechanism for exactly this:
it fires in every extension context (popup, content scripts, options page, background
worker) whenever any storage value changes, with the old and new values provided.
This makes NeuralTab's settings feel live and instantaneous.

**Trade-off:** `onChanged` listeners accumulate if you add them in content scripts
without removing them when the content script is torn down. Each call to
`chrome.storage.onChanged.addListener()` adds another listener. If a content script
runs in a long-lived tab and the extension is reloaded (common during development),
the old listener may linger and fire alongside the new one, causing duplicate updates.
The production solution is to call `chrome.storage.onChanged.removeListener()` in
the content script's cleanup code, or to use a `WeakMap` to track registered
listeners. We address listener lifecycle management in Module 05 when we study
service worker event management patterns.
