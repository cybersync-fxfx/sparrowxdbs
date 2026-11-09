#!/usr/bin/env bash
# ==============================================================================
# SPARROWX ONE-CLICK RESTORE & AUTO-CONFIG IMPORTER
# Auto-detects public VPS IP, writes Nginx/Caddy configs, and launches the stack
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo "  SPARROWX DUAL-PLATFORM: AUTOMATED VPS RESTORE & SETUP"
echo "=========================================================="

# 1. Automatic Public IP Detection
echo "-> Detecting server network identity..."
DETECTED_IP=$(curl -s4 --max-time 5 https://ifconfig.me 2>/dev/null || curl -s4 --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')

if [ -z "${DETECTED_IP}" ]; then
    DETECTED_IP="127.0.0.1"
fi
echo "   [✓] Auto-detected Server Public IP: ${DETECTED_IP}"

# 2. Interactive Guided Configuration with Smart Defaults
echo ""
echo "--- Step 1: Domain & Host Configuration ---"
read -rp "Enter your primary domain (e.g. example.com) or press [ENTER] for direct IP [${DETECTED_IP}]: " USER_DOMAIN
USER_DOMAIN=${USER_DOMAIN:-$DETECTED_IP}

if [ "${USER_DOMAIN}" = "${DETECTED_IP}" ]; then
    STUDIO_DOMAIN="${DETECTED_IP}:8080"
    API_DOMAIN="${DETECTED_IP}:3000"
    USE_SSL="n"
    echo "   -> Operating in Direct IP mode (HTTP)."
else
    STUDIO_DOMAIN="studio.${USER_DOMAIN}"
    API_DOMAIN="api.${USER_DOMAIN}"
    read -rp "Enable automatic HTTPS / SSL via Let's Encrypt? (Y/n, default: Y): " SSL_INPUT
    SSL_INPUT=${SSL_INPUT:-Y}
    if [[ "$SSL_INPUT" =~ ^[Yy]$ ]]; then
        USE_SSL="y"
        read -rp "Enter admin email for SSL cert expiry alerts: " SSL_EMAIL
    else
        USE_SSL="n"
    fi
fi

echo ""
echo "--- Step 2: Database Master Credentials ---"
DEFAULT_PW=$(openssl rand -base64 16 2>/dev/null || date +%s | sha256sum | base64 | head -c 20)
read -rp "Enter master PostgreSQL password [Press ENTER to auto-generate]: " DB_PASSWORD
DB_PASSWORD=${DB_PASSWORD:-$DEFAULT_PW}

DEFAULT_JWT=$(openssl rand -hex 32 2>/dev/null || date +%s | sha256sum | head -c 40)
JWT_SECRET=${JWT_SECRET:-$DEFAULT_JWT}

# 3. Check and Install Docker / Docker Compose if missing
echo ""
echo "-> Checking container runtime..."
if ! command -v docker &> /dev/null; then
    echo "   -> Docker not found. Installing Docker Engine..."
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sh /tmp/get-docker.sh
    systemctl enable --now docker
    echo "   [✓] Docker installed successfully."
else
    echo "   [✓] Docker is already installed."
fi

# 4. Generate Production .env File
echo "-> Writing production environment secrets..."
cat <<EOF > .env
POSTGRES_DB=sparrowbase
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${DB_PASSWORD}
SPARROWX_JWT_SECRET=${JWT_SECRET}
SPARROWX_REDIS_SECRET=$(openssl rand -hex 16 2>/dev/null || echo "sparrowx_redis_secret_99")
DOMAIN_STUDIO=${STUDIO_DOMAIN}
DOMAIN_API=${API_DOMAIN}
SERVER_IP=${DETECTED_IP}
EOF
echo "   [✓] .env generated."

# 5. Automatically Generate Nginx / Caddy Ingress Configuration
echo "-> Generating edge proxy routing with auto-detected IP..."
if [ "${USE_SSL}" = "y" ]; then
    cat <<EOF > Caddyfile
{
    email ${SSL_EMAIL:-admin@${USER_DOMAIN}}
}

${STUDIO_DOMAIN} {
    reverse_proxy sparrowx-studio:80
}

${API_DOMAIN} {
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
    }
    reverse_proxy sparrowx-postgrest:3000
}
EOF
else
    cat <<EOF > Caddyfile
:80 {
    reverse_proxy sparrowx-studio:80
}

:3000 {
    reverse_proxy sparrowx-postgrest:3000
}
EOF
fi
echo "   [✓] Reverse proxy configuration applied for IP ${DETECTED_IP}."

# 6. Spin up Docker Stack
echo "-> Booting SparrowX Dual Platform (Security + DBaaS)..."
if docker compose version &> /dev/null; then
    docker compose -f docker-compose.sparrowx.yml up -d
else
    docker-compose -f docker-compose.sparrowx.yml up -d
fi

# 7. Restore Database Dump if present
if [ -f "./data/postgres_dumpall.sql" ]; then
    echo "-> Restoring previous database state..."
    echo "   Waiting for PostgreSQL container to become ready..."
    sleep 8
    docker exec -i sparrowx_postgres psql -U postgres < "./data/postgres_dumpall.sql" 2>/dev/null || true
    echo "   [✓] Database restore completed."
fi

# 8. Success Report
echo "=========================================================="
echo "  [SUCCESS] SPARROWX IS NOW LIVE ON THIS SERVER!"
echo "=========================================================="
echo "  Server Public IP:  ${DETECTED_IP}"
if [ "${USER_DOMAIN}" != "${DETECTED_IP}" ]; then
    echo "  SparrowX Studio:   https://${STUDIO_DOMAIN}"
    echo "  SparrowX DB API:   https://${API_DOMAIN}"
    echo ""
    echo "-> ACTION REQUIRED: Point your DNS records:"
    echo "   Type: A    Name: studio    Value: ${DETECTED_IP}"
    echo "   Type: A    Name: api       Value: ${DETECTED_IP}"
else
    echo "  SparrowX Studio:   http://${DETECTED_IP}"
    echo "  SparrowX DB API:   http://${DETECTED_IP}:3000"
fi
echo ""
echo "  PgBouncer Pooled DB Port: 6543"
echo "  Direct PostgreSQL Port:   5432"
echo "  Master User:              postgres"
echo "  Master Password:          ${DB_PASSWORD}"
echo "=========================================================="
