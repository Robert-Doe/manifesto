# Module 18 — DECISIONS.md: React + Vite + TypeScript

## Decision 1: vite-plugin-web-extension Over Manual Config

Building a Chrome extension with Vite requires handling multiple entry points (popup, options, sidepanel, background, content scripts) with different output requirements. `vite-plugin-web-extension` handles this automatically: reads manifest.json, builds each HTML entry point with React, emits service workers as classic scripts (not ES modules, which Chrome's SW doesn't support via importScripts), and handles content script bundling.

## Decision 2: background.js Must Not Be an ES Module

Chrome's service worker can use `type: 'module'` in manifest.json (as Module 18 does), which enables top-level `await` and native ES module imports. However, this means `importScripts()` cannot be used in the SW. The trade-off: module SW is cleaner (no importScripts) but requires all imports to be bundled by Vite. NeuralTab's Module 18 manifest uses `"type": "module"` in the background entry to enable this.

## Decision 3: TypeScript for chrome.* Types via @types/chrome

`@types/chrome` provides TypeScript type definitions for all Chrome extension APIs. This catches type errors at build time: passing a string where a tabId number is expected, calling non-existent methods, missing required parameters. The types lag slightly behind Chrome releases but cover 95%+ of the API surface.

## Decision 4: Content Scripts Cannot Be Async Modules Without Bundling

Content scripts declared in manifest.json must be self-contained files. With Vite, the `vite-plugin-web-extension` plugin bundles each content script with all its imports into a single output file. Without the plugin, you'd need to manually configure Rollup input/output for each content script entry point.

## Decision 5: HMR Only Works for Extension Pages, Not Service Workers

Vite's hot module replacement works for popup.html, options.html, and sidepanel.html in development mode. It does NOT work for service workers or content scripts — those require a manual reload of the extension at `chrome://extensions`. The developer experience is therefore: HMR for UI pages, manual reload for everything else. This is a known limitation of the Vite extension build ecosystem.

## Decision 6: Source Maps in Production Are a Privacy Risk

`vite.config.ts` sets `sourcemap: false` for production builds. Source maps for Chrome extensions expose your minified source code to anyone who installs the extension — the browser caches them in the extension directory which users can access. Never ship source maps in a production CWS submission.
