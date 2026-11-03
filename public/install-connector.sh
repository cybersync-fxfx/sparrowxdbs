#!/usr/bin/env bash
# ==============================================================================
# SPARROWX AUTONOMOUS SERVER & VPS CONNECTOR INSTALLER
# ==============================================================================
# Usage:
#   curl -sSL https://sparrowx.net/install-connector.sh | SPX_KEY="YOUR_KEY" SPX_TENANT="YOUR_TENANT_ID" bash
# ==============================================================================

set -e

SPX_KEY="${SPX_KEY:-}"
SPX_TENANT="${SPX_TENANT:-}"
SPX_ENDPOINT="${SPX_ENDPOINT:-https://sparrowx.net/api/v1/verify}"
SPX_TELEMETRY="${SPX_TELEMETRY:-https://sparrowx.net/api/v1/telemetry}"

echo "=========================================================="
echo "  SPARROWX SOVEREIGN VPS & SERVER CONNECTOR INSTALLER     "
echo "=========================================================="

if [ -z "$SPX_KEY" ] || [ -z "$SPX_TENANT" ]; then
  echo "[-] ERROR: Missing SPX_KEY or SPX_TENANT environment variables."
  echo "    Example:"
  echo "    curl -sSL https://sparrowx.net/install-connector.sh | SPX_KEY=\"spx_live_...\" SPX_TENANT=\"TNT-...\" bash"
  exit 1
fi

echo "[+] Verifying server environment..."
HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
HOSTNAME=$(hostname 2>/dev/null || echo "vps-node")

echo "[+] Target Host: $HOSTNAME ($HOST_IP)"
echo "[+] Ingestion Key: ${SPX_KEY:0:14}..."
echo "[+] Tenant ID: $SPX_TENANT"

# Perform initial handshake with SparrowX backend
echo "[+] Establishing cryptographic handshake with SparrowX Edge..."
HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SPX_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-sparrowx-key: $SPX_KEY" \
  -d "{\"apiKey\":\"$SPX_KEY\",\"tenantId\":\"$SPX_TENANT\",\"source\":\"$HOSTNAME\",\"serverIp\":\"$HOST_IP\",\"type\":\"vps_connector_install\"}")

if [ "$HTTP_RESPONSE" -eq 200 ] || [ "$HTTP_RESPONSE" -eq 204 ]; then
  echo "[✓] SUCCESS: Handshake confirmed (HTTP $HTTP_RESPONSE)."
  echo "[✓] Sovereign server defense is now ACTIVE for $HOSTNAME."
  echo "[✓] Your SparrowX dashboard will show this server as Connected."
else
  echo "[!] WARNING: Handshake returned HTTP $HTTP_RESPONSE. Check your API key in SparrowX Settings."
fi

# Create SparrowX configuration directory if root
if [ "$(id -u)" -eq 0 ]; then
  mkdir -p /etc/sparrowx
  cat <<EOF > /etc/sparrowx/connector.conf
SPX_KEY=$SPX_KEY
SPX_TENANT=$SPX_TENANT
SPX_ENDPOINT=$SPX_ENDPOINT
SPX_TELEMETRY=$SPX_TELEMETRY
SPX_HOST_IP=$HOST_IP
EOF
  chmod 600 /etc/sparrowx/connector.conf
  echo "[+] Configuration saved to /etc/sparrowx/connector.conf"
fi

echo "=========================================================="
echo "  INSTALLATION COMPLETED SUCCESSFULLY                     "
echo "=========================================================="
