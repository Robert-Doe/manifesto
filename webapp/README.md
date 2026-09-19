# Manifesto — Manifest V3 Explorer (webapp)

An interactive reference for all 25 modules of this course's Manifest V3 extension. Chrome
extensions can't run as a plain webpage, so this is an honest reference and simulator instead:

- Pick any of the 25 modules to see its real, annotated `manifest.json` snippet — pulled
  directly from that module's actual manifest, not invented.
- For **Module 05 (Service Worker Internals)** and **Module 06 (Message Passing Patterns)** —
  the two modules where a live simulation genuinely makes sense — drive a real two-panel
  simulator: a "content script" panel and a "background service worker" panel, both plain
  TypeScript running in this same page, exchanging real `window.postMessage` calls. It ports
  the actual one-way (`oneWayLog`) and async request/response (`echoRequest`/`echoResponse`)
  patterns from `module_06_message_passing_patterns/background.js`, plus the worker
  idle → terminate → wake lifecycle (in-memory counter reset, restart count) from
  `module_05_service_worker_internals/sw_monitor.js`.

100% client-side, no backend, no cross-visitor persistence.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Type-checks with `tsc` and bundles with Vite into `dist/`.

## Deploying (static hosting)

This is a static site — any static host works. For Vercel, Netlify, or Cloudflare Pages:

- **Root directory:** `webapp`
- **Build command:** `npm run build`
- **Output directory:** `dist`

No environment variables or server-side functions are required.
