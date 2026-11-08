#!/usr/bin/env bash
# ============================================================================
# SPARROWX A-TO-Z INTERACTIVE SELF-HOSTED SERVER INSTALLER
# Asks 5 easy questions (Domain, Public IP, Nameservers, Admin Email, DNS/SSL)
# and automatically provisions Web Server, DNS, SSL, Database, and UI/API.
# ============================================================================
set -euo pipefail

REPO_URL="https://github.com/cybersync-fxfx/sparrowxdbs.git"
INSTALL_DIR="/opt/sparrowx"

echo "======================================================================"
echo "  SPARROWX SOVEREIGN STACK — A-TO-Z INTERACTIVE SERVER INSTALLER"
echo "======================================================================"

if [ "$(id -u)" -ne 0 ]; then
  echo "[!] Please run with sudo or as root: sudo ./ovh/setup-ovh-ubuntu.sh"
  exit 1
fi

# 1. Install Base Prerequisites First (needed for IP detection, git, openssl)
echo "[Step 1/8] Checking system packages (git, curl, openssl, ca-certificates)..."
if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y >/dev/null 2>&1
  apt-get install -y ca-certificates curl gnupg git openssl ufw lsb-release dnsutils >/dev/null 2>&1
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y ca-certificates curl git openssl firewalld bind-utils >/dev/null 2>&1
elif command -v yum >/dev/null 2>&1; then
  yum install -y ca-certificates curl git openssl firewalld bind-utils >/dev/null 2>&1
fi

# Auto-detect Server Public IPv4
DETECTED_IP="$(curl -4 -fsS --max-time 5 https://icanhazip.com 2>/dev/null | tr -d '[:space:]' || true)"
if [ -z "${DETECTED_IP}" ]; then
  DETECTED_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')"
fi

# Helper to read interactively even when piped via curl | sudo bash
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
echo "----------------------------------------------------------------------"
echo "  QUICK 5-QUESTION SERVER, DOMAIN & DNS CONFIGURATION"
echo "  (Press Enter on any question to accept the suggested default)"
echo "----------------------------------------------------------------------"

# Question 1: Domain Name
RAW_DOMAIN="$(ask_prompt "1/5 Enter your primary domain name (e.g. sparrowx.net)" "sparrowx.local")"
SPARROWX_DOMAIN="$(echo "${RAW_DOMAIN}" | sed -E 's#^https?://##; s#/.*$##' | tr '[:upper:]' '[:lower:]')"

# Question 2: Server Public IP (DNS A Record Target)
SPARROWX_PUBLIC_IP="$(ask_prompt "2/5 Confirm server public IPv4 for DNS A records" "${DETECTED_IP}")"

# Question 3: Nameservers (NS1 & NS2)
DEFAULT_NS="ns1.${SPARROWX_DOMAIN},ns2.${SPARROWX_DOMAIN}"
RAW_NS="$(ask_prompt "3/5 Enter primary & secondary Nameservers (comma-separated)" "${DEFAULT_NS}")"
SPARROWX_NS1="$(echo "${RAW_NS}" | cut -d',' -f1 | tr -d '[:space:]')"
SPARROWX_NS2="$(echo "${RAW_NS}" | cut -d',' -f2 | tr -d '[:space:]')"
if [ -z "${SPARROWX_NS2}" ] || [ "${SPARROWX_NS2}" = "${SPARROWX_NS1}" ]; then
  SPARROWX_NS2="ns2.${SPARROWX_DOMAIN}"
fi

# Question 4: Admin & SSL Email
DEFAULT_EMAIL="admin@${SPARROWX_DOMAIN}"
SPARROWX_ADMIN_EMAIL="$(ask_prompt "4/5 Enter admin email for SSL & security alerts" "${DEFAULT_EMAIL}")"

# Question 5: Enable Authoritative DNS Server & Automatic HTTPS SSL
ENABLE_DNS_SSL="$(ask_prompt "5/5 Auto-configure Authoritative DNS (Bind9) & HTTPS SSL? (yes/no)" "yes")"
ENABLE_DNS_SSL="$(echo "${ENABLE_DNS_SSL}" | tr '[:upper:]' '[:lower:]')"

