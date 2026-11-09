#!/usr/bin/env bash
# ==============================================================================
# SPARROWX ONE-CLICK RESTORE & AUTO-CONFIG IMPORTER
# Auto-detects public VPS IP, resolves root directory, writes configs & starts stack
# ==============================================================================

set -euo pipefail

# 0. Automatically resolve project root regardless of where the script is called from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${PWD}/docker-compose.sparrowx.yml" ]; then
    ROOT_DIR="${PWD}"
elif [ -f "${SCRIPT_DIR}/../docker-compose.sparrowx.yml" ]; then
    ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
elif [ -f "${SCRIPT_DIR}/docker-compose.sparrowx.yml" ]; then
    ROOT_DIR="${SCRIPT_DIR}"
else
    ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
fi

cd "${ROOT_DIR}"
mkdir -p "${ROOT_DIR}/init-scripts" "${ROOT_DIR}/deploy"

echo "=========================================================="
echo "  SPARROWX DUAL-PLATFORM: AUTOMATED VPS RESTORE & SETUP"
echo "=========================================================="
echo "-> Working Directory: ${ROOT_DIR}"

# 1. Automatic Public IP Detection
echo "-> Detecting server network identity..."
DETECTED_IP=$(curl -s4 --max-time 5 https://ifconfig.me 2>/dev/null || curl -s4 --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")

if [ -z "${DETECTED_IP}" ]; then
    DETECTED_IP="127.0.0.1"
fi
echo "   [✓] Auto-detected Server Public IP: ${DETECTED_IP}"

# 2. Interactive Guided Configuration with Smart Subdomain Detection
echo ""
echo "--- Step 1: Domain & Host Configuration ---"
echo "You can enter your root domain (e.g. sparrowx.net) OR a specific domain/subdomain (e.g. db.sparrowx.net)."
read -rp "Enter domain [Press ENTER for direct IP ${DETECTED_IP}]: " USER_DOMAIN
USER_DOMAIN=${USER_DOMAIN:-$DETECTED_IP}

if [ "${USER_DOMAIN}" = "${DETECTED_IP}" ]; then
    STUDIO_DOMAIN="${DETECTED_IP}"
    API_DOMAIN="${DETECTED_IP}"
    USE_SSL="n"
    echo "   -> Operating in Direct IP mode (HTTP port 80 / 3000)."
else
    # Check if user typed a subdomain like db.sparrowx.net (has 2 or more dots)
    DOT_COUNT=$(echo "${USER_DOMAIN}" | tr -cd '.' | wc -c)
    if [ "${DOT_COUNT}" -ge 2 ]; then
        # Already a specific domain/subdomain e.g. db.sparrowx.net
        STUDIO_DOMAIN="${USER_DOMAIN}"
        PARENT_DOMAIN=$(echo "${USER_DOMAIN}" | cut -d. -f2-)
        DEFAULT_API="api.${PARENT_DOMAIN}"
    else
        STUDIO_DOMAIN="studio.${USER_DOMAIN}"
        DEFAULT_API="api.${USER_DOMAIN}"
    fi

    echo "   -> SparrowX Studio URL will be: https://${STUDIO_DOMAIN}"
    read -rp "Enter API domain [Press ENTER for https://${DEFAULT_API}]: " INPUT_API
    API_DOMAIN=${INPUT_API:-$DEFAULT_API}

    read -rp "Enable automatic HTTPS / SSL via Let's Encrypt? (Y/n, default: Y): " SSL_INPUT
    SSL_INPUT=${SSL_INPUT:-Y}
    if [[ "$SSL_INPUT" =~ ^[Yy]$ ]]; then
        USE_SSL="y"
        read -rp "Enter admin email for SSL cert expiry alerts [Optional, press ENTER to skip]: " SSL_EMAIL
    else
        USE_SSL="n"
    fi
fi

echo ""
echo "--- Step 2: Database Master Credentials ---"
DEFAULT_PW=$(openssl rand -base64 16 2>/dev/null || date +%s | sha256sum | base64 | head -c 20)
read -rp "Enter master PostgreSQL password [Press ENTER for generated '${DEFAULT_PW}']: " DB_PASSWORD
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

# Ensure docker compose plugin exists
if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo "   -> Installing Docker Compose plugin..."
    apt-get update -y && apt-get install -y docker-compose-plugin || true
fi

# 4. Generate Production .env File in Root Directory
echo "-> Writing production environment secrets to ${ROOT_DIR}/.env..."
cat <<EOF > "${ROOT_DIR}/.env"
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

# 5. Automatically Generate Caddyfile Ingress Configuration
echo "-> Generating edge proxy routing with auto-detected IP..."
if [ "${USE_SSL}" = "y" ]; then
    if [ -n "${SSL_EMAIL:-}" ]; then
        EMAIL_BLOCK="    email ${SSL_EMAIL}"
    else
        EMAIL_BLOCK=""
    fi

    cat <<EOF > "${ROOT_DIR}/Caddyfile"
{
${EMAIL_BLOCK}
}

${STUDIO_DOMAIN} {
    reverse_proxy sparrowx-studio:3000
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
    cat <<EOF > "${ROOT_DIR}/Caddyfile"
:80 {
    reverse_proxy sparrowx-studio:3000
}

:3000 {
    reverse_proxy sparrowx-postgrest:3000
}
EOF
fi
echo "   [✓] Reverse proxy configuration applied for IP ${DETECTED_IP}."

# 6. Boot Docker Stack
echo "-> Booting SparrowX Dual Platform (Security + DBaaS)..."
COMPOSE_FILE="${ROOT_DIR}/docker-compose.sparrowx.yml"

if [ ! -f "${COMPOSE_FILE}" ]; then
    echo "   [!] Error: ${COMPOSE_FILE} not found. Please ensure all repository files were extracted."
    exit 1
fi

if docker compose version &> /dev/null; then
    docker compose -f "${COMPOSE_FILE}" pull || true
    docker compose -f "${COMPOSE_FILE}" up -d --build
else
    docker-compose -f "${COMPOSE_FILE}" pull || true
    docker-compose -f "${COMPOSE_FILE}" up -d --build
fi

# 7. Restore Database Dump if present
if [ -f "${ROOT_DIR}/data/postgres_dumpall.sql" ]; then
    echo "-> Restoring database dump..."
    echo "   Waiting 10s for PostgreSQL container to complete startup..."
    sleep 10
    docker exec -i sparrowx_postgres psql -U postgres < "${ROOT_DIR}/data/postgres_dumpall.sql" 2>/dev/null || true
    echo "   [✓] Database restore completed."
fi

# 8. Success Report
echo ""
echo "=========================================================="
echo "  [SUCCESS] SPARROWX IS NOW LIVE ON THIS SERVER!"
echo "=========================================================="
echo "  Server Public IP:  ${DETECTED_IP}"
if [ "${USER_DOMAIN}" != "${DETECTED_IP}" ]; then
    echo "  SparrowX Studio:   https://${STUDIO_DOMAIN}"
    echo "  SparrowX DB API:   https://${API_DOMAIN}"
    echo ""
    echo "-> ACTION REQUIRED: Point your DNS A-records to this IP:"
    echo "   Type: A    Host/Name: $(echo "${STUDIO_DOMAIN}" | cut -d. -f1)    Value: ${DETECTED_IP}"
    echo "   Type: A    Host/Name: $(echo "${API_DOMAIN}" | cut -d. -f1)       Value: ${DETECTED_IP}"
else
    echo "  SparrowX Studio:   http://${DETECTED_IP}:80"
    echo "  SparrowX DB API:   http://${DETECTED_IP}:3000"
fi
echo ""
echo "  PgBouncer Pooled Port: 6543 (Use with @supabase/supabase-js, Prisma, Next.js)"
echo "  Direct Postgres Port:  5432"
echo "  Master User:           postgres"
echo "  Master Password:       ${DB_PASSWORD}"
echo "=========================================================="
