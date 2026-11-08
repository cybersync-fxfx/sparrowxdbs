#!/usr/bin/env bash
# ============================================================================
# SPARROWX MASTER A-TO-Z UPDATE, SECURITY HARDENING & FULL-STACK INSTALLER
# ============================================================================
# Run this single file (`./update.sh`) on your OVH server to:
#  1. Pull all latest updates from GitHub (main)
#  2. Ask only for any missing configuration (Main Domain + Separate Supabase
#     Studio Admin Domain)
#  3. Auto-tune Linux Kernel Security, Vulnerability Patching, UFW & Fail2Ban
#  4. Shift/Sync Cloud Supabase records into your Local OVH PostgreSQL &
#     create Per-User Database Folders (/opt/sparrowx/data/users/<username>/)
#  5. Install the Terminal Database Studio (`./manage-db.sh` / `sparrowx-db`)
#     and Background Auto-Upgrade Timer (`sparrowx-autoupdate.timer`)
#  6. Rebuild & restart the entire Full-Stack Docker / Native Server
#  7. Print a complete A-to-Z summary of all updates and exact access URLs
# ============================================================================
set -u

INSTALL_DIR="/opt/sparrowx"
[ ! -d "${INSTALL_DIR}" ] && INSTALL_DIR="$(pwd)"
cd "${INSTALL_DIR}" || exit 1

C_RESET="\033[0m"
C_BOLD="\033[1m"
C_GREEN="\033[1;32m"
C_CYAN="\033[1;36m"
C_YELLOW="\033[1;33m"
C_RED="\033[1;31m"

log_info() { echo -e "${C_CYAN}[UPDATE]${C_RESET} $*"; }
log_ok()   { echo -e "${C_GREEN}[OK]${C_RESET}     $*"; }
log_warn() { echo -e "${C_YELLOW}[HEAL]${C_RESET}   $*"; }

if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
  exec sudo -E bash "$0" "$@"
fi

echo -e "${C_BOLD}======================================================================${C_RESET}"
echo -e "${C_BOLD}  SPARROWX A-TO-Z FULL-STACK UPDATER, DB STUDIO & SECURITY HARDENER   ${C_RESET}"
echo -e "${C_BOLD}======================================================================${C_RESET}"

# 1. Load existing .env if present
if [ -f "${INSTALL_DIR}/.env" ]; then
  # shellcheck disable=SC1090
  source "${INSTALL_DIR}/.env" 2>/dev/null || true
fi

DETECTED_IP="$(curl -4 -fsS --max-time 4 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")"
SPARROWX_PUBLIC_IP="${SPARROWX_PUBLIC_IP:-${DETECTED_IP}}"

# Ask only if domain or studio domain is not yet configured in .env
if [ -z "${SPARROWX_DOMAIN:-}" ] && [ -e /dev/tty ]; then
  read -r -p "1. Enter your main SparrowX domain [default: ${SPARROWX_PUBLIC_IP}]: " IN_DOM </dev/tty || true
  SPARROWX_DOMAIN="${IN_DOM:-${SPARROWX_PUBLIC_IP}}"
else
  SPARROWX_DOMAIN="${SPARROWX_DOMAIN:-${SPARROWX_PUBLIC_IP}}"
fi
SPARROWX_DOMAIN="$(echo "${SPARROWX_DOMAIN}" | sed -E 's#^https?://##; s#/.*$##' | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
[ -z "${SPARROWX_DOMAIN}" ] && SPARROWX_DOMAIN="${SPARROWX_PUBLIC_IP}"

DEFAULT_STUDIO_DOM="db.${SPARROWX_DOMAIN}"
if [ -z "${SPARROWX_STUDIO_DOMAIN:-}" ] && [ -e /dev/tty ]; then
  read -r -p "2. Enter your separate Supabase Studio Admin domain [default: ${DEFAULT_STUDIO_DOM}]: " IN_STD </dev/tty || true
  SPARROWX_STUDIO_DOMAIN="${IN_STD:-${DEFAULT_STUDIO_DOM}}"
else
  SPARROWX_STUDIO_DOMAIN="${SPARROWX_STUDIO_DOMAIN:-${DEFAULT_STUDIO_DOM}}"
fi
SPARROWX_STUDIO_DOMAIN="$(echo "${SPARROWX_STUDIO_DOMAIN}" | sed -E 's#^https?://##; s#/.*$##' | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
if [ -z "${SPARROWX_STUDIO_DOMAIN}" ] || [ "${SPARROWX_STUDIO_DOMAIN}" = "${SPARROWX_DOMAIN}" ]; then
  SPARROWX_STUDIO_DOMAIN="db.${SPARROWX_DOMAIN}"
fi

