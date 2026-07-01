#!/usr/bin/env bash
# NeuralTab — Module 07 build script

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$SCRIPT_DIR/dist"

echo "╔══════════════════════════════════════════════╗"
echo "║  NeuralTab Module 07 — Build                 ║"
echo "║  Storage Mastery: local/sync/session + IDB   ║"
echo "╚══════════════════════════════════════════════╝"

rm -rf "$DIST"
mkdir -p "$DIST/assets"

FILES=(
  "manifest.json"
  "storage_manager.js"
  "idb_manager.js"
  "background.js"
  "popup.html" "popup.css" "popup.js"
  "options.html" "options.css" "options.js"
  "content.js" "content.css"
  "history_db.html" "history_db.css" "history_db.js"
  "sw_monitor.html" "sw_monitor.css" "sw_monitor.js"
  "tab_manager.html" "tab_manager.css" "tab_manager.js"
  "message_lab.html" "message_lab.css" "message_lab.js"
)

for f in "${FILES[@]}"; do
  if [[ -f "$SCRIPT_DIR/$f" ]]; then cp "$SCRIPT_DIR/$f" "$DIST/$f" && echo "  ✓ $f"
  else echo "  ✗ MISSING: $f" >&2; exit 1; fi
done

cp "$SCRIPT_DIR/assets/inject.js" "$DIST/assets/inject.js" && echo "  ✓ assets/inject.js"

echo ""
echo "Build complete → $DIST"
echo ""
echo "New in Module 07:"
echo "  • idb_manager.js    — IndexedDB wrapper (10,000 page visits)"
echo "  • history_db.html   — Full-text history browser with export"
echo "  • storage_manager   — quota checking, session storage support"
echo "  • Background tracks every page visit via content.js → logPageVisit"
echo "  • Options: Storage section shows quota bar + IDB stats"
echo "  • Popup: History button + storage quota bar"
echo ""
echo "Key experiment: Browse 10+ pages, open History DB, search by keyword."
echo "Open DevTools → Application → IndexedDB → neuraltab-history → page_visits"
echo "See all 4 indexes: id, url, timestamp, domain"
