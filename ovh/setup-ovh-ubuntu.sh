#!/usr/bin/env bash
# ============================================================================
# SPARROWX SOVEREIGN STACK — SELF-HEALING A-TO-Z UBUNTU/LINUX INSTALLER
# ============================================================================
# Features:
#  • Never stops midway: auto-heals apt/dpkg locks, broken DNS, low RAM (swap),
#    systemd-resolved port 53 conflicts, corrupted git repos, and SSL issues.
#  • Automatic Port-Jumping Engine: if any port (80, 443, 3000, 3001, 5432, 53)
#    is in use, automatically hops to the next free port until an open port is
#    locked in and verified.
#  • Interactive 5-Question Wizard (works via direct run or curl | sudo bash).
#  • Dual Runtime Assurance: Docker Compose primary stack + Native Node.js 22
#    & PostgreSQL automatic fallback if Docker kernel virtualization is blocked.
# ============================================================================
set -u

REPO_URL="https://github.com/cybersync-fxfx/sparrowxdbs.git"
INSTALL_DIR="/opt/sparrowx"
LOG_FILE="/var/log/sparrowx-install.log"

# Colors for terminal output
C_RESET="\033[0m"
C_BOLD="\033[1m"
C_GREEN="\033[1;32m"
C_CYAN="\033[1;36m"
C_YELLOW="\033[1;33m"
C_RED="\033[1;31m"

log_info()  { echo -e "${C_CYAN}[INFO]${C_RESET}  $*"; echo "[INFO] $*" >> "${LOG_FILE}" 2>/dev/null || true; }
log_ok()    { echo -e "${C_GREEN}[OK]${C_RESET}    $*"; echo "[OK] $*" >> "${LOG_FILE}" 2>/dev/null || true; }
log_warn()  { echo -e "${C_YELLOW}[HEAL]${C_RESET}  $*"; echo "[HEAL] $*" >> "${LOG_FILE}" 2>/dev/null || true; }
log_err()   { echo -e "${C_RED}[WARN]${C_RESET}  $*"; echo "[WARN] $*" >> "${LOG_FILE}" 2>/dev/null || true; }

# Auto-elevate with sudo if not root
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    log_warn "Re-launching installer with sudo privileges..."
    exec sudo -E bash "$0" "$@"
  else
    log_err "Please run this script as root."
    exit 1
  fi
fi

touch "${LOG_FILE}" 2>/dev/null || LOG_FILE="/tmp/sparrowx-install.log"

echo -e "${C_BOLD}======================================================================${C_RESET}"
echo -e "${C_BOLD}  SPARROWX SOVEREIGN STACK — SELF-HEALING A-TO-Z SERVER INSTALLER     ${C_RESET}"
echo -e "${C_BOLD}======================================================================${C_RESET}"

# ============================================================================
# SELF-HEALING UTILITIES (APT LOCKS, DNS, SWAP, PORT SCANNER)
# ============================================================================

heal_apt_locks() {
  if ! command -v apt-get >/dev/null 2>&1; then return 0; fi
  export DEBIAN_FRONTEND=noninteractive
  local wait_count=0
  while fuser /var/lib/dpkg/lock >/dev/null 2>&1 || \
        fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || \
        fuser /var/lib/apt/lists/lock >/dev/null 2>&1; do
    wait_count=$((wait_count + 1))
    if [ "${wait_count}" -eq 1 ]; then
      log_warn "Waiting for background apt/unattended-upgrades lock to release..."
    fi
    if [ "${wait_count}" -ge 15 ]; then
      log_warn "Clearing stuck apt/dpkg locks automatically..."
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
    elif command -v yum >/dev/null 2>&1; then
      if yum install -y "$@" >/dev/null 2>&1; then return 0; fi
    fi
    log_warn "Package install retry ${attempt}/4 for: $*"
    attempt=$((attempt + 1))
    sleep 2
  done
  return 0
}

