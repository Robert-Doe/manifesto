// NeuralTab — background.js (Module 05)
// Demonstrates: importScripts(), service worker lifecycle, keepalive port pattern,
// heartbeat alarm, WebSocket that survives worker restarts.

// ─── Module 05 addition: importScripts() ────────────────────────────────────
// Now that we know how to share code in classic-mode service workers, we load
// storage_manager.js here instead of duplicating its logic.
// importScripts() is synchronous — it blocks until the file is parsed and executed.
// After this line, StorageManager is available as a global.
importScripts('storage_manager.js');

// ─── Lifecycle tracking ──────────────────────────────────────────────────────

// This variable lives in the service worker process memory.
// It is reset to 0 every time Chrome terminates and restarts the worker.
// This is the canonical demonstration of the 5-minute kill: watch this counter
// reset unexpectedly in the SW Monitor page.
let inMemoryEventCounter = 0;
const SW_START_TIME = Date.now(); // when this execution context was created

async function onWorkerStart() {
  inMemoryEventCounter++;
  const { swStartCount } = await StorageManager.get(['swStartCount']);
  const newCount = (swStartCount || 0) + 1;
  await StorageManager.set({
    swStartCount: newCount,
    swLastStart:  SW_START_TIME,
  });
  await StorageManager.logSwEvent('START', `Worker wake #${newCount}`);
}

// ─── Install / Update ────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    const { installDate } = await StorageManager.get(['installDate']);
    if (!installDate) {
      await StorageManager.set({ installDate: Date.now() });
    }
    await chrome.alarms.create('tab-analysis',  { periodInMinutes: 30 });
    await chrome.alarms.create('sw-heartbeat',  { periodInMinutes: 0.5 }); // every 30 sec
  }
  if (reason === 'update') {
    const tabAlarm = await chrome.alarms.get('tab-analysis');
    if (!tabAlarm) await chrome.alarms.create('tab-analysis', { periodInMinutes: 30 });
    const hbAlarm = await chrome.alarms.get('sw-heartbeat');
    if (!hbAlarm) await chrome.alarms.create('sw-heartbeat', { periodInMinutes: 0.5 });
  }
  await StorageManager.logSwEvent('INSTALLED', `reason=${reason}`);
});

// Record worker start on every wake (not just install)
onWorkerStart().catch(console.error);

// ─── Alarms ──────────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  inMemoryEventCounter++;
  await StorageManager.logSwEvent('ALARM', alarm.name);

  if (alarm.name === 'tab-analysis') {
    await runTabAnalysis();
  }

  if (alarm.name === 'sw-heartbeat') {
    // The heartbeat alarm fires every 30 seconds.
    // Its sole job is to wake the service worker and write a timestamp,
    // so the SW Monitor page can observe the worker's liveness.
    // This does NOT prevent the 5-minute idle kill — it just provides
    // frequent evidence of the worker's state.
    await StorageManager.set({ swLastIdle: null }); // reset idle flag
    await StorageManager.logSwEvent('HEARTBEAT', `in-memory counter=${inMemoryEventCounter}`);
  }
});

// ─── Keepalive Port Pattern ───────────────────────────────────────────────────
// When a page (like sw_monitor.html) needs the service worker to stay alive
// for an extended period, it can open a chrome.runtime.connect() port.
// An open port counts as an active event, preventing the idle timeout.
// The page keeps the port open by sending a ping every 25 seconds (safely under 30s).

const keepalivePorts = new Set();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'neuraltab-keepalive') return;

  keepalivePorts.add(port);
  StorageManager.set({ swKeepAlive: true });
  StorageManager.logSwEvent('PORT_OPEN', `total ports: ${keepalivePorts.size}`);

  port.onDisconnect.addListener(() => {
    keepalivePorts.delete(port);
    if (keepalivePorts.size === 0) {
      StorageManager.set({ swKeepAlive: false });
    }
    StorageManager.logSwEvent('PORT_CLOSE', `remaining ports: ${keepalivePorts.size}`);
  });

  port.onMessage.addListener((msg) => {
    if (msg.type === 'ping') {
      inMemoryEventCounter++;
      port.postMessage({ type: 'pong', counter: inMemoryEventCounter, ts: Date.now() });
    }
  });
});

