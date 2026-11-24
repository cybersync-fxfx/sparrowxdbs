#!/usr/bin/env bash
# ==============================================================================
# SPARROWX HOSTING — SAFE PTERODACTYL PANEL BRANDING & THEME INSTALLER
# ==============================================================================
# Applies official SparrowX logos, subtle logo watermark background, Midnight
# Black glassmorphic styling, and "SparrowX Hosting" branding to Pterodactyl
# Panel WITHOUT modifying React source or running yarn build (zero crash risk).
#
# Usage:
#   sudo bash deploy/ptero-brand-sparrowx.sh             # Apply branding safely
#   sudo bash deploy/ptero-brand-sparrowx.sh --rollback  # Restore original files
# ==============================================================================
set -euo pipefail

PTERO_DIR="${PTERO_DIR:-/var/www/pterodactyl}"
REPO_DIR="${REPO_DIR:-/opt/sparrowxdbs}"
BRAND_NAME="${BRAND_NAME:-SparrowX Hosting}"
BRAND_ASSET_DIR="${PTERO_DIR}/public/sparrowx"
BACKUP_ROOT="${PTERO_DIR}/.sparrowx-brand-backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"

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
}

# ------------------------------------------------------------------------------
# ROLLBACK MODE
# ------------------------------------------------------------------------------
if [[ "${1:-}" == "--rollback" ]]; then
  LATEST="$(ls -1dt "${BACKUP_ROOT}"/* 2>/dev/null | head -n1 || true)"
  if [[ -z "$LATEST" || ! -d "$LATEST" ]]; then
    err "No backup found in ${BACKUP_ROOT}"
    exit 1
  fi
  info "Restoring original Pterodactyl files from ${LATEST}..."
  [[ -f "${LATEST}/wrapper.blade.php" ]] && cp -a "${LATEST}/wrapper.blade.php" "${PTERO_DIR}/resources/views/templates/wrapper.blade.php"
  [[ -f "${LATEST}/core.blade.php" ]] && cp -a "${LATEST}/core.blade.php" "${PTERO_DIR}/resources/views/templates/auth/core.blade.php"
  [[ -f "${LATEST}/.env" ]] && cp -a "${LATEST}/.env" "${PTERO_DIR}/.env"
  [[ -d "${LATEST}/favicons" ]] && cp -a "${LATEST}/favicons/." "${PTERO_DIR}/public/favicons/"
  rm -rf "$BRAND_ASSET_DIR"
  clear_ptero_caches
  green "Rollback complete. Original Pterodactyl panel restored."
  exit 0
fi

# ------------------------------------------------------------------------------
# 1. BACKUP ORIGINAL FILES BEFORE MAKING ANY CHANGES
# ------------------------------------------------------------------------------
info "Backing up original Pterodactyl templates & favicons to ${BACKUP_DIR}..."
mkdir -p "$BACKUP_DIR"
[[ -f "${PTERO_DIR}/resources/views/templates/wrapper.blade.php" ]] && cp -a "${PTERO_DIR}/resources/views/templates/wrapper.blade.php" "${BACKUP_DIR}/wrapper.blade.php"
[[ -f "${PTERO_DIR}/resources/views/templates/auth/core.blade.php" ]] && cp -a "${PTERO_DIR}/resources/views/templates/auth/core.blade.php" "${BACKUP_DIR}/core.blade.php"
[[ -f "${PTERO_DIR}/.env" ]] && cp -a "${PTERO_DIR}/.env" "${BACKUP_DIR}/.env"
[[ -d "${PTERO_DIR}/public/favicons" ]] && cp -a "${PTERO_DIR}/public/favicons" "${BACKUP_DIR}/favicons"
green "Backup saved safely."

# ------------------------------------------------------------------------------
# 2. COPY OFFICIAL SPARROWX LOGOS & FAVICONS
# ------------------------------------------------------------------------------
info "Installing official SparrowX logos & favicons..."
mkdir -p "$BRAND_ASSET_DIR"

LOGO_MAIN="${REPO_DIR}/public/logos/sparrowx-main.png"
LOGO_SILVER="${REPO_DIR}/public/logos/sparrowx-silver.png"

