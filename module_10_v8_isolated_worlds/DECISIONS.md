# Module 10 — DECISIONS.md: V8 Engine & Isolated Worlds

## Decision 1: Why Two V8 Heaps Instead of One

Chrome runs extension content scripts in an **isolated world** — a separate V8 context that shares the same DOM but has its own JavaScript heap. The page's scripts run in the **MAIN world**. This means `window.__pageSecret` set by page JS is completely invisible to your content script's `window` object.

**Why Chrome did this:** Security. Without isolation, any malicious page script could override `Array.prototype.push` or `Promise` before your extension code runs, injecting into the extension's execution. The isolated heap protects extension logic from page prototype pollution.

**Trade-off:** You lose the ability to directly read or call page functions. You must use `chrome.scripting.executeScript({ world: 'MAIN' })` to deliberately cross into page context, which is an explicit, auditable choice.

## Decision 2: `world: 'MAIN'` Requires `scripting` Permission

`chrome.scripting.executeScript` with `world: 'MAIN'` requires the `scripting` permission and `host_permissions` for the target page. The extension must declare `<all_urls>` or the specific origin to inject into the page heap.

**The implication:** If an extension needs to read a SPA framework's router state (`window.__nuxt`, `window.__REDUX_STATE__`), it must execute in MAIN world — but doing so exposes the extension to any prototype pollution the page has already applied. Consider this a deliberate trust escalation.

## Decision 3: DOM is Shared, JS Heap is Not

Both ISOLATED and MAIN world scripts see the same DOM tree. `document.title`, `document.body`, DOM event listeners — all shared. The separation is purely at the JavaScript object level (V8 heap allocation).

**Practical consequence:** Content scripts can safely read and mutate the DOM, add event listeners, and call DOM APIs. What they cannot do is read JavaScript variables or call JavaScript functions defined by the page. This distinction trips up many extension developers who expect `window` to be fully shared.

## Decision 4: `new Function('return ' + code)` vs. Serialized Functions

The Chrome scripting API requires `func` to be a serializable JavaScript function. When injecting dynamic expressions from the demo UI, we use `new Function('return ' + code)` to wrap an expression string. The serialization converts the function to source text for transmission to the target tab.

**Security note:** Never use this pattern with untrusted user input outside a developer tool. In the world_demo.html context, the user is a developer exploring the API, and the tab target is their own browser — acceptable. In production extensions, always pass static functions with typed `args` for parameterization instead.

## Decision 5: Why Content Scripts Can't Use `chrome.scripting`

Content scripts run in the extension's isolated world but with significant API restrictions. `chrome.scripting` is a background-only API — content scripts cannot call `executeScript`. The reason is privilege separation: content scripts run in the context of web pages and could be compromised by page content. Allowing them to inject into any tab would be an escalation.

The correct pattern when content script logic needs to execute in MAIN world: send a message to the background service worker, which then calls `chrome.scripting.executeScript` back into the original tab's MAIN world. One extra round-trip for substantially better security architecture.

## Decision 6: `functon` Serialization Doesn't Capture Closures

When you pass `func: () => someVar` to `executeScript`, `someVar` from the calling context is NOT captured. The function is serialized to its source text and re-evaluated in the target context, losing all closure bindings. Use the `args` parameter to pass data explicitly: `args: [someVar]` and `func: (v) => doSomething(v)`.

**Why this catches developers:** Arrow functions in normal JS do capture closures, so the mental model breaks in `executeScript`. This is arguably the single most common error developers make when first using the scripting API.
