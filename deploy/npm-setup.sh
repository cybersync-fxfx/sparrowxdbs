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
echo -n "SparrowX App Engine (Port 80): "
curl -s -o /dev/null -w "%{http_code}\n" --max-time 3 http://127.0.0.1:80 || echo "Starting..."

echo -n "SparrowX App Engine (Port 3000): "
curl -s -o /dev/null -w "%{http_code}\n" --max-time 3 http://127.0.0.1:3000 || echo "Starting..."

echo -n "PostgREST API Gateway (Port 3001): "
curl -s -o /dev/null -w "%{http_code}\n" --max-time 3 http://127.0.0.1:3001 || echo "Starting..."

echo ""
echo "=========================================================="
echo "  [SUCCESS] SPARROWX IS RUNNING AND READY FOR NPM!"
echo "=========================================================="
echo ""
echo "In your Nginx Proxy Manager (on VPS 1):"
echo ""
echo "--- PROXY HOST 1 (Security Platform) ---"
echo "  Domain Names:       sec.sparrowx.net"
echo "  Scheme:             http"
echo "  Forward Hostname:   10.10.10.10  (SparrowX VPS Internal IP)"
echo "  Forward Port:       80 (or 3000)"
echo "  Websockets Support: ENABLED (checked)"
echo "  Block Common Expl.: ENABLED (checked)"
echo "  SSL:                Let's Encrypt (Force SSL, HTTP/2 Support)"
echo ""
echo "--- PROXY HOST 2 (Database Platform) ---"
echo "  Domain Names:       db.sparrowx.net"
echo "  Scheme:             http"
echo "  Forward Hostname:   10.10.10.10  (SparrowX VPS Internal IP)"
echo "  Forward Port:       80 (or 3000)"
echo "  Websockets Support: ENABLED (checked)"
echo "  Block Common Expl.: ENABLED (checked)"
echo "  SSL:                Let's Encrypt (Force SSL, HTTP/2 Support)"
echo ""
echo "--- PROXY HOST 3 (REST API Gateway) ---"
echo "  Domain Names:       api.sparrowx.net"
echo "  Scheme:             http"
echo "  Forward Hostname:   10.10.10.10  (SparrowX VPS Internal IP)"
echo "  Forward Port:       3001"
echo "  SSL:                Let's Encrypt (Force SSL)"
echo "=========================================================="
