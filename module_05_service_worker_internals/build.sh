#!/usr/bin/env bash
# NeuralTab — Module 05 build script
# Copies all source files into dist/ for loading as an unpacked extension.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$SCRIPT_DIR/dist"

echo "╔══════════════════════════════════════════════╗"
echo "║  NeuralTab Module 05 — Build                 ║"
echo "║  Service Worker Internals                    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Clean and recreate dist
rm -rf "$DIST"
mkdir -p "$DIST/assets"

FILES=(
  "manifest.json"
  "storage_manager.js"
  "background.js"
  "popup.html"
  "popup.css"
  "popup.js"
  "options.html"
  "options.css"
  "options.js"
  "content.js"
  "content.css"
  "sw_monitor.html"
  "sw_monitor.css"
  "sw_monitor.js"
  "tab_manager.html"
  "tab_manager.css"
  "tab_manager.js"
)

echo "Copying files..."
for f in "${FILES[@]}"; do
  if [[ -f "$SCRIPT_DIR/$f" ]]; then
    cp "$SCRIPT_DIR/$f" "$DIST/$f"
    echo "  ✓ $f"
  else
    echo "  ✗ MISSING: $f" >&2
    exit 1
  fi
done

# Assets
if [[ -f "$SCRIPT_DIR/assets/inject.js" ]]; then
  cp "$SCRIPT_DIR/assets/inject.js" "$DIST/assets/inject.js"
  echo "  ✓ assets/inject.js"
fi

echo ""
echo "Build complete → $DIST"
echo ""
echo "To install:"
echo "  1. Open Chrome → chrome://extensions"
echo "  2. Enable Developer Mode (top-right toggle)"
echo "  3. Click 'Load unpacked' → select: $DIST"
echo ""
echo "New in Module 05:"
echo "  • sw_monitor.html — Live service worker lifecycle dashboard"
echo "  • importScripts() in background.js — StorageManager shared properly"
echo "  • Keepalive port pattern — 25-second ping prevents idle kill"
echo "  • tabAccessTimes tracking — real last-access in Tab Manager"
echo "  • logSwEvent() — persistent lifecycle audit trail"
echo ""
echo "To prove the 5-minute kill:"
echo "  Open SW Monitor → disable keepalive → wait 5-6 min →"
echo "  interact with the extension → watch inMemoryEventCounter reset to 0"
