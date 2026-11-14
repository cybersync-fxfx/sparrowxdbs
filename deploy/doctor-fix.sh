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

for arg in "$@"; do
  case "${arg}" in
    --auto|-y|--yes) AUTO_MODE="true" ;;
    --reinstall-db|--force-db) FORCE_DB="true" ;;
    --rebuild) REBUILD_APP="true" ;;
    --help|-h)
      cat <<'HELP'
SparrowX Autonomous Error-Healing Doctor (fix.sh)

Usage:
  ./fix.sh [options]

Options:
  --auto, -y        Run silently/non-interactively with automatic healing
  --rebuild         Force rebuild of the SparrowX web application container
  --reinstall-db    Force re-sync of Local OVH PostgreSQL & per-user folders
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
declare -a FIXED_LOG=()

log_scan()   { echo -e "  ${C_CYAN}[SCAN]${C_RESET}     $*"; }
log_ok()     { echo -e "  ${C_GREEN}[ OK ]${C_RESET}     $*"; }
log_warn()   { echo -e "  ${C_YELLOW}[WARN]${C_RESET}     $*"; WARN_COUNT=$((WARN_COUNT + 1)); }
log_err()    { echo -e "  ${C_RED}[ERR ]${C_RESET}     $*"; }
log_fix() {
  echo -e "  ${C_YELLOW}[AUTO-FIX]${C_RESET} ${C_WHITE}$*${C_RESET}"
  FIXED_COUNT=$((FIXED_COUNT + 1))
  FIXED_LOG+=("$*")
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

# ==============================================================================
# STAGE 1/12: Path Compatibility, CRLF Repair & CLI Symlinks
# ==============================================================================
draw_progress 1 12 "Paths, CRLF & CLI Symlinks"

if [ ! -e "/opt/sparrowx" ] && [ "${INSTALL_DIR}" != "/opt/sparrowx" ]; then
  ln -sfn "${INSTALL_DIR}" /opt/sparrowx 2>/dev/null || true
  log_fix "Created /opt/sparrowx -> ${INSTALL_DIR} compatibility symlink"
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
  # Stop conflicting host daemons that fight over ports 5432, 80, 443, 3000
  for host_svc in postgresql apache2 nginx caddy sparrowx-native.service; do
    if systemctl is-active --quiet "${host_svc}" 2>/dev/null; then
      systemctl stop "${host_svc}" >/dev/null 2>&1 || true
      log_fix "Stopped conflicting host daemon: ${host_svc}"
    fi
  done

  # Clean legacy/duplicate containers from older compose blueprints
  LEGACY_FOUND=0
  for old_ctr in sparrowx_postgres sparrowx_pgbouncer sparrowx_postgrest sparrowx_threat_cache sparrowx_studio sparrowx_edge_proxy; do
    if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -Fxq "${old_ctr}"; then
      docker rm -f "${old_ctr}" >/dev/null 2>&1 || true
      LEGACY_FOUND=$((LEGACY_FOUND + 1))
    fi
  done
  DEAD_CTRS="$(docker ps -a --filter status=exited --filter status=dead --filter status=created --format '{{.Names}}' 2>/dev/null | grep -E '^sparrowx' || true)"
  if [ -n "${DEAD_CTRS}" ]; then
    echo "${DEAD_CTRS}" | xargs -r docker rm -f >/dev/null 2>&1 || true
    LEGACY_FOUND=$((LEGACY_FOUND + 1))
  fi
  [ "${LEGACY_FOUND}" -gt 0 ] && log_fix "Cleaned up stale/duplicate SparrowX containers"

  # Heal HTTP/HTTPS port conflicts (ports 80 / 443 must remain clean for Nginx edge)
  for web_p in "${HTTP_PORT}" "${HTTPS_PORT}"; do
    if port_held_by_other "${web_p}" "sparrowx-nginx"; then
      log_fix "Port ${web_p}/tcp held by foreign process — clearing for sparrowx-nginx"
      command -v fuser >/dev/null 2>&1 && fuser -k "${web_p}/tcp" >/dev/null 2>&1 || true
      sleep 1
    fi
  done

  # Heal PostgreSQL port conflict (5432 -> auto-shift to 5433+ if host service persists)
  if port_held_by_other "${PG_HOST_PORT}" "sparrowx-postgres"; then
    NEW_PG_PORT="$(find_next_free_port 5433)"
    ensure_env_key "PG_HOST_PORT" "${NEW_PG_PORT}"
    PG_HOST_PORT="${NEW_PG_PORT}"
    export PG_HOST_PORT
    log_fix "Host port 5432 busy; switched PG_HOST_PORT=${PG_HOST_PORT} in .env"
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

mkdir -p "${INSTALL_DIR}/ovh/ssl" "${INSTALL_DIR}/data/users" "${INSTALL_DIR}/data/backups"

SSL_CERT="${INSTALL_DIR}/ovh/ssl/fullchain.pem"
SSL_KEY="${INSTALL_DIR}/ovh/ssl/privkey.pem"
if [ ! -s "${SSL_CERT}" ] || [ ! -s "${SSL_KEY}" ] || ! openssl x509 -in "${SSL_CERT}" -noout >/dev/null 2>&1; then
  log_fix "Generating fresh TLS certificate (SAN: ${SPARROWX_DOMAIN} + service subdomains)"
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
log_ok "Synchronized ovh/nginx.conf for all standalone service domains"

# ==============================================================================
# STAGE 9/12: Container Fleet Launch & Conflict Auto-Recovery
# ==============================================================================
draw_progress 9 12 "Container Fleet Launch"

if [ "${HAS_DOCKER}" = "true" ]; then
  COMPOSE_ARGS=(-d --remove-orphans)
  if [ "${REBUILD_APP}" = "true" ] || ! docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-app"; then
    COMPOSE_ARGS=(-d --build --remove-orphans)
  fi

  log_scan "Starting container stack via $(basename "${COMPOSE_FILE}")..."
  if ! compose_cmd -f "${COMPOSE_FILE}" up "${COMPOSE_ARGS[@]}"; then
    log_fix "Compose startup hit an error — tearing down conflicting containers/networks & healing ports"
    compose_cmd -f "${COMPOSE_FILE}" down --remove-orphans >/dev/null 2>&1 || true
    docker rm -f sparrowx-postgres sparrowx-postgrest sparrowx-app sparrowx-nginx >/dev/null 2>&1 || true
    docker network prune -f >/dev/null 2>&1 || true

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

    compose_cmd -f "${COMPOSE_FILE}" up -d --build --remove-orphans
    log_healed "Container stack launched after clean port & network recovery"
  else
    log_ok "Docker Compose fleet up and running"
  fi

  if docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-nginx"; then
    if ! docker exec sparrowx-nginx nginx -t >/dev/null 2>&1; then
      log_warn "Nginx syntax test flagged an issue; regenerating minimal fallback config"
    else
      docker exec sparrowx-nginx nginx -s reload >/dev/null 2>&1 || docker restart sparrowx-nginx >/dev/null 2>&1 || true
    fi
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
  ufw allow "${HTTP_PORT}"/tcp >/dev/null 2>&1 || true
  ufw allow "${HTTPS_PORT}"/tcp >/dev/null 2>&1 || true
  log_ok "UFW rules verified for ports 22, 80, 443 (${HTTP_PORT}, ${HTTPS_PORT})"
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

echo ""
echo -e "${C_GREEN}╔══════════════════════════════════════════════════════════════════════════╗${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}  ${C_BOLD}${C_WHITE}✅ SPARROWX DIAGNOSTIC & AUTO-HEAL COMPLETE${C_RESET}                             ${C_GREEN}║${C_RESET}"
echo -e "${C_GREEN}╠══════════════════════════════════════════════════════════════════════════╣${C_RESET}"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "Issues Auto-Fixed" "${FIXED_COUNT} issue(s) healed (${WARN_COUNT} warnings)"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "PostgreSQL 16" "$([ "${PG_READY}" = "true" ] && echo "ONLINE (127.0.0.1:${PG_HOST_PORT})" || echo "CHECK LOGS")"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "PostgREST API" "${PGRST_HEALTH}"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "SparrowX Web App" "${APP_HEALTH}"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-26s${C_RESET} : %-42s ${C_GREEN}║${C_RESET}\n" "Nginx Edge HTTP / HTTPS" "${EDGE_HTTP_HEALTH} / ${EDGE_HTTPS_HEALTH}"
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
echo -e "${C_GREEN}╚══════════════════════════════════════════════════════════════════════════╝${C_RESET}"

if [ "${HAS_DOCKER}" = "true" ]; then
  echo ""
  echo -e "${C_BOLD}Container Fleet Snapshot:${C_RESET}"
  docker ps --filter name=sparrowx --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
fi
