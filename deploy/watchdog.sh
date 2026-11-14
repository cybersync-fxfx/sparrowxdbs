#!/usr/bin/env bash
# ==============================================================================
# SPARROWX AUTONOMOUS WATCHDOG & LIVE PING AUTO-HEALER
# Runs via cron every 2 minutes to guarantee 99.99% uptime across all domains.
# ==============================================================================
set -u

INSTALL_DIR="/opt/sparrowx"
[ -f "./docker-compose.standalone.yml" ] && INSTALL_DIR="$(pwd)"
cd "${INSTALL_DIR}" 2>/dev/null || exit 0

LOG_FILE="/var/log/sparrowx-watchdog.log"
[ -f "${INSTALL_DIR}/.env" ] && source "${INSTALL_DIR}/.env" 2>/dev/null || true

HTTP_PORT="${HTTP_PORT:-80}"
APP_HOST_PORT="${APP_HOST_PORT:-3000}"
COMPOSE_FILE="${INSTALL_DIR}/docker-compose.standalone.yml"

log_wd() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "${LOG_FILE}" 2>/dev/null || true
}

# Rotate log if > 5MB
if [ -f "${LOG_FILE}" ] && [ "$(wc -c < "${LOG_FILE}" 2>/dev/null || echo 0)" -gt 5242880 ]; then
  tail -n 500 "${LOG_FILE}" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "${LOG_FILE}"
fi

# 1. Ensure Docker daemon is alive
if command -v docker >/dev/null 2>&1; then
  if ! docker info >/dev/null 2>&1; then
    log_wd "HEAL: Docker daemon stopped. Restarting..."
    systemctl restart containerd docker >/dev/null 2>&1 || true
    sleep 3
  fi

  # 2. Check if any non-Docker process hijacked port 80/443
  for p in 80 443; do
    if ss -tulpn "sport = :${p}" 2>/dev/null | grep -qE "apache2|nginx|httpd|lighttpd" && ! ss -tulpn "sport = :${p}" 2>/dev/null | grep -q "docker-proxy"; then
      log_wd "HEAL: Host webserver detected on port ${p}. Stopping host service..."
      systemctl stop apache2 nginx lighttpd httpd >/dev/null 2>&1 || true
      systemctl disable apache2 lighttpd httpd >/dev/null 2>&1 || true
      fuser -k "${p}/tcp" >/dev/null 2>&1 || true
    fi
  done

  # 3. Verify all 6 core containers are running
  REQUIRED_CONTAINERS="sparrowx_postgres sparrowx_pgbouncer sparrowx_postgrest sparrowx_threat_cache sparrowx_studio sparrowx_edge_proxy"
  MISSING=0
  for cname in ${REQUIRED_CONTAINERS}; do
    if ! docker ps --format '{{.Names}}' | grep -qx "${cname}"; then
      log_wd "HEAL: Container ${cname} is down!"
      MISSING=1
    fi
  done

  if [ "${MISSING}" -eq 1 ] && [ -f "${COMPOSE_FILE}" ]; then
    log_wd "HEAL: Reconciling SparrowX container fleet..."
    docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans >/dev/null 2>&1 || true
    sleep 4
  fi

  # 4. Live HTTP Health Probe on Proxy & App
  PROXY_CODE="$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:${HTTP_PORT}/api/v1/health" 2>/dev/null || echo "000")"
  if [ "${PROXY_CODE}" != "200" ]; then
    log_wd "HEAL: Proxy health probe returned HTTP ${PROXY_CODE}. Restarting studio & proxy..."
    docker restart sparrowx_studio sparrowx_edge_proxy >/dev/null 2>&1 || true
    sleep 3
  fi
fi

# 5. Native fallback check if Docker is not active
if systemctl is-enabled --quiet sparrowx-native.service 2>/dev/null; then
  if ! systemctl is-active --quiet sparrowx-native.service 2>/dev/null; then
    log_wd "HEAL: Restarting sparrowx-native.service..."
    systemctl restart sparrowx-native.service >/dev/null 2>&1 || true
  fi
fi
