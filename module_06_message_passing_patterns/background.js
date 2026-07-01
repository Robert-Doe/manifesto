// NeuralTab — background.js (Module 06 — All 4 message patterns)
// importScripts MUST be first — makes StorageManager a global in this classic-mode SW

importScripts('storage_manager.js');

// ─── Module-level ephemeral state (resets on every worker restart) ────────────
let inMemoryEventCounter = 0;
const SW_START_TIME      = Date.now();
const keepalivePorts     = new Set(); // 'neuraltab-keepalive' ports (M05)
const streamPorts        = new Set(); // 'neuraltab-stream' ports (M06)

// ─── Worker startup ──────────────────────────────────────────────────────────
async function onWorkerStart() {
  const s = await StorageManager.get(['swStartCount']);
  await StorageManager.set({
    swStartCount: (s.swStartCount || 0) + 1,
    swLastStart:  Date.now(),
  });
  await StorageManager.logSwEvent('START', `wake #${(s.swStartCount || 0) + 1}`);
}
onWorkerStart();

// ─── Install ─────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  inMemoryEventCounter++;
  if (reason === 'install') {
    await StorageManager.set({ installDate: Date.now() });
  }
  await chrome.alarms.create('tab-analysis',  { periodInMinutes: 30 });
  await chrome.alarms.create('sw-heartbeat',  { periodInMinutes: 0.5 });
});

// ─── Alarms ──────────────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async alarm => {
  inMemoryEventCounter++;
  if (alarm.name === 'sw-heartbeat') {
    await StorageManager.logSwEvent('HEARTBEAT', `counter:${inMemoryEventCounter}`);
    return;
  }
  if (alarm.name === 'tab-analysis') {
    await StorageManager.logSwEvent('ALARM', 'tab-analysis fired');
    await runTabAnalysis();
  }
});

// ─── Tab last-access tracking (M05) ──────────────────────────────────────────
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  inMemoryEventCounter++;
  const s     = await StorageManager.get(['tabAccessTimes']);
  const times = s.tabAccessTimes || {};
  times[tabId] = Date.now();
  const entries = Object.entries(times).sort(([, a], [, b]) => a - b);
  while (entries.length > 200) entries.shift();
  await StorageManager.set({ tabAccessTimes: Object.fromEntries(entries) });
});

// ─── Notification clicks ─────────────────────────────────────────────────────
chrome.notifications.onClicked.addListener(id => {
  inMemoryEventCounter++;
  if (id === 'neuraltab-idle') chrome.runtime.openOptionsPage();
});

