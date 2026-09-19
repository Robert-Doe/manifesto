/**
 * Live Message Passing + Service Worker Lifecycle simulator.
 *
 * Chrome extensions can't run as a plain webpage, so this is an honest
 * simulator rather than the real extension — but the two message patterns
 * and the worker lifecycle state machine are ported directly from the real
 * module_06_message_passing_patterns/background.js and
 * module_05_service_worker_internals/sw_monitor.js:
 *
 *   - Pattern 1 (one-way fire-and-forget): 'oneWayLog' — sender does not
 *     await a response; the handler returns without calling sendResponse.
 *   - Pattern 2 (async request/response): 'echoRequest' — the real handler
 *     MUST keep the message channel open ("return true") because it
 *     responds asynchronously; we mirror that with a real setTimeout delay
 *     here rather than resolving synchronously.
 *   - Worker lifecycle: an in-memory event counter and start time that only
 *     exist for the life of the current worker instance, an idle timeout
 *     that puts the worker to sleep, and a "wake" that resets the in-memory
 *     counter to 0 while a separate, longer-lived "wakes" count keeps
 *     incrementing — exactly the swStartCount / inMemoryEventCounter split
 *     in the real background.js.
 *
 * The "content script" and "background service worker" below are two plain
 * JS objects in this same page, deliberately talking to each other only
 * through window.postMessage — a real, asynchronous, structured-clone
 * message pass, not a direct function call — so the demo is genuinely
 * message-passing, not just two panels sharing a variable.
 */

const BUS_SOURCE = 'manifesto-sim';
const IDLE_AFTER_MS = 8000; // shortened from real ~30s Chrome idle timeout, for a watchable demo
const TERMINATE_AFTER_MS = 2000; // idle -> terminated grace period

type Role = 'content' | 'background';

interface BusMessage {
  source: typeof BUS_SOURCE;
  to: Role;
  action?: string;
  type?: string;
  id?: string;
  text?: string;
  payload?: unknown;
  echo?: unknown;
  roundtripHint?: string;
  workerUptime?: number;
}

function send(msg: BusMessage) {
  window.postMessage(msg, '*');
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) node.append(c);
  return node;
}

function logLine(container: HTMLElement, cls: string, tag: string, detail: string) {
  const empty = container.querySelector('.empty');
  if (empty) empty.remove();
  const line = el('div', { className: `line ${cls}` }, el('span', { className: 'tag' }, `[${tag}] `), detail);
  container.append(line);
  container.scrollTop = container.scrollHeight;
}