// ─── Message Relay ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  inMemoryEventCounter++;

  if (msg.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }

  if (msg.action === 'getTabInfo') {
    sendResponse({ tabId: sender.tab?.id ?? null });
    return false;
  }

  if (msg.action === 'triggerTabAnalysis') {
    runTabAnalysis().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.action === 'closeIdleTabs') {
    closeIdleTabs(msg.tabIds).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.action === 'groupTabsByDomain') {
    groupTabsByDomain(msg.tabIds, msg.domain).then(id => sendResponse({ groupId: id }));
    return true;
  }

  if (msg.action === 'getWorkerState') {
    sendResponse({
      inMemoryEventCounter,
      swStartTime: SW_START_TIME,
      uptime: Date.now() - SW_START_TIME,
      keepalivePorts: keepalivePorts.size,
    });
    return false;
  }

  if (msg.action === 'logSwEvent') {
    StorageManager.logSwEvent(msg.event, msg.detail)
      .then(() => sendResponse({ ok: true }));
    return true;
  }
});

// ─── Tab Analysis ─────────────────────────────────────────────────────────────

async function runTabAnalysis() {
  const settings = await StorageManager.get([
    'tabAnalysisEnabled', 'idleTabThresholdMins', 'totalIdleAlerts',
  ]);
  if (!settings.tabAnalysisEnabled) return;

  const hasTabsPermission = await chrome.permissions.contains({ permissions: ['tabs'] });
  if (!hasTabsPermission) return;

  const allTabs  = await chrome.tabs.query({});
  const idleTabs = allTabs.filter(t => !t.active && !t.audible && !t.pinned);

  await StorageManager.set({
    lastTabAnalysis: Date.now(),
    _idleTabCount:   idleTabs.length,
    _totalTabCount:  allTabs.length,
  });

  if (idleTabs.length >= 5) {
    await sendIdleNotification(idleTabs.length);
    await StorageManager.set({ totalIdleAlerts: settings.totalIdleAlerts + 1 });
  }
}

async function sendIdleNotification(idleCount) {
  const hasNotif = await chrome.permissions.contains({ permissions: ['notifications'] });
  if (!hasNotif) return;
  chrome.notifications.create('neuraltab-idle-tabs', {
    type:     'basic',
    iconUrl:  chrome.runtime.getURL('icons/icon48.png'),
    title:    'NeuralTab — Tab Check',
    message:  `You have ${idleCount} inactive tabs open. Open NeuralTab to review them.`,
    priority: 0,
  });
}

// ─── Tab Operations ───────────────────────────────────────────────────────────

async function closeIdleTabs(tabIds) {
  if (!tabIds?.length) return;
  await chrome.tabs.remove(tabIds);
}

async function groupTabsByDomain(tabIds, domain) {
  if (!chrome.tabGroups) return null;
  try {
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, { title: domain, collapsed: false });
    return groupId;
  } catch { return null; }
}

// ─── Tab Last-Access Tracking (Module 05 addition) ───────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  inMemoryEventCounter++;
  const { tabAccessTimes } = await StorageManager.get(['tabAccessTimes']);
  const updated = { ...(tabAccessTimes || {}), [tabId]: Date.now() };
  // Keep only the last 200 tab IDs to prevent unbounded growth
  const keys = Object.keys(updated);
  if (keys.length > 200) {
    const oldest = keys
      .sort((a, b) => updated[a] - updated[b])
      .slice(0, keys.length - 200);
    oldest.forEach(k => delete updated[k]);
  }
  await StorageManager.set({ tabAccessTimes: updated });
});

// ─── Notification Clicks ──────────────────────────────────────────────────────

chrome.notifications.onClicked.addListener((notifId) => {
  if (notifId === 'neuraltab-idle-tabs') {
    chrome.tabs.create({ url: chrome.runtime.getURL('tab_manager.html') });
    chrome.notifications.clear(notifId);
  }
});