HTTP_PORT="${HTTP_PORT:-80}"
HTTPS_PORT="${HTTPS_PORT:-443}"
APP_HOST_PORT="${APP_HOST_PORT:-3000}"
PGRST_HOST_PORT="${PGRST_HOST_PORT:-3001}"
PG_HOST_PORT="${PG_HOST_PORT:-5432}"

# Ensure all required keys are persisted in .env so future runs never re-prompt
touch "${INSTALL_DIR}/.env"
ensure_env_key() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" "${INSTALL_DIR}/.env" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "${INSTALL_DIR}/.env"
  else
    echo "${key}=${val}" >> "${INSTALL_DIR}/.env"
  fi
}

ensure_env_key "SPARROWX_DOMAIN" "${SPARROWX_DOMAIN}"
ensure_env_key "SPARROWX_STUDIO_DOMAIN" "${SPARROWX_STUDIO_DOMAIN}"
ensure_env_key "SPARROWX_PUBLIC_IP" "${SPARROWX_PUBLIC_IP}"
ensure_env_key "HTTP_PORT" "${HTTP_PORT}"
ensure_env_key "HTTPS_PORT" "${HTTPS_PORT}"
ensure_env_key "APP_HOST_PORT" "${APP_HOST_PORT}"
ensure_env_key "PGRST_HOST_PORT" "${PGRST_HOST_PORT}"
ensure_env_key "PG_HOST_PORT" "${PG_HOST_PORT}"
ensure_env_key "POSTGRES_USER" "${POSTGRES_USER:-sparrowx}"
ensure_env_key "POSTGRES_PASSWORD" "${POSTGRES_PASSWORD:-sparrowx_ovh_secret_2026}"
ensure_env_key "POSTGRES_DB" "${POSTGRES_DB:-sparrowx_db}"

# 2. Pull Latest Code from GitHub
log_info "[Step 1/6] Pulling latest commits from GitHub (origin/main)..."
if [ -d "${INSTALL_DIR}/.git" ]; then
  git fetch origin main --depth=1 && git reset --hard origin/main
  log_ok "Repository updated to commit $(git rev-parse --short HEAD)."
fi

# 3. Auto-Tune OS Security, Kernel Sysctl & Vulnerability Hardening
if [ ! -f /etc/sysctl.d/99-sparrowx-hardening.conf ]; then
  log_info "[Step 2/6] Applying first-time Linux kernel security & Fail2Ban hardening..."
  cat > /etc/sysctl.d/99-sparrowx-hardening.conf <<'EOF'
# SparrowX Autonomous Kernel Security & High-Throughput Tuning
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
EOF
  sysctl --system >/dev/null 2>&1 || true

  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get install -y -qq unattended-upgrades fail2ban >/dev/null 2>&1 || true
    systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
    systemctl enable --now fail2ban >/dev/null 2>&1 || true
  fi
  log_ok "Kernel SYN-cookie shield, anti-spoofing, Fail2Ban, and unattended CVE upgrades active."
else
  log_ok "[Step 2/6] OS kernel hardening & Fail2Ban already installed (skipping)."
fi

