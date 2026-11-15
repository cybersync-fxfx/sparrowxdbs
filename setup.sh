#!/usr/bin/env bash
# ==============================================================================
# SPARROWX TECHNOLOGIES — FULL-STACK BLUEPRINT INSTALLER (DEBIAN/UBUNTU)
# ==============================================================================
# Complete A-to-Z Dedicated Server Wizard & Idempotent Auto-Healer:
#  • Idempotent Pre-Flight Audit: keeps already-healthy services untouched
#  • Self-Healing Debian/Ubuntu Engine (apt locks, IPv4 apt, swap, ports)
#  • Multi-Domain Reverse Proxy (Root, DB, Shield, File 100MB, Keys, API, Game)
#  • Pterodactyl Panel (game.<domain>) Installer & Port-Flow Auto-Repair (:8090)
#  • Automated Let's Encrypt SSL (Webroot + SAN Fallback + 12h Cron)
#  • Live Ping & HTTP/HTTPS Endpoint Detector with Auto-Fix + Watchdog Cron
# ==============================================================================
set -u

REPO_URL="https://github.com/cybersync-fxfx/sparrowxdbs.git"
LOG_FILE="/var/log/sparrowx-install.log"

AUTO_MODE="false"
INSTALL_PTERO="ask"
INTERACTIVE_PTERO="false"

for arg in "$@"; do
  case "${arg}" in
    --auto|-y|--yes) AUTO_MODE="true" ;;
    --ptero|--with-ptero|--pterodactyl) INSTALL_PTERO="yes" ;;
    --interactive-ptero) INSTALL_PTERO="yes"; INTERACTIVE_PTERO="true" ;;
    --no-ptero) INSTALL_PTERO="no" ;;
    --help|-h)
      cat <<'HELP'
SparrowX Blueprint Installer & Pterodactyl Port-Flow Manager (setup.sh)

Usage:
  ./setup.sh [options]

Options:
  --ptero             Install or heal Pterodactyl Game Panel (game.<domain>)
  --interactive-ptero Launch upstream interactive pterodactyl-installer prompts
  --no-ptero          Skip automatic Pterodactyl installation
  --auto, -y          Non-interactive mode (accept saved .env / smart defaults)
  --help, -h          Show this help screen
HELP
      exit 0
      ;;
  esac
done

# Terminal Colors
C_RESET="\033[0m"
C_BOLD="\033[1m"
C_DIM="\033[2m"
C_ORANGE="\033[38;5;208m"
C_GREEN="\033[1;32m"
C_CYAN="\033[1;36m"
C_YELLOW="\033[1;33m"
C_RED="\033[1;31m"
C_WHITE="\033[1;37m"

log_info()  { echo -e "${C_CYAN}  [INFO]${C_RESET}  $*"; echo "[INFO] $*" >> "${LOG_FILE}" 2>/dev/null || true; }
log_ok()    { echo -e "${C_GREEN}  [✓ OK]${C_RESET}  $*"; echo "[OK] $*" >> "${LOG_FILE}" 2>/dev/null || true; }
log_warn()  { echo -e "${C_YELLOW}  [⚡ HEAL]${C_RESET} $*"; echo "[HEAL] $*" >> "${LOG_FILE}" 2>/dev/null || true; }
log_err()   { echo -e "${C_RED}  [✗ WARN]${C_RESET} $*"; echo "[WARN] $*" >> "${LOG_FILE}" 2>/dev/null || true; }

step_banner() {
  local step_num="$1"
  local total="$2"
  local title="$3"
  local pct=$((step_num * 100 / total))
  local filled=$((pct / 5))
  local empty=$((20 - filled))
  local bar=""
  for ((i=0; i<filled; i++)); do bar="${bar}█"; done
  for ((i=0; i<empty; i++)); do bar="${bar}░"; done
  echo ""
  echo -e "${C_ORANGE}┌──────────────────────────────────────────────────────────────────────┐${C_RESET}"
  echo -e "${C_ORANGE}│${C_RESET} ${C_BOLD}STEP ${step_num}/${total}${C_RESET} ${C_DIM}[${C_GREEN}${bar}${C_DIM}] ${pct}%${C_RESET} — ${C_WHITE}${title}${C_RESET}"
  echo -e "${C_ORANGE}└──────────────────────────────────────────────────────────────────────┘${C_RESET}"
}

# Auto-elevate if not root
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    echo -e "${C_YELLOW}[HEAL] Re-launching SparrowX Blueprint Installer with sudo...${C_RESET}"
    exec sudo -E bash "$0" "$@"
  else
    echo -e "${C_RED}[ERROR] Please run this installer as root (su - or sudo).${C_RESET}"
    exit 1
  fi
fi

# Resolve installation directory dynamically (compatible with /opt/sparrowxdbs & /opt/sparrowx)
SCRIPT_SOURCE="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd "$(dirname "${SCRIPT_SOURCE}")" 2>/dev/null && pwd || pwd)"
if [ -f "./docker-compose.ovh.yml" ] && [ -f "./ovh/schema.sql" ]; then
  INSTALL_DIR="$(pwd)"
elif [ -f "${SCRIPT_DIR}/docker-compose.ovh.yml" ] && [ -f "${SCRIPT_DIR}/ovh/schema.sql" ]; then
  INSTALL_DIR="${SCRIPT_DIR}"
elif [ -d "/opt/sparrowxdbs/.git" ] || [ -f "/opt/sparrowxdbs/docker-compose.ovh.yml" ]; then
  INSTALL_DIR="/opt/sparrowxdbs"
elif [ -d "/opt/sparrowx/.git" ] || [ -f "/opt/sparrowx/docker-compose.ovh.yml" ]; then
  INSTALL_DIR="/opt/sparrowx"
else
  INSTALL_DIR="/opt/sparrowxdbs"
fi

touch "${LOG_FILE}" 2>/dev/null || LOG_FILE="/tmp/sparrowx-install.log"
if [ "${AUTO_MODE}" != "true" ]; then
  clear 2>/dev/null || true
fi

echo -e "${C_ORANGE}"
cat <<'BANNER'
   _____ ____  ___    ____  ____  ____  _       ___  __
  / ___// __ \/   |  / __ \/ __ \/ __ \| |     / / |/ /
  \__ \/ /_/ / /| | / /_/ / /_/ / / / /| | /| / /|   / 
 ___/ / ____/ ___ |/ _, _/ _, _/ /_/ / | |/ |/ //   |  
/____/_/   /_/  |_/_/ |_/_/ |_|\____/  |__/|__//_/|_|  
BANNER
echo -e "${C_RESET}${C_BOLD}  SPARROWX INFRASTRUCTURE BLUEPRINT • DEBIAN / UBUNTU DEDICATED WIZARD${C_RESET}"
echo -e "${C_DIM}  Multi-Domain SSL • PG16+PostgREST • Pterodactyl (game.) & Port-Flow Healer${C_RESET}"
echo -e "${C_ORANGE}========================================================================${C_RESET}"

# ==============================================================================
# SELF-HEALING & PORT-FLOW UTILITIES
# ==============================================================================
compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    return 1
  fi
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

heal_apt_locks() {
  if ! command -v apt-get >/dev/null 2>&1; then return 0; fi
  export DEBIAN_FRONTEND=noninteractive
  if [ ! -f /etc/apt/apt.conf.d/99sparrowx-ipv4 ]; then
    echo 'Acquire::ForceIPv4 "true";' > /etc/apt/apt.conf.d/99sparrowx-ipv4 2>/dev/null || true
  fi
  local wait_count=0
  while fuser /var/lib/dpkg/lock >/dev/null 2>&1 || \
        fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || \
        fuser /var/lib/apt/lists/lock >/dev/null 2>&1; do
    wait_count=$((wait_count + 1))
    [ "${wait_count}" -eq 1 ] && log_warn "Waiting for apt/dpkg lock..."
    if [ "${wait_count}" -ge 12 ]; then
      log_warn "Force-clearing stuck apt/dpkg locks..."
      systemctl stop unattended-upgrades apt-daily.timer apt-daily-upgrade.timer >/dev/null 2>&1 || true
      killall -q apt apt-get dpkg unattended-upgr 2>/dev/null || true
      rm -f /var/lib/apt/lists/lock /var/cache/apt/archives/lock /var/lib/dpkg/lock* 2>/dev/null || true
      dpkg --configure -a >/dev/null 2>&1 || true
      break
    fi
    sleep 2
  done
  dpkg --configure -a >/dev/null 2>&1 || true
}

retry_pkg_install() {
  local attempt=1
  while [ "${attempt}" -le 4 ]; do
    heal_apt_locks
    if command -v apt-get >/dev/null 2>&1; then
      apt-get update -y --fix-missing >/dev/null 2>&1 || true
      if apt-get install -y --no-install-recommends "$@" >/dev/null 2>&1; then
        return 0
      fi
      apt-get install -f -y >/dev/null 2>&1 || true
    elif command -v dnf >/dev/null 2>&1; then
      if dnf install -y "$@" >/dev/null 2>&1; then return 0; fi
    fi
    log_warn "Retrying package install (${attempt}/4): $*"
    attempt=$((attempt + 1))
    sleep 2
  done
  return 0
}

heal_host_dns() {
  if ! getent hosts github.com >/dev/null 2>&1; then
    log_warn "DNS resolution unavailable; injecting 1.1.1.1 & 8.8.8.8 resolvers..."
    cp /etc/resolv.conf /etc/resolv.conf.spx.bak 2>/dev/null || true
    {
      echo "nameserver 1.1.1.1"
      echo "nameserver 8.8.8.8"
      cat /etc/resolv.conf.spx.bak 2>/dev/null || true
    } > /etc/resolv.conf 2>/dev/null || true
  fi
}

ensure_swap_memory() {
  local total_ram_mb
  total_ram_mb="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 4096)"
  local total_swap_mb
  total_swap_mb="$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)"
  if [ "${total_ram_mb}" -lt 3800 ] && [ "${total_swap_mb}" -lt 1024 ]; then
    log_warn "RAM is ${total_ram_mb}MB. Creating 2GB /swapfile to guarantee smooth Docker builds..."
    if [ ! -f /swapfile ]; then
      (fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none 2>/dev/null) || true
      chmod 600 /swapfile 2>/dev/null || true
      mkswap /swapfile >/dev/null 2>&1 || true
      swapon /swapfile >/dev/null 2>&1 || true
      grep -q "/swapfile" /etc/fstab 2>/dev/null || echo "/swapfile none swap sw 0 0" >> /etc/fstab 2>/dev/null || true
      log_ok "2GB swapfile activated."
    fi
  fi
}

is_port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    if ss -tuln 2>/dev/null | awk '{print $5}' | grep -E "(:|\\.)(${port})\$" >/dev/null 2>&1; then
      return 0
    fi
  elif command -v lsof >/dev/null 2>&1; then
    if lsof -iTCP:"${port}" -sTCP:LISTEN -P -n >/dev/null 2>&1; then
      return 0
    fi
  fi
  if (echo >/dev/tcp/127.0.0.1/"${port}") >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

port_held_by_container() {
  local port="$1"
  local expected_regex="$2"
  if ! is_port_in_use "${port}"; then
    return 1
  fi
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E "^(${expected_regex}) " | grep -qE ":${port}->"; then
      return 0
    fi
  fi
  return 1
}

is_reserved_ptero_port() {
  local port="$1"
  case "${port}" in
    8080|8443|2022|3306|6379|"${PTERO_PORT:-8090}") return 0 ;;
    *) return 1 ;;
  esac
}

find_free_port() {
  local preferred="$1"
  local fallback="$2"
  local label="$3"
  local expected_ctr="${4:-}"

  if [ -n "${expected_ctr}" ] && port_held_by_container "${preferred}" "${expected_ctr}"; then
    echo "${preferred}"
    return 0
  fi
  if ! is_port_in_use "${preferred}"; then
    echo "${preferred}"
    return 0
  fi

  log_warn "${label}: Port ${preferred} is busy; scanning from ${fallback} (avoiding Pterodactyl ports 8080/8443/2022/3306/6379/${PTERO_PORT:-8090})..." >&2
  local candidate="${fallback}"
  while [ "${candidate}" -lt 65000 ]; do
    if ! is_reserved_ptero_port "${candidate}" && ! is_port_in_use "${candidate}"; then
      log_ok "${label}: Assigned free port ${candidate}" >&2
      echo "${candidate}"
      return 0
    fi
    candidate=$((candidate + 1))
  done
  echo "${preferred}"
}

free_docker_port_conflicts() {
  local port="$1"
  local keep_name="$2"
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    local ctrs
    ctrs="$(docker ps --format '{{.ID}} {{.Names}} {{.Ports}}' 2>/dev/null | grep -E "(:|0\.0\.0\.0:|127\.0\.0\.1:|\[::\]:)${port}->" | awk -v keep="${keep_name}" '$2 != keep {print $1}' || true)"
    if [ -n "${ctrs}" ]; then
      echo "${ctrs}" | xargs -r docker rm -f >/dev/null 2>&1 || true
    fi
  fi
}

is_pterodactyl_installed() {
  [ -f /var/www/pterodactyl/artisan ]
}

set_ptero_env_key() {
  local key="$1"
  local val="$2"
  local ptero_env="/var/www/pterodactyl/.env"
  [ -f "${ptero_env}" ] || return 0
  awk -v k="${key}" -v v="${val}" '
    BEGIN { found=0 }
    index($0, k "=") == 1 { print k "=" v; found=1; next }
    { print }
    END { if (!found) print k "=" v }
  ' "${ptero_env}" > "${ptero_env}.tmp" && mv "${ptero_env}.tmp" "${ptero_env}"
}

init_ptero_credentials() {
  local existing_db="" existing_user="" existing_pass=""
  if [ -f "/var/www/pterodactyl/.env" ]; then
    existing_db="$(awk -F= '/^DB_DATABASE=/{sub(/^[^=]*=/,""); print; exit}' /var/www/pterodactyl/.env 2>/dev/null | tr -d "\"'\r" || true)"
    existing_user="$(awk -F= '/^DB_USERNAME=/{sub(/^[^=]*=/,""); print; exit}' /var/www/pterodactyl/.env 2>/dev/null | tr -d "\"'\r" || true)"
    existing_pass="$(awk -F= '/^DB_PASSWORD=/{sub(/^[^=]*=/,""); print; exit}' /var/www/pterodactyl/.env 2>/dev/null | tr -d "\"'\r" || true)"
  fi

  PTERO_ADMIN_EMAIL="${PTERO_ADMIN_EMAIL:-${SPARROWX_ADMIN_EMAIL:-admin@${DOMAIN_ROOT:-sparrowx.net}}}"
  if ! echo "${PTERO_ADMIN_EMAIL}" | grep -qE '^[A-Za-z0-9_+-]+(\.[A-Za-z0-9_+-]+)*@([A-Za-z0-9-]+\.)+[A-Za-z]{2,63}$'; then
    PTERO_ADMIN_EMAIL="admin@sparrowx.net"
  fi
  PTERO_ADMIN_USER="${PTERO_ADMIN_USER:-admin}"
  PTERO_ADMIN_FIRSTNAME="${PTERO_ADMIN_FIRSTNAME:-SparrowX}"
  PTERO_ADMIN_LASTNAME="${PTERO_ADMIN_LASTNAME:-Admin}"
  PTERO_ADMIN_PASSWORD="${PTERO_ADMIN_PASSWORD:-SpxPanel_$(openssl rand -hex 6 2>/dev/null || echo '9a8b7c6d5e4f')}"
  PTERO_DB_NAME="${existing_db:-${PTERO_DB_NAME:-panel}}"
  PTERO_DB_USER="${existing_user:-${PTERO_DB_USER:-pterodactyl}}"
  PTERO_DB_PASSWORD="${existing_pass:-${PTERO_DB_PASSWORD:-$(openssl rand -hex 16 2>/dev/null || echo 'spx_ptero_db_pass_2026')}}"
  PTERO_TIMEZONE="${PTERO_TIMEZONE:-UTC}"
  if [ -z "${PTERO_SSO_SECRET:-}" ] && [ -f "/var/www/pterodactyl/.env" ]; then
    PTERO_SSO_SECRET="$(awk -F= '/^SPARROWX_SSO_SECRET=/{sub(/^[^=]*=/,""); print; exit}' /var/www/pterodactyl/.env 2>/dev/null | tr -d "\"'\r" || true)"
  fi
  if [ -z "${PTERO_SSO_SECRET:-}" ] && [ -f "${INSTALL_DIR}/.env" ]; then
    PTERO_SSO_SECRET="$(awk -F= '/^PTERO_SSO_SECRET=/{sub(/^[^=]*=/,""); print; exit}' "${INSTALL_DIR}/.env" 2>/dev/null | tr -d "\"'\r" || true)"
  fi
  PTERO_SSO_SECRET="${PTERO_SSO_SECRET:-$(openssl rand -hex 32 2>/dev/null || echo 'sparrowx_ptero_sso_hmac_secret_2026_32c')}"
  PTERO_URL="https://${DOMAIN_GAME:-game.panel.${DOMAIN_ROOT:-sparrowx.local}}"
  export PTERO_ADMIN_EMAIL PTERO_ADMIN_USER PTERO_ADMIN_FIRSTNAME PTERO_ADMIN_LASTNAME PTERO_ADMIN_PASSWORD PTERO_DB_NAME PTERO_DB_USER PTERO_DB_PASSWORD PTERO_TIMEZONE PTERO_SSO_SECRET PTERO_URL
}

write_ptero_credentials_file() {
  local cred_file="/root/.sparrowx-ptero-credentials.txt"
  {
    echo "# ======================================================================"
    echo "# SPARROWX + PTERODACTYL GAME PANEL CREDENTIALS"
    echo "# Generated / Verified: $(date -u '+%Y-%m-%d %H:%M:%S UTC' 2>/dev/null || date)"
    echo "# ======================================================================"
    echo "PANEL_URL=https://${DOMAIN_GAME}"
    echo "PANEL_INTERNAL_PORT=${PTERO_PORT:-8090}"
    echo "PANEL_ADMIN_EMAIL=${PTERO_ADMIN_EMAIL:-admin@sparrowx.net}"
    echo "PANEL_ADMIN_USER=${PTERO_ADMIN_USER:-admin}"
    echo "PANEL_ADMIN_PASSWORD=${PTERO_ADMIN_PASSWORD:-}"
    echo "PTERO_MYSQL_HOST=127.0.0.1"
    echo "PTERO_MYSQL_PORT=3306"
    echo "PTERO_MYSQL_DATABASE=${PTERO_DB_NAME:-panel}"
    echo "PTERO_MYSQL_USER=${PTERO_DB_USER:-pterodactyl}"
    echo "PTERO_MYSQL_PASSWORD=${PTERO_DB_PASSWORD:-}"
    echo "SPARROWX_PG_HOST=127.0.0.1"
    echo "SPARROWX_PG_PORT=${PG_HOST_PORT:-5432}"
    echo "SPARROWX_PG_DATABASE=${POSTGRES_DB:-sparrowx_db}"
    echo "SPARROWX_PG_USER=${POSTGRES_USER:-sparrowx}"
    echo "SPARROWX_PG_PASSWORD=${POSTGRES_PASSWORD:-}"
  } > "${cred_file}" 2>/dev/null || true
  chmod 600 "${cred_file}" 2>/dev/null || true
}