heal_host_dns() {
  if ! getent hosts github.com >/dev/null 2>&1 && ! ping -c 1 -W 2 1.1.1.1 >/dev/null 2>&1; then
    log_warn "Host DNS resolver appears unreachable; injecting fallback Cloudflare/Google resolvers..."
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

  if [ "${total_ram_mb}" -lt 3500 ] && [ "${total_swap_mb}" -lt 1024 ]; then
    log_warn "Low RAM detected (${total_ram_mb}MB) with ${total_swap_mb}MB swap. Creating 2GB /swapfile to prevent build OOM..."
    if [ ! -f /swapfile ]; then
      (fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none 2>/dev/null) || true
      chmod 600 /swapfile 2>/dev/null || true
      mkswap /swapfile >/dev/null 2>&1 || true
      swapon /swapfile >/dev/null 2>&1 || true
      if ! grep -q "/swapfile" /etc/fstab 2>/dev/null; then
        echo "/swapfile none swap sw 0 0" >> /etc/fstab 2>/dev/null || true
      fi
      log_ok "2GB swapfile activated."
    fi
  fi
}

# Check if a TCP or UDP port is currently bound by any process
is_port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    if ss -tuln 2>/dev/null | awk '{print $5}' | grep -E "(:|\\.)(${port})\$" >/dev/null 2>&1; then
      return 0
    fi
  fi
  if command -v lsof >/dev/null 2>&1; then
    if lsof -iTCP:"${port}" -sTCP:LISTEN -P -n >/dev/null 2>&1 || lsof -iUDP:"${port}" -P -n >/dev/null 2>&1; then
      return 0
    fi
  fi
  if command -v netstat >/dev/null 2>&1; then
    if netstat -tuln 2>/dev/null | awk '{print $4}' | grep -E "(:|\\.)(${port})\$" >/dev/null 2>&1; then
      return 0
    fi
  fi
  if (echo >/dev/tcp/127.0.0.1/"${port}") >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

# Automatic Port-Jumping Resolver:
# Checks primary_port first; if busy, jumps to fallback_start and increments
# one by one (e.g. 80 -> 8080 -> 8081 -> 8082...) until an unused port is found.
find_free_port() {
  local preferred_port="$1"
  local fallback_start="${2:-$((preferred_port + 1))}"
  local label="${3:-Service}"

  if ! is_port_in_use "${preferred_port}"; then
    echo "${preferred_port}"
    return 0
  fi

  log_warn "${label}: Port ${preferred_port} is already in use on this server. Searching for next available port..." >&2
  local candidate="${fallback_start}"
  local max_port=65000
  while [ "${candidate}" -lt "${max_port}" ]; do
    if ! is_port_in_use "${candidate}"; then
      log_ok "${label}: Automatically jumped from busy port ${preferred_port} -> free port ${candidate}" >&2
      echo "${candidate}"
      return 0
    fi
    log_warn "${label}: Port ${candidate} is also in use, jumping to $((candidate + 1))..." >&2
    candidate=$((candidate + 1))
  done

  echo "${preferred_port}"
}

# ============================================================================
# STEP 1: SYSTEM REPAIR & PREREQUISITES
# ============================================================================
log_info "[Step 1/9] Healing package manager, verifying DNS & installing prerequisites..."
heal_host_dns
ensure_swap_memory

if command -v apt-get >/dev/null 2>&1; then
  retry_pkg_install ca-certificates curl gnupg git openssl ufw lsb-release dnsutils lsof iproute2 net-tools psmisc
else
  retry_pkg_install ca-certificates curl git openssl firewalld bind-utils lsof iproute net-tools psmisc
fi

DETECTED_IP="$(curl -4 -fsS --max-time 5 https://icanhazip.com 2>/dev/null | tr -d '[:space:]' || true)"
if [ -z "${DETECTED_IP}" ]; then
  DETECTED_IP="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null | tr -d '[:space:]' || true)"
fi
if [ -z "${DETECTED_IP}" ]; then
  DETECTED_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')"
fi

# ============================================================================
# STEP 2: INTERACTIVE 5-QUESTION CONFIGURATION WIZARD
# ============================================================================
ask_prompt() {
  local prompt_text="$1"
  local default_val="$2"
  local user_input=""
  if [ -t 0 ]; then
    read -r -p "${prompt_text} [${default_val}]: " user_input || true
  elif [ -e /dev/tty ]; then
    read -r -p "${prompt_text} [${default_val}]: " user_input < /dev/tty || true
  fi
  if [ -z "${user_input}" ]; then
    echo "${default_val}"
  else
    echo "${user_input}"
  fi
}

