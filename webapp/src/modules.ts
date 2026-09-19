export interface ModuleDef {
  num: number;
  id: string;
  title: string;
  group: string;
  description: string;
  manifest: string;
  hasLive: boolean;
}

// Annotated manifest.json snippets below are trimmed and commented for
// teaching purposes (real manifest.json cannot contain `//` comments) but
// every field shown is pulled directly from that module's real
// manifest.json in the course repo — not invented.

export const MODULES: ModuleDef[] = [
  {
    num: 1,
    id: 'foundation',
    title: 'Hello Extension & Manifest V3',
    group: 'Foundations',
    description: 'The bare MV3 skeleton: manifest_version, an action popup, icons — and empty permissions arrays, because this module grants nothing yet.',
    manifest: `{
  "manifest_version": 3,
  "name": "NeuralTab",
  "version": "0.1.0",

  "action": {                        // toolbar button (replaces MV2's browser_action/page_action)
    "default_popup": "popup.html",
    "default_icon": { "16": "icons/icon16.png", "48": "icons/icon48.png" }
  },

  "permissions": [],                 // nothing requested yet
  "host_permissions": []             // MV3 splits host access out of "permissions" entirely
}`,
    hasLive: false,
  },
  {
    num: 2,
    id: 'content-scripts',
    title: 'Content Scripts & DOM Surgery',
    group: 'Foundations',
    description: 'First content script: matches every URL, runs at document_idle, and ships a page-world helper plus fonts through web_accessible_resources.',
    manifest: `{
  // ...action/icons from Module 01 unchanged...

  "permissions": [],
  "host_permissions": [],

  "content_scripts": [{
    "matches":     ["<all_urls>"],   // inject into every page
    "js":          ["content.js"],
    "css":         ["content.css"],
    "run_at":      "document_idle",  // wait for DOM to settle before injecting
    "all_frames":  false             // top frame only, not every iframe
  }],

  "web_accessible_resources": [{     // MV3 requires an explicit allowlist + matches
    "resources": ["assets/inject.js", "assets/fonts/inter-regular.woff2"],
    "matches":   ["<all_urls>"]
  }]
}`,
    hasLive: false,
  },
  {
    num: 3,
    id: 'options-storage',
    title: 'Options Page, Storage & Permissions UX',
    group: 'Foundations',
    description: 'Adds an options_page and the first real permission — "storage" — plus a storage_manager.js content script that now loads before content.js.',
    manifest: `{
  "options_page": "options.html",

  "permissions": [
    "storage"                        // chrome.storage.sync/local — first real permission
  ],
  "host_permissions": [],

  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["storage_manager.js", "content.js"],   // load order matters: storage helper first
    "css": ["content.css"],
    "run_at": "document_idle"
  }]
}`,
    hasLive: false,
  },
  {
    num: 4,
    id: 'tabs-bookmarks-history',
    title: 'Tabs, Bookmarks, History API',
    group: 'Browser APIs',
    description: 'First background service worker. Splits permissions into install-time ("permissions") vs. runtime-requested ("optional_permissions") — tabs/bookmarks/history are asked for on demand, not up front.',
    manifest: `{
  "background": {
    "service_worker": "background.js"   // MV3: no persistent background page, only a worker
  },

  "permissions": [
    "storage", "scripting", "alarms", "activeTab"   // granted at install
  ],
  "optional_permissions": [
    "tabs", "bookmarks", "history", "notifications" // requested later via chrome.permissions.request()
  ],
  "host_permissions": ["<all_urls>"]
}`,
    hasLive: false,
  },
  {
    num: 5,
    id: 'service-worker',
    title: 'Service Worker Internals & Keepalive',
    group: 'Browser APIs',
    description: 'Same manifest shape as Module 04 — the real subject here is background.js’s behavior: it wakes on events, tracks an in-memory counter that resets on every restart, and logs its own lifecycle to storage. Try the live simulator below.',
    manifest: `{
  "background": { "service_worker": "background.js" },  // "type" omitted -> classic (non-module) worker

  "permissions": ["storage", "scripting", "alarms", "activeTab"],
  "optional_permissions": ["tabs", "bookmarks", "history", "notifications"],
  "host_permissions": ["<all_urls>"]

  // real background.js (this module):
  //   let inMemoryEventCounter = 0;         // resets to 0 every time the SW restarts
  //   const SW_START_TIME = Date.now();
  //   chrome.alarms.create('sw-heartbeat', { periodInMinutes: 0.5 });
  //   -> StorageManager.logSwEvent('START', 'wake #' + swStartCount)
}`,
    hasLive: true,
  },
  {
    num: 6,
    id: 'message-passing',
    title: 'Message Passing Patterns',
    group: 'Browser APIs',
    description: 'No new permissions — this module wires all 4 real message-passing patterns into the same onMessage/onConnect listeners, and ships the actual message_lab.html UI as a web-accessible page. Try the live simulator below.',
    manifest: `{
  "background": { "service_worker": "background.js" },

  "web_accessible_resources": [{
    "resources": [
      "assets/inject.js",
      "sw_monitor.html",      // real-time SW lifecycle visualiser
      "tab_manager.html",
      "message_lab.html"      // the actual 4-pattern message-passing demo page
    ],
    "matches": ["<all_urls>"]
  }]

  // real background.js message router (chrome.runtime.onMessage):
  //   'oneWayLog'    -> Pattern 1: fire-and-forget, returns false, no sendResponse
  //   'echoRequest'  -> Pattern 2: async request/response, MUST "return true"
  //                     to keep the channel open past the synchronous handler
  //   port 'neuraltab-stream' -> Pattern 3: long-lived bidirectional streaming
  //   'incrementDemoCounter' -> Pattern 4: shared counter mutated via background
}`,
    hasLive: true,
  },
  {
    num: 7,
    id: 'storage-indexeddb',
    title: 'Storage & IndexedDB Mastery',
    group: 'Browser APIs',
    description: 'The worker gains an explicit "type": "classic", and unlimitedStorage/tabGroups move from optional into granted-at-install permissions for the IndexedDB-at-scale work this module does.',
    manifest: `{
  "background": { "service_worker": "background.js", "type": "classic" },  // now explicit

  "permissions": [
    "storage", "alarms", "tabs", "scripting", "unlimitedStorage",  // no IndexedDB quota ceiling
    "history", "bookmarks", "tabGroups"
  ],
  "optional_permissions": ["tabs", "history", "bookmarks"]
}`,
    hasLive: false,
  },
  {
    num: 8,
    id: 'update-migrations',
    title: 'Extension Update & Schema Migrations',
    group: 'Browser APIs',
    description: 'Manifest is unchanged from Module 07’s permission set (this module is about chrome.runtime.onInstalled’s "update" reason and versioned storage migrations, not new manifest surface) — it adds update_log.html to the resource list.',
    manifest: `{
  "background": { "service_worker": "background.js", "type": "classic" },
  "permissions": [
    "storage", "alarms", "tabs", "scripting", "unlimitedStorage",
    "history", "bookmarks", "tabGroups"
    // no declarativeNetRequest yet — that arrives next module
  ],
  "web_accessible_resources": [{
    "resources": ["assets/inject.js", "message_lab.html", "history_db.html", "update_log.html"],
    "matches": ["<all_urls>"]
  }]
}`,
    hasLive: false,
  },
  {
    num: 9,
    id: 'declarative-net-request',
    title: 'Network Layer: declarativeNetRequest',
    group: 'Browser APIs',
    description: 'First appearance of the top-level "declarative_net_request" key: MV3 replaced MV2’s webRequest-based blocking with a declarative rule-set file the browser evaluates natively.',
    manifest: `{
  "permissions": [
    "storage", "alarms", "tabs", "scripting", "unlimitedStorage",
    "history", "bookmarks", "tabGroups",
    "declarativeNetRequest", "declarativeNetRequestFeedback", "webNavigation"
  ],

  "declarative_net_request": {
    "rule_resources": [{
      "id": "neuraltab_rules",
      "enabled": true,
      "path": "dnr_rules.json"        // rules are data, evaluated by the browser — not JS you run
    }]
  }
}`,
    hasLive: false,
  },
  {
    num: 10,
    id: 'v8-isolated-worlds',
    title: 'V8 Engine & Isolated Worlds',
    group: 'Advanced',
    description: 'No new manifest keys at all: MAIN-world vs. ISOLATED-world execution is a runtime property of chrome.scripting.executeScript’s "world" option, not something manifest.json declares.',
    manifest: `{
  // manifest is byte-for-byte the same permission surface as Module 09.
  // The MAIN vs ISOLATED distinction lives in code, e.g.:
  //
  //   chrome.scripting.executeScript({
  //     target: { tabId },
  //     world: 'MAIN',       // shares the page's own V8 context (sees page globals)
  //     func: () => window.somePageGlobal
  //   });
  //
  // vs. the default world: 'ISOLATED' every content_scripts entry already
  // runs in — same DOM, separate JS heap, invisible to page scripts.
  "web_accessible_resources": [{
    "resources": ["assets/inject.js", "world_demo.html"],
    "matches": ["<all_urls>"]
  }]
}`,
    hasLive: false,
  },
  {
    num: 11,
    id: 'fingerprinting',
    title: 'Extension Fingerprinting',
    group: 'Advanced',
    description: 'Same permission set as Module 09 — this module is about what a page CAN detect about the extension (injected DOM markers, timing) using nothing beyond what content scripts already expose.',
    manifest: `{
  "permissions": [
    "storage", "alarms", "tabs", "scripting", "unlimitedStorage",
    "history", "bookmarks", "tabGroups",
    "declarativeNetRequest", "declarativeNetRequestFeedback", "webNavigation"
  ],
  "web_accessible_resources": [{
    "resources": ["assets/inject.js", "world_demo.html", "fingerprint.html"],
    "matches": ["<all_urls>"]
  }]
}`,
    hasLive: false,
  },
  {
    num: 12,
    id: 'oauth2',
    title: 'OAuth2 & External APIs',
    group: 'Advanced',
    description: 'Adds the "identity" permission for chrome.identity.launchWebAuthFlow — the only sanctioned way for an MV3 extension to run an OAuth redirect flow without a bundled webview.',
    manifest: `{
  "permissions": [
    "storage", "alarms", "tabs", "scripting", "unlimitedStorage",
    "history", "bookmarks", "tabGroups",
    "declarativeNetRequest", "declarativeNetRequestFeedback", "webNavigation",
    "identity"                         // chrome.identity.launchWebAuthFlow / getAuthToken
  ],
  "web_accessible_resources": [{
    "resources": ["assets/inject.js", "fingerprint.html", "api_demo.html"],
    "matches": ["<all_urls>"]
  }]
}`,
    hasLive: false,
  },
  {
    num: 13,
    id: 'webassembly',
    title: 'WebAssembly in Extensions',
    group: 'Advanced',
    description: 'Same permission set as Module 12, but web_accessible_resources now has to explicitly allowlist the compiled .wasm binary before either the service worker or a content script can fetch() it.',
    manifest: `{
  "permissions": [
    "storage", "alarms", "tabs", "scripting", "unlimitedStorage",
    "history", "bookmarks", "tabGroups",
    "declarativeNetRequest", "declarativeNetRequestFeedback", "webNavigation", "identity"
  ],
  "web_accessible_resources": [{
    "resources": [
      "assets/inject.js", "api_demo.html", "wasm_demo.html",
      "assets/neuraltab.wasm"          // must be listed here or fetch() from an extension page 404s
    ],
    "matches": ["<all_urls>"]
  }]
}`,
    hasLive: false,
  },
  {
    num: 14,
    id: 'cdp-part1',
    title: 'Chrome DevTools Protocol Part 1',
    group: 'Advanced',
    description: 'Adds "debugger" — arguably the single scariest permission in the whole manifest: it lets the extension attach the full Chrome DevTools Protocol to any tab.',
    manifest: `{
  "permissions": [
    "storage", "alarms", "tabs", "scripting", "unlimitedStorage",
    "history", "bookmarks", "tabGroups",
    "declarativeNetRequest", "declarativeNetRequestFeedback", "webNavigation",
    "identity", "debugger"             // chrome.debugger.attach() — full CDP access to a tab
  ],
  "web_accessible_resources": [{
    "resources": ["assets/inject.js", "api_demo.html", "wasm_demo.html", "cdp_inspector.html"],
    "matches": ["<all_urls>"]
  }]
}`,
    hasLive: false,
  },
  {
    num: 15,
    id: 'cdp-part2',
    title: 'Chrome DevTools Protocol Part 2',
    group: 'Advanced',
    description: 'Same "debugger" permission as Part 1 — this module goes deeper into CDP (network interception, tracing, screenshotting) without needing any additional manifest surface.',
    manifest: `{
  "permissions": [
    "storage", "alarms", "tabs", "scripting", "unlimitedStorage",
    "history", "bookmarks", "tabGroups",
    "declarativeNetRequest", "declarativeNetRequestFeedback", "webNavigation",
    "identity", "debugger"
  ],
  "web_accessible_resources": [{
    "resources": ["assets/inject.js", "cdp_inspector.html", "cdp_network.html"],
    "matches": ["<all_urls>"]
  }]
}`,
    hasLive: false,
  },
  {
    num: 16,
    id: 'side-panel',
    title: 'Side Panel API',
    group: 'Advanced',
    description: 'Introduces the top-level "side_panel" key plus "sidePanel" and "contextMenus" permissions — a persistent UI surface distinct from the transient popup.',
    manifest: `{
  "side_panel": { "default_path": "sidepanel.html" },   // new top-level manifest key

  "permissions": [
    "storage", "alarms", "tabs", "scripting", "unlimitedStorage",
    "history", "bookmarks", "tabGroups",
    "declarativeNetRequest", "declarativeNetRequestFeedback", "webNavigation",
    "identity", "debugger", "sidePanel", "contextMenus"
  ]
}`,
    hasLive: false,
  },
  {
    num: 17,
    id: 'cross-browser',
    title: 'Cross-Browser Compatibility',
    group: 'Advanced',
    description: 'Same permission set as Module 16, but browser_polyfill.js now loads FIRST in every content script — it shims the promise-based `browser.*` namespace over Chrome’s callback-based `chrome.*` API for Firefox/Safari parity.',
    manifest: `{
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["browser_polyfill.js", "storage_manager.js", "content.js"],  // polyfill loads first
    "css": ["content.css"],
    "run_at": "document_idle"
  }],
  "web_accessible_resources": [{
    "resources": ["assets/inject.js", "sidepanel.html", "compat.html"],
    "matches": ["<all_urls>"]
  }]
}`,
    hasLive: false,
  },
  {
    num: 18,
    id: 'react-vite-ts',
    title: 'React + Vite + TypeScript',
    group: 'Production',
    description: 'Every path grows a dist/ prefix and the service worker gains "type": "module" for the first time — this manifest points at Vite’s build output, not hand-written source files.',
    manifest: `{
  "background": {
    "service_worker": "dist/background.js",
    "type": "module"                 // first ES-module service worker in the course — needs import/export
  },
  "action": { "default_popup": "dist/popup.html" },
  "side_panel": { "default_path": "dist/sidepanel.html" },

  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["dist/content.js"],
    "css": ["dist/content.css"]
  }],
  "web_accessible_resources": [{ "resources": ["dist/*"], "matches": ["<all_urls>"] }]
}`,
    hasLive: false,
  },
  {
    num: 19,
    id: 'testing',
    title: 'Testing Extensions',
    group: 'Production',
    description: 'Manifest reverts to plain (non-dist) paths — this module is Jest unit tests, Playwright e2e, and chrome-mock patterns against source files directly, independent of the Module 18 build pipeline.',
    manifest: `{
  "background": { "service_worker": "background.js", "type": "classic" },
  "side_panel": { "default_path": "sidepanel.html" },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["browser_polyfill.js", "storage_manager.js", "content.js"],
    "css": ["content.css"]
  }]
  // __tests__/ directory: Jest specs mock chrome.* with a hand-rolled stub,
  // Playwright drives a real loaded-unpacked Chrome instance for e2e.
}`,
    hasLive: false,
  },
  {
    num: 20,
    id: 'performance',
    title: 'Performance Monitoring',
    group: 'Production',
    description: 'Same manifest surface as Module 19 with one addition to web_accessible_resources: perf_monitor.html, the page that visualizes memory/CPU timing and SW lifecycle metrics.',
    manifest: `{
  "web_accessible_resources": [{
    "resources": [
      "assets/inject.js", "sidepanel.html", "compat.html",
      "perf_monitor.html"    // memory, CPU timing, service-worker lifecycle metrics UI
    ],
    "matches": ["<all_urls>"]
  }]
}`,
    hasLive: false,
  },
  {
    num: 21,
    id: 'autopsy-honey-grammarly',
    title: 'Autopsy I: Honey & Grammarly',
    group: 'Production',
    description: 'No new capabilities — an analysis module studying two real, widely-installed extensions’ actual permission choices and content-injection patterns. Adds autopsy.html to present the findings.',
    manifest: `{
  // manifest capabilities unchanged from Module 20 — this module is a case
  // study of two real Chrome Web Store extensions' actual manifest.json and
  // content-injection choices, not a new NeuralTab feature.
  "web_accessible_resources": [{
    "resources": ["assets/inject.js", "perf_monitor.html", "autopsy.html"],
    "matches": ["<all_urls>"]
  }]
}`,
    hasLive: false,
  },
  {
    num: 22,
    id: 'autopsy-malware',
    title: 'Autopsy II: Malware Patterns',
    group: 'Production',
    description: 'Also capability-neutral: catalogs real malicious-extension patterns (session hijacking, crypto-mining, ad injection) as a case study rather than a NeuralTab feature.',
    manifest: `{
  "web_accessible_resources": [{
    "resources": ["assets/inject.js", "autopsy.html", "malware_patterns.html"],
    "matches": ["<all_urls>"]
  }]
}`,
    hasLive: false,
  },
  {
    num: 23,
    id: 'autopsy-cws',
    title: 'Autopsy III: CWS Removals',
    group: 'Production',
    description: 'Studies real Chrome Web Store policy removals — what gets extensions killed and why — as case law for the manifest and permission choices made throughout this whole course.',
    manifest: `{
  "web_accessible_resources": [{
    "resources": ["assets/inject.js", "malware_patterns.html", "cws_cases.html"],
    "matches": ["<all_urls>"]
  }]
}`,
    hasLive: false,
  },
  {
    num: 24,
    id: 'monetization',
    title: 'Monetization',
    group: 'Production',
    description: 'Adds analytics_manager.js as a new content script, loaded alongside storage_manager.js — ethical analytics and freemium gating built on the storage/permissions groundwork from Modules 03/07.',
    manifest: `{
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["browser_polyfill.js", "storage_manager.js", "analytics_manager.js", "content.js"],
    "css": ["content.css"]
  }],
  "web_accessible_resources": [{
    "resources": ["assets/inject.js", "cws_cases.html", "monetization.html"],
    "matches": ["<all_urls>"]
  }]
}`,
    hasLive: false,
  },
  {
    num: 25,
    id: 'publishing-cicd',
    title: 'Publishing & CI/CD',
    group: 'Production',
    description: 'The final manifest before Chrome Web Store submission — same capability surface as Module 24, plus submission_checklist.html and a GitHub Actions pipeline that packages and validates this exact file.',
    manifest: `{
  "manifest_version": 3,
  "name": "NeuralTab",
  "version": "0.25.0",
  "description": "NeuralTab — Publishing & CI/CD: CWS submission, automated review, GitHub Actions pipeline",

  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["browser_polyfill.js", "storage_manager.js", "analytics_manager.js", "content.js"],
    "css": ["content.css"]
  }],
  "web_accessible_resources": [{
    "resources": ["assets/inject.js", "monetization.html", "submission_checklist.html"],
    "matches": ["<all_urls>"]
  }]
  // CI: a GitHub Actions workflow zips this exact tree, runs the CWS
  // automated-review checklist locally, then uploads via the Web Store API.
}`,
    hasLive: false,
  },
];