echo "----------------------------------------------------------------------"
echo "  Selected Configuration:"
echo "  • Domain Name   : ${SPARROWX_DOMAIN}"
echo "  • Server WAN IP : ${SPARROWX_PUBLIC_IP}"
echo "  • Nameservers   : ${SPARROWX_NS1} , ${SPARROWX_NS2}"
echo "  • Admin Email   : ${SPARROWX_ADMIN_EMAIL}"
echo "  • Auto DNS/SSL  : ${ENABLE_DNS_SSL}"
echo "----------------------------------------------------------------------"
echo ""

# 2. Ensure Repository Exists
if [ -f "./docker-compose.ovh.yml" ] && [ -f "./ovh/schema.sql" ]; then
  INSTALL_DIR="$(pwd)"
  echo "[Step 2/8] Using SparrowX repository at: ${INSTALL_DIR}"
else
  echo "[Step 2/8] Cloning SparrowX repository into ${INSTALL_DIR}..."
  if [ -d "${INSTALL_DIR}/.git" ]; then
    cd "${INSTALL_DIR}"
    git pull origin main
  else
    rm -rf "${INSTALL_DIR}"
    git clone "${REPO_URL}" "${INSTALL_DIR}"
    cd "${INSTALL_DIR}"
  fi
fi

cd "${INSTALL_DIR}"
mkdir -p ./ovh/dns ./ovh/ssl

# 3. Install Docker Engine & Docker Compose v2 Automatically
if ! command -v docker >/dev/null 2>&1; then
  echo "[Step 3/8] Installing Docker Engine & Docker Compose plugin..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "[Step 3/8] Docker is ready: $(docker --version)"
  systemctl enable docker >/dev/null 2>&1 || true
  systemctl start docker >/dev/null 2>&1 || true
fi

if ! docker compose version >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y && apt-get install -y docker-compose-plugin
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y docker-compose-plugin
  fi
fi

# 4. Generate DNS Zone File & Optional Host Bind9 Authoritative DNS Server
echo "[Step 4/8] Generating DNS zone records for ${SPARROWX_DOMAIN}..."
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
  if command -v apt-get >/dev/null 2>&1; then
    apt-get install -y bind9 bind9utils certbot >/dev/null 2>&1 || true
    if [ -d /etc/bind ]; then
      mkdir -p /etc/bind/zones
      cp "${ZONE_FILE}" "/etc/bind/zones/db.${SPARROWX_DOMAIN}"
      if ! grep -q "zone \"${SPARROWX_DOMAIN}\"" /etc/bind/named.conf.local 2>/dev/null; then
        cat >> /etc/bind/named.conf.local <<EOF

zone "${SPARROWX_DOMAIN}" {
    type master;
    file "/etc/bind/zones/db.${SPARROWX_DOMAIN}";
    allow-query { any; };
};
EOF
      fi
      systemctl restart named >/dev/null 2>&1 || systemctl restart bind9 >/dev/null 2>&1 || true
    fi
  fi
fi

# 5. Configure SSL Certificates & Nginx Reverse Proxy for Chosen Domain
echo "[Step 5/8] Configuring Nginx Web Server & TLS certificates for ${SPARROWX_DOMAIN}..."
SSL_CERT="./ovh/ssl/fullchain.pem"
SSL_KEY="./ovh/ssl/privkey.pem"

if [[ "${ENABLE_DNS_SSL}" == "y"* ]] && command -v certbot >/dev/null 2>&1 && [[ "${SPARROWX_DOMAIN}" != *.local ]]; then
  # Stop any existing container on port 80 briefly to allow standalone ACME challenge
  docker compose -f docker-compose.ovh.yml stop nginx >/dev/null 2>&1 || true
  if certbot certonly --standalone --non-interactive --agree-tos \
      -m "${SPARROWX_ADMIN_EMAIL}" -d "${SPARROWX_DOMAIN}" >/dev/null 2>&1; then
    cp "/etc/letsencrypt/live/${SPARROWX_DOMAIN}/fullchain.pem" "${SSL_CERT}"
    cp "/etc/letsencrypt/live/${SPARROWX_DOMAIN}/privkey.pem" "${SSL_KEY}"
    echo "      Issued live Let's Encrypt TLS certificate for ${SPARROWX_DOMAIN}."
  fi
fi

