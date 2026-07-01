// ============================================================
// NeuralTab — popup.js
// Module 01: Foundations
//
// This script runs inside the popup page context.
// It has access to all chrome.* APIs that are listed in
// manifest.json under "permissions". Right now we have ZERO
// declared permissions, yet we can still read the current tab
// because chrome.tabs.query() with {active:true, currentWindow:true}
// is allowed without the "tabs" permission — Chrome only requires
// "tabs" if you want to read the URL/title of *other* tabs.
// ============================================================

'use strict';

// ── Grab DOM references once at startup ──────────────────────
const elUrl        = document.getElementById('current-url');
const elTitle      = document.getElementById('tab-title');
const elExtId      = document.getElementById('ext-id');
const elExtVersion = document.getElementById('ext-version');
const elManifest   = document.getElementById('manifest-ver');

// ── 1. Read the current active tab ───────────────────────────
//
// chrome.tabs.query() is asynchronous and returns a Promise in MV3.
// The filter {active: true, currentWindow: true} narrows it to
// exactly the one tab the user is looking at right now.
//
chrome.tabs.query({ active: true, currentWindow: true })
  .then(([tab]) => {
    // tab may be undefined if called from a non-tab context
    if (!tab) {
      elUrl.textContent   = 'No active tab found';
      elTitle.textContent = '—';
      return;
    }

    // tab.url is empty string for chrome:// pages when "tabs"
    // permission is not declared — handle that gracefully
    elUrl.textContent   = tab.url   || '(restricted page — no URL access)';
    elTitle.textContent = tab.title || '(no title)';

    // Update the toolbar badge to show a checkmark so the user
    // can see the extension responded to this tab
    chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#4ade80', tabId: tab.id });
  })
  .catch((err) => {
    elUrl.textContent = `Error: ${err.message}`;
  });

// ── 2. Populate extension metadata ───────────────────────────
//
// chrome.runtime.id is always available — it's your extension's
// unique identifier assigned by Chrome on installation.
//
// chrome.runtime.getManifest() returns the parsed manifest.json
// as a plain JavaScript object — no file I/O, Chrome caches it.
//
const manifest = chrome.runtime.getManifest();

elExtId.textContent      = chrome.runtime.id;
elExtVersion.textContent = manifest.version;
elManifest.textContent   = `v${manifest.manifest_version}`;

// ── 3. Badge control buttons ──────────────────────────────────
//
// Each button calls chrome.action.setBadgeText() which updates
// the small label overlaid on the extension icon in the toolbar.
// tabId is omitted here so the badge applies to ALL tabs globally.
//
let clickCount = 0;

document.querySelectorAll('.btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;

    if (action === 'on') {
      chrome.action.setBadgeText({ text: 'ON' });
      chrome.action.setBadgeBackgroundColor({ color: '#4ade80' });
    }

    if (action === 'count') {
      clickCount++;
      chrome.action.setBadgeText({ text: String(clickCount) });
      chrome.action.setBadgeBackgroundColor({ color: '#fb923c' });
    }

    if (action === 'clear') {
      clickCount = 0;
      // Empty string removes the badge entirely
      chrome.action.setBadgeText({ text: '' });
    }
  });
});
