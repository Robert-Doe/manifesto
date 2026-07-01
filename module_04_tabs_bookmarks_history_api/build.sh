#!/usr/bin/env bash
# NeuralTab — build.sh (Module 04 — cumulative)
# Usage: bash build.sh | bash build.sh clean

set -euo pipefail
DIST_DIR="dist"; ZIP_NAME="neuraltab.zip"; ZIP_PATH="${DIST_DIR}/${ZIP_NAME}"

if [[ "${1:-}" == "clean" ]]; then rm -rf "${DIST_DIR}"; echo "✓ Cleaned"; exit 0; fi

ICONS_MISSING=0
for size in 16 48 128; do
  [[ ! -f "icons/icon${size}.png" ]] && echo "⚠ Missing icons/icon${size}.png" && ICONS_MISSING=1
done
[[ $ICONS_MISSING -eq 1 ]] && echo "Open icons/create_icons.html from module_01 to generate icons."

mkdir -p "${DIST_DIR}"; rm -f "${ZIP_PATH}"

FILES=(
  manifest.json
  popup.html popup.css popup.js
  options.html options.css options.js
  tab_manager.html tab_manager.css tab_manager.js
  background.js
  storage_manager.js
  content.js content.css
  assets/inject.js
)

for size in 16 48 128; do
  icon="icons/icon${size}.png"
  [[ -f "$icon" ]] && FILES+=("$icon")
done

zip -r "${ZIP_PATH}" "${FILES[@]}"
echo "✓ Built: ${ZIP_PATH}"; echo ""; zip -sf "${ZIP_PATH}"
