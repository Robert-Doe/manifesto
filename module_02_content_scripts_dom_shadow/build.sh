#!/usr/bin/env bash
# ============================================================
# NeuralTab — build.sh  (Module 02 — cumulative)
# Usage:
#   bash build.sh        → dist/neuraltab.zip
#   bash build.sh clean  → removes dist/
# ============================================================

set -euo pipefail

DIST_DIR="dist"
ZIP_NAME="neuraltab.zip"
ZIP_PATH="${DIST_DIR}/${ZIP_NAME}"

if [[ "${1:-}" == "clean" ]]; then
  rm -rf "${DIST_DIR}"
  echo "✓ Cleaned: removed ${DIST_DIR}/"
  exit 0
fi

# Verify icons
ICONS_MISSING=0
for size in 16 48 128; do
  if [[ ! -f "icons/icon${size}.png" ]]; then
    echo "⚠  Missing: icons/icon${size}.png"
    ICONS_MISSING=1
  fi
done

if [[ $ICONS_MISSING -eq 1 ]]; then
  echo ""
  echo "ACTION REQUIRED: Open icons/create_icons.html in Chrome."
  echo "Download all three PNGs into icons/ then re-run build."
  echo ""
fi

mkdir -p "${DIST_DIR}"
rm -f "${ZIP_PATH}"

# All extension files — cumulative (M01 + M02 additions)
FILES=(
  manifest.json
  popup.html
  popup.css
  popup.js
  content.js
  content.css
  assets/inject.js
)

for size in 16 48 128; do
  icon="icons/icon${size}.png"
  [[ -f "$icon" ]] && FILES+=("$icon")
done

zip -r "${ZIP_PATH}" "${FILES[@]}"

echo "✓ Built: ${ZIP_PATH}"
echo ""
zip -sf "${ZIP_PATH}"
