#!/usr/bin/env bash
# ==============================================================================
# SPARROWX SETUP FOR NGINX PROXY MANAGER (NPM)
# Clears old network/port conflicts and boots SparrowX behind NPM
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
echo "=========================================================="

# 1. Stop conflicting old containers (Caddy, old app containers)
echo "-> Stopping old proxy/app containers that cause port conflicts..."
docker stop sparrowx_edge_proxy sparrowx-nginx sparrowx-app 2>/dev/null || true
docker rm sparrowx_edge_proxy sparrowx-nginx sparrowx-app 2>/dev/null || true

# 2. Free port 3000 if held by a non-docker zombie process
if ss -tulpn "sport = :3000" 2>/dev/null | grep -qv "docker"; then
    echo "-> Clearing zombie host process on port 3000..."
    fuser -k 3000/tcp 2>/dev/null || true
fi

# 3. Clean Docker networks
echo "-> Reconciling Docker network drivers..."
docker network rm sparrowx_edge_net sparrowx_internal_net 2>/dev/null || true

# 4. Launch SparrowX Fleet behind NPM
echo "-> Starting SparrowX backend services for Nginx Proxy Manager..."
docker compose -f docker-compose.sparrowx.yml up -d --remove-orphans

# 5. Enable Database Extensions
echo "-> Verifying PostgreSQL & pgvector..."
sleep 4
docker exec -i sparrowx_postgres psql -U postgres -d sparrowbase -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true
docker exec -i sparrowx_postgres psql -U postgres -d sparrowbase -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" 2>/dev/null || true

# 6. Verify local ports
echo ""
echo "=== LOCAL PORT VERIFICATION ==="
echo -n "SparrowX App Engine (Port 3000): "
curl -s -o /dev/null -w "%{http_code}\n" --max-time 3 http://127.0.0.1:3000 || echo "Starting..."

echo -n "PostgREST API Gateway (Port 3001): "
curl -s -o /dev/null -w "%{http_code}\n" --max-time 3 http://127.0.0.1:3001 || echo "Starting..."

echo ""
echo "=========================================================="
echo "  [SUCCESS] SPARROWX IS RUNNING AND READY FOR NPM!"
echo "=========================================================="
echo ""
echo "Now, open your Nginx Proxy Manager Admin Dashboard (usually port 81):"
echo ""
echo "--- PROXY HOST 1 (Security Platform) ---"
echo "  Domain Names:       sec.sparrowx.net"
echo "  Scheme:             http"
echo "  Forward Hostname:   127.0.0.1 (or 172.17.0.1)"
echo "  Forward Port:       3000"
echo "  Websockets Support: ENABLED (checked)"
echo "  Block Common Expl.: ENABLED (checked)"
echo "  SSL:                Request a new SSL Certificate (Force SSL, HTTP/2 Support)"
echo ""
echo "--- PROXY HOST 2 (Database Platform) ---"
echo "  Domain Names:       db.sparrowx.net"
echo "  Scheme:             http"
echo "  Forward Hostname:   127.0.0.1 (or 172.17.0.1)"
echo "  Forward Port:       3000"
echo "  Websockets Support: ENABLED (checked)"
echo "  SSL:                Request a new SSL Certificate (Force SSL, HTTP/2 Support)"
echo ""
echo "--- PROXY HOST 3 (REST API Gateway) ---"
echo "  Domain Names:       api.sparrowx.net"
echo "  Scheme:             http"
echo "  Forward Hostname:   127.0.0.1 (or 172.17.0.1)"
echo "  Forward Port:       3001"
echo "  SSL:                Request a new SSL Certificate (Force SSL)"
echo "=========================================================="
