#!/usr/bin/env bash
# ==============================================================================
# SPARROWX HOSTING — LIGHTWEIGHT STELLAR MIDNIGHT BLACK THEME INSTALLER
# ==============================================================================
# Keeps 100% of Stellar Theme's native components, layout, sidebar & UI intact,
# removes all slow overlapping CSS/JS/MutationObserver/blur theme layers, and
# applies ONE clean ~2 KB pure-CSS Midnight Black palette + official favicons.
#
# Usage:
#   sudo bash deploy/ptero-brand-sparrowx.sh             # Clean & apply Midnight Black
#   sudo bash deploy/ptero-brand-sparrowx.sh --remove    # Remove Midnight Black CSS (pure Stellar)
#   sudo bash deploy/ptero-brand-sparrowx.sh --rollback  # Restore latest backup
# ==============================================================================
set -euo pipefail

PTERO_DIR="${PTERO_DIR:-/var/www/pterodactyl}"
REPO_DIR="${REPO_DIR:-/opt/sparrowxdbs}"
BRAND_NAME="${BRAND_NAME:-SparrowX Hosting}"
BRAND_ASSET_DIR="${PTERO_DIR}/public/sparrowx"
BACKUP_ROOT="${PTERO_DIR}/.sparrowx-brand-backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"
THEME_CSS_SRC="${REPO_DIR}/ovh/ptero-midnight-theme.css"
THEME_VERSION="2026-midnight-v3"

green() { printf "\033[32m[OK]\033[0m   %s\n" "$1"; }
info()  { printf "\033[36m[INFO]\033[0m %s\n" "$1"; }
warn()  { printf "\033[33m[WARN]\033[0m %s\n" "$1"; }
err()   { printf "\033[31m[ERR]\033[0m  %s\n" "$1"; }

if [[ ! -d "$PTERO_DIR" ]]; then
  err "Pterodactyl directory not found at ${PTERO_DIR}"
  exit 1
fi

clear_ptero_caches() {
  chown -R www-data:www-data "${PTERO_DIR}/storage" "${PTERO_DIR}/bootstrap/cache" 2>/dev/null || true
  [[ -d "$BRAND_ASSET_DIR" ]] && chown -R www-data:www-data "$BRAND_ASSET_DIR" 2>/dev/null || true
  chmod -R 775 "${PTERO_DIR}/storage" "${PTERO_DIR}/bootstrap/cache" 2>/dev/null || true
  (cd "$PTERO_DIR" && sudo -u www-data env HOME=/tmp php artisan view:clear >/dev/null 2>&1 || true)
  (cd "$PTERO_DIR" && sudo -u www-data env HOME=/tmp php artisan config:clear >/dev/null 2>&1 || true)
  (cd "$PTERO_DIR" && sudo -u www-data env HOME=/tmp php artisan view:cache >/dev/null 2>&1 || true)
}

strip_all_sparrowx_layers() {
  local target_file="$1"
  [[ -f "$target_file" ]] || return 0
  python3 - "$target_file" <<'PY'
import re, sys
path = sys.argv[1]
txt = open(path, "r", encoding="utf-8").read()
txt = re.sub(r"\n?<!-- SPARROWX-BRAND:START -->.*?<!-- SPARROWX-BRAND:END -->\n?", "\n", txt, flags=re.S)
txt = re.sub(r"\n?<!-- SPARROWX-STELLAR-MIDNIGHT:START -->.*?<!-- SPARROWX-STELLAR-MIDNIGHT:END -->\n?", "\n", txt, flags=re.S)
txt = re.sub(r'^[ \t]*<link[^>]+/sparrowx/(?:sparrowx-theme|ptero-midnight-theme)\.css[^>]*>\s*\n?', "", txt, flags=re.M)
txt = re.sub(r'^[ \t]*<script[^>]+/sparrowx/(?:sparrowx-brand|ptero-sparrowx-bridge)\.js[^>]*></script>\s*\n?', "", txt, flags=re.M)
open(path, "w", encoding="utf-8").write(txt)
PY
}

