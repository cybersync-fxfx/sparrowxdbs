#!/usr/bin/env bash
# ==============================================================================
# SPARROWX INSTANT STATUS, DDOS SHIELD & LOG VIEWER (READ-ONLY)
# ==============================================================================
echo "=========================================================="
echo "  SPARROWX PLATFORM: SYSTEM, CONTAINER & DDOS STATUS"
echo "=========================================================="

echo ""
echo "--- 1. Running Docker Containers ---"
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Docker unavailable"

echo ""
echo "--- 2. Listening Ports (80, 443, 3000, 3001, 3005, 3006, 5432, 6543, 8090) ---"
ss -tulpn 2>/dev/null | grep -E ':(80|443|3000|3001|3005|3006|5432|6543|8090)\b' || \
  netstat -tulpn 2>/dev/null | grep -E ':(80|443|3000|3001|3005|3006|5432|6543|8090)\b' || true

echo ""
echo "--- 3. L3/L4 Kernel DDoS & XDP Filter Status ---"
echo "  net.ipv4.tcp_syncookies          = $(sysctl -n net.ipv4.tcp_syncookies 2>/dev/null || echo n/a)"
echo "  net.ipv4.conf.all.rp_filter      = $(sysctl -n net.ipv4.conf.all.rp_filter 2>/dev/null || echo n/a)"
echo "  net.ipv4.tcp_congestion_control  = $(sysctl -n net.ipv4.tcp_congestion_control 2>/dev/null || echo n/a)"
if command -v ip >/dev/null 2>&1; then
  IFACE="$(ip route show default 2>/dev/null | awk '/default/ {print $5; exit}' || true)"
  if [ -n "${IFACE}" ]; then
    echo "  Default Interface (${IFACE}) XDP:"
    ip -details link show dev "${IFACE}" 2>/dev/null | grep -E "mtu|xdp|prog" || true
  fi
fi

echo ""
echo "--- 4. Web Proxy Container Logs ---"
if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-nginx"; then
  docker logs sparrowx-nginx --tail 20 2>&1
elif docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "sparrowx_edge_proxy"; then
  docker logs sparrowx_edge_proxy --tail 20 2>&1
else
  echo "No proxy container found."
fi

echo ""
echo "--- 5. App Engine Logs ---"
if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-app"; then
  docker logs sparrowx-app --tail 20 2>&1
elif docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "sparrowx_studio"; then
  docker logs sparrowx_studio --tail 20 2>&1
else
  echo "No app container found."
fi

echo ""
echo "--- 6. Local Health Probe ---"
echo -n "Checking 127.0.0.1:80/api/v1/health (Proxy): "
curl -s -o /dev/null -w "%{http_code}\n" --max-time 3 http://127.0.0.1:80/api/v1/health || echo "Connection Failed"
echo -n "Checking 127.0.0.1:3000/api/v1/health (App): "
curl -s -o /dev/null -w "%{http_code}\n" --max-time 3 http://127.0.0.1:3000/api/v1/health || echo "Connection Failed"
echo "=========================================================="