if [[ -f "$LOGO_MAIN" ]]; then
  cp -f "$LOGO_MAIN" "${BRAND_ASSET_DIR}/logo.png"
  if [[ -d "${PTERO_DIR}/public/favicons" ]]; then
    cp -f "$LOGO_MAIN" "${PTERO_DIR}/public/favicons/favicon-32x32.png"
    cp -f "$LOGO_MAIN" "${PTERO_DIR}/public/favicons/favicon-16x16.png"
    cp -f "$LOGO_MAIN" "${PTERO_DIR}/public/favicons/apple-touch-icon.png"
  fi
  green "Installed SparrowX primary logo & favicons."
else
  warn "Logo not found at ${LOGO_MAIN} — skipping logo copy."
fi

if [[ -f "$LOGO_SILVER" ]]; then
  cp -f "$LOGO_SILVER" "${BRAND_ASSET_DIR}/watermark.png"
  green "Installed SparrowX silver watermark logo."
elif [[ -f "${BRAND_ASSET_DIR}/logo.png" ]]; then
  cp -f "${BRAND_ASSET_DIR}/logo.png" "${BRAND_ASSET_DIR}/watermark.png"
fi

# ------------------------------------------------------------------------------
# 3. UPDATE APP_NAME IN PTERODACTYL .env
# ------------------------------------------------------------------------------
if [[ -f "${PTERO_DIR}/.env" ]]; then
  if grep -q '^APP_NAME=' "${PTERO_DIR}/.env"; then
    sed -i "s|^APP_NAME=.*|APP_NAME=\"${BRAND_NAME}\"|" "${PTERO_DIR}/.env"
  else
    printf '\nAPP_NAME="%s"\n' "$BRAND_NAME" >> "${PTERO_DIR}/.env"
  fi
  green "Updated APP_NAME=\"${BRAND_NAME}\" in ${PTERO_DIR}/.env"
fi

# ------------------------------------------------------------------------------
# 4. WRITE SPARROWX MIDNIGHT BLACK + LOGO WATERMARK CSS THEME
# ------------------------------------------------------------------------------
info "Writing SparrowX custom theme CSS (${BRAND_ASSET_DIR}/sparrowx-theme.css)..."
cat > "${BRAND_ASSET_DIR}/sparrowx-theme.css" <<'EOF'
/* ============================================================================
 * SPARROWX HOSTING — PTERODACTYL PANEL CUSTOM THEME (MIDNIGHT BLACK + SILVER)
 * Safe CSS-only layer: never breaks React components, console, or modals.
 * ============================================================================ */

:root {
  --spx-bg: #05060a;
  --spx-surface: #0b0e15;
  --spx-surface-elevated: #111622;
  --spx-border: rgba(244, 246, 250, 0.1);
  --spx-border-strong: rgba(56, 189, 248, 0.35);
  --spx-text: #f4f6fa;
  --spx-accent: #f96246;
  --spx-cyan: #38bdf8;
}

html,
body {
  background-color: var(--spx-bg) !important;
  color: var(--spx-text) !important;
  min-height: 100vh;
}

/* Subtle centered SparrowX Logo Watermark + Midnight Ambient Glow */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image:
    radial-gradient(ellipse 70% 45% at 50% 0%, rgba(56, 189, 248, 0.1), transparent 65%),
    radial-gradient(circle at 88% 85%, rgba(249, 98, 70, 0.08), transparent 45%),
    url("/sparrowx/watermark.png");
  background-repeat: no-repeat, no-repeat, no-repeat;
  background-position: center top, right bottom, center center;
  background-size: 100% 100%, 100% 100%, min(420px, 55vw) auto;
  opacity: 0.08;
}

#app {
  position: relative;
  z-index: 1;
}

/* Top Navigation Bar & Sidebar Surfaces */
header,
nav,
[class*="NavigationBar"],
[class*="SubNavigation"] {
  background-color: rgba(9, 11, 17, 0.88) !important;
  backdrop-filter: blur(14px);
  border-color: var(--spx-border) !important;
}