// ══════════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLER — All 4 patterns wired here
// ══════════════════════════════════════════════════════════════════════════════
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  inMemoryEventCounter++;

  // ── Existing M04/M05 actions ─────────────────────────────────────────────
  if (msg.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
    return false;
  }

  if (msg.action === 'getTabInfo') {
    const context = sender.tab ? `tab:${sender.tab.id}` : 'popup/options';
    StorageManager.logMessage('IN', 'getTabInfo', context);
    sendResponse({ tabId: sender.tab?.id, url: sender.tab?.url, frameId: sender.frameId });
    return false;
  }

  if (msg.action === 'triggerTabAnalysis') {
    runTabAnalysis().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.action === 'groupTabsByDomain') {
    groupTabsByDomain(msg.tabIds, msg.domain).then(r => sendResponse(r));
    return true;
  }

  if (msg.action === 'getWorkerState') {
    sendResponse({
      inMemoryEventCounter,
      swStartTime:    SW_START_TIME,
      uptime:         Date.now() - SW_START_TIME,
      keepalivePorts: keepalivePorts.size,
      streamPorts:    streamPorts.size,
    });
    return false;
  }

  if (msg.action === 'logSwEvent') {
    StorageManager.logSwEvent(msg.event, msg.detail || '').then(() => sendResponse({ ok: true }));
    return true;
  }

  // ── PATTERN 1: One-Way Fire-and-Forget ────────────────────────────────────
  // Sender calls sendMessage but does NOT await a response.
  // Background processes the message and returns false (no sendResponse needed).
  if (msg.action === 'oneWayLog') {
    const ctx = sender.tab ? `content:tab${sender.tab.id}` : (sender.url?.includes('popup') ? 'popup' : 'options/lab');
    StorageManager.logMessage('IN', 'oneWayLog', ctx, msg.text || '');
    // Notice: no sendResponse call. The sender fired and forgot.
    return false;
  }

  // ── PATTERN 2: Async Request / Response ───────────────────────────────────
  // Sender AWAITS the response. Background must call sendResponse asynchronously.
  // CRITICAL: return true to keep the message channel open past this synchronous call.

  if (msg.action === 'echoRequest') {
    const receivedAt = Date.now();
    const ctx = sender.tab ? `content:tab${sender.tab.id}` : 'extension-page';
    StorageManager.logMessage('IN', 'echoRequest', ctx, JSON.stringify(msg.payload));
    // Simulate async work (storage write) then respond
    StorageManager.logMessage('OUT', 'echoResponse', 'background').then(() => {
      sendResponse({
        echo:       msg.payload,
        receivedAt,
        respondedAt: Date.now(),
        roundtripHint: `Background processed in ${Date.now() - receivedAt}ms`,
        workerUptime: Date.now() - SW_START_TIME,
      });
    });
    return true; // ← MUST return true for async sendResponse
  }

  if (msg.action === 'getMessageStats') {
    StorageManager.get(['messageLog', 'messageCount', 'demoCounter', 'activeStreams']).then(s => {
      sendResponse({
        messageCount:  s.messageCount  || 0,
        demoCounter:   s.demoCounter   || 0,
        activeStreams:  streamPorts.size,
        recentLog:     (s.messageLog   || []).slice(-20),
        inMemoryCounter: inMemoryEventCounter,
        uptime:        Date.now() - SW_START_TIME,
      });
    });
    return true;
  }

  if (msg.action === 'incrementDemoCounter') {
    // Pattern 4 helper — increment the shared counter via background
    StorageManager.get(['demoCounter']).then(async s => {
      const next = (s.demoCounter || 0) + (msg.delta || 1);
      await StorageManager.set({ demoCounter: next });
      await StorageManager.logMessage('IN', 'incrementDemoCounter', 'background', `delta:${msg.delta} → ${next}`);
      sendResponse({ newValue: next });
    });
    return true;
  }

  if (msg.action === 'resetDemoCounter') {
    StorageManager.set({ demoCounter: 0 }).then(() => {
      StorageManager.logMessage('IN', 'resetDemoCounter', 'background', 'reset to 0');
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.action === 'clearMessageLog') {
    StorageManager.set({ messageLog: [], messageCount: 0 }).then(() => sendResponse({ ok: true }));
    return true;
  }

  // ── Content script relay (M06) ────────────────────────────────────────────
  // Content script relays page-world messages to background
  if (msg.action === 'relayFromPage') {
    const ctx = `content:tab${sender.tab?.id}`;
    StorageManager.logMessage('IN', 'relayFromPage', ctx, JSON.stringify(msg.payload));
    sendResponse({ relayed: true, ts: Date.now() });
    return false;
  }

  // Ping content script from background (triggered by Message Lab)
  if (msg.action === 'pingContent') {
    // background → content script (already handled inline with sendMessage to tab)
    return false;
  }

  return false;
});