export function mountLiveSimulator(root: HTMLElement) {
  root.innerHTML = '';

  // ── Content script panel ──────────────────────────────────────────────
  const contentLog = el('div', { className: 'sim-log' }, el('div', { className: 'empty' }, 'No messages sent yet.'));
  const contentInput = el('input', { placeholder: 'e.g. hello from the page', value: 'hello from the page' }) as HTMLInputElement;
  const btnOneWay = el('button', { className: 'sim-btn' }, 'Send one-way log');
  const btnEcho = el('button', { className: 'sim-btn primary' }, 'Send echo request →');

  const contentStatus = el('span', { className: 'status active' }, 'running');
  const contentPanel = el(
    'div',
    { className: 'sim-panel' },
    el('div', { className: 'sim-head' }, el('span', { className: 'title' }, 'Content Script (page context)'), contentStatus),
    el(
      'div',
      { className: 'sim-body' },
      el('div', { className: 'sim-input-row' }, contentInput),
      el('div', { className: 'sim-btn-row' }, btnOneWay, btnEcho),
      contentLog,
      el(
        'div',
        { className: 'sim-note' },
        'Pattern 1: oneWayLog fires and forgets — no response is awaited. Pattern 2: echoRequest awaits an async response from the worker.'
      )
    )
  );

  // ── Background service worker panel ─────────────────────────────────────
  const bgLog = el('div', { className: 'sim-log' }, el('div', { className: 'empty' }, 'Worker idle. Waiting for its first event.'));
  const bgStatusBadge = el('span', { className: 'status active' }, 'ACTIVE');
  const statUptime = el('b', {}, '0s');
  const statCounter = el('b', {}, '0');
  const statWakes = el('b', {}, '1');
  const btnForceIdle = el('button', { className: 'sim-btn' }, 'Skip ahead to idle timeout');

  const bgPanel = el(
    'div',
    { className: 'sim-panel' },
    el('div', { className: 'sim-head' }, el('span', { className: 'title' }, 'Background Service Worker'), bgStatusBadge),
    el(
      'div',
      { className: 'sim-body' },
      el(
        'div',
        { className: 'sim-stats' },
        el('div', { className: 'stat' }, 'uptime', statUptime),
        el('div', { className: 'stat' }, 'in-mem counter', statCounter),
        el('div', { className: 'stat' }, 'total wakes', statWakes)
      ),
      el('div', { className: 'sim-btn-row' }, btnForceIdle),
      bgLog,
      el(
        'div',
        { className: 'sim-note' },
        'Mirrors the real background.js: inMemoryEventCounter and SW_START_TIME reset to zero on every restart; only the wake count survives, like swStartCount in chrome.storage.'
      )
    )
  );

  root.append(el('div', { className: 'sim' }, contentPanel, bgPanel));

  // ── Background worker state machine ─────────────────────────────────────
  let status: 'ACTIVE' | 'IDLE' | 'TERMINATED' = 'ACTIVE';
  let counter = 0;
  let wakes = 1;
  let startTime = Date.now();
  let idleTimer: number | undefined;
  let terminateTimer: number | undefined;
  let uptimeTicker: number | undefined;

  function setStatus(next: typeof status) {
    status = next;
    bgStatusBadge.textContent = next;
    bgStatusBadge.className = `status ${next.toLowerCase()}`;
  }

  function clearTimers() {
    window.clearTimeout(idleTimer);
    window.clearTimeout(terminateTimer);
  }

  function armIdleTimers() {
    clearTimers();
    idleTimer = window.setTimeout(() => {
      setStatus('IDLE');
      logLine(bgLog, 'evt', 'IDLE', `No events for ${IDLE_AFTER_MS / 1000}s — Chrome may reclaim this worker at any moment.`);
      terminateTimer = window.setTimeout(() => {
        setStatus('TERMINATED');
        logLine(bgLog, 'err', 'TERMINATED', 'Worker instance destroyed. In-memory counter and uptime are gone — only the next event can bring it back.');
      }, TERMINATE_AFTER_MS);
    }, IDLE_AFTER_MS);
  }

  function wakeIfNeeded() {
    if (status === 'TERMINATED') {
      wakes += 1;
      counter = 0;
      startTime = Date.now();
      statWakes.textContent = String(wakes);
      logLine(bgLog, 'evt', 'START', `wake #${wakes} — fresh worker instance, counter reset to 0.`);
    }
    setStatus('ACTIVE');
    armIdleTimers();
  }

  function onBackgroundReceive(msg: BusMessage) {
    wakeIfNeeded();
    counter += 1;
    statCounter.textContent = String(counter);

    if (msg.action === 'oneWayLog') {
      logLine(bgLog, 'in', 'IN oneWayLog', `"${msg.text}" — fire-and-forget, no response sent (matches real StorageManager.logMessage('IN', ...) with no sendResponse call).`);
      return;
    }

    if (msg.action === 'echoRequest') {
      const receivedAt = Date.now();
      logLine(bgLog, 'in', 'IN echoRequest', `payload="${msg.payload}" — responding asynchronously (real handler must "return true" to keep the channel open)`);
      window.setTimeout(() => {
        const uptime = Date.now() - startTime;
        logLine(bgLog, 'out', 'OUT echoResponse', `#${msg.id} after ${Date.now() - receivedAt}ms`);
        send({
          source: BUS_SOURCE,
          to: 'content',
          type: 'echoResponse',
          id: msg.id,
          echo: msg.payload,
          roundtripHint: `Background processed in ${Date.now() - receivedAt}ms`,
          workerUptime: uptime,
        });
      }, 120 + Math.round(Math.random() * 120));
    }
  }

  // ── Content script event handlers ────────────────────────────────────────
  const pending = new Map<string, number>();

  btnOneWay.addEventListener('click', () => {
    const text = contentInput.value || '(empty)';
    logLine(contentLog, 'out', 'OUT oneWayLog', `"${text}"`);
    send({ source: BUS_SOURCE, to: 'background', action: 'oneWayLog', text });
  });

  btnEcho.addEventListener('click', () => {
    const id = 'req_' + Math.random().toString(36).slice(2, 9);
    const text = contentInput.value || '(empty)';
    pending.set(id, Date.now());
    logLine(contentLog, 'out', 'OUT echoRequest', `#${id} payload="${text}" — awaiting response…`);
    send({ source: BUS_SOURCE, to: 'background', action: 'echoRequest', id, payload: text });
  });

  btnForceIdle.addEventListener('click', () => {
    clearTimers();
    setStatus('IDLE');
    logLine(bgLog, 'evt', 'IDLE', 'Manually skipped ahead — no events for a while now.');
    terminateTimer = window.setTimeout(() => {
      setStatus('TERMINATED');
      logLine(bgLog, 'err', 'TERMINATED', 'Worker instance destroyed. In-memory counter and uptime are gone — only the next event can bring it back.');
    }, 900);
  });

  // ── The bus: a real window.postMessage round trip between the two "realms"
  window.addEventListener('message', (e) => {
    const data = e.data as BusMessage | undefined;
    if (!data || data.source !== BUS_SOURCE) return;
    if (data.to === 'background') onBackgroundReceive(data);
    if (data.to === 'content' && data.type === 'echoResponse' && data.id) {
      const sentAt = pending.get(data.id);
      pending.delete(data.id);
      const rtt = sentAt ? Date.now() - sentAt : undefined;
      logLine(
        contentLog,
        'in',
        'IN echoResponse',
        `#${data.id} echo="${data.echo}" ${rtt !== undefined ? `— round trip ${rtt}ms` : ''} (worker uptime ${Math.round((data.workerUptime || 0) / 100) / 10}s)`
      );
    }
  });

  // uptime ticker
  uptimeTicker = window.setInterval(() => {
    if (status === 'TERMINATED') return;
    const s = Math.floor((Date.now() - startTime) / 1000);
    statUptime.textContent = s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  }, 1000);

  armIdleTimers();

  // Return a cleanup handle in case the caller navigates away from this module.
  return () => {
    clearTimers();
    window.clearInterval(uptimeTicker);
  };
}