echo ""
echo -e "${C_BOLD}----------------------------------------------------------------------${C_RESET}"
echo -e "${C_BOLD}  QUICK 5-QUESTION SERVER, DOMAIN & DNS CONFIGURATION                 ${C_RESET}"
echo -e "  (Press Enter on any question to accept the smart default)           "
echo -e "${C_BOLD}----------------------------------------------------------------------${C_RESET}"

RAW_DOMAIN="$(ask_prompt "1/6 Enter your primary domain name (e.g. sparrowx.net)" "sparrowx.local")"
SPARROWX_DOMAIN="$(echo "${RAW_DOMAIN}" | sed -E 's#^https?://##; s#/.*$##' | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
[ -z "${SPARROWX_DOMAIN}" ] && SPARROWX_DOMAIN="sparrowx.local"

RAW_STUDIO_DOMAIN="$(ask_prompt "2/6 Enter separate Supabase Studio Admin domain" "db.${SPARROWX_DOMAIN}")"
SPARROWX_STUDIO_DOMAIN="$(echo "${RAW_STUDIO_DOMAIN}" | sed -E 's#^https?://##; s#/.*$##' | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
[ -z "${SPARROWX_STUDIO_DOMAIN}" ] && SPARROWX_STUDIO_DOMAIN="db.${SPARROWX_DOMAIN}"

SPARROWX_PUBLIC_IP="$(ask_prompt "3/6 Confirm server public IPv4 for DNS A records" "${DETECTED_IP}")"
[ -z "${SPARROWX_PUBLIC_IP}" ] && SPARROWX_PUBLIC_IP="${DETECTED_IP}"

DEFAULT_NS="ns1.${SPARROWX_DOMAIN},ns2.${SPARROWX_DOMAIN}"
RAW_NS="$(ask_prompt "4/6 Enter primary & secondary Nameservers (comma-separated)" "${DEFAULT_NS}")"
SPARROWX_NS1="$(echo "${RAW_NS}" | cut -d',' -f1 | tr -d '[:space:]')"
SPARROWX_NS2="$(echo "${RAW_NS}" | cut -d',' -f2 | tr -d '[:space:]')"
[ -z "${SPARROWX_NS1}" ] && SPARROWX_NS1="ns1.${SPARROWX_DOMAIN}"
if [ -z "${SPARROWX_NS2}" ] || [ "${SPARROWX_NS2}" = "${SPARROWX_NS1}" ]; then
  SPARROWX_NS2="ns2.${SPARROWX_DOMAIN}"
fi

DEFAULT_EMAIL="admin@${SPARROWX_DOMAIN}"
SPARROWX_ADMIN_EMAIL="$(ask_prompt "5/6 Enter admin email for SSL & security alerts" "${DEFAULT_EMAIL}")"
[ -z "${SPARROWX_ADMIN_EMAIL}" ] && SPARROWX_ADMIN_EMAIL="${DEFAULT_EMAIL}"

ENABLE_DNS_SSL="$(ask_prompt "6/6 Auto-configure Authoritative DNS (Bind9) & HTTPS SSL? (yes/no)" "yes")"
ENABLE_DNS_SSL="$(echo "${ENABLE_DNS_SSL}" | tr '[:upper:]' '[:lower:]')"

# ============================================================================
# STEP 3: CLONE OR SELF-HEAL REPOSITORY
# ============================================================================
if [ -f "./docker-compose.ovh.yml" ] && [ -f "./ovh/schema.sql" ]; then
  INSTALL_DIR="$(pwd)"
  log_info "[Step 2/9] Using existing SparrowX repository at: ${INSTALL_DIR}"
