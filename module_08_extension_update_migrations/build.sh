#!/usr/bin/env bash
# NeuralTab — Module 08 build script
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$SCRIPT_DIR/dist"
echo "╔══════════════════════════════════════════════╗"
echo "║  NeuralTab Module 08 — Build                 ║"
echo "║  Extension Update Mechanics & Migration      ║"
echo "╚══════════════════════════════════════════════╝"
rm -rf "$DIST"; mkdir -p "$DIST/assets"
FILES=(
  "manifest.json" "storage_manager.js" "idb_manager.js" "migration_manager.js" "background.js"
  "popup.html" "popup.css" "popup.js" "options.html" "options.css" "options.js"
  "content.js" "content.css"
  "update_log.html"
  "history_db.html" "history_db.css" "history_db.js"
  "sw_monitor.html" "sw_monitor.css" "sw_monitor.js"
  "tab_manager.html" "tab_manager.css" "tab_manager.js"
  "message_lab.html" "message_lab.css" "message_lab.js"
)
for f in "${FILES[@]}"; do
  [[ -f "$SCRIPT_DIR/$f" ]] && cp "$SCRIPT_DIR/$f" "$DIST/$f" && echo "  ✓ $f" || { echo "  ✗ MISSING: $f" >&2; exit 1; }
done
cp "$SCRIPT_DIR/assets/inject.js" "$DIST/assets/inject.js" && echo "  ✓ assets/inject.js"
echo ""; echo "Build complete → $DIST"
echo "New in Module 08:"
echo "  • migration_manager.js — versioned migration runner"
echo "  • update_log.html     — visual migration history browser"
echo "  • background.js       — proper onInstalled with reason routing"
echo "  • Simulate Update button in update_log.html to re-run migrations"