install_pterodactyl_unattended() {
  if [ -d "/var/www/pterodactyl" ] && [ ! -f "/var/www/pterodactyl/artisan" ]; then
    log_warn "Removing incomplete /var/www/pterodactyl directory before fresh install..."
    rm -rf /var/www/pterodactyl
  fi

  init_ptero_credentials
  log_info "Running unattended Pterodactyl installer for ${DOMAIN_GAME} (Email: ${PTERO_ADMIN_EMAIL}, DB: ${PTERO_DB_NAME})..."

  if (
    set -e -o pipefail
    export GITHUB_SOURCE="v1.4.0"
    export SCRIPT_RELEASE="v1.4.0"
    export GITHUB_BASE_URL="https://raw.githubusercontent.com/pterodactyl-installer/pterodactyl-installer"
    export GITHUB_URL="${GITHUB_BASE_URL}/${GITHUB_SOURCE}"
    export PANEL_MAJOR_VERSION="1"
    export FQDN="${DOMAIN_GAME}"
    export MYSQL_DB="${PTERO_DB_NAME}"
    export MYSQL_USER="${PTERO_DB_USER}"
    export MYSQL_PASSWORD="${PTERO_DB_PASSWORD}"
    export timezone="${PTERO_TIMEZONE}"
    export email="${PTERO_ADMIN_EMAIL}"
    export user_email="${PTERO_ADMIN_EMAIL}"
    export user_username="${PTERO_ADMIN_USER}"
    export user_firstname="${PTERO_ADMIN_FIRSTNAME}"
    export user_lastname="${PTERO_ADMIN_LASTNAME}"
    export user_password="${PTERO_ADMIN_PASSWORD}"
    export ASSUME_SSL="false"
    export CONFIGURE_LETSENCRYPT="false"
    export CONFIGURE_FIREWALL="false"
    export telemetry="false"

    rm -f /tmp/lib.sh
    if ! curl -fsSL -o /tmp/lib.sh "${GITHUB_BASE_URL}/v1.4.0/lib/lib.sh"; then
      export GITHUB_SOURCE="master"
      export SCRIPT_RELEASE="canary"
      export GITHUB_URL="${GITHUB_BASE_URL}/${GITHUB_SOURCE}"
      curl -fsSL -o /tmp/lib.sh "${GITHUB_BASE_URL}/master/lib/lib.sh"
    fi

    sed -i 's/CREATE USER /CREATE OR REPLACE USER /g' /tmp/lib.sh
    sed -i 's/CREATE DATABASE /CREATE DATABASE IF NOT EXISTS /g' /tmp/lib.sh

    # shellcheck disable=SC1091
    source /tmp/lib.sh
    bash -e -o pipefail -c "$(curl -fsSL "${GITHUB_URL}/installers/panel.sh")"
  ); then
    log_ok "Unattended Pterodactyl Panel installed for ${DOMAIN_GAME}."
  else
    log_warn "Unattended Pterodactyl installer exited early; running deep port & database reconciliation..."
  fi
  rm -f /tmp/lib.sh 2>/dev/null || true
}

detect_php_fpm_sock() {
  local sock=""
  sock="$(find /run/php /var/run/php -maxdepth 2 -type s -name 'php*-fpm.sock' 2>/dev/null | sort -V | tail -n 1 || true)"
  if [ -z "${sock}" ] && command -v systemctl >/dev/null 2>&1; then
    for php_svc in $(systemctl list-unit-files 'php*-fpm.service' --no-legend 2>/dev/null | awk '{print $1}' | sort -V || true); do
      systemctl enable --now "${php_svc}" >/dev/null 2>&1 || true
    done
    sleep 1
    sock="$(find /run/php /var/run/php -maxdepth 2 -type s -name 'php*-fpm.sock' 2>/dev/null | sort -V | tail -n 1 || true)"
  fi
  [ -z "${sock}" ] && sock="/run/php/php8.3-fpm.sock"
  echo "${sock}"
}

get_docker_host_ip() {
  local gw_ip=""
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-nginx"; then
      gw_ip="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}' sparrowx-nginx 2>/dev/null | tr -d '[:space:]' || true)"
      if [ -z "${gw_ip}" ]; then
        gw_ip="$(docker exec sparrowx-nginx sh -c "getent hosts host.docker.internal 2>/dev/null | awk '{print \$1; exit}'" 2>/dev/null | tr -d '[:space:]' || true)"
      fi
    fi
    if [ -z "${gw_ip}" ]; then
      gw_ip="$(docker network inspect bridge -f '{{range .IPAM.Config}}{{.Gateway}}{{end}}' 2>/dev/null | tr -d '[:space:]' || true)"
    fi
  fi
  if [ -z "${gw_ip}" ] && command -v ip >/dev/null 2>&1; then
    gw_ip="$(ip -4 addr show docker0 2>/dev/null | awk '/inet / {sub(/\/.*/, "", $2); print $2; exit}' || true)"
  fi
  [ -z "${gw_ip}" ] && gw_ip="172.17.0.1"
  echo "${gw_ip}"
}

open_ptero_ufw_rules() {
  local ptero_p="${PTERO_PORT:-8090}"
  if command -v ufw >/dev/null 2>&1; then
    ufw allow in from 127.0.0.1 to any port "${ptero_p}" proto tcp >/dev/null 2>&1 || true
    ufw allow in from 172.16.0.0/12 to any port "${ptero_p}" proto tcp >/dev/null 2>&1 || true
    if [ -d /etc/pterodactyl ] || systemctl list-unit-files wings.service >/dev/null 2>&1; then
      ufw allow 8080/tcp >/dev/null 2>&1 || true
      ufw allow 2022/tcp >/dev/null 2>&1 || true
    fi
  fi
}

render_sparrowx_nginx_conf() {
  local ptero_p="${PTERO_PORT:-8090}"
  local gamesec_domain="${DOMAIN_GAMESEC:-gamesec.${DOMAIN_ROOT:-${SPARROWX_DOMAIN:-sparrowx.local}}}"
  local gamesec_p="${GAMESEC_PORT:-3005}"
  local docker_host_ip
  docker_host_ip="$(get_docker_host_ip)"
  local ptero_ssl_cert="/etc/nginx/ssl/fullchain.pem"
  local ptero_ssl_key="/etc/nginx/ssl/privkey.pem"

  if [ -s "${INSTALL_DIR}/ovh/ssl/ptero-fullchain.pem" ] && [ -s "${INSTALL_DIR}/ovh/ssl/ptero-privkey.pem" ]; then
    ptero_ssl_cert="/etc/nginx/ssl/ptero-fullchain.pem"
    ptero_ssl_key="/etc/nginx/ssl/ptero-privkey.pem"
  fi
  local game_web_ssl_cert="/etc/nginx/ssl/fullchain.pem"
  local game_web_ssl_key="/etc/nginx/ssl/privkey.pem"
  if [ -s "${INSTALL_DIR}/ovh/ssl/game-web-fullchain.pem" ] && [ -s "${INSTALL_DIR}/ovh/ssl/game-web-privkey.pem" ]; then
    game_web_ssl_cert="/etc/nginx/ssl/game-web-fullchain.pem"
    game_web_ssl_key="/etc/nginx/ssl/game-web-privkey.pem"
  fi
  local game_dash_ssl_cert="/etc/nginx/ssl/fullchain.pem"
  local game_dash_ssl_key="/etc/nginx/ssl/privkey.pem"
  if [ -s "${INSTALL_DIR}/ovh/ssl/game-dash-fullchain.pem" ] && [ -s "${INSTALL_DIR}/ovh/ssl/game-dash-privkey.pem" ]; then
    game_dash_ssl_cert="/etc/nginx/ssl/game-dash-fullchain.pem"
    game_dash_ssl_key="/etc/nginx/ssl/game-dash-privkey.pem"
  fi
  local gamesec_ssl_cert="/etc/nginx/ssl/fullchain.pem"
  local gamesec_ssl_key="/etc/nginx/ssl/privkey.pem"
  if [ -s "${INSTALL_DIR}/ovh/ssl/gamesec-fullchain.pem" ] && [ -s "${INSTALL_DIR}/ovh/ssl/gamesec-privkey.pem" ]; then
    gamesec_ssl_cert="/etc/nginx/ssl/gamesec-fullchain.pem"
    gamesec_ssl_key="/etc/nginx/ssl/gamesec-privkey.pem"
  fi

  local gamesec_backend_block=""
  if [ -n "${GAMESEC_UPSTREAM_URL:-}" ]; then
    gamesec_backend_block="    location / {
        proxy_pass ${GAMESEC_UPSTREAM_URL};
        proxy_http_version 1.1;
        proxy_ssl_server_name on;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$proxy_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }"
  else
    gamesec_backend_block="    location / {
        set \$upstream_gamesec http://sparrowx-gamesec:3000;
        proxy_pass \$upstream_gamesec;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_intercept_errors on;
        error_page 502 503 504 = @gamesec_host_fallback;
    }

    location @gamesec_host_fallback {
        set \$fallback_gamesec http://${docker_host_ip}:${gamesec_p};
        proxy_pass \$fallback_gamesec;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }"
  fi
  local netsec_domain="${DOMAIN_NETSEC:-netsec.${DOMAIN_ROOT:-${SPARROWX_DOMAIN:-sparrowx.local}}}"
  local netsec_p="${NETSEC_PORT:-3006}"
  local netsec_ssl_cert="/etc/nginx/ssl/fullchain.pem"
  local netsec_ssl_key="/etc/nginx/ssl/privkey.pem"
  if [ -s "${INSTALL_DIR}/ovh/ssl/netsec-fullchain.pem" ] && [ -s "${INSTALL_DIR}/ovh/ssl/netsec-privkey.pem" ]; then
    netsec_ssl_cert="/etc/nginx/ssl/netsec-fullchain.pem"
    netsec_ssl_key="/etc/nginx/ssl/netsec-privkey.pem"
  fi
  local netsec_backend_block=""
  if [ -n "${NETSEC_UPSTREAM_URL:-}" ]; then
    netsec_backend_block="    location / {
        proxy_pass ${NETSEC_UPSTREAM_URL};
        proxy_http_version 1.1;
        proxy_ssl_server_name on;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$proxy_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }"
  else
    netsec_backend_block="    location / {
        set \$upstream_netsec http://sparrowx-netsec:${netsec_p};
        proxy_pass \$upstream_netsec;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_intercept_errors on;
        error_page 502 503 504 = @netsec_host_fallback;
    }

    location @netsec_host_fallback {
        set \$fallback_netsec http://${docker_host_ip}:${netsec_p};
        proxy_pass \$fallback_netsec;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }"
  fi

  local ptero_backend_block=""
  if is_pterodactyl_installed; then
    ptero_backend_block="    location / {
        proxy_pass http://${docker_host_ip}:${ptero_p};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port \$server_port;
        proxy_read_timeout 300s;
        proxy_connect_timeout 60s;
    }"
  else
    ptero_backend_block="    location / {
        proxy_pass http://sparrowx:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }"
  fi

  cat > "${INSTALL_DIR}/ovh/nginx.conf" <<EOF
# ==============================================================================
# SPARROWX MULTI-DOMAIN EDGE PROXY (ROOT + DB + SHIELD + FILE + KEYS + API + GAME)
# ==============================================================================

# 1. Master Portal & Fallback Default (${DOMAIN_ROOT})
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    server_name ${DOMAIN_ROOT} www.${DOMAIN_ROOT} _;
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 100M;
    server_tokens off;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

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

# 2. Dedicated Database Studio Domain (${DOMAIN_STUDIO})
server {
    listen 80;
    listen 443 ssl;
    server_name ${DOMAIN_STUDIO} studio.${DOMAIN_ROOT};
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 100M;
    server_tokens off;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

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
        proxy_set_header X-SparrowX-Studio "1";
    }
}

# 3. Standalone Product Subdomains (Drop, Keys, Shield, API)
server {
    listen 80;
    listen 443 ssl;
    server_name ${DOMAIN_FILE} drop.${DOMAIN_ROOT} ${DOMAIN_PASSWORD} passwd.${DOMAIN_ROOT} keys.${DOMAIN_ROOT} ${DOMAIN_SEC} shield.${DOMAIN_ROOT} ${DOMAIN_API} rest.${DOMAIN_ROOT};
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 100M;
    server_tokens off;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

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

# 4. Pterodactyl Game Panel (${DOMAIN_GAME}) -> Host Nginx Port ${ptero_p}
server {
    listen 80;
    listen 443 ssl;
    server_name ${DOMAIN_GAME} panel.${DOMAIN_ROOT};
    ssl_certificate ${ptero_ssl_cert};
    ssl_certificate_key ${ptero_ssl_key};
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 100M;
    server_tokens off;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        allow all;
    }

${ptero_backend_block}
}

# 5. Game Hosting Storefront (${DOMAIN_GAME_WEB})
server {
    listen 80;
    listen 443 ssl;
    server_name ${DOMAIN_GAME_WEB};
    ssl_certificate ${game_web_ssl_cert};
    ssl_certificate_key ${game_web_ssl_key};
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 150M;
    server_tokens off;
    resolver 127.0.0.11 valid=5s ipv6=off;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
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

# 6. Game Client Dashboard (${DOMAIN_GAME_DASH})
server {
    listen 80;
    listen 443 ssl;
    server_name ${DOMAIN_GAME_DASH};
    ssl_certificate ${game_dash_ssl_cert};
    ssl_certificate_key ${game_dash_ssl_key};
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 150M;
    server_tokens off;
    resolver 127.0.0.11 valid=5s ipv6=off;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
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

# 7. Game DDoS Defense (${gamesec_domain})
server {
    listen 80;
    listen 443 ssl;
    server_name ${gamesec_domain};
    ssl_certificate ${gamesec_ssl_cert};
    ssl_certificate_key ${gamesec_ssl_key};
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 50M;
    server_tokens off;
    resolver 127.0.0.11 valid=5s ipv6=off;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

${gamesec_backend_block}
}

# 8. Network DDoS Dashboard (${netsec_domain})
server {
    listen 80;
    listen 443 ssl;
    server_name ${netsec_domain};
    ssl_certificate ${netsec_ssl_cert};
    ssl_certificate_key ${netsec_ssl_key};
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 50M;
    server_tokens off;
    resolver 127.0.0.11 valid=5s ipv6=off;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        allow all;
    }

${netsec_backend_block}
}
EOF
}

