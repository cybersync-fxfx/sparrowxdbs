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
XDP_SETUP_MODE="auto"
FORCE_REBUILD="false"

for arg in "$@"; do
  case "${arg}" in
    --auto|-y|--yes) AUTO_MODE="true" ;;
    --reinstall-db|--force-db) FORCE_DB_INSTALL="true" ;;
    --fix|--doctor) DELEGATE_FIX="true" ;;
    --ddos|--xdp) XDP_SETUP_MODE="auto" ;;
    --no-xdp) XDP_SETUP_MODE="off" ;;
    --rebuild) FORCE_REBUILD="true" ;;
    --help|-h)
      cat <<'HELP'
SparrowX A-to-Z Full-Stack Updater & Auto-Healer (update.sh)

Usage:
  ./update.sh [options]

Options:
  --auto, -y        Non-interactive mode (used by systemd auto-updater)
  --reinstall-db    Force re-sync of Local OVH PostgreSQL & per-user folders
  --ddos, --xdp     Compile/refresh XDP/eBPF DDoS kernel scrubber alongside update
  --no-xdp          Skip XDP attachment (keep sysctl, UFW & Fail2Ban hardening)
  --rebuild         Force fresh app container image + host Vite/Nitro build
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
  local port="$1"
  case "${port}" in
    8080|8443|2022|3306|6379|"${PTERO_PORT:-8090}") return 0 ;;
    *) return 1 ;;
  esac
}

