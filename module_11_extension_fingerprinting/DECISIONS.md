# Module 11 — DECISIONS.md: Extension Fingerprinting

## Decision 1: Fingerprinting as a Learning Tool, Not a Privacy Attack

This module teaches fingerprinting from the defender's perspective: understanding what information your extension leaks and how pages can detect it. Every web accessible resource is a fingerprinting vector — a page can probe `chrome-extension://EXTENSION_ID/some-file.js` via `<img>` tags or `fetch`. If it loads, the extension is installed.

**Practical implication for NeuralTab:** The WAR list in manifest.json is essentially a public API surface for detection. Minimizing WAR entries reduces fingerprint exposure.

## Decision 2: Detectability Score is an Approximation

The stealth score in fingerprint.html is a simplified heuristic (-3 points per WAR entry, -15 for debugger permission). Real fingerprinting is more nuanced — timing attacks, DOM injection detection, and behavior-based signals all matter. The score is a teaching metaphor, not a security audit tool.

## Decision 3: Why the Extension ID is Stable in Production

Unpacked extensions get a random ID that changes on reinstall. Published extensions get a permanent ID tied to the `.pem` private key used to sign the first upload. This makes WAR-based detection trivially reliable for published extensions — any page can hardcode your extension ID and probe it.

## Decision 4: Permission-Based API Probing

`!!chrome.debugger` returns true only if the `debugger` permission is declared. This is how fingerprint.js checks API availability — feature detection via the permission manifest, not runtime capability testing. A page cannot probe this, but an extension can self-inspect.

## Decision 5: `getBytesInUse` as a Behavioral Fingerprint

`chrome.storage.local.getBytesInUse(null)` returns the total bytes used. Combined with `swInstallTime`, this creates a behavioral fingerprint: how long has the extension been installed and how much data has it accumulated? Useful for detecting fresh installs vs. long-time users for onboarding flows.

## Decision 6: Service Worker Uptime is Always Short

Extension service workers in MV3 terminate after ~30 seconds of inactivity. The "uptime" shown in fingerprint.js measures time since the current service worker instance started — not time since install. This distinction is critical: a 0-second uptime means the SW just woke up (common), not that the extension was just installed.