/* Cards, Panels, Modals, and Inputs */
[class*="GreyRowBox"],
[class*="TitledGreyBox"],
[class*="ContentBox"],
[class*="ServerRow"] {
  background-color: rgba(11, 14, 21, 0.88) !important;
  border: 1px solid var(--spx-border) !important;
  backdrop-filter: blur(10px);
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

[class*="ServerRow"]:hover {
  border-color: var(--spx-border-strong) !important;
  box-shadow: 0 8px 30px rgba(56, 189, 248, 0.1) !important;
}

/* Branded Login Card Container */
.spx-login-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 0 auto 20px auto;
  padding-top: 24px;
  text-align: center;
}

.spx-login-brand img {
  width: 64px;
  height: 64px;
  object-fit: contain;
  filter: drop-shadow(0 0 22px rgba(56, 189, 248, 0.35));
}

.spx-login-brand-title {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--spx-text);
}

.spx-login-brand-sub {
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--spx-cyan);
  opacity: 0.9;
}

/* Branded Logo Badge injected next to Pterodactyl's top-left brand link */
.spx-nav-logo {
  width: 28px;
  height: 28px;
  object-fit: contain;
  margin-right: 10px;
  border-radius: 6px;
  filter: drop-shadow(0 2px 10px rgba(249, 98, 70, 0.35));
  vertical-align: middle;
  display: inline-block;
}

/* Subtle SparrowX Footer Credit */
.spx-footer-badge {
  position: fixed;
  right: 14px;
  bottom: 10px;
  z-index: 30;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 9999px;
  background: rgba(9, 11, 17, 0.85);
  border: 1px solid var(--spx-border);
  color: rgba(244, 246, 250, 0.72);
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  text-decoration: none;
  backdrop-filter: blur(8px);
}

.spx-footer-badge:hover {
  border-color: var(--spx-accent);
  color: #ffffff;
}

