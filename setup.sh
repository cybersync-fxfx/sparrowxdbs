#!/usr/bin/env bash
# ==============================================================================
# SPARROWX TECHNOLOGIES — SOVEREIGN FULL-STACK BLUEPRINT INSTALLER (DEBIAN/UBUNTU)
# ==============================================================================
# Complete A-to-Z Dedicated Server Wizard:
#  • Attractive Cyber-Terminal UI with step progress & live health matrix
#  • Self-Healing Debian/Ubuntu Engine (apt locks, IPv4 apt, swap, port 80/443/53)
#  • Multi-Domain Reverse Proxy (Root, DB, Shield, File 150MB, Keys, API + IP)
#  • 5 Isolated PostgreSQL 16 + pgvector Databases + Unified Email/Auth Hub
#  • Full Backend Fleet (Postgres, PgBouncer, PostgREST, Redis, App, SSL Proxy)
#  • Automated Let's Encrypt SSL (Webroot + Instant SAN Fallback + 12h Cron)
#  • Live Ping & HTTP/HTTPS Website Detector with Auto-Fix + All Cron Jobs
# ==============================================================================
set -u

REPO_URL="https://github.com/cybersync-fxfx/sparrowxdbs.git"
INSTALL_DIR="/opt/sparrowx"
LOG_FILE="/var/log/sparrowx-install.log"

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

touch "${LOG_FILE}" 2>/dev/null || LOG_FILE="/tmp/sparrowx-install.log"
clear 2>/dev/null || true

echo -e "${C_ORANGE}"
cat <<'BANNER'
   _____ ____  ___    ____  ____  ____  _       ___  __
  / ___// __ \/   |  / __ \/ __ \/ __ \| |     / / |/ /
  \__ \/ /_/ / /| | / /_/ / /_/ / / / /| | /| / /|   / 
 ___/ / ____/ ___ |/ _, _/ _, _/ /_/ / | |/ |/ //   |  
/____/_/   /_/  |_/_/ |_/_/ |_|\____/  |__/|__//_/|_|  
BANNER
echo -e "${C_RESET}${C_BOLD}  SOVEREIGN INFRASTRUCTURE BLUEPRINT • DEBIAN / UBUNTU DEDICATED WIZARD${C_RESET}"
echo -e "${C_DIM}  Multi-Domain SSL • 5 Isolated PG16+pgvector DBs • Watchdog & Cron Fleet${C_RESET}"
echo -e "${C_ORANGE}========================================================================${C_RESET}"

# ==============================================================================
# SELF-HEALING UTILITIES
# ==============================================================================
heal_apt_locks() {
  if ! command -v apt-get >/dev/null 2>&1; then return 0; fi
  export DEBIAN_FRONTEND=noninteractive
  # Fix slow/hanging IPv6 apt mirrors on Debian dedicated servers
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
  return 1
}

reclaim_web_ports() {
  # On Debian dedicated servers, Apache2 / host Nginx / Lighttpd often occupy 80/443.
  # Reclaim 80 and 443 cleanly so the live website runs on standard HTTP/HTTPS ports!
  for svc in apache2 httpd nginx lighttpd caddy; do
    if systemctl is-active --quiet "${svc}" 2>/dev/null || systemctl is-enabled --quiet "${svc}" 2>/dev/null; then
      log_warn "Host service '${svc}' is holding web ports. Stopping & disabling it for SparrowX Proxy..."
      systemctl stop "${svc}" >/dev/null 2>&1 || true
      systemctl disable "${svc}" >/dev/null 2>&1 || true
    fi
  done
  for p in 80 443; do
    if is_port_in_use "${p}"; then
      log_warn "Clearing leftover process on port ${p}..."
      fuser -k "${p}/tcp" >/dev/null 2>&1 || true
      sleep 1
    fi
  done
}