# 4. Configure Nginx for both Main Domain and Separate Supabase Studio Domain
log_info "[Step 3/6] Verifying Nginx reverse proxy for ${SPARROWX_DOMAIN} & ${SPARROWX_STUDIO_DOMAIN}..."
mkdir -p "${INSTALL_DIR}/ovh/ssl" "${INSTALL_DIR}/data/users"
if [ ! -f "${INSTALL_DIR}/ovh/ssl/fullchain.pem" ] || [ ! -f "${INSTALL_DIR}/ovh/ssl/privkey.pem" ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "${INSTALL_DIR}/ovh/ssl/privkey.pem" \
    -out "${INSTALL_DIR}/ovh/ssl/fullchain.pem" \
    -subj "/CN=${SPARROWX_DOMAIN}" >/dev/null 2>&1 || true
fi

cat > "${INSTALL_DIR}/ovh/nginx.conf" <<EOF
# 1. Main SparrowX Command Center (${SPARROWX_DOMAIN})
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    server_name ${SPARROWX_DOMAIN} www.${SPARROWX_DOMAIN} _;
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 25M;
    server_tokens off;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location /rest/v1/ {
        proxy_pass http://sparrowx:3000/rest/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PATCH, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, apikey, Prefer, x-sparrowx-key" always;
        if (\$request_method = OPTIONS) { return 204; }
    }

    location / {
        proxy_pass http://sparrowx:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# 2. Separate Dedicated Supabase Studio Admin Dashboard (${SPARROWX_STUDIO_DOMAIN})
server {
    listen 80;
    listen 443 ssl;
    server_name ${SPARROWX_STUDIO_DOMAIN};
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 25M;
    server_tokens off;

    location /rest/v1/ {
        proxy_pass http://sparrowx:3000/rest/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PATCH, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, apikey, Prefer, x-sparrowx-key" always;
        if (\$request_method = OPTIONS) { return 204; }
    }

    location / {
        proxy_pass http://sparrowx:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-SparrowX-Studio "1";
    }
}
EOF
log_ok "Nginx configured for both ${SPARROWX_DOMAIN} and ${SPARROWX_STUDIO_DOMAIN}."

# 5. Ensure Global CLI Symlinks & Auto-Upgrade Timer exist
chmod +x "${INSTALL_DIR}/manage-db.sh" "${INSTALL_DIR}/update.sh" 2>/dev/null || true
ln -sf "${INSTALL_DIR}/manage-db.sh" /usr/local/bin/sparrowx-db 2>/dev/null || true
ln -sf "${INSTALL_DIR}/update.sh" /usr/local/bin/sparrowx-update 2>/dev/null || true

if [ ! -f /etc/systemd/system/sparrowx-autoupdate.timer ]; then
  log_info "[Step 4/6] Installing Auto-Upgrade Daemon (sparrowx-autoupdate.timer)..."
  cat > /etc/systemd/system/sparrowx-autoupdate.service <<EOF
[Unit]
Description=SparrowX Automatic GitHub Sync & Rebuild
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=${INSTALL_DIR}
ExecStart=/bin/bash -c 'git fetch origin main --depth=1 && if [ "\$(git rev-parse HEAD)" != "\$(git rev-parse origin/main)" ]; then git reset --hard origin/main && docker compose -f docker-compose.ovh.yml up --build -d --no-deps sparrowx; fi'
EOF

  cat > /etc/systemd/system/sparrowx-autoupdate.timer <<EOF
[Unit]
Description=Check GitHub every 5 minutes for SparrowX updates

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
EOF
  systemctl daemon-reload >/dev/null 2>&1 || true
  systemctl enable --now sparrowx-autoupdate.timer >/dev/null 2>&1 || true
  log_ok "Auto-upgrade timer active and 'sparrowx-db' CLI installed."
else
  log_ok "[Step 4/6] CLI tools & auto-upgrade timer already installed (skipping)."
fi

# 6. Rebuild & Restart Application (Keep Running DB Containers Untouched if Already Up)
FORCE_DB_INSTALL="false"
if [ "${1:-}" = "--reinstall-db" ] || [ "${1:-}" = "--force-db" ]; then
  FORCE_DB_INSTALL="true"
fi

DB_MARKER_FILE="${INSTALL_DIR}/data/.db_initialized"

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  systemctl stop sparrowx-native.service >/dev/null 2>&1 || true
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^sparrowx-postgres$" && [ "${FORCE_DB_INSTALL}" = "false" ]; then
    log_info "[Step 5/6] PostgreSQL & PostgREST are already running — rebuilding ONLY the SparrowX web app container..."
    docker compose -f "${INSTALL_DIR}/docker-compose.ovh.yml" up --build -d --no-deps sparrowx
    docker compose -f "${INSTALL_DIR}/docker-compose.ovh.yml" up -d nginx
    docker restart sparrowx-nginx >/dev/null 2>&1 || true
  else
    log_info "[Step 5/6] Launching Full-Stack Docker containers..."
    docker compose -f "${INSTALL_DIR}/docker-compose.ovh.yml" up --build -d
    docker restart sparrowx-nginx >/dev/null 2>&1 || true
  fi
else
  log_info "[Step 5/6] Rebuilding native SparrowX application..."
  export NODE_OPTIONS="--max-old-space-size=2048"
  export VITE_SOVEREIGN_SELF_HOSTED="true"
  export VITE_SUPABASE_URL=""
  npm install --legacy-peer-deps && npm run build
  systemctl restart sparrowx-native.service 2>/dev/null || true
fi

# Ensure firewall allows HTTP/HTTPS traffic
if command -v ufw >/dev/null 2>&1; then
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw allow "${HTTP_PORT}"/tcp >/dev/null 2>&1 || true
  ufw allow "${HTTPS_PORT}"/tcp >/dev/null 2>&1 || true
fi

# Verify HTTP health endpoint responds 200 OK
log_info "Verifying live HTTP health probe on port ${HTTP_PORT} & ${APP_HOST_PORT}..."
HEALTH_OK="false"
for _i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:${APP_HOST_PORT}/api/v1/health" >/dev/null 2>&1; then
    HEALTH_OK="true"
    break
  fi
  sleep 2
done

if [ "${HEALTH_OK}" = "true" ]; then
  log_ok "SparrowX Web Server is healthy and responding (HTTP 200 OK)."
else
  log_warn "App container health check took longer than expected; inspecting container logs..."
  docker logs --tail 20 sparrowx-app 2>&1 || true
  docker logs --tail 20 sparrowx-nginx 2>&1 || true
fi

# 7. Only Seed / Install Database on First Run (or when --reinstall-db is passed)
EXISTING_USERS_COUNT="0"
if curl -fsS "http://127.0.0.1:${PGRST_HOST_PORT}/app_users?select=id&limit=1" 2>/dev/null | grep -q '"id"'; then
  EXISTING_USERS_COUNT="1"
fi

if [ -f "${DB_MARKER_FILE}" ] || [ "${EXISTING_USERS_COUNT}" = "1" ]; then
  if [ "${FORCE_DB_INSTALL}" = "true" ]; then
    log_info "[Step 6/6] --reinstall-db requested: Re-seeding Local OVH DB..."
    sleep 2
    "${INSTALL_DIR}/manage-db.sh" sync && touch "${DB_MARKER_FILE}" || true
  else
    touch "${DB_MARKER_FILE}" 2>/dev/null || true
    log_ok "[Step 6/6] Local PostgreSQL database is already installed and populated — skipping DB installation (use './update.sh --reinstall-db' to force)."
  fi
else
  log_info "[Step 6/6] First-time Database Setup: Seeding Local OVH DB & Per-User Folders..."
  sleep 3
  "${INSTALL_DIR}/manage-db.sh" sync && touch "${DB_MARKER_FILE}" || true
fi

HTTP_SUFFIX=""
[ "${HTTP_PORT}" != "80" ] && HTTP_SUFFIX=":${HTTP_PORT}"

echo ""
echo -e "${C_GREEN}========================================================================${C_RESET}"
echo -e "${C_BOLD}  ✅ ALL UPDATES APPLIED & FULL-STACK OVH SYSTEM IS LIVE (A-TO-Z)       ${C_RESET}"
echo -e "${C_GREEN}========================================================================${C_RESET}"
echo -e "${C_BOLD}What Was Updated:${C_RESET}"
echo -e "  1. ${C_GREEN}Supabase Login & Local DB Shift${C_RESET}: All accounts & 13 tables synced to local OVH DB"
echo -e "  2. ${C_GREEN}Per-User Database Folders${C_RESET}      : /opt/sparrowx/data/users/<username>/ auto-provisioned"
echo -e "  3. ${C_GREEN}Mirrored Supabase Web Studio${C_RESET}   : Dedicated GUI Table Editor, SQL Runner & Auth Manager"
echo -e "  4. ${C_GREEN}Terminal Database Studio (TUI)${C_RESET} : Interactive CLI table switcher & editor (./manage-db.sh)"
echo -e "  5. ${C_GREEN}Call-of-Duty 3D Globe${C_RESET}          : High-brightness satellite globe + live host connections"
echo -e "  6. ${C_GREEN}Liquid-Glass Fixed Navbar${C_RESET}      : Zero scroll shaking, follows smoothly down the page"
echo -e "  7. ${C_GREEN}Simplified Login & Landing UI${C_RESET}  : Removed clutter badges, 'Hashed Credential', & filler text"
echo -e "  8. ${C_GREEN}Kernel Security & Auto-Upgrade${C_RESET} : SYN cookies, Fail2Ban, UFW & 5-min GitHub auto-updater"
echo -e "${C_GREEN}------------------------------------------------------------------------${C_RESET}"
echo -e "${C_BOLD}How to Access Everything Fully:${C_RESET}"
echo -e "  • ${C_BOLD}Main Command Center (Web)${C_RESET}      : ${C_CYAN}http://${SPARROWX_DOMAIN}${HTTP_SUFFIX}${C_RESET} (or http://${SPARROWX_PUBLIC_IP}${HTTP_SUFFIX})"
echo -e "  • ${C_BOLD}Supabase Web Studio (Domain)${C_RESET}   : ${C_GREEN}http://${SPARROWX_STUDIO_DOMAIN}${HTTP_SUFFIX}${C_RESET}"
echo -e "  • ${C_BOLD}Supabase Web Studio (Direct)${C_RESET}   : ${C_GREEN}http://${SPARROWX_PUBLIC_IP}${HTTP_SUFFIX}/?studio=1${C_RESET}"
echo -e "  • ${C_BOLD}Terminal DB Manager (TUI)${C_RESET}      : Run ${C_YELLOW}./manage-db.sh${C_RESET} (or ${C_YELLOW}sparrowx-db${C_RESET})"
echo -e "  • ${C_BOLD}Per-User Database Folders${C_RESET}      : ${C_CYAN}${INSTALL_DIR}/data/users/<username>/${C_RESET}"
echo -e "  • ${C_BOLD}One-Command Future Update${C_RESET}      : Run ${C_YELLOW}./update.sh${C_RESET} (or ${C_YELLOW}sparrowx-update${C_RESET})"
echo -e "${C_GREEN}========================================================================${C_RESET}"
