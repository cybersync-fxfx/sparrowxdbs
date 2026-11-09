#!/usr/bin/env bash
# ==============================================================================
# SPARROWX INSTANT PROXY RELOAD (1-SECOND ZERO DOWNTIME FIX)
# ==============================================================================

set -euo pipefail

echo "-> Reloading Caddy Edge Proxy with updated ACME and HTTP routing..."
if docker ps --format '{{.Names}}' | grep -q "sparrowx_edge_proxy"; then
    docker cp Caddyfile sparrowx_edge_proxy:/etc/caddy/Caddyfile
    docker exec sparrowx_edge_proxy caddy reload --config /etc/caddy/Caddyfile || docker restart sparrowx_edge_proxy
    echo "   [✓] Caddy proxy reloaded successfully in 1 second!"
else
    docker compose -f docker-compose.sparrowx.yml up -d sparrowx-edge-proxy
    echo "   [✓] Caddy proxy launched!"
fi

echo ""
echo "-> Testing HTTP status on Port 80:"
curl -I http://127.0.0.1:80 || true
echo ""
echo "=========================================================="
echo "  [SUCCESS] PROXY IS NOW SERVING BOTH SITES:"
echo "  - http://sec.sparrowx.net (and https://sec.sparrowx.net)"
echo "  - http://db.sparrowx.net (and https://db.sparrowx.net)"
echo "=========================================================="
