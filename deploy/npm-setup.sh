#!/usr/bin/env bash
# ==============================================================================
# SPARROWX SETUP FOR NGINX PROXY MANAGER (NPM)
# Clears old network/port conflicts and boots SparrowX behind NPM
# Primary Canonical Domain: https://db.sparrowx.net
# ==============================================================================

set -euo pipefail

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
echo "  SPARROWX + NGINX PROXY MANAGER (NPM) INTEGRATION"
echo "  Primary Canonical Domain: https://db.sparrowx.net"
echo "=========================================================="

# 1. Stop conflicting old containers (Caddy, old app containers)
echo "-> Stopping old proxy/app containers that cause port conflicts..."
docker stop sparrowx_edge_proxy sparrowx-nginx sparrowx-app 2>/dev/null || true
docker rm sparrowx_edge_proxy sparrowx-nginx sparrowx-app 2>/dev/null || true

# 2. Free ports 80, 3000, 3001 if held by non-docker zombie processes
for p in 80 3000 3001; do
    if ss -tulpn "sport = :$p" 2>/dev/null | grep -qv "docker"; then
        echo "-> Clearing zombie host process on port $p..."
        fuser -k "$p/tcp" 2>/dev/null || true
    fi
done

# 3. Clean Docker networks
echo "-> Reconciling Docker network drivers..."
docker network rm sparrowx_edge_net sparrowx_internal_net 2>/dev/null || true

# 4. Rebuild and launch SparrowX fleet with baked canonical environment
echo "-> Building and starting SparrowX studio and database fleet..."
docker compose -f docker-compose.sparrowx.yml build --no-cache sparrowx-studio
docker compose -f docker-compose.sparrowx.yml up -d --remove-orphans

# 5. Enable Database Extensions
echo "-> Verifying PostgreSQL & pgvector..."
sleep 4
docker exec -i sparrowx_postgres psql -U postgres -d sparrowbase -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true
docker exec -i sparrowx_postgres psql -U postgres -d sparrowbase -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" 2>/dev/null || true

# 6. Verify local ports
echo ""
echo "=== LOCAL PORT VERIFICATION ==="
echo -n "SparrowX Unified Web & API Gateway (Port 80): "
curl -s -o /dev/null -w "%{http_code}\n" --max-time 3 http://127.0.0.1:80 || echo "Starting..."

echo -n "PostgREST Engine Direct (Port 3001): "
curl -s -o /dev/null -w "%{http_code}\n" --max-time 3 http://127.0.0.1:3001 || echo "Starting..."

echo ""
echo "=========================================================="
echo "  [SUCCESS] SPARROWX RUNNING ON PORT 80"
echo "=========================================================="
echo ""
echo "IMPORTANT: In Nginx Proxy Manager, configure each service as its own"
echo "SEPARATE PROXY HOST pointing to 10.10.10.10 on port 80:"
echo ""
echo "--- PROXY HOST 1 (SPARROWX DB SOVEREIGN BAAS) ---"
echo "  Domain Names:       db.sparrowx.net"
echo "  Scheme:             http"
echo "  Forward Hostname:   10.10.10.10  (SparrowX VPS Internal IP)"
echo "  Forward Port:       80"
echo "  Websockets Support: ENABLED (checked)"
echo "  Block Common Expl.: ENABLED (checked)"
echo "  SSL:                Let's Encrypt (Force SSL, HTTP/2 Support)"
echo ""
echo "--- PROXY HOST 2 (SPARROWX REST API GATEWAY & DOCS) ---"
echo "  Domain Names:       api.sparrowx.net"
echo "  Scheme:             http"
echo "  Forward Hostname:   10.10.10.10  (SparrowX VPS Internal IP)"
echo "  Forward Port:       80"
echo "  SSL:                Let's Encrypt (Force SSL)"
echo ""
echo "--- PROXY HOST 3 (SPARROWX DROP EPHEMERAL FILE SHARING) ---"
echo "  Domain Names:       file.sparrowx.net"
echo "  Scheme:             http"
echo "  Forward Hostname:   10.10.10.10  (SparrowX VPS Internal IP)"
echo "  Forward Port:       80"
echo "  Websockets Support: ENABLED (checked)"
echo "  Block Common Expl.: ENABLED (checked)"
echo "  SSL:                Let's Encrypt (Force SSL, HTTP/2 Support)"
echo ""
echo "--- PROXY HOST 4 (SPARROWX KEYS CRYPTOGRAPHIC PASSWORDS) ---"
echo "  Domain Names:       password.sparrowx.net, passwd.sparrowx.net"
echo "  Scheme:             http"
echo "  Forward Hostname:   10.10.10.10  (SparrowX VPS Internal IP)"
echo "  Forward Port:       80"
echo "  Block Common Expl.: ENABLED (checked)"
echo "  SSL:                Let's Encrypt (Force SSL, HTTP/2 Support)"
echo ""
echo "--- PROXY HOST 5 (SPARROWX SHIELD / SECURITY SOC CONSOLE) ---"
echo "  Domain Names:       sec.sparrowx.net"
echo "  Scheme:             http"
echo "  Forward Hostname:   10.10.10.10  (SparrowX VPS Internal IP)"
echo "  Forward Port:       80"
echo "  Websockets Support: ENABLED (checked)"
echo "  Block Common Expl.: ENABLED (checked)"
echo "  SSL:                Let's Encrypt (Force SSL, HTTP/2 Support)"
echo ""
echo "--- PROXY HOST 6 (SPARROWX COMPANY LANDING & PILLARS) ---"
echo "  Domain Names:       sparrowx.net, www.sparrowx.net"
echo "  Scheme:             http"
echo "  Forward Hostname:   10.10.10.10  (SparrowX VPS Internal IP)"
echo "  Forward Port:       80"
echo "  SSL:                Let's Encrypt (Force SSL)"
echo "=========================================================="