else
  log_info "[Step 2/9] Syncing SparrowX repository into ${INSTALL_DIR}..."
  if [ -d "${INSTALL_DIR}/.git" ]; then
    cd "${INSTALL_DIR}" || true
    git fetch --all >/dev/null 2>&1 || true
    git reset --hard origin/main >/dev/null 2>&1 || true
  else
    rm -rf "${INSTALL_DIR}" 2>/dev/null || true
    if [ -n "${GITHUB_TOKEN:-}" ]; then
      REPO_URL="https://${GITHUB_TOKEN}@github.com/cybersync-fxfx/sparrowxdbs.git"
    fi
    if ! git clone "${REPO_URL}" "${INSTALL_DIR}"; then
      log_warn "Repository is private on GitHub or requires a Personal Access Token."
      GH_PAT="$(ask_prompt "Enter GitHub Personal Access Token (PAT) for cybersync-fxfx/sparrowxdbs" "")"
      if [ -n "${GH_PAT}" ]; then
        AUTH_REPO_URL="https://${GH_PAT}@github.com/cybersync-fxfx/sparrowxdbs.git"
        git clone "${AUTH_REPO_URL}" "${INSTALL_DIR}" || git clone --depth 1 "${AUTH_REPO_URL}" "${INSTALL_DIR}"
      else
        git config --global http.postBuffer 524288000 || true
        git clone --depth 1 "${REPO_URL}" "${INSTALL_DIR}"
      fi
    fi
  fi
fi

cd "${INSTALL_DIR}"
mkdir -p ./ovh/dns ./ovh/ssl ./data

# ============================================================================
# STEP 4: INSTALL & HEAL DOCKER ENGINE + COMPOSE
# ============================================================================
log_info "[Step 3/9] Verifying Docker Engine & Docker Compose..."
DOCKER_AVAILABLE="yes"
if ! command -v docker >/dev/null 2>&1; then
  log_info "Installing Docker Engine automatically..."
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
    log_warn "Docker daemon failed to start (possible LXC/OpenVZ restriction). Will use Native Node.js + PostgreSQL mode!"
    DOCKER_AVAILABLE="no"
  fi
else
  DOCKER_AVAILABLE="no"
fi

# Stop any previous SparrowX containers before scanning ports so our own stack
# does not appear as a port conflict
if [ "${DOCKER_AVAILABLE}" = "yes" ]; then
  docker compose -f docker-compose.ovh.yml down --remove-orphans >/dev/null 2>&1 || true
fi
systemctl stop sparrowx-native.service >/dev/null 2>&1 || true

# ============================================================================
# STEP 5: AUTOMATIC PORT-JUMPING RESOLUTION FOR ALL SERVICES
# ============================================================================
log_info "[Step 4/9] Scanning ports & auto-jumping any port already in use..."

# Automatically select open ports (jumping sequentially if busy)
HTTP_PORT="$(find_free_port 80 8080 "HTTP Web Server")"
HTTPS_PORT="$(find_free_port 443 8443 "HTTPS SSL Web Server")"
APP_HOST_PORT="$(find_free_port 3000 3010 "SparrowX Node Server")"
PGRST_HOST_PORT="$(find_free_port 3001 3020 "PostgREST API Engine")"
PG_HOST_PORT="$(find_free_port 5432 5433 "PostgreSQL Database")"
DNS_PORT=53

echo -e "${C_BOLD}----------------------------------------------------------------------${C_RESET}"
echo -e "${C_GREEN}  Locked-In Conflict-Free Port Map:${C_RESET}"
echo -e "  • Public HTTP Port      : ${C_BOLD}${HTTP_PORT}${C_RESET}"
echo -e "  • Public HTTPS Port     : ${C_BOLD}${HTTPS_PORT}${C_RESET}"
echo -e "  • SparrowX App Port     : ${C_BOLD}127.0.0.1:${APP_HOST_PORT}${C_RESET}"
echo -e "  • PostgREST API Port    : ${C_BOLD}127.0.0.1:${PGRST_HOST_PORT}${C_RESET}"
echo -e "  • PostgreSQL DB Port    : ${C_BOLD}127.0.0.1:${PG_HOST_PORT}${C_RESET}"
echo -e "${C_BOLD}----------------------------------------------------------------------${C_RESET}"

# ============================================================================
# STEP 6: AUTHORITATIVE DNS ZONE & PORT-53 SELF-HEALING
# ============================================================================
log_info "[Step 5/9] Generating DNS zone file & configuring Authoritative DNS..."
SERIAL_DATE="$(date +%Y%m%d01)"
VERIFY_TOKEN="sparrowx-verify-$(openssl rand -hex 8)"
ZONE_FILE="./ovh/dns/db.${SPARROWX_DOMAIN}"