# ------------------------------------------------------------------------------
# REMOVE MODE (Pure unmodified Stellar theme — zero SparrowX overlays)
# ------------------------------------------------------------------------------
if [[ "${1:-}" == "--remove" ]]; then
  info "Removing all SparrowX theme overlays & scripts (keeping native Stellar theme)..."
  strip_all_sparrowx_layers "${PTERO_DIR}/resources/views/templates/wrapper.blade.php"
  strip_all_sparrowx_layers "${PTERO_DIR}/resources/views/templates/auth/core.blade.php"
  rm -f \
    "${BRAND_ASSET_DIR}/sparrowx-theme.css" \
    "${BRAND_ASSET_DIR}/sparrowx-brand.js" \
    "${BRAND_ASSET_DIR}/ptero-sparrowx-bridge.js" \
    "${BRAND_ASSET_DIR}/ptero-midnight-theme.css"
  clear_ptero_caches
  green "All SparrowX overlays removed. Pure Stellar theme is active."
  exit 0
fi

# ------------------------------------------------------------------------------
# ROLLBACK MODE
# ------------------------------------------------------------------------------
if [[ "${1:-}" == "--rollback" ]]; then
  LATEST="$(ls -1dt "${BACKUP_ROOT}"/* 2>/dev/null | head -n1 || true)"
  if [[ -z "$LATEST" || ! -d "$LATEST" ]]; then
    err "No backup found in ${BACKUP_ROOT}"
    exit 1
  fi
  info "Restoring Pterodactyl files from ${LATEST}..."
  [[ -f "${LATEST}/wrapper.blade.php" ]] && cp -a "${LATEST}/wrapper.blade.php" "${PTERO_DIR}/resources/views/templates/wrapper.blade.php"
  [[ -f "${LATEST}/core.blade.php" ]] && cp -a "${LATEST}/core.blade.php" "${PTERO_DIR}/resources/views/templates/auth/core.blade.php"
  [[ -f "${LATEST}/.env" ]] && cp -a "${LATEST}/.env" "${PTERO_DIR}/.env"
  [[ -d "${LATEST}/favicons" ]] && cp -a "${LATEST}/favicons/." "${PTERO_DIR}/public/favicons/"
  rm -rf "$BRAND_ASSET_DIR"
  clear_ptero_caches
  green "Rollback complete. Original Pterodactyl templates restored."
  exit 0
fi

# ------------------------------------------------------------------------------
# 1. BACKUP TEMPLATES BEFORE EDITING
# ------------------------------------------------------------------------------
info "Backing up Pterodactyl templates & favicons to ${BACKUP_DIR}..."
mkdir -p "$BACKUP_DIR"
[[ -f "${PTERO_DIR}/resources/views/templates/wrapper.blade.php" ]] && cp -a "${PTERO_DIR}/resources/views/templates/wrapper.blade.php" "${BACKUP_DIR}/wrapper.blade.php"
[[ -f "${PTERO_DIR}/resources/views/templates/auth/core.blade.php" ]] && cp -a "${PTERO_DIR}/resources/views/templates/auth/core.blade.php" "${BACKUP_DIR}/core.blade.php"
[[ -f "${PTERO_DIR}/.env" ]] && cp -a "${PTERO_DIR}/.env" "${BACKUP_DIR}/.env"
[[ -d "${PTERO_DIR}/public/favicons" ]] && cp -a "${PTERO_DIR}/public/favicons" "${BACKUP_DIR}/favicons"
green "Backup saved safely."

# ------------------------------------------------------------------------------
# 2. REMOVE SLOW OVERLAPPING ASSETS & INSTALL FAVICONS + LIGHTWEIGHT CSS
# ------------------------------------------------------------------------------
mkdir -p "$BRAND_ASSET_DIR"
rm -f \
  "${BRAND_ASSET_DIR}/sparrowx-theme.css" \
  "${BRAND_ASSET_DIR}/sparrowx-brand.js" \
  "${BRAND_ASSET_DIR}/ptero-sparrowx-bridge.js" \
  "${BRAND_ASSET_DIR}/watermark.png"
green "Removed heavy overlapping CSS/JS layers (sparrowx-theme.css, sparrowx-brand.js, ptero-sparrowx-bridge.js)."

