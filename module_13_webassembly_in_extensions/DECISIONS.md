# Module 13 — DECISIONS.md: WebAssembly in Extensions

## Decision 1: Inline Binary vs. Fetched .wasm File

wasm_runner.js embeds the fibonacci Wasm binary as a Uint8Array inline in JavaScript. The alternative is shipping a `neuraltab.wasm` file and loading it with `WebAssembly.instantiateStreaming(fetch(url))`. We chose inline for the tutorial because it requires no additional file, but production extensions should use a .wasm file — it's cached by the browser and can be larger than what's reasonable to inline.

## Decision 2: Why Wasm Works Without unsafe-eval in Extensions

MV3 extension pages have a strict CSP that blocks `eval` and inline scripts. WebAssembly might seem to require `eval`-like capability, but it doesn't. `WebAssembly.instantiate(buffer)` compiles a binary buffer — not JavaScript source text — and is explicitly allowed by the CSP spec. The restriction is on `WebAssembly.compile(string)` (doesn't exist) and dynamic code generation, not binary compilation.

## Decision 3: Service Workers Can Run Wasm

MV3 background service workers can use WebAssembly. `importScripts` can't load .wasm files (they're not scripts), but you can fetch a .wasm URL, compile it, and cache the module. The key: use `WebAssembly.Module` caching to avoid recompiling on every SW wakeup, since compilation is expensive.

## Decision 4: Recursive Fibonacci as a Benchmark Subject

We chose recursive fibonacci specifically because it is CPU-bound, has no I/O, and the JS and Wasm implementations are structurally identical — making the timing comparison meaningful. Real Wasm advantages appear in: cryptography, image processing, audio processing, physics simulations, and compression. For simple logic, JIT-compiled JavaScript is competitive.

## Decision 5: The Real Use Case for Wasm in Extensions

The most compelling use cases: (1) running a spell-checker compiled from C++ (like Hunspell), (2) image processing (resize, compress, watermark), (3) cryptographic operations (hashing, signing), (4) running a sandboxed language interpreter. NeuralTab's fibonacci is a proof of concept — the architecture (load once, call many times) is the pattern to learn.

## Decision 6: Memory Management Across SW Restarts

When the service worker restarts, the compiled Wasm module is lost. Re-compilation from the buffer on every SW start is acceptable for small modules (<100KB). For large modules, consider caching the `WebAssembly.Module` in a dedicated cache via the Cache API, though this adds complexity. The IDBManager pattern from Module 07 applies here too.
