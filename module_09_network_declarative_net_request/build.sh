#!/usr/bin/env bash
# NeuralTab — Module 09 build script
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$SCRIPT_DIR/dist"
echo "╔══════════════════════════════════════════════╗"
echo "║  NeuralTab Module 09 — Build                 ║"
echo "║  Network Layer: DNR & Network Monitor        ║"
echo "╚══════════════════════════════════════════════╝"
rm -rf "$DIST"; mkdir -p "$DIST/assets"
FILES=(
  "manifest.json" "dnr_rules.json" "storage_manager.js" "idb_manager.js"
  "migration_manager.js" "background.js"
  "popup.html" "popup.css" "popup.js" "options.html" "options.css" "options.js"
  "content.js" "content.css"
  "network_monitor.html" "network_monitor.js"
  "history_db.html" "history_db.css" "history_db.js"
  "update_log.html"
  "sw_monitor.html" "sw_monitor.css" "sw_monitor.js"
  "tab_manager.html" "tab_manager.css" "tab_manager.js"
  "message_lab.html" "message_lab.css" "message_lab.js"
)
for f in "${FILES[@]}"; do
  [[ -f "$SCRIPT_DIR/$f" ]] && cp "$SCRIPT_DIR/$f" "$DIST/$f" && echo "  ✓ $f" || { echo "  ✗ MISSING: $f" >&2; exit 1; }
done
cp "$SCRIPT_DIR/assets/inject.js" "$DIST/assets/inject.js" && echo "  ✓ assets/inject.js"
echo ""; echo "Build complete → $DIST"
echo "New in Module 09:"
echo "  • dnr_rules.json      — 5 declarativeNetRequest rules (block/redirect/headers)"
echo "  • network_monitor.html — live navigation event log + DNR rule viewer"
echo "  • webNavigation       — main-frame navigation events logged to storage"
echo "  • DNR toggle          — enable/disable entire ruleset from UI"