LOGO_MAIN="${REPO_DIR}/public/logos/sparrowx-main.png"
if [[ -f "$LOGO_MAIN" ]]; then
  cp -f "$LOGO_MAIN" "${BRAND_ASSET_DIR}/logo.png"
  if [[ -d "${PTERO_DIR}/public/favicons" ]]; then
    cp -f "$LOGO_MAIN" "${PTERO_DIR}/public/favicons/favicon-32x32.png"
    cp -f "$LOGO_MAIN" "${PTERO_DIR}/public/favicons/favicon-16x16.png"
    cp -f "$LOGO_MAIN" "${PTERO_DIR}/public/favicons/apple-touch-icon.png"
  fi
  green "Synced SparrowX logo & favicons."
fi

if [[ -f "${PTERO_DIR}/.env" ]]; then
  if grep -q '^APP_NAME=' "${PTERO_DIR}/.env"; then
    sed -i "s|^APP_NAME=.*|APP_NAME=\"${BRAND_NAME}\"|" "${PTERO_DIR}/.env"
  else
    printf '\nAPP_NAME="%s"\n' "$BRAND_NAME" >> "${PTERO_DIR}/.env"
  fi
  green "Verified APP_NAME=\"${BRAND_NAME}\" in ${PTERO_DIR}/.env"
fi

if [[ ! -f "$THEME_CSS_SRC" ]]; then
  err "Missing ${THEME_CSS_SRC} — run git pull in ${REPO_DIR} first."
  exit 1
fi
cp -f "$THEME_CSS_SRC" "${BRAND_ASSET_DIR}/ptero-midnight-theme.css"
green "Installed lightweight Midnight Black palette (${BRAND_ASSET_DIR}/ptero-midnight-theme.css)."

# ------------------------------------------------------------------------------
# 3. IDEMPOTENTLY INJECT SINGLE PURE-CSS LINK (ZERO JS)
# ------------------------------------------------------------------------------
inject_midnight_palette() {
  local target_file="$1"
  [[ -f "$target_file" ]] || return 0
  strip_all_sparrowx_layers "$target_file"

  python3 - "$target_file" "$THEME_VERSION" <<'PY'
import sys
path, ver = sys.argv[1], sys.argv[2]
txt = open(path, "r", encoding="utf-8").read()

snippet = (
    "<!-- SPARROWX-STELLAR-MIDNIGHT:START -->\n"
    f'    <link rel="stylesheet" href="/sparrowx/ptero-midnight-theme.css?v={ver}" />\n'
    "<!-- SPARROWX-STELLAR-MIDNIGHT:END -->\n"
)

if "</head>" in txt:
    txt = txt.replace("</head>", snippet + "</head>", 1)
else:
    txt = txt + "\n" + snippet

open(path, "w", encoding="utf-8").write(txt)
PY
  green "Linked lightweight Midnight Black CSS in ${target_file}"
}

inject_midnight_palette "${PTERO_DIR}/resources/views/templates/wrapper.blade.php"
# auth/core.blade.php extends wrapper.blade.php (no </head> of its own) — only strip any legacy snippet
strip_all_sparrowx_layers "${PTERO_DIR}/resources/views/templates/auth/core.blade.php"

# ------------------------------------------------------------------------------
# 4. CLEAR & RE-WARM CACHES + HEALTH CHECK
# ------------------------------------------------------------------------------
clear_ptero_caches

info "Verifying Pterodactyl Panel HTTP response..."
HTTP_CODE="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 8 https://game.panel.sparrowx.net/auth/login || true)"
if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "302" ]]; then
  green "Pterodactyl Panel health check PASSED (HTTP ${HTTP_CODE})!"
  echo ""
  echo "  Theme Mode : Native Stellar UI + Pure-CSS Midnight Black Palette (Zero JS)"
  echo "  CSS File   : /sparrowx/ptero-midnight-theme.css"
  echo "  Tip        : For 100% native Stellar colors, also set Stellar Admin dark bg to #05060A and card bg to #0C0F18."
  echo "  Remove CSS : sudo bash ${REPO_DIR}/deploy/ptero-brand-sparrowx.sh --remove"
  echo "  Rollback   : sudo bash ${REPO_DIR}/deploy/ptero-brand-sparrowx.sh --rollback"
else
  warn "Health check returned HTTP ${HTTP_CODE:-ERR} (check manually; --remove or --rollback available)."
fi
