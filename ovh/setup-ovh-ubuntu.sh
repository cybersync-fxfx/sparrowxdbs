#!/usr/bin/env bash
# ============================================================================
# SPARROWX A-TO-Z FULLY AUTOMATED SELF-HOSTED SERVER INSTALLER
# Runs on any Ubuntu / Debian / AlmaLinux / Rocky / CentOS / Fedora server
# Deploys UI + Backend + PostgreSQL 16 + PostgREST + Nginx + Systemd Service
# ============================================================================
set -euo pipefail

REPO_URL="https://github.com/cybersync-fxfx/sparrowxdbs.git"
INSTALL_DIR="/opt/sparrowx"

echo "======================================================================"
echo "  SPARROWX SOVEREIGN STACK — A-TO-Z AUTOMATED SERVER INSTALLER"
echo "======================================================================"

if [ "$(id -u)" -ne 0 ]; then
  echo "[!] Please run with sudo or as root: sudo ./ovh/setup-ovh-ubuntu.sh"
  exit 1
fi

# 1. Detect Package Manager & Install System Prerequisites
echo "[1/7] Installing system prerequisites (git, curl, openssl, ca-certificates)..."
if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg git openssl ufw lsb-release
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y ca-certificates curl git openssl firewalld
elif command -v yum >/dev/null 2>&1; then
  yum install -y ca-certificates curl git openssl firewalld
fi

# 2. Ensure Repository Exists (supports running standalone or inside cloned repo)
if [ -f "./docker-compose.ovh.yml" ] && [ -f "./ovh/schema.sql" ]; then
  INSTALL_DIR="$(pwd)"
  echo "[2/7] Using existing SparrowX repository at: ${INSTALL_DIR}"
else
  echo "[2/7] Cloning SparrowX repository into ${INSTALL_DIR}..."
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

# 3. Install Docker Engine & Docker Compose v2 Automatically
if ! command -v docker >/dev/null 2>&1; then
  echo "[3/7] Installing Docker Engine & Docker Compose plugin..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "[3/7] Docker is already installed: $(docker --version)"
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

# 4. Generate Sovereign Environment Credentials (.env)
if [ ! -f .env ]; then
  echo "[4/7] Generating cryptographic PostgreSQL credentials in .env..."
  DB_PASS="$(openssl rand -hex 20)"
  API_SECRET="spx_ovh_$(openssl rand -hex 16)"
  cat > .env <<EOF
POSTGRES_PASSWORD=${DB_PASS}
SPARROWX_API_SECRET=${API_SECRET}
HTTP_PORT=80
EOF
  chmod 600 .env
  echo "      Created .env with auto-generated database credentials."
else
  echo "[4/7] Existing .env file found, preserving credentials."
fi

# 5. Configure Host Firewall (SSH 22, HTTP 80, HTTPS 443)
echo "[5/7] Configuring host firewall rules..."
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw --force enable >/dev/null 2>&1 || true
elif command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
  firewall-cmd --permanent --add-service=ssh >/dev/null 2>&1 || true
  firewall-cmd --permanent --add-service=http >/dev/null 2>&1 || true
  firewall-cmd --permanent --add-service=https >/dev/null 2>&1 || true
  firewall-cmd --reload >/dev/null 2>&1 || true
fi

# 6. Build & Start Full Sovereign Stack + Register Systemd Boot Service
echo "[6/7] Building and launching PostgreSQL 16, PostgREST, SparrowX Node Server, and Nginx..."
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

# 7. Automated End-to-End Health & Database Verification
echo "[7/7] Verifying live API and database readiness..."
ATTEMPTS=0
MAX_ATTEMPTS=30
until curl -fsS http://127.0.0.1/api/v1/health >/dev/null 2>&1 || [ $ATTEMPTS -ge $MAX_ATTEMPTS ]; do
  ATTEMPTS=$((ATTEMPTS + 1))
  sleep 2
done

SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')"

echo ""
echo "======================================================================"
echo "  SPARROWX SELF-HOSTED STACK IS ONLINE (A-TO-Z COMPLETE)"
echo "======================================================================"
echo "  Dashboard UI : http://${SERVER_IP}"
echo "  REST DB API  : http://${SERVER_IP}/rest/v1/"
echo "  Health Check : http://${SERVER_IP}/api/v1/health"
echo "  Install Path : ${INSTALL_DIR}"
echo "  Auto-Boot    : Enabled via systemd (sparrowx-stack.service)"
echo "======================================================================"
