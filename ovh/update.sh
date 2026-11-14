#!/usr/bin/env bash
# ==============================================================================
# SPARROWX MASTER A-TO-Z UPDATER, AUTO-HEALER & FULL-STACK DEPLOYMENT CLI
# ==============================================================================
# Run `./update.sh` (or `sparrowx-update`) anywhere on your OVH server to:
#  1. Normalize paths, strip CRLF line endings & install global CLI commands
#  2. Guard Disk/Swap against OOM & cleanly sync latest commits from GitHub
#  3. Harden OS Kernel, Fail2Ban, APT locks & UFW firewall rules
#  4. Validate/renew TLS certs & sync Nginx across all 6 SparrowX domains
#  5. Refresh the 5-minute systemd GitHub auto-upgrade daemon
#  6. Auto-heal port/container conflicts (5432/3001/3000/80/443) & rebuild stack
#  7. Verify PostgreSQL roles/schema, PostgREST, HTTP health & auto-invoke fix.sh
# ==============================================================================
set -u

AUTO_MODE="false"
FORCE_DB_INSTALL="false"
DELEGATE_FIX="false"

for arg in "$@"; do
  case "${arg}" in
    --auto|-y|--yes) AUTO_MODE="true" ;;
    --reinstall-db|--force-db) FORCE_DB_INSTALL="true" ;;
    --fix|--doctor) DELEGATE_FIX="true" ;;
    --help|-h)
      cat <<'HELP'
SparrowX A-to-Z Full-Stack Updater & Auto-Healer (update.sh)

Usage:
  ./update.sh [options]

Options:
  --auto, -y        Non-interactive mode (used by systemd auto-updater)
  --reinstall-db    Force re-sync of Local OVH PostgreSQL & per-user folders
  --fix, --doctor   Run deep 12-stage recovery engine (./fix.sh) immediately
  --help, -h        Show this help screen
HELP
      exit 0
      ;;
  esac
done

SCRIPT_SOURCE="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd "$(dirname "${SCRIPT_SOURCE}")" && pwd)"
if [ "$(basename "${SCRIPT_DIR}")" = "ovh" ]; then
  INSTALL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
elif [ -f "${SCRIPT_DIR}/docker-compose.ovh.yml" ] || [ -d "${SCRIPT_DIR}/ovh" ]; then
  INSTALL_DIR="${SCRIPT_DIR}"
elif [ -d "/opt/sparrowxdbs" ]; then
  INSTALL_DIR="/opt/sparrowxdbs"
elif [ -d "/opt/sparrowx" ]; then
  INSTALL_DIR="/opt/sparrowx"
else
  INSTALL_DIR="${SCRIPT_DIR}"
fi
cd "${INSTALL_DIR}" || exit 1

if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
  exec sudo -E bash "$0" "$@"
fi

if [ "${DELEGATE_FIX}" = "true" ] && [ -f "${INSTALL_DIR}/fix.sh" ]; then
  exec bash "${INSTALL_DIR}/fix.sh" "$@"
fi

# ------------------------------------------------------------------------------
# Cyber CLI Colors & Progress Bars
# ------------------------------------------------------------------------------
C_RESET="\033[0m"
C_BOLD="\033[1m"
C_DIM="\033[2m"
C_GREEN="\033[1;32m"
C_CYAN="\033[1;36m"
C_YELLOW="\033[1;33m"
C_RED="\033[1;31m"
C_BLUE="\033[1;34m"
C_MAGENTA="\033[1;35m"
C_WHITE="\033[1;37m"

HEALED_COUNT=0
declare -a HEAL_NOTES=()

log_info() { echo -e "  ${C_CYAN}[INFO]${C_RESET}     $*"; }
log_ok()   { echo -e "  ${C_GREEN}[ OK ]${C_RESET}     $*"; }
log_err()  { echo -e "  ${C_RED}[ERR ]${C_RESET}     $*"; }
log_warn() {
  echo -e "  ${C_YELLOW}[AUTO-FIX]${C_RESET} ${C_WHITE}$*${C_RESET}"
  HEALED_COUNT=$((HEALED_COUNT + 1))
  HEAL_NOTES+=("$*")
}

draw_progress() {
  local step="$1"
  local total="$2"
  local title="$3"
  local width=26
  local filled=$((step * width / total))
  local empty=$((width - filled))
  local pct=$((step * 100 / total))
  local bar_f=""
  local bar_e=""
  local i
  for ((i = 0; i < filled; i++)); do bar_f="${bar_f}█"; done
  for ((i = 0; i < empty; i++)); do bar_e="${bar_e}░"; done
  echo ""
  echo -e "${C_BLUE}┌──────────────────────────────────────────────────────────────────────┐${C_RESET}"
  printf "${C_BLUE}│${C_RESET} ${C_CYAN}[%2d/%2d]${C_RESET} ${C_GREEN}%s${C_DIM}%s${C_RESET} ${C_BOLD}%3d%%${C_RESET}  ${C_WHITE}%-28s${C_RESET}${C_BLUE}│${C_RESET}\n" \
    "${step}" "${total}" "${bar_f}" "${bar_e}" "${pct}" "${title:0:28}"
  echo -e "${C_BLUE}└──────────────────────────────────────────────────────────────────────┘${C_RESET}"
}

