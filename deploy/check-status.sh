#!/usr/bin/env bash
# ==============================================================================
# SPARROWX INSTANT STATUS & LOG VIEWER (READ-ONLY)
# Shows container states, port bindings, and recent logs without modifying anything
# ==============================================================================

echo "=========================================================="
echo "  SPARROWX PLATFORM: SYSTEM STATUS & LOGS"
echo "=========================================================="

echo ""
echo "--- 1. Running Docker Containers ---"
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "--- 2. Port 80, 443, 3000, 5432, 6543 Listening Status ---"
ss -tulpn 2>/dev/null | grep -E ':(80|443|3000|5432|6543)\b' || netstat -tulpn 2>/dev/null | grep -E ':(80|443|3000|5432|6543)\b' || true

echo ""
echo "--- 3. Web Proxy Container Logs (sparrowx_edge_proxy or sparrowx-nginx) ---"
if docker ps -a --format '{{.Names}}' | grep -q "sparrowx_edge_proxy"; then
    docker logs sparrowx_edge_proxy --tail 25 2>&1
elif docker ps -a --format '{{.Names}}' | grep -q "sparrowx-nginx"; then
    docker logs sparrowx-nginx --tail 25 2>&1
else
    echo "No proxy container found."
fi

echo ""
echo "--- 4. App Engine Logs (sparrowx_studio or sparrowx-app) ---"
if docker ps -a --format '{{.Names}}' | grep -q "sparrowx_studio"; then
    docker logs sparrowx_studio --tail 25 2>&1
elif docker ps -a --format '{{.Names}}' | grep -q "sparrowx-app"; then
    docker logs sparrowx-app --tail 25 2>&1
else
    echo "No app container found."
fi

echo ""
echo "--- 5. Local HTTP Response Check ---"
echo -n "Checking 127.0.0.1:80 (Proxy): "
curl -s -o /dev/null -w "%{http_code}\n" --max-time 3 http://127.0.0.1:80 || echo "Connection Failed"

echo -n "Checking 127.0.0.1:3000 (App): "
curl -s -o /dev/null -w "%{http_code}\n" --max-time 3 http://127.0.0.1:3000 || echo "Connection Failed"

echo "=========================================================="
