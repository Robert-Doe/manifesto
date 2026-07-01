#!/usr/bin/env bash
# NeuralTab — Module 06 build script

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$SCRIPT_DIR/dist"

echo "╔══════════════════════════════════════════════╗"
echo "║  NeuralTab Module 06 — Build                 ║"
echo "║  Message Passing: All 4 Patterns             ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

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
  "message_lab.html"
  "message_lab.css"
  "message_lab.js"
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

if [[ -f "$SCRIPT_DIR/assets/inject.js" ]]; then
  cp "$SCRIPT_DIR/assets/inject.js" "$DIST/assets/inject.js"
  echo "  ✓ assets/inject.js"
fi

echo ""
echo "Build complete → $DIST"
echo ""
echo "To install:"
echo "  1. Open Chrome → chrome://extensions"
echo "  2. Enable Developer Mode"
echo "  3. Load unpacked → select: $DIST"
echo ""
echo "New in Module 06:"
echo "  • message_lab.html — Interactive 4-panel message passing laboratory"
echo "  • Pattern 1: One-way fire & forget (oneWayLog)"
echo "  • Pattern 2: Async request/response with return true (echoRequest, getMessageStats)"
echo "  • Pattern 3: Port-based streaming (neuraltab-stream port)"
echo "  • Pattern 4: Storage pub/sub (demoCounter via storage.onChanged)"
echo "  • 3-hop relay: inject.js → content.js → background.js"
echo "  • Background → content script messaging (contentPing, getWordCount)"
echo ""
echo "Key experiment: Open message_lab.html in TWO tabs."
echo "Increment the counter in one — watch it update in the other instantly."
echo "That is Pattern 4: storage.onChanged as a zero-infrastructure pub/sub bus."