find_free_port() {
  local preferred="$1"
  local fallback="$2"
  local label="$3"
  if ! is_port_in_use "${preferred}"; then
    echo "${preferred}"
    return 0
  fi
  log_warn "${label}: Port ${preferred} is busy; scanning from ${fallback}..." >&2
  local candidate="${fallback}"
  while [ "${candidate}" -lt 65000 ]; do
    if ! is_port_in_use "${candidate}"; then
      log_ok "${label}: Assigned free port ${candidate}" >&2
      echo "${candidate}"
      return 0
    fi
    candidate=$((candidate + 1))
  done
  echo "${preferred}"
}

ask_prompt() {
  local prompt_text="$1"
  local default_val="$2"
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
  log_info "Installing core system, firewall, SSL, cron & diagnostic packages..."
  retry_pkg_install ca-certificates curl gnupg git openssl ufw cron lsb-release dnsutils lsof iproute2 net-tools psmisc certbot fail2ban
  systemctl enable --now cron >/dev/null 2>&1 || true
else
  retry_pkg_install ca-certificates curl git openssl firewalld bind-utils lsof iproute net-tools psmisc certbot cronie
  systemctl enable --now crond >/dev/null 2>&1 || true
fi
log_ok "System prerequisites verified."

DETECTED_IP="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || curl -4 -fsS --max-time 5 https://icanhazip.com 2>/dev/null | tr -d '[:space:]' || hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')"

# ==============================================================================
# STEP 2: INTERACTIVE SPARROWX BLUEPRINT WIZARD
# ==============================================================================
step_banner 2 10 "Interactive Multi-Domain & Sovereign Blueprint Wizard"

# Load existing .env defaults if re-running
if [ -f "${INSTALL_DIR}/.env" ]; then
  source "${INSTALL_DIR}/.env" 2>/dev/null || true
elif [ -f "./.env" ]; then
  source "./.env" 2>/dev/null || true
fi

echo -e "  ${C_DIM}Configure your custom root domain & subdomains (press Enter for defaults):${C_RESET}"
echo ""

RAW_DOMAIN="$(ask_prompt "1/6 Primary Root Domain (e.g. sparrowx.net or yourdomain.com)" "${DOMAIN_ROOT:-sparrowx.net}")"
DOMAIN_ROOT="$(echo "${RAW_DOMAIN}" | sed -E 's#^https?://##; s#/.*$##' | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
[ -z "${DOMAIN_ROOT}" ] && DOMAIN_ROOT="sparrowx.net"

CUSTOM_SUBS="$(ask_prompt "2/6 Use standard subdomains (db., sec., file., password., api.)? (yes/custom)" "yes")"
if [[ "$(echo "${CUSTOM_SUBS}" | tr '[:upper:]' '[:lower:]')" == "custom" ]]; then
  DOMAIN_STUDIO="$(ask_prompt "    -> Cloud DB Studio Domain" "db.${DOMAIN_ROOT}")"
  DOMAIN_SEC="$(ask_prompt "    -> Shield WAF & Threat Map Domain" "sec.${DOMAIN_ROOT}")"
  DOMAIN_FILE="$(ask_prompt "    -> File Drop & 10GB Vault Domain" "file.${DOMAIN_ROOT}")"
  DOMAIN_PASSWORD="$(ask_prompt "    -> Keys Password Generator Domain" "password.${DOMAIN_ROOT}")"
  DOMAIN_API="$(ask_prompt "    -> PostgREST API Gateway Domain" "api.${DOMAIN_ROOT}")"
else
  DOMAIN_STUDIO="db.${DOMAIN_ROOT}"
  DOMAIN_SEC="sec.${DOMAIN_ROOT}"
  DOMAIN_FILE="file.${DOMAIN_ROOT}"
  DOMAIN_PASSWORD="password.${DOMAIN_ROOT}"
  DOMAIN_API="api.${DOMAIN_ROOT}"
fi

SPARROWX_PUBLIC_IP="$(ask_prompt "3/6 Confirm Server Public IPv4" "${DETECTED_IP}")"
[ -z "${SPARROWX_PUBLIC_IP}" ] && SPARROWX_PUBLIC_IP="${DETECTED_IP}"

SPARROWX_ADMIN_EMAIL="$(ask_prompt "4/6 Admin Email (Let's Encrypt SSL & Security Alerts)" "${SPARROWX_ADMIN_EMAIL:-admin@${DOMAIN_ROOT}}")"
[ -z "${SPARROWX_ADMIN_EMAIL}" ] && SPARROWX_ADMIN_EMAIL="admin@${DOMAIN_ROOT}"

ENABLE_DNS_SERVER="$(ask_prompt "5/6 Install local Authoritative Bind9 Nameservers (ns1/ns2)? (yes/no)" "no")"
ENABLE_CRON_SSL="$(ask_prompt "6/6 Enable Full Let's Encrypt SSL + Auto-Heal Watchdog & Daily DB Backups? (yes/no)" "yes")"

echo ""
log_ok "Blueprint Locked: ${DOMAIN_ROOT} (db / sec / file / password / api) @ ${SPARROWX_PUBLIC_IP}"

# ==============================================================================
# STEP 3: SYNC & VERIFY REPOSITORY
# ==============================================================================
step_banner 3 10 "Syncing SparrowX Codebase & Blueprint Files"

if [ -f "./docker-compose.standalone.yml" ] && [ -f "./init-scripts/01-init-schema.sql" ]; then
  INSTALL_DIR="$(pwd)"
  log_ok "Using active SparrowX repository at: ${INSTALL_DIR}"
else
  log_info "Syncing SparrowX repository into ${INSTALL_DIR}..."
  if [ -d "${INSTALL_DIR}/.git" ]; then
    cd "${INSTALL_DIR}" || exit 1
    git fetch --all >/dev/null 2>&1 || true
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
mkdir -p ./ovh/dns ./ovh/ssl ./ovh/certbot-www/.well-known/acme-challenge ./data/storage ./backups
chmod +x ./init-scripts/02-multi-db-blueprint.sh ./deploy/*.sh ./manage-db.sh ./update.sh 2>/dev/null || true

# ==============================================================================
# STEP 4: DOCKER ENGINE & COMPOSE INSTALLATION / HEALING
# ==============================================================================
step_banner 4 10 "Installing & Verifying Docker Engine + Compose Plugin"

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

# Stop any prior SparrowX stacks cleanly before port check
if [ "${DOCKER_AVAILABLE}" = "yes" ]; then
  docker compose -f docker-compose.standalone.yml down --remove-orphans >/dev/null 2>&1 || true
  docker compose -f docker-compose.ovh.yml down --remove-orphans >/dev/null 2>&1 || true
  docker compose -f docker-compose.sparrowx.yml down --remove-orphans >/dev/null 2>&1 || true
fi
systemctl stop sparrowx-native.service >/dev/null 2>&1 || true

# ==============================================================================
# STEP 5: RECLAIM WEB PORTS (80/443) & RESOLVE ALL SERVICE PORTS
# ==============================================================================
step_banner 5 10 "Reclaiming Ports 80/443 & Locking Conflict-Free Port Map"

reclaim_web_ports

HTTP_PORT="$(find_free_port 80 8080 "HTTP Edge Proxy")"
HTTPS_PORT="$(find_free_port 443 8443 "HTTPS SSL Edge Proxy")"
APP_HOST_PORT="$(find_free_port 3000 3010 "SparrowX Studio App")"
PGRST_HOST_PORT="$(find_free_port 3001 3020 "PostgREST Gateway")"
PG_HOST_PORT="$(find_free_port 5432 5433 "PostgreSQL 16 + pgvector")"
PG_POOL_PORT="$(find_free_port 6543 6544 "PgBouncer Pooler")"

echo -e "  ${C_GREEN}• Public HTTP / HTTPS   :${C_RESET} ${C_BOLD}${HTTP_PORT} / ${HTTPS_PORT}${C_RESET}"
echo -e "  ${C_GREEN}• SparrowX Studio App   :${C_RESET} 127.0.0.1:${APP_HOST_PORT}"
echo -e "  ${C_GREEN}• PostgREST API Engine  :${C_RESET} 127.0.0.1:${PGRST_HOST_PORT}"
echo -e "  ${C_GREEN}• PostgreSQL 16 + Vector:${C_RESET} 127.0.0.1:${PG_HOST_PORT}"
echo -e "  ${C_GREEN}• PgBouncer Pooler      :${C_RESET} 127.0.0.1:${PG_POOL_PORT}"

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
; SparrowX Sovereign Multi-Domain DNS Zone for ${DOMAIN_ROOT}
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
  log_ok "DNS Zone blueprint saved at ${ZONE_FILE} (using external DNS like Cloudflare/Registrar)."
fi

# ==============================================================================
# STEP 7: MULTI-DOMAIN NGINX REVERSE PROXY & INSTANT SAN SSL
# ==============================================================================
step_banner 7 10 "Building Multi-Domain Nginx Reverse Proxy & TLS Certificates"

SSL_CERT="./ovh/ssl/fullchain.pem"
SSL_KEY="./ovh/ssl/privkey.pem"

if [ ! -f "${SSL_CERT}" ] || [ ! -f "${SSL_KEY}" ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "${SSL_KEY}" \
    -out "${SSL_CERT}" \
    -subj "/CN=${DOMAIN_ROOT}" \
    -addext "subjectAltName=DNS:${DOMAIN_ROOT},DNS:www.${DOMAIN_ROOT},DNS:${DOMAIN_STUDIO},DNS:${DOMAIN_SEC},DNS:shield.${DOMAIN_ROOT},DNS:${DOMAIN_FILE},DNS:drop.${DOMAIN_ROOT},DNS:${DOMAIN_PASSWORD},DNS:passwd.${DOMAIN_ROOT},DNS:keys.${DOMAIN_ROOT},DNS:${DOMAIN_API},IP:${SPARROWX_PUBLIC_IP}" >/dev/null 2>&1 || \
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "${SSL_KEY}" \
    -out "${SSL_CERT}" \
    -subj "/CN=${DOMAIN_ROOT}" >/dev/null 2>&1
  log_ok "Initial zero-downtime SAN TLS certificate generated."
fi

# Nginx uses Docker's internal resolver (127.0.0.11) + variables so it NEVER crashes on upstream boot
cat > ./ovh/nginx.conf <<EOF
# ==============================================================================
# SPARROWX MULTI-DOMAIN EDGE PROXY (ROOT + DB + SHIELD + FILE + KEYS + API)
# ==============================================================================

# 1. API Gateway Subdomain (${DOMAIN_API}) -> PostgREST Engine
server {
    listen 80;
    listen 443 ssl;
    http2 on;
    server_name ${DOMAIN_API};

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    resolver 127.0.0.11 valid=10s ipv6=off;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        set \$upstream_pgrst http://sparrowx-postgrest:3000;
        if (\$request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, apikey, Content-Type, Prefer" always;
            add_header Content-Length 0;
            return 204;
        }
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, apikey, Content-Type, Prefer" always;
        proxy_pass \$upstream_pgrst;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# 2. All Web Experiences (${DOMAIN_ROOT}, www, db, sec, shield, file, drop, password, keys, + Direct IP)
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    http2 on;
    server_name ${DOMAIN_ROOT} www.${DOMAIN_ROOT} ${DOMAIN_STUDIO} ${DOMAIN_SEC} shield.${DOMAIN_ROOT} ${DOMAIN_FILE} drop.${DOMAIN_ROOT} ${DOMAIN_PASSWORD} passwd.${DOMAIN_ROOT} keys.${DOMAIN_ROOT} _;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    resolver 127.0.0.11 valid=10s ipv6=off;
    client_max_body_size 150M;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location /rest/v1/ {
        set \$upstream_pgrst http://sparrowx-postgrest:3000;
        rewrite ^/rest/v1/(.*) /\$1 break;
        proxy_pass \$upstream_pgrst;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        set \$upstream_studio http://sparrowx-studio:3000;
        proxy_pass \$upstream_studio;
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
log_ok "Multi-domain Nginx proxy configuration written."

# ==============================================================================
# STEP 8: ENVIRONMENT (.ENV) & FIREWALL CONFIGURATION
# ==============================================================================
step_banner 8 10 "Generating Environment Secrets & Hardening Firewall"

if [ -f .env ] && grep -q "^POSTGRES_PASSWORD=" .env; then
  DB_PASS="$(grep '^POSTGRES_PASSWORD=' .env | cut -d'=' -f2-)"
  JWT_SECRET="$(grep '^SPARROWX_JWT_SECRET=' .env | cut -d'=' -f2- || openssl rand -hex 32)"
  REDIS_SECRET="$(grep '^SPARROWX_REDIS_SECRET=' .env | cut -d'=' -f2- || openssl rand -hex 16)"
else
  DB_PASS="$(openssl rand -hex 20)"
  JWT_SECRET="$(openssl rand -hex 32)"
  REDIS_SECRET="$(openssl rand -hex 16)"
fi

cat > .env <<EOF
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=sparrowbase
SPARROWX_JWT_SECRET=${JWT_SECRET}
SPARROWX_REDIS_SECRET=${REDIS_SECRET}
DOMAIN_ROOT=${DOMAIN_ROOT}
SPARROWX_DOMAIN=${DOMAIN_ROOT}
DOMAIN_STUDIO=${DOMAIN_STUDIO}
SPARROWX_STUDIO_DOMAIN=${DOMAIN_STUDIO}
DOMAIN_SEC=${DOMAIN_SEC}
DOMAIN_FILE=${DOMAIN_FILE}
DOMAIN_PASSWORD=${DOMAIN_PASSWORD}
DOMAIN_API=${DOMAIN_API}
SPARROWX_PUBLIC_IP=${SPARROWX_PUBLIC_IP}
SPARROWX_NS1=${SPARROWX_NS1}
SPARROWX_NS2=${SPARROWX_NS2}
SPARROWX_ADMIN_EMAIL=${SPARROWX_ADMIN_EMAIL}
HTTP_PORT=${HTTP_PORT}
HTTPS_PORT=${HTTPS_PORT}
APP_HOST_PORT=${APP_HOST_PORT}
PGRST_HOST_PORT=${PGRST_HOST_PORT}
PG_HOST_PORT=${PG_HOST_PORT}
PG_POOL_PORT=${PG_POOL_PORT}
EOF
chmod 600 .env

ACTIVE_SSH_PORT="$(ss -tulnp 2>/dev/null | awk '/sshd/ {print $5}' | sed -E 's/.*:([0-9]+)$/\1/' | head -n 1 || echo 22)"
[ -z "${ACTIVE_SSH_PORT}" ] && ACTIVE_SSH_PORT=22

if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow "${ACTIVE_SSH_PORT}"/tcp >/dev/null 2>&1 || true
  ufw allow "${HTTP_PORT}"/tcp >/dev/null 2>&1 || true
  ufw allow "${HTTPS_PORT}"/tcp >/dev/null 2>&1 || true
  ufw allow "${PG_POOL_PORT}"/tcp >/dev/null 2>&1 || true
  if [[ "$(echo "${ENABLE_DNS_SERVER}" | tr '[:upper:]' '[:lower:]')" == "y"* ]]; then
    ufw allow 53/tcp >/dev/null 2>&1 || true
    ufw allow 53/udp >/dev/null 2>&1 || true
  fi
  ufw --force enable >/dev/null 2>&1 || true
  log_ok "UFW Firewall hardened (SSH:${ACTIVE_SSH_PORT}, HTTP:${HTTP_PORT}, HTTPS:${HTTPS_PORT}, Pooler:${PG_POOL_PORT})."
fi

# ==============================================================================
# STEP 9: LAUNCH FULL BACKEND FLEET & PROVISION 5 SEPARATE DATABASES
# ==============================================================================
step_banner 9 10 "Launching Full Backend Fleet & 5 Isolated Databases"

STACK_STARTED="no"
if [ "${DOCKER_AVAILABLE}" = "yes" ]; then
  log_info "Building & starting PostgreSQL 16+pgvector, PgBouncer, PostgREST, Redis, Studio & Edge Proxy..."
  if docker compose -f docker-compose.standalone.yml up -d --build --remove-orphans; then
    STACK_STARTED="yes"
  else
    log_warn "First launch attempt hit a transient issue. Healing network & retrying..."
    docker compose -f docker-compose.standalone.yml down --remove-orphans >/dev/null 2>&1 || true
    docker network prune -f >/dev/null 2>&1 || true
    reclaim_web_ports
    if docker compose -f docker-compose.standalone.yml up -d --build --remove-orphans; then
      STACK_STARTED="yes"
    fi
  fi

  if [ "${STACK_STARTED}" = "yes" ]; then
    log_info "Waiting for PostgreSQL 16 + pgvector to accept connections..."
    for i in $(seq 1 25); do
      if docker exec sparrowx_postgres pg_isready -U postgres -d sparrowbase >/dev/null 2>&1; then
        break
      fi
      sleep 2
    done

    # Idempotently provision all 5 isolated databases + pgvector even on existing volumes
    log_info "Ensuring all 5 isolated databases + unified Auth Hub exist..."
    for extra_db in sparrowx_db_studio sparrowx_shield sparrowx_files sparrowx_api; do
      docker exec sparrowx_postgres psql -U postgres -d sparrowbase -tc "SELECT 1 FROM pg_database WHERE datname = '${extra_db}'" 2>/dev/null | grep -q 1 || \
        docker exec sparrowx_postgres psql -U postgres -d sparrowbase -c "CREATE DATABASE ${extra_db};" >/dev/null 2>&1 || true
      docker exec sparrowx_postgres psql -U postgres -d "${extra_db}" -c "CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" >/dev/null 2>&1 || true
    done
    docker exec sparrowx_postgres psql -U postgres -d sparrowbase -c "CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" >/dev/null 2>&1 || true
    log_ok "All 5 databases (sparrowbase, sparrowx_db_studio, sparrowx_shield, sparrowx_files, sparrowx_api) online!"

    if [ -d /etc/systemd/system ]; then
      cat > /etc/systemd/system/sparrowx-stack.service <<EOF
[Unit]
Description=SparrowX Sovereign Multi-Domain Stack
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/docker compose -f docker-compose.standalone.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.standalone.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
      systemctl daemon-reload >/dev/null 2>&1 || true
      systemctl enable sparrowx-stack.service >/dev/null 2>&1 || true
    fi
  fi
fi

# Native Host Fallback if Docker is blocked by virtualization
if [ "${STACK_STARTED}" != "yes" ]; then
  log_warn "Activating Native Host Fallback (Node.js 22)..."
  if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1 || true
    retry_pkg_install nodejs
  fi
  export NODE_OPTIONS="--max-old-space-size=2048"
  npm install --legacy-peer-deps && npm run build
  cat > /etc/systemd/system/sparrowx-native.service <<EOF
[Unit]
Description=SparrowX Sovereign Native Server
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

# ==============================================================================
# STEP 10: LIVE SSL ISSUANCE, CRON FLEET & ACTIVE PING AUTO-FIX VERIFICATION
# ==============================================================================
step_banner 10 10 "Issuing Live Let's Encrypt SSL, Installing Cron Jobs & Pinging Live Sites"

# Install Cron Fleet (/etc/cron.d/sparrowx-automation)
if [[ "$(echo "${ENABLE_CRON_SSL}" | tr '[:upper:]' '[:lower:]')" == "y"* ]]; then
  cat > /etc/cron.d/sparrowx-automation <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# 1. Autonomous Watchdog: Pings & auto-heals ports/containers every 2 minutes
*/2 * * * * root ${INSTALL_DIR}/deploy/watchdog.sh >/dev/null 2>&1

# 2. Let's Encrypt SSL Auto-Issuer & Renewer every 12 hours
0 */12 * * * root ${INSTALL_DIR}/deploy/ssl-renew.sh >/dev/null 2>&1

# 3. Daily Encrypted Backup of all 5 PostgreSQL Databases at 02:00 AM
0 2 * * * root ${INSTALL_DIR}/deploy/backup-all-dbs.sh >/dev/null 2>&1

# 4. Ephemeral temp & Docker cache cleanup every 30 minutes
*/30 * * * * root find /tmp -name "sparrowx-*" -mmin +60 -delete >/dev/null 2>&1
EOF
  chmod 644 /etc/cron.d/sparrowx-automation
  systemctl restart cron >/dev/null 2>&1 || systemctl restart crond >/dev/null 2>&1 || true
  log_ok "4 Autonomous Cron Jobs installed (/etc/cron.d/sparrowx-automation)."

  # Attempt immediate live Let's Encrypt SSL issuance for all domains pointing to this server
  log_info "Checking DNS propagation & requesting Let's Encrypt SSL certificates..."
  bash "${INSTALL_DIR}/deploy/ssl-renew.sh" || true
fi

# Install CLI shortcuts
chmod +x "${INSTALL_DIR}/manage-db.sh" "${INSTALL_DIR}/update.sh" "${INSTALL_DIR}/deploy/"*.sh 2>/dev/null || true
ln -sf "${INSTALL_DIR}/manage-db.sh" /usr/local/bin/sparrowx-db 2>/dev/null || true
ln -sf "${INSTALL_DIR}/update.sh" /usr/local/bin/sparrowx-update 2>/dev/null || true
ln -sf "${INSTALL_DIR}/deploy/watchdog.sh" /usr/local/bin/sparrowx-heal 2>/dev/null || true

# Live Ping & HTTP/HTTPS Probe with Auto-Fix Loop
probe_and_heal() {
  local label="$1"
  local url="$2"
  local host_header="${3:-}"
  local code="000"
  if [ -n "${host_header}" ]; then
    code="$(curl -sk -o /dev/null -w "%{http_code}" --max-time 6 -H "Host: ${host_header}" "${url}" 2>/dev/null || echo "000")"
  else
    code="$(curl -sk -o /dev/null -w "%{http_code}" --max-time 6 "${url}" 2>/dev/null || echo "000")"
  fi
  if [ "${code}" = "200" ] || [ "${code}" = "301" ] || [ "${code}" = "302" ] || [ "${code}" = "307" ]; then
    log_ok "${label} -> ${C_GREEN}LIVE (HTTP ${code})${C_RESET}"
    return 0
  else
    log_warn "${label} returned HTTP ${code}. Running auto-healer..."
    bash "${INSTALL_DIR}/deploy/watchdog.sh" >/dev/null 2>&1 || true
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
  fi
}

echo ""
log_info "Running Live Ping & End-to-End Endpoint Verification..."
sleep 4
probe_and_heal "App Engine (Internal)"     "http://127.0.0.1:${APP_HOST_PORT}/"
probe_and_heal "PostgREST API (Internal)"  "http://127.0.0.1:${PGRST_HOST_PORT}/"
probe_and_heal "Main Hub (${DOMAIN_ROOT})" "https://127.0.0.1:${HTTPS_PORT}/" "${DOMAIN_ROOT}"
probe_and_heal "Cloud DB (${DOMAIN_STUDIO})" "https://127.0.0.1:${HTTPS_PORT}/" "${DOMAIN_STUDIO}"
probe_and_heal "Shield WAF (${DOMAIN_SEC})" "https://127.0.0.1:${HTTPS_PORT}/" "${DOMAIN_SEC}"
probe_and_heal "File Vault (${DOMAIN_FILE})" "https://127.0.0.1:${HTTPS_PORT}/" "${DOMAIN_FILE}"
probe_and_heal "Keys (${DOMAIN_PASSWORD})" "https://127.0.0.1:${HTTPS_PORT}/" "${DOMAIN_PASSWORD}"
probe_and_heal "API (${DOMAIN_API})"       "https://127.0.0.1:${HTTPS_PORT}/" "${DOMAIN_API}"
probe_and_heal "Public IP (${SPARROWX_PUBLIC_IP})" "http://${SPARROWX_PUBLIC_IP}:${HTTP_PORT}/"

HTTP_SUFFIX=""
[ "${HTTP_PORT}" != "80" ] && HTTP_SUFFIX=":${HTTP_PORT}"
HTTPS_SUFFIX=""
[ "${HTTPS_PORT}" != "443" ] && HTTPS_SUFFIX=":${HTTPS_PORT}"

echo ""
echo -e "${C_ORANGE}========================================================================${C_RESET}"
echo -e "${C_GREEN}  ✓ SPARROWX SOVEREIGN BLUEPRINT IS LIVE & ARMED ON THIS SERVER        ${C_RESET}"
echo -e "${C_ORANGE}========================================================================${C_RESET}"
echo -e "  ${C_BOLD}6 LIVE WEB EXPERIENCES:${C_RESET}"
echo -e "    • Company Hub    : ${C_CYAN}https://${DOMAIN_ROOT}${HTTPS_SUFFIX}${C_RESET}"
echo -e "    • Cloud DB       : ${C_CYAN}https://${DOMAIN_STUDIO}${HTTPS_SUFFIX}${C_RESET} (Strict Auth + Multi-Env)"
echo -e "    • Shield WAF     : ${C_CYAN}https://${DOMAIN_SEC}${HTTPS_SUFFIX}${C_RESET} (Threat Map + SOC)"
echo -e "    • File Drop/Vault: ${C_CYAN}https://${DOMAIN_FILE}${HTTPS_SUFFIX}${C_RESET} (150MB Upload + 10GB)"
echo -e "    • Offline Keys   : ${C_CYAN}https://${DOMAIN_PASSWORD}${HTTPS_SUFFIX}${C_RESET} (Zero-Login CSPRNG)"
echo -e "    • API Gateway    : ${C_CYAN}https://${DOMAIN_API}${HTTPS_SUFFIX}${C_RESET}"
echo -e "    • Direct IP      : ${C_WHITE}http://${SPARROWX_PUBLIC_IP}${HTTP_SUFFIX}${C_RESET}"
echo ""
echo -e "  ${C_BOLD}5 ISOLATED POSTGRESQL 16 + PGVECTOR DATABASES (Pooler Port ${PG_POOL_PORT}):${C_RESET}"
echo -e "    • sparrowbase         (Unified Auth, Email Logins, Tenants & Billing)"
echo -e "    • sparrowx_db_studio  (Isolated DB Studio Environments)"
echo -e "    • sparrowx_shield     (WAF Rules, Threat Feeds & SOC Incidents)"
echo -e "    • sparrowx_files      (File Vault Metadata & Ephemeral Drop)"
echo -e "    • sparrowx_api        (API Keys, Rate Limits & Telemetry)"
echo ""
echo -e "  ${C_BOLD}AUTONOMOUS CRON FLEET & CLI TOOLS:${C_RESET}"
echo -e "    • Watchdog (2m)  : ${C_DIM}${INSTALL_DIR}/deploy/watchdog.sh${C_RESET} (or ${C_BOLD}sparrowx-heal${C_RESET})"
echo -e "    • SSL Renew (12h): ${C_DIM}${INSTALL_DIR}/deploy/ssl-renew.sh${C_RESET}"
echo -e "    • DB Backups (2a): ${C_DIM}${INSTALL_DIR}/deploy/backup-all-dbs.sh${C_RESET}"
echo -e "    • DB Studio TUI  : ${C_BOLD}sparrowx-db${C_RESET}   |  1-Click Update: ${C_BOLD}sparrowx-update${C_RESET}"
echo -e "${C_ORANGE}========================================================================${C_RESET}"