// ══════════════════════════════════════════════════════════════════════════════
// PORT HANDLERS — Pattern 3: Streaming + Pattern keepalive (M05)
// ══════════════════════════════════════════════════════════════════════════════
chrome.runtime.onConnect.addListener(port => {
  inMemoryEventCounter++;

  // ── Keepalive port (M05) ─────────────────────────────────────────────────
  if (port.name === 'neuraltab-keepalive') {
    keepalivePorts.add(port);
    StorageManager.logSwEvent('PORT_OPEN', `keepalive ports: ${keepalivePorts.size}`);
    port.onMessage.addListener(msg => {
      inMemoryEventCounter++;
      if (msg.type === 'ping') port.postMessage({ type: 'pong', counter: inMemoryEventCounter });
    });
    port.onDisconnect.addListener(() => {
      keepalivePorts.delete(port);
      StorageManager.logSwEvent('PORT_CLOSE', `keepalive ports: ${keepalivePorts.size}`);
    });
    return;
  }

  // ── PATTERN 3: Streaming port ────────────────────────────────────────────
  // A long-lived bidirectional channel. Background sends chunks over time.
  // The client can send control messages (startStream, stopStream, ping).
  if (port.name === 'neuraltab-stream') {
    streamPorts.add(port);
    StorageManager.logMessage('PORT_IN', 'portConnect', 'background', `stream ports: ${streamPorts.size}`);
    StorageManager.set({ activeStreams: streamPorts.size });

    let streamInterval = null;

    port.onMessage.addListener(async msg => {
      inMemoryEventCounter++;

      if (msg.action === 'startStream') {
        const total    = Math.min(msg.chunks || 10, 50);
        const delay    = Math.max(msg.delayMs || 150, 50);
        let   sent     = 0;

        // Clear any existing stream
        if (streamInterval) clearInterval(streamInterval);

        port.postMessage({ type: 'streamStart', total, delay });
        await StorageManager.logMessage('PORT_OUT', 'streamStart', 'background', `chunks:${total} delay:${delay}ms`);

        streamInterval = setInterval(async () => {
          sent++;
          const payload = {
            type:   'chunk',
            index:  sent,
            total,
            data:   `Chunk ${sent} of ${total} — ts:${Date.now()}`,
            done:   sent >= total,
          };
          try {
            port.postMessage(payload);
          } catch {
            clearInterval(streamInterval);
            return;
          }
          if (sent >= total) {
            clearInterval(streamInterval);
            streamInterval = null;
            await StorageManager.logMessage('PORT_OUT', 'streamEnd', 'background', `${total} chunks sent`);
          }
        }, delay);
      }

      if (msg.action === 'stopStream') {
        if (streamInterval) { clearInterval(streamInterval); streamInterval = null; }
        port.postMessage({ type: 'streamStopped' });
        await StorageManager.logMessage('PORT_OUT', 'streamStopped', 'background');
      }

      if (msg.action === 'portPing') {
        port.postMessage({ type: 'portPong', counter: inMemoryEventCounter, ts: Date.now() });
      }
    });

    port.onDisconnect.addListener(async () => {
      if (streamInterval) clearInterval(streamInterval);
      streamPorts.delete(port);
      await StorageManager.logMessage('PORT_IN', 'portDisconnect', 'background', `stream ports: ${streamPorts.size}`);
      await StorageManager.set({ activeStreams: streamPorts.size });
    });

    return;
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// TAB ANALYSIS (from M04/M05 — unchanged)
// ══════════════════════════════════════════════════════════════════════════════
async function runTabAnalysis() {
  const hasTabsPerm = await chrome.permissions.contains({ permissions: ['tabs'] });
  if (!hasTabsPerm) return;
  const s    = await StorageManager.get(['idleTabThresholdMins', 'tabAnalysisEnabled', 'tabAccessTimes']);
  if (!s.tabAnalysisEnabled) return;
  const tabs = await chrome.tabs.query({});
  const now  = Date.now();
  const idleMs = s.idleTabThresholdMins * 60_000;
  const idle = tabs.filter(t => {
    if (t.active || t.audible || t.pinned) return false;
    const last = s.tabAccessTimes?.[t.id];
    return last ? (now - last) > idleMs : true;
  });
  await StorageManager.set({ lastTabAnalysis: now });
  if (idle.length > 0) {
    await sendIdleNotification(idle.length);
    await StorageManager.recordIdleAlert();
  }
}

async function sendIdleNotification(count) {
  const hasNotif = await chrome.permissions.contains({ permissions: ['notifications'] });
  if (!hasNotif) return;
  await chrome.notifications.create('neuraltab-idle', {
    type:    'basic',
    iconUrl: 'assets/icon128.png',
    title:   'NeuralTab Tab Analysis',
    message: `${count} idle tab${count !== 1 ? 's' : ''} detected. Click to review.`,
  });
}

async function groupTabsByDomain(tabIds, domain) {
  try {
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, { title: domain, color: 'blue' });
    return { ok: true, groupId };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