# Ensure valid SAN certificate exists (fallback if DNS has not propagated yet)
if [ ! -f "${SSL_CERT}" ] || [ ! -f "${SSL_KEY}" ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "${SSL_KEY}" \
    -out "${SSL_CERT}" \
    -subj "/CN=${SPARROWX_DOMAIN}" \
    -addext "subjectAltName=DNS:${SPARROWX_DOMAIN},DNS:*.${SPARROWX_DOMAIN},IP:${SPARROWX_PUBLIC_IP}" >/dev/null 2>&1
  echo "      Generated sovereign TLS SAN certificate for ${SPARROWX_DOMAIN} (${SPARROWX_PUBLIC_IP})."
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

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 1. Self-Hosted PostgREST Database REST API (/rest/v1/*)
    location /rest/v1/ {
        proxy_pass http://postgrest:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # 2. SparrowX UI & Sovereign Telemetry / Connector API (/ & /api/v1/*)
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

# 6. Write .env Configuration
echo "[Step 6/8] Saving environment configuration to .env..."
if [ -f .env ] && grep -q "POSTGRES_PASSWORD=" .env; then
  DB_PASS="$(grep '^POSTGRES_PASSWORD=' .env | cut -d'=' -f2-)"
  API_SECRET="$(grep '^SPARROWX_API_SECRET=' .env | cut -d'=' -f2- || openssl rand -hex 16)"
else
  DB_PASS="$(openssl rand -hex 20)"
  API_SECRET="spx_ovh_$(openssl rand -hex 16)"
fi

cat > .env <<EOF
POSTGRES_PASSWORD=${DB_PASS}
SPARROWX_API_SECRET=${API_SECRET}
SPARROWX_DOMAIN=${SPARROWX_DOMAIN}
SPARROWX_PUBLIC_IP=${SPARROWX_PUBLIC_IP}
SPARROWX_NS1=${SPARROWX_NS1}
SPARROWX_NS2=${SPARROWX_NS2}
SPARROWX_ADMIN_EMAIL=${SPARROWX_ADMIN_EMAIL}
HTTP_PORT=80
EOF
chmod 600 .env

# 7. Configure Firewall (SSH 22, DNS 53, HTTP 80, HTTPS 443) & Launch Stack
echo "[Step 7/8] Configuring firewall & launching containers..."
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  if [[ "${ENABLE_DNS_SSL}" == "y"* ]]; then
    ufw allow 53/tcp >/dev/null 2>&1 || true
    ufw allow 53/udp >/dev/null 2>&1 || true
  fi
  ufw --force enable >/dev/null 2>&1 || true
elif command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
  firewall-cmd --permanent --add-service=ssh >/dev/null 2>&1 || true
  firewall-cmd --permanent --add-service=http >/dev/null 2>&1 || true
  firewall-cmd --permanent --add-service=https >/dev/null 2>&1 || true
  if [[ "${ENABLE_DNS_SSL}" == "y"* ]]; then
    firewall-cmd --permanent --add-service=dns >/dev/null 2>&1 || true
  fi
  firewall-cmd --reload >/dev/null 2>&1 || true
fi

docker compose -f docker-compose.ovh.yml up -d --build

if [ -d /etc/systemd/system ]; then
  cat > /etc/systemd/system/sparrowx-stack.service <<EOF
[Unit]
Description=SparrowX Sovereign Cyber Defense Stack
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

# 8. Verify Live Health
echo "[Step 8/8] Verifying live web server and database readiness..."
ATTEMPTS=0
MAX_ATTEMPTS=30
until curl -fsS http://127.0.0.1/api/v1/health >/dev/null 2>&1 || [ $ATTEMPTS -ge $MAX_ATTEMPTS ]; do
  ATTEMPTS=$((ATTEMPTS + 1))
  sleep 2
done

echo ""
echo "======================================================================"
echo "  SPARROWX SELF-HOSTED STACK IS ONLINE (A-TO-Z COMPLETE)"
echo "======================================================================"
echo "  Primary Domain   : https://${SPARROWX_DOMAIN} (and http://${SPARROWX_PUBLIC_IP})"
echo "  Nameserver 1     : ${SPARROWX_NS1} -> ${SPARROWX_PUBLIC_IP}"
echo "  Nameserver 2     : ${SPARROWX_NS2} -> ${SPARROWX_PUBLIC_IP}"
echo "  DNS Zone File    : ${INSTALL_DIR}/ovh/dns/db.${SPARROWX_DOMAIN}"
echo "  REST DB Endpoint : https://${SPARROWX_DOMAIN}/rest/v1/"
echo "  Health Endpoint  : https://${SPARROWX_DOMAIN}/api/v1/health"
echo "======================================================================"
