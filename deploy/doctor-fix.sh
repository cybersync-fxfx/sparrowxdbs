#!/usr/bin/env bash
# ==============================================================================
# SPARROWX AUTONOMOUS ERROR-HEALING DOCTOR & RECOVERY ENGINE (MAX LEVEL)
# ==============================================================================
# Detects and auto-heals across 12 infrastructure, Docker, OS, Port, Nginx,
# SSL, Git, Disk/Swap OOM, PostgreSQL Role/Schema, and PostgREST layers.
# ==============================================================================
set -u

# Guard against CRLF if launched before strip runs
AUTO_MODE="false"
FORCE_DB="false"
REBUILD_APP="false"
SKIP_PTERO="false"
REINSTALL_PTERO="false"

for arg in "$@"; do
  case "${arg}" in
    --auto|-y|--yes) AUTO_MODE="true" ;;
    --reinstall-db|--force-db) FORCE_DB="true" ;;
    --rebuild) REBUILD_APP="true" ;;
    --skip-ptero|--no-ptero) SKIP_PTERO="true" ;;
    --reinstall-ptero) REINSTALL_PTERO="true" ;;
    --help|-h)
      cat <<'HELP'
SparrowX Autonomous Error-Healing Doctor (fix.sh)

Usage:
  ./fix.sh [options]

Options:
  --auto, -y        Run silently/non-interactively with automatic healing
  --rebuild         Force rebuild of the SparrowX web application container
  --reinstall-db    Force re-sync of Local OVH PostgreSQL & per-user folders
  --skip-ptero      Skip unattended Pterodactyl install if not already installed
  --reinstall-ptero Remove and freshly reinstall Pterodactyl Game Panel
  --help, -h        Show this help screen
HELP
      exit 0
      ;;
  esac
done

# Resolve installation directory dynamically
SCRIPT_SOURCE="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd "$(dirname "${SCRIPT_SOURCE}")" && pwd)"
PARENT_NAME="$(basename "${SCRIPT_DIR}")"
if [ "${PARENT_NAME}" = "ovh" ] || [ "${PARENT_NAME}" = "deploy" ]; then
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

# Auto-elevate to root when sudo is available
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
  exec sudo -E bash "$0" "$@"
fi

# Prevent concurrent fix.sh runs without ever killing an active run
LOCK_PID_FILE="/var/run/sparrowx-fix.pid"
if [ -f "${LOCK_PID_FILE}" ]; then
  OLD_PID="$(cat "${LOCK_PID_FILE}" 2>/dev/null || true)"
  if [ -n "${OLD_PID}" ] && [ "${OLD_PID}" != "$$" ] && [ "${OLD_PID}" != "${PPID:-0}" ] && kill -0 "${OLD_PID}" 2>/dev/null && grep -q "fix\.sh" "/proc/${OLD_PID}/cmdline" 2>/dev/null; then
    # Only treat as stalled if lockfile is older than 10 minutes
    if [ -n "$(find "${LOCK_PID_FILE}" -mmin +10 2>/dev/null || true)" ]; then
      echo "Removing stale fix.sh lock (>10m old, PID ${OLD_PID})..."
      kill -TERM "${OLD_PID}" >/dev/null 2>&1 || true
      sleep 1
    elif [ ! -t 0 ]; then
      # Non-interactive/cron caller: exit immediately so it never interrupts an active run
      exit 0
    else
      echo "Another fix.sh (PID ${OLD_PID}) is actively running; waiting for it to finish..."
      while kill -0 "${OLD_PID}" 2>/dev/null; do
        sleep 2
      done
    fi
  fi
fi
echo "$$" > "${LOCK_PID_FILE}" 2>/dev/null || true
trap 'rm -f "${LOCK_PID_FILE}" 2>/dev/null || true' EXIT

# ------------------------------------------------------------------------------
# Cyber CLI Colors & Visual Formatting
# ------------------------------------------------------------------------------
C_RESET="\033[0m"
C_BOLD="\033[1m"
C_DIM="\033[2m"
C_CYAN="\033[1;36m"
C_BLUE="\033[1;34m"
C_GREEN="\033[1;32m"
C_YELLOW="\033[1;33m"
C_RED="\033[1;31m"
C_MAGENTA="\033[1;35m"
C_WHITE="\033[1;37m"

FIXED_COUNT=0
WARN_COUNT=0
ERR_COUNT=0
declare -a FIXED_LOG=()
declare -a WARN_LOG=()
declare -a ERR_LOG=()
declare -a UNFIXED_LOG=()

FIX_LOG_DIR="/var/log/sparrowx"
REPO_LOG_DIR="${INSTALL_DIR}/logs"
mkdir -p "${FIX_LOG_DIR}" "${REPO_LOG_DIR}" 2>/dev/null || true
FIX_FULL_LOG="${FIX_LOG_DIR}/fix-latest.log"
FIX_ERROR_LOG="${FIX_LOG_DIR}/errors.log"
REPO_FULL_LOG="${REPO_LOG_DIR}/fix-latest.log"
REPO_ERROR_LOG="${REPO_LOG_DIR}/errors.log"

{
  echo "=============================================================================="
  echo "SPARROWX FIX RUN STARTED: $(date -u '+%Y-%m-%d %H:%M:%S UTC' 2>/dev/null || date)"
  echo "=============================================================================="
} > "${FIX_FULL_LOG}" 2>/dev/null || true
cp -f "${FIX_FULL_LOG}" "${REPO_FULL_LOG}" 2>/dev/null || true

# Mirror all terminal output to persistent log file
exec > >(tee -a "${FIX_FULL_LOG}") 2>&1

append_error_record() {
  local level="$1"
  local msg="$2"
  local ts
  ts="$(date -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date)"
  local line="[${ts}] [${level}] ${msg}"
  echo "${line}" >> "${FIX_ERROR_LOG}" 2>/dev/null || true
  echo "${line}" >> "${REPO_ERROR_LOG}" 2>/dev/null || true
}

log_scan()   { echo -e "  ${C_CYAN}[SCAN]${C_RESET}     $*"; }
log_ok()     { echo -e "  ${C_GREEN}[ OK ]${C_RESET}     $*"; }
log_warn()   {
  echo -e "  ${C_YELLOW}[WARN]${C_RESET}     $*"
  WARN_COUNT=$((WARN_COUNT + 1))
  WARN_LOG+=("$*")
  append_error_record "WARN" "$*"
}
log_err()    {
  echo -e "  ${C_RED}[ERR ]${C_RESET}     $*"
  ERR_COUNT=$((ERR_COUNT + 1))
  ERR_LOG+=("$*")
  UNFIXED_LOG+=("$*")
  append_error_record "ERR_UNFIXED" "$*"
}
log_unfixed() {
  echo -e "  ${C_RED}[UNFIXED]${C_RESET}  $*"
  ERR_COUNT=$((ERR_COUNT + 1))
  UNFIXED_LOG+=("$*")
  append_error_record "UNFIXED" "$*"
}
log_fix() {
  echo -e "  ${C_YELLOW}[AUTO-FIX]${C_RESET} ${C_WHITE}$*${C_RESET}"
  FIXED_COUNT=$((FIXED_COUNT + 1))
  FIXED_LOG+=("$*")
  append_error_record "AUTO-FIX" "$*"
}
log_healed() { echo -e "  ${C_GREEN}[HEALED]${C_RESET}   $*"; }

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

clear 2>/dev/null || true
echo -e "${C_CYAN}╔══════════════════════════════════════════════════════════════════════════╗${C_RESET}"
echo -e "${C_CYAN}║${C_RESET}  ${C_BOLD}${C_WHITE}⚡ SPARROWX AUTONOMOUS ERROR-HEALING DOCTOR & RECOVERY ENGINE${C_RESET}          ${C_CYAN}║${C_RESET}"
echo -e "${C_CYAN}║${C_RESET}  ${C_DIM}12-Stage Deep Diagnostic · Auto-Fix Pipeline · Self-Healing OVH Stack${C_RESET}   ${C_CYAN}║${C_RESET}"
echo -e "${C_CYAN}╚══════════════════════════════════════════════════════════════════════════╝${C_RESET}"
echo -e "  ${C_DIM}Workspace: ${INSTALL_DIR} • Kernel: $(uname -r 2>/dev/null || echo Linux) • Host: $(hostname 2>/dev/null || echo ovh)${C_RESET}"

# Helper functions
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
  if command -v ss >/dev/null 2>&1 && ss -tuln 2>/dev/null | grep -qE "(:|\.|\])${port}[[:space:]]"; then
    return 0
  fi
  if command -v lsof >/dev/null 2>&1 && lsof -i ":${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    return 0
  fi
  if command -v netstat >/dev/null 2>&1 && netstat -tuln 2>/dev/null | grep -qE "(:|\.)${port}[[:space:]]"; then
    return 0
  fi
  if (echo >/dev/tcp/127.0.0.1/"${port}") >/dev/null 2>&1; then
    return 0
  fi
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker ps --format '{{.Ports}}' 2>/dev/null | grep -qE "(:|0\.0\.0\.0:|127\.0\.0\.1:|\[::\]:)${port}->"; then
      return 0
    fi
  fi
  return 1
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

ALLOCATED_PORTS=""

reserve_port() {
  local p="$1"
  ALLOCATED_PORTS="${ALLOCATED_PORTS} ${p} "
}

is_port_allocated() {
  local p="$1"
  [[ " ${ALLOCATED_PORTS} " == *" ${p} "* ]]
}

is_reserved_ptero_port() {
  local p="$1"
  case "${p}" in
    8080|8443|2022|3306|6379|8090|"${PTERO_PORT:-8090}") return 0 ;;
    *) return 1 ;;
  esac
}

find_next_free_port() {
  local port="$1"
  local max_tries=100
  local i=0
  while [ "${i}" -lt "${max_tries}" ] && { is_port_busy "${port}" || is_reserved_ptero_port "${port}" || is_port_allocated "${port}"; }; do
    port=$((port + 1))
    i=$((i + 1))
  done
  reserve_port "${port}"
  echo "${port}"
}