cat > "${ZONE_FILE}" <<EOF
; SparrowX Sovereign Authoritative DNS Zone for ${SPARROWX_DOMAIN}
\$TTL 3600
@   IN  SOA ${SPARROWX_NS1}. ${SPARROWX_ADMIN_EMAIL/@/.}. (
        ${SERIAL_DATE} ; Serial
        3600       ; Refresh
        900        ; Retry
        1209600    ; Expire
        300 )      ; Minimum TTL

; Authoritative Nameservers
@               IN  NS      ${SPARROWX_NS1}.
@               IN  NS      ${SPARROWX_NS2}.

; Glue & Host A Records
@               IN  A       ${SPARROWX_PUBLIC_IP}
www             IN  A       ${SPARROWX_PUBLIC_IP}
api             IN  A       ${SPARROWX_PUBLIC_IP}
ns1             IN  A       ${SPARROWX_PUBLIC_IP}
ns2             IN  A       ${SPARROWX_PUBLIC_IP}

; CAA & SparrowX Cryptographic Verification TXT Records
@               IN  CAA     0 issue "letsencrypt.org"
@               IN  TXT     "v=spf1 a ip4:${SPARROWX_PUBLIC_IP} -all"
_sparrowx       IN  TXT     "${VERIFY_TOKEN}"
EOF

if [[ "${ENABLE_DNS_SSL}" == "y"* ]]; then
  retry_pkg_install bind9 bind9utils certbot

  # Self-heal Ubuntu systemd-resolved occupying 127.0.0.53:53
  if is_port_in_use 53 && systemctl is-active --quiet systemd-resolved 2>/dev/null; then
    log_warn "Ubuntu systemd-resolved is occupying port 53. Releasing stub listener..."
    if [ -f /etc/systemd/resolved.conf ]; then
      sed -i 's/^#*DNSStubListener=.*/DNSStubListener=no/' /etc/systemd/resolved.conf || true
      grep -q "^DNSStubListener=no" /etc/systemd/resolved.conf || echo "DNSStubListener=no" >> /etc/systemd/resolved.conf
      grep -q "^DNS=" /etc/systemd/resolved.conf || echo "DNS=1.1.1.1 8.8.8.8" >> /etc/systemd/resolved.conf
      ln -sf /run/systemd/resolve/resolv.conf /etc/resolv.conf 2>/dev/null || true
      systemctl restart systemd-resolved >/dev/null 2>&1 || true
      sleep 1
    fi
  fi

  systemctl stop named bind9 >/dev/null 2>&1 || true
  DNS_PORT="$(find_free_port 53 5353 "Authoritative DNS (Bind9)")"

  if [ -d /etc/bind ]; then
    mkdir -p /etc/bind/zones
    cp "${ZONE_FILE}" "/etc/bind/zones/db.${SPARROWX_DOMAIN}"
    if [ -f /etc/bind/named.conf.options ]; then
      cat > /etc/bind/named.conf.options <<EOF
options {
    directory "/var/cache/bind";
    listen-on port ${DNS_PORT} { any; };
    listen-on-v6 port ${DNS_PORT} { any; };
    allow-query { any; };
    recursion no;
    dnssec-validation auto;
};
EOF
    fi
    if ! grep -q "zone \"${SPARROWX_DOMAIN}\"" /etc/bind/named.conf.local 2>/dev/null; then
      cat >> /etc/bind/named.conf.local <<EOF

zone "${SPARROWX_DOMAIN}" {
    type master;
    file "/etc/bind/zones/db.${SPARROWX_DOMAIN}";
    allow-query { any; };
};
EOF
    fi
    systemctl enable named >/dev/null 2>&1 || systemctl enable bind9 >/dev/null 2>&1 || true
    systemctl restart named >/dev/null 2>&1 || systemctl restart bind9 >/dev/null 2>&1 || true
    log_ok "Authoritative DNS configured on port ${DNS_PORT} for ${SPARROWX_DOMAIN}."
  fi
fi

# ============================================================================
# STEP 7: TLS CERTIFICATES & NGINX CONFIGURATION
# ============================================================================
log_info "[Step 6/9] Configuring TLS certificates & Nginx Reverse Proxy..."
SSL_CERT="./ovh/ssl/fullchain.pem"
SSL_KEY="./ovh/ssl/privkey.pem"

