#!/usr/bin/env bash
# ============================================================
# NeuralTab — build.sh
# Module 01: Foundations
#
# Usage:
#   bash build.sh         → packages the extension into dist/neuraltab.zip
#   bash build.sh clean   → removes the dist/ directory
#
# How to load the extension in Chrome WITHOUT building:
#   1. Open chrome://extensions
#   2. Enable "Developer mode" (top-right toggle)
#   3. Click "Load unpacked"
#   4. Select this module_01/ folder directly
#   The zip is only needed if you want to share the extension
#   or submit it to the Chrome Web Store.
# ============================================================

set -euo pipefail

DIST_DIR="dist"
ZIP_NAME="neuraltab.zip"
ZIP_PATH="${DIST_DIR}/${ZIP_NAME}"

# ── Clean ────────────────────────────────────────────────────
if [[ "${1:-}" == "clean" ]]; then
  rm -rf "${DIST_DIR}"
  echo "✓ Cleaned: removed ${DIST_DIR}/"
  exit 0
fi

# ── Verify icons exist before packaging ──────────────────────
ICONS_MISSING=0
for size in 16 48 128; do
  if [[ ! -f "icons/icon${size}.png" ]]; then
    echo "⚠  Missing: icons/icon${size}.png"
    ICONS_MISSING=1
  fi
done

if [[ $ICONS_MISSING -eq 1 ]]; then
  echo ""
  echo "ACTION REQUIRED:"
  echo "  Open icons/create_icons.html in your browser."
  echo "  Download all three PNG files and place them in icons/"
  echo "  Then re-run: bash build.sh"
  echo ""
  echo "You can still LOAD UNPACKED without icons (Chrome shows a"
  echo "grey puzzle piece instead), but the zip will be incomplete."
  echo ""
fi

# ── Create dist directory ─────────────────────────────────────
mkdir -p "${DIST_DIR}"
rm -f "${ZIP_PATH}"

# ── Files to include in the package ──────────────────────────
# Never include: tutorial.html, DECISIONS.md, build.sh, demo/,
# icons/create_icons.html — those are developer files, not
# extension files. The browser only needs what's listed here.
FILES=(
  manifest.json
  popup.html
  popup.css
  popup.js
)

# Add icons only if they exist
for size in 16 48 128; do
  icon="icons/icon${size}.png"
  if [[ -f "$icon" ]]; then
    FILES+=("$icon")
  fi
done

# ── Package ───────────────────────────────────────────────────
echo "Building ${ZIP_NAME}..."

# zip is available in Git Bash (Windows) and all Linux/macOS shells
zip -r "${ZIP_PATH}" "${FILES[@]}"

echo ""
echo "✓ Built: ${ZIP_PATH}"
echo ""
echo "Files included:"
zip -sf "${ZIP_PATH}"
echo ""
echo "To install from zip:"
echo "  1. Open chrome://extensions"
echo "  2. Drag and drop ${ZIP_PATH} onto the page"
echo "     — OR —"
echo "  2. Click 'Load unpacked' and select this module_01/ folder"
echo "     (recommended during development)"
