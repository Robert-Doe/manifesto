# Manifesto

Most extension tutorials show you one feature in a demo you'll delete an hour later. I didn't want to teach that way, because that's not how real extensions get built, and it's not how you actually learn to maintain one. So every module in this course adds real functionality to the same extension, NeuralTab, an AI-assisted reading and tab-management tool, until by the later modules you're reading and extending files that already carry production history. A real `storage_manager.js` used across three different contexts. A real migration system with three schema versions that actually shipped. A real IndexedDB-backed history store with a 10,000-entry eviction policy I had to think through properly. None of this is a toy you throw away when the module ends.

## Why this exists

Manifest V3 rewrote almost everything a Chrome extension developer thought they knew. No more persistent background pages. No more blocking `webRequest`. A five-minute service-worker idle kill that will absolutely ruin your day if you don't design around it. A strict CSP that blocks inline scripts and `eval` outright. I built this course to teach the platform as it actually exists right now, not as a list of API references, but as a sequence of real engineering decisions that MV3's constraints force on you, each one demonstrated in running code.

Every module ships a `tutorial.html` walkthrough and a `DECISIONS.md`, usually six or so numbered decisions, each one stated as choice, then why, then the trade-off, with an explicit pointer forward to whichever later module comes back and revisits it. I tried to be honest about my own mistakes here. Module 01 ships with a hardcoded `DEFAULTS` object duplicated across files, and Module 05's `DECISIONS.md` explains exactly why that was wrong and how `importScripts()` fixes it. Reading the `DECISIONS.md` files in order is itself a lesson in how a real codebase evolves under real constraints, warts included.

## Track and module map

NeuralTab grows one feature at a time. Roughly, in build order:

| Phase | Modules | What gets built |
|---|---|---|
| Foundations | 01-03 | Manifest V3 basics, zero-permission popup; content scripts and Shadow DOM isolation; options page, `chrome.storage`, and permissions UX |
| Background & data | 04-08 | Tabs, bookmarks, and history APIs; service worker lifecycle and keepalive; message-passing patterns; IndexedDB storage mastery; update migrations |
| Platform depth | 09-17 | `declarativeNetRequest`; V8 isolated worlds; extension fingerprinting; OAuth2; WebAssembly; Chrome DevTools Protocol (two parts); Side Panel API; cross-browser compatibility |
| Production tooling | 18-20 | React, Vite, and TypeScript build pipeline; automated testing with Jest and Playwright; performance monitoring |
| Real-world literacy | 21-23 | Extension autopsies (Honey and Grammarly), malware patterns, Chrome Web Store removals |
| Shipping | 24-25 | Monetization patterns; publishing and CI/CD |

| # | Module | Path |
|---|---|---|
| mini | HTTP Versions & Keep-Alive | `mini_module_http_versions_keepalive/` |
| 01 | Hello Extension World & Manifest V3 Deep Dive | `module_01_hello_extension_manifest_v3/` |
| 02 | Content Scripts, DOM Surgery & Web Accessible Resources | `module_02_content_scripts_dom_shadow/` |
| 03 | Options Page, chrome.storage & Permissions UX Psychology | `module_03_options_page_storage_permissions/` |
| 04 | Tab API, Bookmarks, History & Browser API Survey | `module_04_tabs_bookmarks_history_api/` |
| 05 | Service Worker Internals & Lifecycle | `module_05_service_worker_internals/` |
| 06 | Message Passing Patterns | `module_06_message_passing_patterns/` |
| 07 | Storage & IndexedDB Mastery | `module_07_storage_indexeddb_mastery/` |
| 08 | Extension Update Migrations | `module_08_extension_update_migrations/` |
| 09 | Network & declarativeNetRequest | `module_09_network_declarative_net_request/` |
| 10 | V8 Engine & Isolated Worlds | `module_10_v8_isolated_worlds/` |
| 11 | Extension Fingerprinting | `module_11_extension_fingerprinting/` |
| 12 | OAuth2 & External APIs | `module_12_oauth2_external_apis/` |
| 13 | WebAssembly in Extensions | `module_13_webassembly_in_extensions/` |
| 14 | Chrome DevTools Protocol, Part 1 | `module_14_chrome_devtools_protocol_part1/` |
| 15 | Chrome DevTools Protocol, Part 2 | `module_15_chrome_devtools_protocol_part2/` |
| 16 | Side Panel API | `module_16_side_panel_api/` |
| 17 | Cross-Browser Compatibility | `module_17_cross_browser_compatibility/` |
| 18 | React + Vite + TypeScript | `module_18_react_vite_typescript/` |
| 19 | Testing Extensions | `module_19_testing_extensions/` |
| 20 | Performance & Memory Monitoring | `module_20_performance_monitoring/` |
| 21 | Autopsy I, Honey & Grammarly | `module_21_autopsy_honey_grammarly/` |
| 22 | Autopsy II, Malware Patterns | `module_22_autopsy_malware_patterns/` |
| 23 | Autopsy III, Chrome Web Store Removals | `module_23_autopsy_cws_removals/` |
| 24 | Monetization | `module_24_monetization/` |
| 25 | Publishing & CI/CD | `module_25_publishing_ci_cd/` |

## Tech stack

Modules 01 through 17 and 19 through 25 are plain vanilla JavaScript (ES2020+) on Manifest V3, no build step, loaded straight as an unpacked extension from `chrome://extensions`. Starting at Module 18, there's an optional production track: React, Vite (`vite-plugin-web-extension`), and TypeScript with `@types/chrome`. Module 19 covers testing with Jest for unit tests (mocked `chrome.*`) and Playwright for end-to-end tests, using `launchPersistentContext` with the extension actually loaded. Module 25 wires up GitHub Actions CI/CD against the Chrome Web Store publish API.

Chrome and Chromium on Manifest V3 is the primary platform target, but I didn't want to treat Firefox and Safari as an afterthought, so Module 17 covers cross-browser compatibility as its own dedicated topic.

## Where this stands

Done. All 25 numbered modules plus the HTTP Versions & Keep-Alive mini-module are written, each one with its own `tutorial.html` and `DECISIONS.md`.

## How to explore or run it

Work the modules in order. NeuralTab is cumulative, so Module 07's `IDBManager` assumes Module 03's `StorageManager` already exists, and Module 18's Vite config assumes the plain vanilla file layout every earlier module built up.

To run any module's extension exactly as it stood at that point in the course, load that module's folder as an unpacked extension: `chrome://extensions`, turn on Developer Mode, then Load unpacked.

Read each module's `DECISIONS.md` alongside its `tutorial.html`. That's where I name my own trade-offs and point forward to whichever module eventually fixes them, like Module 04's duplicated `DEFAULTS` object getting cleaned up explicitly in Module 05.

Modules 21 through 23, the autopsies, are read-only case studies grounded in public reporting on real extensions and real Chrome Web Store removals. No new NeuralTab code ships in those three, they're there to build judgment, not features.

Module 25's `submission_checklist.html` and its CI workflow are the two pieces I'd reuse directly if you're taking a real extension to publication yourself.