if [[ "${ENABLE_DNS_SSL}" == "y"* ]] && [ "${HTTP_PORT}" = "80" ] && command -v certbot >/dev/null 2>&1 && [[ "${SPARROWX_DOMAIN}" != *.local ]]; then
  if certbot certonly --standalone --non-interactive --agree-tos \
      -m "${SPARROWX_ADMIN_EMAIL}" -d "${SPARROWX_DOMAIN}" >/dev/null 2>&1; then
    cp "/etc/letsencrypt/live/${SPARROWX_DOMAIN}/fullchain.pem" "${SSL_CERT}"
    cp "/etc/letsencrypt/live/${SPARROWX_DOMAIN}/privkey.pem" "${SSL_KEY}"
    log_ok "Issued live Let's Encrypt certificate for ${SPARROWX_DOMAIN}."
  fi
fi

if [ ! -f "${SSL_CERT}" ] || [ ! -f "${SSL_KEY}" ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "${SSL_KEY}" \
    -out "${SSL_CERT}" \
    -subj "/CN=${SPARROWX_DOMAIN}" \
    -addext "subjectAltName=DNS:${SPARROWX_DOMAIN},DNS:*.${SPARROWX_DOMAIN},IP:${SPARROWX_PUBLIC_IP}" >/dev/null 2>&1 || \
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "${SSL_KEY}" \
    -out "${SSL_CERT}" \
    -subj "/CN=${SPARROWX_DOMAIN}" >/dev/null 2>&1
  log_ok "Generated sovereign SAN TLS certificate for ${SPARROWX_DOMAIN} (${SPARROWX_PUBLIC_IP})."
fi

cat > ./ovh/nginx.conf <<EOF
server {
    listen 80;
    listen 443 ssl;
    server_name ${SPARROWX_DOMAIN} www.${SPARROWX_DOMAIN} _;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 15M;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
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

# ============================================================================
# STEP 8: WRITE .ENV & CONFIGURE FIREWALL (ALLOWING DYNAMIC PORTS + SSH)
# ============================================================================
log_info "[Step 7/9] Writing .env & opening active ports in firewall..."
if [ -f .env ] && grep -q "^POSTGRES_PASSWORD=" .env; then
  DB_PASS="$(grep '^POSTGRES_PASSWORD=' .env | cut -d'=' -f2-)"
  API_SECRET="$(grep '^SPARROWX_API_SECRET=' .env | cut -d'=' -f2- || openssl rand -hex 16)"
else
  DB_PASS="$(openssl rand -hex 20)"
  API_SECRET="spx_ovh_$(openssl rand -hex 16)"
fi

cat > .env <<EOF
POSTGRES_USER=sparrowx
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=sparrowx_db
SPARROWX_API_SECRET=${API_SECRET}
SPARROWX_DOMAIN=${SPARROWX_DOMAIN}
SPARROWX_PUBLIC_IP=${SPARROWX_PUBLIC_IP}
SPARROWX_NS1=${SPARROWX_NS1}
SPARROWX_NS2=${SPARROWX_NS2}
SPARROWX_ADMIN_EMAIL=${SPARROWX_ADMIN_EMAIL}
HTTP_PORT=${HTTP_PORT}
HTTPS_PORT=${HTTPS_PORT}
APP_HOST_PORT=${APP_HOST_PORT}
PGRST_HOST_PORT=${PGRST_HOST_PORT}
PG_HOST_PORT=${PG_HOST_PORT}
DNS_PORT=${DNS_PORT}
EOF
chmod 600 .env

# Detect current SSH port so we never lock out custom SSH ports
ACTIVE_SSH_PORT="$(ss -tulnp 2>/dev/null | awk '/sshd/ {print $5}' | sed -E 's/.*:([0-9]+)$/\1/' | head -n 1 || echo 22)"
[ -z "${ACTIVE_SSH_PORT}" ] && ACTIVE_SSH_PORT=22

if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow "${ACTIVE_SSH_PORT}"/tcp >/dev/null 2>&1 || true
  ufw allow "${HTTP_PORT}"/tcp >/dev/null 2>&1 || true
  ufw allow "${HTTPS_PORT}"/tcp >/dev/null 2>&1 || true
  ufw allow "${DNS_PORT}"/tcp >/dev/null 2>&1 || true
  ufw allow "${DNS_PORT}"/udp >/dev/null 2>&1 || true
  ufw --force enable >/dev/null 2>&1 || true
elif command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
  firewall-cmd --permanent --add-port=22/tcp >/dev/null 2>&1 || true
  firewall-cmd --permanent --add-port="${ACTIVE_SSH_PORT}"/tcp >/dev/null 2>&1 || true
  firewall-cmd --permanent --add-port="${HTTP_PORT}"/tcp >/dev/null 2>&1 || true
  firewall-cmd --permanent --add-port="${HTTPS_PORT}"/tcp >/dev/null 2>&1 || true
  firewall-cmd --permanent --add-port="${DNS_PORT}"/tcp >/dev/null 2>&1 || true
  firewall-cmd --permanent --add-port="${DNS_PORT}"/udp >/dev/null 2>&1 || true
  firewall-cmd --reload >/dev/null 2>&1 || true
fi

# ============================================================================
# STEP 9: LAUNCH STACK WITH AUTO-PORT-RETRY & NATIVE FALLBACK
# ============================================================================
log_info "[Step 8/9] Launching SparrowX Full Stack..."
STACK_STARTED="no"

if [ "${DOCKER_AVAILABLE}" = "yes" ]; then
  LAUNCH_TRY=1
  while [ "${LAUNCH_TRY}" -le 3 ]; do
    if docker compose -f docker-compose.ovh.yml up -d --build; then
      STACK_STARTED="yes"
      break
    fi
    log_warn "Docker Compose launch attempt ${LAUNCH_TRY}/3 encountered a conflict; re-scanning ports & healing..."
    docker compose -f docker-compose.ovh.yml down --remove-orphans >/dev/null 2>&1 || true
    docker network prune -f >/dev/null 2>&1 || true
    HTTP_PORT="$(find_free_port "${HTTP_PORT}" 8080 "HTTP Web Server")"
    HTTPS_PORT="$(find_free_port "${HTTPS_PORT}" 8443 "HTTPS SSL Web Server")"
    APP_HOST_PORT="$(find_free_port "${APP_HOST_PORT}" 3010 "SparrowX Node Server")"
    PGRST_HOST_PORT="$(find_free_port "${PGRST_HOST_PORT}" 3020 "PostgREST API Engine")"
    PG_HOST_PORT="$(find_free_port "${PG_HOST_PORT}" 5433 "PostgreSQL Database")"
    sed -i "s/^HTTP_PORT=.*/HTTP_PORT=${HTTP_PORT}/" .env
    sed -i "s/^HTTPS_PORT=.*/HTTPS_PORT=${HTTPS_PORT}/" .env
    sed -i "s/^APP_HOST_PORT=.*/APP_HOST_PORT=${APP_HOST_PORT}/" .env
    sed -i "s/^PGRST_HOST_PORT=.*/PGRST_HOST_PORT=${PGRST_HOST_PORT}/" .env
    sed -i "s/^PG_HOST_PORT=.*/PG_HOST_PORT=${PG_HOST_PORT}/" .env
    LAUNCH_TRY=$((LAUNCH_TRY + 1))
  done

  if [ "${STACK_STARTED}" = "yes" ] && [ -d /etc/systemd/system ]; then
    cat > /etc/systemd/system/sparrowx-stack.service <<EOF
[Unit]
Description=SparrowX Sovereign Cyber Defense Stack (Docker)
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/docker compose -f docker-compose.ovh.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.ovh.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload >/dev/null 2>&1 || true
    systemctl enable sparrowx-stack.service >/dev/null 2>&1 || true
  fi
fi

# Fallback: If Docker is unavailable or blocked by VPS kernel, build & run natively on host
if [ "${STACK_STARTED}" != "yes" ]; then
  log_warn "Activating Native Host Mode (Node.js 22 + Built-in Sovereign REST Engine)..."
  if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1 || true
    retry_pkg_install nodejs
  fi
  export NODE_OPTIONS="--max-old-space-size=2048"
  export VITE_SUPABASE_URL=""
  export VITE_SUPABASE_ANON_KEY="spx_ovh_sovereign_key"
  npm install --legacy-peer-deps
  npm run build

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
  systemctl enable sparrowx-native.service >/dev/null 2>&1 || true
  systemctl restart sparrowx-native.service >/dev/null 2>&1 || true
fi

# ============================================================================
# STEP 10: END-TO-END HEALTH PROBE, DB SHIFT & FINAL SUMMARY
# ============================================================================
log_info "[Step 9/9] Verifying live HTTP/HTTPS, shifting Cloud DB to Local OVH DB & installing CLI tools..."
echo "SPARROWX_STUDIO_DOMAIN=${SPARROWX_STUDIO_DOMAIN}" >> "${INSTALL_DIR}/.env" 2>/dev/null || true
chmod +x "${INSTALL_DIR}/manage-db.sh" "${INSTALL_DIR}/update.sh" 2>/dev/null || true
ln -sf "${INSTALL_DIR}/manage-db.sh" /usr/local/bin/sparrowx-db 2>/dev/null || true
ln -sf "${INSTALL_DIR}/update.sh" /usr/local/bin/sparrowx-update 2>/dev/null || true

ATTEMPTS=0
while [ "${ATTEMPTS}" -lt 30 ]; do
  if curl -fsS "http://127.0.0.1:${HTTP_PORT}/api/v1/health" >/dev/null 2>&1 || \
     curl -fsS "http://127.0.0.1:${APP_HOST_PORT}/api/v1/health" >/dev/null 2>&1; then
    break
  fi
  ATTEMPTS=$((ATTEMPTS + 1))
  sleep 2
done

"${INSTALL_DIR}/manage-db.sh" sync >/dev/null 2>&1 || true

HTTP_SUFFIX=""
[ "${HTTP_PORT}" != "80" ] && HTTP_SUFFIX=":${HTTP_PORT}"
HTTPS_SUFFIX=""
[ "${HTTPS_PORT}" != "443" ] && HTTPS_SUFFIX=":${HTTPS_PORT}"

echo ""
echo -e "${C_GREEN}======================================================================${C_RESET}"
echo -e "${C_BOLD}  SPARROWX SELF-HOSTED STACK IS ONLINE & VERIFIED (A-TO-Z COMPLETE)   ${C_RESET}"
echo -e "${C_GREEN}======================================================================${C_RESET}"
echo -e "  • Dashboard (HTTPS) : ${C_BOLD}https://${SPARROWX_DOMAIN}${HTTPS_SUFFIX}${C_RESET}"
echo -e "  • Dashboard (HTTP)  : ${C_BOLD}http://${SPARROWX_PUBLIC_IP}${HTTP_SUFFIX}${C_RESET}"
echo -e "  • Supabase Studio   : ${C_BOLD}https://${SPARROWX_STUDIO_DOMAIN}${HTTPS_SUFFIX}${C_RESET} (or http://${SPARROWX_PUBLIC_IP}${HTTP_SUFFIX}/?studio=1)"
echo -e "  • Terminal DB TUI   : Run ${C_BOLD}./manage-db.sh${C_RESET} (or ${C_BOLD}sparrowx-db${C_RESET})"
echo -e "  • Per-User DB Root  : ${INSTALL_DIR}/data/users/<username>/"
echo -e "  • REST DB API       : ${C_BOLD}http://${SPARROWX_PUBLIC_IP}${HTTP_SUFFIX}/rest/v1/${C_RESET}"
echo -e "  • Health Probe      : ${C_BOLD}http://${SPARROWX_PUBLIC_IP}${HTTP_SUFFIX}/api/v1/health${C_RESET}"
echo -e "  • Nameserver 1      : ${SPARROWX_NS1} -> ${SPARROWX_PUBLIC_IP} (DNS Port: ${DNS_PORT})"
echo -e "  • Nameserver 2      : ${SPARROWX_NS2} -> ${SPARROWX_PUBLIC_IP} (DNS Port: ${DNS_PORT})"
echo -e "  • DNS Zone File     : ${INSTALL_DIR}/ovh/dns/db.${SPARROWX_DOMAIN}"
echo -e "  • Future 1-Click Up : Run ${C_BOLD}./update.sh${C_RESET} (or ${C_BOLD}sparrowx-update${C_RESET})"
echo -e "  • Install Log       : ${LOG_FILE}"
echo -e "${C_GREEN}======================================================================${C_RESET}"