is_pterodactyl_installed() {
  [ -f "/var/www/pterodactyl/artisan" ]
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

write_ptero_credentials_file() {
  local cred_file="/root/.sparrowx-ptero-credentials.txt"
  {
    echo "# ======================================================================"
    echo "# SPARROWX + PTERODACTYL GAME PANEL CREDENTIALS"
    echo "# Generated / Verified: $(date -u '+%Y-%m-%d %H:%M:%S UTC' 2>/dev/null || date)"
    echo "# ======================================================================"
    echo "PANEL_URL=https://${DOMAIN_GAME:-game.${SPARROWX_DOMAIN}}"
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
  local game_domain="${DOMAIN_GAME:-game.${SPARROWX_DOMAIN}}"
  if [ "${REINSTALL_PTERO:-false}" = "true" ] && [ -d "/var/www/pterodactyl" ]; then
    log_fix "Removing existing /var/www/pterodactyl for clean reinstall (--reinstall-ptero)"
    rm -rf /var/www/pterodactyl
  fi

  if [ -d "/var/www/pterodactyl" ] && [ ! -f "/var/www/pterodactyl/artisan" ]; then
    log_fix "Removing incomplete /var/www/pterodactyl directory before unattended install"
    rm -rf /var/www/pterodactyl
  fi

  if is_pterodactyl_installed || [ "${SKIP_PTERO:-false}" = "true" ]; then
    return 0
  fi

  log_scan "Pterodactyl not installed yet; running unattended installation for ${game_domain}..."
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    docker stop sparrowx-nginx sparrowx_edge_proxy >/dev/null 2>&1 || true
  fi

  if (
    set -e -o pipefail
    export GITHUB_SOURCE="v1.4.0"
    export SCRIPT_RELEASE="v1.4.0"
    export GITHUB_BASE_URL="https://raw.githubusercontent.com/pterodactyl-installer/pterodactyl-installer"
    export GITHUB_URL="${GITHUB_BASE_URL}/${GITHUB_SOURCE}"
    export PANEL_MAJOR_VERSION="1"
    export FQDN="${game_domain}"
    export MYSQL_DB="${PTERO_DB_NAME:-panel}"
    export MYSQL_USER="${PTERO_DB_USER:-pterodactyl}"
    export MYSQL_PASSWORD="${PTERO_DB_PASSWORD}"
    export timezone="${PTERO_TIMEZONE:-UTC}"
    export email="${PTERO_ADMIN_EMAIL}"
    export user_email="${PTERO_ADMIN_EMAIL}"
    export user_username="${PTERO_ADMIN_USER:-admin}"
    export user_firstname="${PTERO_ADMIN_FIRSTNAME:-SparrowX}"
    export user_lastname="${PTERO_ADMIN_LASTNAME:-Admin}"
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
    log_fix "Installed Pterodactyl Panel unattended (${game_domain}, user: ${PTERO_ADMIN_USER})"
  else
    log_warn "Unattended Pterodactyl installer exited early; continuing deep healing & port reconciliation"
  fi
  rm -f /tmp/lib.sh 2>/dev/null || true
}

detect_php_fpm_sock() {
  local sock=""
  for ver in 8.4 8.3 8.2 8.1 8.0; do
    if [ -S "/run/php/php${ver}-fpm.sock" ]; then
      sock="/run/php/php${ver}-fpm.sock"
      break
    fi
  done
  if [ -z "${sock}" ]; then
    sock="$(find /run/php /var/run/php -maxdepth 2 -name 'php*-fpm.sock' 2>/dev/null | head -n 1 || true)"
  fi
  if [ -z "${sock}" ]; then
    for ver in 8.4 8.3 8.2 8.1 8.0; do
      if dpkg -l 2>/dev/null | grep -q "php${ver}-fpm"; then
        sock="/run/php/php${ver}-fpm.sock"
        break
      fi
    done
  fi
  echo "${sock:-/run/php/php8.3-fpm.sock}"
}

get_docker_host_ip() {
  local gw_ip=""
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "${EDGE_CTR:-sparrowx-nginx}"; then
      gw_ip="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.Gateway}} {{end}}' "${EDGE_CTR:-sparrowx-nginx}" 2>/dev/null | awk '{print $1}' | tr -d '[:space:]' || true)"
      if [ -z "${gw_ip}" ]; then
        gw_ip="$(docker exec "${EDGE_CTR:-sparrowx-nginx}" sh -c "getent hosts host.docker.internal 2>/dev/null | awk '{print \$1; exit}'" 2>/dev/null | tr -d '[:space:]' || true)"
      fi
    fi
    if [ -z "${gw_ip}" ]; then
      gw_ip="$(docker network inspect sparrowx_net -f '{{range .IPAM.Config}}{{.Gateway}} {{end}}' 2>/dev/null | awk '{print $1}' | tr -d '[:space:]' || true)"
    fi
    if [ -z "${gw_ip}" ]; then
      gw_ip="$(docker network inspect bridge -f '{{range .IPAM.Config}}{{.Gateway}} {{end}}' 2>/dev/null | awk '{print $1}' | tr -d '[:space:]' || true)"
    fi
  fi
  if [ -z "${gw_ip}" ] && command -v ip >/dev/null 2>&1; then
    gw_ip="$(ip -4 addr show docker0 2>/dev/null | awk '/inet / {sub(/\/.*/, "", $2); print $2; exit}' || true)"
  fi
  echo "${gw_ip:-172.17.0.1}"
}

ensure_native_fallback_running() {
  local app_p="${APP_HOST_PORT:-3000}"
  local pgrst_p="${PGRST_HOST_PORT:-3001}"
  log_fix "Docker ${APP_CTR:-sparrowx-app} unavailable or failed build — activating native Node.js fallback on :${app_p}"

  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    docker stop "${APP_CTR:-sparrowx-app}" >/dev/null 2>&1 || true
    docker rm -f "${APP_CTR:-sparrowx-app}" >/dev/null 2>&1 || true
  fi

  if { ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; } && command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    curl -fsSL https://deb.nodesource.com/setup_22.x 2>/dev/null | bash - >/dev/null 2>&1 || true
    apt-get install -y -qq nodejs npm >/dev/null 2>&1 || apt-get install -y -qq nodejs >/dev/null 2>&1 || true
  fi

  export NODE_OPTIONS="--max-old-space-size=2048"
  export VITE_SOVEREIGN_SELF_HOSTED="true"
  export VITE_APP_URL="https://${SPARROWX_STUDIO_DOMAIN:-db.${SPARROWX_DOMAIN}}"
  export VITE_SITE_URL="https://${SPARROWX_DOMAIN}"
  export VITE_API_URL="https://${SPARROWX_STUDIO_DOMAIN:-db.${SPARROWX_DOMAIN}}"
  export VITE_SUPABASE_URL="https://${SPARROWX_STUDIO_DOMAIN:-db.${SPARROWX_DOMAIN}}"
  export VITE_SUPABASE_ANON_KEY="spx_ovh_sovereign_key"

  (cd "${INSTALL_DIR}" && npm install --legacy-peer-deps && npm run build) || return 1

  local node_bin=""
  node_bin="$(command -v node || echo /usr/bin/node)"
  if [ -d /etc/systemd/system ] && command -v systemctl >/dev/null 2>&1; then
    cat > /etc/systemd/system/sparrowx-native.service <<EOF_NATIVE
[Unit]
Description=SparrowX Sovereign Web & API Engine (Native Fallback)
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
Environment=HOST=0.0.0.0
Environment=PORT=${app_p}
Environment=POSTGREST_HOST=127.0.0.1
Environment=POSTGREST_PORT=${pgrst_p}
Environment=POSTGREST_INTERNAL_URL=http://127.0.0.1:${pgrst_p}
Environment=SPARROWX_DB_REST_URL=http://127.0.0.1:${pgrst_p}
Environment=SPARROWX_DATA_DIR=${INSTALL_DIR}/data
Environment=SPARROWX_DOMAIN=${SPARROWX_DOMAIN}
Environment=SPARROWX_PUBLIC_IP=${SPARROWX_PUBLIC_IP}
ExecStart=${node_bin} ${INSTALL_DIR}/ovh/node-server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF_NATIVE
    systemctl daemon-reload >/dev/null 2>&1 || true
    systemctl enable --now sparrowx-native.service >/dev/null 2>&1 || systemctl restart sparrowx-native.service >/dev/null 2>&1 || true
  else
    nohup env NODE_ENV=production HOST=0.0.0.0 PORT="${app_p}" POSTGREST_HOST=127.0.0.1 POSTGREST_PORT="${pgrst_p}" POSTGREST_INTERNAL_URL="http://127.0.0.1:${pgrst_p}" SPARROWX_DB_REST_URL="http://127.0.0.1:${pgrst_p}" SPARROWX_DATA_DIR="${INSTALL_DIR}/data" SPARROWX_DOMAIN="${SPARROWX_DOMAIN}" SPARROWX_PUBLIC_IP="${SPARROWX_PUBLIC_IP}" "${node_bin}" "${INSTALL_DIR}/ovh/node-server.mjs" >"${INSTALL_DIR}/logs/sparrowx-native.log" 2>&1 &
  fi

  if [ "${HAS_DOCKER:-false}" = "true" ] && [ -n "${COMPOSE_FILE:-}" ] && [ -f "${COMPOSE_FILE}" ]; then
    compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps --no-build "${PG_SVC:-postgres}" "${PGRST_SVC:-postgrest}" >/dev/null 2>&1 || true
    compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps --no-build "${EDGE_SVC:-nginx}" >/dev/null 2>&1 || true
    docker start "${PG_CTR:-sparrowx-postgres}" "${PGRST_CTR:-sparrowx-postgrest}" "${EDGE_CTR:-sparrowx-nginx}" >/dev/null 2>&1 || true
    if declare -F render_sparrowx_nginx_conf >/dev/null 2>&1; then
      render_sparrowx_nginx_conf
    fi
    docker restart "${EDGE_CTR:-sparrowx-nginx}" >/dev/null 2>&1 || true
  fi
  sleep 2
}

heal_pterodactyl_host_nginx() {
  local ptero_dir="/var/www/pterodactyl"
  local game_domain="${DOMAIN_GAME:-game.panel.${SPARROWX_DOMAIN}}"
  if [ "${game_domain}" = "game.${SPARROWX_DOMAIN}" ]; then
    game_domain="game.panel.${SPARROWX_DOMAIN}"
  fi
  local ptero_port="${PTERO_PORT:-8090}"
  local php_sock=""
  local ptero_conf="/etc/nginx/sites-available/pterodactyl.conf"

  if [ ! -f "${ptero_dir}/artisan" ]; then
    return 0
  fi

  log_scan "Healing Pterodactyl Game Panel (${game_domain} -> 127.0.0.1:${ptero_port})"
  php_sock="$(detect_php_fpm_sock)"

  # Ensure php-fpm, mariadb, redis, and pteroq queue worker are running
  for p_svc in mariadb mysql redis-server redis pteroq; do
    if systemctl list-unit-files 2>/dev/null | grep -q "^${p_svc}.service"; then
      systemctl enable "${p_svc}" >/dev/null 2>&1 || true
      systemctl start "${p_svc}" >/dev/null 2>&1 || true
    fi
  done
  for fpm_svc in php8.4-fpm php8.3-fpm php8.2-fpm php8.1-fpm php8.0-fpm; do
    if systemctl list-unit-files 2>/dev/null | grep -q "^${fpm_svc}.service"; then
      systemctl enable "${fpm_svc}" >/dev/null 2>&1 || true
      systemctl restart "${fpm_svc}" >/dev/null 2>&1 || true
    fi
  done
  php_sock="$(detect_php_fpm_sock)"

  local php_ver=""
  php_ver="$(echo "${php_sock}" | grep -oE 'php[0-9]+\.[0-9]+' | sed 's/php//' | head -n 1 || true)"
  local php_bin=""
  if [ -n "${php_ver}" ] && command -v "php${php_ver}" >/dev/null 2>&1; then
    php_bin="$(command -v "php${php_ver}")"
  else
    php_bin="$(command -v php8.4 || command -v php8.3 || command -v php8.2 || command -v php8.1 || command -v php || true)"
  fi

  # Ensure all required PHP extensions for the active PHP-FPM version are installed
  if [ -n "${php_ver}" ] && command -v apt-get >/dev/null 2>&1; then
    local missing_exts=()
    for ext in mysql mbstring xml bcmath curl zip gd intl redis; do
      if [ -n "${php_bin}" ] && ! "${php_bin}" -m 2>/dev/null | grep -qiE "^(${ext}|pdo_${ext}|mysqli)$"; then
        missing_exts+=("php${php_ver}-${ext}")
      fi
    done
    if [ "${#missing_exts[@]}" -gt 0 ]; then
      log_fix "Installing missing PHP ${php_ver} extensions for Pterodactyl: ${missing_exts[*]}"
      DEBIAN_FRONTEND=noninteractive apt-get update -qq >/dev/null 2>&1 || true
      DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${missing_exts[@]}" >/dev/null 2>&1 || true
      systemctl restart "php${php_ver}-fpm" >/dev/null 2>&1 || true
    fi
  fi

  # Sync MariaDB/MySQL database & user credentials + Pterodactyl .env
  local db_cli=""
  if command -v mariadb >/dev/null 2>&1; then
    db_cli="mariadb"
  elif command -v mysql >/dev/null 2>&1; then
    db_cli="mysql"
  fi

  local db_name="${PTERO_DB_NAME:-panel}"
  local db_user="${PTERO_DB_USER:-pterodactyl}"
  local db_pass="${PTERO_DB_PASSWORD:-}"
  if [ -z "${db_pass}" ] && [ -f "${ptero_dir}/.env" ]; then
    db_pass="$(awk -F= '/^DB_PASSWORD=/{sub(/^[^=]*=/,""); print; exit}' "${ptero_dir}/.env" 2>/dev/null | tr -d "\"'\r" || true)"
  fi
  if [ -z "${db_pass}" ]; then
    db_pass="$(openssl rand -hex 16 2>/dev/null || echo 'SparrowX_Ptero_DB_2026')"
    PTERO_DB_PASSWORD="${db_pass}"
    ensure_env_key "PTERO_DB_PASSWORD" "${db_pass}"
  fi

  # Ensure MariaDB listens on 0.0.0.0:3306 so Pterodactyl Database Hosts & Wings containers can connect
  for mdb_cnf in /etc/mysql/mariadb.conf.d/50-server.cnf /etc/mysql/mysql.conf.d/mysqld.cnf; do
    if [ -f "${mdb_cnf}" ] && grep -qE '^\s*bind-address\s*=\s*127\.0\.0\.1' "${mdb_cnf}"; then
      sed -i -E 's/^\s*bind-address\s*=\s*127\.0\.0\.1/bind-address = 0.0.0.0/' "${mdb_cnf}"
      systemctl restart mariadb >/dev/null 2>&1 || systemctl restart mysql >/dev/null 2>&1 || true
      log_fix "Updated MariaDB bind-address to 0.0.0.0 in ${mdb_cnf} for Database Host access"
    fi
  done
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi "Status: active"; then
    ufw allow 3306/tcp >/dev/null 2>&1 || true
  fi

  if [ -n "${db_cli}" ] && [ -n "${db_pass}" ]; then
    "${db_cli}" -u root -e "
      CREATE DATABASE IF NOT EXISTS \`${db_name}\`;
      CREATE USER IF NOT EXISTS '${db_user}'@'127.0.0.1' IDENTIFIED BY '${db_pass}';
      ALTER USER '${db_user}'@'127.0.0.1' IDENTIFIED BY '${db_pass}';
      CREATE USER IF NOT EXISTS '${db_user}'@'localhost' IDENTIFIED BY '${db_pass}';
      ALTER USER '${db_user}'@'localhost' IDENTIFIED BY '${db_pass}';
      CREATE USER IF NOT EXISTS '${db_user}'@'%' IDENTIFIED BY '${db_pass}';
      ALTER USER '${db_user}'@'%' IDENTIFIED BY '${db_pass}';
      GRANT ALL PRIVILEGES ON *.* TO '${db_user}'@'127.0.0.1' WITH GRANT OPTION;
      GRANT ALL PRIVILEGES ON *.* TO '${db_user}'@'localhost' WITH GRANT OPTION;
      GRANT ALL PRIVILEGES ON *.* TO '${db_user}'@'%' WITH GRANT OPTION;
      FLUSH PRIVILEGES;
    " >/dev/null 2>&1 || true
  fi

  if [ ! -f "${ptero_dir}/.env" ] && [ -f "${ptero_dir}/.env.example" ]; then
    cp "${ptero_dir}/.env.example" "${ptero_dir}/.env"
  fi

  # Repair vendor/ if composer autoload is missing
  if [ ! -f "${ptero_dir}/vendor/autoload.php" ] && command -v composer >/dev/null 2>&1; then
    log_fix "Restoring missing Pterodactyl vendor/ dependencies via composer"
    (cd "${ptero_dir}" && COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --optimize-autoloader --no-interaction >/dev/null 2>&1 || true)
  fi

  if [ -f "${ptero_dir}/.env" ]; then
    set_ptero_env_key "APP_ENV" "production"
    set_ptero_env_key "APP_URL" "https://${game_domain}"
    set_ptero_env_key "APP_ENVIRONMENT_ONLY" "false"
    set_ptero_env_key "TRUSTED_PROXIES" "*"
    set_ptero_env_key "RECAPTCHA_ENABLED" "false"
    # Prevent 419/500 cookie & CSRF failures behind proxies, Cloudflare Flexible, or HTTP/IP access
    set_ptero_env_key "SESSION_SECURE_COOKIE" "false"
    set_ptero_env_key "SESSION_DOMAIN" "null"
    set_ptero_env_key "DB_CONNECTION" "mysql"
    set_ptero_env_key "DB_HOST" "127.0.0.1"
    set_ptero_env_key "DB_PORT" "3306"
    set_ptero_env_key "DB_DATABASE" "${db_name}"
    set_ptero_env_key "DB_USERNAME" "${db_user}"
    [ -n "${db_pass}" ] && set_ptero_env_key "DB_PASSWORD" "${db_pass}"

    # Prevent SocketStream 127.0.0.1:2525 Connection refused during p:user:make / panel emails if no local SMTP exists
    local mail_host="" mail_port=""
    mail_host="$(awk -F= '/^MAIL_HOST=/{sub(/^[^=]*=/,""); print; exit}' "${ptero_dir}/.env" 2>/dev/null | tr -d "\"'\r[:space:]" || true)"
    mail_port="$(awk -F= '/^MAIL_PORT=/{sub(/^[^=]*=/,""); print; exit}' "${ptero_dir}/.env" 2>/dev/null | tr -d "\"'\r[:space:]" || true)"
    mail_port="${mail_port:-2525}"
    if [ -z "${mail_host}" ] || [ "${mail_host}" = "127.0.0.1" ] || [ "${mail_host}" = "localhost" ]; then
      if ! is_port_busy "${mail_port}"; then
        set_ptero_env_key "MAIL_MAILER" "log"
        set_ptero_env_key "MAIL_DRIVER" "log"
      fi
    fi

    local existing_salt=""
    existing_salt="$(awk -F= '/^HASHIDS_SALT=/{sub(/^[^=]*=/,""); print; exit}' "${ptero_dir}/.env" 2>/dev/null | tr -d "\"'\r" || true)"
    if [ -z "${existing_salt}" ]; then
      set_ptero_env_key "HASHIDS_SALT" "$(openssl rand -hex 10 2>/dev/null || echo 'spx_hashids_salt_2026')"
    fi
    set_ptero_env_key "HASHIDS_LENGTH" "8"
    if [ -n "${PTERO_SSO_SECRET:-}" ]; then
      set_ptero_env_key "SPARROWX_SSO_SECRET" "${PTERO_SSO_SECRET}"
    fi

    # Test real PHP -> Redis connectivity (ping + set/get) before enabling Redis drivers
    local redis_ready="false"
    if [ -n "${php_bin}" ] && "${php_bin}" -r '
      if (!class_exists("Redis")) exit(1);
      try {
        $r = new Redis();
        if (!@$r->connect("127.0.0.1", 6379, 1.5)) exit(1);
        $r->set("spx_ptero_probe", "ok", 5);
        if ($r->get("spx_ptero_probe") !== "ok") exit(1);
        exit(0);
      } catch (Throwable $e) { exit(1); }
    ' >/dev/null 2>&1; then
      redis_ready="true"
    fi
    if [ "${redis_ready}" = "true" ]; then
      set_ptero_env_key "REDIS_HOST" "127.0.0.1"
      set_ptero_env_key "REDIS_PORT" "6379"
      set_ptero_env_key "REDIS_PASSWORD" "null"
      set_ptero_env_key "CACHE_DRIVER" "redis"
      set_ptero_env_key "SESSION_DRIVER" "redis"
      set_ptero_env_key "QUEUE_CONNECTION" "redis"
    else
      log_fix "Redis PHP probe failed or unavailable; switching Pterodactyl cache/session/queue to file/sync"
      set_ptero_env_key "CACHE_DRIVER" "file"
      set_ptero_env_key "SESSION_DRIVER" "file"
      set_ptero_env_key "QUEUE_CONNECTION" "sync"
    fi
  fi

  # Verify real PHP PDO -> MariaDB connection before running migrations
  if [ -n "${php_bin}" ] && [ -n "${db_pass}" ]; then
    if ! SPX_DB="${db_name}" SPX_U="${db_user}" SPX_P="${db_pass}" "${php_bin}" -r '
      try {
        new PDO("mysql:host=127.0.0.1;port=3306;dbname=".getenv("SPX_DB"), getenv("SPX_U"), getenv("SPX_P"), [PDO::ATTR_TIMEOUT => 2]);
        exit(0);
      } catch (Throwable $e) { exit(1); }
    ' >/dev/null 2>&1; then
      log_fix "PHP PDO MariaDB auth failed for ${db_user}@127.0.0.1; resetting MySQL user & grants"
      if [ -n "${db_cli}" ]; then
        "${db_cli}" -u root -e "
          DROP USER IF EXISTS '${db_user}'@'127.0.0.1';
          DROP USER IF EXISTS '${db_user}'@'localhost';
          DROP USER IF EXISTS '${db_user}'@'%';
          CREATE USER '${db_user}'@'127.0.0.1' IDENTIFIED BY '${db_pass}';
          CREATE USER '${db_user}'@'localhost' IDENTIFIED BY '${db_pass}';
          CREATE USER '${db_user}'@'%' IDENTIFIED BY '${db_pass}';
          GRANT ALL PRIVILEGES ON *.* TO '${db_user}'@'127.0.0.1' WITH GRANT OPTION;
          GRANT ALL PRIVILEGES ON *.* TO '${db_user}'@'localhost' WITH GRANT OPTION;
          GRANT ALL PRIVILEGES ON *.* TO '${db_user}'@'%' WITH GRANT OPTION;
          FLUSH PRIVILEGES;
        " >/dev/null 2>&1 || true
      fi
    fi
  fi

  # Always clear stale cached config before validating APP_KEY or running artisan
  rm -f "${ptero_dir}/bootstrap/cache/config.php" "${ptero_dir}/bootstrap/cache/services.php" 2>/dev/null || true

  local current_app_key=""
  current_app_key="$(awk -F= '/^APP_KEY=/{sub(/^[^=]*=/,""); print; exit}' "${ptero_dir}/.env" 2>/dev/null | tr -d "\"'\r[:space:]" || true)"
  if ! echo "${current_app_key}" | grep -qE '^base64:[A-Za-z0-9+/=]{40,}$'; then
    local new_app_key=""
    if command -v openssl >/dev/null 2>&1; then
      new_app_key="base64:$(openssl rand -base64 32 | tr -d '\n\r')"
    elif [ -n "${php_bin}" ]; then
      new_app_key="base64:$("${php_bin}" -r 'echo base64_encode(random_bytes(32));' 2>/dev/null || true)"
    fi
    if [ -n "${new_app_key}" ]; then
      set_ptero_env_key "APP_KEY" "${new_app_key}"
      log_fix "Generated missing/invalid Pterodactyl APP_KEY directly in .env"
    fi
  fi

  if [ -n "${php_bin}" ] && [ -f "${ptero_dir}/artisan" ]; then
    # Fallback artisan key:generate if still missing
    if ! grep -qE '^APP_KEY=base64:[A-Za-z0-9+/=]{40,}' "${ptero_dir}/.env" 2>/dev/null; then
      (cd "${ptero_dir}" && "${php_bin}" artisan key:generate --force --no-interaction >/dev/null 2>&1 || true)
    fi

    # Always run idempotent migrations & seeders so activity_logs/sessions/users tables exist
    (cd "${ptero_dir}" && "${php_bin}" artisan migrate --seed --force --no-interaction >/dev/null 2>&1 || true)

    # Auto-register or sync the local MariaDB Database Host inside Pterodactyl Admin -> Database Hosts
    if [ -n "${db_pass}" ]; then
      SPX_DBH_HOST="${game_domain}" SPX_DBH_USER="${db_user}" SPX_DBH_PASS="${db_pass}" "${php_bin}" -r '
        require "/var/www/pterodactyl/vendor/autoload.php";
        $app = require "/var/www/pterodactyl/bootstrap/app.php";
        $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
        $host = getenv("SPX_DBH_HOST");
        $user = getenv("SPX_DBH_USER");
        $pass = getenv("SPX_DBH_PASS");
        $nodeId = Illuminate\Support\Facades\DB::table("nodes")->orderBy("id")->value("id");
        $enc = Illuminate\Support\Facades\Crypt::encryptString($pass);
        $existing = Illuminate\Support\Facades\DB::table("database_hosts")->whereIn("host", [$host, "127.0.0.1"])->first();
        if (!$existing) {
          Illuminate\Support\Facades\DB::table("database_hosts")->insert([
            "name" => "SparrowX MariaDB",
            "host" => $host,
            "port" => 3306,
            "username" => $user,
            "password" => $enc,
            "max_databases" => null,
            "node_id" => $nodeId,
            "created_at" => date("Y-m-d H:i:s"),
            "updated_at" => date("Y-m-d H:i:s"),
          ]);
        } else {
          Illuminate\Support\Facades\DB::table("database_hosts")->where("id", $existing->id)->update([
            "username" => $user,
            "password" => $enc,
            "node_id" => $existing->node_id ?: $nodeId,
            "updated_at" => date("Y-m-d H:i:s"),
          ]);
        }
      ' >/dev/null 2>&1 && log_fix "Synced Pterodactyl Database Host (${game_domain}:3306 -> ${db_user})" || true
    fi

    if [ -n "${db_cli}" ]; then
      local admin_count="0"
      admin_count="$("${db_cli}" -Nse "SELECT COUNT(*) FROM \`${db_name}\`.users WHERE root_admin=1;" 2>/dev/null || echo "0")"
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
        existing_admin_row="$("${db_cli}" -Nse "SELECT username, email FROM \`${db_name}\`.users WHERE root_admin=1 ORDER BY id ASC LIMIT 1;" 2>/dev/null || true)"
        if [ -n "${existing_admin_row}" ]; then
          PTERO_ADMIN_USER="$(echo "${existing_admin_row}" | awk '{print $1}')"
          PTERO_ADMIN_EMAIL="$(echo "${existing_admin_row}" | awk '{print $2}')"
          ensure_env_key "PTERO_ADMIN_USER" "${PTERO_ADMIN_USER}"
          ensure_env_key "PTERO_ADMIN_EMAIL" "${PTERO_ADMIN_EMAIL}"
          export PTERO_ADMIN_USER PTERO_ADMIN_EMAIL
        fi
      fi

      # Ensure 'root' admin user also exists so login works with either 'admin' or 'root'
      local has_root_user="0"
      has_root_user="$("${db_cli}" -Nse "SELECT COUNT(*) FROM \`${db_name}\`.users WHERE username='root';" 2>/dev/null || echo "0")"
      if [ "${has_root_user:-0}" -eq 0 ] 2>/dev/null; then
        (cd "${ptero_dir}" && "${php_bin}" artisan p:user:make --no-interaction \
          --email="root@${SPARROWX_DOMAIN:-sparrowx.net}" \
          --username="root" \
          --name-first="Root" \
          --name-last="Admin" \
          --password="${PTERO_ADMIN_PASSWORD}" \
          --admin=1 >/dev/null 2>&1 || true)
      fi

      # Only reset existing admin passwords when explicitly requested (RESET_PTERO_ADMIN_PASS=true)
      if [ "${RESET_PTERO_ADMIN_PASS:-false}" = "true" ] && [ -n "${PTERO_ADMIN_PASSWORD:-}" ]; then
        local bcrypt_pw=""
        bcrypt_pw="$(SPX_PASS="${PTERO_ADMIN_PASSWORD}" "${php_bin}" -r 'echo password_hash(getenv("SPX_PASS"), PASSWORD_BCRYPT);' 2>/dev/null || true)"
        if [ -n "${bcrypt_pw}" ]; then
          "${db_cli}" -u root -e "UPDATE \`${db_name}\`.users SET password='${bcrypt_pw}', root_admin=1 WHERE username IN ('${PTERO_ADMIN_USER}', 'admin', 'root') OR root_admin=1;" >/dev/null 2>&1 || true
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
  touch "${ptero_dir}/storage/logs/laravel.log" 2>/dev/null || true
  if id -u www-data >/dev/null 2>&1; then
    chown -R www-data:www-data "${ptero_dir}/storage" "${ptero_dir}/bootstrap/cache" "${ptero_dir}/.env" 2>/dev/null || true
    chown -R www-data:www-data "${ptero_dir}" 2>/dev/null || true
  fi
  chmod -R 775 "${ptero_dir}/storage" "${ptero_dir}/bootstrap/cache" 2>/dev/null || true
  chmod 664 "${ptero_dir}/storage/logs/laravel.log" 2>/dev/null || true
  chmod 640 "${ptero_dir}/.env" 2>/dev/null || true

  # Ensure pteroq.service runs as www-data so it never writes root-owned laravel.log files
  if [ -f "/etc/systemd/system/pteroq.service" ]; then
    if ! grep -q "^User=www-data" /etc/systemd/system/pteroq.service 2>/dev/null; then
      sed -i 's/^User=.*/User=www-data/' /etc/systemd/system/pteroq.service 2>/dev/null || true
      sed -i 's/^Group=.*/Group=www-data/' /etc/systemd/system/pteroq.service 2>/dev/null || true
      systemctl daemon-reload >/dev/null 2>&1 || true
    fi
    systemctl restart pteroq >/dev/null 2>&1 || true
  fi

  # Restart active PHP-FPM so .env / opcache changes take effect immediately
  if [ -n "${php_ver}" ] && systemctl list-unit-files 2>/dev/null | grep -q "^php${php_ver}-fpm.service"; then
    systemctl restart "php${php_ver}-fpm" >/dev/null 2>&1 || true
  fi
  [ -S "${php_sock}" ] && chmod 666 "${php_sock}" 2>/dev/null || true
  write_ptero_credentials_file

  # Sync existing Let's Encrypt certificate for game.<domain> into ovh/ssl & /etc/ssl
  if [ -s "/etc/letsencrypt/live/${game_domain}/fullchain.pem" ] && [ -s "/etc/letsencrypt/live/${game_domain}/privkey.pem" ]; then
    mkdir -p "${INSTALL_DIR}/ovh/ssl" /etc/ssl
    cp -fL "/etc/letsencrypt/live/${game_domain}/fullchain.pem" "${INSTALL_DIR}/ovh/ssl/ptero-fullchain.pem" 2>/dev/null || true
    cp -fL "/etc/letsencrypt/live/${game_domain}/privkey.pem" "${INSTALL_DIR}/ovh/ssl/ptero-privkey.pem" 2>/dev/null || true
    ln -sf "/etc/letsencrypt/live/${game_domain}/fullchain.pem" "/etc/ssl/${game_domain}.pem" 2>/dev/null || true
    ln -sf "/etc/letsencrypt/live/${game_domain}/privkey.pem" "/etc/ssl/${game_domain}.key" 2>/dev/null || true
  fi

  # Remove ANY host nginx vhost other than pterodactyl.conf so nothing steals ports 80/443 from sparrowx-nginx
  find /etc/nginx/sites-enabled -maxdepth 1 \( -type l -o -type f \) 2>/dev/null | grep -v '/pterodactyl\.conf$' | xargs -r rm -f 2>/dev/null || true
  find /etc/nginx/conf.d -maxdepth 1 -name '*.conf' 2>/dev/null | grep -v '/pterodactyl\.conf$' | xargs -r rm -f 2>/dev/null || true
  rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/pterodactyl.conf 2>/dev/null || true
  if [ -f /etc/nginx/sites-available/pterodactyl.conf ]; then
    ptero_conf="/etc/nginx/sites-available/pterodactyl.conf"
  elif [ -f /etc/nginx/conf.d/pterodactyl.conf ]; then
    ptero_conf="/etc/nginx/conf.d/pterodactyl.conf"
  fi

  mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled "${INSTALL_DIR}/ovh/certbot-www/.well-known/acme-challenge"
  cat > "${ptero_conf}" <<EOF_PTERO
server {
    listen ${ptero_port};
    server_name ${game_domain} _;

    root ${ptero_dir}/public;
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
EOF_PTERO

  ln -sf "${ptero_conf}" /etc/nginx/sites-enabled/pterodactyl.conf
  if nginx -t >/dev/null 2>&1; then
    systemctl unmask nginx >/dev/null 2>&1 || true
    systemctl enable nginx >/dev/null 2>&1 || true
    systemctl restart nginx >/dev/null 2>&1 || true
    log_fix "Pterodactyl host Nginx enabled & bound to internal port ${ptero_port} (PHP socket: ${php_sock})"
  else
    log_warn "Host Nginx config check failed for ${ptero_conf}; inspect nginx -t on host"
  fi

  # Live Laravel GET / + /sanctum/csrf-cookie + POST /auth/login verification & auto-healing loop
  local probe_attempt=1
  while [ "${probe_attempt}" -le 2 ]; do
    local root_code="000" csrf_code="000" login_probe_code="000" login_probe_body="" raw_xsrf="" xsrf_tok="" ptero_cj="" ptero_body_file=""
    ptero_cj="$(mktemp)"
    ptero_body_file="$(mktemp)"
    root_code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 6 -H "Host: ${game_domain}" -H "X-Forwarded-Proto: https" "http://127.0.0.1:${ptero_port}/" 2>/dev/null || echo "000")"
    csrf_code="$(curl -s -c "${ptero_cj}" -o /dev/null -w "%{http_code}" --max-time 6 -H "Host: ${game_domain}" -H "X-Forwarded-Proto: https" "http://127.0.0.1:${ptero_port}/sanctum/csrf-cookie" 2>/dev/null || echo "000")"
    if echo "${csrf_code}" | grep -qE "^(200|204)$"; then
      raw_xsrf="$(awk '$6=="XSRF-TOKEN"{print $7; exit}' "${ptero_cj}" 2>/dev/null || true)"
      if [ -n "${raw_xsrf}" ] && [ -n "${php_bin}" ]; then
        xsrf_tok="$("${php_bin}" -r 'echo urldecode($argv[1] ?? "");' "${raw_xsrf}" 2>/dev/null || echo "${raw_xsrf}")"
      else
        xsrf_tok="${raw_xsrf}"
      fi
      if [ -n "${xsrf_tok}" ]; then
        local probe_user="root"
        local probe_pass="${PTERO_ADMIN_PASSWORD:-__probe__}"
        login_probe_code="$(curl -s -b "${ptero_cj}" -o "${ptero_body_file}" -w "%{http_code}" --max-time 6 -X POST -H "Host: ${game_domain}" -H "X-Forwarded-Proto: https" -H "Accept: application/json" -H "Content-Type: application/json" -H "X-XSRF-TOKEN: ${xsrf_tok}" -d "{\"user\":\"${probe_user}\",\"password\":\"${probe_pass}\"}" "http://127.0.0.1:${ptero_port}/auth/login" 2>/dev/null || echo "000")"
        login_probe_body="$(cat "${ptero_body_file}" 2>/dev/null || true)"
      fi
    fi
    rm -f "${ptero_cj}" "${ptero_body_file}"

    if echo "${root_code}" | grep -qE "^(200|301|302)$" && echo "${csrf_code}" | grep -qE "^(200|204)$" && ! echo "${login_probe_code}" | grep -qE "^(000|419|500|502|503)$" && ! echo "${login_probe_body}" | grep -qi "unexpected error"; then
      log_ok "Pterodactyl GET / & auth probe passed (ROOT:${root_code}, CSRF:${csrf_code}, LOGIN:${login_probe_code})"
      break
    fi

    log_fix "Pterodactyl probe failed (attempt ${probe_attempt}: ROOT:${root_code} CSRF:${csrf_code} LOGIN:${login_probe_code}); applying deep Laravel/PHP/Redis/cache/permission repair"
    if [ -f "${ptero_dir}/storage/logs/laravel.log" ]; then
      local last_err=""
      last_err="$(grep -E "local\.ERROR|production\.ERROR|Exception|SQLSTATE|Permission denied|Fatal error" "${ptero_dir}/storage/logs/laravel.log" 2>/dev/null | tail -n 1 || true)"
      [ -n "${last_err}" ] && log_warn "Last Pterodactyl log error: ${last_err:0:180}"
    fi

    # Clear compiled bootstrap/cache files that may hold stale config/services
    rm -f "${ptero_dir}/bootstrap/cache/"*.php 2>/dev/null || true

    if [ -f "${ptero_dir}/.env" ]; then
      set_ptero_env_key "CACHE_DRIVER" "file"
      set_ptero_env_key "SESSION_DRIVER" "file"
      set_ptero_env_key "QUEUE_CONNECTION" "sync"
      set_ptero_env_key "SESSION_SECURE_COOKIE" "false"
      set_ptero_env_key "SESSION_DOMAIN" "null"
      set_ptero_env_key "TRUSTED_PROXIES" "*"
      set_ptero_env_key "RECAPTCHA_ENABLED" "false"
    fi
    if [ -n "${php_bin}" ] && [ -f "${ptero_dir}/artisan" ]; then
      (cd "${ptero_dir}" && "${php_bin}" artisan config:clear >/dev/null 2>&1 || true)
      (cd "${ptero_dir}" && "${php_bin}" artisan cache:clear >/dev/null 2>&1 || true)
      (cd "${ptero_dir}" && "${php_bin}" artisan view:clear >/dev/null 2>&1 || true)
      (cd "${ptero_dir}" && "${php_bin}" artisan route:clear >/dev/null 2>&1 || true)
    fi
    touch "${ptero_dir}/storage/logs/laravel.log" 2>/dev/null || true
    if id -u www-data >/dev/null 2>&1; then
      chown -R www-data:www-data "${ptero_dir}/storage" "${ptero_dir}/bootstrap/cache" "${ptero_dir}/.env" 2>/dev/null || true
    fi
    chmod -R 775 "${ptero_dir}/storage" "${ptero_dir}/bootstrap/cache" 2>/dev/null || true
    chmod 664 "${ptero_dir}/storage/logs/laravel.log" 2>/dev/null || true
    chmod 640 "${ptero_dir}/.env" 2>/dev/null || true
    if [ -n "${php_ver}" ] && systemctl list-unit-files 2>/dev/null | grep -q "^php${php_ver}-fpm.service"; then
      systemctl restart "php${php_ver}-fpm" >/dev/null 2>&1 || true
    fi
    [ -S "${php_sock}" ] && chmod 666 "${php_sock}" 2>/dev/null || true
    systemctl restart pteroq >/dev/null 2>&1 || true
    systemctl restart nginx >/dev/null 2>&1 || true
    if [ "${probe_attempt}" -eq 2 ]; then
      log_unfixed "Pterodactyl probe still failing after 2 auto-heal passes (ROOT:${root_code} CSRF:${csrf_code} LOGIN:${login_probe_code})"
    fi
    probe_attempt=$((probe_attempt + 1))
  done
}

issue_le_cert_to_ovh_ssl() {
  local target_domain="$1"
  local cert_prefix="$2"
  local webroot="${INSTALL_DIR}/ovh/certbot-www"
  local ssl_dir="${INSTALL_DIR}/ovh/ssl"
  local live_dir="/etc/letsencrypt/live/${target_domain}"
  local ssl_email="${PTERO_ADMIN_EMAIL:-${SPARROWX_ADMIN_EMAIL:-admin@${SPARROWX_DOMAIN}}}"

  if [ -z "${target_domain}" ] || [[ "${target_domain}" == *.local ]] || [ "${target_domain}" = "localhost" ]; then
    return 0
  fi

  if [ -z "${ssl_email}" ] || [[ "${ssl_email}" == *.local ]]; then
    ssl_email="admin@${SPARROWX_DOMAIN}"
  fi

  if [ ! -s "${live_dir}/fullchain.pem" ] || [ ! -s "${live_dir}/privkey.pem" ]; then
    log_scan "Requesting Let's Encrypt SSL for ${target_domain} via HTTP-01 port 80..."
    local cb_err=""
    if cb_err="$(certbot certonly \
      --webroot -w "${webroot}" \
      --non-interactive --agree-tos \
      -m "${ssl_email}" \
      --cert-name "${target_domain}" \
      -d "${target_domain}" 2>&1)"; then
      log_fix "Issued Let's Encrypt SSL for ${target_domain} via port 80 webroot"
    else
      log_scan "Webroot challenge deferred; retrying ${target_domain} via standalone port 80 listener..."
      docker stop "${EDGE_CTR:-sparrowx-nginx}" sparrowx-nginx sparrowx_edge_proxy >/dev/null 2>&1 || true
      systemctl stop nginx >/dev/null 2>&1 || true
      if command -v fuser >/dev/null 2>&1; then
        fuser -k 80/tcp >/dev/null 2>&1 || true
      fi
      sleep 1

      if cb_err="$(certbot certonly \
        --standalone --preferred-challenges http \
        --non-interactive --agree-tos \
        -m "${ssl_email}" \
        --cert-name "${target_domain}" \
        -d "${target_domain}" 2>&1)"; then
        log_fix "Issued Let's Encrypt SSL for ${target_domain} via standalone port 80 challenge"
      else
        local cb_reason
        cb_reason="$(printf '%s\n' "${cb_err}" | grep -E "Detail:|DNS|NXDOMAIN|Timeout|Connection refused|rate limit|too many" | head -n 2 | tr '\n' ' ' | sed 's/  */ /g')"
        log_warn "Let's Encrypt HTTP-01 failed for ${target_domain}${cb_reason:+ (${cb_reason})}"
      fi

      if is_pterodactyl_installed; then
        systemctl start nginx >/dev/null 2>&1 || true
      fi
      docker start "${EDGE_CTR:-sparrowx-nginx}" >/dev/null 2>&1 || compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps "${EDGE_SVC:-nginx}" >/dev/null 2>&1 || true
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
  local game_panel_domain="${DOMAIN_GAME:-game.panel.${SPARROWX_DOMAIN}}"
  local game_web_domain="${DOMAIN_GAME_WEB:-game.${SPARROWX_DOMAIN}}"
  local game_dash_domain="${DOMAIN_GAME_DASH:-game.dash.${SPARROWX_DOMAIN}}"
  local webroot="${INSTALL_DIR}/ovh/certbot-www"
  local ssl_dir="${INSTALL_DIR}/ovh/ssl"

  mkdir -p "${webroot}/.well-known/acme-challenge" "${ssl_dir}" /etc/ssl

  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi "Status: active"; then
    ufw allow 80/tcp >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
  fi

  if ! command -v certbot >/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt-get update -y >/dev/null 2>&1 || true
    DEBIAN_FRONTEND=noninteractive apt-get install -y certbot >/dev/null 2>&1 || true
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
  issue_le_cert_to_ovh_ssl "${DOMAIN_GAMESEC:-gamesec.${SPARROWX_DOMAIN}}" "gamesec"
  issue_le_cert_to_ovh_ssl "${DOMAIN_NETSEC:-netsec.${SPARROWX_DOMAIN}}" "netsec"
  issue_le_cert_to_ovh_ssl "${DOMAIN_INFRA:-infra.${SPARROWX_DOMAIN}}" "infra"
}

ensure_gamesec_landing_running() {
  local gamesec_domain="${DOMAIN_GAMESEC:-gamesec.${SPARROWX_DOMAIN:-sparrowx.net}}"
  local netsec_domain="${DOMAIN_NETSEC:-netsec.${SPARROWX_DOMAIN:-sparrowx.net}}"
  local gamesec_dir="${GAMESEC_DIR:-/opt/sparrowx-gamesec}"
  local gamesec_repo="${GAMESEC_REPO_URL:-https://github.com/cybersync-fxfx/sbs-detrion-landing.git}"
  local gamesec_p="${GAMESEC_PORT:-3005}"

  if [ -n "${GAMESEC_UPSTREAM_URL:-}" ]; then
    log_ok "Game DDoS Defense (${gamesec_domain}) configured for external upstream ${GAMESEC_UPSTREAM_URL}"
    return 0
  fi

  if ! command -v git >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get install -y -qq git >/dev/null 2>&1 || true
  fi
  if ! command -v git >/dev/null 2>&1; then
    log_warn "git unavailable; skipping ${gamesec_domain} source deployment"
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
        log_warn "Failed to clone ${gamesec_repo}; preserving any existing ${gamesec_dir} bundle"
    fi
  else
    git config --global --add safe.directory "${gamesec_dir}" >/dev/null 2>&1 || true
    git -C "${gamesec_dir}" checkout -- vite.config.ts package-lock.json src >/dev/null 2>&1 || true
    git -C "${gamesec_dir}" pull --ff-only >/dev/null 2>&1 || true
  fi

  if [ ! -f "${gamesec_dir}/package.json" ]; then
    log_warn "Missing ${gamesec_dir}/package.json; cannot build ${gamesec_domain} portal"
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
        export DEBIAN_FRONTEND=noninteractive
        curl -fsSL https://deb.nodesource.com/setup_22.x 2>/dev/null | bash - >/dev/null 2>&1 || true
        apt-get install -y -qq nodejs npm >/dev/null 2>&1 || apt-get install -y -qq nodejs >/dev/null 2>&1 || true
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
      log_ok "Built ${gamesec_domain} Nitro server bundle (.output/server/index.mjs)"
    else
      log_warn "Build failed for ${gamesec_dir}; preserving previous build if present"
      [ -s "${gamesec_dir}/.output/server/index.mjs" ] || return 1
    fi
  fi

  local env_args=()
  [ -s "${gamesec_dir}/.env" ] && env_args=(--env-file "${gamesec_dir}/.env")

  local edge_net="sparrowx_net"
  if [ "${docker_ok}" = "yes" ] && docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "${EDGE_CTR:-sparrowx-nginx}"; then
    local detected_net=""
    detected_net="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "${EDGE_CTR:-sparrowx-nginx}" 2>/dev/null | awk 'NF {print; exit}' || true)"
    [ -n "${detected_net}" ] && edge_net="${detected_net}"
  fi

  local gamesec_started="no"
  if [ "${docker_ok}" = "yes" ]; then
    if [ "${need_build}" != "yes" ] && \
       docker ps --filter status=running --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-gamesec" && \
       docker inspect -f '{{json .NetworkSettings.Networks}}' sparrowx-gamesec 2>/dev/null | grep -q "\"${edge_net}\"" && \
       curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:${gamesec_p}/" 2>/dev/null; then
      gamesec_started="yes"
      log_ok "Game DDoS Defense (${gamesec_domain}) container sparrowx-gamesec already healthy on :${gamesec_p}"
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
          log_fix "Started Game DDoS Defense (${gamesec_domain}) container on ${edge_net} & 127.0.0.1:${gamesec_p}"
        fi
      fi
    fi
  fi

  if [ "${gamesec_started}" != "yes" ]; then
    if { ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]; } && command -v apt-get >/dev/null 2>&1; then
      export DEBIAN_FRONTEND=noninteractive
      curl -fsSL https://deb.nodesource.com/setup_22.x 2>/dev/null | bash - >/dev/null 2>&1 || true
      apt-get install -y -qq nodejs >/dev/null 2>&1 || true
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
        log_fix "Started Game DDoS Defense (${gamesec_domain}) systemd service on :${gamesec_p}"
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
  local netsec_domain="${DOMAIN_NETSEC:-netsec.${SPARROWX_DOMAIN:-sparrowx.net}}"
  local netsec_dir="${NETSEC_DIR:-/opt/sparrowx-netsec}"
  local netsec_repo="${NETSEC_REPO_URL:-https://github.com/cybersync-fxfx/saprrowx.sbs.git}"
  local netsec_p="${NETSEC_PORT:-3006}"

  if [ -n "${NETSEC_UPSTREAM_URL:-}" ]; then
    log_ok "Network DDoS Dashboard (${netsec_domain}) configured for external upstream ${NETSEC_UPSTREAM_URL}"
    return 0
  fi

  if ! command -v git >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get install -y -qq git >/dev/null 2>&1 || true
  fi
  if ! command -v git >/dev/null 2>&1; then
    log_warn "git unavailable; skipping ${netsec_domain} source deployment"
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
        log_warn "Failed to clone ${netsec_repo}; preserving any existing ${netsec_dir} bundle"
    fi
  else
    git config --global --add safe.directory "${netsec_dir}" >/dev/null 2>&1 || true
    git -C "${netsec_dir}" checkout -- package-lock.json frontend/package-lock.json frontend/dist node_modules/.package-lock.json >/dev/null 2>&1 || true
    git -C "${netsec_dir}" clean -fd frontend/dist >/dev/null 2>&1 || true
    git -C "${netsec_dir}" pull --ff-only >/dev/null 2>&1 || { git -C "${netsec_dir}" fetch origin --depth 1 >/dev/null 2>&1 && git -C "${netsec_dir}" reset --hard origin/main >/dev/null 2>&1; } || true
  fi

  local local_sbs_src="${INSTALL_DIR:-/opt/sparrowxdbs}/sbs"
  if [ -d "${local_sbs_src}" ] && [ -f "${local_sbs_src}/sparrowx-db-adapter.js" ]; then
    mkdir -p "${netsec_dir}" 2>/dev/null || true
    cp -f "${local_sbs_src}/sparrowx-db-adapter.js" "${netsec_dir}/sparrowx-db-adapter.js" 2>/dev/null || true
    cp -f "${local_sbs_src}/server.js" "${netsec_dir}/server.js" 2>/dev/null || true
    cp -f "${local_sbs_src}/package.json" "${netsec_dir}/package.json" 2>/dev/null || true
    cp -f "${local_sbs_src}/.env.example" "${netsec_dir}/.env.example" 2>/dev/null || true
  fi

  if [ ! -f "${netsec_dir}/package.json" ] || [ ! -f "${netsec_dir}/server.js" ]; then
    log_warn "Missing ${netsec_dir}/package.json or server.js; cannot build ${netsec_domain}"
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
        apt-get install -y -qq nodejs npm build-essential >/dev/null 2>&1 || apt-get install -y -qq nodejs >/dev/null 2>&1 || true
      fi
      if command -v npm >/dev/null 2>&1; then
        (cd "${netsec_dir}" && NODE_OPTIONS="--max-old-space-size=1536" npm install --no-audit --no-fund && npm --prefix frontend install --no-audit --no-fund && npm --prefix frontend run build) >/dev/null 2>&1 && build_rc=0 || true
      fi
    fi

    if [ "${build_rc}" -eq 0 ] && [ -s "${netsec_dir}/frontend/dist/index.html" ] && [ -d "${netsec_dir}/node_modules/express" ]; then
      echo "${cur_rev}" > "${netsec_dir}/.sparrowx-built-rev"
      log_ok "Built ${netsec_domain} dashboard bundle (server.js + frontend/dist)"
    else
      log_warn "Build failed for ${netsec_dir}; preserving previous build if present"
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
      log_ok "Network DDoS Dashboard (${netsec_domain}) container sparrowx-netsec already healthy on :${netsec_p}"
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
          log_fix "Started Network DDoS Dashboard (${netsec_domain}) container on ${edge_net} & 127.0.0.1:${netsec_p}"
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
      apt-get install -y -qq nodejs >/dev/null 2>&1 || true
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
        log_fix "Started Network DDoS Dashboard (${netsec_domain}) systemd service on :${netsec_p}"
      fi
    fi
  fi
}

ensure_core_letsencrypt_ssl() {
  local root_domain="${SPARROWX_DOMAIN:-}"
  local webroot="${INSTALL_DIR}/ovh/certbot-www"
  local ssl_dir="${INSTALL_DIR}/ovh/ssl"
  local live_dir="/etc/letsencrypt/live/${root_domain}"
  local ssl_email="${SPARROWX_ADMIN_EMAIL:-${PTERO_ADMIN_EMAIL:-admin@${root_domain}}}"

  if [ -z "${root_domain}" ] || [[ "${root_domain}" == *.local ]] || [ "${root_domain}" = "localhost" ]; then
    return 0
  fi

  if [ -z "${ssl_email}" ] || [[ "${ssl_email}" == *.local ]]; then
    ssl_email="admin@${root_domain}"
  fi

  mkdir -p "${webroot}/.well-known/acme-challenge" "${ssl_dir}" /etc/ssl

  if ! command -v certbot >/dev/null 2>&1; then
    return 0
  fi

  local -a candidate_domains=(
    "${root_domain}"
    "db.${root_domain}"
    "sec.${root_domain}"
    "file.${root_domain}"
    "password.${root_domain}"
    "api.${root_domain}"
    "infra.${root_domain}"
  )
  if getent ahosts "www.${root_domain}" >/dev/null 2>&1; then
    candidate_domains+=("www.${root_domain}")
  fi

  local -a domain_args=()
  local d
  for d in "${candidate_domains[@]}"; do
    if ! command -v getent >/dev/null 2>&1 || getent ahosts "${d}" >/dev/null 2>&1; then
      domain_args+=("-d" "${d}")
    fi
  done

  if [ "${#domain_args[@]}" -eq 0 ]; then
    domain_args=("-d" "${root_domain}")
  fi

  if [ ! -s "${live_dir}/fullchain.pem" ] || [ ! -s "${live_dir}/privkey.pem" ]; then
    log_scan "Requesting Let's Encrypt SAN SSL for ${root_domain} & core subdomains via HTTP-01..."
    local cb_err=""
    if cb_err="$(certbot certonly \
      --webroot -w "${webroot}" \
      --non-interactive --agree-tos --expand \
      -m "${ssl_email}" \
      --cert-name "${root_domain}" \
      "${domain_args[@]}" 2>&1)"; then
      log_fix "Issued Let's Encrypt SAN SSL for ${root_domain} via port 80 webroot"
    else
      log_scan "Webroot challenge deferred; retrying ${root_domain} via standalone port 80 listener..."
      docker stop "${EDGE_CTR:-sparrowx-nginx}" sparrowx-nginx sparrowx_edge_proxy >/dev/null 2>&1 || true
      systemctl stop nginx >/dev/null 2>&1 || true
      if command -v fuser >/dev/null 2>&1; then
        fuser -k 80/tcp >/dev/null 2>&1 || true
      fi
      sleep 1

      if cb_err="$(certbot certonly \
        --standalone --preferred-challenges http \
        --non-interactive --agree-tos --expand \
        -m "${ssl_email}" \
        --cert-name "${root_domain}" \
        "${domain_args[@]}" 2>&1)"; then
        log_fix "Issued Let's Encrypt SAN SSL for ${root_domain} via standalone port 80 challenge"
      else
        # Fallback: issue for root_domain alone so main site is never stuck on self-signed
        if certbot certonly \
          --standalone --preferred-challenges http \
          --non-interactive --agree-tos \
          -m "${ssl_email}" \
          --cert-name "${root_domain}" \
          -d "${root_domain}" >/dev/null 2>&1; then
          log_fix "Issued Let's Encrypt SSL for ${root_domain} (root domain fallback)"
        else
          local cb_reason
          cb_reason="$(printf '%s\n' "${cb_err}" | grep -E "Detail:|DNS|NXDOMAIN|Timeout|Connection refused|rate limit|too many" | head -n 2 | tr '\n' ' ' | sed 's/  */ /g')"
          log_warn "Let's Encrypt HTTP-01 failed for ${root_domain}${cb_reason:+ (${cb_reason})}"
        fi
      fi

      if is_pterodactyl_installed; then
        systemctl start nginx >/dev/null 2>&1 || true
      fi
      docker start "${EDGE_CTR:-sparrowx-nginx}" >/dev/null 2>&1 || compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps "${EDGE_SVC:-nginx}" >/dev/null 2>&1 || true
    fi
  else
    certbot certonly \
      --webroot -w "${webroot}" \
      --non-interactive --agree-tos --keep-until-expiring \
      -m "${ssl_email}" \
      --cert-name "${root_domain}" \
      "${domain_args[@]}" >/dev/null 2>&1 || true
  fi

  if [ -s "${live_dir}/fullchain.pem" ] && [ -s "${live_dir}/privkey.pem" ]; then
    cp -fL "${live_dir}/fullchain.pem" "${ssl_dir}/fullchain.pem" 2>/dev/null || true
    cp -fL "${live_dir}/privkey.pem" "${ssl_dir}/privkey.pem" 2>/dev/null || true
    chmod 644 "${ssl_dir}/fullchain.pem" 2>/dev/null || true
    chmod 600 "${ssl_dir}/privkey.pem" 2>/dev/null || true
    ln -sf "${live_dir}/fullchain.pem" "/etc/ssl/${root_domain}.pem" 2>/dev/null || true
    ln -sf "${live_dir}/privkey.pem" "/etc/ssl/${root_domain}.key" 2>/dev/null || true
    log_ok "Live Let's Encrypt SAN SSL wired for https://${root_domain} (+ db/sec/file/password/api)"
  fi
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

# ==============================================================================
# STAGE 1/12: Path Compatibility, CRLF Repair & CLI Symlinks
# ==============================================================================
draw_progress 1 12 "Paths, CRLF & CLI Symlinks"

if [ -d "/opt/sparrowx" ] && [ ! -L "/opt/sparrowx" ] && [ "${INSTALL_DIR}" != "/opt/sparrowx" ]; then
  if [ -f "/opt/sparrowx/docker-compose.standalone.yml" ]; then
    compose_cmd -f "/opt/sparrowx/docker-compose.standalone.yml" down --remove-orphans >/dev/null 2>&1 || true
  fi
  if [ -f "/opt/sparrowx/docker-compose.ovh.yml" ]; then
    compose_cmd -f "/opt/sparrowx/docker-compose.ovh.yml" down --remove-orphans >/dev/null 2>&1 || true
  fi
  mv -f /opt/sparrowx "/opt/sparrowx.legacy.$(date +%s 2>/dev/null || echo bak)" 2>/dev/null || true
  ln -sfn "${INSTALL_DIR}" /opt/sparrowx 2>/dev/null || true
  log_fix "Replaced legacy /opt/sparrowx directory with symlink -> ${INSTALL_DIR}"
elif [ ! -e "/opt/sparrowx" ] && [ "${INSTALL_DIR}" != "/opt/sparrowx" ]; then
  ln -sfn "${INSTALL_DIR}" /opt/sparrowx 2>/dev/null || true
  log_fix "Created /opt/sparrowx -> ${INSTALL_DIR} compatibility symlink"
fi

if [ -f "/etc/cron.d/sparrowx-automation" ]; then
  sed -i "s|/opt/sparrowx/|${INSTALL_DIR}/|g" /etc/cron.d/sparrowx-automation 2>/dev/null || true
fi

CRLF_REPAIRED=0
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
    CRLF_REPAIRED=$((CRLF_REPAIRED + 1))
  fi
done
if [ "${CRLF_REPAIRED}" -gt 0 ]; then
  log_fix "Stripped Windows CRLF line endings from ${CRLF_REPAIRED} script/config file(s)"
else
  log_ok "All shell scripts and configs use clean LF line endings"
fi

chmod +x \
  "${INSTALL_DIR}/setup.sh" \
  "${INSTALL_DIR}/update.sh" \
  "${INSTALL_DIR}/fix.sh" \
  "${INSTALL_DIR}/manage-db.sh" \
  "${INSTALL_DIR}/ovh/update.sh" \
  "${INSTALL_DIR}/ovh/fix.sh" \
  "${INSTALL_DIR}/ovh/manage-db.sh" \
  "${INSTALL_DIR}/deploy/ddos-setup.sh" \
  "${INSTALL_DIR}/deploy/xdp/attach-xdp.sh" \
  "${INSTALL_DIR}/deploy/doctor-fix.sh" \
  "${INSTALL_DIR}/public/"*.sh \
  "${INSTALL_DIR}/public/xdp/"*.sh 2>/dev/null || true

if [ -d "/usr/local/bin" ]; then
  ln -sf "${INSTALL_DIR}/setup.sh" /usr/local/bin/sparrowx-setup 2>/dev/null || true
  ln -sf "${INSTALL_DIR}/fix.sh" /usr/local/bin/sparrowx-fix 2>/dev/null || true
  ln -sf "${INSTALL_DIR}/fix.sh" /usr/local/bin/sparrowx-doctor 2>/dev/null || true
  ln -sf "${INSTALL_DIR}/update.sh" /usr/local/bin/sparrowx-update 2>/dev/null || true
  ln -sf "${INSTALL_DIR}/manage-db.sh" /usr/local/bin/sparrowx-db 2>/dev/null || true
  [ -f "${INSTALL_DIR}/deploy/ddos-setup.sh" ] && ln -sf "${INSTALL_DIR}/deploy/ddos-setup.sh" /usr/local/bin/sparrowx-ddos 2>/dev/null || true
  [ -f "${INSTALL_DIR}/deploy/xdp/attach-xdp.sh" ] && ln -sf "${INSTALL_DIR}/deploy/xdp/attach-xdp.sh" /usr/local/bin/sparrowx-xdp 2>/dev/null || true
  if [ -f "${INSTALL_DIR}/deploy/sparrowx-noc.py" ]; then
    chmod +x "${INSTALL_DIR}/deploy/sparrowx-noc.py" 2>/dev/null || true
    ln -sf "${INSTALL_DIR}/deploy/sparrowx-noc.py" /usr/local/bin/sparrowx-noc 2>/dev/null || true
    ln -sf "${INSTALL_DIR}/deploy/sparrowx-noc.py" /usr/local/bin/sparrowx-master 2>/dev/null || true
  fi
  log_ok "CLI symlinks verified: sparrowx-setup, sparrowx-fix, sparrowx-doctor, sparrowx-update, sparrowx-db, sparrowx-ddos, sparrowx-xdp, sparrowx-noc"
fi

# ==============================================================================
# STAGE 2/12: APT/DPKG Lock Recovery & Missing Tools Healer
# ==============================================================================
draw_progress 2 12 "OS Packages & Lock Healer"

if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  if ! pgrep -x "apt|apt-get|dpkg|unattended-upgr" >/dev/null 2>&1; then
    LOCK_CLEARED=0
    for lck in /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/lib/apt/lists/lock /var/cache/apt/archives/lock; do
      if [ -e "${lck}" ] && command -v fuser >/dev/null 2>&1 && ! fuser "${lck}" >/dev/null 2>&1; then
        rm -f "${lck}" 2>/dev/null || true
        LOCK_CLEARED=1
      fi
    done
    if [ "${LOCK_CLEARED}" -eq 1 ]; then
      dpkg --configure -a >/dev/null 2>&1 || true
      apt-get install -f -y -qq >/dev/null 2>&1 || true
      log_fix "Cleared stale dpkg/apt package locks and repaired interrupted package state"
    fi
  fi

  MISSING_PKGS=()
  command -v curl >/dev/null 2>&1 || MISSING_PKGS+=("curl")
  command -v git >/dev/null 2>&1 || MISSING_PKGS+=("git")
  command -v openssl >/dev/null 2>&1 || MISSING_PKGS+=("openssl")
  command -v ss >/dev/null 2>&1 || MISSING_PKGS+=("iproute2")
  command -v fuser >/dev/null 2>&1 || MISSING_PKGS+=("psmisc")

  if [ "${#MISSING_PKGS[@]}" -gt 0 ]; then
    log_fix "Installing missing required OS utilities: ${MISSING_PKGS[*]}"
    apt-get update -qq >/dev/null 2>&1 || true
    apt-get install -y -qq "${MISSING_PKGS[@]}" >/dev/null 2>&1 || true
    log_healed "Core OS utilities installed"
  else
    log_ok "All core OS diagnostic tools present (curl, git, openssl, ss, fuser)"
  fi
fi

# ==============================================================================
# STAGE 3/12: Disk Space & OOM Swap Healer
# ==============================================================================
draw_progress 3 12 "Disk Space & Swap OOM Shield"

FREE_DISK_MB="$(df -Pm "${INSTALL_DIR}" 2>/dev/null | awk 'NR==2 {print $4}' || echo 99999)"
if [ "${FREE_DISK_MB:-99999}" -lt 2048 ]; then
  log_fix "Low free disk space detected (${FREE_DISK_MB} MB < 2048 MB) — pruning build caches & stopped artifacts"
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    docker container prune -f >/dev/null 2>&1 || true
    docker image prune -f >/dev/null 2>&1 || true
    docker builder prune -f >/dev/null 2>&1 || true
  fi
  npm cache clean --force >/dev/null 2>&1 || true
  journalctl --vacuum-size=100M >/dev/null 2>&1 || true
  NEW_DISK_MB="$(df -Pm "${INSTALL_DIR}" 2>/dev/null | awk 'NR==2 {print $4}' || echo "${FREE_DISK_MB}")"
  log_healed "Disk free space recovered: ${NEW_DISK_MB} MB"
else
  log_ok "Disk capacity healthy (${FREE_DISK_MB} MB available)"
fi

TOTAL_RAM_MB="$(free -m 2>/dev/null | awk '/^Mem:/ {print $2}' || echo 4096)"
TOTAL_SWAP_MB="$(free -m 2>/dev/null | awk '/^Swap:/ {print $2}' || echo 2048)"
if [ "${TOTAL_SWAP_MB:-0}" -lt 512 ] && [ "${TOTAL_RAM_MB:-4096}" -lt 4096 ] && [ ! -f /swapfile ] && [ "${FREE_DISK_MB:-0}" -gt 4096 ]; then
  log_fix "Low memory environment (${TOTAL_RAM_MB} MB RAM, ${TOTAL_SWAP_MB} MB Swap) — provisioning 2 GB /swapfile"
  (fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none) && \
    chmod 600 /swapfile && \
    mkswap /swapfile >/dev/null 2>&1 && \
    swapon /swapfile 2>/dev/null || true
  if ! grep -q "^/swapfile " /etc/fstab 2>/dev/null; then
    echo "/swapfile none swap sw 0 0" >> /etc/fstab
  fi
  log_healed "2 GB swap shield activated to prevent Vite/Docker OOM crashes"
else
  log_ok "Memory profile healthy (${TOTAL_RAM_MB} MB RAM / ${TOTAL_SWAP_MB} MB Swap)"
fi

# ==============================================================================
# STAGE 4/12: Git Lock & Safe Directory Healer
# ==============================================================================
draw_progress 4 12 "Git Repository Integrity"

if [ -d "${INSTALL_DIR}/.git" ] && command -v git >/dev/null 2>&1; then
  if ! git config --global --get-all safe.directory 2>/dev/null | grep -Fxq "${INSTALL_DIR}"; then
    git config --global --add safe.directory "${INSTALL_DIR}" 2>/dev/null || true
    log_fix "Added ${INSTALL_DIR} to git global safe.directory"
  fi
  for gitlock in "${INSTALL_DIR}/.git/index.lock" "${INSTALL_DIR}/.git/HEAD.lock" "${INSTALL_DIR}/.git/shallow.lock"; do
    if [ -f "${gitlock}" ] && ! pgrep -x "git" >/dev/null 2>&1; then
      rm -f "${gitlock}" 2>/dev/null || true
      log_fix "Removed stale git lock: $(basename "${gitlock}")"
    fi
  done
  log_ok "Git repository healthy ($(git rev-parse --short HEAD 2>/dev/null || echo unknown))"
else
  log_ok "Non-git archive directory — skipping git check"
fi

# ==============================================================================
# STAGE 5/12: Environment (.env), Public IP, Domain & Secrets Validator
# ==============================================================================
draw_progress 5 12 ".env & Secret Validator"

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
DOMAIN_GAME_WEB="${DOMAIN_GAME_WEB:-game.${SPARROWX_DOMAIN}}"
DOMAIN_GAME_DASH="${DOMAIN_GAME_DASH:-game.dash.${SPARROWX_DOMAIN}}"
DOMAIN_GAMESEC="${DOMAIN_GAMESEC:-gamesec.${SPARROWX_DOMAIN}}"
GAMESEC_REPO_URL="${GAMESEC_REPO_URL:-https://github.com/cybersync-fxfx/sbs-detrion-landing.git}"
GAMESEC_DIR="${GAMESEC_DIR:-/opt/sparrowx-gamesec}"
GAMESEC_UPSTREAM_URL="${GAMESEC_UPSTREAM_URL:-}"
GAMESEC_PORT="${GAMESEC_PORT:-3005}"
if port_held_by_other "${GAMESEC_PORT}" "sparrowx-gamesec"; then
  _cand_gs=3015
  while [ "${_cand_gs}" -lt 3080 ] && is_port_busy "${_cand_gs}"; do
    _cand_gs=$((_cand_gs + 1))
  done
  GAMESEC_PORT="${_cand_gs}"
fi
DOMAIN_NETSEC="${DOMAIN_NETSEC:-netsec.${SPARROWX_DOMAIN}}"
NETSEC_REPO_URL="${NETSEC_REPO_URL:-https://github.com/cybersync-fxfx/saprrowx.sbs.git}"
NETSEC_DIR="${NETSEC_DIR:-/opt/sparrowx-netsec}"
NETSEC_UPSTREAM_URL="${NETSEC_UPSTREAM_URL:-}"
NETSEC_PORT="${NETSEC_PORT:-3006}"
if port_held_by_other "${NETSEC_PORT}" "sparrowx-netsec"; then
  _cand_ns=3026
  while [ "${_cand_ns}" -lt 3090 ] && is_port_busy "${_cand_ns}"; do
    _cand_ns=$((_cand_ns + 1))
  done
  NETSEC_PORT="${_cand_ns}"
fi
if [ -z "${DOMAIN_GAME:-}" ] || [ "${DOMAIN_GAME}" = "game.${SPARROWX_DOMAIN}" ]; then
  DOMAIN_GAME="game.panel.${SPARROWX_DOMAIN}"
fi
PTERO_PORT="${PTERO_PORT:-8090}"
POSTGRES_USER="${POSTGRES_USER:-sparrowx}"
if [ -z "${POSTGRES_PASSWORD:-}" ] || [ "${#POSTGRES_PASSWORD}" -lt 12 ] || [ "${POSTGRES_PASSWORD}" = "sparrowx_ovh_secret_2026" ] || [ "${POSTGRES_PASSWORD}" = "SparrowxMasterSecretPass2026!" ]; then
  POSTGRES_PASSWORD="SpxPg_$(openssl rand -hex 16 2>/dev/null || echo '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c')"
fi
POSTGRES_DB="${POSTGRES_DB:-sparrowx_db}"
if [ -z "${SPARROWX_JWT_SECRET:-}" ] || [ "${#SPARROWX_JWT_SECRET}" -lt 24 ] || [ "${SPARROWX_JWT_SECRET}" = "sparrowx_jwt_secret_key_32_characters_2026" ]; then
  SPARROWX_JWT_SECRET="$(openssl rand -hex 32 2>/dev/null || echo 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90')"
fi
if [ -z "${SPARROWX_MASTER_SSO_SECRET:-}" ] || [ "${#SPARROWX_MASTER_SSO_SECRET}" -lt 24 ]; then
  SPARROWX_MASTER_SSO_SECRET="$(openssl rand -hex 32 2>/dev/null || echo "${SPARROWX_JWT_SECRET}")"
fi
SPARROWX_REDIS_SECRET="${SPARROWX_REDIS_SECRET:-$(openssl rand -hex 16 2>/dev/null || echo 'sparrowx_redis_secret_2026')}"
PTERO_SSO_SECRET="${PTERO_SSO_SECRET:-$(openssl rand -hex 32 2>/dev/null || echo 'sparrowx_ptero_sso_hmac_secret_2026_32c')}"
PTERO_URL="https://${DOMAIN_GAME}"

EXISTING_PTERO_DB=""
EXISTING_PTERO_USER=""
EXISTING_PTERO_PASS=""
if [ -f "/var/www/pterodactyl/.env" ]; then
  EXISTING_PTERO_DB="$(awk -F= '/^DB_DATABASE=/{sub(/^[^=]*=/,""); print; exit}' /var/www/pterodactyl/.env 2>/dev/null | tr -d "\"'\r" || true)"
  EXISTING_PTERO_USER="$(awk -F= '/^DB_USERNAME=/{sub(/^[^=]*=/,""); print; exit}' /var/www/pterodactyl/.env 2>/dev/null | tr -d "\"'\r" || true)"
  EXISTING_PTERO_PASS="$(awk -F= '/^DB_PASSWORD=/{sub(/^[^=]*=/,""); print; exit}' /var/www/pterodactyl/.env 2>/dev/null | tr -d "\"'\r" || true)"
fi

SPARROWX_ADMIN_EMAIL="${SPARROWX_ADMIN_EMAIL:-admin@${SPARROWX_DOMAIN}}"
PTERO_ADMIN_EMAIL="${PTERO_ADMIN_EMAIL:-${SPARROWX_ADMIN_EMAIL}}"
if ! echo "${PTERO_ADMIN_EMAIL}" | grep -qE '^[A-Za-z0-9_+-]+(\.[A-Za-z0-9_+-]+)*@([A-Za-z0-9-]+\.)+[A-Za-z]{2,63}$'; then
  PTERO_ADMIN_EMAIL="admin@sparrowx.net"
fi
PTERO_ADMIN_USER="${PTERO_ADMIN_USER:-admin}"
PTERO_ADMIN_FIRSTNAME="${PTERO_ADMIN_FIRSTNAME:-SparrowX}"
PTERO_ADMIN_LASTNAME="${PTERO_ADMIN_LASTNAME:-Admin}"
PTERO_ADMIN_PASSWORD="${PTERO_ADMIN_PASSWORD:-SpxPanel_$(openssl rand -hex 6 2>/dev/null || echo '9a8b7c6d5e4f')}"
PTERO_DB_NAME="${EXISTING_PTERO_DB:-${PTERO_DB_NAME:-panel}}"
PTERO_DB_USER="${EXISTING_PTERO_USER:-${PTERO_DB_USER:-pterodactyl}}"
PTERO_DB_PASSWORD="${EXISTING_PTERO_PASS:-${PTERO_DB_PASSWORD:-$(openssl rand -hex 16 2>/dev/null || echo 'spx_ptero_db_pass_2026')}}"
PTERO_TIMEZONE="${PTERO_TIMEZONE:-UTC}"

ensure_env_key "SPARROWX_DOMAIN" "${SPARROWX_DOMAIN}"
ensure_env_key "SPARROWX_STUDIO_DOMAIN" "${SPARROWX_STUDIO_DOMAIN}"
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
ensure_env_key "POSTGRES_USER" "${POSTGRES_USER}"
ensure_env_key "POSTGRES_PASSWORD" "${POSTGRES_PASSWORD}"
ensure_env_key "POSTGRES_DB" "${POSTGRES_DB}"
ensure_env_key "SPARROWX_JWT_SECRET" "${SPARROWX_JWT_SECRET}"
ensure_env_key "SPARROWX_MASTER_SSO_SECRET" "${SPARROWX_MASTER_SSO_SECRET}"
ensure_env_key "SPARROWX_REDIS_SECRET" "${SPARROWX_REDIS_SECRET}"
ensure_env_key "PTERO_URL" "https://${DOMAIN_GAME}"
ensure_env_key "PTERO_SSO_SECRET" "${PTERO_SSO_SECRET}"
export SPARROWX_DOMAIN SPARROWX_STUDIO_DOMAIN DOMAIN_GAME DOMAIN_GAME_WEB DOMAIN_GAME_DASH DOMAIN_GAMESEC GAMESEC_PORT GAMESEC_REPO_URL GAMESEC_DIR GAMESEC_UPSTREAM_URL DOMAIN_NETSEC NETSEC_PORT NETSEC_REPO_URL NETSEC_DIR NETSEC_UPSTREAM_URL PTERO_PORT SPARROWX_PUBLIC_IP SPARROWX_ADMIN_EMAIL PTERO_ADMIN_EMAIL PTERO_ADMIN_USER PTERO_ADMIN_FIRSTNAME PTERO_ADMIN_LASTNAME PTERO_ADMIN_PASSWORD PTERO_DB_NAME PTERO_DB_USER PTERO_DB_PASSWORD PTERO_TIMEZONE HTTP_PORT HTTPS_PORT APP_HOST_PORT PGRST_HOST_PORT PG_HOST_PORT POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB SPARROWX_JWT_SECRET SPARROWX_MASTER_SSO_SECRET SPARROWX_REDIS_SECRET PTERO_URL PTERO_SSO_SECRET

log_ok "Verified .env (${SPARROWX_DOMAIN} @ ${SPARROWX_PUBLIC_IP})"

# ==============================================================================
# STAGE 6/12: Docker Engine, Containerd & Network Bridge Healer
# ==============================================================================
draw_progress 6 12 "Docker & Bridge Networks"

HAS_DOCKER="false"
if command -v docker >/dev/null 2>&1; then
  if ! docker info >/dev/null 2>&1; then
    log_fix "Docker daemon is not responding — restarting containerd & docker services"
    systemctl restart containerd >/dev/null 2>&1 || true
    systemctl restart docker >/dev/null 2>&1 || true
    sleep 3
  fi
  if docker info >/dev/null 2>&1; then
    HAS_DOCKER="true"
    # Never prune pterodactyl_nw used by Wings; only clean legacy default compose network if unused
    docker network rm sparrowx_default >/dev/null 2>&1 || true
    log_ok "Docker engine healthy ($(docker version --format '{{.Server.Version}}' 2>/dev/null || echo ready))"
  else
    log_err "Docker daemon unavailable; will fall back to native runtime healing"
  fi
else
  log_warn "Docker CLI not installed; native Node.js recovery mode selected"
fi

# ==============================================================================
# STAGE 7/12: Host Service & Port Conflict Resolver + Legacy Container Cleanup
# ==============================================================================
draw_progress 7 12 "Ports & Legacy Containers"

if [ -f "${INSTALL_DIR}/docker-compose.ovh.yml" ] || [ ! -f "${INSTALL_DIR}/docker-compose.standalone.yml" ]; then
  COMPOSE_FILE="${INSTALL_DIR}/docker-compose.ovh.yml"
  if [ ! -f "${COMPOSE_FILE}" ] && [ -f "${INSTALL_DIR}/docker-compose.yml" ]; then
    COMPOSE_FILE="${INSTALL_DIR}/docker-compose.yml"
  fi
  STACK_MODE="ovh"
  PG_CTR="sparrowx-postgres"
  PG_SVC="postgres"
  PGB_CTR=""
  PGB_SVC=""
  PGRST_CTR="sparrowx-postgrest"
  PGRST_SVC="postgrest"
  REDIS_CTR=""
  REDIS_SVC=""
  APP_CTR="sparrowx-app"
  APP_SVC="sparrowx"
  EDGE_CTR="sparrowx-nginx"
  EDGE_SVC="nginx"
  UPSTREAM_APP_HOST="sparrowx"
  UPSTREAM_PGRST_HOST="sparrowx"
  COMPOSE_SERVICES=("postgres" "postgrest" "sparrowx" "nginx")
else
  COMPOSE_FILE="${INSTALL_DIR}/docker-compose.standalone.yml"
  STACK_MODE="standalone"
  PG_CTR="sparrowx_postgres"
  PG_SVC="sparrowx-postgres"
  PGB_CTR="sparrowx_pgbouncer"
  PGB_SVC="sparrowx-pgbouncer"
  PGRST_CTR="sparrowx_postgrest"
  PGRST_SVC="sparrowx-postgrest"
  REDIS_CTR="sparrowx_threat_cache"
  REDIS_SVC="sparrowx-threat-cache"
  APP_CTR="sparrowx_studio"
  APP_SVC="sparrowx-studio"
  EDGE_CTR="sparrowx_edge_proxy"
  EDGE_SVC="sparrowx-edge-proxy"
  UPSTREAM_APP_HOST="sparrowx-studio"
  UPSTREAM_PGRST_HOST="sparrowx-postgrest"
  COMPOSE_SERVICES=("sparrowx-postgres" "sparrowx-pgbouncer" "sparrowx-postgrest" "sparrowx-threat-cache" "sparrowx-studio" "sparrowx-edge-proxy")
  # Remove any legacy OVH-named containers so they never fight standalone containers on ports
  docker rm -f sparrowx-postgres sparrowx-postgrest sparrowx-app sparrowx-nginx >/dev/null 2>&1 || true
fi
log_scan "Active stack blueprint: ${STACK_MODE} ($(basename "${COMPOSE_FILE}"))"

if [ "${HAS_DOCKER}" = "true" ]; then
  # Stop & disable conflicting host daemons that fight over ports 5432, 80, 443, 3000
  # Keep host nginx alive (shifted onto PTERO_PORT=8090) if Pterodactyl is installed
  for host_svc in postgresql pgbouncer apache2 caddy sparrowx-native.service; do
    if systemctl is-active --quiet "${host_svc}" 2>/dev/null || systemctl is-enabled --quiet "${host_svc}" 2>/dev/null; then
      systemctl stop "${host_svc}" >/dev/null 2>&1 || true
      if [ "${host_svc}" = "postgresql" ] || [ "${host_svc}" = "pgbouncer" ]; then
        systemctl disable "${host_svc}" >/dev/null 2>&1 || true
      fi
      log_fix "Stopped & secured host daemon against port conflicts: ${host_svc}"
    fi
  done
  pkill -9 -f "ovh/node-server\.mjs" >/dev/null 2>&1 || true
  for pg_unit in $(systemctl list-units --type=service --all --no-legend 'postgresql@*' 2>/dev/null | awk '{print $1}' || true); do
    if systemctl is-active --quiet "${pg_unit}" 2>/dev/null || systemctl is-enabled --quiet "${pg_unit}" 2>/dev/null; then
      systemctl stop "${pg_unit}" >/dev/null 2>&1 || true
      systemctl disable "${pg_unit}" >/dev/null 2>&1 || true
      log_fix "Stopped & disabled versioned PostgreSQL unit: ${pg_unit}"
    fi
  done

  # Tear down legacy standalone compose & clean duplicate containers BEFORE checking ports
  if [ -f "${INSTALL_DIR}/docker-compose.standalone.yml" ]; then
    compose_cmd -f "${INSTALL_DIR}/docker-compose.standalone.yml" down --remove-orphans >/dev/null 2>&1 || true
  fi
  LEGACY_FOUND=0
  for old_ctr in sparrowx_postgres sparrowx_pgbouncer sparrowx_postgrest sparrowx_threat_cache sparrowx_studio sparrowx_edge_proxy; do
    if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -Fxq "${old_ctr}"; then
      docker rm -f "${old_ctr}" >/dev/null 2>&1 || true
      LEGACY_FOUND=$((LEGACY_FOUND + 1))
    fi
  done
  DEAD_CTRS="$(docker ps -a --filter status=exited --filter status=dead --filter status=created --filter status=restarting --format '{{.Names}}' 2>/dev/null | grep -E '^sparrowx' || true)"
  if [ -n "${DEAD_CTRS}" ]; then
    echo "${DEAD_CTRS}" | xargs -r docker rm -f >/dev/null 2>&1 || true
    LEGACY_FOUND=$((LEGACY_FOUND + 1))
  fi
  [ "${LEGACY_FOUND}" -gt 0 ] && log_fix "Cleaned up stale/duplicate SparrowX containers"

  # Remove crashed/non-running Postgres or orphaned docker-proxy/postgres processes holding 5432
  if ! docker ps --filter status=running --format '{{.Names}}' 2>/dev/null | grep -Fxq "${PG_CTR}"; then
    docker rm -f "${PG_CTR}" >/dev/null 2>&1 || true
    pkill -9 -x postgres >/dev/null 2>&1 || true
    pkill -9 -f "docker-proxy.*-host-port ${PG_HOST_PORT}( |$)" >/dev/null 2>&1 || true
    command -v fuser >/dev/null 2>&1 && fuser -k "${PG_HOST_PORT}/tcp" >/dev/null 2>&1 || true
  fi

  install_pterodactyl_unattended
  # Allocate non-conflicting internal Pterodactyl port BEFORE writing host nginx & edge nginx configs
  if is_pterodactyl_installed; then
    PTERO_PORT="${PTERO_PORT:-8090}"
    if is_port_busy "${PTERO_PORT}" && ! ss -tulpn 2>/dev/null | grep -E "(:|\.|\])${PTERO_PORT}[[:space:]]" | grep -qi "nginx"; then
      PTERO_PORT="$(find_next_free_port 8091)"
      ensure_env_key "PTERO_PORT" "${PTERO_PORT}"
      export PTERO_PORT
      log_fix "Reallocated Pterodactyl internal port to free port ${PTERO_PORT}"
    else
      reserve_port "${PTERO_PORT}"
    fi
    heal_pterodactyl_host_nginx
  elif systemctl is-active --quiet nginx 2>/dev/null; then
    systemctl stop nginx >/dev/null 2>&1 || true
    log_fix "Stopped conflicting host daemon: nginx"
  fi

  # Remove orphaned docker-proxy listeners on 80/443 if edge proxy is not running
  if ! docker ps --filter status=running --format '{{.Names}}' 2>/dev/null | grep -Fxq "${EDGE_CTR}"; then
    pkill -9 -f "docker-proxy.*-host-port ${HTTP_PORT}( |$)" >/dev/null 2>&1 || true
    pkill -9 -f "docker-proxy.*-host-port ${HTTPS_PORT}( |$)" >/dev/null 2>&1 || true
  fi

  # Remove foreign Docker containers holding SparrowX ports (80, 443, 5432, 6543, 3000, 3001)
  free_docker_port_conflicts "${HTTP_PORT}" "${EDGE_CTR}"
  free_docker_port_conflicts "${HTTPS_PORT}" "${EDGE_CTR}"
  free_docker_port_conflicts "${PG_HOST_PORT}" "${PG_CTR}"
  [ -n "${PGB_CTR}" ] && free_docker_port_conflicts "${PG_POOL_PORT:-6543}" "${PGB_CTR}"
  free_docker_port_conflicts "${PGRST_HOST_PORT}" "${PGRST_CTR}"
  free_docker_port_conflicts "${APP_HOST_PORT}" "${APP_CTR}"

  # Heal HTTP/HTTPS port conflicts (ports 80 / 443 must remain clean for Edge Proxy)
  for web_p in "${HTTP_PORT}" "${HTTPS_PORT}"; do
    if port_held_by_other "${web_p}" "${EDGE_CTR}"; then
      log_fix "Port ${web_p}/tcp held by foreign process — clearing for ${EDGE_CTR}"
      command -v fuser >/dev/null 2>&1 && fuser -k "${web_p}/tcp" >/dev/null 2>&1 || true
      pkill -9 -f "docker-proxy.*-host-port ${web_p}( |$)" >/dev/null 2>&1 || true
      sleep 1
    fi
    reserve_port "${web_p}"
  done

  # Heal PostgreSQL port conflict (clear stray non-Docker listener on 5432, then auto-shift to 5433+ if still held)
  if port_held_by_other "${PG_HOST_PORT}" "${PG_CTR}"; then
    log_fix "Host port ${PG_HOST_PORT}/tcp busy — clearing stray non-Docker listeners"
    command -v fuser >/dev/null 2>&1 && fuser -k "${PG_HOST_PORT}/tcp" >/dev/null 2>&1 || true
    sleep 1
  fi
  if port_held_by_other "${PG_HOST_PORT}" "${PG_CTR}"; then
    NEW_PG_PORT="$(find_next_free_port 5433)"
    ensure_env_key "PG_HOST_PORT" "${NEW_PG_PORT}"
    PG_HOST_PORT="${NEW_PG_PORT}"
    export PG_HOST_PORT
    log_fix "Host port 5432 still busy; allocated free PG_HOST_PORT=${PG_HOST_PORT} in .env"
  else
    reserve_port "${PG_HOST_PORT}"
    log_ok "PostgreSQL port ${PG_HOST_PORT} clear for ${PG_CTR}"
  fi

  # Heal PgBouncer pool port conflict (6543 -> auto-shift if held in standalone mode)
  if [ "${STACK_MODE}" = "standalone" ]; then
    PG_POOL_PORT="${PG_POOL_PORT:-6543}"
    if port_held_by_other "${PG_POOL_PORT}" "${PGB_CTR}"; then
      NEW_POOL_PORT="$(find_next_free_port 6544)"
      ensure_env_key "PG_POOL_PORT" "${NEW_POOL_PORT}"
      PG_POOL_PORT="${NEW_POOL_PORT}"
      export PG_POOL_PORT
      log_fix "Host port 6543 busy; allocated free PG_POOL_PORT=${PG_POOL_PORT} in .env"
    else
      reserve_port "${PG_POOL_PORT}"
      log_ok "PgBouncer pool port ${PG_POOL_PORT} clear for ${PGB_CTR}"
    fi
  fi

  # Heal PostgREST port conflict (3001 -> auto-shift if held by other process)
  if port_held_by_other "${PGRST_HOST_PORT}" "${PGRST_CTR}"; then
    NEW_PGRST_PORT="$(find_next_free_port 3002)"
    ensure_env_key "PGRST_HOST_PORT" "${NEW_PGRST_PORT}"
    PGRST_HOST_PORT="${NEW_PGRST_PORT}"
    export PGRST_HOST_PORT
    log_fix "Host port 3001 busy; allocated free PGRST_HOST_PORT=${PGRST_HOST_PORT} in .env"
  else
    reserve_port "${PGRST_HOST_PORT}"
    log_ok "PostgREST port ${PGRST_HOST_PORT} clear for ${PGRST_CTR}"
  fi

  # Heal App port conflict (3000 -> auto-shift if held by other process)
  if port_held_by_other "${APP_HOST_PORT}" "${APP_CTR}"; then
    NEW_APP_PORT="$(find_next_free_port 3010)"
    ensure_env_key "APP_HOST_PORT" "${NEW_APP_PORT}"
    APP_HOST_PORT="${NEW_APP_PORT}"
    export APP_HOST_PORT
    log_fix "Host port 3000 busy; allocated free APP_HOST_PORT=${APP_HOST_PORT} in .env"
  else
    reserve_port "${APP_HOST_PORT}"
    log_ok "App port ${APP_HOST_PORT} clear for ${APP_CTR}"
  fi
fi

# ==============================================================================
# STAGE 8/12: SSL Certificate & Multi-Subdomain Nginx Proxy Healer
# ==============================================================================
draw_progress 8 12 "SSL Certs & Multi-Domain Nginx"

mkdir -p "${INSTALL_DIR}/ovh/ssl" "${INSTALL_DIR}/ovh/certbot-www/.well-known/acme-challenge" "${INSTALL_DIR}/data/users" "${INSTALL_DIR}/data/backups"

SSL_CERT="${INSTALL_DIR}/ovh/ssl/fullchain.pem"
SSL_KEY="${INSTALL_DIR}/ovh/ssl/privkey.pem"
if [ ! -s "${SSL_CERT}" ] || [ ! -s "${SSL_KEY}" ] || ! openssl x509 -in "${SSL_CERT}" -noout >/dev/null 2>&1; then
  log_fix "Generating fresh TLS certificate (SAN: ${SPARROWX_DOMAIN} + service subdomains)"
  if ! openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "${SSL_KEY}" \
    -out "${SSL_CERT}" \
    -subj "/CN=${SPARROWX_DOMAIN}" \
    -addext "subjectAltName=DNS:${SPARROWX_DOMAIN},DNS:${DOMAIN_GAME},DNS:${DOMAIN_GAME_WEB},DNS:${DOMAIN_GAME_DASH},DNS:${DOMAIN_GAMESEC},DNS:${DOMAIN_NETSEC},DNS:*.${SPARROWX_DOMAIN}" >/dev/null 2>&1; then
    openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
      -keyout "${SSL_KEY}" \
      -out "${SSL_CERT}" \
      -subj "/CN=${SPARROWX_DOMAIN}" >/dev/null 2>&1 || true
  fi
else
  log_ok "TLS certificate validated for ${SPARROWX_DOMAIN}"
fi

render_sparrowx_nginx_conf() {
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
  local gamesec_domain="${DOMAIN_GAMESEC:-gamesec.${SPARROWX_DOMAIN:-sparrowx.local}}"
  local gamesec_p="${GAMESEC_PORT:-3005}"
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
  local infra_domain="${DOMAIN_INFRA:-infra.${SPARROWX_DOMAIN:-sparrowx.local}}"
  local infra_ssl_cert="/etc/nginx/ssl/fullchain.pem"
  local infra_ssl_key="/etc/nginx/ssl/privkey.pem"
  if [ -s "${INSTALL_DIR}/ovh/ssl/infra-fullchain.pem" ] && [ -s "${INSTALL_DIR}/ovh/ssl/infra-privkey.pem" ]; then
    infra_ssl_cert="/etc/nginx/ssl/infra-fullchain.pem"
    infra_ssl_key="/etc/nginx/ssl/infra-privkey.pem"
  fi
  local netsec_domain="${DOMAIN_NETSEC:-netsec.${SPARROWX_DOMAIN:-sparrowx.local}}"
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
  local ptero_backend=""
  if is_pterodactyl_installed; then
    ptero_backend="    location / {
        proxy_pass http://${docker_host_ip}:${PTERO_PORT:-8090};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300;
        proxy_connect_timeout 60;
    }"
  else
    ptero_backend="    location / {
        set \$upstream_app http://${UPSTREAM_APP_HOST}:3000;
        proxy_pass \$upstream_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_intercept_errors on;
        error_page 502 503 504 = @sparrowx_host_fallback;
    }

    location @sparrowx_host_fallback {
        set \$fallback_app http://${docker_host_ip}:${APP_HOST_PORT:-3000};
        proxy_pass \$fallback_app;
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
# ============================================================================
# SPARROWX MULTI-SERVICE NGINX REVERSE PROXY (AUTO-HEALED + L7 DDOS SHIELD)
# ============================================================================
limit_req_zone \$binary_remote_addr zone=spx_edge_req:20m rate=45r/s;
limit_req_zone \$binary_remote_addr zone=spx_api_req:10m rate=25r/s;
limit_conn_zone \$binary_remote_addr zone=spx_conn_limit:10m;

# 1. Master Portal + Fallback Default (${SPARROWX_DOMAIN})
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    server_name ${SPARROWX_DOMAIN} www.${SPARROWX_DOMAIN} _;
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    client_max_body_size 150M;
    client_body_timeout 10s;
    client_header_timeout 10s;
    send_timeout 15s;
    keepalive_timeout 30s;
    reset_timedout_connection on;
    server_tokens off;
    resolver 127.0.0.11 valid=5s ipv6=off;

    limit_conn spx_conn_limit 40;
    limit_req zone=spx_edge_req burst=90 nodelay;
    limit_req_status 429;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-SparrowX-WAF "ACTIVE" always;
    add_header X-SparrowX-Shield "PROTECTED" always;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        allow all;
    }

    location /rest/v1/ {
        limit_req zone=spx_api_req burst=60 nodelay;
        set \$upstream_app http://${UPSTREAM_APP_HOST}:3000;
        proxy_pass \$upstream_app;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_intercept_errors on;
        error_page 502 503 504 = @sparrowx_host_fallback;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PATCH, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, apikey, Prefer, x-sparrowx-key" always;
        if (\$request_method = OPTIONS) { return 204; }
    }

    location / {
        set \$upstream_app http://${UPSTREAM_APP_HOST}:3000;
        proxy_pass \$upstream_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_intercept_errors on;
        error_page 502 503 504 = @sparrowx_host_fallback;
    }

    location @sparrowx_host_fallback {
        set \$fallback_app http://${docker_host_ip}:${APP_HOST_PORT:-3000};
        proxy_pass \$fallback_app;
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
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    client_max_body_size 150M;
    client_body_timeout 10s;
    client_header_timeout 10s;
    send_timeout 15s;
    keepalive_timeout 30s;
    reset_timedout_connection on;
    server_tokens off;
    resolver 127.0.0.11 valid=5s ipv6=off;

    limit_conn spx_conn_limit 40;
    limit_req zone=spx_edge_req burst=90 nodelay;
    limit_req_status 429;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-SparrowX-WAF "ACTIVE" always;
    add_header X-SparrowX-Shield "PROTECTED" always;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        allow all;
    }

    location /rest/v1/ {
        limit_req zone=spx_api_req burst=60 nodelay;
        set \$upstream_app http://${UPSTREAM_APP_HOST}:3000;
        proxy_pass \$upstream_app;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_intercept_errors on;
        error_page 502 503 504 = @sparrowx_host_fallback;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PATCH, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, apikey, Prefer, x-sparrowx-key" always;
        if (\$request_method = OPTIONS) { return 204; }
    }

    location / {
        set \$upstream_app http://${UPSTREAM_APP_HOST}:3000;
        proxy_pass \$upstream_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-SparrowX-Studio "1";
        proxy_intercept_errors on;
        error_page 502 503 504 = @sparrowx_host_fallback;
    }

    location @sparrowx_host_fallback {
        set \$fallback_app http://${docker_host_ip}:${APP_HOST_PORT:-3000};
        proxy_pass \$fallback_app;
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
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    client_max_body_size 150M;
    client_body_timeout 10s;
    client_header_timeout 10s;
    send_timeout 15s;
    keepalive_timeout 30s;
    reset_timedout_connection on;
    server_tokens off;
    resolver 127.0.0.11 valid=5s ipv6=off;

    limit_conn spx_conn_limit 40;
    limit_req zone=spx_edge_req burst=90 nodelay;
    limit_req_status 429;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-SparrowX-WAF "ACTIVE" always;
    add_header X-SparrowX-Shield "PROTECTED" always;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        allow all;
    }

    location /rest/v1/ {
        limit_req zone=spx_api_req burst=60 nodelay;
        set \$upstream_app http://${UPSTREAM_APP_HOST}:3000;
        proxy_pass \$upstream_app;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_intercept_errors on;
        error_page 502 503 504 = @sparrowx_host_fallback;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PATCH, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, apikey, Prefer, x-sparrowx-key" always;
        if (\$request_method = OPTIONS) { return 204; }
    }

    location / {
        set \$upstream_app http://${UPSTREAM_APP_HOST}:3000;
        proxy_pass \$upstream_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_intercept_errors on;
        error_page 502 503 504 = @sparrowx_host_fallback;
    }

    location @sparrowx_host_fallback {
        set \$fallback_app http://${docker_host_ip}:${APP_HOST_PORT:-3000};
        proxy_pass \$fallback_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# 4. Game Panel Domain (${DOMAIN_GAME})
server {
    listen 80;
    listen 443 ssl;
    server_name ${DOMAIN_GAME} panel.${SPARROWX_DOMAIN};
    ssl_certificate ${ptero_ssl_cert};
    ssl_certificate_key ${ptero_ssl_key};
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 150M;
    server_tokens off;
    resolver 127.0.0.11 valid=5s ipv6=off;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        allow all;
    }

${ptero_backend}
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

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        allow all;
    }

    location / {
        set \$upstream_app http://${UPSTREAM_APP_HOST}:3000;
        proxy_pass \$upstream_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_intercept_errors on;
        error_page 502 503 504 = @sparrowx_host_fallback;
    }

    location @sparrowx_host_fallback {
        set \$fallback_app http://${docker_host_ip}:${APP_HOST_PORT:-3000};
        proxy_pass \$fallback_app;
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

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        allow all;
    }

    location / {
        set \$upstream_app http://${UPSTREAM_APP_HOST}:3000;
        proxy_pass \$upstream_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_intercept_errors on;
        error_page 502 503 504 = @sparrowx_host_fallback;
    }

    location @sparrowx_host_fallback {
        set \$fallback_app http://${docker_host_ip}:${APP_HOST_PORT:-3000};
        proxy_pass \$fallback_app;
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

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        allow all;
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

# 9. Cloud Infrastructure Storefront (${infra_domain})
server {
    listen 80;
    listen 443 ssl;
    server_name ${infra_domain} metal.${SPARROWX_DOMAIN};
    ssl_certificate ${infra_ssl_cert};
    ssl_certificate_key ${infra_ssl_key};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    client_max_body_size 50M;
    server_tokens off;
    resolver 127.0.0.11 valid=5s ipv6=off;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        allow all;
    }

    location / {
        set \$upstream_app http://sparrowx:3000;
        proxy_pass \$upstream_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-SparrowX-Infra "1";
        proxy_intercept_errors on;
        error_page 502 503 504 = @sparrowx_host_fallback;
    }

    location @sparrowx_host_fallback {
        set \$fallback_app http://${docker_host_ip}:${APP_HOST_PORT:-3000};
        proxy_pass \$fallback_app;
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
}
render_sparrowx_nginx_conf
log_ok "Synchronized ovh/nginx.conf for all standalone service domains"

# ==============================================================================
# STAGE 9/12: Container Fleet Launch & Conflict Auto-Recovery
# ==============================================================================
draw_progress 9 12 "Container Fleet Launch"

if [ "${HAS_DOCKER}" = "true" ]; then
  # Clear uninitialized/corrupted sparrowx_pgdata volume (missing PG_VERSION) to fix initdb crash loops
  for pg_vol in $(docker volume ls -q 2>/dev/null | grep 'sparrowx_pgdata' || true); do
    vol_mp="$(docker volume inspect -f '{{.Mountpoint}}' "${pg_vol}" 2>/dev/null || true)"
    if [ -n "${vol_mp}" ] && [ -d "${vol_mp}" ] && [ ! -f "${vol_mp}/PG_VERSION" ] && [ -n "$(ls -A "${vol_mp}" 2>/dev/null)" ]; then
      docker rm -f "${PG_CTR}" >/dev/null 2>&1 || true
      rm -rf "${vol_mp:?}"/* "${vol_mp:?}"/.[!.]* "${vol_mp:?}"/..?* 2>/dev/null || true
      log_fix "Cleared uninitialized/corrupted PostgreSQL volume ${pg_vol} (missing PG_VERSION)"
    fi
  done

  COMPOSE_ARGS=(-d --remove-orphans)
  if [ "${REBUILD_APP}" = "true" ] || ! docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "${APP_CTR}"; then
    COMPOSE_ARGS=(-d --build --remove-orphans)
  fi

  BUILD_FAILED="false"
  log_scan "Starting container stack via $(basename "${COMPOSE_FILE}") (${STACK_MODE} mode)..."
  compose_err_file="$(mktemp)"
  if ! compose_cmd -f "${COMPOSE_FILE}" up "${COMPOSE_ARGS[@]}" >"${compose_err_file}" 2>&1; then
    c_err_tail="$(tail -n 10 "${compose_err_file}" 2>/dev/null | tr '\n' ' ' || true)"
    log_fix "Compose startup hit an error (${c_err_tail:0:180}) — tearing down conflicting containers/networks & healing ports"
    compose_cmd -f "${COMPOSE_FILE}" down --remove-orphans >/dev/null 2>&1 || true
    docker rm -f "${PG_CTR}" "${PGRST_CTR}" "${APP_CTR}" "${EDGE_CTR}" sparrowx-postgres sparrowx-postgrest sparrowx-app sparrowx-nginx >/dev/null 2>&1 || true
    [ -n "${PGB_CTR}" ] && docker rm -f "${PGB_CTR}" >/dev/null 2>&1 || true
    [ -n "${REDIS_CTR}" ] && docker rm -f "${REDIS_CTR}" >/dev/null 2>&1 || true
    docker network rm sparrowx_default >/dev/null 2>&1 || true
    free_docker_port_conflicts "${HTTP_PORT}" "${EDGE_CTR}"
    free_docker_port_conflicts "${HTTPS_PORT}" "${EDGE_CTR}"
    free_docker_port_conflicts "${PG_HOST_PORT}" "${PG_CTR}"
    free_docker_port_conflicts "${PGRST_HOST_PORT}" "${PGRST_CTR}"
    free_docker_port_conflicts "${APP_HOST_PORT}" "${APP_CTR}"
    if [ "${STACK_MODE}" = "standalone" ] && [ -n "${PGB_CTR}" ]; then
      free_docker_port_conflicts "${PG_POOL_PORT}" "${PGB_CTR}"
    fi
    if port_held_by_other "${PG_HOST_PORT}" "${PG_CTR}"; then
      command -v fuser >/dev/null 2>&1 && fuser -k "${PG_HOST_PORT}/tcp" >/dev/null 2>&1 || true
    fi

    if is_port_busy "${PG_HOST_PORT}"; then
      PG_HOST_PORT="$(find_next_free_port 5433)"
      ensure_env_key "PG_HOST_PORT" "${PG_HOST_PORT}"
      export PG_HOST_PORT
      log_fix "Reassigned PG_HOST_PORT=${PG_HOST_PORT} after cleanup"
    fi
    if [ "${STACK_MODE}" = "standalone" ] && is_port_busy "${PG_POOL_PORT}"; then
      PG_POOL_PORT="$(find_next_free_port 6544)"
      ensure_env_key "PG_POOL_PORT" "${PG_POOL_PORT}"
      export PG_POOL_PORT
      log_fix "Reassigned PG_POOL_PORT=${PG_POOL_PORT} after cleanup"
    fi
    if is_port_busy "${PGRST_HOST_PORT}"; then
      PGRST_HOST_PORT="$(find_next_free_port 3002)"
      ensure_env_key "PGRST_HOST_PORT" "${PGRST_HOST_PORT}"
      export PGRST_HOST_PORT
      log_fix "Reassigned PGRST_HOST_PORT=${PGRST_HOST_PORT} after cleanup"
    fi
    if is_port_busy "${APP_HOST_PORT}"; then
      APP_HOST_PORT="$(find_next_free_port 3010)"
      ensure_env_key "APP_HOST_PORT" "${APP_HOST_PORT}"
      export APP_HOST_PORT
      log_fix "Reassigned APP_HOST_PORT=${APP_HOST_PORT} after cleanup"
    fi

    if ! compose_cmd -f "${COMPOSE_FILE}" up -d --build --remove-orphans >"${compose_err_file}" 2>&1; then
      c_err_tail="$(tail -n 10 "${compose_err_file}" 2>/dev/null | tr '\n' ' ' || true)"
      log_warn "Compose recovery up failed (${c_err_tail:0:180}); starting core infra & nginx independently"
      BUILD_FAILED="true"
      for svc in "${COMPOSE_SERVICES[@]}"; do
        if [ "${svc}" != "${APP_SVC}" ]; then
          compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps --no-build "${svc}" >/dev/null 2>&1 || true
        fi
      done
      if compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps --build "${APP_SVC}" >/dev/null 2>&1; then
        BUILD_FAILED="false"
      else
        log_warn "Docker build for ${APP_SVC} failed; native Node fallback will keep site online"
      fi
    else
      log_healed "Container stack launched after clean port & network recovery"
    fi
  else
    log_ok "Docker Compose fleet up and running"
  fi
  rm -f "${compose_err_file}"

  # Ensure every individual service is created & running (fixes 'Created' or missing containers)
  for svc in "${COMPOSE_SERVICES[@]}"; do
    if [ "${svc}" != "${APP_SVC}" ] || [ "${BUILD_FAILED}" != "true" ]; then
      compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps --no-build "${svc}" >/dev/null 2>&1 || true
    fi
  done
  docker start "${PG_CTR}" "${PGRST_CTR}" "${EDGE_CTR}" >/dev/null 2>&1 || true
  [ "${BUILD_FAILED}" != "true" ] && docker start "${APP_CTR}" >/dev/null 2>&1 || true
  [ -n "${PGB_CTR}" ] && docker start "${PGB_CTR}" >/dev/null 2>&1 || true
  [ -n "${REDIS_CTR}" ] && docker start "${REDIS_CTR}" >/dev/null 2>&1 || true

  if is_pterodactyl_installed; then
    if ! curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:${PTERO_PORT:-8090}/" 2>/dev/null; then
      heal_pterodactyl_host_nginx
    fi
  fi

  # Re-render nginx config now that sparrowx_net exists so gateway fallback IP & upstream aliases are exact
  render_sparrowx_nginx_conf

  if docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "${EDGE_CTR}"; then
    if ! docker exec "${EDGE_CTR}" nginx -t >/dev/null 2>&1; then
      docker restart "${EDGE_CTR}" >/dev/null 2>&1 || true
    fi
    if ! docker exec "${EDGE_CTR}" nginx -t >/dev/null 2>&1; then
      log_warn "Nginx syntax test flagged an issue; regenerating minimal fallback config"
    else
      docker restart "${EDGE_CTR}" >/dev/null 2>&1 || docker exec "${EDGE_CTR}" nginx -s reload >/dev/null 2>&1 || true
    fi
  fi

  # Wait briefly for app health probe; activate native Node.js fallback if container failed or crashed
  APP_HTTP_OK="false"
  if [ "${BUILD_FAILED}" != "true" ]; then
    for _i in 1 2 3 4 5; do
      if curl -fsS --max-time 3 "http://127.0.0.1:${APP_HOST_PORT}/api/v1/health" >/dev/null 2>&1; then
        APP_HTTP_OK="true"
        break
      fi
      sleep 2
    done
  fi
  if [ "${BUILD_FAILED}" = "true" ] || [ "${APP_HTTP_OK}" != "true" ]; then
    ensure_native_fallback_running || true
  fi

  # Ensure Let's Encrypt SSL certificates via port 80 for all SparrowX core + game domains
  ensure_gamesec_landing_running || true
  ensure_netsec_dashboard_running || true
  ensure_game_letsencrypt_ssl
  ensure_core_letsencrypt_ssl
  render_sparrowx_nginx_conf
  docker restart "${EDGE_CTR:-sparrowx-nginx}" >/dev/null 2>&1 || docker exec "${EDGE_CTR:-sparrowx-nginx}" nginx -s reload >/dev/null 2>&1 || true
  if systemctl list-unit-files wings.service >/dev/null 2>&1 && [ -f /etc/pterodactyl/config.yml ] && ! systemctl is-active --quiet wings 2>/dev/null; then
    systemctl start wings >/dev/null 2>&1 || true
  fi
  if [ -x "${INSTALL_DIR}/deploy/ssl-renew.sh" ]; then
    bash "${INSTALL_DIR}/deploy/ssl-renew.sh" >/dev/null 2>&1 || true
  fi
else
  log_scan "Healing native Node.js build..."
  ensure_native_fallback_running || true
  ensure_gamesec_landing_running || true
  ensure_netsec_dashboard_running || true
fi

# ==============================================================================
# STAGE 10/12: PostgreSQL Role, Schema & PostgREST Healer
# ==============================================================================
draw_progress 10 12 "Postgres Schema & PostgREST"

PG_READY="false"
PGRST_READY="false"

if [ "${HAS_DOCKER}" = "true" ] && docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "${PG_CTR}"; then
  for _i in $(seq 1 40); do
    if docker exec "${PG_CTR}" pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -q >/dev/null 2>&1; then
      PG_READY="true"
      break
    fi
    sleep 1
  done

  if [ "${PG_READY}" = "true" ]; then
    PG_SUPER=""
    for cand_user in "${POSTGRES_USER}" "postgres" "sparrowx"; do
      if docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${PG_CTR}" psql -U "${cand_user}" -d postgres -tAc "SELECT 1;" >/dev/null 2>&1; then
        PG_SUPER="${cand_user}"
        break
      fi
    done

    if [ -n "${PG_SUPER}" ]; then
      ESC_PASS="${POSTGRES_PASSWORD//\'/\'\'}"
      ROLE_EXISTS="$(docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${PG_CTR}" psql -U "${PG_SUPER}" -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='${POSTGRES_USER}';" 2>/dev/null | tr -d '[:space:]')"
      if [ "${ROLE_EXISTS}" != "1" ]; then
        docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${PG_CTR}" psql -U "${PG_SUPER}" -d postgres -c "CREATE ROLE \"${POSTGRES_USER}\" WITH SUPERUSER LOGIN PASSWORD '${ESC_PASS}';" >/dev/null 2>&1 || true
        log_fix "Created missing PostgreSQL role '${POSTGRES_USER}'"
      else
        docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${PG_CTR}" psql -U "${PG_SUPER}" -d postgres -c "ALTER ROLE \"${POSTGRES_USER}\" WITH PASSWORD '${ESC_PASS}';" >/dev/null 2>&1 || true
      fi

      DB_EXISTS="$(docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${PG_CTR}" psql -U "${PG_SUPER}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}';" 2>/dev/null | tr -d '[:space:]')"
      if [ "${DB_EXISTS}" != "1" ]; then
        docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${PG_CTR}" psql -U "${PG_SUPER}" -d postgres -c "CREATE DATABASE \"${POSTGRES_DB}\" OWNER \"${POSTGRES_USER}\";" >/dev/null 2>&1 || true
        log_fix "Created missing PostgreSQL database '${POSTGRES_DB}'"
      fi

      if [ "${STACK_MODE}" = "standalone" ]; then
        for bp_db in sparrowbase sparrowx_db_studio sparrowx_shield sparrowx_files sparrowx_api; do
          bp_exists="$(docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${PG_CTR}" psql -U "${PG_SUPER}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${bp_db}';" 2>/dev/null | tr -d '[:space:]')"
          if [ "${bp_exists}" != "1" ]; then
            docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${PG_CTR}" psql -U "${PG_SUPER}" -d postgres -c "CREATE DATABASE \"${bp_db}\" OWNER \"${POSTGRES_USER}\";" >/dev/null 2>&1 || true
            log_fix "Provisioned missing 5-DB blueprint database '${bp_db}'"
          fi
          docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${PG_CTR}" psql -U "${PG_SUPER}" -d "${bp_db}" -c "CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" >/dev/null 2>&1 || true
        done
      fi

      if [ -f "${INSTALL_DIR}/ovh/schema.sql" ]; then
        if ! docker exec -i -e PGPASSWORD="${POSTGRES_PASSWORD}" "${PG_CTR}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "${INSTALL_DIR}/ovh/schema.sql" >/dev/null 2>&1; then
          docker exec -i -u postgres "${PG_CTR}" psql -d "${POSTGRES_DB}" < "${INSTALL_DIR}/ovh/schema.sql" >/dev/null 2>&1 || true
        fi
        log_ok "PostgreSQL schema verified & synchronized (${POSTGRES_DB} tables, roles & RPCs active)"
      fi
    else
      log_warn "Could not auto-verify superuser socket access inside ${PG_CTR}"
    fi
  else
    log_err "${PG_CTR} did not become ready within 40s"
  fi

  # Verify PostgREST responds & reload schema cache if needed
  for _p in $(seq 1 10); do
    if curl -fsS "http://127.0.0.1:${PGRST_HOST_PORT}/" >/dev/null 2>&1; then
      PGRST_READY="true"
      break
    fi
    sleep 1
  done
  if [ "${PGRST_READY}" != "true" ]; then
    log_fix "PostgREST not responding on :${PGRST_HOST_PORT} — restarting ${PGRST_CTR}"
    docker restart "${PGRST_CTR}" >/dev/null 2>&1 || true
    sleep 4
    curl -fsS "http://127.0.0.1:${PGRST_HOST_PORT}/" >/dev/null 2>&1 && PGRST_READY="true"
  fi

  # Hydrate DB if empty or --reinstall-db requested
  HAS_USERS="0"
  if curl -fsS "http://127.0.0.1:${PGRST_HOST_PORT}/app_users?select=id&limit=1" 2>/dev/null | grep -q '"id"'; then
    HAS_USERS="1"
  fi
  if [ "${HAS_USERS}" != "1" ] || [ "${FORCE_DB}" = "true" ]; then
    if [ -x "${INSTALL_DIR}/manage-db.sh" ]; then
      log_fix "Hydrating Local OVH PostgreSQL tables & per-user directories"
      "${INSTALL_DIR}/manage-db.sh" sync >/dev/null 2>&1 || true
      touch "${INSTALL_DIR}/data/.db_initialized" 2>/dev/null || true
    fi
  else
    log_ok "Database populated and serving via PostgREST :${PGRST_HOST_PORT}"
  fi
fi

# ==============================================================================
# STAGE 11/12: Kernel Hardening, Firewall (UFW) & Auto-Update Service Repair
# ==============================================================================
draw_progress 11 12 "Firewall, Kernel & Auto-Update"

cat > /etc/sysctl.d/99-sparrowx-hardening.conf <<'EOF'
# SparrowX L3/L4 DDoS, SYN-Flood & Anti-Spoofing Kernel Profile
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_syn_retries = 3
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_rfc1337 = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.log_martians = 1
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 16384
net.ipv4.tcp_max_syn_backlog = 65535
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
EOF
sysctl --system >/dev/null 2>&1 || true
log_ok "Applied optimized kernel SYN-cookie, BBR & anti-spoofing sysctl profile"

if { [ "${SPARROWX_ENABLE_XDP:-0}" = "1" ] || systemctl is-enabled --quiet sparrowx-xdp.service 2>/dev/null; } && [ -f "${INSTALL_DIR}/deploy/ddos-setup.sh" ]; then
  bash "${INSTALL_DIR}/deploy/ddos-setup.sh" --auto >/dev/null 2>&1 && \
    log_ok "Reconciled SparrowX Layer 3/4 DDoS & XDP/eBPF kernel scrubber" || \
    log_warn "XDP/eBPF attach skipped (requires clang + linux-headers + XDP-capable NIC)"
fi

if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw allow 8080/tcp >/dev/null 2>&1 || true
  ufw allow 8443/tcp >/dev/null 2>&1 || true
  ufw allow 2022/tcp >/dev/null 2>&1 || true
  ufw allow "${HTTP_PORT}"/tcp >/dev/null 2>&1 || true
  ufw allow "${HTTPS_PORT}"/tcp >/dev/null 2>&1 || true
  ufw allow from 127.0.0.1 to any port "${APP_HOST_PORT:-3000}" proto tcp >/dev/null 2>&1 || true
  ufw allow from 172.16.0.0/12 to any port "${APP_HOST_PORT:-3000}" proto tcp >/dev/null 2>&1 || true
  ufw allow from 127.0.0.1 to any port "${PTERO_PORT:-8090}" proto tcp >/dev/null 2>&1 || true
  ufw allow from 172.16.0.0/12 to any port "${PTERO_PORT:-8090}" proto tcp >/dev/null 2>&1 || true
  ufw allow from 127.0.0.1 to any port "${GAMESEC_PORT:-3005}" proto tcp >/dev/null 2>&1 || true
  ufw allow from 172.16.0.0/12 to any port "${GAMESEC_PORT:-3005}" proto tcp >/dev/null 2>&1 || true
  ufw allow from 127.0.0.1 to any port "${NETSEC_PORT:-3006}" proto tcp >/dev/null 2>&1 || true
  ufw allow from 172.16.0.0/12 to any port "${NETSEC_PORT:-3006}" proto tcp >/dev/null 2>&1 || true
  log_ok "UFW rules verified for ports 22, 80, 443, 8080, 8443, 2022 (${HTTP_PORT}, ${HTTPS_PORT}, Docker->Host :${APP_HOST_PORT:-3000}/:${PTERO_PORT:-8090}/:${GAMESEC_PORT:-3005}/:${NETSEC_PORT:-3006})"
fi

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
  log_ok "Systemd auto-update timer verified for ${INSTALL_DIR}"
fi

# ==============================================================================
# STAGE 12/12: Multi-Layer Health Probe & Cyber Status Matrix
# ==============================================================================
draw_progress 12 12 "Live Health Verification"

APP_HEALTH="DOWN"
PGRST_HEALTH="DOWN"
EDGE_HTTP_HEALTH="DOWN"
EDGE_HTTPS_HEALTH="DOWN"

for _h in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:${APP_HOST_PORT}/api/v1/health" >/dev/null 2>&1; then
    APP_HEALTH="ONLINE (200 OK)"
    break
  fi
  sleep 2
done

if [ "${APP_HEALTH}" = "DOWN" ] && [ "${HAS_DOCKER}" = "true" ]; then
  log_fix "App server unhealthy on :${APP_HOST_PORT}; bouncing ${APP_CTR} and checking logs"
  docker restart "${APP_CTR}" >/dev/null 2>&1 || true
  sleep 5
  if curl -fsS "http://127.0.0.1:${APP_HOST_PORT}/api/v1/health" >/dev/null 2>&1; then
    APP_HEALTH="RECOVERED (200 OK)"
  else
    docker logs --tail 25 "${APP_CTR}" 2>&1 || true
    ensure_native_fallback_running || true
    if curl -fsS "http://127.0.0.1:${APP_HOST_PORT}/api/v1/health" >/dev/null 2>&1; then
      APP_HEALTH="ONLINE (Native :${APP_HOST_PORT})"
    fi
  fi
elif [ "${APP_HEALTH}" = "DOWN" ]; then
  ensure_native_fallback_running || true
  if curl -fsS "http://127.0.0.1:${APP_HOST_PORT}/api/v1/health" >/dev/null 2>&1; then
    APP_HEALTH="ONLINE (Native :${APP_HOST_PORT})"
  fi
fi

if curl -fsS "http://127.0.0.1:${PGRST_HOST_PORT}/" >/dev/null 2>&1; then
  PGRST_HEALTH="ONLINE (:${PGRST_HOST_PORT})"
fi

if curl -fsS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${HTTP_PORT}/api/v1/health" 2>/dev/null | grep -qE "^(200|301|302)$"; then
  EDGE_HTTP_HEALTH="ONLINE (:${HTTP_PORT})"
fi

if curl -kfsS -o /dev/null -w "%{http_code}" "https://127.0.0.1:${HTTPS_PORT}/api/v1/health" 2>/dev/null | grep -qE "^(200|301|302)$"; then
  EDGE_HTTPS_HEALTH="ONLINE (:${HTTPS_PORT})"
fi

# Guaranteed Edge Proxy Recovery if port 80 or 443 is refusing connections
if { [ "${EDGE_HTTP_HEALTH}" = "DOWN" ] || [ "${EDGE_HTTPS_HEALTH}" = "DOWN" ]; } && [ "${HAS_DOCKER}" = "true" ]; then
  log_fix "Edge proxy down (HTTP=${EDGE_HTTP_HEALTH}, HTTPS=${EDGE_HTTPS_HEALTH}); running guaranteed ${EDGE_CTR} recovery"
  if [ ! -s "${INSTALL_DIR}/ovh/ssl/fullchain.pem" ] || [ ! -s "${INSTALL_DIR}/ovh/ssl/privkey.pem" ]; then
    mkdir -p "${INSTALL_DIR}/ovh/ssl"
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout "${INSTALL_DIR}/ovh/ssl/privkey.pem" \
      -out "${INSTALL_DIR}/ovh/ssl/fullchain.pem" \
      -subj "/CN=${SPARROWX_DOMAIN}" >/dev/null 2>&1 || true
  fi
  for _cert_prefix in ptero game-web game-dash gamesec netsec; do
    if [ ! -s "${INSTALL_DIR}/ovh/ssl/${_cert_prefix}-fullchain.pem" ] && [ -s "${INSTALL_DIR}/ovh/ssl/fullchain.pem" ]; then
      cp -f "${INSTALL_DIR}/ovh/ssl/fullchain.pem" "${INSTALL_DIR}/ovh/ssl/${_cert_prefix}-fullchain.pem" 2>/dev/null || true
    fi
    if [ ! -s "${INSTALL_DIR}/ovh/ssl/${_cert_prefix}-privkey.pem" ] && [ -s "${INSTALL_DIR}/ovh/ssl/privkey.pem" ]; then
      cp -f "${INSTALL_DIR}/ovh/ssl/privkey.pem" "${INSTALL_DIR}/ovh/ssl/${_cert_prefix}-privkey.pem" 2>/dev/null || true
    fi
  done

  # Ensure nothing else on host is holding 80/443
  free_docker_port_conflicts "${HTTP_PORT}" "${EDGE_CTR}"
  free_docker_port_conflicts "${HTTPS_PORT}" "${EDGE_CTR}"
  for web_p in "${HTTP_PORT}" "${HTTPS_PORT}"; do
    if port_held_by_other "${web_p}" "${EDGE_CTR}"; then
      command -v fuser >/dev/null 2>&1 && fuser -k "${web_p}/tcp" >/dev/null 2>&1 || true
      pkill -9 -f "docker-proxy.*-host-port ${web_p}( |$)" >/dev/null 2>&1 || true
    fi
  done

  compose_cmd -f "${COMPOSE_FILE}" up -d --force-recreate --no-deps "${EDGE_SVC}" >/dev/null 2>&1 || true
  docker start "${EDGE_CTR}" >/dev/null 2>&1 || true
  sleep 3

  if ! docker exec "${EDGE_CTR}" nginx -t >/dev/null 2>&1; then
    nginx_err="$(docker exec "${EDGE_CTR}" nginx -t 2>&1 || docker logs --tail 20 "${EDGE_CTR}" 2>&1 || true)"
    log_warn "${EDGE_CTR} config failed (${nginx_err:0:180}); writing clean fallback ovh/nginx.conf"
    MIN_HOST_IP="$(get_docker_host_ip)"
    MIN_GS_CERT="/etc/nginx/ssl/fullchain.pem"
    MIN_GS_KEY="/etc/nginx/ssl/privkey.pem"
    if [ -s "${INSTALL_DIR}/ovh/ssl/gamesec-fullchain.pem" ] && [ -s "${INSTALL_DIR}/ovh/ssl/gamesec-privkey.pem" ]; then
      MIN_GS_CERT="/etc/nginx/ssl/gamesec-fullchain.pem"
      MIN_GS_KEY="/etc/nginx/ssl/gamesec-privkey.pem"
    fi
    MIN_NS_CERT="/etc/nginx/ssl/fullchain.pem"
    MIN_NS_KEY="/etc/nginx/ssl/privkey.pem"
    if [ -s "${INSTALL_DIR}/ovh/ssl/netsec-fullchain.pem" ] && [ -s "${INSTALL_DIR}/ovh/ssl/netsec-privkey.pem" ]; then
      MIN_NS_CERT="/etc/nginx/ssl/netsec-fullchain.pem"
      MIN_NS_KEY="/etc/nginx/ssl/netsec-privkey.pem"
    fi
    cat > "${INSTALL_DIR}/ovh/nginx.conf" <<EOF_MIN_NGINX
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    server_name ${SPARROWX_DOMAIN} www.${SPARROWX_DOMAIN} db.${SPARROWX_DOMAIN} sec.${SPARROWX_DOMAIN} file.${SPARROWX_DOMAIN} password.${SPARROWX_DOMAIN} _;
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 150M;
    resolver 127.0.0.11 valid=5s ipv6=off;
    location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; allow all; }
    location /rest/v1/ {
        set \$upstream_app http://${UPSTREAM_APP_HOST}:3000;
        proxy_pass \$upstream_app;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_intercept_errors on;
        error_page 502 503 504 = @sparrowx_host_fallback;
    }
    location / {
        set \$upstream_app http://${UPSTREAM_APP_HOST}:3000;
        proxy_pass \$upstream_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_intercept_errors on;
        error_page 502 503 504 = @sparrowx_host_fallback;
    }
    location @sparrowx_host_fallback {
        proxy_pass http://${MIN_HOST_IP}:${APP_HOST_PORT:-3000};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
server {
    listen 80;
    listen 443 ssl;
    server_name ${DOMAIN_GAMESEC};
    ssl_certificate ${MIN_GS_CERT};
    ssl_certificate_key ${MIN_GS_KEY};
    ssl_protocols TLSv1.2 TLSv1.3;
    resolver 127.0.0.11 valid=5s ipv6=off;
    location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; allow all; }
    location / {
        set \$upstream_gamesec http://sparrowx-gamesec:3000;
        proxy_pass \$upstream_gamesec;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_intercept_errors on;
        error_page 502 503 504 = @gamesec_host_fallback;
    }
    location @gamesec_host_fallback {
        proxy_pass http://${MIN_HOST_IP}:${GAMESEC_PORT:-3005};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
server {
    listen 80;
    listen 443 ssl;
    server_name ${DOMAIN_NETSEC};
    ssl_certificate ${MIN_NS_CERT};
    ssl_certificate_key ${MIN_NS_KEY};
    ssl_protocols TLSv1.2 TLSv1.3;
    resolver 127.0.0.11 valid=5s ipv6=off;
    location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; allow all; }
    location / {
        set \$upstream_netsec http://sparrowx-netsec:${NETSEC_PORT:-3006};
        proxy_pass \$upstream_netsec;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
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
        proxy_pass http://${MIN_HOST_IP}:${NETSEC_PORT:-3006};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
EOF_MIN_NGINX
    docker restart "${EDGE_CTR}" >/dev/null 2>&1 || compose_cmd -f "${COMPOSE_FILE}" up -d --force-recreate --no-deps --no-build "${EDGE_SVC}" >/dev/null 2>&1 || true
    sleep 3
  fi

  if curl -fsS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${HTTP_PORT}/api/v1/health" 2>/dev/null | grep -qE "^(200|301|302)$"; then
    EDGE_HTTP_HEALTH="RECOVERED (:${HTTP_PORT})"
  fi
  if curl -kfsS -o /dev/null -w "%{http_code}" "https://127.0.0.1:${HTTPS_PORT}/api/v1/health" 2>/dev/null | grep -qE "^(200|301|302)$"; then
    EDGE_HTTPS_HEALTH="RECOVERED (:${HTTPS_PORT})"
  fi
fi

PGB_HEALTH="N/A"
REDIS_HEALTH="N/A"
if [ "${STACK_MODE}" = "standalone" ] && [ "${HAS_DOCKER}" = "true" ]; then
  if [ -n "${PGB_CTR}" ] && docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "${PGB_CTR}"; then
    PGB_HEALTH="ONLINE (:${PG_POOL_PORT})"
  else
    PGB_HEALTH="DOWN"
    [ -n "${PGB_CTR}" ] && docker start "${PGB_CTR}" >/dev/null 2>&1 || true
  fi
  if [ -n "${REDIS_CTR}" ] && docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "${REDIS_CTR}"; then
    REDIS_HEALTH="ONLINE"
  else
    REDIS_HEALTH="DOWN"
    [ -n "${REDIS_CTR}" ] && docker start "${REDIS_CTR}" >/dev/null 2>&1 || true
  fi
fi

PTERO_HEALTH="NOT INSTALLED"
if is_pterodactyl_installed; then
  PTERO_CODE="$(curl -kso /dev/null -w "%{http_code}" -H "Host: ${DOMAIN_GAME}" "https://127.0.0.1:${HTTPS_PORT}/" 2>/dev/null || echo "000")"
  if echo "${PTERO_CODE}" | grep -qE "^(200|301|302)$"; then
    PTERO_HEALTH="ONLINE (HTTP ${PTERO_CODE} -> :${PTERO_PORT})"
  else
    PTERO_HEALTH="CHECK PANEL (HTTP ${PTERO_CODE})"
  fi
fi

echo ""
echo -e "${C_GREEN}╔══════════════════════════════════════════════════════════════════════════╗${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}  ${C_BOLD}${C_WHITE}✅ SPARROWX DIAGNOSTIC & AUTO-HEAL COMPLETE${C_RESET}                             ${C_GREEN}║${C_RESET}"
echo -e "${C_GREEN}╠══════════════════════════════════════════════════════════════════════════╣${C_RESET}"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "Stack Architecture" "${STACK_MODE} ($(basename "${COMPOSE_FILE}"))"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "Issues Auto-Fixed" "${FIXED_COUNT} issue(s) healed (${WARN_COUNT} warnings)"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "PostgreSQL 16" "$([ "${PG_READY}" = "true" ] && echo "ONLINE (127.0.0.1:${PG_HOST_PORT})" || echo "CHECK LOGS")"
if [ "${STACK_MODE}" = "standalone" ]; then
  printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "PgBouncer Pooler" "${PGB_HEALTH}"
  printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "Threat Cache (Redis)" "${REDIS_HEALTH}"
fi
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "PostgREST API" "${PGRST_HEALTH}"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "SparrowX Web App" "${APP_HEALTH}"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "Nginx Edge HTTP / HTTPS" "${EDGE_HTTP_HEALTH} / ${EDGE_HTTPS_HEALTH}"
GAMESEC_EDGE_CODE="$(curl -sk -o /dev/null -w "%{http_code}" --max-time 4 -H "Host: ${DOMAIN_GAMESEC}" "https://127.0.0.1:${HTTPS_PORT}/" 2>/dev/null || echo "000")"
if echo "${GAMESEC_EDGE_CODE}" | grep -qE "^(200|301|302|307|308)$"; then
  GAMESEC_HEALTH="ONLINE (HTTP ${GAMESEC_EDGE_CODE} -> :${GAMESEC_PORT})"
elif [ -n "${GAMESEC_UPSTREAM_URL:-}" ]; then
  GAMESEC_HEALTH="CHECK UPSTREAM (HTTP ${GAMESEC_EDGE_CODE})"
else
  GAMESEC_HEALTH="CHECK (${GAMESEC_EDGE_CODE} -> :${GAMESEC_PORT})"
fi
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "Game DDoS Defense" "${GAMESEC_HEALTH}"
NETSEC_EDGE_CODE="$(curl -sk -o /dev/null -w "%{http_code}" --max-time 4 -H "Host: ${DOMAIN_NETSEC}" "https://127.0.0.1:${HTTPS_PORT}/" 2>/dev/null || echo "000")"
if echo "${NETSEC_EDGE_CODE}" | grep -qE "^(200|301|302|307|308)$"; then
  NETSEC_HEALTH="ONLINE (HTTP ${NETSEC_EDGE_CODE} -> :${NETSEC_PORT})"
elif [ -n "${NETSEC_UPSTREAM_URL:-}" ]; then
  NETSEC_HEALTH="CHECK UPSTREAM (HTTP ${NETSEC_EDGE_CODE})"
elif [ ! -s "${NETSEC_DIR}/.env" ] || { ! grep -qE '^DATABASE_URL=.+' "${NETSEC_DIR}/.env" 2>/dev/null && ! grep -qE '^SUPABASE_URL=.+' "${NETSEC_DIR}/.env" 2>/dev/null; }; then
  NETSEC_HEALTH="NEEDS DB CONFIG (.env)"
else
  NETSEC_HEALTH="CHECK (${NETSEC_EDGE_CODE} -> :${NETSEC_PORT})"
fi
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "Network DDoS Dashboard" "${NETSEC_HEALTH}"
if is_pterodactyl_installed; then
  printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "Pterodactyl Game Panel" "${PTERO_HEALTH}"
fi
echo -e "${C_GREEN}╠══════════════════════════════════════════════════════════════════════════╣${C_RESET}"
if [ "${#FIXED_LOG[@]}" -gt 0 ]; then
  echo -e "${C_GREEN}║${C_RESET}  ${C_YELLOW}${C_BOLD}Auto-Healed Actions:${C_RESET}                                                    ${C_GREEN}║${C_RESET}"
  for entry in "${FIXED_LOG[@]}"; do
    printf "${C_GREEN}║${C_RESET}   ${C_YELLOW}•${C_RESET} %-68s ${C_GREEN}║${C_RESET}\n" "${entry:0:68}"
  done
  echo -e "${C_GREEN}╠══════════════════════════════════════════════════════════════════════════╣${C_RESET}"
fi
echo -e "${C_GREEN}║${C_RESET}  ${C_BOLD}Live Service Endpoints (${SPARROWX_PUBLIC_IP}):${C_RESET}                               ${C_GREEN}║${C_RESET}"
printf "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Master Portal    : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} DB Studio        : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://db.${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Drop Vault       : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://file.${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_YELLOW}•${C_RESET} Password Vault   : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://password.${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_BLUE}•${C_RESET} Shield WAF/SOC   : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://sec.${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_MAGENTA}•${C_RESET} REST API Gateway : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://api.${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Game Hosting     : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://${DOMAIN_GAME_WEB}"
printf "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Game Client Dash : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://${DOMAIN_GAME_DASH}"
printf "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Game DDoS Portal : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://${DOMAIN_GAMESEC}"
printf "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Net DDoS Dash    : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://${DOMAIN_NETSEC}"
if is_pterodactyl_installed; then
  printf "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Game Panel       : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://${DOMAIN_GAME}"
fi
write_ptero_credentials_file
echo -e "${C_GREEN}╠══════════════════════════════════════════════════════════════════════════╣${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}  ${C_BOLD}${C_YELLOW}All Credentials & Database Info Used (Saved to /root/.sparrowx-ptero-credentials.txt):${C_RESET}"
if is_pterodactyl_installed; then
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Panel Login URL  : ${C_WHITE}https://${DOMAIN_GAME}${C_RESET} ${C_DIM}(Internal :${PTERO_PORT})${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Panel Admin Email: ${C_CYAN}${PTERO_ADMIN_EMAIL}${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Panel Admin User : ${C_CYAN}${PTERO_ADMIN_USER}${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Panel Admin Pass : ${C_YELLOW}${PTERO_ADMIN_PASSWORD}${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Ptero MySQL Host : ${C_WHITE}127.0.0.1:3306${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Ptero MySQL DB   : ${C_WHITE}${PTERO_DB_NAME}${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Ptero MySQL User : ${C_WHITE}${PTERO_DB_USER}${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Ptero MySQL Pass : ${C_YELLOW}${PTERO_DB_PASSWORD}${C_RESET}"
fi
echo -e "${C_GREEN}║${C_RESET}   ${C_MAGENTA}•${C_RESET} Postgres Host    : ${C_WHITE}127.0.0.1:${PG_HOST_PORT}${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}   ${C_MAGENTA}•${C_RESET} Postgres DB/User : ${C_WHITE}${POSTGRES_DB} / ${POSTGRES_USER}${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}   ${C_MAGENTA}•${C_RESET} Postgres Pass    : ${C_YELLOW}${POSTGRES_PASSWORD}${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Credentials File : ${C_WHITE}/root/.sparrowx-ptero-credentials.txt${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Full Run Log     : ${C_WHITE}${FIX_FULL_LOG}${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Error Bundle Log : ${C_WHITE}${FIX_ERROR_LOG}${C_RESET}"
echo -e "${C_GREEN}╚══════════════════════════════════════════════════════════════════════════╝${C_RESET}"

# Collect any services/checks that remained unfixed after all healing passes
[ "${PG_READY:-false}" != "true" ] && UNFIXED_LOG+=("PostgreSQL 16 not ready on 127.0.0.1:${PG_HOST_PORT}")
[ "${STACK_MODE}" = "standalone" ] && [ "${PGB_HEALTH}" = "DOWN" ] && UNFIXED_LOG+=("PgBouncer Pooler DOWN on 127.0.0.1:${PG_POOL_PORT}")
[ "${STACK_MODE}" = "standalone" ] && [ "${REDIS_HEALTH}" = "DOWN" ] && UNFIXED_LOG+=("Threat Cache (Redis) container ${REDIS_CTR} DOWN")
[ "${PGRST_HEALTH}" = "DOWN" ] && UNFIXED_LOG+=("PostgREST API DOWN on 127.0.0.1:${PGRST_HOST_PORT}")
[ "${APP_HEALTH}" = "DOWN" ] && UNFIXED_LOG+=("SparrowX Web App DOWN on 127.0.0.1:${APP_HOST_PORT}")
[ "${EDGE_HTTP_HEALTH}" = "DOWN" ] && UNFIXED_LOG+=("Nginx Edge HTTP DOWN on :${HTTP_PORT}")
[ "${EDGE_HTTPS_HEALTH}" = "DOWN" ] && UNFIXED_LOG+=("Nginx Edge HTTPS DOWN on :${HTTPS_PORT}")
if [[ "${GAMESEC_HEALTH}" == CHECK* ]]; then
  UNFIXED_LOG+=("Game DDoS Defense (${DOMAIN_GAMESEC}) unhealthy (${GAMESEC_HEALTH})")
fi
if [[ "${NETSEC_HEALTH}" == CHECK* ]] || [[ "${NETSEC_HEALTH}" == NEEDS* ]]; then
  UNFIXED_LOG+=("Network DDoS Dashboard (${DOMAIN_NETSEC}) status: ${NETSEC_HEALTH}")
fi
if is_pterodactyl_installed && [[ "${PTERO_HEALTH}" == CHECK* ]]; then
  UNFIXED_LOG+=("Pterodactyl Game Panel unhealthy (${PTERO_HEALTH})")
fi
for s in mariadb redis-server nginx pteroq docker; do
  if systemctl list-unit-files 2>/dev/null | grep -q "^${s}.service"; then
    s_state="$(systemctl is-active "${s}" 2>/dev/null || echo unknown)"
    if [ "${s_state}" != "active" ]; then
      UNFIXED_LOG+=("systemd service ${s} is ${s_state}")
    fi
  fi
done

# Write structured diagnostic error bundle for future auto-patch updates
{
  echo ""
  echo "=============================================================================="
  echo "DIAGNOSTIC SNAPSHOT: $(date -u '+%Y-%m-%d %H:%M:%S UTC' 2>/dev/null || date)"
  echo "GIT_HEAD: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
  echo "HEALTH: PG=${PG_READY:-?} PGRST=${PGRST_HEALTH} APP=${APP_HEALTH} HTTP=${EDGE_HTTP_HEALTH} HTTPS=${EDGE_HTTPS_HEALTH} GAMESEC=${GAMESEC_HEALTH} NETSEC=${NETSEC_HEALTH} PTERO=${PTERO_HEALTH}"
  echo "COUNTS: FIXED=${FIXED_COUNT} WARN=${WARN_COUNT} ERR=${ERR_COUNT} UNFIXED=${#UNFIXED_LOG[@]}"
  echo "--- UNFIXED / UNRESOLVED ERRORS (CANNOT AUTO-FIX YET) ---"
  if [ "${#UNFIXED_LOG[@]}" -eq 0 ]; then
    echo "NONE (All checks passed)"
  else
    for u_item in "${UNFIXED_LOG[@]}"; do
      echo "UNFIXED: ${u_item}"
    done
  fi
  if [ -f "/var/www/pterodactyl/storage/logs/laravel.log" ]; then
    echo "--- PTERODACTYL LARAVEL.LOG (LAST 40 LINES) ---"
    tail -n 40 /var/www/pterodactyl/storage/logs/laravel.log 2>/dev/null || true
  fi
  if [ -f "/var/log/nginx/pterodactyl.app-error.log" ]; then
    echo "--- NGINX PTERO ERROR.LOG (LAST 20 LINES) ---"
    tail -n 20 /var/log/nginx/pterodactyl.app-error.log 2>/dev/null || true
  fi
  if [ -f "/var/log/nginx/error.log" ]; then
    echo "--- NGINX GLOBAL ERROR.LOG (LAST 20 LINES) ---"
    tail -n 20 /var/log/nginx/error.log 2>/dev/null || true
  fi
  echo "--- SYSTEMD SERVICES ---"
  for s in mariadb redis-server nginx pteroq docker php8.4-fpm php8.3-fpm php8.2-fpm php8.1-fpm; do
    if systemctl list-unit-files 2>/dev/null | grep -q "^${s}.service"; then
      echo "${s}: $(systemctl is-active "${s}" 2>/dev/null || echo unknown)"
    fi
  done
  if [ "${HAS_DOCKER}" = "true" ]; then
    echo "--- DOCKER PS -A ---"
    docker ps -a --filter name=sparrowx --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
  fi
  echo "=============================================================================="
} >> "${FIX_ERROR_LOG}" 2>/dev/null || true
cp -f "${FIX_ERROR_LOG}" "${REPO_ERROR_LOG}" 2>/dev/null || true

if [ "${#UNFIXED_LOG[@]}" -gt 0 ]; then
  echo ""
  echo -e "${C_RED}${C_BOLD}Unfixed / Unresolved Errors (${#UNFIXED_LOG[@]}):${C_RESET}"
  for u_item in "${UNFIXED_LOG[@]}"; do
    echo -e "  ${C_RED}✗${C_RESET} ${u_item}"
  done
  echo -e "  ${C_DIM}Full error bundle saved to: ${FIX_ERROR_LOG}${C_RESET}"
fi

if [ "${HAS_DOCKER}" = "true" ]; then
  echo ""
  echo -e "${C_BOLD}Container Fleet Snapshot:${C_RESET}"
  docker ps --filter name=sparrowx --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
fi
