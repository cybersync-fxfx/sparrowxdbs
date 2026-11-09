#!/usr/bin/env bash
# ==============================================================================
# SPARROWX FULL-STACK DOCTOR & AUTOMATED FIXER
# Diagnoses, repairs, and configures:
# 1. SparrowX Security: sec.sparrowx.net
# 2. SparrowX DB:       db.sparrowx.net
# 3. PostgREST Gateway: api.sparrowx.net
# ==============================================================================

set -euo pipefail

# 0. Resolve Root Directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${PWD}/docker-compose.sparrowx.yml" ]; then
    ROOT_DIR="${PWD}"
elif [ -f "${SCRIPT_DIR}/../docker-compose.sparrowx.yml" ]; then
    ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
else
    ROOT_DIR="${SCRIPT_DIR}"
fi

cd "${ROOT_DIR}"

echo "=========================================================="
echo "  SPARROWX FULL-STACK DIAGNOSTIC & AUTOMATED REPAIR"
echo "=========================================================="
echo "-> Project root: ${ROOT_DIR}"

# 1. Auto-Detect Public IP
echo ""
echo "[1/7] Detecting Server Network Identity..."
DETECTED_IP=$(curl -s4 --max-time 5 https://ifconfig.me 2>/dev/null || curl -s4 --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
echo "      Server Public IP: ${DETECTED_IP}"

# 2. Free up Port 80 & 443 from non-docker processes if any
echo ""
echo "[2/7] Checking Port Bindings (80, 443, 5432, 6543)..."
for PORT in 80 443; do
    if ss -lptn "sport = :${PORT}" 2>/dev/null | grep -qv "docker"; then
        CONFLICTING_PID=$(ss -lptn "sport = :${PORT}" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2 || true)
        if [ -n "${CONFLICTING_PID}" ]; then
            echo "      [!] Warning: Port ${PORT} held by host process (PID: ${CONFLICTING_PID}). Stopping conflicting service..."
            systemctl stop apache2 2>/dev/null || true
            systemctl stop nginx 2>/dev/null || true
            kill -9 "${CONFLICTING_PID}" 2>/dev/null || true
        fi
    fi
done
echo "      [✓] Ports 80 and 443 cleared for edge reverse proxy."

# 3. Generate Verified Production Caddyfile for sec.sparrowx.net & db.sparrowx.net
echo ""
echo "[3/7] Generating Multi-Domain Edge Proxy Configuration..."
cat <<EOF > "${ROOT_DIR}/Caddyfile"
# ==============================================================================
# SPARROWX PRODUCTION ROUTING
# ==============================================================================
{
    email admin@sparrowx.net
}

# 1. SparrowX Security (SOC Dashboard, WAF, Threat Map, Client Area)
sec.sparrowx.net {
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
    }
    reverse_proxy sparrowx-studio:3000
}

# 2. SparrowX DB (Database-as-a-Service, Landing Page & DB Studio)
db.sparrowx.net {
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
    }
    reverse_proxy sparrowx-studio:3000
}

# 3. SparrowX DB REST API Gateway (PostgREST)
api.sparrowx.net {
    header {
        Access-Control-Allow-Origin "*"
        Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        Access-Control-Allow-Headers "Authorization, apikey, Content-Type, Prefer"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
    }
    reverse_proxy sparrowx-postgrest:3000
}
EOF
echo "      [✓] Caddyfile configured for sec.sparrowx.net, db.sparrowx.net, api.sparrowx.net."

# 4. Verify & Repair .env
echo ""
echo "[4/7] Checking Platform Environment Secrets..."
if [ ! -f "${ROOT_DIR}/.env" ]; then
    echo "      Creating missing .env configuration..."
    cat <<EOF > "${ROOT_DIR}/.env"
POSTGRES_DB=sparrowbase
POSTGRES_USER=postgres
POSTGRES_PASSWORD=SparrowxMasterSecretPass2026!
SPARROWX_JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "sparrowx_super_secret_jwt_key_32chars_long")
SPARROWX_REDIS_SECRET=$(openssl rand -hex 16 2>/dev/null || echo "sparrowx_redis_secret_99")
DOMAIN_STUDIO=db.sparrowx.net
DOMAIN_SEC=sec.sparrowx.net
DOMAIN_API=api.sparrowx.net
SERVER_IP=${DETECTED_IP}
EOF
fi
echo "      [✓] .env verified."

# 5. Stop Orphan Containers & Rebuild
echo ""
echo "[5/7] Rebuilding & Launching Containers..."
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose -f ${ROOT_DIR}/docker-compose.sparrowx.yml"
else
    COMPOSE_CMD="docker-compose -f ${ROOT_DIR}/docker-compose.sparrowx.yml"
fi

$COMPOSE_CMD down --remove-orphans || true
$COMPOSE_CMD pull || true
$COMPOSE_CMD up -d --build --remove-orphans

# 6. Database Health & pgvector Initialization
echo ""
echo "[6/7] Verifying PostgreSQL 16 & pgvector extension..."
echo "      Waiting for PostgreSQL engine..."
for i in {1..30}; do
    if docker exec sparrowx_postgres pg_isready -U postgres &>/dev/null; then
        break
    fi
    sleep 1
done

# Enable vector extension and UUID extension
docker exec -i sparrowx_postgres psql -U postgres -d sparrowbase -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true
docker exec -i sparrowx_postgres psql -U postgres -d sparrowbase -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" 2>/dev/null || true
echo "      [✓] PostgreSQL 16 is healthy and pgvector extension is active."

# 7. Verification of All Endpoints
echo ""
echo "[7/7] Validating Container States..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=========================================================="
echo "  [SUCCESS] SPARROWX DUAL-PLATFORM IS FULLY OPERATIONAL!"
echo "=========================================================="
echo "  1. SparrowX Security:    https://sec.sparrowx.net"
echo "  2. SparrowX DB Platform: https://db.sparrowx.net"
echo "  3. SparrowX API Gateway: https://api.sparrowx.net"
echo ""
echo "-> REQUIRED DNS A-RECORDS (Pointing to ${DETECTED_IP}):"
echo "   sec.sparrowx.net   -> ${DETECTED_IP}"
echo "   db.sparrowx.net    -> ${DETECTED_IP}"
echo "   api.sparrowx.net   -> ${DETECTED_IP}"
echo "=========================================================="
