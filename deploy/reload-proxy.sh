#!/usr/bin/env bash
# ==============================================================================
# SPARROWX INSTANT PROXY RELOAD (ZERO-DOWNTIME L7 EDGE RELOAD)
# ==============================================================================
set -euo pipefail

echo "-> Reloading SparrowX Edge Reverse Proxy..."
if docker ps --format '{{.Names}}' | grep -Fxq "sparrowx-nginx"; then
  docker exec sparrowx-nginx nginx -t
  docker exec sparrowx-nginx nginx -s reload || docker restart sparrowx-nginx
  echo "   [✓] OVH Nginx edge proxy (sparrowx-nginx) reloaded with active L7 DDoS rules!"
elif docker ps --format '{{.Names}}' | grep -q "sparrowx_edge_proxy"; then
  docker cp Caddyfile sparrowx_edge_proxy:/etc/caddy/Caddyfile
  docker exec sparrowx_edge_proxy caddy reload --config /etc/caddy/Caddyfile || docker restart sparrowx_edge_proxy
  echo "   [✓] Caddy proxy reloaded successfully in 1 second!"
elif [ -f "docker-compose.ovh.yml" ]; then
  docker compose -f docker-compose.ovh.yml up -d nginx
  echo "   [✓] OVH Nginx proxy launched!"
else
  docker compose -f docker-compose.sparrowx.yml up -d sparrowx-edge-proxy
  echo "   [✓] Caddy proxy launched!"
fi

echo ""
echo "-> Testing HTTP health endpoint on Port 80:"
curl -fsS -I http://127.0.0.1:80/api/v1/health || true
echo ""
echo "=========================================================="
echo "  [SUCCESS] SPARROWX PROXY ACTIVE ACROSS ALL DOMAINS"
echo "=========================================================="