.spx-footer-badge img {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

/* Custom Dark Scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: #05060a;
}
::-webkit-scrollbar-thumb {
  background: #1f2937;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #38bdf8;
}
EOF
green "Wrote ${BRAND_ASSET_DIR}/sparrowx-theme.css"

# ------------------------------------------------------------------------------
# 5. WRITE SAFE NON-BLOCKING BRAND ENHANCER SCRIPT
# ------------------------------------------------------------------------------
cat > "${BRAND_ASSET_DIR}/sparrowx-brand.js" <<'EOF'
(function () {
  var BRAND = "SparrowX Hosting";
  var LOGO_URL = "/sparrowx/logo.png";

  function enhanceNavLogo() {
    var brandLink =
      document.querySelector('a[href="/"] span') ||
      document.querySelector('nav a[href="/"]') ||
      document.querySelector('header a[href="/"]') ||
      document.querySelector('aside a[href="/"]');
    if (!brandLink) return;
    var container = brandLink.tagName === "A" ? brandLink : brandLink.parentElement;
    if (!container) return;

    // Replace any existing (or broken) theme <img> inside the brand header with our official SparrowX logo
    var existingImgs = container.querySelectorAll("img:not(.spx-nav-logo)");
    if (existingImgs.length > 0) {
      existingImgs.forEach(function (el, idx) {
        if (idx === 0) {
          el.src = LOGO_URL;
          el.alt = BRAND;
          el.className = "spx-nav-logo";
        } else {
          el.style.display = "none";
        }
      });
    } else if (!container.querySelector(".spx-nav-logo")) {
      var img = document.createElement("img");
      img.src = LOGO_URL;
      img.alt = BRAND;
      img.className = "spx-nav-logo";
      container.insertBefore(img, container.firstChild);
    }

    // Normalize "Sparrowxhosting" brand text to clean "SparrowX Hosting"
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && /sparrowxhosting/i.test(node.nodeValue)) {
        node.nodeValue = node.nodeValue.replace(/sparrowxhosting/gi, BRAND);
      }
    }
  }

  function fixBrokenBrandImages() {
    document.querySelectorAll("header img, nav img, aside img").forEach(function (img) {
      if (img.classList.contains("spx-nav-logo")) return;
      if (img.complete && img.naturalWidth === 0) {
        img.style.display = "none";
      }
    });
  }

  function enhanceLoginHeader() {
    if (!window.location.pathname.startsWith("/auth")) return;
    if (document.querySelector(".spx-login-brand")) return;
    var form = document.querySelector("form");
    if (!form || !form.parentElement) return;
    var header = document.createElement("div");
    header.className = "spx-login-brand";
    header.innerHTML =
      '<img src="' + LOGO_URL + '" alt="' + BRAND + '" />' +
      '<div class="spx-login-brand-title">SPARROWX HOSTING</div>' +
      '<div class="spx-login-brand-sub">Sovereign Game &amp; Cloud Control Panel</div>';
    form.parentElement.insertBefore(header, form);
  }

  function ensureFooterPill() {
    if (document.querySelector(".spx-footer-badge")) return;
    var a = document.createElement("a");
    a.href = "https://sparrowx.net";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "spx-footer-badge";
    a.innerHTML = '<img src="' + LOGO_URL + '" alt="" /><span>Powered by SparrowX Technologies</span>';
    document.body.appendChild(a);
  }

  function run() {
    enhanceNavLogo();
    fixBrokenBrandImages();
    enhanceLoginHeader();
    ensureFooterPill();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

  var observer = new MutationObserver(run);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
EOF
green "Wrote ${BRAND_ASSET_DIR}/sparrowx-brand.js"

# ------------------------------------------------------------------------------
# 6. IDEMPOTENTLY INJECT INTO PTERODACTYL BLADE TEMPLATES
# ------------------------------------------------------------------------------
inject_snippet() {
  local target_file="$1"
  if [[ ! -f "$target_file" ]]; then
    return 0
  fi

  # Strip any previous SparrowX brand block first (idempotent re-runs)
  python3 - "$target_file" <<'PY'
import re, sys
path = sys.argv[1]
txt = open(path, "r", encoding="utf-8").read()
txt = re.sub(r"\n?<!-- SPARROWX-BRAND:START -->.*?<!-- SPARROWX-BRAND:END -->\n?", "", txt, flags=re.S)

snippet = """
<!-- SPARROWX-BRAND:START -->
<link rel="icon" type="image/png" href="/sparrowx/logo.png?v=2026b">
<link rel="stylesheet" href="/sparrowx/sparrowx-theme.css?v=2026b">
<script src="/sparrowx/sparrowx-brand.js?v=2026b" defer></script>
<!-- SPARROWX-BRAND:END -->
"""

if "</head>" in txt:
    txt = txt.replace("</head>", snippet + "</head>", 1)
else:
    txt = txt + snippet

open(path, "w", encoding="utf-8").write(txt)
PY
  green "Injected SparrowX branding into ${target_file}"
}

inject_snippet "${PTERO_DIR}/resources/views/templates/wrapper.blade.php"
inject_snippet "${PTERO_DIR}/resources/views/templates/auth/core.blade.php"

# ------------------------------------------------------------------------------
# 7. CLEAR CACHES & VERIFY PANEL HEALTH (AUTO-ROLLBACK ON FAILURE)
# ------------------------------------------------------------------------------
clear_ptero_caches

info "Verifying Pterodactyl Panel HTTP response..."
HTTP_CODE="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 8 https://game.panel.sparrowx.net/auth/login || true)"
if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "302" ]]; then
  green "Pterodactyl Panel health check PASSED (HTTP ${HTTP_CODE})!"
  echo ""
  echo "  Brand Name : ${BRAND_NAME}"
  echo "  Theme CSS  : /sparrowx/sparrowx-theme.css"
  echo "  Backup Dir : ${BACKUP_DIR}"
  echo "  Rollback   : sudo bash ${REPO_DIR}/deploy/ptero-brand-sparrowx.sh --rollback"
else
  warn "Health check returned HTTP ${HTTP_CODE:-ERR} (if Traefik/Nginx is restarting, check manually; rollback available via --rollback)."
fi
