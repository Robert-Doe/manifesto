// NeuralTab — wasm_runner.js (Module 13)
'use strict';

// Minimal fibonacci Wasm binary (hand-compiled from the WAT in the demo)
// fib(n): recursive fibonacci, exported as "fib"
const WASM_FIB_BYTES = new Uint8Array([
  0x00,0x61,0x73,0x6d, // magic: \0asm
  0x01,0x00,0x00,0x00, // version 1
  // type section: (i32) -> i32
  0x01,0x06,0x01,0x60,0x01,0x7f,0x01,0x7f,
  // function section: 1 function of type 0
  0x03,0x02,0x01,0x00,
  // export section: "fib" -> func 0
  0x07,0x07,0x01,0x03,0x66,0x69,0x62,0x00,0x00,
  // code section
  0x0a,0x1f,0x01,0x1d,0x00,
  // if n < 2 return n
  0x20,0x00,           // local.get 0
  0x41,0x02,           // i32.const 2
  0x48,                // i32.lt_s
  0x04,0x40,           // if (void)
  0x20,0x00,           // local.get 0
  0x0f,                // return
  0x0b,                // end
  // fib(n-1) + fib(n-2)
  0x20,0x00,0x41,0x01,0x6b, // local.get 0; i32.const 1; i32.sub
  0x10,0x00,                 // call 0
  0x20,0x00,0x41,0x02,0x6b, // local.get 0; i32.const 2; i32.sub
  0x10,0x00,                 // call 0
  0x6a,                      // i32.add
  0x0b,                      // end
]);

let wasmFib = null;

async function loadWasm() {
  try {
    const mod = await WebAssembly.instantiate(WASM_FIB_BYTES.buffer);
    wasmFib = mod.instance.exports.fib;
    document.getElementById('csp-status').textContent =
      '✓ WebAssembly available — Wasm binary loaded successfully (no unsafe-eval needed)';
    document.getElementById('csp-status').style.color = 'var(--green)';
  } catch (e) {
    document.getElementById('csp-status').textContent = 'Error loading Wasm: ' + e.message;
    document.getElementById('csp-status').style.color = 'var(--red)';
  }
}

function jsFib(n) {
  if (n < 2) return n;
  return jsFib(n - 1) + jsFib(n - 2);
}

document.getElementById('btn-fib').addEventListener('click', () => {
  const n = parseInt(document.getElementById('fib-n').value) || 10;

  // WASM
  if (wasmFib) {
    const t0 = performance.now();
    const wasmResult = wasmFib(n);
    const t1 = performance.now();
    document.getElementById('wasm-result').textContent = wasmResult;
    document.getElementById('wasm-time').textContent = `${(t1 - t0).toFixed(2)}ms`;
  } else {
    document.getElementById('wasm-result').textContent = 'Wasm not loaded';
  }

  // JS
  const t2 = performance.now();
  const jsResult = jsFib(n);
  const t3 = performance.now();
  document.getElementById('js-result').textContent = jsResult;
  document.getElementById('js-time').textContent = `${(t3 - t2).toFixed(2)}ms`;
});

loadWasm();
