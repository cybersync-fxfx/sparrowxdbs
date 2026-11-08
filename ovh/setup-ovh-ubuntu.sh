#!/usr/bin/env bash
# ============================================================================
# SPARROWX 1-COMMAND OVHCLOUD UBUNTU SERVER INSTALLER
# ============================================================================
# Supports Ubuntu 22.04 LTS & 24.04 LTS on OVHcloud VPS / Dedicated Servers.
# Installs Docker, PostgreSQL 16, PostgREST, Nginx, and SparrowX UI + API.
#
# Usage on your OVH Ubuntu server:
#   chmod +x ovh/setup-ovh-ubuntu.sh
#   sudo ./ovh/setup-ovh-ubuntu.sh
# ============================================================================

set -euo pipefail

echo "=================================================================="
echo "  SPARROWX SOVEREIGN OVH UBUNTU FULL-STACK DEPLOYMENT"
echo "=================================================================="

if [ "$(id -u)" -ne 0 ]; then
  echo "[!] Please run this script as root or with sudo: sudo ./ovh/setup-ovh-ubuntu.sh"
  exit 1
fi

# 1. Install Docker & Docker Compose if not already installed
if ! command -v docker >/dev/null 2>&1; then
  echo "[+] Installing Docker Engine and Docker Compose plugin..."
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg ufw
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi

# 2. Generate .env with strong random database credentials if missing
if [ ! -f .env ]; then
  PG_PASS=$(openssl rand -hex 18)
  echo "[+] Generating sovereign .env configuration..."
  cat > .env <<EOF
POSTGRES_USER=sparrowx
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_DB=sparrowx_db
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=spx_ovh_sovereign_key
EOF
fi

# 3. Configure UFW Firewall (Allow SSH, HTTP, HTTPS)
if command -v ufw >/dev/null 2>&1; then
  echo "[+] Configuring UFW firewall rules (22, 80, 443)..."
  ufw allow 22/tcp >/dev/null || true
  ufw allow 80/tcp >/dev/null || true
  ufw allow 443/tcp >/dev/null || true
fi

# 4. Build and launch the self-hosted stack
echo "[+] Building and starting PostgreSQL, PostgREST, SparrowX App, and Nginx..."
docker compose -f docker-compose.ovh.yml up -d --build

echo "=================================================================="
echo "  [SUCCESS] SparrowX Full Stack is LIVE on your OVH Ubuntu Server!"
echo "  - Web UI & SOC Console : http://$(hostname -I | awk '{print $1}')"
echo "  - Self-Hosted REST API : http://$(hostname -I | awk '{print $1}')/rest/v1/"
echo "  - Health Check API     : http://$(hostname -I | awk '{print $1}')/api/v1/health"
echo "=================================================================="
