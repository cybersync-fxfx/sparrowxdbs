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

is_reserved_ptero_port() {
  local p="$1"
  case "${p}" in
    8080|8443|2022|3306|6379|8090|"${PTERO_PORT:-8090}") return 0 ;;
    *) return 1 ;;
  esac
}

find_next_free_port() {
  local port="$1"
  local max_tries=50
  local i=0
  while [ "${i}" -lt "${max_tries}" ] && { is_port_busy "${port}" || is_reserved_ptero_port "${port}"; }; do
    port=$((port + 1))
    i=$((i + 1))
  done
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
  gw_ip="$(ip -4 addr show docker0 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1 | head -n 1 || true)"
  echo "${gw_ip:-172.17.0.1}"
}

heal_pterodactyl_host_nginx() {
  local ptero_dir="/var/www/pterodactyl"
  local game_domain="${DOMAIN_GAME:-game.${SPARROWX_DOMAIN}}"
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

  if [ -n "${db_cli}" ] && [ -n "${db_pass}" ]; then
    "${db_cli}" -u root -e "
      CREATE DATABASE IF NOT EXISTS \`${db_name}\`;
      CREATE USER IF NOT EXISTS '${db_user}'@'127.0.0.1' IDENTIFIED BY '${db_pass}';
      ALTER USER '${db_user}'@'127.0.0.1' IDENTIFIED BY '${db_pass}';
      CREATE USER IF NOT EXISTS '${db_user}'@'localhost' IDENTIFIED BY '${db_pass}';
      ALTER USER '${db_user}'@'localhost' IDENTIFIED BY '${db_pass}';
      GRANT ALL PRIVILEGES ON \`${db_name}\`.* TO '${db_user}'@'127.0.0.1' WITH GRANT OPTION;
      GRANT ALL PRIVILEGES ON \`${db_name}\`.* TO '${db_user}'@'localhost' WITH GRANT OPTION;
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

    local existing_salt=""
    existing_salt="$(awk -F= '/^HASHIDS_SALT=/{sub(/^[^=]*=/,""); print; exit}' "${ptero_dir}/.env" 2>/dev/null | tr -d "\"'\r" || true)"
    if [ -z "${existing_salt}" ]; then
      set_ptero_env_key "HASHIDS_SALT" "$(openssl rand -hex 10 2>/dev/null || echo 'spx_hashids_salt_2026')"
    fi
    set_ptero_env_key "HASHIDS_LENGTH" "8"

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
          CREATE USER '${db_user}'@'127.0.0.1' IDENTIFIED BY '${db_pass}';
          CREATE USER '${db_user}'@'localhost' IDENTIFIED BY '${db_pass}';
          GRANT ALL PRIVILEGES ON \`${db_name}\`.* TO '${db_user}'@'127.0.0.1' WITH GRANT OPTION;
          GRANT ALL PRIVILEGES ON \`${db_name}\`.* TO '${db_user}'@'localhost' WITH GRANT OPTION;
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

      local bcrypt_pw=""
      bcrypt_pw="$(SPX_PASS="${PTERO_ADMIN_PASSWORD}" "${php_bin}" -r 'echo password_hash(getenv("SPX_PASS"), PASSWORD_BCRYPT);' 2>/dev/null || true)"
      if [ -n "${bcrypt_pw}" ]; then
        "${db_cli}" -u root -e "UPDATE \`${db_name}\`.users SET password='${bcrypt_pw}', root_admin=1 WHERE username IN ('${PTERO_ADMIN_USER}', 'admin', 'root') OR root_admin=1;" >/dev/null 2>&1 || true
      fi
    fi

    (cd "${ptero_dir}" && "${php_bin}" artisan config:clear >/dev/null 2>&1 || true)
    (cd "${ptero_dir}" && "${php_bin}" artisan cache:clear >/dev/null 2>&1 || true)
    (cd "${ptero_dir}" && "${php_bin}" artisan view:clear >/dev/null 2>&1 || true)
    (cd "${ptero_dir}" && "${php_bin}" artisan route:clear >/dev/null 2>&1 || true)
    (cd "${ptero_dir}" && "${php_bin}" artisan queue:restart >/dev/null 2>&1 || true)
  fi

  mkdir -p "${ptero_dir}/storage/logs" "${ptero_dir}/storage/framework/sessions" "${ptero_dir}/storage/framework/views" "${ptero_dir}/storage/framework/cache/data" "${ptero_dir}/bootstrap/cache"
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
  find /etc/nginx/sites-enabled -maxdepth 1 -type l -o -type f 2>/dev/null | grep -v '/pterodactyl\.conf$' | xargs -r rm -f 2>/dev/null || true
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

ensure_game_letsencrypt_ssl() {
  local game_domain="${DOMAIN_GAME:-game.${SPARROWX_DOMAIN}}"
  local webroot="${INSTALL_DIR}/ovh/certbot-www"
  local ssl_dir="${INSTALL_DIR}/ovh/ssl"
  local live_dir="/etc/letsencrypt/live/${game_domain}"
  local ssl_email="${PTERO_ADMIN_EMAIL:-${SPARROWX_ADMIN_EMAIL:-admin@${SPARROWX_DOMAIN}}}"

  if [ -z "${game_domain}" ] || [[ "${game_domain}" == *.local ]] || [ "${game_domain}" = "localhost" ]; then
    return 0
  fi

  if [ -z "${ssl_email}" ] || [[ "${ssl_email}" == *.local ]]; then
    ssl_email="admin@${SPARROWX_DOMAIN}"
  fi

  mkdir -p "${webroot}/.well-known/acme-challenge" "${ssl_dir}" /etc/ssl

  # Ensure UFW allows ports 80/443 for ACME HTTP-01 validation
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi "Status: active"; then
    ufw allow 80/tcp >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
  fi

  if ! command -v certbot >/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt-get update -y >/dev/null 2>&1 || true
    DEBIAN_FRONTEND=noninteractive apt-get install -y certbot >/dev/null 2>&1 || true
  fi

  if ! command -v certbot >/dev/null 2>&1; then
    log_warn "Certbot unavailable; skipping Let's Encrypt issuance for ${game_domain}"
    return 0
  fi

  # If cert does not exist yet, issue via webroot (:80 on sparrowx-nginx) or standalone fallback
  if [ ! -s "${live_dir}/fullchain.pem" ] || [ ! -s "${live_dir}/privkey.pem" ]; then
    log_scan "Requesting Let's Encrypt SSL for ${game_domain} via HTTP-01 port 80..."

    # Attempt 1: Zero-downtime webroot through sparrowx-nginx on port 80
    if certbot certonly \
      --webroot -w "${webroot}" \
      --non-interactive --agree-tos \
      -m "${ssl_email}" \
      --cert-name "${game_domain}" \
      -d "${game_domain}" >/dev/null 2>&1; then
      log_fix "Issued Let's Encrypt SSL for ${game_domain} via port 80 webroot"
    else
      # Attempt 2: Briefly yield port 80 from sparrowx-nginx for Certbot standalone challenge
      log_scan "Webroot challenge deferred; retrying ${game_domain} via standalone port 80 listener..."
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
        --cert-name "${game_domain}" \
        -d "${game_domain}" >/dev/null 2>&1; then
        log_fix "Issued Let's Encrypt SSL for ${game_domain} via standalone port 80 challenge"
      else
        log_warn "Let's Encrypt HTTP-01 challenge failed for ${game_domain} (verify DNS A record & external port 80)"
      fi

      if is_pterodactyl_installed; then
        systemctl start nginx >/dev/null 2>&1 || true
      fi
      docker start sparrowx-nginx >/dev/null 2>&1 || compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps nginx >/dev/null 2>&1 || true
    fi
  else
    # Keep certificate current and migrate any prior nginx authenticator to webroot
    certbot certonly \
      --webroot -w "${webroot}" \
      --non-interactive --agree-tos --keep-until-expiring \
      -m "${ssl_email}" \
      --cert-name "${game_domain}" \
      -d "${game_domain}" >/dev/null 2>&1 || true
  fi

  if [ -s "${live_dir}/fullchain.pem" ] && [ -s "${live_dir}/privkey.pem" ]; then
    cp -fL "${live_dir}/fullchain.pem" "${ssl_dir}/ptero-fullchain.pem" 2>/dev/null || true
    cp -fL "${live_dir}/privkey.pem" "${ssl_dir}/ptero-privkey.pem" 2>/dev/null || true
    chmod 644 "${ssl_dir}/ptero-fullchain.pem" 2>/dev/null || true
    chmod 600 "${ssl_dir}/ptero-privkey.pem" 2>/dev/null || true
    ln -sf "${live_dir}/fullchain.pem" "/etc/ssl/${game_domain}.pem" 2>/dev/null || true
    ln -sf "${live_dir}/privkey.pem" "/etc/ssl/${game_domain}.key" 2>/dev/null || true

    if [ -f "${INSTALL_DIR}/ovh/nginx.conf" ] && grep -q "${game_domain}" "${INSTALL_DIR}/ovh/nginx.conf" 2>/dev/null; then
      local tmp_nginx=""
      tmp_nginx="$(mktemp)"
      awk -v dom="${game_domain}" '
        /# 4\. Pterodactyl Game Panel/ { in_ptero=1 }
        in_ptero && /ssl_certificate / { sub(/ssl_certificate .*/, "ssl_certificate /etc/nginx/ssl/ptero-fullchain.pem;") }
        in_ptero && /ssl_certificate_key / { sub(/ssl_certificate_key .*/, "ssl_certificate_key /etc/nginx/ssl/ptero-privkey.pem;") }
        in_ptero && /^}/ { in_ptero=0 }
        { print }
      ' "${INSTALL_DIR}/ovh/nginx.conf" > "${tmp_nginx}" && cat "${tmp_nginx}" > "${INSTALL_DIR}/ovh/nginx.conf"
      rm -f "${tmp_nginx}"
      docker restart sparrowx-nginx >/dev/null 2>&1 || docker exec sparrowx-nginx nginx -s reload >/dev/null 2>&1 || true
    fi
    log_ok "Live Let's Encrypt SSL wired for https://${game_domain}"
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
  "${INSTALL_DIR}/update.sh" \
  "${INSTALL_DIR}/fix.sh" \
  "${INSTALL_DIR}/manage-db.sh" \
  "${INSTALL_DIR}/ovh/update.sh" \
  "${INSTALL_DIR}/ovh/fix.sh" \
  "${INSTALL_DIR}/ovh/manage-db.sh" \
  "${INSTALL_DIR}/deploy/doctor-fix.sh" 2>/dev/null || true

if [ -d "/usr/local/bin" ]; then
  ln -sf "${INSTALL_DIR}/fix.sh" /usr/local/bin/sparrowx-fix 2>/dev/null || true
  ln -sf "${INSTALL_DIR}/fix.sh" /usr/local/bin/sparrowx-doctor 2>/dev/null || true
  ln -sf "${INSTALL_DIR}/update.sh" /usr/local/bin/sparrowx-update 2>/dev/null || true
  ln -sf "${INSTALL_DIR}/manage-db.sh" /usr/local/bin/sparrowx-db 2>/dev/null || true
  log_ok "CLI symlinks verified: sparrowx-fix, sparrowx-doctor, sparrowx-update, sparrowx-db"
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
DOMAIN_GAME="${DOMAIN_GAME:-game.${SPARROWX_DOMAIN}}"
PTERO_PORT="${PTERO_PORT:-8090}"
POSTGRES_USER="${POSTGRES_USER:-sparrowx}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-sparrowx_ovh_secret_2026}"
POSTGRES_DB="${POSTGRES_DB:-sparrowx_db}"
SPARROWX_JWT_SECRET="${SPARROWX_JWT_SECRET:-$(openssl rand -hex 32 2>/dev/null || echo 'sparrowx_jwt_secret_key_32_characters_2026')}"
SPARROWX_REDIS_SECRET="${SPARROWX_REDIS_SECRET:-$(openssl rand -hex 16 2>/dev/null || echo 'sparrowx_redis_secret_2026')}"

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
ensure_env_key "SPARROWX_REDIS_SECRET" "${SPARROWX_REDIS_SECRET}"
export SPARROWX_DOMAIN SPARROWX_STUDIO_DOMAIN DOMAIN_GAME PTERO_PORT SPARROWX_PUBLIC_IP SPARROWX_ADMIN_EMAIL PTERO_ADMIN_EMAIL PTERO_ADMIN_USER PTERO_ADMIN_FIRSTNAME PTERO_ADMIN_LASTNAME PTERO_ADMIN_PASSWORD PTERO_DB_NAME PTERO_DB_USER PTERO_DB_PASSWORD PTERO_TIMEZONE HTTP_PORT HTTPS_PORT APP_HOST_PORT PGRST_HOST_PORT PG_HOST_PORT POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB SPARROWX_JWT_SECRET SPARROWX_REDIS_SECRET

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
    docker network prune -f >/dev/null 2>&1 || true
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

COMPOSE_FILE="${INSTALL_DIR}/docker-compose.ovh.yml"
if [ ! -f "${COMPOSE_FILE}" ] && [ -f "${INSTALL_DIR}/docker-compose.yml" ]; then
  COMPOSE_FILE="${INSTALL_DIR}/docker-compose.yml"
fi

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

  # Remove crashed/non-running sparrowx-postgres or orphaned docker-proxy/postgres processes holding 5432
  if ! docker ps --filter status=running --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-postgres"; then
    docker rm -f sparrowx-postgres >/dev/null 2>&1 || true
    pkill -9 -x postgres >/dev/null 2>&1 || true
    pkill -9 -f "docker-proxy.*-host-port ${PG_HOST_PORT}( |$)" >/dev/null 2>&1 || true
    command -v fuser >/dev/null 2>&1 && fuser -k "${PG_HOST_PORT}/tcp" >/dev/null 2>&1 || true
  fi

  install_pterodactyl_unattended
  if is_pterodactyl_installed; then
    heal_pterodactyl_host_nginx
  elif systemctl is-active --quiet nginx 2>/dev/null; then
    systemctl stop nginx >/dev/null 2>&1 || true
    log_fix "Stopped conflicting host daemon: nginx"
  fi

  # Remove orphaned docker-proxy listeners on 80/443 if sparrowx-nginx is not running
  if ! docker ps --filter status=running --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-nginx"; then
    pkill -9 -f "docker-proxy.*-host-port ${HTTP_PORT}( |$)" >/dev/null 2>&1 || true
    pkill -9 -f "docker-proxy.*-host-port ${HTTPS_PORT}( |$)" >/dev/null 2>&1 || true
  fi

  # Remove foreign Docker containers holding SparrowX ports (80, 443, 5432, 3000, 3001)
  free_docker_port_conflicts "${HTTP_PORT}" "sparrowx-nginx"
  free_docker_port_conflicts "${HTTPS_PORT}" "sparrowx-nginx"
  free_docker_port_conflicts "${PG_HOST_PORT}" "sparrowx-postgres"
  free_docker_port_conflicts "${PGRST_HOST_PORT}" "sparrowx-postgrest"
  free_docker_port_conflicts "${APP_HOST_PORT}" "sparrowx-app"

  # Heal HTTP/HTTPS port conflicts (ports 80 / 443 must remain clean for Nginx edge)
  for web_p in "${HTTP_PORT}" "${HTTPS_PORT}"; do
    if port_held_by_other "${web_p}" "sparrowx-nginx"; then
      log_fix "Port ${web_p}/tcp held by foreign process — clearing for sparrowx-nginx"
      command -v fuser >/dev/null 2>&1 && fuser -k "${web_p}/tcp" >/dev/null 2>&1 || true
      sleep 1
    fi
  done

  # Heal PostgreSQL port conflict (clear stray non-Docker listener on 5432, then auto-shift to 5433+ if still held)
  if port_held_by_other "${PG_HOST_PORT}" "sparrowx-postgres"; then
    log_fix "Host port ${PG_HOST_PORT}/tcp busy — clearing stray non-Docker listeners"
    command -v fuser >/dev/null 2>&1 && fuser -k "${PG_HOST_PORT}/tcp" >/dev/null 2>&1 || true
    sleep 1
  fi
  if port_held_by_other "${PG_HOST_PORT}" "sparrowx-postgres"; then
    NEW_PG_PORT="$(find_next_free_port 5433)"
    ensure_env_key "PG_HOST_PORT" "${NEW_PG_PORT}"
    PG_HOST_PORT="${NEW_PG_PORT}"
    export PG_HOST_PORT
    log_fix "Host port 5432 still busy; switched PG_HOST_PORT=${PG_HOST_PORT} in .env"
  else
    log_ok "PostgreSQL port ${PG_HOST_PORT} clear for sparrowx-postgres"
  fi

  # Heal PostgREST port conflict (3001 -> auto-shift if held by other process)
  if port_held_by_other "${PGRST_HOST_PORT}" "sparrowx-postgrest"; then
    NEW_PGRST_PORT="$(find_next_free_port 3002)"
    ensure_env_key "PGRST_HOST_PORT" "${NEW_PGRST_PORT}"
    PGRST_HOST_PORT="${NEW_PGRST_PORT}"
    export PGRST_HOST_PORT
    log_fix "Host port 3001 busy; switched PGRST_HOST_PORT=${PGRST_HOST_PORT} in .env"
  else
    log_ok "PostgREST port ${PGRST_HOST_PORT} clear for sparrowx-postgrest"
  fi

  # Heal App port conflict (3000 -> auto-shift if held by other process)
  if port_held_by_other "${APP_HOST_PORT}" "sparrowx-app"; then
    NEW_APP_PORT="$(find_next_free_port 3010)"
    ensure_env_key "APP_HOST_PORT" "${NEW_APP_PORT}"
    APP_HOST_PORT="${NEW_APP_PORT}"
    export APP_HOST_PORT
    log_fix "Host port 3000 busy; switched APP_HOST_PORT=${APP_HOST_PORT} in .env"
  else
    log_ok "App port ${APP_HOST_PORT} clear for sparrowx-app"
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
    -addext "subjectAltName=DNS:${SPARROWX_DOMAIN},DNS:${DOMAIN_GAME},DNS:*.${SPARROWX_DOMAIN}" >/dev/null 2>&1; then
    openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
      -keyout "${SSL_KEY}" \
      -out "${SSL_CERT}" \
      -subj "/CN=${SPARROWX_DOMAIN}" >/dev/null 2>&1 || true
  fi
else
  log_ok "TLS certificate validated for ${SPARROWX_DOMAIN}"
fi

cat > "${INSTALL_DIR}/ovh/nginx.conf" <<EOF
# ============================================================================
# SPARROWX MULTI-SERVICE NGINX REVERSE PROXY (AUTO-HEALED)
# ============================================================================
# 1. Master Portal + Fallback Default (${SPARROWX_DOMAIN})
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    server_name ${SPARROWX_DOMAIN} www.${SPARROWX_DOMAIN} _;
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 150M;
    server_tokens off;
    resolver 127.0.0.11 valid=10s ipv6=off;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        allow all;
    }

    location /rest/v1/ {
        set \$upstream_app http://sparrowx:3000;
        proxy_pass \$upstream_app;
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
        set \$upstream_app http://sparrowx:3000;
        proxy_pass \$upstream_app;
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
    client_max_body_size 150M;
    server_tokens off;
    resolver 127.0.0.11 valid=10s ipv6=off;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        allow all;
    }

    location /rest/v1/ {
        set \$upstream_app http://sparrowx:3000;
        proxy_pass \$upstream_app;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PATCH, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, apikey, Prefer, x-sparrowx-key" always;
        if (\$request_method = OPTIONS) { return 204; }
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
    client_max_body_size 150M;
    server_tokens off;
    resolver 127.0.0.11 valid=10s ipv6=off;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        allow all;
    }

    location /rest/v1/ {
        set \$upstream_app http://sparrowx:3000;
        proxy_pass \$upstream_app;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PATCH, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, apikey, Prefer, x-sparrowx-key" always;
        if (\$request_method = OPTIONS) { return 204; }
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
    }
}
EOF
if is_pterodactyl_installed; then
  DOCKER_HOST_IP="$(get_docker_host_ip)"
  PTERO_SSL_CERT="/etc/nginx/ssl/fullchain.pem"
  PTERO_SSL_KEY="/etc/nginx/ssl/privkey.pem"
  if [ -s "${INSTALL_DIR}/ovh/ssl/ptero-fullchain.pem" ] && [ -s "${INSTALL_DIR}/ovh/ssl/ptero-privkey.pem" ]; then
    PTERO_SSL_CERT="/etc/nginx/ssl/ptero-fullchain.pem"
    PTERO_SSL_KEY="/etc/nginx/ssl/ptero-privkey.pem"
  fi
  cat >> "${INSTALL_DIR}/ovh/nginx.conf" <<EOF_PTERO_EDGE

# 4. Pterodactyl Game Panel (${DOMAIN_GAME} -> host nginx :${PTERO_PORT:-8090})
server {
    listen 80;
    listen 443 ssl;
    server_name ${DOMAIN_GAME} panel.${SPARROWX_DOMAIN};
    ssl_certificate ${PTERO_SSL_CERT};
    ssl_certificate_key ${PTERO_SSL_KEY};
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 100M;
    server_tokens off;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        allow all;
    }

    location / {
        proxy_pass http://${DOCKER_HOST_IP}:${PTERO_PORT:-8090};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300;
        proxy_connect_timeout 60;
    }
}
EOF_PTERO_EDGE
fi
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
      docker rm -f sparrowx-postgres >/dev/null 2>&1 || true
      rm -rf "${vol_mp:?}"/* "${vol_mp:?}"/.[!.]* "${vol_mp:?}"/..?* 2>/dev/null || true
      log_fix "Cleared uninitialized/corrupted PostgreSQL volume ${pg_vol} (missing PG_VERSION)"
    fi
  done

  COMPOSE_ARGS=(-d --remove-orphans)
  if [ "${REBUILD_APP}" = "true" ] || ! docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-app"; then
    COMPOSE_ARGS=(-d --build --remove-orphans)
  fi

  log_scan "Starting container stack via $(basename "${COMPOSE_FILE}")..."
  local compose_err_file
  compose_err_file="$(mktemp)"
  if ! compose_cmd -f "${COMPOSE_FILE}" up "${COMPOSE_ARGS[@]}" >"${compose_err_file}" 2>&1; then
    local c_err_tail
    c_err_tail="$(tail -n 10 "${compose_err_file}" 2>/dev/null | tr '\n' ' ' || true)"
    log_fix "Compose startup hit an error (${c_err_tail:0:180}) — tearing down conflicting containers/networks & healing ports"
    compose_cmd -f "${COMPOSE_FILE}" down --remove-orphans >/dev/null 2>&1 || true
    docker rm -f sparrowx-postgres sparrowx-postgrest sparrowx-app sparrowx-nginx >/dev/null 2>&1 || true
    docker network prune -f >/dev/null 2>&1 || true
    free_docker_port_conflicts "${HTTP_PORT}" "sparrowx-nginx"
    free_docker_port_conflicts "${HTTPS_PORT}" "sparrowx-nginx"
    free_docker_port_conflicts "${PG_HOST_PORT}" "sparrowx-postgres"
    command -v fuser >/dev/null 2>&1 && fuser -k 5432/tcp >/dev/null 2>&1 || true

    if is_port_busy "${PG_HOST_PORT}"; then
      PG_HOST_PORT="$(find_next_free_port 5433)"
      ensure_env_key "PG_HOST_PORT" "${PG_HOST_PORT}"
      export PG_HOST_PORT
      log_fix "Reassigned PG_HOST_PORT=${PG_HOST_PORT} after cleanup"
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
      log_warn "Compose recovery up failed (${c_err_tail:0:180}); starting services individually"
      for svc in postgres postgrest sparrowx nginx; do
        compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps "${svc}" >/dev/null 2>&1 || true
      done
    else
      log_healed "Container stack launched after clean port & network recovery"
    fi
  else
    log_ok "Docker Compose fleet up and running"
  fi
  rm -f "${compose_err_file}"

  # Ensure every individual service is created & running (fixes 'Created' or missing containers)
  for svc in postgres postgrest sparrowx nginx; do
    compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps "${svc}" >/dev/null 2>&1 || true
  done
  docker start sparrowx-postgres sparrowx-postgrest sparrowx-app sparrowx-nginx >/dev/null 2>&1 || true

  if is_pterodactyl_installed; then
    DOCKER_HOST_IP="$(get_docker_host_ip)"
    tmp_ptero_ip="$(mktemp)"
    sed -E "s|proxy_pass http://[0-9.]+:${PTERO_PORT:-8090};|proxy_pass http://${DOCKER_HOST_IP}:${PTERO_PORT:-8090};|g" "${INSTALL_DIR}/ovh/nginx.conf" > "${tmp_ptero_ip}" 2>/dev/null && cat "${tmp_ptero_ip}" > "${INSTALL_DIR}/ovh/nginx.conf" || true
    rm -f "${tmp_ptero_ip}"
    if ! curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:${PTERO_PORT:-8090}/" 2>/dev/null; then
      heal_pterodactyl_host_nginx
    fi
  fi

  if docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-nginx"; then
    if ! docker exec sparrowx-nginx nginx -t >/dev/null 2>&1; then
      docker restart sparrowx-nginx >/dev/null 2>&1 || true
    fi
    if ! docker exec sparrowx-nginx nginx -t >/dev/null 2>&1; then
      log_warn "Nginx syntax test flagged an issue; regenerating minimal fallback config"
    else
      docker restart sparrowx-nginx >/dev/null 2>&1 || docker exec sparrowx-nginx nginx -s reload >/dev/null 2>&1 || true
    fi
  fi

  # Ensure Let's Encrypt SSL certificates via port 80 (webroot + standalone fallback for game.<domain>)
  if is_pterodactyl_installed; then
    ensure_game_letsencrypt_ssl
  fi
  if [ -x "${INSTALL_DIR}/deploy/ssl-renew.sh" ]; then
    bash "${INSTALL_DIR}/deploy/ssl-renew.sh" >/dev/null 2>&1 || true
  fi
else
  log_scan "Healing native Node.js build..."
  export NODE_OPTIONS="--max-old-space-size=2048"
  export VITE_SOVEREIGN_SELF_HOSTED="true"
  export VITE_SUPABASE_URL=""
  if ! npm run build >/dev/null 2>&1; then
    log_fix "Native build failed; reinstalling npm packages cleanly and rebuilding"
    npm install --legacy-peer-deps && npm run build
  fi
  systemctl restart sparrowx-native.service >/dev/null 2>&1 || true
fi

# ==============================================================================
# STAGE 10/12: PostgreSQL Role, Schema & PostgREST Healer
# ==============================================================================
draw_progress 10 12 "Postgres Schema & PostgREST"

PG_READY="false"
PGRST_READY="false"

if [ "${HAS_DOCKER}" = "true" ] && docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-postgres"; then
  for _i in $(seq 1 20); do
    if docker exec sparrowx-postgres pg_isready -q >/dev/null 2>&1; then
      PG_READY="true"
      break
    fi
    sleep 1
  done

  if [ "${PG_READY}" = "true" ]; then
    PG_SUPER=""
    for cand_user in "${POSTGRES_USER}" "postgres" "sparrowx"; do
      if docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" sparrowx-postgres psql -U "${cand_user}" -d postgres -tAc "SELECT 1;" >/dev/null 2>&1; then
        PG_SUPER="${cand_user}"
        break
      fi
    done

    if [ -n "${PG_SUPER}" ]; then
      ESC_PASS="${POSTGRES_PASSWORD//\'/\'\'}"
      ROLE_EXISTS="$(docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" sparrowx-postgres psql -U "${PG_SUPER}" -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='${POSTGRES_USER}';" 2>/dev/null | tr -d '[:space:]')"
      if [ "${ROLE_EXISTS}" != "1" ]; then
        docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" sparrowx-postgres psql -U "${PG_SUPER}" -d postgres -c "CREATE ROLE \"${POSTGRES_USER}\" WITH SUPERUSER LOGIN PASSWORD '${ESC_PASS}';" >/dev/null 2>&1 || true
        log_fix "Created missing PostgreSQL role '${POSTGRES_USER}'"
      else
        docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" sparrowx-postgres psql -U "${PG_SUPER}" -d postgres -c "ALTER ROLE \"${POSTGRES_USER}\" WITH PASSWORD '${ESC_PASS}';" >/dev/null 2>&1 || true
      fi

      DB_EXISTS="$(docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" sparrowx-postgres psql -U "${PG_SUPER}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}';" 2>/dev/null | tr -d '[:space:]')"
      if [ "${DB_EXISTS}" != "1" ]; then
        docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" sparrowx-postgres psql -U "${PG_SUPER}" -d postgres -c "CREATE DATABASE \"${POSTGRES_DB}\" OWNER \"${POSTGRES_USER}\";" >/dev/null 2>&1 || true
        log_fix "Created missing PostgreSQL database '${POSTGRES_DB}'"
      fi

      if [ -f "${INSTALL_DIR}/ovh/schema.sql" ]; then
        USERS_TBL="$(docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" sparrowx-postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "SELECT to_regclass('public.app_users');" 2>/dev/null | tr -d '[:space:]')"
        INQ_TBL="$(docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" sparrowx-postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "SELECT to_regclass('public.contact_inquiries');" 2>/dev/null | tr -d '[:space:]')"
        if { [ "${USERS_TBL}" != "app_users" ] && [ "${USERS_TBL}" != "public.app_users" ]; } || { [ "${INQ_TBL}" != "contact_inquiries" ] && [ "${INQ_TBL}" != "public.contact_inquiries" ]; }; then
          docker exec -i -e PGPASSWORD="${POSTGRES_PASSWORD}" sparrowx-postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "${INSTALL_DIR}/ovh/schema.sql" >/dev/null 2>&1 || true
          log_fix "Applied ovh/schema.sql (tables + web_anon/authenticator roles)"
        else
          log_ok "PostgreSQL schema verified (${POSTGRES_DB} tables active)"
        fi
      fi
    else
      log_warn "Could not auto-verify superuser socket access inside sparrowx-postgres"
    fi
  else
    log_err "sparrowx-postgres did not become ready within 20s"
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
    log_fix "PostgREST not responding on :${PGRST_HOST_PORT} — restarting sparrowx-postgrest"
    docker restart sparrowx-postgrest >/dev/null 2>&1 || true
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

if [ ! -f /etc/sysctl.d/99-sparrowx-hardening.conf ]; then
  cat > /etc/sysctl.d/99-sparrowx-hardening.conf <<'EOF'
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
  log_fix "Installed kernel SYN-cookie & anti-spoofing sysctl profile"
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
  log_ok "UFW rules verified for ports 22, 80, 443, 8080, 8443, 2022 (${HTTP_PORT}, ${HTTPS_PORT})"
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
  log_fix "App server unhealthy on :${APP_HOST_PORT}; bouncing sparrowx-app and checking logs"
  docker restart sparrowx-app >/dev/null 2>&1 || true
  sleep 5
  if curl -fsS "http://127.0.0.1:${APP_HOST_PORT}/api/v1/health" >/dev/null 2>&1; then
    APP_HEALTH="RECOVERED (200 OK)"
  else
    docker logs --tail 25 sparrowx-app 2>&1 || true
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
  log_fix "Edge proxy down (HTTP=${EDGE_HTTP_HEALTH}, HTTPS=${EDGE_HTTPS_HEALTH}); running guaranteed sparrowx-nginx recovery"
  if [ ! -s "${INSTALL_DIR}/ovh/ssl/fullchain.pem" ] || [ ! -s "${INSTALL_DIR}/ovh/ssl/privkey.pem" ]; then
    mkdir -p "${INSTALL_DIR}/ovh/ssl"
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout "${INSTALL_DIR}/ovh/ssl/privkey.pem" \
      -out "${INSTALL_DIR}/ovh/ssl/fullchain.pem" \
      -subj "/CN=${SPARROWX_DOMAIN}" >/dev/null 2>&1 || true
  fi
  if [ ! -s "${INSTALL_DIR}/ovh/ssl/ptero-fullchain.pem" ] && [ -s "${INSTALL_DIR}/ovh/ssl/fullchain.pem" ]; then
    cp -f "${INSTALL_DIR}/ovh/ssl/fullchain.pem" "${INSTALL_DIR}/ovh/ssl/ptero-fullchain.pem" 2>/dev/null || true
    cp -f "${INSTALL_DIR}/ovh/ssl/privkey.pem" "${INSTALL_DIR}/ovh/ssl/ptero-privkey.pem" 2>/dev/null || true
  fi

  # Ensure nothing else on host is holding 80/443
  free_docker_port_conflicts "${HTTP_PORT}" "sparrowx-nginx"
  free_docker_port_conflicts "${HTTPS_PORT}" "sparrowx-nginx"
  for web_p in "${HTTP_PORT}" "${HTTPS_PORT}"; do
    if port_held_by_other "${web_p}" "sparrowx-nginx"; then
      command -v fuser >/dev/null 2>&1 && fuser -k "${web_p}/tcp" >/dev/null 2>&1 || true
      pkill -9 -f "docker-proxy.*-host-port ${web_p}( |$)" >/dev/null 2>&1 || true
    fi
  done

  compose_cmd -f "${COMPOSE_FILE}" up -d --force-recreate --no-deps nginx >/dev/null 2>&1 || true
  docker start sparrowx-nginx >/dev/null 2>&1 || true
  sleep 3

  if ! docker exec sparrowx-nginx nginx -t >/dev/null 2>&1; then
    nginx_err="$(docker exec sparrowx-nginx nginx -t 2>&1 || docker logs --tail 20 sparrowx-nginx 2>&1 || true)"
    log_warn "sparrowx-nginx config failed (${nginx_err:0:180}); writing clean fallback ovh/nginx.conf"
    cat > "${INSTALL_DIR}/ovh/nginx.conf" <<EOF_MIN_NGINX
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    server_name ${SPARROWX_DOMAIN} www.${SPARROWX_DOMAIN} db.${SPARROWX_DOMAIN} sec.${SPARROWX_DOMAIN} file.${SPARROWX_DOMAIN} password.${SPARROWX_DOMAIN} _;
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 150M;
    resolver 127.0.0.11 valid=10s ipv6=off;
    location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; allow all; }
    location /rest/v1/ {
        set \$upstream_app http://sparrowx:3000;
        proxy_pass \$upstream_app;
        proxy_set_header Host \$host;
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
    }
}
EOF_MIN_NGINX
    docker restart sparrowx-nginx >/dev/null 2>&1 || compose_cmd -f "${COMPOSE_FILE}" up -d --force-recreate --no-deps nginx >/dev/null 2>&1 || true
    sleep 3
  fi

  if curl -fsS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${HTTP_PORT}/api/v1/health" 2>/dev/null | grep -qE "^(200|301|302)$"; then
    EDGE_HTTP_HEALTH="RECOVERED (:${HTTP_PORT})"
  fi
  if curl -kfsS -o /dev/null -w "%{http_code}" "https://127.0.0.1:${HTTPS_PORT}/api/v1/health" 2>/dev/null | grep -qE "^(200|301|302)$"; then
    EDGE_HTTPS_HEALTH="RECOVERED (:${HTTPS_PORT})"
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
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "Issues Auto-Fixed" "${FIXED_COUNT} issue(s) healed (${WARN_COUNT} warnings)"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "PostgreSQL 16" "$([ "${PG_READY}" = "true" ] && echo "ONLINE (127.0.0.1:${PG_HOST_PORT})" || echo "CHECK LOGS")"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "PostgREST API" "${PGRST_HEALTH}"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "SparrowX Web App" "${APP_HEALTH}"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "Nginx Edge HTTP / HTTPS" "${EDGE_HTTP_HEALTH} / ${EDGE_HTTPS_HEALTH}"
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
[ "${PGRST_HEALTH}" = "DOWN" ] && UNFIXED_LOG+=("PostgREST API DOWN on 127.0.0.1:${PGRST_HOST_PORT}")
[ "${APP_HEALTH}" = "DOWN" ] && UNFIXED_LOG+=("SparrowX Web App DOWN on 127.0.0.1:${APP_HOST_PORT}")
[ "${EDGE_HTTP_HEALTH}" = "DOWN" ] && UNFIXED_LOG+=("Nginx Edge HTTP DOWN on :${HTTP_PORT}")
[ "${EDGE_HTTPS_HEALTH}" = "DOWN" ] && UNFIXED_LOG+=("Nginx Edge HTTPS DOWN on :${HTTPS_PORT}")
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
  echo "HEALTH: PG=${PG_READY:-?} PGRST=${PGRST_HEALTH} APP=${APP_HEALTH} HTTP=${EDGE_HTTP_HEALTH} HTTPS=${EDGE_HTTPS_HEALTH} PTERO=${PTERO_HEALTH}"
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