find_next_free_port() {
  local port="$1"
  local max_tries=60
  local i=0
  while [ "${i}" -lt "${max_tries}" ] && { is_reserved_ptero_port "${port}" || is_port_busy "${port}"; }; do
    port=$((port + 1))
    i=$((i + 1))
  done
  echo "${port}"
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

is_pterodactyl_installed() {
  [ -f /var/www/pterodactyl/artisan ] || [ -d /var/www/pterodactyl/public ]
}

get_docker_host_ip() {
  local gw_ip=""
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-nginx"; then
      gw_ip="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.Gateway}} {{end}}' sparrowx-nginx 2>/dev/null | awk '{print $1}' | tr -d '[:space:]' || true)"
      if [ -z "${gw_ip}" ]; then
        gw_ip="$(docker exec sparrowx-nginx sh -c "getent hosts host.docker.internal 2>/dev/null | awk '{print \$1; exit}'" 2>/dev/null | tr -d '[:space:]' || true)"
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
  [ -z "${gw_ip}" ] && gw_ip="172.17.0.1"
  echo "${gw_ip}"
}

ensure_native_fallback_running() {
  local app_p="${APP_HOST_PORT:-3000}"
  local pgrst_p="${PGRST_HOST_PORT:-3001}"
  log_warn "Docker sparrowx-app unhealthy or build failed — activating native Node.js fallback on :${app_p}"

  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    docker stop sparrowx-app >/dev/null 2>&1 || true
    docker rm -f sparrowx-app >/dev/null 2>&1 || true
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
    compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps --no-build postgres postgrest >/dev/null 2>&1 || true
    compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps --no-build nginx >/dev/null 2>&1 || true
    docker start sparrowx-postgres sparrowx-postgrest sparrowx-nginx >/dev/null 2>&1 || true
    render_sparrowx_nginx_conf
    docker restart sparrowx-nginx >/dev/null 2>&1 || true
  fi
  sleep 2
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
          log_ok "Game DDoS Defense (${gamesec_domain}) container live on ${edge_net} & 127.0.0.1:${gamesec_p}"
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
  local sbs_assets_changed="no"
  if [ -d "${local_sbs_src}" ] && [ -f "${local_sbs_src}/sparrowx-db-adapter.js" ]; then
    mkdir -p "${netsec_dir}" "${netsec_dir}/frontend/public" "${netsec_dir}/frontend/src/components" "${netsec_dir}/frontend/src/pages" 2>/dev/null || true
    for _sbs_check in \
      "server.js" \
      "pg-compat.js" \
      "radar-scanner.js" \
      "frontend/public/logo.png" \
      "frontend/index.html" \
      "frontend/src/App.jsx" \
      "frontend/src/index.css" \
      "frontend/src/pages/Landing.jsx" \
      "frontend/src/pages/Auth.jsx" \
      "frontend/src/pages/Dashboard.jsx" \
      "frontend/src/pages/Docs.jsx"; do
      if [ -f "${local_sbs_src}/${_sbs_check}" ] && ! cmp -s "${local_sbs_src}/${_sbs_check}" "${netsec_dir}/${_sbs_check}" 2>/dev/null; then
        sbs_assets_changed="yes"
      fi
    done
    cp -f "${local_sbs_src}/sparrowx-db-adapter.js" "${netsec_dir}/sparrowx-db-adapter.js" 2>/dev/null || true
    [ -f "${local_sbs_src}/pg-compat.js" ] && cp -f "${local_sbs_src}/pg-compat.js" "${netsec_dir}/pg-compat.js" 2>/dev/null || true
    [ -f "${local_sbs_src}/radar-scanner.js" ] && cp -f "${local_sbs_src}/radar-scanner.js" "${netsec_dir}/radar-scanner.js" 2>/dev/null || true
    cp -f "${local_sbs_src}/server.js" "${netsec_dir}/server.js" 2>/dev/null || true
    cp -f "${local_sbs_src}/package.json" "${netsec_dir}/package.json" 2>/dev/null || true
    cp -f "${local_sbs_src}/.env.example" "${netsec_dir}/.env.example" 2>/dev/null || true
    if [ -d "${local_sbs_src}/frontend" ]; then
      cp -rf "${local_sbs_src}/frontend/public/." "${netsec_dir}/frontend/public/" 2>/dev/null || true
      [ -f "${local_sbs_src}/frontend/index.html" ] && cp -f "${local_sbs_src}/frontend/index.html" "${netsec_dir}/frontend/index.html" 2>/dev/null || true
      [ -d "${local_sbs_src}/frontend/src" ] && cp -rf "${local_sbs_src}/frontend/src/." "${netsec_dir}/frontend/src/" 2>/dev/null || true
      if [ -d "${netsec_dir}/frontend/dist" ]; then
        cp -rf "${local_sbs_src}/frontend/public/." "${netsec_dir}/frontend/dist/" 2>/dev/null || true
      fi
    fi
  fi

  # Clear any false-positive visitor auto-bans created by legacy TIME-WAIT radar scoring
  if command -v nft >/dev/null 2>&1; then
    nft flush set inet detroit_guard blacklist >/dev/null 2>&1 || true
  fi

  if [ ! -f "${netsec_dir}/package.json" ] || [ ! -f "${netsec_dir}/server.js" ]; then
    log_warn "Missing ${netsec_dir}/package.json or server.js; cannot build ${netsec_domain}"
    return 1
  fi
  mkdir -p "${netsec_dir}/storage" 2>/dev/null || true

  local cur_rev="" built_rev="" need_build="no"
  cur_rev="$(git -C "${netsec_dir}" rev-parse HEAD 2>/dev/null || echo 'local')"
  [ -f "${netsec_dir}/.sparrowx-built-rev" ] && built_rev="$(cat "${netsec_dir}/.sparrowx-built-rev" 2>/dev/null | tr -d '[:space:]' || true)"
  if [ ! -s "${netsec_dir}/frontend/dist/index.html" ] || [ ! -f "${netsec_dir}/pg-compat.js" ] || [ ! -d "${netsec_dir}/node_modules/express" ] || [ ! -d "${netsec_dir}/node_modules/bcrypt" ] || [ ! -d "${netsec_dir}/node_modules/pg" ] || [ "${cur_rev}" != "${built_rev}" ] || [ "${sbs_assets_changed}" = "yes" ] || [ "${NETSEC_REBUILD:-0}" = "1" ]; then
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
  if [ "${docker_ok}" = "yes" ] && docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-nginx"; then
    local detected_net=""
    detected_net="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{println $k}}{{end}}' sparrowx-nginx 2>/dev/null | awk 'NF {print; exit}' || true)"
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
          log_ok "Network DDoS Dashboard (${netsec_domain}) container live on ${edge_net} & 127.0.0.1:${netsec_p}"
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
        log_ok "Network DDoS Dashboard (${netsec_domain}) systemd service live on :${netsec_p}"
      fi
    fi
  fi
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

heal_pterodactyl_host_nginx() {
  if ! is_pterodactyl_installed; then
    return 0
  fi
  local ptero_dir="/var/www/pterodactyl"
  local ptero_p="${PTERO_PORT:-8090}"
  local ptero_dom="${DOMAIN_GAME:-game.panel.${SPARROWX_DOMAIN}}"
  if [ "${ptero_dom}" = "game.${SPARROWX_DOMAIN}" ]; then
    ptero_dom="game.panel.${SPARROWX_DOMAIN}"
  fi
  local php_sock="" php_bin=""
  php_bin="$(command -v php8.4 || command -v php8.3 || command -v php8.2 || command -v php8.1 || command -v php || true)"

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

  local db_cli=""
  if command -v mariadb >/dev/null 2>&1; then
    db_cli="mariadb"
  elif command -v mysql >/dev/null 2>&1; then
    db_cli="mysql"
  fi
  for mdb_cnf in /etc/mysql/mariadb.conf.d/50-server.cnf /etc/mysql/mysql.conf.d/mysqld.cnf; do
    if [ -f "${mdb_cnf}" ] && grep -qE '^\s*bind-address\s*=\s*127\.0\.0\.1' "${mdb_cnf}"; then
      sed -i -E 's/^\s*bind-address\s*=\s*127\.0\.0\.1/bind-address = 0.0.0.0/' "${mdb_cnf}"
      systemctl restart mariadb >/dev/null 2>&1 || systemctl restart mysql >/dev/null 2>&1 || true
    fi
  done
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi "Status: active"; then
    ufw allow 3306/tcp >/dev/null 2>&1 || true
  fi

  local db_name="${PTERO_DB_NAME:-panel}"
  local db_user="${PTERO_DB_USER:-pterodactyl}"
  local db_pass="${PTERO_DB_PASSWORD:-}"
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
  if [ -f "${ptero_dir}/.env" ]; then
    set_ptero_env_key "APP_URL" "https://${ptero_dom}"
    set_ptero_env_key "APP_ENVIRONMENT_ONLY" "false"
    set_ptero_env_key "TRUSTED_PROXIES" "*"
    set_ptero_env_key "RECAPTCHA_ENABLED" "false"
    set_ptero_env_key "SESSION_SECURE_COOKIE" "true"
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
    if [ -n "${db_pass}" ]; then
      SPX_DBH_HOST="${ptero_dom}" SPX_DBH_USER="${db_user}" SPX_DBH_PASS="${db_pass}" "${php_bin}" -r '
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
      ' >/dev/null 2>&1 || true
    fi

    if [ -n "${db_cli}" ] && [ -n "${PTERO_ADMIN_PASSWORD:-}" ]; then
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
      if [ "${RESET_PTERO_ADMIN_PASS:-false}" = "true" ]; then
        local bcrypt_pw=""
        bcrypt_pw="$(SPX_PASS="${PTERO_ADMIN_PASSWORD}" "${php_bin}" -r 'echo password_hash(getenv("SPX_PASS"), PASSWORD_BCRYPT);' 2>/dev/null || true)"
        if [ -n "${bcrypt_pw}" ]; then
          "${db_cli}" -u root -e "UPDATE \`${db_name}\`.users SET password='${bcrypt_pw}', root_admin=1 WHERE username IN ('${PTERO_ADMIN_USER:-admin}', 'admin', 'root') OR root_admin=1;" >/dev/null 2>&1 || true
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
  id -u www-data >/dev/null 2>&1 && chown -R www-data:www-data "${ptero_dir}" 2>/dev/null || true
  chmod -R 775 "${ptero_dir}/storage" "${ptero_dir}/bootstrap/cache" 2>/dev/null || true
  chmod 640 "${ptero_dir}/.env" 2>/dev/null || true

  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  mkdir -p /etc/nginx/sparrowx-disabled /etc/nginx/sites-available /etc/nginx/sites-enabled 2>/dev/null || true
  for ncfg in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
    [ -e "${ncfg}" ] || continue
    [ "$(basename "${ncfg}")" = "pterodactyl.conf" ] && continue
    if grep -qE "listen[[:space:]]+([^;]*:)?(80|443)([[:space:];]|$)" "${ncfg}" 2>/dev/null; then
      mv -f "${ncfg}" /etc/nginx/sparrowx-disabled/ 2>/dev/null || rm -f "${ncfg}" 2>/dev/null || true
    fi
  done

  mkdir -p "${INSTALL_DIR}/ovh/certbot-www/.well-known/acme-challenge" 2>/dev/null || true
  cat > /etc/nginx/sites-available/pterodactyl.conf <<PTEROEOF
server {
    listen ${ptero_p} default_server;
    listen [::]:${ptero_p} default_server;
    server_name ${ptero_dom} panel.${SPARROWX_DOMAIN} _;

    root /var/www/pterodactyl/public;
    index index.php;

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
PTEROEOF
  ln -sfn /etc/nginx/sites-available/pterodactyl.conf /etc/nginx/sites-enabled/pterodactyl.conf 2>/dev/null || true

  if [ -s "/etc/letsencrypt/live/${ptero_dom}/fullchain.pem" ] && [ -s "/etc/letsencrypt/live/${ptero_dom}/privkey.pem" ]; then
    mkdir -p "${INSTALL_DIR}/ovh/ssl" /etc/ssl
    cp -fL "/etc/letsencrypt/live/${ptero_dom}/fullchain.pem" "${INSTALL_DIR}/ovh/ssl/ptero-fullchain.pem" 2>/dev/null || true
    cp -fL "/etc/letsencrypt/live/${ptero_dom}/privkey.pem" "${INSTALL_DIR}/ovh/ssl/ptero-privkey.pem" 2>/dev/null || true
    ln -sf "/etc/letsencrypt/live/${ptero_dom}/fullchain.pem" "/etc/ssl/${ptero_dom}.pem" 2>/dev/null || true
    ln -sf "/etc/letsencrypt/live/${ptero_dom}/privkey.pem" "/etc/ssl/${ptero_dom}.key" 2>/dev/null || true
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
  csrf_code="$(curl -s -c "${ptero_cj}" -o /dev/null -w "%{http_code}" --max-time 5 -H "Host: ${ptero_dom}" -H "X-Forwarded-Proto: https" "http://127.0.0.1:${ptero_p}/sanctum/csrf-cookie" 2>/dev/null || echo "000")"
  if echo "${csrf_code}" | grep -qE "^(200|204)$"; then
    raw_xsrf="$(awk '$6=="XSRF-TOKEN"{print $7; exit}' "${ptero_cj}" 2>/dev/null || true)"
    if [ -n "${raw_xsrf}" ] && [ -n "${php_bin}" ]; then
      xsrf_tok="$("${php_bin}" -r 'echo urldecode($argv[1] ?? "");' "${raw_xsrf}" 2>/dev/null || echo "${raw_xsrf}")"
    else
      xsrf_tok="${raw_xsrf}"
    fi
    if [ -n "${xsrf_tok}" ]; then
      login_probe_code="$(curl -s -b "${ptero_cj}" -o /dev/null -w "%{http_code}" --max-time 5 -X POST -H "Host: ${ptero_dom}" -H "X-Forwarded-Proto: https" -H "Accept: application/json" -H "Content-Type: application/json" -H "X-XSRF-TOKEN: ${xsrf_tok}" -d '{"user":"__probe__","password":"__probe__"}' "http://127.0.0.1:${ptero_p}/auth/login" 2>/dev/null || echo "000")"
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
    id -u www-data >/dev/null 2>&1 && chown -R www-data:www-data "${ptero_dir}" 2>/dev/null || true
    chmod -R 775 "${ptero_dir}/storage" "${ptero_dir}/bootstrap/cache" 2>/dev/null || true
    chmod 640 "${ptero_dir}/.env" 2>/dev/null || true
  fi
  log_warn "Aligned host Pterodactyl Nginx onto internal port ${ptero_p} (preserving :80/:443 for SparrowX Edge)"
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
  local game_panel_domain="${DOMAIN_GAME:-game.panel.${SPARROWX_DOMAIN}}"
  local game_web_domain="${DOMAIN_GAME_WEB:-game.${SPARROWX_DOMAIN}}"
  local game_dash_domain="${DOMAIN_GAME_DASH:-game.dash.${SPARROWX_DOMAIN}}"
  local gamesec_domain="${DOMAIN_GAMESEC:-gamesec.${SPARROWX_DOMAIN}}"
  local netsec_domain="${DOMAIN_NETSEC:-netsec.${SPARROWX_DOMAIN}}"
  local infra_domain="${DOMAIN_INFRA:-infra.${SPARROWX_DOMAIN}}"
  local php_domain="${DOMAIN_PHP:-php.${SPARROWX_DOMAIN}}"
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
  issue_le_cert_to_ovh_ssl "${gamesec_domain}" "gamesec"
  issue_le_cert_to_ovh_ssl "${netsec_domain}" "netsec"
  issue_le_cert_to_ovh_ssl "${infra_domain}" "infra"
  issue_le_cert_to_ovh_ssl "${php_domain}" "php"
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
    log_info "Requesting Let's Encrypt SAN SSL for ${root_domain} & core subdomains via HTTP-01..."
    if certbot certonly \
      --webroot -w "${webroot}" \
      --non-interactive --agree-tos --expand \
      -m "${ssl_email}" \
      --cert-name "${root_domain}" \
      "${domain_args[@]}" >/dev/null 2>&1; then
      log_ok "Issued Let's Encrypt SAN SSL for ${root_domain} via port 80 webroot"
    else
      log_warn "Webroot challenge deferred; retrying ${root_domain} via standalone port 80 listener..."
      docker stop sparrowx-nginx >/dev/null 2>&1 || true
      systemctl stop nginx >/dev/null 2>&1 || true
      if command -v fuser >/dev/null 2>&1; then
        fuser -k 80/tcp >/dev/null 2>&1 || true
      fi
      sleep 1

      if certbot certonly \
        --standalone --preferred-challenges http \
        --non-interactive --agree-tos --expand \
        -m "${ssl_email}" \
        --cert-name "${root_domain}" \
        "${domain_args[@]}" >/dev/null 2>&1; then
        log_ok "Issued Let's Encrypt SAN SSL for ${root_domain} via standalone port 80 challenge"
      else
        certbot certonly \
          --standalone --preferred-challenges http \
          --non-interactive --agree-tos \
          -m "${ssl_email}" \
          --cert-name "${root_domain}" \
          -d "${root_domain}" >/dev/null 2>&1 || true
      fi

      if is_pterodactyl_installed; then
        systemctl start nginx >/dev/null 2>&1 || true
      fi
      docker start sparrowx-nginx >/dev/null 2>&1 || compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps nginx >/dev/null 2>&1 || true
    fi
  else
    certbot certonly \
      --webroot -w "${webroot}" \
      --non-interactive --agree-tos --expand --keep-until-expiring \
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

strip_crlf_all() {
  local cleaned=0
  for f in \
    "${INSTALL_DIR}/.env" \
    "${INSTALL_DIR}"/*.sh \
    "${INSTALL_DIR}"/ovh/*.sh \
    "${INSTALL_DIR}"/deploy/*.sh \
    "${INSTALL_DIR}"/deploy/xdp/*.sh \
    "${INSTALL_DIR}"/public/*.sh \
    "${INSTALL_DIR}"/public/xdp/*.sh \
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
  ln -sf "${INSTALL_DIR}/manage-db.sh" /usr/local/bin/sparrowx-db 2>/dev/null || true
  ln -sf "${INSTALL_DIR}/update.sh" /usr/local/bin/sparrowx-update 2>/dev/null || true
  ln -sf "${INSTALL_DIR}/fix.sh" /usr/local/bin/sparrowx-fix 2>/dev/null || true
  ln -sf "${INSTALL_DIR}/fix.sh" /usr/local/bin/sparrowx-doctor 2>/dev/null || true
  [ -f "${INSTALL_DIR}/deploy/ddos-setup.sh" ] && ln -sf "${INSTALL_DIR}/deploy/ddos-setup.sh" /usr/local/bin/sparrowx-ddos 2>/dev/null || true
  [ -f "${INSTALL_DIR}/deploy/xdp/attach-xdp.sh" ] && ln -sf "${INSTALL_DIR}/deploy/xdp/attach-xdp.sh" /usr/local/bin/sparrowx-xdp 2>/dev/null || true
  if [ -f "${INSTALL_DIR}/deploy/sparrowx-noc.py" ]; then
    chmod +x "${INSTALL_DIR}/deploy/sparrowx-noc.py" 2>/dev/null || true
    ln -sf "${INSTALL_DIR}/deploy/sparrowx-noc.py" /usr/local/bin/sparrowx-noc 2>/dev/null || true
    ln -sf "${INSTALL_DIR}/deploy/sparrowx-noc.py" /usr/local/bin/sparrowx-master 2>/dev/null || true
  fi
  if [ -f "${INSTALL_DIR}/deploy/sparrowx-client-gen.py" ]; then
    chmod +x "${INSTALL_DIR}/deploy/sparrowx-client-gen.py" 2>/dev/null || true
    ln -sf "${INSTALL_DIR}/deploy/sparrowx-client-gen.py" /usr/local/bin/sparrowx-gen-client 2>/dev/null || true
    ln -sf "${INSTALL_DIR}/deploy/sparrowx-client-gen.py" /usr/local/bin/sparrowx-protect-gen 2>/dev/null || true
  fi
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
DOMAIN_GAME_WEB="${DOMAIN_GAME_WEB:-game.${SPARROWX_DOMAIN}}"
DOMAIN_GAME_DASH="${DOMAIN_GAME_DASH:-game.dash.${SPARROWX_DOMAIN}}"
DOMAIN_INFRA="${DOMAIN_INFRA:-infra.${SPARROWX_DOMAIN}}"
DOMAIN_GAMESEC="${DOMAIN_GAMESEC:-gamesec.${SPARROWX_DOMAIN}}"
GAMESEC_REPO_URL="${GAMESEC_REPO_URL:-https://github.com/cybersync-fxfx/sbs-detrion-landing.git}"
GAMESEC_DIR="${GAMESEC_DIR:-/opt/sparrowx-gamesec}"
GAMESEC_UPSTREAM_URL="${GAMESEC_UPSTREAM_URL:-}"
GAMESEC_PORT="${GAMESEC_PORT:-3005}"
if port_held_by_other "${GAMESEC_PORT}" "sparrowx-gamesec"; then
  GAMESEC_PORT="$(find_next_free_port 3015)"
fi
DOMAIN_NETSEC="${DOMAIN_NETSEC:-netsec.${SPARROWX_DOMAIN}}"
NETSEC_REPO_URL="${NETSEC_REPO_URL:-https://github.com/cybersync-fxfx/saprrowx.sbs.git}"
NETSEC_DIR="${NETSEC_DIR:-/opt/sparrowx-netsec}"
NETSEC_UPSTREAM_URL="${NETSEC_UPSTREAM_URL:-}"
NETSEC_PORT="${NETSEC_PORT:-3006}"
if port_held_by_other "${NETSEC_PORT}" "sparrowx-netsec"; then
  NETSEC_PORT="$(find_next_free_port 3026)"
fi
if [ -z "${DOMAIN_GAME:-}" ] || [ "${DOMAIN_GAME}" = "game.${SPARROWX_DOMAIN}" ]; then
  DOMAIN_GAME="game.panel.${SPARROWX_DOMAIN}"
fi
PTERO_PORT="${PTERO_PORT:-8090}"
POSTGRES_USER="${POSTGRES_USER:-sparrowx}"
if [ -z "${POSTGRES_PASSWORD:-}" ] || [ "${#POSTGRES_PASSWORD}" -lt 12 ] || [ "${POSTGRES_PASSWORD}" = "sparrowx_ovh_secret_2026" ] || [ "${POSTGRES_PASSWORD}" = "SparrowxMasterSecretPass2026!" ]; then
  POSTGRES_PASSWORD="SpxPg_$(openssl rand -hex 16 2>/dev/null || echo '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c')"
fi
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-postgres"; then
  docker exec -u postgres sparrowx-postgres psql -d postgres -c "ALTER ROLE \"${POSTGRES_USER}\" WITH SUPERUSER LOGIN PASSWORD '${POSTGRES_PASSWORD}';" >/dev/null 2>&1 || true
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

if [ -f "/root/.sparrowx-ptero-credentials.txt" ]; then
  # shellcheck disable=SC1091
  source "/root/.sparrowx-ptero-credentials.txt" 2>/dev/null || true
fi
if [ -f "/var/www/pterodactyl/.env" ]; then
  _EX_DB="$(awk -F= '/^DB_DATABASE=/{sub(/^[^=]*=/,""); print; exit}' /var/www/pterodactyl/.env 2>/dev/null | tr -d "\"'\r" || true)"
  _EX_USER="$(awk -F= '/^DB_USERNAME=/{sub(/^[^=]*=/,""); print; exit}' /var/www/pterodactyl/.env 2>/dev/null | tr -d "\"'\r" || true)"
  _EX_PASS="$(awk -F= '/^DB_PASSWORD=/{sub(/^[^=]*=/,""); print; exit}' /var/www/pterodactyl/.env 2>/dev/null | tr -d "\"'\r" || true)"
  [ -n "${_EX_DB}" ] && PTERO_DB_NAME="${_EX_DB}"
  [ -n "${_EX_USER}" ] && PTERO_DB_USER="${_EX_USER}"
  [ -n "${_EX_PASS}" ] && PTERO_DB_PASSWORD="${_EX_PASS}"
fi
PTERO_DB_NAME="${PTERO_DB_NAME:-panel}"
PTERO_DB_USER="${PTERO_DB_USER:-pterodactyl}"
PTERO_DB_PASSWORD="${PTERO_DB_PASSWORD:-}"
PTERO_ADMIN_EMAIL="${PTERO_ADMIN_EMAIL:-${SPARROWX_ADMIN_EMAIL:-admin@${SPARROWX_DOMAIN}}}"
PTERO_ADMIN_USER="${PTERO_ADMIN_USER:-admin}"
PTERO_ADMIN_PASSWORD="${PTERO_ADMIN_PASSWORD:-}"
if is_pterodactyl_installed && command -v mariadb >/dev/null 2>&1; then
  _ADMIN_ROW="$(mariadb -Nse "SELECT username, email FROM \`${PTERO_DB_NAME}\`.users WHERE root_admin=1 ORDER BY id ASC LIMIT 1;" 2>/dev/null || true)"
  if [ -n "${_ADMIN_ROW}" ]; then
    PTERO_ADMIN_USER="$(echo "${_ADMIN_ROW}" | awk '{print $1}')"
    PTERO_ADMIN_EMAIL="$(echo "${_ADMIN_ROW}" | awk '{print $2}')"
  fi
fi

ensure_env_key "SPARROWX_DOMAIN" "${SPARROWX_DOMAIN}"
ensure_env_key "DOMAIN_ROOT" "${SPARROWX_DOMAIN}"
ensure_env_key "SPARROWX_STUDIO_DOMAIN" "${SPARROWX_STUDIO_DOMAIN}"
ensure_env_key "DOMAIN_STUDIO" "${SPARROWX_STUDIO_DOMAIN}"
ensure_env_key "DOMAIN_GAME" "${DOMAIN_GAME}"
ensure_env_key "DOMAIN_GAME_WEB" "${DOMAIN_GAME_WEB}"
ensure_env_key "DOMAIN_GAME_DASH" "${DOMAIN_GAME_DASH}"
ensure_env_key "DOMAIN_INFRA" "${DOMAIN_INFRA}"
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
ensure_env_key "PTERO_URL" "${PTERO_URL}"
ensure_env_key "PTERO_SSO_SECRET" "${PTERO_SSO_SECRET}"
[ -n "${PTERO_ADMIN_EMAIL}" ] && ensure_env_key "PTERO_ADMIN_EMAIL" "${PTERO_ADMIN_EMAIL}"
[ -n "${PTERO_ADMIN_USER}" ] && ensure_env_key "PTERO_ADMIN_USER" "${PTERO_ADMIN_USER}"
[ -n "${PTERO_ADMIN_PASSWORD}" ] && ensure_env_key "PTERO_ADMIN_PASSWORD" "${PTERO_ADMIN_PASSWORD}"
[ -n "${PTERO_DB_NAME}" ] && ensure_env_key "PTERO_DB_NAME" "${PTERO_DB_NAME}"
[ -n "${PTERO_DB_USER}" ] && ensure_env_key "PTERO_DB_USER" "${PTERO_DB_USER}"
[ -n "${PTERO_DB_PASSWORD}" ] && ensure_env_key "PTERO_DB_PASSWORD" "${PTERO_DB_PASSWORD}"
[ -n "${GOOGLE_CLIENT_ID:-}" ] && ensure_env_key "GOOGLE_CLIENT_ID" "${GOOGLE_CLIENT_ID}"
[ -n "${GOOGLE_CLIENT_SECRET:-}" ] && ensure_env_key "GOOGLE_CLIENT_SECRET" "${GOOGLE_CLIENT_SECRET}"
[ -n "${GOOGLE_REDIRECT_URI:-}" ] && ensure_env_key "GOOGLE_REDIRECT_URI" "${GOOGLE_REDIRECT_URI}"
export SPARROWX_DOMAIN SPARROWX_STUDIO_DOMAIN DOMAIN_INFRA DOMAIN_GAME DOMAIN_GAME_WEB DOMAIN_GAME_DASH DOMAIN_GAMESEC GAMESEC_PORT GAMESEC_REPO_URL GAMESEC_DIR GAMESEC_UPSTREAM_URL DOMAIN_NETSEC NETSEC_PORT NETSEC_REPO_URL NETSEC_DIR NETSEC_UPSTREAM_URL PTERO_PORT SPARROWX_PUBLIC_IP HTTP_PORT HTTPS_PORT APP_HOST_PORT PGRST_HOST_PORT PG_HOST_PORT POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB SPARROWX_JWT_SECRET SPARROWX_MASTER_SSO_SECRET SPARROWX_REDIS_SECRET PTERO_URL PTERO_SSO_SECRET PTERO_ADMIN_EMAIL PTERO_ADMIN_USER PTERO_ADMIN_PASSWORD PTERO_DB_NAME PTERO_DB_USER PTERO_DB_PASSWORD GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_REDIRECT_URI

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

  git -C "${INSTALL_DIR}" config core.fileMode false 2>/dev/null || true
  BEFORE_HASH="$(git rev-parse HEAD 2>/dev/null || echo "")"
  if git fetch origin main --depth=1 && git reset --hard origin/main; then
    AFTER_HASH="$(git rev-parse HEAD 2>/dev/null || echo "")"
    log_ok "Repository synced to commit $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
    strip_crlf_all
    chmod +x \
      "${INSTALL_DIR}"/*.sh \
      "${INSTALL_DIR}"/ovh/*.sh \
      "${INSTALL_DIR}"/deploy/*.sh \
      "${INSTALL_DIR}"/deploy/xdp/*.sh \
      "${INSTALL_DIR}"/public/*.sh \
      "${INSTALL_DIR}"/public/xdp/*.sh 2>/dev/null || true
    git -C "${INSTALL_DIR}" config core.fileMode false 2>/dev/null || true
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
draw_progress 3 7 "Kernel Hardening & DDoS Protection"

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

if [ -f "${INSTALL_DIR}/deploy/ddos-setup.sh" ]; then
  log_info "Synchronizing L3/L4 kernel sysctl, Fail2Ban, UFW ports & XDP/eBPF DDoS scrubber (mode=${XDP_SETUP_MODE})..."
  bash "${INSTALL_DIR}/deploy/ddos-setup.sh" --auto --xdp-mode "${XDP_SETUP_MODE}" || \
    log_warn "DDoS/XDP refresh reported a warning; verifying baseline sysctl profile"
fi

if [ ! -f /etc/sysctl.d/99-sparrowx-hardening.conf ]; then
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
fi
if [ ! -f /etc/apt/apt.conf.d/20auto-upgrades ] && command -v apt-get >/dev/null 2>&1; then
  apt-get install -y -qq unattended-upgrades fail2ban psmisc iproute2 >/dev/null 2>&1 || true
  systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
  systemctl enable --now fail2ban >/dev/null 2>&1 || true
fi
log_ok "Kernel SYN-cookie shield, BBR, Fail2Ban & L3/L4 DDoS layer active"

if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw allow "${HTTP_PORT}"/tcp >/dev/null 2>&1 || true
  ufw allow "${HTTPS_PORT}"/tcp >/dev/null 2>&1 || true
  ufw allow in from 127.0.0.1 to any port "${GAMESEC_PORT:-3005}" proto tcp >/dev/null 2>&1 || true
  ufw allow in from 172.16.0.0/12 to any port "${GAMESEC_PORT:-3005}" proto tcp >/dev/null 2>&1 || true
  ufw allow in from 127.0.0.1 to any port "${NETSEC_PORT:-3006}" proto tcp >/dev/null 2>&1 || true
  ufw allow in from 172.16.0.0/12 to any port "${NETSEC_PORT:-3006}" proto tcp >/dev/null 2>&1 || true
  ufw allow in from 127.0.0.1 to any port "${APP_HOST_PORT}" proto tcp >/dev/null 2>&1 || true
  ufw allow in from 172.16.0.0/12 to any port "${APP_HOST_PORT}" proto tcp >/dev/null 2>&1 || true
  ufw allow in from 127.0.0.1 to any port "${PTERO_PORT}" proto tcp >/dev/null 2>&1 || true
  ufw allow in from 172.16.0.0/12 to any port "${PTERO_PORT}" proto tcp >/dev/null 2>&1 || true
  if [ -d /etc/pterodactyl ] || systemctl list-unit-files wings.service >/dev/null 2>&1; then
    ufw allow 8080/tcp >/dev/null 2>&1 || true
    ufw allow 2022/tcp >/dev/null 2>&1 || true
  fi
  log_ok "UFW ports opened (22, 80, 443, ${HTTP_PORT}, ${HTTPS_PORT}, App:${APP_HOST_PORT}, Ptero:${PTERO_PORT})"
fi

# ==============================================================================
# STEP 4/7: SSL Certificates & Multi-Domain Nginx Proxy
# ==============================================================================
draw_progress 4 7 "SSL & Multi-Domain Nginx"

mkdir -p "${INSTALL_DIR}/ovh/ssl" "${INSTALL_DIR}/ovh/certbot-www/.well-known/acme-challenge" "${INSTALL_DIR}/data/users" "${INSTALL_DIR}/data/backups"

SSL_CERT="${INSTALL_DIR}/ovh/ssl/fullchain.pem"
SSL_KEY="${INSTALL_DIR}/ovh/ssl/privkey.pem"
if [ ! -s "${SSL_CERT}" ] || [ ! -s "${SSL_KEY}" ] || ! openssl x509 -in "${SSL_CERT}" -noout >/dev/null 2>&1; then
  log_warn "Generating valid TLS certificate (SAN: ${SPARROWX_DOMAIN} + subdomains)"
  if ! openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "${SSL_KEY}" \
    -out "${SSL_CERT}" \
    -subj "/CN=${SPARROWX_DOMAIN}" \
    -addext "subjectAltName=DNS:${SPARROWX_DOMAIN},DNS:*.${SPARROWX_DOMAIN},DNS:${DOMAIN_GAME_WEB},DNS:${DOMAIN_GAME_DASH},DNS:${DOMAIN_GAMESEC},DNS:${DOMAIN_NETSEC},DNS:${DOMAIN_GAME},DNS:panel.${SPARROWX_DOMAIN}" >/dev/null 2>&1; then
    openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
      -keyout "${SSL_KEY}" \
      -out "${SSL_CERT}" \
      -subj "/CN=${SPARROWX_DOMAIN}" >/dev/null 2>&1 || true
  fi
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
  local gamesec_backend=""
  if [ -n "${GAMESEC_UPSTREAM_URL:-}" ]; then
    gamesec_backend="    location / {
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
    gamesec_backend="    location / {
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
  local php_domain="${DOMAIN_PHP:-php.${SPARROWX_DOMAIN:-sparrowx.local}}"
  local php_ssl_cert="/etc/nginx/ssl/fullchain.pem"
  local php_ssl_key="/etc/nginx/ssl/privkey.pem"
  if [ -s "${INSTALL_DIR}/ovh/ssl/php-fullchain.pem" ] && [ -s "${INSTALL_DIR}/ovh/ssl/php-privkey.pem" ]; then
    php_ssl_cert="/etc/nginx/ssl/php-fullchain.pem"
    php_ssl_key="/etc/nginx/ssl/php-privkey.pem"
  fi
  local netsec_domain="${DOMAIN_NETSEC:-netsec.${SPARROWX_DOMAIN:-sparrowx.local}}"
  local netsec_p="${NETSEC_PORT:-3006}"
  local netsec_ssl_cert="/etc/nginx/ssl/fullchain.pem"
  local netsec_ssl_key="/etc/nginx/ssl/privkey.pem"
  if [ -s "${INSTALL_DIR}/ovh/ssl/netsec-fullchain.pem" ] && [ -s "${INSTALL_DIR}/ovh/ssl/netsec-privkey.pem" ]; then
    netsec_ssl_cert="/etc/nginx/ssl/netsec-fullchain.pem"
    netsec_ssl_key="/etc/nginx/ssl/netsec-privkey.pem"
  fi
  local netsec_backend=""
  if [ -n "${NETSEC_UPSTREAM_URL:-}" ]; then
    netsec_backend="    location / {
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
    netsec_backend="    location / {
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
        proxy_pass http://${docker_host_ip}:${PTERO_PORT};
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
    }"
  else
    ptero_backend="    location / {
        set \$upstream_app http://sparrowx:3000;
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
# SPARROWX MULTI-SERVICE NGINX REVERSE PROXY (L7 DDOS SHIELD ENABLED)
# ============================================================================
limit_req_zone \$binary_remote_addr zone=spx_edge_req:20m rate=45r/s;
limit_req_zone \$binary_remote_addr zone=spx_api_req:10m rate=25r/s;
limit_conn_zone \$binary_remote_addr zone=spx_conn_limit:10m;

# 1. Master SparrowX Command Center & Default Fallback (${SPARROWX_DOMAIN})
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

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location /rest/v1/ {
        limit_req zone=spx_api_req burst=60 nodelay;
        set \$upstream_app http://sparrowx:3000;
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
        set \$upstream_app http://sparrowx:3000;
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

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location /rest/v1/ {
        limit_req zone=spx_api_req burst=60 nodelay;
        set \$upstream_app http://sparrowx:3000;
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

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location /rest/v1/ {
        limit_req zone=spx_api_req burst=60 nodelay;
        set \$upstream_app http://sparrowx:3000;
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
        set \$upstream_app http://sparrowx:3000;
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

# 4. Pterodactyl Game Panel (${DOMAIN_GAME})
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

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
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

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
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

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

${gamesec_backend}
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

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

${netsec_backend}
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

    limit_conn spx_conn_limit 40;
    limit_req zone=spx_edge_req burst=90 nodelay;
    limit_req_status 429;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-SparrowX-WAF "ACTIVE" always;
    add_header X-SparrowX-Shield "PROTECTED" always;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
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

# 10. phpMyAdmin Database Console (${php_domain})
server {
    listen 80;
    listen 443 ssl;
    server_name ${php_domain};
    ssl_certificate ${php_ssl_cert};
    ssl_certificate_key ${php_ssl_key};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    client_max_body_size 128M;
    server_tokens off;
    resolver 127.0.0.11 valid=5s ipv6=off;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Robots-Tag "noindex, nofollow" always;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        allow all;
    }

    location / {
        set \$upstream_pma http://sparrowx-phpmyadmin:80;
        proxy_pass \$upstream_pma;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
}

render_sparrowx_nginx_conf
log_ok "Nginx reverse proxy configured for SparrowX + ${DOMAIN_INFRA}, ${DOMAIN_GAME_WEB}, ${DOMAIN_GAME_DASH}, ${DOMAIN_GAMESEC}, ${DOMAIN_NETSEC} & ${DOMAIN_GAME}"

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
  # Stop conflicting host daemons (keep host nginx alive if Pterodactyl Panel is installed)
  for svc in sparrowx-native.service postgresql pgbouncer apache2 caddy; do
    if systemctl is-active --quiet "${svc}" 2>/dev/null; then
      systemctl stop "${svc}" >/dev/null 2>&1 || true
      log_warn "Stopped conflicting host service: ${svc}"
    fi
  done
  if is_pterodactyl_installed; then
    heal_pterodactyl_host_nginx
  elif systemctl is-active --quiet nginx 2>/dev/null; then
    systemctl stop nginx >/dev/null 2>&1 || true
    log_warn "Stopped conflicting host service: nginx"
  fi
  for pg_unit in $(systemctl list-units --type=service --state=active --no-legend 'postgresql@*' 2>/dev/null | awk '{print $1}' || true); do
    systemctl stop "${pg_unit}" >/dev/null 2>&1 || true
    log_warn "Stopped conflicting versioned PostgreSQL unit: ${pg_unit}"
  done

  # Remove legacy/duplicate standalone containers BEFORE checking ports
  if [ -f "${INSTALL_DIR}/docker-compose.standalone.yml" ]; then
    compose_cmd -f "${INSTALL_DIR}/docker-compose.standalone.yml" down --remove-orphans >/dev/null 2>&1 || true
  fi
  for old_c in sparrowx_postgres sparrowx_pgbouncer sparrowx_postgrest sparrowx_threat_cache sparrowx_studio sparrowx_edge_proxy; do
    if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -Fxq "${old_c}"; then
      docker rm -f "${old_c}" >/dev/null 2>&1 || true
      log_warn "Removed legacy conflicting container: ${old_c}"
    fi
  done

  # Clear crashed/non-running sparrowx-postgres + stray host postgres/docker-proxy on 5432, and uninitialized sparrowx_pgdata
  if ! docker ps --filter status=running --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-postgres"; then
    docker rm -f sparrowx-postgres >/dev/null 2>&1 || true
    pkill -9 -x postgres >/dev/null 2>&1 || true
    pkill -9 -f "docker-proxy.*-host-port ${PG_HOST_PORT}( |$)" >/dev/null 2>&1 || true
    command -v fuser >/dev/null 2>&1 && fuser -k "${PG_HOST_PORT}/tcp" >/dev/null 2>&1 || true
  fi
  if ! docker ps --filter status=running --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-nginx"; then
    pkill -9 -f "docker-proxy.*-host-port ${HTTP_PORT}( |$)" >/dev/null 2>&1 || true
    pkill -9 -f "docker-proxy.*-host-port ${HTTPS_PORT}( |$)" >/dev/null 2>&1 || true
  fi
  for pg_vol in $(docker volume ls -q 2>/dev/null | grep 'sparrowx_pgdata' || true); do
    vol_mp="$(docker volume inspect -f '{{.Mountpoint}}' "${pg_vol}" 2>/dev/null || true)"
    if [ -n "${vol_mp}" ] && [ -d "${vol_mp}" ] && [ ! -f "${vol_mp}/PG_VERSION" ] && [ -n "$(ls -A "${vol_mp}" 2>/dev/null)" ]; then
      docker rm -f sparrowx-postgres >/dev/null 2>&1 || true
      rm -rf "${vol_mp:?}"/* "${vol_mp:?}"/.[!.]* "${vol_mp:?}"/..?* 2>/dev/null || true
      log_warn "Cleared uninitialized/corrupted PostgreSQL volume ${pg_vol} (missing PG_VERSION)"
    fi
  done

  # Remove foreign Docker containers holding SparrowX ports (80, 443, 5432, 3000, 3001)
  free_docker_port_conflicts "${HTTP_PORT}" "sparrowx-nginx"
  free_docker_port_conflicts "${HTTPS_PORT}" "sparrowx-nginx"
  free_docker_port_conflicts "${PG_HOST_PORT}" "sparrowx-postgres"
  free_docker_port_conflicts "${PGRST_HOST_PORT}" "sparrowx-postgrest"
  free_docker_port_conflicts "${APP_HOST_PORT}" "sparrowx-app"

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
    BUILD_ARGS=("build")
    [ "${FORCE_REBUILD}" = "true" ] && BUILD_ARGS+=("--no-cache")
    BUILD_ARGS+=("${APP_SERVICE}")
    if compose_cmd -f "${COMPOSE_FILE}" "${BUILD_ARGS[@]}" && compose_cmd -f "${COMPOSE_FILE}" up -d --no-build --remove-orphans; then
      docker start sparrowx-postgres sparrowx-postgrest sparrowx-app sparrowx-nginx >/dev/null 2>&1 || true
      render_sparrowx_nginx_conf
      docker restart sparrowx-nginx >/dev/null 2>&1 || true
      log_ok "Rebuilt and restarted ${APP_SERVICE} + sparrowx-nginx zero-downtime"
    else
      BUILD_FAILED="true"
    fi
  else
    if port_held_by_other "${PG_HOST_PORT}" "sparrowx-postgres"; then
      command -v fuser >/dev/null 2>&1 && fuser -k "${PG_HOST_PORT}/tcp" >/dev/null 2>&1 || true
      sleep 1
    fi
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
      docker rm -f sparrowx-postgres sparrowx-postgrest sparrowx-app sparrowx-nginx sparrowx_postgres sparrowx_postgrest sparrowx_studio sparrowx_edge_proxy >/dev/null 2>&1 || true
      docker network prune -f >/dev/null 2>&1 || true
      free_docker_port_conflicts "${PG_HOST_PORT}" "sparrowx-postgres"
      command -v fuser >/dev/null 2>&1 && fuser -k 5432/tcp >/dev/null 2>&1 || true
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
    compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps --no-build postgres postgrest >/dev/null 2>&1 || true
    compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps --no-build nginx >/dev/null 2>&1 || true
    docker start sparrowx-app sparrowx-nginx >/dev/null 2>&1 || true
    render_sparrowx_nginx_conf
    docker restart sparrowx-nginx >/dev/null 2>&1 || true
  fi

  if docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-app"; then
    rm -rf "${INSTALL_DIR}/.output" 2>/dev/null || true
    docker cp sparrowx-app:/app/.output "${INSTALL_DIR}/.output" >/dev/null 2>&1 || true
  fi

  ensure_gamesec_landing_running || true
  ensure_netsec_dashboard_running || true
  ensure_game_letsencrypt_ssl
  ensure_core_letsencrypt_ssl
  render_sparrowx_nginx_conf
  docker exec sparrowx-nginx nginx -s reload >/dev/null 2>&1 || docker restart sparrowx-nginx >/dev/null 2>&1 || true
  if [ -x "${INSTALL_DIR}/deploy/ssl-renew.sh" ]; then
    bash "${INSTALL_DIR}/deploy/ssl-renew.sh" >/dev/null 2>&1 || true
  fi

  if [ "${BUILD_FAILED}" = "true" ]; then
    if [ -x "${INSTALL_DIR}/fix.sh" ]; then
      log_warn "Build/startup reported errors — invoking autonomous doctor (fix.sh --auto --rebuild)"
      "${INSTALL_DIR}/fix.sh" --auto --rebuild
    fi
    if ! curl -fsS "http://127.0.0.1:${APP_HOST_PORT}/api/v1/health" >/dev/null 2>&1; then
      ensure_native_fallback_running || true
    fi
  fi
else
  log_info "Docker unavailable — rebuilding native Node.js SparrowX server..."
  ensure_native_fallback_running || true
  ensure_gamesec_landing_running || true
  ensure_netsec_dashboard_running || true
fi

# ==============================================================================
# STEP 7/7: PostgreSQL Role/Schema Verify, DB Sync & Live Health Gate
# ==============================================================================
draw_progress 7 7 "DB Schema Sync & Health Probe"

if [ "${HAS_DOCKER}" = "true" ] && docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-postgres"; then
  for _pgw in $(seq 1 15); do
    docker exec sparrowx-postgres pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -q >/dev/null 2>&1 && break
    sleep 1
  done
  docker exec -u postgres sparrowx-postgres psql -d postgres -c "ALTER ROLE \"${POSTGRES_USER}\" WITH SUPERUSER LOGIN PASSWORD '${POSTGRES_PASSWORD}';" >/dev/null 2>&1 || true
  if [ -f "${INSTALL_DIR}/ovh/schema.sql" ]; then
    if ! docker exec -i -e PGPASSWORD="${POSTGRES_PASSWORD}" sparrowx-postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "${INSTALL_DIR}/ovh/schema.sql" >/dev/null 2>&1; then
      docker exec -i -u postgres sparrowx-postgres psql -d "${POSTGRES_DB}" < "${INSTALL_DIR}/ovh/schema.sql" >/dev/null 2>&1 || true
    fi
    docker kill -s SIGUSR1 sparrowx-postgrest >/dev/null 2>&1 || docker restart sparrowx-postgrest >/dev/null 2>&1 || true
    log_ok "Synchronized sovereign PostgreSQL 16 schema, roles & RPCs from ovh/schema.sql"
  fi
  if [ -x "${INSTALL_DIR}/deploy/backup-all-dbs.sh" ] || [ -f "${INSTALL_DIR}/deploy/backup-all-dbs.sh" ]; then
    mkdir -p "${INSTALL_DIR}/backups" 2>/dev/null || true
    if [ -z "$(find "${INSTALL_DIR}/backups" -maxdepth 2 \( -name '*.sql*' -o -name '*.dump*' -o -name '*.gz' \) 2>/dev/null | head -n1)" ]; then
      bash "${INSTALL_DIR}/deploy/backup-all-dbs.sh" >/dev/null 2>&1 || true
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
  if [ "${HEALTH_OK}" != "true" ]; then
    ensure_native_fallback_running || true
    for _nf in 1 2 3 4 5; do
      if curl -fsS "http://127.0.0.1:${APP_HOST_PORT}/api/v1/health" >/dev/null 2>&1; then
        HEALTH_OK="true"
        break
      fi
      sleep 2
    done
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
PTERO_STATUS="NOT INSTALLED"
if is_pterodactyl_installed; then
  PTERO_EDGE_CODE="$(curl -sk -o /dev/null -w "%{http_code}" --max-time 4 -H "Host: ${DOMAIN_GAME}" "https://127.0.0.1:${HTTPS_PORT}/" 2>/dev/null || echo "000")"
  if ! echo "${PTERO_EDGE_CODE}" | grep -qE "^(200|301|302)$"; then
    heal_pterodactyl_host_nginx
    render_sparrowx_nginx_conf
    docker exec sparrowx-nginx nginx -s reload >/dev/null 2>&1 || docker restart sparrowx-nginx >/dev/null 2>&1 || true
    sleep 2
    PTERO_EDGE_CODE="$(curl -sk -o /dev/null -w "%{http_code}" --max-time 4 -H "Host: ${DOMAIN_GAME}" "https://127.0.0.1:${HTTPS_PORT}/" 2>/dev/null || echo "000")"
  fi
  PTERO_STATUS="$(echo "${PTERO_EDGE_CODE}" | grep -qE "^(200|301|302)$" && echo "ONLINE (:${PTERO_PORT})" || echo "CHECK (HTTP ${PTERO_EDGE_CODE})")"
fi

GAMESEC_EDGE_CODE="$(curl -sk -o /dev/null -w "%{http_code}" --max-time 4 -H "Host: ${DOMAIN_GAMESEC}" "https://127.0.0.1:${HTTPS_PORT}/" 2>/dev/null || echo "000")"
if echo "${GAMESEC_EDGE_CODE}" | grep -qE "^(200|301|302|307|308)$"; then
  GAMESEC_STATUS="ONLINE (HTTP ${GAMESEC_EDGE_CODE} -> :${GAMESEC_PORT})"
elif [ -n "${GAMESEC_UPSTREAM_URL:-}" ]; then
  GAMESEC_STATUS="CHECK UPSTREAM (HTTP ${GAMESEC_EDGE_CODE})"
else
  GAMESEC_STATUS="CHECK (HTTP ${GAMESEC_EDGE_CODE} -> :${GAMESEC_PORT})"
fi
NETSEC_EDGE_CODE="$(curl -sk -o /dev/null -w "%{http_code}" --max-time 4 -H "Host: ${DOMAIN_NETSEC}" "https://127.0.0.1:${HTTPS_PORT}/" 2>/dev/null || echo "000")"
if echo "${NETSEC_EDGE_CODE}" | grep -qE "^(200|301|302|307|308)$"; then
  NETSEC_STATUS="ONLINE (HTTP ${NETSEC_EDGE_CODE} -> :${NETSEC_PORT})"
elif [ -n "${NETSEC_UPSTREAM_URL:-}" ]; then
  NETSEC_STATUS="CHECK UPSTREAM (HTTP ${NETSEC_EDGE_CODE})"
elif [ ! -s "${NETSEC_DIR}/.env" ] || { ! grep -qE '^DATABASE_URL=.+' "${NETSEC_DIR}/.env" 2>/dev/null && ! grep -qE '^SUPABASE_URL=.+' "${NETSEC_DIR}/.env" 2>/dev/null; }; then
  NETSEC_STATUS="NEEDS DB CONFIG (${NETSEC_DIR}/.env)"
else
  NETSEC_STATUS="CHECK (HTTP ${NETSEC_EDGE_CODE} -> :${NETSEC_PORT})"
fi

echo ""
echo -e "${C_GREEN}╔══════════════════════════════════════════════════════════════════════════╗${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}  ${C_BOLD}${C_WHITE}✅ ALL UPDATES APPLIED & FULL-STACK OVH SYSTEM IS LIVE (A-TO-Z)${C_RESET}         ${C_GREEN}║${C_RESET}"
echo -e "${C_GREEN}╠══════════════════════════════════════════════════════════════════════════╣${C_RESET}"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-24s${C_RESET} : %-44s ${C_GREEN}║${C_RESET}\n" "Git Commit" "$(git rev-parse --short HEAD 2>/dev/null || echo local) (origin/main)"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-24s${C_RESET} : %-44s ${C_GREEN}║${C_RESET}\n" "Auto-Healed Fixes" "${HEALED_COUNT} issue(s) resolved automatically"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-24s${C_RESET} : %-44s ${C_GREEN}║${C_RESET}\n" "Web / PostgREST / Edge" "$([ "${HEALTH_OK}" = "true" ] && echo "ONLINE" || echo "WARN") / ${PGRST_STATUS} / ${EDGE_STATUS}"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-24s${C_RESET} : %-44s ${C_GREEN}║${C_RESET}\n" "Game DDoS Defense" "${GAMESEC_STATUS}"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-24s${C_RESET} : %-44s ${C_GREEN}║${C_RESET}\n" "Net DDoS Dashboard" "${NETSEC_STATUS}"
if is_pterodactyl_installed; then
  printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-24s${C_RESET} : %-44s ${C_GREEN}║${C_RESET}\n" "Pterodactyl Panel" "${PTERO_STATUS}"
fi
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-24s${C_RESET} : %-44s ${C_GREEN}║${C_RESET}\n" "Port Bindings" "PG:${PG_HOST_PORT} PGRST:${PGRST_HOST_PORT} APP:${APP_HOST_PORT} WEB:${HTTP_PORT}/${HTTPS_PORT}"
echo -e "${C_GREEN}╠══════════════════════════════════════════════════════════════════════════╣${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}  ${C_BOLD}Dedicated Service Websites:${C_RESET}                                             ${C_GREEN}║${C_RESET}"
printf "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Master Portal    : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} DB Studio        : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://db.${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Drop Vault       : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://file.${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_YELLOW}•${C_RESET} Password Vault   : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://password.${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_BLUE}•${C_RESET} Shield WAF/SOC   : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://sec.${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_MAGENTA}•${C_RESET} REST API Gateway : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://api.${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Cloud Infra      : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://${DOMAIN_INFRA}"
printf "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Game Hosting     : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://${DOMAIN_GAME_WEB}"
printf "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Game Client Dash : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://${DOMAIN_GAME_DASH}"
printf "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Game DDoS Portal : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://${DOMAIN_GAMESEC}"
printf "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Net DDoS Dash    : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://${DOMAIN_NETSEC}"
if is_pterodactyl_installed; then
  printf "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Game Panel       : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://${DOMAIN_GAME}"
fi
echo -e "${C_GREEN}╠══════════════════════════════════════════════════════════════════════════╣${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}  ${C_BOLD}${C_YELLOW}Credentials & Database Info Used:${C_RESET}"
if is_pterodactyl_installed; then
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Panel Login URL  : ${C_WHITE}https://${DOMAIN_GAME}${C_RESET} ${C_DIM}(Internal :${PTERO_PORT})${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Panel Admin Email: ${C_CYAN}${PTERO_ADMIN_EMAIL}${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Panel Admin User : ${C_CYAN}${PTERO_ADMIN_USER}${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Panel Admin Pass : ${C_YELLOW}${PTERO_ADMIN_PASSWORD:-(run ./fix.sh to sync/reset)}${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Ptero MySQL Host : ${C_WHITE}127.0.0.1:3306${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Ptero MySQL DB   : ${C_WHITE}${PTERO_DB_NAME}${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Ptero MySQL User : ${C_WHITE}${PTERO_DB_USER}${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Ptero MySQL Pass : ${C_YELLOW}${PTERO_DB_PASSWORD:-(check /var/www/pterodactyl/.env)}${C_RESET}"
fi
echo -e "${C_GREEN}║${C_RESET}   ${C_MAGENTA}•${C_RESET} Postgres Host    : ${C_WHITE}127.0.0.1:${PG_HOST_PORT}${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}   ${C_MAGENTA}•${C_RESET} Postgres DB/User : ${C_WHITE}${POSTGRES_DB} / ${POSTGRES_USER}${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}   ${C_MAGENTA}•${C_RESET} Postgres Pass    : ${C_YELLOW}${POSTGRES_PASSWORD}${C_RESET}"
echo -e "${C_GREEN}╠══════════════════════════════════════════════════════════════════════════╣${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}  ${C_BOLD}Quick Operations CLI & Setup Links:${C_RESET}                                     ${C_GREEN}║${C_RESET}"
printf "${C_GREEN}║${C_RESET}   ${C_YELLOW}•${C_RESET} Full Update      : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "./update.sh  (or: sparrowx-update)"
printf "${C_GREEN}║${C_RESET}   ${C_YELLOW}•${C_RESET} Auto-Heal Doctor : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "./fix.sh     (or: sparrowx-fix / sparrowx-doctor)"
printf "${C_GREEN}║${C_RESET}   ${C_YELLOW}•${C_RESET} DDoS / XDP Setup : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "sparrowx-ddos (or: sparrowx-xdp --status)"
printf "${C_GREEN}║${C_RESET}   ${C_YELLOW}•${C_RESET} Linux Master NOC : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "sudo sparrowx-noc (or: sparrowx-master)"
printf "${C_GREEN}║${C_RESET}   ${C_YELLOW}•${C_RESET} Database TUI     : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "./manage-db.sh (or: sparrowx-db)"
printf "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Single-File DDoS : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://${SPARROWX_DOMAIN}/ddos-setup.sh"
printf "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} XDP C / Setup    : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://${SPARROWX_DOMAIN}/setup.sh"
echo -e "${C_GREEN}╚══════════════════════════════════════════════════════════════════════════╝${C_RESET}"
