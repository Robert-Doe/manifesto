# DECISIONS.md — Module 01: Hello Extension World & Manifest V3 Deep Dive

This document records every non-obvious implementation decision made in this
module. Each entry explains what was chosen, why, and what a production
extension would do differently.

---

## Decision 1: Manifest Version 3, Not Version 2

**Decision:** NeuralTab uses `"manifest_version": 3` exclusively from day one.

**Why:** Google deprecated Manifest V2 in January 2023 and began force-disabling
MV2 extensions in Chrome stable in June 2024. By the time you finish this course,
MV2 extensions will be entirely non-functional in Chrome. Building on MV3 from
the start means everything you learn is current and forward-compatible. MV2 also
allowed `background.page` (a persistent HTML page) and unrestricted
`webRequest` modification — both removed in MV3 for security and performance
reasons. Learning MV2 now would mean unlearning it later.

**Trade-off:** MV3 is more restrictive. The most painful loss is the ability to
modify network request bodies in flight (MV2's blocking `webRequest`). MV3 replaces
this with `declarativeNetRequest`, which is privacy-preserving but less flexible.
We cover `declarativeNetRequest` in depth in Module 09, and we recover full
request-body access via the Chrome DevTools Protocol in Modules 14–15.

---

## Decision 2: Zero Permissions Declared in manifest.json

**Decision:** `"permissions": []` and `"host_permissions": []` — NeuralTab
starts with no declared permissions whatsoever.

**Why:** Chrome shows users a permissions dialog when they install an extension.
Every permission you declare that isn't strictly necessary for the current feature
increases install friction and reduces trust. The principle of least privilege is
not just a security best practice — it directly affects your Chrome Web Store
conversion rate. We also prove a key insight: `chrome.tabs.query()` with
`{active: true, currentWindow: true}` works without the `"tabs"` permission.
Chrome only gates `"tabs"` when you want to read the URL/title of *background*
tabs (tabs the user is not currently looking at).

**Trade-off:** In production, you would declare permissions as late as possible
and use the Optional Permissions API (`chrome.permissions.request()`) to ask for
them at the moment the user tries a feature that needs them — not upfront at install.
We implement this exact pattern in Module 03, and we cover the psychology of
permission UX (why users deny and when to ask) in that same module.

---

## Decision 3: chrome.tabs.query() Called in popup.js, Not a Background Script

**Decision:** The tab-reading logic lives entirely in `popup.js`. There is no
`background.js` service worker yet.

**Why:** At this stage, NeuralTab only needs to know about the active tab *when
the popup is open*. Introducing a background service worker before it's needed
would add complexity without benefit. The popup has direct access to all
`chrome.*` APIs — it is a privileged extension page, just like a background
worker. The key difference is lifecycle: popup.js runs only while the popup is
visible; a service worker runs (briefly) in response to events. We don't have
events to respond to yet.

**Trade-off:** Once NeuralTab needs to react to events that happen when the popup
is closed — like an alarm firing, a tab being created, or a network request —
we will need a background service worker. This is introduced in Module 05, where
we also confront the hardest challenge of MV3: the service worker's 5-minute idle
kill. Do not store long-term state in service worker memory — use `chrome.storage`
instead. This is the single most common mistake MV3 beginners make.

---

## Decision 4: Fonts Loaded via Google Fonts CDN (googleapis.com)

**Decision:** `popup.css` loads Lato and Source Code Pro from `fonts.googleapis.com`
via a CSS `@import`.

**Why:** During development and local learning, this is the simplest approach
and requires no build tooling. The fonts load correctly as long as the user has
internet access when they open the popup.

**Trade-off:** Production extensions should NEVER load resources from external
CDNs. The Chrome Web Store's Content Security Policy for extension pages blocks
many external resource origins, and any external load is a privacy risk (the CDN
can see which users have your extension installed). The production fix is to
bundle font files locally and reference them via `web_accessible_resources` in
`manifest.json`. We implement this correctly in Module 02 when we introduce the
`web_accessible_resources` manifest key. Until then, the CDN is acceptable for
local development learning.

---

## Decision 5: Icons Generated via an HTML Canvas Tool, Not Checked into Git

**Decision:** PNG icon files are not committed to the course repository. Instead,
`icons/create_icons.html` generates them in-browser on demand.

**Why:** Binary files (PNGs) in a Git repository grow the repo size permanently —
Git stores every version of every binary. Derived assets that can be
deterministically regenerated from source should never be committed. The canvas
generator is the "source of truth" for the icon design; the PNGs are build
artifacts.

**Trade-off:** In a real extension project you would use a dedicated icon design
tool (Figma, Sketch, or Inkscape) as the source of truth, with a build script
(using `sharp`, `Jimp`, or ImageMagick) that generates all required sizes from
a single high-resolution SVG master. This is introduced in Module 18 when we set
up the full Vite + TypeScript production toolchain. At that point, `npm run build`
handles icon generation automatically.

---

## Decision 6: popup.html Uses a <script src="popup.js"> Tag, Not an Inline Script

**Decision:** JavaScript is in a separate `popup.js` file loaded via `<script src>`.
There is no `<script>` block inside `popup.html`.

**Why:** Manifest V3 enforces a strict Content Security Policy on all extension
pages. Inline scripts (`<script>alert('hi')</script>`) and inline event handlers
(`<button onclick="...">`) are **blocked by default** and will throw a CSP
violation error. This is a security feature: it prevents injected content from
executing arbitrary JavaScript in your extension's privileged context. All
JavaScript must live in separate `.js` files loaded via `src` attributes.

**Trade-off:** This restriction does not apply to content scripts injected into
web pages — those run in the page's context under the page's CSP, not the
extension's CSP. The extension's own pages (popup, options, sidepanel, background)
are always subject to the extension CSP. In Module 10 (V8 & Isolated Worlds) we
explore exactly why this boundary exists at the engine level.
