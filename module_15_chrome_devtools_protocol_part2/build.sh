#!/usr/bin/env bash
set -euo pipefail
MODULE="module_15"
DIST="dist/${MODULE}"
echo "Building ${MODULE}…"
rm -rf "$DIST" && mkdir -p "$DIST/assets" "$DIST/demo"
cp manifest.json background.js storage_manager.js migration_manager.js idb_manager.js \
   content.js content.css \
   popup.html popup.css popup.js \
   options.html options.css options.js \
   sw_monitor.html sw_monitor.css sw_monitor.js \
   tab_manager.html tab_manager.css tab_manager.js \
   message_lab.html message_lab.css message_lab.js \
   history_db.html history_db.css history_db.js \
   update_log.html dnr_rules.json \
   network_monitor.html network_monitor.js \
   world_demo.html world_demo.js "$DIST/" 2>/dev/null || true
cp assets/inject.js "$DIST/assets/" 2>/dev/null || true
cp demo/index.html "$DIST/demo/"
echo "Done → $DIST"
