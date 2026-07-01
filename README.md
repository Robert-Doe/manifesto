# Manifesto

**A 25-module (+1) Chrome Extension Manifest V3 mastery course, taught by building one real, cumulative extension — NeuralTab — from a zero-permission "hello world" to a published, CI/CD-shipped product.**

## What this is

Most extension tutorials show you one isolated feature in a throwaway demo. This course does the opposite: every module adds real functionality to the same extension, NeuralTab (an AI-assisted reading/tab-management tool), so that by the later modules you are reading and extending files that already have production history — a real `storage_manager.js` used by three different contexts, a real migration system with three shipped schema versions, a real IndexedDB-backed history store with a 10,000-entry eviction policy. Nothing here is a toy you throw away after the module ends.

Each module ships a `tutorial.html` (the narrated walkthrough) and a `DECISIONS.md` — six or so numbered decisions per module, each stated as **choice → why → trade-off**, with an explicit forward-reference to the later module that revisits or fixes that trade-off. The course is deliberately honest about its own compromises: Module 01 ships with a hardcoded `DEFAULTS` object duplicated across files, and Module 05's own `DECISIONS.md` explains exactly why that was a mistake and how `importScripts()` fixes it. Reading the `DECISIONS.md` files in order is itself a lesson in how a real codebase evolves under real constraints.

### Why it exists

Manifest V3 changed the rules for almost everything a Chrome extension developer used to know: no persistent background pages, no blocking `webRequest`, a five-minute service-worker idle kill, a strict CSP that blocks inline scripts and `eval`. This course exists to teach the *current* platform end to end — not as a list of API references, but as a sequence of real engineering decisions forced by MV3's actual constraints, each one demonstrated in running code and explained in a `DECISIONS.md` that also states the trade-off honestly rather than only the upside.

## Track / module map

NeuralTab accretes feature by feature. Rough phases, in build order:

| Phase | Modules | What gets built |
|---|---|---|
| Foundations | 01–03 | Manifest V3 basics, zero-permission popup; content scripts and Shadow DOM isolation; options page, `chrome.storage`, and permissions UX |
| Background & data | 04–08 | Tabs/bookmarks/history APIs; service worker lifecycle and keepalive; message-passing patterns; IndexedDB storage mastery; update migrations |
| Platform depth | 09–17 | `declarativeNetRequest`; V8 isolated worlds; extension fingerprinting; OAuth2; WebAssembly; Chrome DevTools Protocol (parts 1–2); Side Panel API; cross-browser compatibility |
| Production tooling | 18–20 | React + Vite + TypeScript build pipeline; automated testing (Jest + Playwright); performance monitoring |
| Real-world literacy | 21–23 | Extension "autopsies" — Honey and Grammarly, malware patterns, Chrome Web Store removals |
| Shipping | 24–25 | Monetization patterns; publishing and CI/CD |

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
| 21 | Autopsy I — Honey & Grammarly | `module_21_autopsy_honey_grammarly/` |
| 22 | Autopsy II — Malware Patterns | `module_22_autopsy_malware_patterns/` |
| 23 | Autopsy III — Chrome Web Store Removals | `module_23_autopsy_cws_removals/` |
| 24 | Monetization | `module_24_monetization/` |
| 25 | Publishing & CI/CD | `module_25_publishing_ci_cd/` |

## Tech stack

- **Modules 01–17, 19–25:** vanilla JavaScript (ES2020+), Manifest V3, no build step — loaded as an unpacked extension via `chrome://extensions`.
- **Module 18 onward (optional production track):** React, Vite (`vite-plugin-web-extension`), TypeScript with `@types/chrome`.
- **Module 19:** Jest (unit tests, mocked `chrome.*`) and Playwright (E2E, `launchPersistentContext` with a loaded extension).
- **Module 25:** GitHub Actions CI/CD against the Chrome Web Store publish API.
- **Platform target:** Chrome/Chromium, Manifest V3. Module 17 covers Firefox/Safari compatibility deliberately, as a dedicated topic rather than an afterthought.

## Status

Complete — all 25 numbered modules plus the HTTP Versions & Keep-Alive mini-module are written, each with a `tutorial.html` and a `DECISIONS.md`.

## How to explore / run it

1. Work modules in order — NeuralTab is cumulative, so `module_07`'s `IDBManager` assumes `module_03`'s `StorageManager` exists, and `module_18`'s Vite config assumes the vanilla file layout every prior module built.
2. To run any module's extension as it stood at that point in the course, load that module's folder as an unpacked extension via `chrome://extensions` → Developer Mode → Load unpacked.
3. Read each module's `DECISIONS.md` before or after `tutorial.html` — it is where the course names its own trade-offs and points forward to the module that eventually addresses them (e.g., Module 04's duplicated `DEFAULTS` object is explicitly fixed in Module 05).
4. Modules 21–23 (the "autopsies") are read-only case studies grounded in public reporting on real extensions and real Chrome Web Store removals — no new NeuralTab code ships in those three.
5. Module 25's `submission_checklist.html` and CI workflow are the two artifacts to reuse directly if you take a real extension to publication.