heal_pterodactyl_host_nginx() {
  if ! is_pterodactyl_installed; then
    return 0
  fi

  local ptero_dir="/var/www/pterodactyl"
  local ptero_p="${PTERO_PORT:-8090}"
  local php_sock=""
  local php_bin=""

  # Ensure core Pterodactyl services & PHP-FPM are running cleanly
  for dep_svc in mariadb mysql redis-server pteroq; do
    if systemctl list-unit-files "${dep_svc}.service" >/dev/null 2>&1; then
      systemctl enable --now "${dep_svc}" >/dev/null 2>&1 || true
    fi
  done
  for fpm_svc in php8.4-fpm php8.3-fpm php8.2-fpm php8.1-fpm php8.0-fpm; do
    if systemctl list-unit-files 2>/dev/null | grep -q "^${fpm_svc}.service"; then
      systemctl enable "${fpm_svc}" >/dev/null 2>&1 || true
      systemctl start "${fpm_svc}" >/dev/null 2>&1 || true
    fi
  done
  if systemctl list-unit-files wings.service >/dev/null 2>&1 && [ -f /etc/pterodactyl/config.yml ]; then
    systemctl enable --now wings >/dev/null 2>&1 || true
  fi
  php_sock="$(detect_php_fpm_sock)"
  php_bin="$(command -v php8.4 || command -v php8.3 || command -v php8.2 || command -v php8.1 || command -v php || true)"

  # Sync MariaDB/MySQL database/user credentials, admin account & Pterodactyl .env
  init_ptero_credentials
  local db_cli=""
  if command -v mariadb >/dev/null 2>&1; then
    db_cli="mariadb"
  elif command -v mysql >/dev/null 2>&1; then
    db_cli="mysql"
  fi
  if [ -n "${db_cli}" ] && [ -n "${PTERO_DB_PASSWORD:-}" ]; then
    "${db_cli}" -u root -e "
      CREATE DATABASE IF NOT EXISTS \`${PTERO_DB_NAME}\`;
      CREATE USER IF NOT EXISTS '${PTERO_DB_USER}'@'127.0.0.1' IDENTIFIED BY '${PTERO_DB_PASSWORD}';
      ALTER USER '${PTERO_DB_USER}'@'127.0.0.1' IDENTIFIED BY '${PTERO_DB_PASSWORD}';
      CREATE USER IF NOT EXISTS '${PTERO_DB_USER}'@'localhost' IDENTIFIED BY '${PTERO_DB_PASSWORD}';
      ALTER USER '${PTERO_DB_USER}'@'localhost' IDENTIFIED BY '${PTERO_DB_PASSWORD}';
      GRANT ALL PRIVILEGES ON \`${PTERO_DB_NAME}\`.* TO '${PTERO_DB_USER}'@'127.0.0.1' WITH GRANT OPTION;
      GRANT ALL PRIVILEGES ON \`${PTERO_DB_NAME}\`.* TO '${PTERO_DB_USER}'@'localhost' WITH GRANT OPTION;
      FLUSH PRIVILEGES;
    " >/dev/null 2>&1 || true
  fi

  if [ ! -f "${ptero_dir}/.env" ] && [ -f "${ptero_dir}/.env.example" ]; then
    cp "${ptero_dir}/.env.example" "${ptero_dir}/.env"
  fi
  if [ -f "${ptero_dir}/.env" ]; then
    set_ptero_env_key "APP_URL" "https://${DOMAIN_GAME}"
    set_ptero_env_key "APP_ENVIRONMENT_ONLY" "false"
    set_ptero_env_key "TRUSTED_PROXIES" "*"
    set_ptero_env_key "RECAPTCHA_ENABLED" "false"
    set_ptero_env_key "SESSION_SECURE_COOKIE" "true"
    set_ptero_env_key "DB_HOST" "127.0.0.1"
    set_ptero_env_key "DB_PORT" "3306"
    set_ptero_env_key "DB_DATABASE" "${PTERO_DB_NAME}"
    set_ptero_env_key "DB_USERNAME" "${PTERO_DB_USER}"
    set_ptero_env_key "DB_PASSWORD" "${PTERO_DB_PASSWORD}"

    local existing_salt=""
    existing_salt="$(awk -F= '/^HASHIDS_SALT=/{sub(/^[^=]*=/,""); print; exit}' "${ptero_dir}/.env" 2>/dev/null | tr -d "\"'\r" || true)"
    if [ -z "${existing_salt}" ]; then
      set_ptero_env_key "HASHIDS_SALT" "$(openssl rand -hex 10 2>/dev/null || echo 'spx_hashids_salt_2026')"
    fi
    set_ptero_env_key "HASHIDS_LENGTH" "8"
    if [ -n "${PTERO_SSO_SECRET:-}" ]; then
      set_ptero_env_key "SPARROWX_SSO_SECRET" "${PTERO_SSO_SECRET}"
    fi

    local redis_ready="false"
    if command -v redis-cli >/dev/null 2>&1 && redis-cli -h 127.0.0.1 -p 6379 ping 2>/dev/null | grep -qi "PONG"; then
      if [ -n "${php_bin}" ] && "${php_bin}" -m 2>/dev/null | grep -qi "^redis$"; then
        redis_ready="true"
      fi
    fi
    if [ "${redis_ready}" = "true" ]; then
      set_ptero_env_key "REDIS_HOST" "127.0.0.1"
      set_ptero_env_key "REDIS_PORT" "6379"
    else
      set_ptero_env_key "CACHE_DRIVER" "file"
      set_ptero_env_key "SESSION_DRIVER" "file"
      set_ptero_env_key "QUEUE_CONNECTION" "sync"
    fi
  fi

  if [ -n "${php_bin}" ] && [ -f "${ptero_dir}/artisan" ]; then
    if ! grep -q '^APP_KEY=base64:' "${ptero_dir}/.env" 2>/dev/null; then
      (cd "${ptero_dir}" && "${php_bin}" artisan key:generate --force --no-interaction >/dev/null 2>&1 || true)
    fi
    (cd "${ptero_dir}" && "${php_bin}" artisan migrate --seed --force --no-interaction >/dev/null 2>&1 || true)

    if [ -n "${db_cli}" ]; then
      local admin_count="0"
      admin_count="$("${db_cli}" -Nse "SELECT COUNT(*) FROM \`${PTERO_DB_NAME}\`.users WHERE root_admin=1;" 2>/dev/null || echo "0")"
      if [ "${admin_count:-0}" -eq 0 ] 2>/dev/null; then
        (cd "${ptero_dir}" && "${php_bin}" artisan p:user:make --no-interaction \
          --email="${PTERO_ADMIN_EMAIL}" \
          --username="${PTERO_ADMIN_USER}" \
          --name-first="${PTERO_ADMIN_FIRSTNAME}" \
          --name-last="${PTERO_ADMIN_LASTNAME}" \
          --password="${PTERO_ADMIN_PASSWORD}" \
          --admin=1 >/dev/null 2>&1 || true)
      else
        local existing_admin_row=""
        existing_admin_row="$("${db_cli}" -Nse "SELECT username, email FROM \`${PTERO_DB_NAME}\`.users WHERE root_admin=1 ORDER BY id ASC LIMIT 1;" 2>/dev/null || true)"
        if [ -n "${existing_admin_row}" ]; then
          PTERO_ADMIN_USER="$(echo "${existing_admin_row}" | awk '{print $1}')"
          PTERO_ADMIN_EMAIL="$(echo "${existing_admin_row}" | awk '{print $2}')"
          export PTERO_ADMIN_USER PTERO_ADMIN_EMAIL
        fi
      fi

      local has_root_user="0"
      has_root_user="$("${db_cli}" -Nse "SELECT COUNT(*) FROM \`${PTERO_DB_NAME}\`.users WHERE username='root';" 2>/dev/null || echo "0")"
      if [ "${has_root_user:-0}" -eq 0 ] 2>/dev/null; then
        (cd "${ptero_dir}" && "${php_bin}" artisan p:user:make --no-interaction \
          --email="root@${DOMAIN_ROOT:-sparrowx.net}" \
          --username="root" \
          --name-first="Root" \
          --name-last="Admin" \
          --password="${PTERO_ADMIN_PASSWORD}" \
          --admin=1 >/dev/null 2>&1 || true)
      fi

      if [ "${RESET_PTERO_ADMIN_PASS:-false}" = "true" ] && [ -n "${PTERO_ADMIN_PASSWORD:-}" ]; then
        local bcrypt_pw=""
        bcrypt_pw="$(SPX_PASS="${PTERO_ADMIN_PASSWORD}" "${php_bin}" -r 'echo password_hash(getenv("SPX_PASS"), PASSWORD_BCRYPT);' 2>/dev/null || true)"
        if [ -n "${bcrypt_pw}" ]; then
          "${db_cli}" -u root -e "UPDATE \`${PTERO_DB_NAME}\`.users SET password='${bcrypt_pw}', root_admin=1 WHERE username IN ('${PTERO_ADMIN_USER}', 'admin', 'root') OR root_admin=1;" >/dev/null 2>&1 || true
        fi
      fi
    fi

    (cd "${ptero_dir}" && "${php_bin}" artisan config:clear >/dev/null 2>&1 || true)
    (cd "${ptero_dir}" && "${php_bin}" artisan cache:clear >/dev/null 2>&1 || true)
    (cd "${ptero_dir}" && "${php_bin}" artisan view:clear >/dev/null 2>&1 || true)
    (cd "${ptero_dir}" && "${php_bin}" artisan route:clear >/dev/null 2>&1 || true)
    (cd "${ptero_dir}" && "${php_bin}" artisan queue:restart >/dev/null 2>&1 || true)
  fi

  mkdir -p "${ptero_dir}/storage/logs" "${ptero_dir}/storage/framework/sessions" "${ptero_dir}/storage/framework/views" "${ptero_dir}/storage/framework/cache/data" "${ptero_dir}/bootstrap/cache" "${ptero_dir}/public"
  if [ -f "${INSTALL_DIR}/ovh/sparrowx-sso.php" ]; then
    cp -f "${INSTALL_DIR}/ovh/sparrowx-sso.php" "${ptero_dir}/public/sparrowx-sso.php" 2>/dev/null || true
    chmod 644 "${ptero_dir}/public/sparrowx-sso.php" 2>/dev/null || true
  fi
  if id -u www-data >/dev/null 2>&1; then
    chown -R www-data:www-data "${ptero_dir}" 2>/dev/null || true
  fi
  chmod -R 775 "${ptero_dir}/storage" "${ptero_dir}/bootstrap/cache" 2>/dev/null || true
  chmod 640 "${ptero_dir}/.env" 2>/dev/null || true
  write_ptero_credentials_file

  # Remove default or any host nginx sites claiming ports 80 / 443
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  mkdir -p /etc/nginx/sparrowx-disabled /etc/nginx/sites-available /etc/nginx/sites-enabled 2>/dev/null || true
  for ncfg in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
    [ -e "${ncfg}" ] || continue
    [ "$(basename "${ncfg}")" = "pterodactyl.conf" ] && continue
    if grep -qE "listen[[:space:]]+([^;]*:)?(80|443)([[:space:];]|$)" "${ncfg}" 2>/dev/null; then
      mv -f "${ncfg}" /etc/nginx/sparrowx-disabled/ 2>/dev/null || rm -f "${ncfg}" 2>/dev/null || true
      log_warn "Moved conflicting host nginx config $(basename "${ncfg}") out of ports 80/443."
    fi
  done

  mkdir -p "${INSTALL_DIR}/ovh/certbot-www/.well-known/acme-challenge" 2>/dev/null || true
  cat > /etc/nginx/sites-available/pterodactyl.conf <<EOF
server {
    listen ${ptero_p} default_server;
    listen [::]:${ptero_p} default_server;
    server_name ${DOMAIN_GAME} panel.${DOMAIN_ROOT} _;

    root /var/www/pterodactyl/public;
    index index.php;

    access_log /var/log/nginx/pterodactyl.app-access.log;
    error_log  /var/log/nginx/pterodactyl.app-error.log error;

    client_max_body_size 100m;
    client_body_timeout 120s;
    sendfile off;

    location ^~ /.well-known/acme-challenge/ {
        root ${INSTALL_DIR}/ovh/certbot-www;
        default_type "text/plain";
        allow all;
    }

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \.php\$ {
        fastcgi_split_path_info ^(.+\.php)(/.+)\$;
        fastcgi_pass unix:${php_sock};
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param PHP_VALUE "upload_max_filesize = 100M \n post_max_size=100M";
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        fastcgi_param HTTP_PROXY "";
        fastcgi_param HTTPS on;
        fastcgi_param HTTP_X_FORWARDED_PROTO https;
        fastcgi_intercept_errors off;
        fastcgi_buffer_size 16k;
        fastcgi_buffers 4 16k;
        fastcgi_connect_timeout 300;
        fastcgi_send_timeout 300;
        fastcgi_read_timeout 300;
    }

    location ~ /\.ht {
        deny all;
    }
}
EOF
  ln -sfn /etc/nginx/sites-available/pterodactyl.conf /etc/nginx/sites-enabled/pterodactyl.conf 2>/dev/null || true

  if [ -s "/etc/letsencrypt/live/${DOMAIN_GAME}/fullchain.pem" ] && [ -s "/etc/letsencrypt/live/${DOMAIN_GAME}/privkey.pem" ]; then
    mkdir -p "${INSTALL_DIR}/ovh/ssl" /etc/ssl
    cp -fL "/etc/letsencrypt/live/${DOMAIN_GAME}/fullchain.pem" "${INSTALL_DIR}/ovh/ssl/ptero-fullchain.pem" 2>/dev/null || true
    cp -fL "/etc/letsencrypt/live/${DOMAIN_GAME}/privkey.pem" "${INSTALL_DIR}/ovh/ssl/ptero-privkey.pem" 2>/dev/null || true
    ln -sf "/etc/letsencrypt/live/${DOMAIN_GAME}/fullchain.pem" "/etc/ssl/${DOMAIN_GAME}.pem" 2>/dev/null || true
    ln -sf "/etc/letsencrypt/live/${DOMAIN_GAME}/privkey.pem" "/etc/ssl/${DOMAIN_GAME}.key" 2>/dev/null || true
  fi

  if command -v nginx >/dev/null 2>&1; then
    nginx -t >/dev/null 2>&1 || true
    systemctl unmask nginx >/dev/null 2>&1 || true
    systemctl enable nginx >/dev/null 2>&1 || true
    systemctl restart nginx >/dev/null 2>&1 || systemctl reload nginx >/dev/null 2>&1 || true
  fi

  # Live Laravel /sanctum/csrf-cookie + POST /auth/login verification (falls back to file cache/session if Redis throws 500)
  local csrf_code="000" login_probe_code="000" raw_xsrf="" xsrf_tok="" ptero_cj=""
  ptero_cj="$(mktemp)"
  csrf_code="$(curl -s -c "${ptero_cj}" -o /dev/null -w "%{http_code}" --max-time 5 -H "Host: ${DOMAIN_GAME}" -H "X-Forwarded-Proto: https" "http://127.0.0.1:${ptero_p}/sanctum/csrf-cookie" 2>/dev/null || echo "000")"
  if echo "${csrf_code}" | grep -qE "^(200|204)$"; then
    raw_xsrf="$(awk '$6=="XSRF-TOKEN"{print $7; exit}' "${ptero_cj}" 2>/dev/null || true)"
    if [ -n "${raw_xsrf}" ] && [ -n "${php_bin}" ]; then
      xsrf_tok="$("${php_bin}" -r 'echo urldecode($argv[1] ?? "");' "${raw_xsrf}" 2>/dev/null || echo "${raw_xsrf}")"
    else
      xsrf_tok="${raw_xsrf}"
    fi
    if [ -n "${xsrf_tok}" ]; then
      login_probe_code="$(curl -s -b "${ptero_cj}" -o /dev/null -w "%{http_code}" --max-time 5 -X POST -H "Host: ${DOMAIN_GAME}" -H "X-Forwarded-Proto: https" -H "Accept: application/json" -H "Content-Type: application/json" -H "X-XSRF-TOKEN: ${xsrf_tok}" -d '{"user":"__probe__","password":"__probe__"}' "http://127.0.0.1:${ptero_p}/auth/login" 2>/dev/null || echo "000")"
    fi
  fi
  rm -f "${ptero_cj}"
  if ! echo "${csrf_code}" | grep -qE "^(200|204)$" || [ "${login_probe_code}" = "500" ]; then
    log_warn "Pterodactyl auth probe returned CSRF:${csrf_code} / LOGIN:${login_probe_code}; switching session & cache drivers to file driver"
    if [ -f "${ptero_dir}/.env" ]; then
      set_ptero_env_key "CACHE_DRIVER" "file"
      set_ptero_env_key "SESSION_DRIVER" "file"
      set_ptero_env_key "QUEUE_CONNECTION" "sync"
    fi
    if [ -n "${php_bin}" ] && [ -f "${ptero_dir}/artisan" ]; then
      (cd "${ptero_dir}" && "${php_bin}" artisan config:clear >/dev/null 2>&1 || true)
      (cd "${ptero_dir}" && "${php_bin}" artisan cache:clear >/dev/null 2>&1 || true)
    fi
    if id -u www-data >/dev/null 2>&1; then
      chown -R www-data:www-data "${ptero_dir}" 2>/dev/null || true
    fi
    chmod -R 775 "${ptero_dir}/storage" "${ptero_dir}/bootstrap/cache" 2>/dev/null || true
    chmod 640 "${ptero_dir}/.env" 2>/dev/null || true
  fi
  open_ptero_ufw_rules
  log_ok "Host Pterodactyl Nginx shifted cleanly onto port ${ptero_p} (PHP-FPM: ${php_sock})."
}

issue_le_cert_to_ovh_ssl() {
  local target_domain="$1"
  local cert_prefix="$2"
  local root_domain="${DOMAIN_ROOT:-${SPARROWX_DOMAIN:-sparrowx.local}}"
  local webroot="${INSTALL_DIR}/ovh/certbot-www"
  local ssl_dir="${INSTALL_DIR}/ovh/ssl"
  local live_dir="/etc/letsencrypt/live/${target_domain}"
  local ssl_email="${PTERO_ADMIN_EMAIL:-${SPARROWX_ADMIN_EMAIL:-admin@${root_domain}}}"

  if [ -z "${target_domain}" ] || [[ "${target_domain}" == *.local ]] || [ "${target_domain}" = "localhost" ]; then
    return 0
  fi

  if [ -z "${ssl_email}" ] || [[ "${ssl_email}" == *.local ]]; then
    ssl_email="admin@${root_domain}"
  fi

  if [ ! -s "${live_dir}/fullchain.pem" ] || [ ! -s "${live_dir}/privkey.pem" ]; then
    log_info "Requesting Let's Encrypt SSL for ${target_domain} via HTTP-01 port 80..."

    if certbot certonly \
      --webroot -w "${webroot}" \
      --non-interactive --agree-tos \
      -m "${ssl_email}" \
      --cert-name "${target_domain}" \
      -d "${target_domain}" >/dev/null 2>&1; then
      log_ok "Issued Let's Encrypt SSL for ${target_domain} via port 80 webroot"
    else
      log_warn "Webroot challenge deferred; retrying ${target_domain} via standalone port 80 listener..."
      docker stop sparrowx-nginx >/dev/null 2>&1 || true
      systemctl stop nginx >/dev/null 2>&1 || true
      if command -v fuser >/dev/null 2>&1; then
        fuser -k 80/tcp >/dev/null 2>&1 || true
      fi
      sleep 1

      if certbot certonly \
        --standalone --preferred-challenges http \
        --non-interactive --agree-tos \
        -m "${ssl_email}" \
        --cert-name "${target_domain}" \
        -d "${target_domain}" >/dev/null 2>&1; then
        log_ok "Issued Let's Encrypt SSL for ${target_domain} via standalone port 80 challenge"
      else
        log_warn "Let's Encrypt HTTP-01 challenge failed for ${target_domain} (verify DNS A record & external port 80)"
      fi

      if is_pterodactyl_installed; then
        systemctl start nginx >/dev/null 2>&1 || true
      fi
      docker start sparrowx-nginx >/dev/null 2>&1 || compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps nginx >/dev/null 2>&1 || true
    fi
  else
    certbot certonly \
      --webroot -w "${webroot}" \
      --non-interactive --agree-tos --keep-until-expiring \
      -m "${ssl_email}" \
      --cert-name "${target_domain}" \
      -d "${target_domain}" >/dev/null 2>&1 || true
  fi

  if [ -s "${live_dir}/fullchain.pem" ] && [ -s "${live_dir}/privkey.pem" ]; then
    cp -fL "${live_dir}/fullchain.pem" "${ssl_dir}/${cert_prefix}-fullchain.pem" 2>/dev/null || true
    cp -fL "${live_dir}/privkey.pem" "${ssl_dir}/${cert_prefix}-privkey.pem" 2>/dev/null || true
    chmod 644 "${ssl_dir}/${cert_prefix}-fullchain.pem" 2>/dev/null || true
    chmod 600 "${ssl_dir}/${cert_prefix}-privkey.pem" 2>/dev/null || true
    ln -sf "${live_dir}/fullchain.pem" "/etc/ssl/${target_domain}.pem" 2>/dev/null || true
    ln -sf "${live_dir}/privkey.pem" "/etc/ssl/${target_domain}.key" 2>/dev/null || true
    log_ok "Live Let's Encrypt SSL wired for https://${target_domain}"
  fi
}

ensure_game_letsencrypt_ssl() {
  local root_domain="${DOMAIN_ROOT:-${SPARROWX_DOMAIN:-sparrowx.local}}"
  local game_panel_domain="${DOMAIN_GAME:-game.panel.${root_domain}}"
  local game_web_domain="${DOMAIN_GAME_WEB:-game.${root_domain}}"
  local game_dash_domain="${DOMAIN_GAME_DASH:-game.dash.${root_domain}}"
  local gamesec_domain="${DOMAIN_GAMESEC:-gamesec.${root_domain}}"
  local netsec_domain="${DOMAIN_NETSEC:-netsec.${root_domain}}"
  local webroot="${INSTALL_DIR}/ovh/certbot-www"
  local ssl_dir="${INSTALL_DIR}/ovh/ssl"

  mkdir -p "${webroot}/.well-known/acme-challenge" "${ssl_dir}" /etc/ssl

  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi "Status: active"; then
    ufw allow 80/tcp >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
  fi

  if ! command -v certbot >/dev/null 2>&1; then
    retry_pkg_install certbot
  fi

  if ! command -v certbot >/dev/null 2>&1; then
    log_warn "Certbot unavailable; skipping Let's Encrypt issuance for game domains"
    return 0
  fi

  if is_pterodactyl_installed; then
    issue_le_cert_to_ovh_ssl "${game_panel_domain}" "ptero"
  fi
  issue_le_cert_to_ovh_ssl "${game_web_domain}" "game-web"
  issue_le_cert_to_ovh_ssl "${game_dash_domain}" "game-dash"
  issue_le_cert_to_ovh_ssl "${gamesec_domain}" "gamesec"
  issue_le_cert_to_ovh_ssl "${netsec_domain}" "netsec"
  render_sparrowx_nginx_conf
  docker restart sparrowx-nginx >/dev/null 2>&1 || docker exec sparrowx-nginx nginx -s reload >/dev/null 2>&1 || true
}

ensure_gamesec_landing_running() {
  local gamesec_domain="${DOMAIN_GAMESEC:-gamesec.${DOMAIN_ROOT:-${SPARROWX_DOMAIN:-sparrowx.local}}}"
  local netsec_domain="${DOMAIN_NETSEC:-netsec.${DOMAIN_ROOT:-${SPARROWX_DOMAIN:-sparrowx.local}}}"
  local gamesec_dir="${GAMESEC_DIR:-/opt/sparrowx-gamesec}"
  local gamesec_repo="${GAMESEC_REPO_URL:-https://github.com/cybersync-fxfx/sbs-detrion-landing.git}"
  local gamesec_p="${GAMESEC_PORT:-3005}"

  if [ -n "${GAMESEC_UPSTREAM_URL:-}" ]; then
    log_ok "Game DDoS Defense (${gamesec_domain}) configured for external upstream ${GAMESEC_UPSTREAM_URL}."
    return 0
  fi

  if ! command -v git >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then
    retry_pkg_install git
  fi
  if ! command -v git >/dev/null 2>&1; then
    log_warn "git unavailable; skipping ${gamesec_domain} source deployment."
    return 1
  fi

  mkdir -p "$(dirname "${gamesec_dir}")" 2>/dev/null || true
  if [ ! -d "${gamesec_dir}/.git" ]; then
    if [ -d "${gamesec_dir}" ] && [ ! -f "${gamesec_dir}/package.json" ]; then
      rm -rf "${gamesec_dir}" 2>/dev/null || true
    fi
    if [ ! -d "${gamesec_dir}" ]; then
      log_info "Cloning Game DDoS Defense portal (${gamesec_repo}) -> ${gamesec_dir}..."
      git clone --depth 1 "${gamesec_repo}" "${gamesec_dir}" >/dev/null 2>&1 || \
        log_warn "Failed to clone ${gamesec_repo}; preserving any existing ${gamesec_dir} bundle."
    fi
  else
    git config --global --add safe.directory "${gamesec_dir}" >/dev/null 2>&1 || true
    git -C "${gamesec_dir}" checkout -- vite.config.ts package-lock.json src >/dev/null 2>&1 || true
    git -C "${gamesec_dir}" pull --ff-only >/dev/null 2>&1 || true
  fi

  if [ ! -f "${gamesec_dir}/package.json" ]; then
    log_warn "Missing ${gamesec_dir}/package.json; cannot build ${gamesec_domain} portal."
    return 1
  fi

  local cur_rev="" built_rev="" build_stamp="" need_build="no"
  cur_rev="$(git -C "${gamesec_dir}" rev-parse HEAD 2>/dev/null || echo 'local')"
  build_stamp="${cur_rev}:${netsec_domain}"
  [ -f "${gamesec_dir}/.sparrowx-built-rev" ] && built_rev="$(cat "${gamesec_dir}/.sparrowx-built-rev" 2>/dev/null | tr -d '[:space:]' || true)"
  if [ ! -s "${gamesec_dir}/.output/server/index.mjs" ] || [ "${build_stamp}" != "${built_rev}" ] || [ "${GAMESEC_REBUILD:-0}" = "1" ] || grep -rq 'sparrowx\.sbs' "${gamesec_dir}/.output" 2>/dev/null; then
    need_build="yes"
  fi

  local docker_ok="no"
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    docker_ok="yes"
  fi

  if [ "${need_build}" = "yes" ]; then
    log_info "Building ${gamesec_domain} (sbs-detrion-landing) with Nitro node-server preset..."
    if [ -f "${gamesec_dir}/vite.config.ts" ]; then
      cp -f "${gamesec_dir}/vite.config.ts" "${gamesec_dir}/.vite.config.ts.bak" 2>/dev/null || true
      sed -i -E 's/preset:[[:space:]]*["'\'']vercel["'\'']/preset: "node-server"/g' "${gamesec_dir}/vite.config.ts"
    fi
    if [ -d "${gamesec_dir}/src" ]; then
      find "${gamesec_dir}/src" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) -exec sed -i -E "s|https?://sparrowx\.sbs|https://${netsec_domain}|g" {} + 2>/dev/null || true
    fi

    local build_rc=1
    if [ "${docker_ok}" = "yes" ]; then
      if docker run --rm \
        -e NODE_OPTIONS="--max-old-space-size=1536" \
        -v "${gamesec_dir}:/app" -w /app \
        node:22-slim sh -c 'npm install --legacy-peer-deps --no-audit --no-fund && npm run build' >/dev/null 2>&1; then
        build_rc=0
      fi
    fi

    if [ "${build_rc}" -ne 0 ]; then
      if { ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ] || ! command -v npm >/dev/null 2>&1; } && command -v apt-get >/dev/null 2>&1; then
        curl -fsSL https://deb.nodesource.com/setup_22.x 2>/dev/null | bash - >/dev/null 2>&1 || true
        retry_pkg_install nodejs
      fi
      if command -v npm >/dev/null 2>&1; then
        (cd "${gamesec_dir}" && NODE_OPTIONS="--max-old-space-size=1536" npm install --legacy-peer-deps --no-audit --no-fund && npm run build) >/dev/null 2>&1 && build_rc=0 || true
      fi
    fi

    if [ -f "${gamesec_dir}/.vite.config.ts.bak" ]; then
      mv -f "${gamesec_dir}/.vite.config.ts.bak" "${gamesec_dir}/vite.config.ts" 2>/dev/null || true
    elif [ -d "${gamesec_dir}/.git" ]; then
      git -C "${gamesec_dir}" checkout -- vite.config.ts >/dev/null 2>&1 || true
    fi
    if [ -d "${gamesec_dir}/.git" ]; then
      git -C "${gamesec_dir}" checkout -- src >/dev/null 2>&1 || true
    fi

    if [ "${build_rc}" -eq 0 ] && [ -s "${gamesec_dir}/.output/server/index.mjs" ]; then
      echo "${build_stamp}" > "${gamesec_dir}/.sparrowx-built-rev"
      log_ok "Built ${gamesec_domain} Nitro server bundle (.output/server/index.mjs)."
    else
      log_warn "Build failed for ${gamesec_dir}; preserving previous build if present."
      [ -s "${gamesec_dir}/.output/server/index.mjs" ] || return 1
    fi
  fi

  local env_args=()
  [ -s "${gamesec_dir}/.env" ] && env_args=(--env-file "${gamesec_dir}/.env")

  local edge_net="sparrowx_net"
  if [ "${docker_ok}" = "yes" ] && docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-nginx"; then
    local detected_net=""
    detected_net="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{println $k}}{{end}}' sparrowx-nginx 2>/dev/null | awk 'NF {print; exit}' || true)"
    [ -n "${detected_net}" ] && edge_net="${detected_net}"
  fi

  local gamesec_started="no"
  if [ "${docker_ok}" = "yes" ]; then
    if [ "${need_build}" != "yes" ] && \
       docker ps --filter status=running --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-gamesec" && \
       docker inspect -f '{{json .NetworkSettings.Networks}}' sparrowx-gamesec 2>/dev/null | grep -q "\"${edge_net}\"" && \
       curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:${gamesec_p}/" 2>/dev/null; then
      gamesec_started="yes"
      log_ok "Game DDoS Defense (${gamesec_domain}) container sparrowx-gamesec already healthy on :${gamesec_p}."
    else
      docker network create "${edge_net}" >/dev/null 2>&1 || true
      docker rm -f sparrowx-gamesec >/dev/null 2>&1 || true
      free_docker_port_conflicts "${gamesec_p}" "sparrowx-gamesec"
      systemctl stop sparrowx-gamesec.service >/dev/null 2>&1 || true
      if docker run -d --name sparrowx-gamesec --restart unless-stopped \
        --network "${edge_net}" --network-alias sparrowx-gamesec \
        -p "127.0.0.1:${gamesec_p}:3000" \
        -e NODE_ENV=production -e HOST=0.0.0.0 -e PORT=3000 -e NITRO_HOST=0.0.0.0 -e NITRO_PORT=3000 \
        "${env_args[@]}" \
        -v "${gamesec_dir}:/app" -w /app \
        node:22-slim node .output/server/index.mjs >/dev/null 2>&1; then
        sleep 2
        if docker ps --filter status=running --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-gamesec"; then
          gamesec_started="yes"
          log_ok "Game DDoS Defense (${gamesec_domain}) container live on ${edge_net} & :${gamesec_p}"
        fi
      fi
    fi
  fi

  if [ "${gamesec_started}" != "yes" ]; then
    if { ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]; } && command -v apt-get >/dev/null 2>&1; then
      curl -fsSL https://deb.nodesource.com/setup_22.x 2>/dev/null | bash - >/dev/null 2>&1 || true
      retry_pkg_install nodejs
    fi
    local node_bin=""
    node_bin="$(command -v node || echo /usr/bin/node)"
    if [ -x "${node_bin}" ] && [ -s "${gamesec_dir}/.output/server/index.mjs" ]; then
      if [ -d /etc/systemd/system ] && command -v systemctl >/dev/null 2>&1; then
        cat > /etc/systemd/system/sparrowx-gamesec.service <<EOF_GAMESEC
[Unit]
Description=SparrowX Game DDoS Defense Portal (${gamesec_domain})
After=network.target

[Service]
Type=simple
WorkingDirectory=${gamesec_dir}
EnvironmentFile=-${gamesec_dir}/.env
Environment=NODE_ENV=production
Environment=HOST=0.0.0.0
Environment=PORT=${gamesec_p}
Environment=NITRO_HOST=0.0.0.0
Environment=NITRO_PORT=${gamesec_p}
ExecStart=${node_bin} ${gamesec_dir}/.output/server/index.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF_GAMESEC
        systemctl daemon-reload >/dev/null 2>&1 || true
        systemctl enable --now sparrowx-gamesec.service >/dev/null 2>&1 || systemctl restart sparrowx-gamesec.service >/dev/null 2>&1 || true
        gamesec_started="yes"
        log_ok "Game DDoS Defense (${gamesec_domain}) systemd service live on :${gamesec_p}"
      fi
    fi
  fi
}

upsert_env_kv_file() {
  local env_file="$1"
  local key="$2"
  local val="$3"
  [ -n "${env_file}" ] || return 1
  touch "${env_file}"
  awk -v k="${key}" -v v="${val}" '
    BEGIN { found=0 }
    index($0, k "=") == 1 { print k "=" v; found=1; next }
    { print }
    END { if (!found) print k "=" v }
  ' "${env_file}" > "${env_file}.tmp" && mv -f "${env_file}.tmp" "${env_file}"
}

ensure_netsec_dashboard_running() {
  local netsec_domain="${DOMAIN_NETSEC:-netsec.${DOMAIN_ROOT:-${SPARROWX_DOMAIN:-sparrowx.local}}}"
  local netsec_dir="${NETSEC_DIR:-/opt/sparrowx-netsec}"
  local netsec_repo="${NETSEC_REPO_URL:-https://github.com/cybersync-fxfx/saprrowx.sbs.git}"
  local netsec_p="${NETSEC_PORT:-3006}"

  if [ -n "${NETSEC_UPSTREAM_URL:-}" ]; then
    log_ok "Network DDoS Dashboard (${netsec_domain}) configured for external upstream ${NETSEC_UPSTREAM_URL}."
    return 0
  fi

  if ! command -v git >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then
    retry_pkg_install git
  fi
  if ! command -v git >/dev/null 2>&1; then
    log_warn "git unavailable; skipping ${netsec_domain} source deployment."
    return 1
  fi

  mkdir -p "$(dirname "${netsec_dir}")" 2>/dev/null || true
  if [ ! -d "${netsec_dir}/.git" ]; then
    if [ -d "${netsec_dir}" ] && [ ! -f "${netsec_dir}/package.json" ]; then
      rm -rf "${netsec_dir}" 2>/dev/null || true
    fi
    if [ ! -d "${netsec_dir}" ]; then
      log_info "Cloning Network DDoS Dashboard (${netsec_repo}) -> ${netsec_dir}..."
      git clone --depth 1 "${netsec_repo}" "${netsec_dir}" >/dev/null 2>&1 || \
        log_warn "Failed to clone ${netsec_repo}; preserving any existing ${netsec_dir} bundle."
    fi
  else
    git config --global --add safe.directory "${netsec_dir}" >/dev/null 2>&1 || true
    git -C "${netsec_dir}" checkout -- package-lock.json frontend/package-lock.json frontend/dist node_modules/.package-lock.json >/dev/null 2>&1 || true
    git -C "${netsec_dir}" clean -fd frontend/dist >/dev/null 2>&1 || true
    git -C "${netsec_dir}" pull --ff-only >/dev/null 2>&1 || { git -C "${netsec_dir}" fetch origin --depth 1 >/dev/null 2>&1 && git -C "${netsec_dir}" reset --hard origin/main >/dev/null 2>&1; } || true
  fi

  if [ ! -f "${netsec_dir}/package.json" ] || [ ! -f "${netsec_dir}/server.js" ]; then
    log_warn "Missing ${netsec_dir}/package.json or server.js; cannot build ${netsec_domain}."
    return 1
  fi
  mkdir -p "${netsec_dir}/storage" 2>/dev/null || true

  local cur_rev="" built_rev="" need_build="no"
  cur_rev="$(git -C "${netsec_dir}" rev-parse HEAD 2>/dev/null || echo 'local')"
  [ -f "${netsec_dir}/.sparrowx-built-rev" ] && built_rev="$(cat "${netsec_dir}/.sparrowx-built-rev" 2>/dev/null | tr -d '[:space:]' || true)"
  if [ ! -s "${netsec_dir}/frontend/dist/index.html" ] || [ ! -f "${netsec_dir}/pg-compat.js" ] || [ ! -d "${netsec_dir}/node_modules/express" ] || [ ! -d "${netsec_dir}/node_modules/bcrypt" ] || [ ! -d "${netsec_dir}/node_modules/pg" ] || [ "${cur_rev}" != "${built_rev}" ] || [ "${NETSEC_REBUILD:-0}" = "1" ]; then
    need_build="yes"
  fi

  local docker_ok="no"
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    docker_ok="yes"
  fi

  if [ "${need_build}" = "yes" ]; then
    log_info "Building ${netsec_domain} (saprrowx.sbs) backend + React frontend..."
    local build_rc=1
    if [ "${docker_ok}" = "yes" ]; then
      if docker run --rm \
        -e NODE_OPTIONS="--max-old-space-size=1536" \
        -v "${netsec_dir}:/app" -w /app \
        node:22-slim sh -c '(npm install --no-audit --no-fund || { apt-get update -qq && apt-get install -y -qq python3 make g++ >/dev/null 2>&1 && npm install --no-audit --no-fund; }) && npm --prefix frontend install --no-audit --no-fund && npm --prefix frontend run build' >/dev/null 2>&1; then
        build_rc=0
      fi
    fi

    if [ "${build_rc}" -ne 0 ]; then
      if { ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ] || ! command -v npm >/dev/null 2>&1; } && command -v apt-get >/dev/null 2>&1; then
        export DEBIAN_FRONTEND=noninteractive
        curl -fsSL https://deb.nodesource.com/setup_22.x 2>/dev/null | bash - >/dev/null 2>&1 || true
        apt-get install -y -qq nodejs npm build-essential >/dev/null 2>&1 || retry_pkg_install nodejs
      fi
      if command -v npm >/dev/null 2>&1; then
        (cd "${netsec_dir}" && NODE_OPTIONS="--max-old-space-size=1536" npm install --no-audit --no-fund && npm --prefix frontend install --no-audit --no-fund && npm --prefix frontend run build) >/dev/null 2>&1 && build_rc=0 || true
      fi
    fi

    if [ "${build_rc}" -eq 0 ] && [ -s "${netsec_dir}/frontend/dist/index.html" ] && [ -d "${netsec_dir}/node_modules/express" ]; then
      echo "${cur_rev}" > "${netsec_dir}/.sparrowx-built-rev"
      log_ok "Built ${netsec_domain} dashboard bundle (server.js + frontend/dist)."
    else
      log_warn "Build failed for ${netsec_dir}; preserving previous build if present."
      if [ ! -s "${netsec_dir}/frontend/dist/index.html" ] || [ ! -d "${netsec_dir}/node_modules/express" ]; then
        return 1
      fi
    fi
  fi

  local netsec_env="${netsec_dir}/.env"
  if [ ! -s "${netsec_env}" ]; then
    if [ -s "/opt/sbs/.env" ]; then
      cp -f "/opt/sbs/.env" "${netsec_env}" 2>/dev/null || true
      log_info "Imported existing /opt/sbs/.env configuration -> ${netsec_env}"
    else
      touch "${netsec_env}"
    fi
  fi

  local ns_url ns_anon ns_svc ns_jwt ns_guard
  ns_url="$(awk -F= '/^SUPABASE_URL=/{sub(/^[^=]*=/,""); print; exit}' "${netsec_env}" 2>/dev/null | tr -d "\"'\r" || true)"
  ns_anon="$(awk -F= '/^SUPABASE_ANON_KEY=/{sub(/^[^=]*=/,""); print; exit}' "${netsec_env}" 2>/dev/null | tr -d "\"'\r" || true)"
  ns_svc="$(awk -F= '/^SUPABASE_SERVICE_KEY=/{sub(/^[^=]*=/,""); print; exit}' "${netsec_env}" 2>/dev/null | tr -d "\"'\r" || true)"
  ns_jwt="$(awk -F= '/^JWT_SECRET=/{sub(/^[^=]*=/,""); print; exit}' "${netsec_env}" 2>/dev/null | tr -d "\"'\r" || true)"
  ns_guard="$(awk -F= '/^GUARD_PUBLIC_IP=/{sub(/^[^=]*=/,""); print; exit}' "${netsec_env}" 2>/dev/null | tr -d "\"'\r" || true)"

  [ -n "${NETSEC_SUPABASE_URL:-}" ] && ns_url="${NETSEC_SUPABASE_URL}"
  [ -n "${NETSEC_SUPABASE_ANON_KEY:-}" ] && ns_anon="${NETSEC_SUPABASE_ANON_KEY}"
  [ -n "${NETSEC_SUPABASE_SERVICE_KEY:-}" ] && ns_svc="${NETSEC_SUPABASE_SERVICE_KEY}"
  [ -n "${NETSEC_JWT_SECRET:-}" ] && ns_jwt="${NETSEC_JWT_SECRET}"
  [ -n "${NETSEC_GUARD_PUBLIC_IP:-}" ] && ns_guard="${NETSEC_GUARD_PUBLIC_IP}"

  if { [ -z "${ns_url}" ] || [ -z "${ns_anon}" ]; } && [ -s "/opt/supabase/.env" ]; then
    local local_anon local_svc
    local_anon="$(awk -F= '/^ANON_KEY=/{sub(/^[^=]*=/,""); print; exit}' /opt/supabase/.env 2>/dev/null | tr -d "\"'\r" || true)"
    local_svc="$(awk -F= '/^SERVICE_ROLE_KEY=/{sub(/^[^=]*=/,""); print; exit}' /opt/supabase/.env 2>/dev/null | tr -d "\"'\r" || true)"
    if [ -n "${local_anon}" ]; then
      if [ "${docker_ok}" = "yes" ]; then
        ns_url="http://host.docker.internal:8000"
      else
        ns_url="http://127.0.0.1:8000"
      fi
      ns_anon="${local_anon}"
      [ -z "${ns_svc}" ] && ns_svc="${local_svc}"
    fi
  fi

  local install_env="${INSTALL_DIR:-/opt/sparrowxdbs}/.env"
  local pg_user="${POSTGRES_USER:-}" pg_pass="${POSTGRES_PASSWORD:-}" pg_db="${POSTGRES_DB:-}" pg_host_port="${PG_HOST_PORT:-}" spx_jwt="${SPARROWX_JWT_SECRET:-}" root_dom="${SPARROWX_DOMAIN:-sparrowx.net}"
  if [ -s "${install_env}" ]; then
    [ -z "${pg_user}" ] && pg_user="$(awk -F= '/^POSTGRES_USER=/{sub(/^[^=]*=/,""); print; exit}' "${install_env}" 2>/dev/null | tr -d "\"'\r" || true)"
    [ -z "${pg_pass}" ] && pg_pass="$(awk -F= '/^POSTGRES_PASSWORD=/{sub(/^[^=]*=/,""); print; exit}' "${install_env}" 2>/dev/null | tr -d "\"'\r" || true)"
    [ -z "${pg_db}" ] && pg_db="$(awk -F= '/^POSTGRES_DB=/{sub(/^[^=]*=/,""); print; exit}' "${install_env}" 2>/dev/null | tr -d "\"'\r" || true)"
    [ -z "${pg_host_port}" ] && pg_host_port="$(awk -F= '/^PG_HOST_PORT=/{sub(/^[^=]*=/,""); print; exit}' "${install_env}" 2>/dev/null | tr -d "\"'\r" || true)"
    [ -z "${spx_jwt}" ] && spx_jwt="$(awk -F= '/^SPARROWX_JWT_SECRET=/{sub(/^[^=]*=/,""); print; exit}' "${install_env}" 2>/dev/null | tr -d "\"'\r" || true)"
    local env_dom=""
    env_dom="$(awk -F= '/^SPARROWX_DOMAIN=/{sub(/^[^=]*=/,""); print; exit}' "${install_env}" 2>/dev/null | tr -d "\"'\r" || true)"
    [ -n "${env_dom}" ] && root_dom="${env_dom}"
  fi
  pg_user="${pg_user:-sparrowx}"
  pg_pass="${pg_pass:-sparrowx_ovh_secret_2026}"
  pg_db="${pg_db:-sparrowx_db}"
  pg_host_port="${pg_host_port:-5432}"

  local pg_host="127.0.0.1" pg_port="${pg_host_port}"
  if [ "${docker_ok}" = "yes" ] && docker ps --filter status=running --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-postgres"; then
    pg_host="sparrowx-postgres"
    pg_port="5432"
  fi
  local pg_url="postgresql://${pg_user}:${pg_pass}@${pg_host}:${pg_port}/${pg_db}"

  if [ -z "${ns_jwt}" ]; then
    ns_jwt="${spx_jwt:-$(openssl rand -hex 32 2>/dev/null || echo 'sparrowx_netsec_jwt_secret_2026_32c')}"
  fi
  local ns_sso_secret="${SPARROWX_MASTER_SSO_SECRET:-${spx_jwt:-${ns_jwt}}}"
  if [ -z "${ns_guard}" ]; then
    ns_guard="${SPARROWX_PUBLIC_IP:-}"
  fi

  upsert_env_kv_file "${netsec_env}" "PORT" "${netsec_p}"
  upsert_env_kv_file "${netsec_env}" "NODE_ENV" "production"
  upsert_env_kv_file "${netsec_env}" "SPARROWX_DOMAIN" "${netsec_domain}"
  upsert_env_kv_file "${netsec_env}" "SPARROWX_MASTER_URL" "https://${root_dom}"
  upsert_env_kv_file "${netsec_env}" "DATABASE_URL" "${pg_url}"
  upsert_env_kv_file "${netsec_env}" "POSTGRES_HOST" "${pg_host}"
  upsert_env_kv_file "${netsec_env}" "POSTGRES_PORT" "${pg_port}"
  upsert_env_kv_file "${netsec_env}" "POSTGRES_USER" "${pg_user}"
  upsert_env_kv_file "${netsec_env}" "POSTGRES_PASSWORD" "${pg_pass}"
  upsert_env_kv_file "${netsec_env}" "POSTGRES_DB" "${pg_db}"
  upsert_env_kv_file "${netsec_env}" "SPARROWX_JWT_SECRET" "${ns_sso_secret}"
  upsert_env_kv_file "${netsec_env}" "SPARROWX_MASTER_SSO_SECRET" "${ns_sso_secret}"
  upsert_env_kv_file "${netsec_env}" "NETSEC_AUTO_APPROVE" "${NETSEC_AUTO_APPROVE:-true}"
  [ -n "${ns_url}" ] && upsert_env_kv_file "${netsec_env}" "SUPABASE_URL" "${ns_url}"
  [ -n "${ns_anon}" ] && upsert_env_kv_file "${netsec_env}" "SUPABASE_ANON_KEY" "${ns_anon}"
  [ -n "${ns_svc}" ] && upsert_env_kv_file "${netsec_env}" "SUPABASE_SERVICE_KEY" "${ns_svc}"
  upsert_env_kv_file "${netsec_env}" "JWT_SECRET" "${ns_jwt}"
  [ -n "${ns_guard}" ] && upsert_env_kv_file "${netsec_env}" "GUARD_PUBLIC_IP" "${ns_guard}"
  chmod 600 "${netsec_env}" 2>/dev/null || true

  local pg_ready="no"
  if [ -n "${pg_pass}" ] && [ -n "${pg_db}" ]; then
    pg_ready="yes"
  fi
  if [ "${pg_ready}" != "yes" ] && { [ -z "${ns_url}" ] || [ -z "${ns_anon}" ]; }; then
    log_warn "Network DDoS Dashboard (${netsec_domain}) built at ${netsec_dir}, waiting for PostgreSQL or Supabase credentials."
    return 1
  fi

  local edge_net="sparrowx_net"
  if [ "${docker_ok}" = "yes" ] && docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "${EDGE_CTR:-sparrowx-nginx}"; then
    local detected_net=""
    detected_net="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "${EDGE_CTR:-sparrowx-nginx}" 2>/dev/null | awk 'NF {print; exit}' || true)"
    [ -n "${detected_net}" ] && edge_net="${detected_net}"
  fi

  local netsec_started="no"
  if [ "${docker_ok}" = "yes" ]; then
    if [ "${need_build}" != "yes" ] && \
       docker ps --filter status=running --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-netsec" && \
       docker inspect -f '{{json .NetworkSettings.Networks}}' sparrowx-netsec 2>/dev/null | grep -q "\"${edge_net}\"" && \
       docker exec sparrowx-netsec env 2>/dev/null | grep -q "POSTGRES_HOST=" && \
       docker exec sparrowx-netsec env 2>/dev/null | grep -q "SPARROWX_MASTER_SSO_SECRET=" && \
       curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:${netsec_p}/api/health" 2>/dev/null; then
      netsec_started="yes"
      log_ok "Network DDoS Dashboard (${netsec_domain}) container sparrowx-netsec already healthy on :${netsec_p}."
    else
      docker network create "${edge_net}" >/dev/null 2>&1 || true
      docker rm -f sparrowx-netsec >/dev/null 2>&1 || true
      free_docker_port_conflicts "${netsec_p}" "sparrowx-netsec"
      systemctl stop sparrowx-netsec.service >/dev/null 2>&1 || true
      if docker run -d --name sparrowx-netsec --restart unless-stopped \
        --network "${edge_net}" --network-alias sparrowx-netsec \
        --add-host=host.docker.internal:host-gateway \
        -p "127.0.0.1:${netsec_p}:${netsec_p}" \
        --env-file "${netsec_env}" \
        -e NODE_ENV=production -e PORT="${netsec_p}" -e SPARROWX_DOMAIN="${netsec_domain}" \
        -v "${netsec_dir}:/app" -w /app \
        node:22-slim node server.js >/dev/null 2>&1; then
        for _nw in 1 2 3 4 5; do
          sleep 1
          curl -fsS -o /dev/null --max-time 2 "http://127.0.0.1:${netsec_p}/api/health" 2>/dev/null && break
        done
        if docker ps --filter status=running --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-netsec"; then
          netsec_started="yes"
          log_ok "Network DDoS Dashboard (${netsec_domain}) container live on ${edge_net} & :${netsec_p}"
        fi
      fi
    fi
  fi

  if [ "${netsec_started}" != "yes" ]; then
    if [ "${ns_url}" = "http://host.docker.internal:8000" ]; then
      upsert_env_kv_file "${netsec_env}" "SUPABASE_URL" "http://127.0.0.1:8000"
    fi
    if { ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]; } && command -v apt-get >/dev/null 2>&1; then
      export DEBIAN_FRONTEND=noninteractive
      curl -fsSL https://deb.nodesource.com/setup_22.x 2>/dev/null | bash - >/dev/null 2>&1 || true
      retry_pkg_install nodejs
    fi
    local node_bin=""
    node_bin="$(command -v node || echo /usr/bin/node)"
    if [ -x "${node_bin}" ] && [ -s "${netsec_dir}/server.js" ]; then
      if [ -d /etc/systemd/system ] && command -v systemctl >/dev/null 2>&1; then
        cat > /etc/systemd/system/sparrowx-netsec.service <<EOF_NETSEC
[Unit]
Description=SparrowX Network DDoS Dashboard (${netsec_domain})
After=network.target

[Service]
Type=simple
WorkingDirectory=${netsec_dir}
EnvironmentFile=-${netsec_env}
Environment=NODE_ENV=production
Environment=PORT=${netsec_p}
Environment=SPARROWX_DOMAIN=${netsec_domain}
ExecStart=${node_bin} ${netsec_dir}/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF_NETSEC
        systemctl daemon-reload >/dev/null 2>&1 || true
        systemctl enable --now sparrowx-netsec.service >/dev/null 2>&1 || systemctl restart sparrowx-netsec.service >/dev/null 2>&1 || true
        netsec_started="yes"
        log_ok "Network DDoS Dashboard (${netsec_domain}) systemd service live on :${netsec_p}"
      fi
    fi
  fi
}

heal_pterodactyl_port_flow() {
  if ! is_pterodactyl_installed; then
    return 0
  fi

  local ptero_p="${PTERO_PORT:-8090}"
  local host_nginx_on_web="no"
  if ss -tulpn 2>/dev/null | grep -E ':(80|443)\b' | grep -q "nginx" && ! ss -tulpn 2>/dev/null | grep -E ':(80|443)\b' | grep -q "docker-proxy"; then
    host_nginx_on_web="yes"
  fi

  local ptero_local_code="000"
  local ptero_edge_code="000"
  ptero_local_code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 4 "http://127.0.0.1:${ptero_p}/" 2>/dev/null || echo "000")"
  ptero_edge_code="$(curl -sk -o /dev/null -w "%{http_code}" --max-time 4 -H "Host: ${DOMAIN_GAME}" "https://127.0.0.1:${HTTPS_PORT:-443}/" 2>/dev/null || echo "000")"

  if [ "${host_nginx_on_web}" = "no" ] && \
     echo "${ptero_local_code}" | grep -qE "^(200|301|302|307)$" && \
     echo "${ptero_edge_code}" | grep -qE "^(200|301|302|307)$" && \
     grep -q "${DOMAIN_GAME}" "${INSTALL_DIR}/ovh/nginx.conf" 2>/dev/null; then
    log_ok "Pterodactyl (${DOMAIN_GAME} -> :${ptero_p}) already healthy and passed ping test."
    return 0
  fi

  log_warn "Analyzing and repairing Pterodactyl (${DOMAIN_GAME}) port flow & connectivity..."
  heal_pterodactyl_host_nginx
  render_sparrowx_nginx_conf

  if [ "${DOCKER_AVAILABLE:-no}" = "yes" ] && docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-nginx"; then
    docker exec sparrowx-nginx nginx -s reload >/dev/null 2>&1 || docker restart sparrowx-nginx >/dev/null 2>&1 || true
    sleep 2
    # Ensure DOCKER_HOST_IP inside nginx.conf matches active sparrowx-nginx gateway IP
    render_sparrowx_nginx_conf
    docker exec sparrowx-nginx nginx -s reload >/dev/null 2>&1 || docker restart sparrowx-nginx >/dev/null 2>&1 || true
  fi
}

reclaim_web_ports() {
  # Preserve host nginx when Pterodactyl is installed by shifting it to port ${PTERO_PORT}
  if is_pterodactyl_installed; then
    heal_pterodactyl_host_nginx
  elif systemctl is-active --quiet nginx 2>/dev/null || systemctl is-enabled --quiet nginx 2>/dev/null; then
    log_warn "Host nginx (no Pterodactyl found) is holding web ports. Stopping & disabling for SparrowX Proxy..."
    systemctl stop nginx >/dev/null 2>&1 || true
    systemctl disable nginx >/dev/null 2>&1 || true
  fi

  for svc in apache2 httpd lighttpd caddy; do
    if systemctl is-active --quiet "${svc}" 2>/dev/null || systemctl is-enabled --quiet "${svc}" 2>/dev/null; then
      log_warn "Host service '${svc}' is holding web ports. Stopping & disabling it for SparrowX Proxy..."
      systemctl stop "${svc}" >/dev/null 2>&1 || true
      systemctl disable "${svc}" >/dev/null 2>&1 || true
    fi
  done

  free_docker_port_conflicts "${HTTP_PORT:-80}" "sparrowx-nginx"
  free_docker_port_conflicts "${HTTPS_PORT:-443}" "sparrowx-nginx"

  for p in 80 443; do
    if is_port_in_use "${p}" && ! port_held_by_container "${p}" "sparrowx-nginx"; then
      log_warn "Clearing leftover non-SparrowX process on port ${p}..."
      fuser -k "${p}/tcp" >/dev/null 2>&1 || true
      sleep 1
    fi
  done
}

ask_prompt() {
  local prompt_text="$1"
  local default_val="$2"
  if [ "${AUTO_MODE}" = "true" ]; then
    echo "${default_val}"
    return 0
  fi
  local user_input=""
  if [ -t 0 ]; then
    read -r -p "$(echo -e "${C_CYAN}  ? ${C_RESET}${prompt_text} ${C_DIM}[${default_val}]${C_RESET}: ")" user_input || true
  elif [ -e /dev/tty ]; then
    read -r -p "$(echo -e "${C_CYAN}  ? ${C_RESET}${prompt_text} ${C_DIM}[${default_val}]${C_RESET}: ")" user_input < /dev/tty || true
  fi
  if [ -z "${user_input}" ]; then
    echo "${default_val}"
  else
    echo "${user_input}"
  fi
}

# ==============================================================================
# STEP 1: SYSTEM REPAIR & DEBIAN/UBUNTU PREREQUISITES
# ==============================================================================
step_banner 1 10 "System Diagnostics, DNS Healing & Debian/Ubuntu Prerequisites"
heal_host_dns
ensure_swap_memory

if command -v apt-get >/dev/null 2>&1; then
  log_info "Verifying core system, firewall, SSL, cron & diagnostic packages..."
  retry_pkg_install ca-certificates curl gnupg git openssl ufw cron lsb-release dnsutils lsof iproute2 net-tools psmisc certbot fail2ban
  systemctl enable --now cron >/dev/null 2>&1 || true
else
  retry_pkg_install ca-certificates curl git openssl firewalld bind-utils lsof iproute net-tools psmisc certbot cronie
  systemctl enable --now crond >/dev/null 2>&1 || true
fi
log_ok "System prerequisites verified."

DETECTED_IP="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || curl -4 -fsS --max-time 5 https://icanhazip.com 2>/dev/null | tr -d '[:space:]' || hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')"

# ==============================================================================
# STEP 2: INTERACTIVE SPARROWX + PTERODACTYL BLUEPRINT WIZARD
# ==============================================================================
step_banner 2 10 "Interactive Multi-Domain & Pterodactyl Panel Wizard"

if [ -f "${INSTALL_DIR}/.env" ]; then
  # shellcheck disable=SC1090
  source "${INSTALL_DIR}/.env" 2>/dev/null || true
elif [ -f "./.env" ]; then
  # shellcheck disable=SC1091
  source "./.env" 2>/dev/null || true
fi

PTERO_PORT="${PTERO_PORT:-8090}"

echo -e "  ${C_DIM}Configure your root domain, subdomains, and Pterodactyl panel (Enter = keep defaults):${C_RESET}"
echo ""

RAW_DOMAIN="$(ask_prompt "1/7 Primary Root Domain (e.g. sparrowx.net)" "${DOMAIN_ROOT:-${SPARROWX_DOMAIN:-sparrowx.net}}")"
DOMAIN_ROOT="$(echo "${RAW_DOMAIN}" | sed -E 's#^https?://##; s#/.*$##' | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
[ -z "${DOMAIN_ROOT}" ] && DOMAIN_ROOT="sparrowx.net"
SPARROWX_DOMAIN="${DOMAIN_ROOT}"

CUSTOM_SUBS="$(ask_prompt "2/7 Use standard subdomains (db., sec., file., password., api., game.)? (yes/custom)" "yes")"
if [[ "$(echo "${CUSTOM_SUBS}" | tr '[:upper:]' '[:lower:]')" == "custom" ]]; then
  DOMAIN_STUDIO="$(ask_prompt "    -> Cloud DB Studio Domain" "${DOMAIN_STUDIO:-db.${DOMAIN_ROOT}}")"
  DOMAIN_SEC="$(ask_prompt "    -> Shield WAF & Threat Map Domain" "${DOMAIN_SEC:-sec.${DOMAIN_ROOT}}")"
  DOMAIN_FILE="$(ask_prompt "    -> File Drop & Vault Domain" "${DOMAIN_FILE:-file.${DOMAIN_ROOT}}")"
  DOMAIN_PASSWORD="$(ask_prompt "    -> Keys Password Generator Domain" "${DOMAIN_PASSWORD:-password.${DOMAIN_ROOT}}")"
  DOMAIN_API="$(ask_prompt "    -> PostgREST API Gateway Domain" "${DOMAIN_API:-api.${DOMAIN_ROOT}}")"
  DOMAIN_GAME_WEB="$(ask_prompt "    -> Game Hosting Storefront Domain" "${DOMAIN_GAME_WEB:-game.${DOMAIN_ROOT}}")"
  DOMAIN_GAME_DASH="$(ask_prompt "    -> Game Client Dashboard Domain" "${DOMAIN_GAME_DASH:-game.dash.${DOMAIN_ROOT}}")"
  DOMAIN_GAMESEC="$(ask_prompt "    -> Game DDoS Defense Portal Domain" "${DOMAIN_GAMESEC:-gamesec.${DOMAIN_ROOT}}")"
  DOMAIN_NETSEC="$(ask_prompt "    -> Network DDoS Dashboard Domain" "${DOMAIN_NETSEC:-netsec.${DOMAIN_ROOT}}")"
  if [ "${DOMAIN_GAME:-}" = "game.${DOMAIN_ROOT}" ]; then
    DOMAIN_GAME="game.panel.${DOMAIN_ROOT}"
  fi
  DOMAIN_GAME="$(ask_prompt "    -> Pterodactyl Game Panel Domain" "${DOMAIN_GAME:-game.panel.${DOMAIN_ROOT}}")"
else
  DOMAIN_STUDIO="db.${DOMAIN_ROOT}"
  DOMAIN_SEC="sec.${DOMAIN_ROOT}"
  DOMAIN_FILE="file.${DOMAIN_ROOT}"
  DOMAIN_PASSWORD="password.${DOMAIN_ROOT}"
  DOMAIN_API="api.${DOMAIN_ROOT}"
  DOMAIN_GAME_WEB="game.${DOMAIN_ROOT}"
  DOMAIN_GAME_DASH="game.dash.${DOMAIN_ROOT}"
  DOMAIN_GAMESEC="gamesec.${DOMAIN_ROOT}"
  DOMAIN_NETSEC="netsec.${DOMAIN_ROOT}"
  DOMAIN_GAME="game.panel.${DOMAIN_ROOT}"
fi
DOMAIN_GAME_WEB="${DOMAIN_GAME_WEB:-game.${DOMAIN_ROOT}}"
DOMAIN_GAME_DASH="${DOMAIN_GAME_DASH:-game.dash.${DOMAIN_ROOT}}"
DOMAIN_GAMESEC="${DOMAIN_GAMESEC:-gamesec.${DOMAIN_ROOT}}"
GAMESEC_PORT="${GAMESEC_PORT:-3005}"
GAMESEC_REPO_URL="${GAMESEC_REPO_URL:-https://github.com/cybersync-fxfx/sbs-detrion-landing.git}"
GAMESEC_DIR="${GAMESEC_DIR:-/opt/sparrowx-gamesec}"
GAMESEC_UPSTREAM_URL="${GAMESEC_UPSTREAM_URL:-}"
DOMAIN_NETSEC="${DOMAIN_NETSEC:-netsec.${DOMAIN_ROOT}}"
NETSEC_PORT="${NETSEC_PORT:-3006}"
NETSEC_REPO_URL="${NETSEC_REPO_URL:-https://github.com/cybersync-fxfx/saprrowx.sbs.git}"
NETSEC_DIR="${NETSEC_DIR:-/opt/sparrowx-netsec}"
NETSEC_UPSTREAM_URL="${NETSEC_UPSTREAM_URL:-}"
if [ -z "${DOMAIN_GAME:-}" ] || [ "${DOMAIN_GAME}" = "game.${DOMAIN_ROOT}" ]; then
  DOMAIN_GAME="game.panel.${DOMAIN_ROOT}"
fi
SPARROWX_STUDIO_DOMAIN="${DOMAIN_STUDIO}"

SPARROWX_PUBLIC_IP="$(ask_prompt "3/7 Confirm Server Public IPv4" "${SPARROWX_PUBLIC_IP:-${DETECTED_IP}}")"
[ -z "${SPARROWX_PUBLIC_IP}" ] && SPARROWX_PUBLIC_IP="${DETECTED_IP}"

SPARROWX_ADMIN_EMAIL="$(ask_prompt "4/7 Admin Email (Let's Encrypt SSL & Security Alerts)" "${SPARROWX_ADMIN_EMAIL:-admin@${DOMAIN_ROOT}}")"
[ -z "${SPARROWX_ADMIN_EMAIL}" ] && SPARROWX_ADMIN_EMAIL="admin@${DOMAIN_ROOT}"

ENABLE_DNS_SERVER="$(ask_prompt "5/7 Install local Authoritative Bind9 Nameservers (ns1/ns2)? (yes/no)" "${ENABLE_DNS_SERVER:-no}")"
ENABLE_CRON_SSL="$(ask_prompt "6/7 Enable Full Let's Encrypt SSL + Watchdog & Daily DB Backups? (yes/no)" "${ENABLE_CRON_SSL:-yes}")"

if is_pterodactyl_installed; then
  log_ok "Existing Pterodactyl installation detected (/var/www/pterodactyl) for ${DOMAIN_GAME}."
  if [ "${INSTALL_PTERO}" = "ask" ]; then
    PTERO_ACTION="$(ask_prompt "7/7 Pterodactyl already installed. Keep & auto-heal port flow, or re-run installer? (keep/reinstall)" "keep")"
  elif [ "${INSTALL_PTERO}" = "yes" ]; then
    PTERO_ACTION="keep"
  else
    PTERO_ACTION="keep"
  fi
else
  if [ "${INSTALL_PTERO}" = "yes" ]; then
    PTERO_ACTION="install"
  elif [ "${INSTALL_PTERO}" = "no" ]; then
    PTERO_ACTION="skip"
  else
    ANS_PTERO="$(ask_prompt "7/7 Install & auto-configure Pterodactyl Game Panel (${DOMAIN_GAME}) unattended? (yes/no)" "yes")"
    if [[ "$(echo "${ANS_PTERO}" | tr '[:upper:]' '[:lower:]')" == "y"* ]]; then
      PTERO_ACTION="install"
    else
      PTERO_ACTION="skip"
    fi
  fi
fi

init_ptero_credentials

echo ""
log_ok "Blueprint Locked: ${DOMAIN_ROOT} (db / sec / file / password / api / ${DOMAIN_GAME_WEB} / ${DOMAIN_GAME_DASH} / ${DOMAIN_GAMESEC} / ${DOMAIN_NETSEC} / ${DOMAIN_GAME}) @ ${SPARROWX_PUBLIC_IP}"

# ==============================================================================
# STEP 3: SYNC & VERIFY REPOSITORY + OPTIONAL PTERODACTYL INSTALLER
# ==============================================================================
step_banner 3 10 "Syncing SparrowX Codebase & Optional Pterodactyl Quick Install"

if [ -f "${INSTALL_DIR}/docker-compose.ovh.yml" ] && [ -f "${INSTALL_DIR}/ovh/schema.sql" ]; then
  log_ok "Using active SparrowX repository at: ${INSTALL_DIR}"
  if [ -d "${INSTALL_DIR}/.git" ] && command -v git >/dev/null 2>&1; then
    git config --global --add safe.directory "${INSTALL_DIR}" >/dev/null 2>&1 || true
    cd "${INSTALL_DIR}" || exit 1
    git fetch origin main --depth=1 >/dev/null 2>&1 || true
    git reset --hard origin/main >/dev/null 2>&1 || true
  fi
else
  log_info "Syncing SparrowX repository into ${INSTALL_DIR}..."
  if [ -d "${INSTALL_DIR}/.git" ]; then
    git config --global --add safe.directory "${INSTALL_DIR}" >/dev/null 2>&1 || true
    cd "${INSTALL_DIR}" || exit 1
    git fetch origin main --depth=1 >/dev/null 2>&1 || true
    git reset --hard origin/main >/dev/null 2>&1 || true
    log_ok "Updated existing repository at ${INSTALL_DIR}."
  else
    rm -rf "${INSTALL_DIR}" 2>/dev/null || true
    if [ -n "${GITHUB_TOKEN:-}" ]; then
      REPO_URL="https://${GITHUB_TOKEN}@github.com/cybersync-fxfx/sparrowxdbs.git"
    fi
    if ! git clone --depth 1 "${REPO_URL}" "${INSTALL_DIR}" 2>/dev/null; then
      log_warn "Repository requires authentication or retry."
      GH_PAT="$(ask_prompt "Enter GitHub Personal Access Token (PAT) for cybersync-fxfx/sparrowxdbs" "")"
      if [ -n "${GH_PAT}" ]; then
        git clone --depth 1 "https://${GH_PAT}@github.com/cybersync-fxfx/sparrowxdbs.git" "${INSTALL_DIR}"
      else
        git config --global http.postBuffer 524288000 || true
        git clone --depth 1 "${REPO_URL}" "${INSTALL_DIR}"
      fi
    fi
    log_ok "Cloned SparrowX repository into ${INSTALL_DIR}."
  fi
fi

cd "${INSTALL_DIR}" || exit 1
if [ ! -e "/opt/sparrowx" ] && [ "${INSTALL_DIR}" != "/opt/sparrowx" ]; then
  ln -sfn "${INSTALL_DIR}" /opt/sparrowx 2>/dev/null || true
fi

mkdir -p ./ovh/dns ./ovh/ssl ./ovh/certbot-www/.well-known/acme-challenge ./data/storage ./data/users ./data/backups ./backups
chmod +x ./setup.sh ./update.sh ./fix.sh ./manage-db.sh ./ovh/*.sh ./deploy/*.sh ./init-scripts/*.sh 2>/dev/null || true

# Launch Pterodactyl installer (unattended by default, or interactive if --interactive-ptero)
if [ "${PTERO_ACTION}" = "install" ] || [ "${PTERO_ACTION}" = "reinstall" ]; then
  echo ""
  log_info "Preparing ports 80/443 temporarily for Pterodactyl installer (${DOMAIN_GAME})..."
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    docker stop sparrowx-nginx sparrowx_edge_proxy >/dev/null 2>&1 || true
  fi
  if [ "${PTERO_ACTION}" = "reinstall" ] && [ -d /var/www/pterodactyl ]; then
    rm -rf /var/www/pterodactyl
  fi
  if [ "${INTERACTIVE_PTERO}" = "true" ]; then
    echo -e "${C_CYAN}  Suggested answers inside pterodactyl-installer.se:${C_RESET}"
    echo -e "    • FQDN / Domain : ${C_BOLD}${DOMAIN_GAME}${C_RESET}"
    echo -e "    • Admin Email   : ${C_BOLD}${PTERO_ADMIN_EMAIL}${C_RESET}"
    echo ""
    if [ -e /dev/tty ]; then
      bash <(curl -s https://pterodactyl-installer.se) < /dev/tty || log_warn "Pterodactyl installer exited; running port-flow reconciliation..."
    else
      bash <(curl -s https://pterodactyl-installer.se) || log_warn "Pterodactyl installer exited; running port-flow reconciliation..."
    fi
  else
    install_pterodactyl_unattended
  fi
fi

# ==============================================================================
# STEP 4: DOCKER ENGINE & IDEMPOTENT PRE-FLIGHT PING AUDIT
# ==============================================================================
step_banner 4 10 "Verifying Docker Engine & Pre-Flight Health Audit"

DOCKER_AVAILABLE="yes"
if ! command -v docker >/dev/null 2>&1; then
  log_info "Installing official Docker Engine..."
  curl -fsSL https://get.docker.com | sh >/dev/null 2>&1 || true
fi

if command -v docker >/dev/null 2>&1; then
  systemctl unmask docker containerd >/dev/null 2>&1 || true
  systemctl enable containerd docker >/dev/null 2>&1 || true
  systemctl start containerd docker >/dev/null 2>&1 || true
  if ! docker compose version >/dev/null 2>&1; then
    retry_pkg_install docker-compose-plugin docker-compose
  fi
  if ! docker info >/dev/null 2>&1; then
    log_warn "Docker daemon unavailable (possible LXC/OpenVZ restriction). Activating Native Host Mode!"
    DOCKER_AVAILABLE="no"
  else
    log_ok "Docker Engine & Compose plugin are healthy."
  fi
else
  DOCKER_AVAILABLE="no"
fi

SPARROWX_ALREADY_HEALTHY="no"
if [ "${DOCKER_AVAILABLE}" = "yes" ]; then
  APP_CHK="$(curl -fsS --max-time 3 "http://127.0.0.1:${APP_HOST_PORT:-3000}/api/v1/health" 2>/dev/null && echo ok || echo fail)"
  PGRST_CHK="$(curl -fsS --max-time 3 "http://127.0.0.1:${PGRST_HOST_PORT:-3001}/" 2>/dev/null && echo ok || echo fail)"
  PG_RUN="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -Fx "sparrowx-postgres" || true)"
  APP_RUN="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -Fx "sparrowx-app" || true)"
  NGX_RUN="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -Fx "sparrowx-nginx" || true)"

  if [ "${APP_CHK}" = "ok" ] && [ "${PGRST_CHK}" = "ok" ] && [ -n "${PG_RUN}" ] && [ -n "${APP_RUN}" ] && [ -n "${NGX_RUN}" ]; then
    SPARROWX_ALREADY_HEALTHY="yes"
    log_ok "Existing SparrowX stack (Postgres, PostgREST, App, Nginx) passed ping audit — preserving live state without teardown."
  else
    log_info "Pre-flight ping audit found offline or incomplete components — cleaning stale conflicts..."
    if [ -f "${INSTALL_DIR}/docker-compose.standalone.yml" ]; then
      compose_cmd -f "${INSTALL_DIR}/docker-compose.standalone.yml" down --remove-orphans >/dev/null 2>&1 || true
    fi
    for old_c in sparrowx_postgres sparrowx_pgbouncer sparrowx_postgrest sparrowx_threat_cache sparrowx_studio sparrowx_edge_proxy; do
      if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -Fxq "${old_c}"; then
        docker rm -f "${old_c}" >/dev/null 2>&1 || true
      fi
    done
    for svc in postgresql pgbouncer sparrowx-native.service; do
      systemctl stop "${svc}" >/dev/null 2>&1 || true
      [ "${svc}" != "sparrowx-native.service" ] && systemctl disable "${svc}" >/dev/null 2>&1 || true
    done
    if ! docker ps --filter status=running --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-postgres"; then
      docker rm -f sparrowx-postgres >/dev/null 2>&1 || true
      pkill -9 -x postgres >/dev/null 2>&1 || true
      pkill -9 -f "docker-proxy.*-host-port ${PG_HOST_PORT:-5432}( |$)" >/dev/null 2>&1 || true
      command -v fuser >/dev/null 2>&1 && fuser -k "${PG_HOST_PORT:-5432}/tcp" >/dev/null 2>&1 || true
    fi
    if ! docker ps --filter status=running --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-nginx"; then
      pkill -9 -f "docker-proxy.*-host-port ${HTTP_PORT:-80}( |$)" >/dev/null 2>&1 || true
      pkill -9 -f "docker-proxy.*-host-port ${HTTPS_PORT:-443}( |$)" >/dev/null 2>&1 || true
    fi
  fi
fi

# ==============================================================================
# STEP 5: RECLAIM PORTS 80/443, PROTECT PTERODACTYL & LOCK CONFLICT-FREE PORTS
# ==============================================================================
step_banner 5 10 "Reclaiming Ports 80/443 & Locking Conflict-Free Port Map"

reclaim_web_ports

if [ "${SPARROWX_ALREADY_HEALTHY}" = "yes" ]; then
  HTTP_PORT="${HTTP_PORT:-80}"
  HTTPS_PORT="${HTTPS_PORT:-443}"
  APP_HOST_PORT="${APP_HOST_PORT:-3000}"
  PGRST_HOST_PORT="${PGRST_HOST_PORT:-3001}"
  PG_HOST_PORT="${PG_HOST_PORT:-5432}"
  PG_POOL_PORT="${PG_POOL_PORT:-6543}"
  GAMESEC_PORT="${GAMESEC_PORT:-3005}"
  NETSEC_PORT="${NETSEC_PORT:-3006}"
  log_ok "Keeping active port map untouched (HTTP:${HTTP_PORT} HTTPS:${HTTPS_PORT} APP:${APP_HOST_PORT} PGRST:${PGRST_HOST_PORT} PG:${PG_HOST_PORT} GAMESEC:${GAMESEC_PORT} NETSEC:${NETSEC_PORT})."
else
  HTTP_PORT="$(find_free_port "${HTTP_PORT:-80}" 8180 "HTTP Edge Proxy" "sparrowx-nginx")"
  HTTPS_PORT="$(find_free_port "${HTTPS_PORT:-443}" 8444 "HTTPS SSL Edge Proxy" "sparrowx-nginx")"
  APP_HOST_PORT="$(find_free_port "${APP_HOST_PORT:-3000}" 3010 "SparrowX Studio App" "sparrowx-app")"
  PGRST_HOST_PORT="$(find_free_port "${PGRST_HOST_PORT:-3001}" 3020 "PostgREST Gateway" "sparrowx-postgrest")"
  PG_HOST_PORT="$(find_free_port "${PG_HOST_PORT:-5432}" 5433 "PostgreSQL 16 + pgvector" "sparrowx-postgres")"
  PG_POOL_PORT="$(find_free_port "${PG_POOL_PORT:-6543}" 6544 "PgBouncer Pooler")"
  GAMESEC_PORT="$(find_free_port "${GAMESEC_PORT:-3005}" 3015 "Game DDoS Defense Portal" "sparrowx-gamesec")"
  NETSEC_PORT="$(find_free_port "${NETSEC_PORT:-3006}" 3026 "Network DDoS Dashboard" "sparrowx-netsec")"
fi

echo -e "  ${C_GREEN}• Public HTTP / HTTPS   :${C_RESET} ${C_BOLD}${HTTP_PORT} / ${HTTPS_PORT}${C_RESET}"
echo -e "  ${C_GREEN}• SparrowX App Server   :${C_RESET} 127.0.0.1:${APP_HOST_PORT}"
echo -e "  ${C_GREEN}• Game DDoS Defense     :${C_RESET} 127.0.0.1:${GAMESEC_PORT} (${DOMAIN_GAMESEC})"
echo -e "  ${C_GREEN}• Network DDoS Dash     :${C_RESET} 127.0.0.1:${NETSEC_PORT} (${DOMAIN_NETSEC})"
echo -e "  ${C_GREEN}• PostgREST API Engine  :${C_RESET} 127.0.0.1:${PGRST_HOST_PORT}"
echo -e "  ${C_GREEN}• PostgreSQL 16 DB      :${C_RESET} 127.0.0.1:${PG_HOST_PORT}"
if is_pterodactyl_installed; then
  echo -e "  ${C_GREEN}• Pterodactyl Internal  :${C_RESET} 127.0.0.1:${PTERO_PORT} (${DOMAIN_GAME})"
fi

# ==============================================================================
# STEP 6: GENERATE AUTHORITATIVE DNS ZONE & OPTIONAL BIND9
# ==============================================================================
step_banner 6 10 "Configuring DNS Zone Blueprint & Optional Bind9"

SERIAL_DATE="$(date +%Y%m%d01)"
VERIFY_TOKEN="sparrowx-verify-$(openssl rand -hex 8)"
SPARROWX_NS1="ns1.${DOMAIN_ROOT}"
SPARROWX_NS2="ns2.${DOMAIN_ROOT}"
ZONE_FILE="./ovh/dns/db.${DOMAIN_ROOT}"

cat > "${ZONE_FILE}" <<EOF
; SparrowX Multi-Domain DNS Zone for ${DOMAIN_ROOT}
\$TTL 3600
@   IN  SOA ${SPARROWX_NS1}. ${SPARROWX_ADMIN_EMAIL/@/.}. (
        ${SERIAL_DATE} ; Serial
        3600       ; Refresh
        900        ; Retry
        1209600    ; Expire
        300 )      ; Minimum TTL

@               IN  NS      ${SPARROWX_NS1}.
@               IN  NS      ${SPARROWX_NS2}.

; Root & Ecosystem Subdomains
@               IN  A       ${SPARROWX_PUBLIC_IP}
www             IN  A       ${SPARROWX_PUBLIC_IP}
db              IN  A       ${SPARROWX_PUBLIC_IP}
sec             IN  A       ${SPARROWX_PUBLIC_IP}
shield          IN  A       ${SPARROWX_PUBLIC_IP}
file            IN  A       ${SPARROWX_PUBLIC_IP}
drop            IN  A       ${SPARROWX_PUBLIC_IP}
password        IN  A       ${SPARROWX_PUBLIC_IP}
passwd          IN  A       ${SPARROWX_PUBLIC_IP}
keys            IN  A       ${SPARROWX_PUBLIC_IP}
api             IN  A       ${SPARROWX_PUBLIC_IP}
game            IN  A       ${SPARROWX_PUBLIC_IP}
panel           IN  A       ${SPARROWX_PUBLIC_IP}
gamesec         IN  A       ${SPARROWX_PUBLIC_IP}
netsec          IN  A       ${SPARROWX_PUBLIC_IP}
ns1             IN  A       ${SPARROWX_PUBLIC_IP}
ns2             IN  A       ${SPARROWX_PUBLIC_IP}

@               IN  CAA     0 issue "letsencrypt.org"
@               IN  TXT     "v=spf1 a ip4:${SPARROWX_PUBLIC_IP} -all"
_sparrowx       IN  TXT     "${VERIFY_TOKEN}"
EOF

if [[ "$(echo "${ENABLE_DNS_SERVER}" | tr '[:upper:]' '[:lower:]')" == "y"* ]]; then
  retry_pkg_install bind9 bind9utils
  if is_port_in_use 53 && systemctl is-active --quiet systemd-resolved 2>/dev/null; then
    log_warn "Releasing systemd-resolved stub listener on port 53..."
    sed -i 's/^#*DNSStubListener=.*/DNSStubListener=no/' /etc/systemd/resolved.conf 2>/dev/null || true
    grep -q "^DNSStubListener=no" /etc/systemd/resolved.conf 2>/dev/null || echo "DNSStubListener=no" >> /etc/systemd/resolved.conf 2>/dev/null || true
    ln -sf /run/systemd/resolve/resolv.conf /etc/resolv.conf 2>/dev/null || true
    systemctl restart systemd-resolved >/dev/null 2>&1 || true
  fi
  if [ -d /etc/bind ]; then
    mkdir -p /etc/bind/zones
    cp "${ZONE_FILE}" "/etc/bind/zones/db.${DOMAIN_ROOT}"
    if ! grep -q "zone \"${DOMAIN_ROOT}\"" /etc/bind/named.conf.local 2>/dev/null; then
      cat >> /etc/bind/named.conf.local <<EOF

zone "${DOMAIN_ROOT}" {
    type master;
    file "/etc/bind/zones/db.${DOMAIN_ROOT}";
    allow-query { any; };
};
EOF
    fi
    systemctl enable --now named >/dev/null 2>&1 || systemctl enable --now bind9 >/dev/null 2>&1 || true
    systemctl restart named >/dev/null 2>&1 || systemctl restart bind9 >/dev/null 2>&1 || true
    log_ok "Bind9 authoritative DNS active for ${DOMAIN_ROOT}."
  fi
else
  log_ok "DNS Zone blueprint saved at ${ZONE_FILE}."
fi

# ==============================================================================
# STEP 7: MULTI-DOMAIN NGINX REVERSE PROXY & TLS CERTIFICATES
# ==============================================================================
step_banner 7 10 "Building Multi-Domain Nginx Reverse Proxy & TLS Certificates"

SSL_CERT="${INSTALL_DIR}/ovh/ssl/fullchain.pem"
SSL_KEY="${INSTALL_DIR}/ovh/ssl/privkey.pem"

if [ ! -s "${SSL_CERT}" ] || [ ! -s "${SSL_KEY}" ] || ! openssl x509 -in "${SSL_CERT}" -noout >/dev/null 2>&1; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "${SSL_KEY}" \
    -out "${SSL_CERT}" \
    -subj "/CN=${DOMAIN_ROOT}" \
    -addext "subjectAltName=DNS:${DOMAIN_ROOT},DNS:www.${DOMAIN_ROOT},DNS:${DOMAIN_STUDIO},DNS:${DOMAIN_SEC},DNS:shield.${DOMAIN_ROOT},DNS:${DOMAIN_FILE},DNS:drop.${DOMAIN_ROOT},DNS:${DOMAIN_PASSWORD},DNS:passwd.${DOMAIN_ROOT},DNS:keys.${DOMAIN_ROOT},DNS:${DOMAIN_API},DNS:${DOMAIN_GAME_WEB},DNS:${DOMAIN_GAME_DASH},DNS:${DOMAIN_GAMESEC},DNS:${DOMAIN_NETSEC},DNS:${DOMAIN_GAME},DNS:panel.${DOMAIN_ROOT},IP:${SPARROWX_PUBLIC_IP}" >/dev/null 2>&1 || \
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "${SSL_KEY}" \
    -out "${SSL_CERT}" \
    -subj "/CN=${DOMAIN_ROOT}" >/dev/null 2>&1
  log_ok "Initial SAN TLS certificate generated (including ${DOMAIN_GAME_WEB}, ${DOMAIN_GAME_DASH}, ${DOMAIN_GAMESEC}, ${DOMAIN_NETSEC}, ${DOMAIN_GAME})."
else
  log_ok "Existing valid TLS certificate preserved."
fi

if is_pterodactyl_installed; then
  heal_pterodactyl_host_nginx
fi

for _cert_prefix in ptero game-web game-dash gamesec netsec; do
  if [ ! -s "${INSTALL_DIR}/ovh/ssl/${_cert_prefix}-fullchain.pem" ] && [ -s "${INSTALL_DIR}/ovh/ssl/fullchain.pem" ]; then
    cp -f "${INSTALL_DIR}/ovh/ssl/fullchain.pem" "${INSTALL_DIR}/ovh/ssl/${_cert_prefix}-fullchain.pem" 2>/dev/null || true
  fi
  if [ ! -s "${INSTALL_DIR}/ovh/ssl/${_cert_prefix}-privkey.pem" ] && [ -s "${INSTALL_DIR}/ovh/ssl/privkey.pem" ]; then
    cp -f "${INSTALL_DIR}/ovh/ssl/privkey.pem" "${INSTALL_DIR}/ovh/ssl/${_cert_prefix}-privkey.pem" 2>/dev/null || true
  fi
done

render_sparrowx_nginx_conf
log_ok "Multi-domain Nginx proxy configuration synchronized (including ${DOMAIN_GAME_WEB}, ${DOMAIN_GAME_DASH}, ${DOMAIN_GAMESEC}, ${DOMAIN_NETSEC}, ${DOMAIN_GAME})."

# ==============================================================================
# STEP 8: ENVIRONMENT (.ENV) & HARDENED FIREWALL (INCLUDING PTERO/WINGS PORTS)
# ==============================================================================
step_banner 8 10 "Saving Environment Secrets & Hardening Firewall"

POSTGRES_USER="${POSTGRES_USER:-sparrowx}"
POSTGRES_DB="${POSTGRES_DB:-sparrowx_db}"
if [ -z "${POSTGRES_PASSWORD:-}" ]; then
  POSTGRES_PASSWORD="$(openssl rand -hex 20)"
fi
if [ -z "${SPARROWX_JWT_SECRET:-}" ]; then
  SPARROWX_JWT_SECRET="$(openssl rand -hex 32)"
fi
if [ -z "${SPARROWX_REDIS_SECRET:-}" ]; then
  SPARROWX_REDIS_SECRET="$(openssl rand -hex 16)"
fi

ensure_env_key "POSTGRES_USER" "${POSTGRES_USER}"
ensure_env_key "POSTGRES_PASSWORD" "${POSTGRES_PASSWORD}"
ensure_env_key "POSTGRES_DB" "${POSTGRES_DB}"
ensure_env_key "SPARROWX_JWT_SECRET" "${SPARROWX_JWT_SECRET}"
ensure_env_key "SPARROWX_REDIS_SECRET" "${SPARROWX_REDIS_SECRET}"
if [ -z "${PTERO_SSO_SECRET:-}" ]; then
  PTERO_SSO_SECRET="$(openssl rand -hex 32 2>/dev/null || echo 'sparrowx_ptero_sso_hmac_secret_2026_32c')"
fi
PTERO_URL="https://${DOMAIN_GAME}"
ensure_env_key "PTERO_URL" "${PTERO_URL}"
ensure_env_key "PTERO_SSO_SECRET" "${PTERO_SSO_SECRET}"
ensure_env_key "DOMAIN_ROOT" "${DOMAIN_ROOT}"
ensure_env_key "SPARROWX_DOMAIN" "${DOMAIN_ROOT}"
ensure_env_key "DOMAIN_STUDIO" "${DOMAIN_STUDIO}"
ensure_env_key "SPARROWX_STUDIO_DOMAIN" "${DOMAIN_STUDIO}"
ensure_env_key "DOMAIN_SEC" "${DOMAIN_SEC}"
ensure_env_key "DOMAIN_FILE" "${DOMAIN_FILE}"
ensure_env_key "DOMAIN_PASSWORD" "${DOMAIN_PASSWORD}"
ensure_env_key "DOMAIN_API" "${DOMAIN_API}"
ensure_env_key "DOMAIN_GAME" "${DOMAIN_GAME}"
ensure_env_key "DOMAIN_GAME_WEB" "${DOMAIN_GAME_WEB}"
ensure_env_key "DOMAIN_GAME_DASH" "${DOMAIN_GAME_DASH}"
ensure_env_key "DOMAIN_GAMESEC" "${DOMAIN_GAMESEC}"
ensure_env_key "GAMESEC_PORT" "${GAMESEC_PORT}"
ensure_env_key "GAMESEC_REPO_URL" "${GAMESEC_REPO_URL}"
ensure_env_key "GAMESEC_DIR" "${GAMESEC_DIR}"
ensure_env_key "GAMESEC_UPSTREAM_URL" "${GAMESEC_UPSTREAM_URL:-}"
ensure_env_key "DOMAIN_NETSEC" "${DOMAIN_NETSEC}"
ensure_env_key "NETSEC_PORT" "${NETSEC_PORT}"
ensure_env_key "NETSEC_REPO_URL" "${NETSEC_REPO_URL}"
ensure_env_key "NETSEC_DIR" "${NETSEC_DIR}"
ensure_env_key "NETSEC_UPSTREAM_URL" "${NETSEC_UPSTREAM_URL:-}"
ensure_env_key "PTERO_PORT" "${PTERO_PORT}"
ensure_env_key "SPARROWX_PUBLIC_IP" "${SPARROWX_PUBLIC_IP}"
ensure_env_key "SPARROWX_NS1" "${SPARROWX_NS1}"
ensure_env_key "SPARROWX_NS2" "${SPARROWX_NS2}"
ensure_env_key "SPARROWX_ADMIN_EMAIL" "${SPARROWX_ADMIN_EMAIL}"
ensure_env_key "PTERO_ADMIN_EMAIL" "${PTERO_ADMIN_EMAIL}"
ensure_env_key "PTERO_ADMIN_USER" "${PTERO_ADMIN_USER}"
ensure_env_key "PTERO_ADMIN_FIRSTNAME" "${PTERO_ADMIN_FIRSTNAME}"
ensure_env_key "PTERO_ADMIN_LASTNAME" "${PTERO_ADMIN_LASTNAME}"
ensure_env_key "PTERO_ADMIN_PASSWORD" "${PTERO_ADMIN_PASSWORD}"
ensure_env_key "PTERO_DB_NAME" "${PTERO_DB_NAME}"
ensure_env_key "PTERO_DB_USER" "${PTERO_DB_USER}"
ensure_env_key "PTERO_DB_PASSWORD" "${PTERO_DB_PASSWORD}"
ensure_env_key "PTERO_TIMEZONE" "${PTERO_TIMEZONE}"
ensure_env_key "HTTP_PORT" "${HTTP_PORT}"
ensure_env_key "HTTPS_PORT" "${HTTPS_PORT}"
ensure_env_key "APP_HOST_PORT" "${APP_HOST_PORT}"
ensure_env_key "PGRST_HOST_PORT" "${PGRST_HOST_PORT}"
ensure_env_key "PG_HOST_PORT" "${PG_HOST_PORT}"
ensure_env_key "PG_POOL_PORT" "${PG_POOL_PORT}"
chmod 600 "${INSTALL_DIR}/.env"

export POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB SPARROWX_JWT_SECRET SPARROWX_REDIS_SECRET \
  DOMAIN_ROOT SPARROWX_DOMAIN DOMAIN_STUDIO SPARROWX_STUDIO_DOMAIN DOMAIN_SEC DOMAIN_FILE \
  DOMAIN_PASSWORD DOMAIN_API DOMAIN_GAME DOMAIN_GAME_WEB DOMAIN_GAME_DASH DOMAIN_GAMESEC DOMAIN_NETSEC \
  GAMESEC_PORT GAMESEC_REPO_URL GAMESEC_DIR GAMESEC_UPSTREAM_URL \
  NETSEC_PORT NETSEC_REPO_URL NETSEC_DIR NETSEC_UPSTREAM_URL \
  PTERO_PORT PTERO_URL PTERO_SSO_SECRET \
  SPARROWX_PUBLIC_IP SPARROWX_NS1 SPARROWX_NS2 SPARROWX_ADMIN_EMAIL HTTP_PORT HTTPS_PORT APP_HOST_PORT \
  PGRST_HOST_PORT PG_HOST_PORT PG_POOL_PORT

ACTIVE_SSH_PORT="$(ss -tulnp 2>/dev/null | awk '/sshd/ {print $5}' | sed -E 's/.*:([0-9]+)$/\1/' | head -n 1 || echo 22)"
[ -z "${ACTIVE_SSH_PORT}" ] && ACTIVE_SSH_PORT=22

if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow "${ACTIVE_SSH_PORT}"/tcp >/dev/null 2>&1 || true
  ufw allow "${HTTP_PORT}"/tcp >/dev/null 2>&1 || true
  ufw allow "${HTTPS_PORT}"/tcp >/dev/null 2>&1 || true
  open_ptero_ufw_rules
  ufw allow in from 127.0.0.1 to any port "${GAMESEC_PORT}" proto tcp >/dev/null 2>&1 || true
  ufw allow in from 172.16.0.0/12 to any port "${GAMESEC_PORT}" proto tcp >/dev/null 2>&1 || true
  ufw allow in from 127.0.0.1 to any port "${NETSEC_PORT}" proto tcp >/dev/null 2>&1 || true
  ufw allow in from 172.16.0.0/12 to any port "${NETSEC_PORT}" proto tcp >/dev/null 2>&1 || true
  if [[ "$(echo "${ENABLE_DNS_SERVER}" | tr '[:upper:]' '[:lower:]')" == "y"* ]]; then
    ufw allow 53/tcp >/dev/null 2>&1 || true
    ufw allow 53/udp >/dev/null 2>&1 || true
  fi
  ufw --force enable >/dev/null 2>&1 || true
  log_ok "UFW Firewall configured (SSH:${ACTIVE_SSH_PORT}, HTTP:${HTTP_PORT}, HTTPS:${HTTPS_PORT}, Ptero:${PTERO_PORT} internal)."
fi

# ==============================================================================
# STEP 9: LAUNCH OR RECONCILE BACKEND FLEET (docker-compose.ovh.yml)
# ==============================================================================
step_banner 9 10 "Starting / Reconciling Backend Fleet (docker-compose.ovh.yml)"

COMPOSE_FILE="${INSTALL_DIR}/docker-compose.ovh.yml"
STACK_STARTED="no"

if [ "${DOCKER_AVAILABLE}" = "yes" ] && [ -f "${COMPOSE_FILE}" ]; then
  if [ "${SPARROWX_ALREADY_HEALTHY}" = "yes" ]; then
    # Reconcile edge proxy only so zero downtime occurs on healthy containers
    compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps --force-recreate nginx >/dev/null 2>&1 || \
      docker start sparrowx-nginx >/dev/null 2>&1 || true
    STACK_STARTED="yes"
    log_ok "Reloaded sparrowx-nginx zero-downtime while preserving running DB & App containers."
  else
    for pg_vol in $(docker volume ls -q 2>/dev/null | grep 'sparrowx_pgdata' || true); do
      vol_mp="$(docker volume inspect -f '{{.Mountpoint}}' "${pg_vol}" 2>/dev/null || true)"
      if [ -n "${vol_mp}" ] && [ -d "${vol_mp}" ] && [ ! -f "${vol_mp}/PG_VERSION" ] && [ -n "$(ls -A "${vol_mp}" 2>/dev/null)" ]; then
        docker rm -f sparrowx-postgres >/dev/null 2>&1 || true
        rm -rf "${vol_mp:?}"/* "${vol_mp:?}"/.[!.]* "${vol_mp:?}"/..?* 2>/dev/null || true
        log_warn "Cleared uninitialized/corrupted PostgreSQL volume ${pg_vol} (missing PG_VERSION)."
      fi
    done

    log_info "Building & starting PostgreSQL 16, PostgREST, SparrowX App & Nginx Edge Proxy..."
    if compose_cmd -f "${COMPOSE_FILE}" up -d --build --remove-orphans; then
      STACK_STARTED="yes"
    else
      log_warn "First launch attempt hit a conflict. Healing networks/ports & retrying..."
      compose_cmd -f "${COMPOSE_FILE}" down --remove-orphans >/dev/null 2>&1 || true
      docker network prune -f >/dev/null 2>&1 || true
      reclaim_web_ports
      HTTP_PORT="$(find_free_port "${HTTP_PORT}" 8180 "HTTP Edge Proxy" "sparrowx-nginx")"
      HTTPS_PORT="$(find_free_port "${HTTPS_PORT}" 8444 "HTTPS SSL Edge Proxy" "sparrowx-nginx")"
      APP_HOST_PORT="$(find_free_port "${APP_HOST_PORT}" 3010 "SparrowX Studio App" "sparrowx-app")"
      PGRST_HOST_PORT="$(find_free_port "${PGRST_HOST_PORT}" 3020 "PostgREST Gateway" "sparrowx-postgrest")"
      PG_HOST_PORT="$(find_free_port "${PG_HOST_PORT}" 5433 "PostgreSQL 16" "sparrowx-postgres")"
      ensure_env_key "HTTP_PORT" "${HTTP_PORT}"
      ensure_env_key "HTTPS_PORT" "${HTTPS_PORT}"
      ensure_env_key "APP_HOST_PORT" "${APP_HOST_PORT}"
      ensure_env_key "PGRST_HOST_PORT" "${PGRST_HOST_PORT}"
      ensure_env_key "PG_HOST_PORT" "${PG_HOST_PORT}"
      export HTTP_PORT HTTPS_PORT APP_HOST_PORT PGRST_HOST_PORT PG_HOST_PORT
      if compose_cmd -f "${COMPOSE_FILE}" up -d --build --remove-orphans; then
        STACK_STARTED="yes"
      fi
    fi
  fi

  if [ "${STACK_STARTED}" = "yes" ]; then
    # Re-render nginx.conf after sparrowx-nginx is up so DOCKER_HOST_IP matches live bridge gateway
    if is_pterodactyl_installed; then
      render_sparrowx_nginx_conf
      docker restart sparrowx-nginx >/dev/null 2>&1 || docker exec sparrowx-nginx nginx -s reload >/dev/null 2>&1 || true
    fi

    log_info "Verifying PostgreSQL 16 readiness & schema..."
    for _i in $(seq 1 20); do
      if docker exec sparrowx-postgres pg_isready -q >/dev/null 2>&1; then
        break
      fi
      sleep 2
    done

    if [ -f "${INSTALL_DIR}/ovh/schema.sql" ]; then
      USERS_TBL="$(docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" sparrowx-postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "SELECT to_regclass('public.app_users');" 2>/dev/null | tr -d '[:space:]' || true)"
      if [ "${USERS_TBL}" != "app_users" ] && [ "${USERS_TBL}" != "public.app_users" ]; then
        docker exec -i -e PGPASSWORD="${POSTGRES_PASSWORD}" sparrowx-postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "${INSTALL_DIR}/ovh/schema.sql" >/dev/null 2>&1 || true
        log_ok "Applied ovh/schema.sql cleanly."
      fi
    fi

    if [ -d /etc/systemd/system ]; then
      cat > /etc/systemd/system/sparrowx-stack.service <<EOF
[Unit]
Description=SparrowX Multi-Domain Stack (Docker)
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/docker compose -f ${COMPOSE_FILE} up -d
ExecStop=/usr/bin/docker compose -f ${COMPOSE_FILE} down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
      systemctl daemon-reload >/dev/null 2>&1 || true
      systemctl enable sparrowx-stack.service >/dev/null 2>&1 || true
    fi
  fi
fi

# Native Host Fallback if Docker is unavailable
if [ "${STACK_STARTED}" != "yes" ]; then
  log_warn "Docker unavailable — activating Native Host Fallback (Node.js 22)..."
  if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1 || true
    retry_pkg_install nodejs
  fi
  export NODE_OPTIONS="--max-old-space-size=2048"
  npm install --legacy-peer-deps && npm run build
  cat > /etc/systemd/system/sparrowx-native.service <<EOF
[Unit]
Description=SparrowX Native Server
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env
Environment=NODE_ENV=production
Environment=HOST=0.0.0.0
Environment=PORT=${HTTP_PORT}
ExecStart=/usr/bin/env node ${INSTALL_DIR}/ovh/node-server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload >/dev/null 2>&1 || true
  systemctl enable --now sparrowx-native.service >/dev/null 2>&1 || true
fi

ensure_gamesec_landing_running || true
ensure_netsec_dashboard_running || true

# ==============================================================================
# STEP 10: LIVE SSL, CRON FLEET & END-TO-END PING TEST + AUTO-HEALING
# ==============================================================================
step_banner 10 10 "Issuing Live Let's Encrypt SSL, Cron Jobs & Live Ping Auto-Heal"

if [[ "$(echo "${ENABLE_CRON_SSL}" | tr '[:upper:]' '[:lower:]')" == "y"* ]]; then
  cat > /etc/cron.d/sparrowx-automation <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# 1. Autonomous Watchdog: Pings & auto-heals ports/containers + Pterodactyl every 2 minutes
*/2 * * * * root ${INSTALL_DIR}/deploy/watchdog.sh >/dev/null 2>&1

# 2. Let's Encrypt SSL Auto-Issuer & Renewer every 12 hours
0 */12 * * * root ${INSTALL_DIR}/deploy/ssl-renew.sh >/dev/null 2>&1

# 3. Daily PostgreSQL Backup at 02:00 AM
0 2 * * * root ${INSTALL_DIR}/deploy/backup-all-dbs.sh >/dev/null 2>&1

# 4. Ephemeral temp cleanup every 30 minutes
*/30 * * * * root find /tmp -name "sparrowx-*" -mmin +60 -delete >/dev/null 2>&1
EOF
  chmod 644 /etc/cron.d/sparrowx-automation
  systemctl restart cron >/dev/null 2>&1 || systemctl restart crond >/dev/null 2>&1 || true
  log_ok "Autonomous cron jobs installed (/etc/cron.d/sparrowx-automation)."

  log_info "Checking DNS propagation & requesting Let's Encrypt SSL certificates..."
  ensure_game_letsencrypt_ssl
  bash "${INSTALL_DIR}/deploy/ssl-renew.sh" || true
fi

ln -sf "${INSTALL_DIR}/manage-db.sh" /usr/local/bin/sparrowx-db 2>/dev/null || true
ln -sf "${INSTALL_DIR}/update.sh" /usr/local/bin/sparrowx-update 2>/dev/null || true
ln -sf "${INSTALL_DIR}/fix.sh" /usr/local/bin/sparrowx-fix 2>/dev/null || true
ln -sf "${INSTALL_DIR}/deploy/watchdog.sh" /usr/local/bin/sparrowx-heal 2>/dev/null || true

# Seed DB only if app_users table has no rows yet
if [ "${DOCKER_AVAILABLE}" = "yes" ] && [ -x "${INSTALL_DIR}/manage-db.sh" ]; then
  if ! curl -fsS "http://127.0.0.1:${PGRST_HOST_PORT}/app_users?select=id&limit=1" 2>/dev/null | grep -q '"id"'; then
    "${INSTALL_DIR}/manage-db.sh" sync >/dev/null 2>&1 || true
  fi
fi

probe_and_heal() {
  local label="$1"
  local url="$2"
  local host_header="${3:-}"
  local heal_kind="${4:-sparrowx}"
  local code="000"

  if [ -n "${host_header}" ]; then
    code="$(curl -sk -o /dev/null -w "%{http_code}" --max-time 6 -H "Host: ${host_header}" "${url}" 2>/dev/null || echo "000")"
  else
    code="$(curl -sk -o /dev/null -w "%{http_code}" --max-time 6 "${url}" 2>/dev/null || echo "000")"
  fi

  if [ "${code}" = "200" ] || [ "${code}" = "301" ] || [ "${code}" = "302" ] || [ "${code}" = "307" ]; then
    log_ok "${label} -> ${C_GREEN}LIVE (HTTP ${code})${C_RESET}"
    return 0
  fi

  log_warn "${label} returned HTTP ${code}. Running deep port-flow & connectivity healer..."
  if [ "${heal_kind}" = "ptero" ]; then
    heal_pterodactyl_port_flow
  else
    [ -x "${INSTALL_DIR}/deploy/watchdog.sh" ] && bash "${INSTALL_DIR}/deploy/watchdog.sh" >/dev/null 2>&1 || true
    if [ -x "${INSTALL_DIR}/fix.sh" ]; then
      bash "${INSTALL_DIR}/fix.sh" --auto >/dev/null 2>&1 || true
    fi
  fi
  sleep 3

  if [ -n "${host_header}" ]; then
    code="$(curl -sk -o /dev/null -w "%{http_code}" --max-time 6 -H "Host: ${host_header}" "${url}" 2>/dev/null || echo "000")"
  else
    code="$(curl -sk -o /dev/null -w "%{http_code}" --max-time 6 "${url}" 2>/dev/null || echo "000")"
  fi

  if [ "${code}" = "200" ] || [ "${code}" = "301" ] || [ "${code}" = "302" ] || [ "${code}" = "307" ]; then
    log_ok "${label} -> ${C_GREEN}AUTO-FIXED & LIVE (HTTP ${code})${C_RESET}"
    return 0
  else
    log_err "${label} -> HTTP ${code} (check DNS or logs via ./deploy/check-status.sh)"
    return 1
  fi
}

echo ""
log_info "Running Live Ping & End-to-End Endpoint Verification..."
sleep 3
probe_and_heal "App Engine (Internal)"          "http://127.0.0.1:${APP_HOST_PORT}/api/v1/health"
probe_and_heal "PostgREST API (Internal)"       "http://127.0.0.1:${PGRST_HOST_PORT}/"
probe_and_heal "Main Hub (${DOMAIN_ROOT})"      "https://127.0.0.1:${HTTPS_PORT}/" "${DOMAIN_ROOT}"
probe_and_heal "Cloud DB (${DOMAIN_STUDIO})"    "https://127.0.0.1:${HTTPS_PORT}/" "${DOMAIN_STUDIO}"
probe_and_heal "Shield WAF (${DOMAIN_SEC})"     "https://127.0.0.1:${HTTPS_PORT}/" "${DOMAIN_SEC}"
probe_and_heal "File Vault (${DOMAIN_FILE})"    "https://127.0.0.1:${HTTPS_PORT}/" "${DOMAIN_FILE}"
probe_and_heal "Keys (${DOMAIN_PASSWORD})"      "https://127.0.0.1:${HTTPS_PORT}/" "${DOMAIN_PASSWORD}"
probe_and_heal "API (${DOMAIN_API})"            "https://127.0.0.1:${HTTPS_PORT}/" "${DOMAIN_API}"
probe_and_heal "Game Hosting (${DOMAIN_GAME_WEB})"  "https://127.0.0.1:${HTTPS_PORT}/" "${DOMAIN_GAME_WEB}"
probe_and_heal "Game Client Dash (${DOMAIN_GAME_DASH})" "https://127.0.0.1:${HTTPS_PORT}/" "${DOMAIN_GAME_DASH}"
probe_and_heal "Game DDoS Defense (${DOMAIN_GAMESEC})" "https://127.0.0.1:${HTTPS_PORT}/" "${DOMAIN_GAMESEC}"
probe_and_heal "Network DDoS Dash (${DOMAIN_NETSEC})" "https://127.0.0.1:${HTTPS_PORT}/" "${DOMAIN_NETSEC}"
if is_pterodactyl_installed; then
  probe_and_heal "Pterodactyl Internal (: ${PTERO_PORT})" "http://127.0.0.1:${PTERO_PORT}/" "${DOMAIN_GAME}" "ptero"
  probe_and_heal "Game Panel (${DOMAIN_GAME})"            "https://127.0.0.1:${HTTPS_PORT}/" "${DOMAIN_GAME}" "ptero"
fi
probe_and_heal "Public IP (${SPARROWX_PUBLIC_IP})" "http://${SPARROWX_PUBLIC_IP}:${HTTP_PORT}/"

HTTP_SUFFIX=""
[ "${HTTP_PORT}" != "80" ] && HTTP_SUFFIX=":${HTTP_PORT}"
HTTPS_SUFFIX=""
[ "${HTTPS_PORT}" != "443" ] && HTTPS_SUFFIX=":${HTTPS_PORT}"

echo ""
echo -e "${C_ORANGE}========================================================================${C_RESET}"
echo -e "${C_GREEN}  ✓ SPARROWX FULL-STACK + PTERODACTYL PORT FLOW ARMED ON THIS SERVER   ${C_RESET}"
echo -e "${C_ORANGE}========================================================================${C_RESET}"
echo -e "  ${C_BOLD}LIVE WEB ENDPOINTS:${C_RESET}"
echo -e "    • Company Hub    : ${C_CYAN}https://${DOMAIN_ROOT}${HTTPS_SUFFIX}${C_RESET}"
echo -e "    • Cloud DB       : ${C_CYAN}https://${DOMAIN_STUDIO}${HTTPS_SUFFIX}${C_RESET}"
echo -e "    • Shield WAF     : ${C_CYAN}https://${DOMAIN_SEC}${HTTPS_SUFFIX}${C_RESET}"
echo -e "    • File Drop/Vault: ${C_CYAN}https://${DOMAIN_FILE}${HTTPS_SUFFIX}${C_RESET}"
echo -e "    • Offline Keys   : ${C_CYAN}https://${DOMAIN_PASSWORD}${HTTPS_SUFFIX}${C_RESET}"
echo -e "    • API Gateway    : ${C_CYAN}https://${DOMAIN_API}${HTTPS_SUFFIX}${C_RESET}"
echo -e "    • Game Hosting   : ${C_CYAN}https://${DOMAIN_GAME_WEB}${HTTPS_SUFFIX}${C_RESET}"
echo -e "    • Game Client    : ${C_CYAN}https://${DOMAIN_GAME_DASH}${HTTPS_SUFFIX}${C_RESET}"
echo -e "    • Game DDoS Prot : ${C_CYAN}https://${DOMAIN_GAMESEC}${HTTPS_SUFFIX}${C_RESET}"
echo -e "    • Net DDoS Dash  : ${C_CYAN}https://${DOMAIN_NETSEC}${HTTPS_SUFFIX}${C_RESET}"
if is_pterodactyl_installed; then
  echo -e "    • Game Panel     : ${C_GREEN}https://${DOMAIN_GAME}${HTTPS_SUFFIX}${C_RESET} -> Host Nginx :${PTERO_PORT}"
else
  echo -e "    • Game Panel     : ${C_DIM}https://${DOMAIN_GAME}${HTTPS_SUFFIX} (run './setup.sh --ptero' or './fix.sh' anytime to install)${C_RESET}"
fi
echo -e "    • Direct IP      : ${C_WHITE}http://${SPARROWX_PUBLIC_IP}${HTTP_SUFFIX}${C_RESET}"
write_ptero_credentials_file
echo ""
echo -e "  ${C_YELLOW}${C_BOLD}ALL CREDENTIALS & DATABASE INFO USED:${C_RESET}"
if is_pterodactyl_installed; then
  echo -e "    • Panel Login URL  : ${C_WHITE}https://${DOMAIN_GAME}${HTTPS_SUFFIX}${C_RESET}"
  echo -e "    • Panel Admin Email: ${C_CYAN}${PTERO_ADMIN_EMAIL}${C_RESET}"
  echo -e "    • Panel Admin User : ${C_CYAN}${PTERO_ADMIN_USER}${C_RESET}"
  echo -e "    • Panel Admin Pass : ${C_YELLOW}${PTERO_ADMIN_PASSWORD}${C_RESET}"
  echo -e "    • Ptero MySQL Host : ${C_WHITE}127.0.0.1:3306${C_RESET}"
  echo -e "    • Ptero MySQL DB   : ${C_WHITE}${PTERO_DB_NAME}${C_RESET}"
  echo -e "    • Ptero MySQL User : ${C_WHITE}${PTERO_DB_USER}${C_RESET}"
  echo -e "    • Ptero MySQL Pass : ${C_YELLOW}${PTERO_DB_PASSWORD}${C_RESET}"
fi
echo -e "    • Postgres Host    : ${C_WHITE}127.0.0.1:${PG_HOST_PORT}${C_RESET}"
echo -e "    • Postgres DB/User : ${C_WHITE}${POSTGRES_DB} / ${POSTGRES_USER}${C_RESET}"
echo -e "    • Postgres Pass    : ${C_YELLOW}${POSTGRES_PASSWORD}${C_RESET}"
echo -e "    • Saved Creds File : ${C_WHITE}/root/.sparrowx-ptero-credentials.txt${C_RESET}"
echo ""
echo -e "  ${C_BOLD}CLI TOOLS:${C_RESET}"
echo -e "    • Watchdog (2m)  : ${C_DIM}${INSTALL_DIR}/deploy/watchdog.sh${C_RESET} (or ${C_BOLD}sparrowx-heal${C_RESET})"
echo -e "    • Auto-Heal (fix): ${C_BOLD}sparrowx-fix${C_RESET}   |  DB Studio TUI: ${C_BOLD}sparrowx-db${C_RESET}"
echo -e "    • 1-Click Update : ${C_BOLD}sparrowx-update${C_RESET}"
echo -e "${C_ORANGE}========================================================================${C_RESET}"
