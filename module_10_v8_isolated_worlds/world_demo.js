// NeuralTab — world_demo.js (Module 10)
'use strict';

let targetTabId = null;
const log = document.getElementById('exec-log');

function addLog(world, text, isErr = false) {
  const row = document.createElement('div');
  row.className = `log-row ${isErr ? 'log-err' : world === 'ISOLATED' ? 'log-iso' : 'log-main'}`;
  row.textContent = `[${world}] ${new Date().toLocaleTimeString()} — ${text}`;
  log.insertBefore(row, log.firstChild);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function getTab() {
  const input = document.getElementById('tab-id').value.trim();
  if (input) return parseInt(input);
  return await getActiveTab();
}

async function execInWorld(code, world) {
  const tabId = await getTab();
  if (!tabId) { addLog(world, 'No tab selected', true); return null; }
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: new Function('return ' + code),
      world
    });
    return results[0]?.result;
  } catch (e) {
    addLog(world, `Error: ${e.message}`, true);
    return undefined;
  }
}

document.getElementById('btn-get-tab').addEventListener('click', async () => {
  const id = await getActiveTab();
  document.getElementById('tab-id').value = id || '';
  addLog('INFO', `Active tab ID: ${id}`);
});

// ── Isolated World buttons ────────────────────────────────────────────────────
document.getElementById('iso-read-var').addEventListener('click', async () => {
  const result = await execInWorld('window.__pageSecret', 'ISOLATED');
  const display = result === undefined ? 'undefined (isolated world cannot see page vars)' : JSON.stringify(result);
  document.getElementById('iso-result').textContent = `window.__pageSecret = ${display}`;
  addLog('ISOLATED', `window.__pageSecret → ${display}`);
});

document.getElementById('iso-write-var').addEventListener('click', async () => {
  await execInWorld('(window.__fromExtension = 42, "written")', 'ISOLATED');
  document.getElementById('iso-result').textContent = 'Wrote window.__fromExtension = 42 in isolated world.\nCheck MAIN world read — page cannot see it.';
  addLog('ISOLATED', 'Wrote window.__fromExtension = 42 in isolated heap');
});

document.getElementById('iso-dom').addEventListener('click', async () => {
  const result = await execInWorld('document.title', 'ISOLATED');
  document.getElementById('iso-result').textContent = `document.title = "${result}"\n(DOM is SHARED — both worlds see the same DOM)`;
  addLog('ISOLATED', `document.title → "${result}" ← shared DOM works`);
});

// ── MAIN World buttons ────────────────────────────────────────────────────────
document.getElementById('main-set-seed').addEventListener('click', async () => {
  await execInWorld('(window.__pageSecret = "secret123", "set")', 'MAIN');
  document.getElementById('main-result').textContent = 'Set window.__pageSecret = "secret123" in MAIN world.\nNow try reading it from ISOLATED world above.';
  addLog('MAIN', 'Set window.__pageSecret = "secret123" in page heap');
});

document.getElementById('main-read-var').addEventListener('click', async () => {
  const result = await execInWorld('window.__pageSecret', 'MAIN');
  const display = result === undefined ? 'undefined' : JSON.stringify(result);
  document.getElementById('main-result').textContent = `window.__pageSecret = ${display}\n(MAIN world reads page variables directly)`;
  addLog('MAIN', `window.__pageSecret → ${display}`);
});

document.getElementById('main-write-var').addEventListener('click', async () => {
  await execInWorld('(window.__pageSecret = "pwned", "written")', 'MAIN');
  document.getElementById('main-result').textContent = 'Overwrote window.__pageSecret = "pwned" in MAIN world.\nPage JS will now see the modified value.';
  addLog('MAIN', 'Overwrote window.__pageSecret in page heap → page sees new value');
});