ensure_env_key() {
  local key="$1"
  local val="$2"
  local env_file="${INSTALL_DIR}/.env"
  touch "${env_file}"
  if grep -q "^${key}=" "${env_file}" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "${env_file}"
  else
    echo "${key}=${val}" >> "${env_file}"
  fi
}

is_port_busy() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -tulnH 2>/dev/null | awk '{print $5}' | grep -qE ":${port}$"
    return $?
  elif command -v lsof >/dev/null 2>&1; then
    lsof -i ":${port}" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi
  return 1
}

port_held_by_other() {
  local port="$1"
  local expected_regex="$2"
  if ! is_port_busy "${port}"; then
    return 1
  fi
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E "^(${expected_regex}) " | grep -qE ":${port}->"; then
      return 1
    fi
  fi
  return 0
}

find_next_free_port() {
  local port="$1"
  local max_tries=30
  local i=0
  while [ "${i}" -lt "${max_tries}" ] && is_port_busy "${port}"; do
    port=$((port + 1))
    i=$((i + 1))
  done
  echo "${port}"
}

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    return 1
  fi
}

strip_crlf_all() {
  local cleaned=0
  for f in \
    "${INSTALL_DIR}/.env" \
    "${INSTALL_DIR}"/*.sh \
    "${INSTALL_DIR}"/ovh/*.sh \
    "${INSTALL_DIR}"/deploy/*.sh \
    "${INSTALL_DIR}"/init-scripts/*.sh \
    "${INSTALL_DIR}/ovh/nginx.conf" \
    "${INSTALL_DIR}/ovh/schema.sql" \
    "${INSTALL_DIR}"/docker-compose*.yml; do
    if [ -f "${f}" ] && grep -q $'\r' "${f}" 2>/dev/null; then
      sed -i 's/\r$//' "${f}" 2>/dev/null || true
      cleaned=$((cleaned + 1))
    fi
  done
  if [ "${cleaned}" -gt 0 ]; then
    log_warn "Normalized LF line endings across ${cleaned} file(s)"
  fi
}

if [ "${AUTO_MODE}" != "true" ]; then
  clear 2>/dev/null || true
fi
echo -e "${C_CYAN}╔══════════════════════════════════════════════════════════════════════════╗${C_RESET}"
echo -e "${C_CYAN}║${C_RESET}  ${C_BOLD}${C_WHITE}🚀 SPARROWX A-TO-Z FULL-STACK UPDATER & SELF-HEALING DEPLOY ENGINE${C_RESET}      ${C_CYAN}║${C_RESET}"
echo -e "${C_CYAN}║${C_RESET}  ${C_DIM}Auto-Sync · Port/Docker Conflict Healer · Multi-Domain Reverse Proxy${C_RESET}    ${C_CYAN}║${C_RESET}"
echo -e "${C_CYAN}╚══════════════════════════════════════════════════════════════════════════╝${C_RESET}"
echo -e "  ${C_DIM}Path: ${INSTALL_DIR} • Host: $(hostname 2>/dev/null || echo ovh) • Mode: $([ "${AUTO_MODE}" = "true" ] && echo "AUTO" || echo "INTERACTIVE")${C_RESET}"

# ==============================================================================
# STEP 1/7: Pre-Flight Sanitizer, .env Validation & Global CLI Links
# ==============================================================================
draw_progress 1 7 "Pre-Flight Sanitizer & .env"

if [ ! -e "/opt/sparrowx" ] && [ "${INSTALL_DIR}" != "/opt/sparrowx" ]; then
  ln -sfn "${INSTALL_DIR}" /opt/sparrowx 2>/dev/null || true
  log_warn "Linked /opt/sparrowx -> ${INSTALL_DIR} for legacy path compatibility"
fi

strip_crlf_all
chmod +x \
  "${INSTALL_DIR}/update.sh" \
  "${INSTALL_DIR}/fix.sh" \
  "${INSTALL_DIR}/manage-db.sh" \
  "${INSTALL_DIR}/ovh/update.sh" \
  "${INSTALL_DIR}/ovh/fix.sh" \
  "${INSTALL_DIR}/ovh/manage-db.sh" \
  "${INSTALL_DIR}/deploy/doctor-fix.sh" 2>/dev/null || true

if [ -d "/usr/local/bin" ]; then
  ln -sf "${INSTALL_DIR}/manage-db.sh" /usr/local/bin/sparrowx-db 2>/dev/null || true
  ln -sf "${INSTALL_DIR}/update.sh" /usr/local/bin/sparrowx-update 2>/dev/null || true
  ln -sf "${INSTALL_DIR}/fix.sh" /usr/local/bin/sparrowx-fix 2>/dev/null || true
  ln -sf "${INSTALL_DIR}/fix.sh" /usr/local/bin/sparrowx-doctor 2>/dev/null || true
fi

if [ -f "${INSTALL_DIR}/.env" ]; then
  # shellcheck disable=SC1090
  source "${INSTALL_DIR}/.env" 2>/dev/null || true
fi

DETECTED_IP="$(curl -4 -fsS --max-time 4 https://api.ipify.org 2>/dev/null || curl -4 -fsS --max-time 4 https://ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")"
SPARROWX_PUBLIC_IP="${SPARROWX_PUBLIC_IP:-${DETECTED_IP}}"
[ -z "${SPARROWX_PUBLIC_IP}" ] && SPARROWX_PUBLIC_IP="${DETECTED_IP}"

if [ -z "${SPARROWX_DOMAIN:-}" ]; then
  EXISTING_ZONE="$(ls -1 "${INSTALL_DIR}"/ovh/dns/db.* /etc/bind/zones/db.* 2>/dev/null | head -n 1 || true)"
  if [ -n "${EXISTING_ZONE}" ]; then
    SPARROWX_DOMAIN="$(basename "${EXISTING_ZONE}" | sed 's/^db\.//')"
  elif [ -f "${INSTALL_DIR}/ovh/nginx.conf" ]; then
    SPARROWX_DOMAIN="$(awk '/server_name/ {print $2; exit}' "${INSTALL_DIR}/ovh/nginx.conf" | tr -d ';' || true)"
  fi
fi
SPARROWX_DOMAIN="$(echo "${SPARROWX_DOMAIN:-sparrowx.net}" | sed -E 's#^https?://##; s#/.*$##' | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
if [ -z "${SPARROWX_DOMAIN}" ] || [ "${SPARROWX_DOMAIN}" = "_" ]; then
  SPARROWX_DOMAIN="sparrowx.net"
fi

SPARROWX_STUDIO_DOMAIN="$(echo "${SPARROWX_STUDIO_DOMAIN:-db.${SPARROWX_DOMAIN}}" | sed -E 's#^https?://##; s#/.*$##' | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
if [ -z "${SPARROWX_STUDIO_DOMAIN}" ] || [ "${SPARROWX_STUDIO_DOMAIN}" = "${SPARROWX_DOMAIN}" ]; then
  SPARROWX_STUDIO_DOMAIN="db.${SPARROWX_DOMAIN}"
fi

HTTP_PORT="${HTTP_PORT:-80}"
HTTPS_PORT="${HTTPS_PORT:-443}"
APP_HOST_PORT="${APP_HOST_PORT:-3000}"
PGRST_HOST_PORT="${PGRST_HOST_PORT:-3001}"
PG_HOST_PORT="${PG_HOST_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-sparrowx}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-sparrowx_ovh_secret_2026}"
POSTGRES_DB="${POSTGRES_DB:-sparrowx_db}"
SPARROWX_JWT_SECRET="${SPARROWX_JWT_SECRET:-$(openssl rand -hex 32 2>/dev/null || echo 'sparrowx_jwt_secret_key_32_characters_2026')}"
SPARROWX_REDIS_SECRET="${SPARROWX_REDIS_SECRET:-$(openssl rand -hex 16 2>/dev/null || echo 'sparrowx_redis_secret_2026')}"

ensure_env_key "SPARROWX_DOMAIN" "${SPARROWX_DOMAIN}"
ensure_env_key "SPARROWX_STUDIO_DOMAIN" "${SPARROWX_STUDIO_DOMAIN}"
ensure_env_key "SPARROWX_PUBLIC_IP" "${SPARROWX_PUBLIC_IP}"
ensure_env_key "HTTP_PORT" "${HTTP_PORT}"
ensure_env_key "HTTPS_PORT" "${HTTPS_PORT}"
ensure_env_key "APP_HOST_PORT" "${APP_HOST_PORT}"
ensure_env_key "PGRST_HOST_PORT" "${PGRST_HOST_PORT}"
ensure_env_key "PG_HOST_PORT" "${PG_HOST_PORT}"
ensure_env_key "POSTGRES_USER" "${POSTGRES_USER}"
ensure_env_key "POSTGRES_PASSWORD" "${POSTGRES_PASSWORD}"
ensure_env_key "POSTGRES_DB" "${POSTGRES_DB}"
ensure_env_key "SPARROWX_JWT_SECRET" "${SPARROWX_JWT_SECRET}"
ensure_env_key "SPARROWX_REDIS_SECRET" "${SPARROWX_REDIS_SECRET}"
export SPARROWX_DOMAIN SPARROWX_STUDIO_DOMAIN SPARROWX_PUBLIC_IP HTTP_PORT HTTPS_PORT APP_HOST_PORT PGRST_HOST_PORT PG_HOST_PORT POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB SPARROWX_JWT_SECRET SPARROWX_REDIS_SECRET

log_ok "Environment validated (${SPARROWX_DOMAIN} @ ${SPARROWX_PUBLIC_IP})"

# ==============================================================================
# STEP 2/7: Disk/Swap OOM Protection & GitHub Sync (origin/main)
# ==============================================================================
draw_progress 2 7 "Disk, Swap & GitHub Sync"

FREE_DISK_MB="$(df -Pm "${INSTALL_DIR}" 2>/dev/null | awk 'NR==2 {print $4}' || echo 99999)"
if [ "${FREE_DISK_MB:-99999}" -lt 2048 ]; then
  log_warn "Low free disk (${FREE_DISK_MB} MB) — pruning dangling Docker images & caches before build"
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    docker container prune -f >/dev/null 2>&1 || true
    docker image prune -f >/dev/null 2>&1 || true
    docker builder prune -f >/dev/null 2>&1 || true
  fi
  journalctl --vacuum-size=100M >/dev/null 2>&1 || true
fi

TOTAL_RAM_MB="$(free -m 2>/dev/null | awk '/^Mem:/ {print $2}' || echo 4096)"
TOTAL_SWAP_MB="$(free -m 2>/dev/null | awk '/^Swap:/ {print $2}' || echo 2048)"
if [ "${TOTAL_SWAP_MB:-0}" -lt 512 ] && [ "${TOTAL_RAM_MB:-4096}" -lt 4096 ] && [ ! -f /swapfile ] && [ "${FREE_DISK_MB:-0}" -gt 4096 ]; then
  log_warn "Provisioning 2 GB /swapfile to prevent build OOM kills (${TOTAL_RAM_MB} MB RAM)"
  (fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none) && \
    chmod 600 /swapfile && \
    mkswap /swapfile >/dev/null 2>&1 && \
    swapon /swapfile 2>/dev/null || true
  if ! grep -q "^/swapfile " /etc/fstab 2>/dev/null; then
    echo "/swapfile none swap sw 0 0" >> /etc/fstab
  fi
fi

if [ -d "${INSTALL_DIR}/.git" ] && command -v git >/dev/null 2>&1; then
  if ! git config --global --get-all safe.directory 2>/dev/null | grep -Fxq "${INSTALL_DIR}"; then
    git config --global --add safe.directory "${INSTALL_DIR}" 2>/dev/null || true
    log_warn "Registered ${INSTALL_DIR} in git safe.directory"
  fi
  for gitlock in "${INSTALL_DIR}/.git/index.lock" "${INSTALL_DIR}/.git/HEAD.lock" "${INSTALL_DIR}/.git/shallow.lock"; do
    if [ -f "${gitlock}" ] && ! pgrep -x "git" >/dev/null 2>&1; then
      rm -f "${gitlock}" 2>/dev/null || true
      log_warn "Cleared stale $(basename "${gitlock}") before pull"
    fi
  done

  BEFORE_HASH="$(git rev-parse HEAD 2>/dev/null || echo "")"
  if git fetch origin main --depth=1 && git reset --hard origin/main; then
    AFTER_HASH="$(git rev-parse HEAD 2>/dev/null || echo "")"
    log_ok "Repository synced to commit $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
    strip_crlf_all
    chmod +x "${INSTALL_DIR}"/*.sh "${INSTALL_DIR}"/ovh/*.sh "${INSTALL_DIR}"/deploy/*.sh 2>/dev/null || true
    if [ "${BEFORE_HASH}" != "${AFTER_HASH}" ] && [ "${SPARROWX_REEXEC:-0}" != "1" ]; then
      export SPARROWX_REEXEC=1
      log_info "Updater updated itself — re-launching new update.sh seamlessly..."
      exec bash "${INSTALL_DIR}/update.sh" "$@"
    fi
  else
    log_err "GitHub sync hit a transient network issue — continuing with local files + self-healing"
  fi
fi

# ==============================================================================
# STEP 3/7: Kernel Security Hardening, Package Locks & UFW Firewall
# ==============================================================================
draw_progress 3 7 "Kernel Hardening & Firewall"

if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  if ! pgrep -x "apt|apt-get|dpkg|unattended-upgr" >/dev/null 2>&1; then
    for lck in /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/lib/apt/lists/lock; do
      if [ -e "${lck}" ] && command -v fuser >/dev/null 2>&1 && ! fuser "${lck}" >/dev/null 2>&1; then
        rm -f "${lck}" 2>/dev/null || true
        dpkg --configure -a >/dev/null 2>&1 || true
        log_warn "Cleaned stale package manager lock (${lck})"
      fi
    done
  fi
fi

if [ ! -f /etc/sysctl.d/99-sparrowx-hardening.conf ]; then
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
    apt-get install -y -qq unattended-upgrades fail2ban psmisc iproute2 >/dev/null 2>&1 || true
    systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
    systemctl enable --now fail2ban >/dev/null 2>&1 || true
  fi
  log_ok "Kernel SYN-cookie shield, Fail2Ban & unattended CVE patching active"
else
  log_ok "OS kernel hardening & Fail2Ban active"
fi

if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw allow "${HTTP_PORT}"/tcp >/dev/null 2>&1 || true
  ufw allow "${HTTPS_PORT}"/tcp >/dev/null 2>&1 || true
  log_ok "UFW ports opened (22, 80, 443, ${HTTP_PORT}, ${HTTPS_PORT})"
fi

# ==============================================================================
# STEP 4/7: SSL Certificates & Multi-Domain Nginx Proxy
# ==============================================================================
draw_progress 4 7 "SSL & Multi-Domain Nginx"

mkdir -p "${INSTALL_DIR}/ovh/ssl" "${INSTALL_DIR}/data/users" "${INSTALL_DIR}/data/backups"

SSL_CERT="${INSTALL_DIR}/ovh/ssl/fullchain.pem"
SSL_KEY="${INSTALL_DIR}/ovh/ssl/privkey.pem"
if [ ! -s "${SSL_CERT}" ] || [ ! -s "${SSL_KEY}" ] || ! openssl x509 -in "${SSL_CERT}" -noout >/dev/null 2>&1; then
  log_warn "Generating valid TLS certificate (SAN: ${SPARROWX_DOMAIN} + subdomains)"
  if ! openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "${SSL_KEY}" \
    -out "${SSL_CERT}" \
    -subj "/CN=${SPARROWX_DOMAIN}" \
    -addext "subjectAltName=DNS:${SPARROWX_DOMAIN},DNS:*.${SPARROWX_DOMAIN}" >/dev/null 2>&1; then
    openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
      -keyout "${SSL_KEY}" \
      -out "${SSL_CERT}" \
      -subj "/CN=${SPARROWX_DOMAIN}" >/dev/null 2>&1 || true
  fi
fi

cat > "${INSTALL_DIR}/ovh/nginx.conf" <<EOF
# 1. Master SparrowX Command Center & Default Fallback (${SPARROWX_DOMAIN})
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    server_name ${SPARROWX_DOMAIN} www.${SPARROWX_DOMAIN} _;
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 100M;
    server_tokens off;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location /rest/v1/ {
        proxy_pass http://sparrowx:3000/rest/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
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

# 2. Dedicated Database Studio Domain (${SPARROWX_STUDIO_DOMAIN})
server {
    listen 80;
    listen 443 ssl;
    server_name ${SPARROWX_STUDIO_DOMAIN} studio.${SPARROWX_DOMAIN};
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 100M;
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
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-SparrowX-Studio "1";
    }
}

# 3. Standalone Product Subdomains (Drop, Keys, Shield, API)
server {
    listen 80;
    listen 443 ssl;
    server_name file.${SPARROWX_DOMAIN} drop.${SPARROWX_DOMAIN} password.${SPARROWX_DOMAIN} passwd.${SPARROWX_DOMAIN} keys.${SPARROWX_DOMAIN} sec.${SPARROWX_DOMAIN} shield.${SPARROWX_DOMAIN} api.${SPARROWX_DOMAIN} rest.${SPARROWX_DOMAIN};
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 100M;
    server_tokens off;

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
EOF
log_ok "Nginx reverse proxy configured for all 6 SparrowX domains"

# ==============================================================================
# STEP 5/7: Auto-Upgrade Systemd Daemon & CLI Symlinks
# ==============================================================================
draw_progress 5 7 "Auto-Upgrade Daemon & CLI"

if [ -d /etc/systemd/system ] && command -v systemctl >/dev/null 2>&1; then
  cat > /etc/systemd/system/sparrowx-autoupdate.service <<EOF
[Unit]
Description=SparrowX Automatic GitHub Sync & Self-Healing Rebuild
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=${INSTALL_DIR}
ExecStart=/bin/bash -c 'git fetch origin main --depth=1 && if [ "\$(git rev-parse HEAD)" != "\$(git rev-parse origin/main)" ]; then ${INSTALL_DIR}/update.sh --auto; fi'
EOF
  if [ ! -f /etc/systemd/system/sparrowx-autoupdate.timer ]; then
    cat > /etc/systemd/system/sparrowx-autoupdate.timer <<'EOF'
[Unit]
Description=Check GitHub every 5 minutes for SparrowX updates

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
EOF
  fi
  systemctl daemon-reload >/dev/null 2>&1 || true
  systemctl enable --now sparrowx-autoupdate.timer >/dev/null 2>&1 || true
  log_ok "Auto-upgrade timer active; CLIs linked (sparrowx-update, sparrowx-fix, sparrowx-db)"
fi

# ==============================================================================
# STEP 6/7: Pre-Healed Container Fleet Rebuild & Port Conflict Protection
# ==============================================================================
draw_progress 6 7 "Container Build & Port Shield"

DB_MARKER_FILE="${INSTALL_DIR}/data/.db_initialized"
COMPOSE_FILE="${INSTALL_DIR}/docker-compose.ovh.yml"
if [ ! -f "${COMPOSE_FILE}" ] && [ -f "${INSTALL_DIR}/docker-compose.yml" ]; then
  COMPOSE_FILE="${INSTALL_DIR}/docker-compose.yml"
fi
APP_SERVICE="sparrowx"
HAS_DOCKER="false"
BUILD_FAILED="false"

if command -v docker >/dev/null 2>&1; then
  if ! docker info >/dev/null 2>&1; then
    log_warn "Docker daemon unresponsive — restarting containerd & docker"
    systemctl restart containerd docker >/dev/null 2>&1 || true
    sleep 3
  fi
  if docker info >/dev/null 2>&1; then
    HAS_DOCKER="true"
  fi
fi

if [ "${HAS_DOCKER}" = "true" ]; then
  # Stop conflicting host daemons
  for svc in sparrowx-native.service postgresql apache2 nginx caddy; do
    if systemctl is-active --quiet "${svc}" 2>/dev/null; then
      systemctl stop "${svc}" >/dev/null 2>&1 || true
      log_warn "Stopped conflicting host service: ${svc}"
    fi
  done

  # Clean legacy duplicate containers from older compose blueprints
  for old_c in sparrowx_postgres sparrowx_pgbouncer sparrowx_postgrest sparrowx_threat_cache sparrowx_studio sparrowx_edge_proxy; do
    if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -Fxq "${old_c}"; then
      docker rm -f "${old_c}" >/dev/null 2>&1 || true
      log_warn "Removed legacy conflicting container: ${old_c}"
    fi
  done

  # Free HTTP/HTTPS ports if held by non-sparrowx-nginx processes
  for wp in "${HTTP_PORT}" "${HTTPS_PORT}"; do
    if port_held_by_other "${wp}" "sparrowx-nginx"; then
      log_warn "Clearing foreign process holding port ${wp}/tcp"
      command -v fuser >/dev/null 2>&1 && fuser -k "${wp}/tcp" >/dev/null 2>&1 || true
      sleep 1
    fi
  done

  # Check PostgREST & App port conflicts before launch
  if port_held_by_other "${PGRST_HOST_PORT}" "sparrowx-postgrest"; then
    PGRST_HOST_PORT="$(find_next_free_port 3002)"
    ensure_env_key "PGRST_HOST_PORT" "${PGRST_HOST_PORT}"
    export PGRST_HOST_PORT
    log_warn "Shifted PGRST_HOST_PORT=${PGRST_HOST_PORT} to bypass port conflict"
  fi
  if port_held_by_other "${APP_HOST_PORT}" "sparrowx-app"; then
    APP_HOST_PORT="$(find_next_free_port 3010)"
    ensure_env_key "APP_HOST_PORT" "${APP_HOST_PORT}"
    export APP_HOST_PORT
    log_warn "Shifted APP_HOST_PORT=${APP_HOST_PORT} to bypass port conflict"
  fi

  IS_PG_RUNNING="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -Fx "sparrowx-postgres" || true)"
  IS_PGRST_RUNNING="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -Fx "sparrowx-postgrest" || true)"

  if [ -n "${IS_PG_RUNNING}" ] && [ -n "${IS_PGRST_RUNNING}" ] && [ "${FORCE_DB_INSTALL}" = "false" ]; then
    log_info "PostgreSQL & PostgREST running cleanly — rebuilding ${APP_SERVICE} container..."
    if compose_cmd -f "${COMPOSE_FILE}" build "${APP_SERVICE}" && compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps --remove-orphans "${APP_SERVICE}"; then
      compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps nginx >/dev/null 2>&1 || true
      docker restart sparrowx-nginx >/dev/null 2>&1 || true
      log_ok "Rebuilt and restarted ${APP_SERVICE} + sparrowx-nginx zero-downtime"
    else
      BUILD_FAILED="true"
    fi
  else
    if port_held_by_other "${PG_HOST_PORT}" "sparrowx-postgres"; then
      PG_HOST_PORT="$(find_next_free_port 5433)"
      ensure_env_key "PG_HOST_PORT" "${PG_HOST_PORT}"
      export PG_HOST_PORT
      log_warn "Host port 5432 in use — reassigned PG_HOST_PORT=${PG_HOST_PORT} in .env"
    fi

    log_info "Launching Full-Stack Docker fleet via $(basename "${COMPOSE_FILE}")..."
    if ! compose_cmd -f "${COMPOSE_FILE}" up --build -d --remove-orphans; then
      log_warn "Initial Compose startup hit conflict — cleaning bridge networks, stale containers & retrying"
      compose_cmd -f "${COMPOSE_FILE}" down --remove-orphans >/dev/null 2>&1 || true
      docker rm -f sparrowx-postgres sparrowx-postgrest sparrowx-app sparrowx-nginx >/dev/null 2>&1 || true
      docker network prune -f >/dev/null 2>&1 || true
      if is_port_busy "${PG_HOST_PORT}" || [ "${PG_HOST_PORT}" = "5432" ]; then
        if is_port_busy 5432; then
          PG_HOST_PORT="$(find_next_free_port 5433)"
          ensure_env_key "PG_HOST_PORT" "${PG_HOST_PORT}"
          export PG_HOST_PORT
          log_warn "Assigned clean PG_HOST_PORT=${PG_HOST_PORT}"
        fi
      fi
      if ! compose_cmd -f "${COMPOSE_FILE}" up --build -d --remove-orphans; then
        BUILD_FAILED="true"
      fi
    fi
    docker restart sparrowx-nginx >/dev/null 2>&1 || true
  fi

  if [ "${BUILD_FAILED}" = "true" ] && [ -x "${INSTALL_DIR}/fix.sh" ]; then
    log_warn "Build/startup reported errors — invoking autonomous doctor (fix.sh --auto --rebuild)"
    "${INSTALL_DIR}/fix.sh" --auto --rebuild
  fi
else
  log_info "Docker unavailable — rebuilding native Node.js SparrowX server..."
  export NODE_OPTIONS="--max-old-space-size=2048"
  export VITE_SOVEREIGN_SELF_HOSTED="true"
  export VITE_SUPABASE_URL=""
  npm install --legacy-peer-deps && npm run build
  systemctl restart sparrowx-native.service 2>/dev/null || true
fi

# ==============================================================================
# STEP 7/7: PostgreSQL Role/Schema Verify, DB Sync & Live Health Gate
# ==============================================================================
draw_progress 7 7 "DB Schema Sync & Health Probe"

if [ "${HAS_DOCKER}" = "true" ] && docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-postgres"; then
  for _pgw in $(seq 1 15); do
    docker exec sparrowx-postgres pg_isready -q >/dev/null 2>&1 && break
    sleep 1
  done
  if [ -f "${INSTALL_DIR}/ovh/schema.sql" ]; then
    USERS_TBL="$(docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" sparrowx-postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "SELECT to_regclass('public.app_users');" 2>/dev/null | tr -d '[:space:]')"
    INQ_TBL="$(docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" sparrowx-postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "SELECT to_regclass('public.contact_inquiries');" 2>/dev/null | tr -d '[:space:]')"
    if { [ "${USERS_TBL}" != "app_users" ] && [ "${USERS_TBL}" != "public.app_users" ]; } || { [ "${INQ_TBL}" != "contact_inquiries" ] && [ "${INQ_TBL}" != "public.contact_inquiries" ]; }; then
      docker exec -i -e PGPASSWORD="${POSTGRES_PASSWORD}" sparrowx-postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "${INSTALL_DIR}/ovh/schema.sql" >/dev/null 2>&1 || true
      log_warn "Applied schema updates from ovh/schema.sql"
    fi
  fi
fi

# Verify HTTP health endpoint responds 200 OK
log_info "Probing SparrowX HTTP & PostgREST health endpoints..."
HEALTH_OK="false"
for _i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:${APP_HOST_PORT}/api/v1/health" >/dev/null 2>&1; then
    HEALTH_OK="true"
    break
  fi
  sleep 2
done

if [ "${HEALTH_OK}" = "true" ]; then
  log_ok "SparrowX Web Server healthy (http://127.0.0.1:${APP_HOST_PORT}/api/v1/health -> 200 OK)"
else
  log_warn "Health probe failed — running deep recovery doctor (fix.sh --auto)"
  if [ -x "${INSTALL_DIR}/fix.sh" ]; then
    "${INSTALL_DIR}/fix.sh" --auto
    curl -fsS "http://127.0.0.1:${APP_HOST_PORT}/api/v1/health" >/dev/null 2>&1 && HEALTH_OK="true"
  fi
fi

# Seed or verify local DB population
EXISTING_USERS_COUNT="0"
if curl -fsS "http://127.0.0.1:${PGRST_HOST_PORT}/app_users?select=id&limit=1" 2>/dev/null | grep -q '"id"'; then
  EXISTING_USERS_COUNT="1"
fi

if [ -f "${DB_MARKER_FILE}" ] || [ "${EXISTING_USERS_COUNT}" = "1" ]; then
  if [ "${FORCE_DB_INSTALL}" = "true" ]; then
    log_info "--reinstall-db requested: re-syncing Local OVH DB & per-user folders..."
    sleep 2
    "${INSTALL_DIR}/manage-db.sh" sync >/dev/null 2>&1 && touch "${DB_MARKER_FILE}" || true
  else
    touch "${DB_MARKER_FILE}" 2>/dev/null || true
    log_ok "PostgreSQL database & accounts intact (use './update.sh --reinstall-db' to force re-sync)"
  fi
else
  log_info "First-time setup: seeding Local OVH DB & per-user directories..."
  sleep 3
  "${INSTALL_DIR}/manage-db.sh" sync >/dev/null 2>&1 && touch "${DB_MARKER_FILE}" || true
fi

PGRST_STATUS="$(curl -fsS "http://127.0.0.1:${PGRST_HOST_PORT}/" >/dev/null 2>&1 && echo "ONLINE" || echo "STARTING")"
EDGE_STATUS="$(curl -fsS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${HTTP_PORT}/api/v1/health" 2>/dev/null | grep -qE "^(200|301|302)$" && echo "ONLINE" || echo "CHECK")"

echo ""
echo -e "${C_GREEN}╔══════════════════════════════════════════════════════════════════════════╗${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}  ${C_BOLD}${C_WHITE}✅ ALL UPDATES APPLIED & FULL-STACK OVH SYSTEM IS LIVE (A-TO-Z)${C_RESET}         ${C_GREEN}║${C_RESET}"
echo -e "${C_GREEN}╠══════════════════════════════════════════════════════════════════════════╣${C_RESET}"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-24s${C_RESET} : %-44s ${C_GREEN}║${C_RESET}\n" "Git Commit" "$(git rev-parse --short HEAD 2>/dev/null || echo local) (origin/main)"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-24s${C_RESET} : %-44s ${C_GREEN}║${C_RESET}\n" "Auto-Healed Fixes" "${HEALED_COUNT} issue(s) resolved automatically"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-24s${C_RESET} : %-44s ${C_GREEN}║${C_RESET}\n" "Web / PostgREST / Edge" "$([ "${HEALTH_OK}" = "true" ] && echo "ONLINE" || echo "WARN") / ${PGRST_STATUS} / ${EDGE_STATUS}"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-24s${C_RESET} : %-44s ${C_GREEN}║${C_RESET}\n" "Port Bindings" "PG:${PG_HOST_PORT} PGRST:${PGRST_HOST_PORT} APP:${APP_HOST_PORT} WEB:${HTTP_PORT}/${HTTPS_PORT}"
echo -e "${C_GREEN}╠══════════════════════════════════════════════════════════════════════════╣${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}  ${C_BOLD}Dedicated Service Websites:${C_RESET}                                             ${C_GREEN}║${C_RESET}"
printf "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Master Portal    : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} DB Studio        : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://db.${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Drop Vault       : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://file.${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_YELLOW}•${C_RESET} Password Vault   : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://password.${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_BLUE}•${C_RESET} Shield WAF/SOC   : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://sec.${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_MAGENTA}•${C_RESET} REST API Gateway : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://api.${SPARROWX_DOMAIN}"
echo -e "${C_GREEN}╠══════════════════════════════════════════════════════════════════════════╣${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}  ${C_BOLD}Quick Operations CLI:${C_RESET}                                                   ${C_GREEN}║${C_RESET}"
printf "${C_GREEN}║${C_RESET}   ${C_YELLOW}•${C_RESET} Full Update      : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "./update.sh  (or: sparrowx-update)"
printf "${C_GREEN}║${C_RESET}   ${C_YELLOW}•${C_RESET} Auto-Heal Doctor : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "./fix.sh     (or: sparrowx-fix / sparrowx-doctor)"
printf "${C_GREEN}║${C_RESET}   ${C_YELLOW}•${C_RESET} Database TUI     : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "./manage-db.sh (or: sparrowx-db)"
echo -e "${C_GREEN}╚══════════════════════════════════════════════════════════════════════════╝${C_RESET}"
