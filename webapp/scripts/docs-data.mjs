/**
 * Single source of truth for "Read the Primary Sources" links across all 25
 * modules. Modules 1-2 are transcribed verbatim from their own tutorial.html
 * (which already had real .spec-ref cards with links). Modules 3-25 are new:
 * every URL below was fetched and confirmed live during authoring — no
 * invented links. Consumed by generate-content.mjs, which both emits
 * content.generated.ts for the webapp AND patches modules 3-25's
 * tutorial.html with a matching "Read the Primary Sources" section.
 */
export const DOCS = {
  1: [
    {
      title: 'Manifest V3 Overview',
      description:
        'The official Chrome developer documentation covering every manifest key, MV2→MV3 migration, and the rationale behind each change.',
      url: 'https://developer.chrome.com/docs/extensions/mv3/intro/',
    },
    {
      title: 'chrome.action API Reference',
      description:
        'Every method and event for controlling the toolbar button: setBadgeText, setBadgeBackgroundColor, setIcon, setTitle, setPopup, onClicked.',
      url: 'https://developer.chrome.com/docs/extensions/reference/action/',
    },
    {
      title: 'chrome.tabs API Reference',
      description:
        'The full Tab object schema, query filter options, and every method. Pay special attention to the permissions column — it tells you which calls need "tabs" and which do not.',
      url: 'https://developer.chrome.com/docs/extensions/reference/tabs/',
    },
    {
      title: 'Chrome Web Store Developer Program Policies',
      description:
        'The legal document that governs what extensions can and cannot do. Reading it now saves you from a surprise removal letter later.',
      url: 'https://developer.chrome.com/docs/webstore/program-policies/',
    },
  ],
  2: [
    {
      title: 'Content Scripts',
      description:
        'Official Chrome docs. Covers match patterns, run_at timing, all_frames, isolated worlds, and the full list of APIs available to content scripts vs background workers.',
      url: 'https://developer.chrome.com/docs/extensions/mv3/content_scripts/',
    },
    {
      title: 'Match Patterns',
      description:
        'The complete syntax for URL pattern matching. Learn the difference between <all_urls>, https://*/*, and https://example.com/*.',
      url: 'https://developer.chrome.com/docs/extensions/mv3/match_patterns/',
    },
    {
      title: 'Web Accessible Resources',
      description:
        'The full spec for the web_accessible_resources manifest key. Pay attention to the MV2 vs MV3 syntax difference (MV3 requires the matches field).',
      url: 'https://developer.chrome.com/docs/extensions/mv3/manifest/web_accessible_resources/',
    },
    {
      title: 'Shadow DOM (MDN)',
      description:
        'The definitive guide to Shadow DOM: open vs closed mode, CSS scoping, the :host selector, slotting, and how browsers render shadow trees.',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM',
    },
    {
      title: 'TreeWalker (MDN)',
      description:
        'Complete reference for document.createTreeWalker(), all NodeFilter constants, and the acceptNode callback. Used in this module’s word counter.',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/TreeWalker',
    },
  ],
  3: [
    {
      title: 'chrome.storage API',
      description:
        'Reference for storage.local, storage.sync, storage.session, and the onChanged event this module’s options page listens to.',
      url: 'https://developer.chrome.com/docs/extensions/reference/api/storage',
    },
    {
      title: 'chrome.permissions API',
      description:
        'request(), contains(), and remove() — the runtime permissions API this module uses instead of asking for everything at install time.',
      url: 'https://developer.chrome.com/docs/extensions/reference/api/permissions',
    },
    {
      title: 'Declare Permissions',
      description:
        'Official guide to permissions, optional_permissions, host_permissions, and optional_host_permissions — and why least-privilege matters for install-time trust.',
      url: 'https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions',
    },
  ],
  4: [
    {
      title: 'chrome.tabs API',
      description: 'query(), create(), remove(), update(), group(), and the onUpdated/onActivated/onRemoved events.',
      url: 'https://developer.chrome.com/docs/extensions/reference/api/tabs',
    },
    {
      title: 'chrome.bookmarks API',
      description: 'create(), getRecent(), search() — the bookmarks tree this module reads and writes.',
      url: 'https://developer.chrome.com/docs/extensions/reference/api/bookmarks',
    },
    {
      title: 'chrome.history API',
      description: 'search() and getVisits() — querying the browser’s history store, one of the optional permissions this module requests on demand.',
      url: 'https://developer.chrome.com/docs/extensions/reference/api/history',
    },
    {
      title: 'chrome.alarms API',
      description: 'create() and the onAlarm event — the only way a service worker can reliably wake up later, since setTimeout does not survive a worker being killed.',
      url: 'https://developer.chrome.com/docs/extensions/reference/api/alarms',
    },
  ],
  5: [
    {
      title: 'Extension Service Worker Lifecycle',
      description:
        'The official page this whole module is built on: exact idle/shutdown conditions ("30 seconds of inactivity", the 5-minute request cap), the install/onInstalled/activate sequence, and why global variables don’t survive a restart.',
      url: 'https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle',
    },
    {
      title: 'chrome.alarms API',
      description: 'The keepalive/heartbeat mechanism this module’s background.js uses to survive past the idle timeout for scheduled work.',
      url: 'https://developer.chrome.com/docs/extensions/reference/api/alarms',
    },
    {
      title: 'Service Worker API (MDN)',
      description: 'The underlying web-platform primitive Chrome extension service workers are built on — install/activate events, and why they’re fundamentally different from a persistent background page.',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API',
    },
  ],
  6: [
    {
      title: 'Message Passing',
      description:
        'Official concepts guide covering all message-passing shapes: one-off requests, long-lived connections (ports), and messaging across extensions.',
      url: 'https://developer.chrome.com/docs/extensions/develop/concepts/messaging',
    },
    {
      title: 'chrome.runtime API',
      description: 'onMessage, sendMessage, connect(), and the Port object — the four real patterns this module’s background.js router implements.',
      url: 'https://developer.chrome.com/docs/extensions/reference/api/runtime',
    },
    {
      title: 'Window: postMessage() (MDN)',
      description: 'The underlying structured-clone message-passing primitive — useful context for why sendResponse must be called synchronously unless you "return true".',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage',
    },
  ],
  7: [
    {
      title: 'chrome.storage API',
      description: 'Quota limits per area (local vs sync vs the unlimitedStorage permission) — the numbers this module’s eviction policy is built around.',
      url: 'https://developer.chrome.com/docs/extensions/reference/api/storage',
    },
    {
      title: 'IndexedDB API (MDN)',
      description: 'The definitive reference for object stores, indexes, transactions, and cursors — everything idb_manager.js wraps.',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API',
    },
    {
      title: 'chrome.tabGroups API',
      description: 'The tabGroups permission this module moves from optional to granted-at-install, used alongside the history store.',
      url: 'https://developer.chrome.com/docs/extensions/reference/api/tabGroups',
    },
  ],
  8: [
    {
      title: 'chrome.runtime API',
      description: 'The onInstalled event and its "reason" field ("install" vs "update") that this module’s migration system branches on.',
      url: 'https://developer.chrome.com/docs/extensions/reference/api/runtime',
    },
    {
      title: 'IDBOpenDBRequest: upgradeneeded event (MDN)',
      description: 'How IndexedDB’s own version-bump mechanism works — the same oldVersion/newVersion pattern this module’s schema migrations mirror for chrome.storage.',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/IDBOpenDBRequest/upgradeneeded_event',
    },
  ],
  9: [
    {
      title: 'chrome.declarativeNetRequest API',
      description: 'The full rule schema (condition/action, priority, resource types) that replaced MV2’s blocking webRequest.',
      url: 'https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest',
    },
    {
      title: 'Network Requests (concepts)',
      description: 'Official guide to making and intercepting network requests from an extension, including host_permissions requirements.',
      url: 'https://developer.chrome.com/docs/extensions/develop/concepts/network-requests',
    },
    {
      title: 'chrome.webNavigation API',
      description: 'Event-based visibility into navigations (onBeforeNavigate, onCommitted) that this module pairs with declarativeNetRequest for observability.',
      url: 'https://developer.chrome.com/docs/extensions/reference/api/webNavigation',
    },
  ],
  10: [
    {
      title: 'chrome.scripting API',
      description: 'executeScript() and the "world" option (ISOLATED vs MAIN) — the exact mechanism this module is about.',
      url: 'https://developer.chrome.com/docs/extensions/reference/api/scripting',
    },
    {
      title: 'Content Scripts (concepts)',
      description: 'Chrome’s own explanation of isolated worlds: a private execution environment sharing the DOM but not the page’s JS heap.',
      url: 'https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts',
    },
  ],
  11: [
    {
      title: 'Web Accessible Resources',
      description: 'Why an unlisted resource 404s from a page context, and why listing one makes it fingerprintable — the manifest key at the center of extension detection.',
      url: 'https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources',
    },
    {
      title: 'Content Scripts (concepts)',
      description: 'What a page actually can and cannot observe about an injected content script — the boundary this module’s detection techniques probe.',
      url: 'https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts',
    },
  ],
  12: [
    {
      title: 'chrome.identity API',
      description: 'launchWebAuthFlow() — the sanctioned way to run an OAuth redirect flow without a bundled webview, including the interactive-flow UX requirement.',
      url: 'https://developer.chrome.com/docs/extensions/reference/api/identity',
    },
    {
      title: 'RFC 6749 — The OAuth 2.0 Authorization Framework',
      description: 'The actual IETF standard: authorization code, implicit, client credentials grants, and the redirect-URI security model this module implements against.',
      url: 'https://www.rfc-editor.org/rfc/rfc6749',
    },
    {
      title: 'Using OAuth 2.0 to Access Google APIs',
      description: 'Google’s own OAuth2 implementation guide — concrete client-ID setup and scopes for a real external API this module talks to.',
      url: 'https://developers.google.com/identity/protocols/oauth2',
    },
  ],
  13: [
    {
      title: 'Manifest — Content Security Policy',
      description: 'The minimum required extension-page CSP, including \'wasm-unsafe-eval\' — the exact directive that must be present before WebAssembly.instantiate() is allowed to run.',
      url: 'https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy',
    },
    {
      title: 'WebAssembly (MDN)',
      description: 'The JS API surface (WebAssembly.instantiate, .compile, Memory, Table) this module’s wasm_demo.html calls into.',
      url: 'https://developer.mozilla.org/en-US/docs/WebAssembly',
    },
    {
      title: 'Web Accessible Resources',
      description: 'Why the compiled .wasm binary must be explicitly allowlisted here before fetch() from an extension page can load it.',
      url: 'https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources',
    },
  ],
  14: [
    {
      title: 'chrome.debugger API',
      description: 'attach(), sendCommand(), and the full list of CDP domains an extension is allowed to reach — the "debugger" permission this module introduces.',
      url: 'https://developer.chrome.com/docs/extensions/reference/api/debugger',
    },
    {
      title: 'Chrome DevTools Protocol Viewer',
      description: 'The full CDP domain/method/event reference — ground truth for every command chrome.debugger.sendCommand() can send.',
      url: 'https://chromedevtools.github.io/devtools-protocol/',
    },
  ],
  15: [
    {
      title: 'Chrome DevTools Protocol Viewer — Network domain',
      description: 'Network.enable, requestWillBeSent, responseReceived — the events this module’s network interception builds on.',
      url: 'https://chromedevtools.github.io/devtools-protocol/tot/Network/',
    },
    {
      title: 'chrome.debugger API',
      description: 'Same permission and transport as Part 1 — this module goes deeper into the same attach/sendCommand/onEvent surface.',
      url: 'https://developer.chrome.com/docs/extensions/reference/api/debugger',
    },
  ],
  16: [
    {
      title: 'chrome.sidePanel API',
      description: 'open(), close(), setOptions()/getOptions() — the persistent UI surface this module introduces, distinct from the transient popup.',
      url: 'https://developer.chrome.com/docs/extensions/reference/api/sidePanel',
    },
    {
      title: 'chrome.contextMenus API',
      description: 'create(), update(), onClicked — the right-click menu integration this module wires up alongside the side panel.',
      url: 'https://developer.chrome.com/docs/extensions/reference/api/contextMenus',
    },
  ],
  17: [
    {
      title: 'Browser Extensions (MDN)',
      description: 'Firefox’s WebExtensions documentation — the promise-based browser.* namespace this module’s polyfill shims Chrome’s callback-based chrome.* onto.',
      url: 'https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions',
    },
    {
      title: 'webextension-polyfill',
      description: 'Mozilla’s official polyfill library — the actual browser_polyfill.js this module loads first in every content script.',
      url: 'https://github.com/mozilla/webextension-polyfill',
    },
  ],
  18: [
    {
      title: 'vite-plugin-web-extension',
      description: 'The plugin that reads manifest.json, builds every HTML entry point, and bundles content scripts and the service worker — what makes this module’s Vite config work at all.',
      url: 'https://github.com/aklinker1/vite-plugin-web-extension',
    },
    {
      title: 'Vite',
      description: 'Official Vite documentation — dev server, HMR, and the production build (rollup-based) this module’s npm run build invokes.',
      url: 'https://vite.dev/',
    },
    {
      title: '@types/chrome',
      description: 'TypeScript type definitions for the full chrome.* surface — what catches a wrong tabId type or a missing parameter at build time in this module.',
      url: 'https://www.npmjs.com/package/@types/chrome',
    },
  ],
  19: [
    {
      title: 'Jest',
      description: 'The unit test runner this module uses to mock chrome.* and test storage_manager.js and idb_manager.js in isolation.',
      url: 'https://jestjs.io/',
    },
    {
      title: 'Playwright — Chrome Extensions',
      description: 'Official guide to testing MV3 extensions with launchPersistentContext, including how to grab the service worker and extension ID for e2e assertions.',
      url: 'https://playwright.dev/docs/chrome-extensions',
    },
  ],
  20: [
    {
      title: 'Performance API (MDN)',
      description: 'performance.now(), marks, and measures — the timing primitives perf_monitor.html uses to graph service-worker wake latency.',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Performance_API',
    },
    {
      title: 'Memory Management (MDN)',
      description: 'How JS garbage collection and memory leaks actually work — background context for interpreting this module’s memory-growth charts.',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_management',
    },
  ],
  21: [
    {
      title: 'Chrome Web Store Developer Program Policies',
      description: 'The rules Honey and Grammarly operate under — ground truth for judging which of their real behaviors are compliant vs. borderline.',
      url: 'https://developer.chrome.com/docs/webstore/program-policies/',
    },
    {
      title: 'Chrome Web Store — User Data FAQ',
      description: 'The disclosure rules for what a content-injecting extension is allowed to do with page data it can see — directly relevant to both case studies.',
      url: 'https://developer.chrome.com/docs/webstore/user_data',
    },
  ],
  22: [
    {
      title: 'Chrome Web Store Developer Program Policies',
      description: 'The specific clauses (deceptive installation, unwanted software, obfuscated code) that the malware patterns in this module violate.',
      url: 'https://developer.chrome.com/docs/webstore/program-policies/',
    },
    {
      title: 'chrome.scripting API',
      description: 'The legitimate version of the injection primitive malicious extensions abuse — useful to see the API malware is actually calling.',
      url: 'https://developer.chrome.com/docs/extensions/reference/api/scripting',
    },
  ],
  23: [
    {
      title: 'Chrome Web Store Developer Program Policies',
      description: 'The policy document behind every real removal case this module studies.',
      url: 'https://developer.chrome.com/docs/webstore/program-policies/',
    },
    {
      title: 'Chrome Web Store — Best Practices',
      description: 'Google’s own guidance on the review/quality bar — what a submission should look like to avoid the removal patterns covered here.',
      url: 'https://developer.chrome.com/docs/webstore/best-practices',
    },
  ],
  24: [
    {
      title: 'Chrome Web Store Developer Program Policies',
      description: 'The monetization and ads sections that govern what analytics_manager.js and any freemium gating are allowed to do.',
      url: 'https://developer.chrome.com/docs/webstore/program-policies/',
    },
    {
      title: 'Chrome Web Store — User Data FAQ',
      description: 'Disclosure requirements for analytics collection specifically — what must be surfaced to the user before any usage data leaves the device.',
      url: 'https://developer.chrome.com/docs/webstore/user_data',
    },
  ],
  25: [
    {
      title: 'Use the Chrome Web Store API',
      description: 'The REST API this module’s GitHub Actions "publish-to-cws" job calls — OAuth credential setup, upload, and publish endpoints.',
      url: 'https://developer.chrome.com/docs/webstore/using-api',
    },
    {
      title: 'Publish in the Chrome Web Store',
      description: 'The manual dashboard submission flow this module’s CI pipeline automates — required listing fields, review, and staged rollout.',
      url: 'https://developer.chrome.com/docs/webstore/publish',
    },
    {
      title: 'GitHub Actions Documentation',
      description: 'Workflow syntax, jobs, and secrets — what this module’s three-job pipeline (lint-and-validate, build, publish-to-cws) is built with.',
      url: 'https://docs.github.com/en/actions',
    },
  ],
};
