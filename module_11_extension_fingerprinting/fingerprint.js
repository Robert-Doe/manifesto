// NeuralTab — fingerprint.js (Module 11)
'use strict';

const log = [];
function probe(name, value) {
  log.push(`${name}: ${JSON.stringify(value)}`);
  return value;
}

async function runProbes() {
  log.length = 0;

  // Runtime environment
  const ua = probe('userAgent', navigator.userAgent);
  const platform = probe('platform', navigator.platform);
  const chromeVer = ua.match(/Chrome\/([\d.]+)/)?.[1] || 'unknown';
  probe('chromeVersion', chromeVer);
  const extId = probe('extensionId', chrome.runtime.id);
  const manifest = chrome.runtime.getManifest();
  probe('manifestVersion', manifest.manifest_version);
  probe('extensionVersion', manifest.version);
  probe('serviceWorker', typeof ServiceWorkerGlobalScope !== 'undefined' ? 'yes' : 'no');

  // API availability
  const apis = {
    identity: !!chrome.identity,
    debugger: !!chrome.debugger,
    sidePanel: !!chrome.sidePanel,
    session: !!chrome.storage?.session,
    idb: typeof indexedDB !== 'undefined',
    wasm: typeof WebAssembly !== 'undefined',
  };
  for (const [k, v] of Object.entries(apis)) probe(`api.${k}`, v);

  // Storage fingerprint
  const [localBytes, syncBytes] = await Promise.all([
    new Promise(r => chrome.storage.local.getBytesInUse(null, r)),
    new Promise(r => chrome.storage.sync.getBytesInUse(null, r)),
  ]);
  probe('storage.localBytes', localBytes);
  probe('storage.syncBytes', syncBytes);

  const data = await new Promise(r => chrome.storage.local.get([
    'swInstallTime', 'swStartCount', 'schemaVersion', 'historyVisitCount'
  ], r));
  const age = data.swInstallTime
    ? Math.floor((Date.now() - data.swInstallTime) / 86400000)
    : -1;
  probe('install.ageDays', age);
  probe('swStartCount', data.swStartCount || 0);
  probe('schemaVersion', data.schemaVersion || '0.1.0');
  probe('historyVisitCount', data.historyVisitCount || 0);

  return { ua, platform, chromeVer, extId, manifest, apis, localBytes, syncBytes, data, age };
}

function setVal(id, text, cls = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'val' + (cls ? ' ' + cls : '');
}

document.getElementById('btn-run').addEventListener('click', async () => {
  const r = await runProbes();

  const uaShort = r.ua.match(/Chrome\/[\d.]+/)?.[0] || r.ua.substring(0, 20);
  setVal('f-ua', uaShort);
  setVal('f-platform', r.platform);
  setVal('f-chrome', r.chromeVer, 'good');
  setVal('f-id', r.extId.substring(0, 12) + '…');
  setVal('f-mv', r.manifest.manifest_version, 'good');
  setVal('f-sw', typeof ServiceWorkerGlobalScope !== 'undefined' ? 'N/A (page)' : 'available', 'good');

  setVal('f-identity', r.apis.identity ? '✓' : '✗', r.apis.identity ? 'good' : 'bad');
  setVal('f-debugger', r.apis.debugger ? '✓' : '✗', r.apis.debugger ? 'good' : 'warn');
  setVal('f-sidepanel', r.apis.sidePanel ? '✓' : '✗', r.apis.sidePanel ? 'good' : 'warn');
  setVal('f-session', r.apis.session ? '✓' : '✗', r.apis.session ? 'good' : 'bad');
  setVal('f-idb', r.apis.idb ? '✓' : '✗', r.apis.idb ? 'good' : 'bad');
  setVal('f-wasm', r.apis.wasm ? '✓' : '✗', r.apis.wasm ? 'good' : 'bad');

  setVal('f-local', (r.localBytes / 1024).toFixed(1) + ' KB');
  setVal('f-sync', (r.syncBytes / 1024).toFixed(2) + ' KB');
  setVal('f-hist', r.data.historyVisitCount || 0);
  setVal('f-age', r.age >= 0 ? r.age + ' days' : 'unknown');
  setVal('f-starts', r.data.swStartCount || 0);
  setVal('f-schema', r.data.schemaVersion || '0.1.0');

  // Detectability
  const warCount = r.manifest.web_accessible_resources?.[0]?.resources?.length || 0;
  setVal('d-war', `${warCount} resources exposed`, warCount > 10 ? 'warn' : 'good');
  setVal('d-dom', 'Low (no DOM injection)', 'good');
  setVal('d-net', 'Low (DNR only)', 'good');

  const stealth = Math.max(0, 100 - warCount * 3 - (r.apis.debugger ? 15 : 0));
  document.getElementById('score-fill').style.width = stealth + '%';
  document.getElementById('score-fill').style.background = stealth > 70 ? 'var(--green)' : stealth > 40 ? 'var(--orange)' : 'var(--red)';
  document.getElementById('score-label').textContent = stealth + '/100';

  document.getElementById('raw-output').textContent = log.join('\n');
});

document.getElementById('btn-clear').addEventListener('click', () => {
  document.getElementById('raw-output').textContent = 'Click "Run All Probes" to begin…';
  ['f-ua','f-platform','f-chrome','f-id','f-mv','f-sw',
   'f-identity','f-debugger','f-sidepanel','f-session','f-idb','f-wasm',
   'f-local','f-sync','f-hist','f-age','f-starts','f-schema',
   'd-war','d-dom','d-net'].forEach(id => setVal(id, '—'));
  document.getElementById('score-fill').style.width = '0%';
  document.getElementById('score-label').textContent = '—/100';
});
