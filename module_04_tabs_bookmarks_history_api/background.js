// NeuralTab — background.js (Module 04)
// Service worker: handles alarms, tab idle detection, notifications, message relay.
// NOTE: Service workers cannot import scripts with <script> tags.
// StorageManager is NOT available here — we use chrome.storage directly.
// Module 05 shows how to share code via importScripts().

// ─── Install / Update ──────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  // Record install date on first install only
  if (reason === 'install') {
    const existing = await chrome.storage.local.get({ installDate: null });
    if (!existing.installDate) {
      await chrome.storage.local.set({ installDate: Date.now() });
    }
    // Create the periodic alarm — fires every 30 minutes
    await chrome.alarms.create('tab-analysis', { periodInMinutes: 30 });
  }

  if (reason === 'update') {
    // On update: recreate alarms in case they were cleared by the update
    const existing = await chrome.alarms.get('tab-analysis');
    if (!existing) {
      await chrome.alarms.create('tab-analysis', { periodInMinutes: 30 });
    }
  }
});

// ─── Alarms ────────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'tab-analysis') {
    await runTabAnalysis();
  }
});

// ─── Tab Analysis ──────────────────────────────────────────────────────────

async function runTabAnalysis() {
  const settings = await chrome.storage.local.get({
    tabAnalysisEnabled:   true,
    idleTabThresholdMins: 30,
    totalIdleAlerts:      0,
  });

  if (!settings.tabAnalysisEnabled) return;

  // Check if the "tabs" optional permission is currently granted
  const hasTabsPermission = await chrome.permissions.contains({ permissions: ['tabs'] });
  if (!hasTabsPermission) return;

  const allTabs    = await chrome.tabs.query({});
  const now        = Date.now();
  const thresholdMs = settings.idleTabThresholdMins * 60 * 1000;

  // Tabs that have been open a long time and are not currently active
  // chrome.tabs does not expose a "last accessed" timestamp in all versions.
  // We approximate using the tab's audible/active flags plus the alarm cadence.
  // In Module 05 we track true last-accessed via tabs.onActivated events.
  const idleTabs = allTabs.filter(t => !t.active && !t.audible && !t.pinned);

  await chrome.storage.local.set({
    lastTabAnalysis: now,
    _idleTabCount:   idleTabs.length,
    _totalTabCount:  allTabs.length,
  });

  if (idleTabs.length >= 5) {
    await sendIdleNotification(idleTabs.length);
    const count = settings.totalIdleAlerts + 1;
    await chrome.storage.local.set({ totalIdleAlerts: count });
  }
}

async function sendIdleNotification(idleCount) {
  const hasNotifPermission = await chrome.permissions.contains({ permissions: ['notifications'] });
  if (!hasNotifPermission) return;

  chrome.notifications.create('neuraltab-idle-tabs', {
    type:     'basic',
    iconUrl:  chrome.runtime.getURL('icons/icon48.png'),
    title:    'NeuralTab — Tab Check',
    message:  `You have ${idleCount} inactive tabs open. Open NeuralTab to review them.`,
    priority: 0,
  });
}

// ─── Message Relay ──────────────────────────────────────────────────────────
// Content scripts cannot call chrome.runtime.openOptionsPage() directly.
// They send a message to the background worker, which relays the call.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }

  if (msg.action === 'getTabInfo') {
    // Return info about the sender's own tab — content scripts can use
    // this to get the tab ID without the "tabs" permission.
    sendResponse({ tabId: sender.tab?.id ?? null });
    return false;
  }

  if (msg.action === 'triggerTabAnalysis') {
    runTabAnalysis().then(() => sendResponse({ ok: true }));
    return true; // keep channel open for async response
  }

  if (msg.action === 'closeIdleTabs') {
    closeIdleTabs(msg.tabIds).then(() => sendResponse({ ok: true, count: msg.tabIds.length }));
    return true;
  }

  if (msg.action === 'groupTabsByDomain') {
    groupTabsByDomain(msg.tabIds, msg.domain).then(groupId => sendResponse({ groupId }));
    return true;
  }
});

// ─── Tab Operations ─────────────────────────────────────────────────────────

async function closeIdleTabs(tabIds) {
  if (!tabIds || tabIds.length === 0) return;
  await chrome.tabs.remove(tabIds);
}

async function groupTabsByDomain(tabIds, domain) {
  // Tab Groups API — requires no extra permission, available in Chrome 89+
  if (!chrome.tabGroups) return null;
  try {
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, {
      title:     domain,
      collapsed: false,
    });
    return groupId;
  } catch (e) {
    return null;
  }
}

// ─── Notification Click ──────────────────────────────────────────────────────

chrome.notifications.onClicked.addListener((notifId) => {
  if (notifId === 'neuraltab-idle-tabs') {
    // Open the tab manager page
    chrome.tabs.create({ url: chrome.runtime.getURL('tab_manager.html') });
    chrome.notifications.clear(notifId);
  }
});
