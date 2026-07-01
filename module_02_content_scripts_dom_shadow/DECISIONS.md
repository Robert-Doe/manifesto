# DECISIONS.md — Module 02: Content Scripts, DOM Surgery & Web Accessible Resources

---

## Decision 1: Shadow DOM for the Floating Button, Not a Plain div

**Decision:** The NeuralTab floating button and panel are mounted inside a Shadow DOM
subtree (`host.attachShadow({ mode: 'open' })`), not directly as children of `document.body`.

**Why:** When you inject a plain `<div>` into an arbitrary web page, you fight every
CSS rule on that page. A page might have `* { font-size: 12px !important }`, or a
`button { background: red }` rule that targets your button, or a `z-index` stacking
context that buries your overlay under the page's own modals. These conflicts are
impossible to predict because we inject into thousands of different pages. Shadow DOM
creates a hard style boundary: the page's CSS cannot reach inside the shadow root, and
our shadow-root CSS cannot bleed out. Our button always looks exactly as designed.

**Trade-off:** Shadow DOM has two costs. First, DevTools inspection is slightly harder —
the shadow tree appears as a nested `#shadow-root` in the Elements panel. Second,
`mode: 'open'` means page JavaScript can reach our shadow root via `host.shadowRoot`
and potentially tamper with our UI. Production extensions (like Grammarly) use
`mode: 'closed'` and additional obfuscation to make tampering harder. We use `'open'`
during learning because it makes DevTools inspection easy. We revisit this tradeoff in
Module 11 (Extension Fingerprinting) where we harden NeuralTab's injection against
detection and tampering.

---

## Decision 2: content.css Injected by Chrome, Not by content.js

**Decision:** We declare `content.css` in `manifest.json` under `content_scripts.css`
rather than having `content.js` create a `<style>` element and inject it manually.

**Why:** Chrome's declarative CSS injection is more reliable and faster than manual
injection. When Chrome injects a content script, it injects the CSS first — before
any JavaScript runs. This eliminates a flash of unstyled content (FOUC) for the host
element. Declarative injection also means the CSS is applied even if `content.js`
throws an early error. The separation of concerns is cleaner: `manifest.json` owns
the injection configuration, not the script itself.

**Trade-off:** Declarative CSS injection applies to the page's real DOM style scope,
not to our Shadow DOM. This is why `content.css` only styles `#neuraltab-host` (the
real-DOM host element), while all Shadow DOM styles live inside `getButtonStyles()`
in `content.js`. In a production extension using the Module 18 Vite toolchain, a
PostCSS plugin can inject shadow-root styles as a template literal at build time,
keeping the styles in `.css` source files while delivering them via JS.

---

## Decision 3: Main-World Injection via <script src> Tag, Not chrome.scripting world:"MAIN"

**Decision:** `inject.js` is injected by creating a `<script src="...">` element in
`content.js`, rather than using `chrome.scripting.executeScript({ world: 'MAIN' })`.

**Why:** `chrome.scripting.executeScript` with `world: 'MAIN'` requires the `scripting`
permission declared in `manifest.json`. Since we are maintaining a zero-permissions
manifest for as long as possible (Decision 2 from Module 01), we use the `<script>` tag
approach instead — it requires only `web_accessible_resources`, which is a manifest
key rather than a `permissions` entry. The `<script>` tag approach also runs
synchronously during page load, which means `inject.js` executes before the page's own
deferred scripts and can capture early initialisation state.

**Trade-off:** The `<script>` tag approach leaves the injected element in the DOM
briefly (we remove it via `script.onload`). Any page script running in that window
can detect the chrome-extension:// URL in the `src` attribute before removal —
this is one of the five extension fingerprinting vectors covered in Module 11. The
`chrome.scripting.executeScript({ world: 'MAIN' })` approach is cleaner (no DOM
element, no detectable URL) but requires the `scripting` permission. We add that
permission in Module 04 where we begin using `chrome.scripting` regularly, and we
switch `inject.js` to use `world: 'MAIN'` at that point.

---

## Decision 4: MutationObserver on document.body for SPA Detection

**Decision:** We watch for SPA navigation by observing `document.body` for `childList`
mutations and comparing `location.href` before and after.

**Why:** There is no reliable cross-framework event for "the SPA just navigated."
React Router, Next.js, Vue Router, and Angular all call `history.pushState` internally,
but listening to `history.pushState` requires monkey-patching the native function —
fragile and detectable. The `popstate` event fires on browser back/forward but not on
programmatic navigation. MutationObserver on `document.body` with `childList: true`
and `subtree: true` catches every case because all SPAs mutate the DOM when navigating.
We compare the URL before and after the mutation to distinguish a real navigation from
an in-place DOM update (like an infinite scroll loading new posts).

**Trade-off:** Observing the entire body subtree is expensive on DOM-heavy pages. A
MutationObserver with `subtree: true` fires hundreds of times per second on a page
doing a lot of DOM work (live dashboards, video players with dynamic captions, chat
apps). The production pattern is to use a `debounce` or `throttle` wrapper around
the callback so URL comparison only runs at most once every 100ms. We add that
optimisation in Module 20 (Performance & Memory Optimization) where we profile
NeuralTab's CPU cost across different page types and discover this is one of the top
three CPU consumers.

---

## Decision 5: TreeWalker for Word Counting, Not innerHTML Split

**Decision:** `countWords()` uses `document.createTreeWalker` with `SHOW_TEXT` to
walk text nodes, not `document.body.innerText.split(/\s+/)`.

**Why:** `innerText` triggers a style recalculation (reflow) to determine which text is
visible, which is expensive on large pages. `innerHTML` includes tag names, attribute
values, and HTML entities in the text — `<div class="header">` would add "div", "class",
and "header" to the word count. `innerText` is better but still includes hidden elements
and navigation text. The TreeWalker approach lets us filter out `<script>`, `<style>`,
`<noscript>`, and our own injected elements via the `acceptNode` filter, giving us only
the readable content text nodes. The result is significantly more accurate on real
article pages.

**Trade-off:** TreeWalker is less familiar to most JavaScript developers than
`innerText`. The POSIX `createTreeWalker` API with filter callbacks is verbose.
In Module 13 (WebAssembly) we replace the word count with a compiled WASM function
that processes text at near-native speed — 10x faster on long documents and with
better Unicode word-boundary handling than our regex approach.

---

## Decision 6: "<all_urls>" Match Pattern, Not Specific Domains

**Decision:** `content_scripts.matches` is set to `["<all_urls>"]`, injecting
NeuralTab into every page the user visits.

**Why:** NeuralTab is a general-purpose AI reading assistant — it should be available
on every page, not just a pre-defined list of domains. The user should not need to
whitelist sites to get the Summarize button. `<all_urls>` matches `http://`, `https://`,
`ftp://`, and `file://` URLs. Chrome automatically excludes injection into its own
internal pages (`chrome://`, `chrome-extension://`) regardless of what match pattern
you specify.

**Trade-off:** `<all_urls>` in `host_permissions` triggers a "Read and change all your
data on all websites" permission warning during installation — one of the most alarming
warnings Chrome shows. Users are three times more likely to decline installation when
they see this. Production extensions that can operate on a narrower set of domains
should do so. Since NeuralTab genuinely needs all URLs, the correct mitigation is
the "optional host permissions" pattern: ship with no host permissions declared,
request `<all_urls>` as an optional permission when the user first clicks Summarize,
explain clearly why it is needed. We implement this in Module 03 when we cover
Permissions UX Psychology.
