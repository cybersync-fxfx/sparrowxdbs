#!/usr/bin/env bash
# ==============================================================================
# SPARROWX AUTONOMOUS WATCHDOG & LIVE PING AUTO-HEALER
# Runs via cron every 2 minutes to guarantee 99.99% uptime across all domains.
# ==============================================================================
set -u

INSTALL_DIR="/opt/sparrowxdbs"
if [ -f "./docker-compose.ovh.yml" ]; then
  INSTALL_DIR="$(pwd)"
elif [ -f "/opt/sparrowxdbs/docker-compose.ovh.yml" ]; then
  INSTALL_DIR="/opt/sparrowxdbs"
elif [ -f "/opt/sparrowx/docker-compose.ovh.yml" ]; then
  INSTALL_DIR="/opt/sparrowx"
elif [ -f "./docker-compose.standalone.yml" ]; then
  INSTALL_DIR="$(pwd)"
elif [ -f "/opt/sparrowx/docker-compose.standalone.yml" ]; then
  INSTALL_DIR="/opt/sparrowx"
fi
cd "${INSTALL_DIR}" 2>/dev/null || exit 0

LOG_FILE="/var/log/sparrowx-watchdog.log"
[ -f "${INSTALL_DIR}/.env" ] && source "${INSTALL_DIR}/.env" 2>/dev/null || true

HTTP_PORT="${HTTP_PORT:-80}"
HTTPS_PORT="${HTTPS_PORT:-443}"
APP_HOST_PORT="${APP_HOST_PORT:-3000}"
PTERO_PORT="${PTERO_PORT:-8090}"
SPARROWX_DOMAIN="${SPARROWX_DOMAIN:-${DOMAIN_ROOT:-sparrowx.net}}"
DOMAIN_GAME="${DOMAIN_GAME:-game.${SPARROWX_DOMAIN}}"

USE_OVH=1
COMPOSE_FILE="${INSTALL_DIR}/docker-compose.ovh.yml"
if [ ! -f "${COMPOSE_FILE}" ] && [ -f "${INSTALL_DIR}/docker-compose.standalone.yml" ]; then
  COMPOSE_FILE="${INSTALL_DIR}/docker-compose.standalone.yml"
  USE_OVH=0
fi

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
      if [ -d "/var/www/pterodactyl" ] && ss -tulpn "sport = :${p}" 2>/dev/null | grep -q "nginx"; then
        log_wd "HEAL: Host nginx reclaimed port ${p} with Pterodactyl installed; moving Pterodactyl onto :${PTERO_PORT}..."
        rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/pterodactyl.conf 2>/dev/null || true
        if [ -f "${INSTALL_DIR}/fix.sh" ]; then
          bash "${INSTALL_DIR}/fix.sh" --auto >> "${LOG_FILE}" 2>&1 || true
        else
          systemctl stop apache2 lighttpd httpd >/dev/null 2>&1 || true
          sed -i -E "s/listen[[:space:]]+(80|443)([^0-9;]*);/listen ${PTERO_PORT};/g" /etc/nginx/sites-available/pterodactyl.conf 2>/dev/null || true
          nginx -t >/dev/null 2>&1 && systemctl restart nginx >/dev/null 2>&1 || systemctl stop nginx >/dev/null 2>&1 || true
        fi
      else
        log_wd "HEAL: Host webserver detected on port ${p}. Stopping host service..."
        systemctl stop apache2 nginx lighttpd httpd >/dev/null 2>&1 || true
        systemctl disable apache2 lighttpd httpd >/dev/null 2>&1 || true
        fuser -k "${p}/tcp" >/dev/null 2>&1 || true
      fi
    fi
  done

  # 3. Verify all core containers are running
  if [ "${USE_OVH}" -eq 1 ]; then
    REQUIRED_CONTAINERS="sparrowx-postgres sparrowx-postgrest sparrowx-app sparrowx-nginx"
    APP_CNAME="sparrowx-app"
    PROXY_CNAME="sparrowx-nginx"
  else
    REQUIRED_CONTAINERS="sparrowx_postgres sparrowx_pgbouncer sparrowx_postgrest sparrowx_threat_cache sparrowx_studio sparrowx_edge_proxy"
    APP_CNAME="sparrowx_studio"
    PROXY_CNAME="sparrowx_edge_proxy"
  fi

  MISSING=0
  for cname in ${REQUIRED_CONTAINERS}; do
    if ! docker ps --format '{{.Names}}' | grep -qx "${cname}"; then
      log_wd "HEAL: Container ${cname} is down!"
      MISSING=1
    fi
  done

  if [ "${MISSING}" -eq 1 ] && [ -f "${COMPOSE_FILE}" ]; then
    log_wd "HEAL: Reconciling SparrowX container fleet (${COMPOSE_FILE})..."
    docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans >/dev/null 2>&1 || true
    sleep 4
  fi

  # 4. Live HTTP Health Probe on Proxy & App
  PROXY_CODE="$(curl -kso /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:${HTTP_PORT}/api/v1/health" 2>/dev/null || echo "000")"
  if ! echo "${PROXY_CODE}" | grep -qE "^(200|301|302)$"; then
    log_wd "HEAL: Proxy health probe returned HTTP ${PROXY_CODE}. Restarting ${APP_CNAME} & ${PROXY_CNAME}..."
    docker restart "${APP_CNAME}" "${PROXY_CNAME}" >/dev/null 2>&1 || true
    sleep 3
  fi

  # 5. Live Pterodactyl Game Panel connectivity check
  if [ -d "/var/www/pterodactyl" ] && [ -f "/var/www/pterodactyl/.env" ]; then
    for fpm_svc in php8.4-fpm php8.3-fpm php8.2-fpm php8.1-fpm php8.0-fpm; do
      if systemctl list-unit-files 2>/dev/null | grep -q "^${fpm_svc}.service" && ! systemctl is-active --quiet "${fpm_svc}" 2>/dev/null; then
        log_wd "HEAL: Starting stopped ${fpm_svc} for Pterodactyl..."
        systemctl start "${fpm_svc}" >/dev/null 2>&1 || true
      fi
    done
    if systemctl list-unit-files 2>/dev/null | grep -q "^pteroq.service" && ! systemctl is-active --quiet pteroq 2>/dev/null; then
      log_wd "HEAL: Starting stopped pteroq queue worker..."
      systemctl start pteroq >/dev/null 2>&1 || true
    fi

    PTERO_CODE="$(curl -kso /dev/null -w "%{http_code}" --max-time 5 -H "Host: ${DOMAIN_GAME}" "https://127.0.0.1:${HTTPS_PORT}/" 2>/dev/null || echo "000")"
    if ! echo "${PTERO_CODE}" | grep -qE "^(200|301|302)$"; then
      log_wd "HEAL: Pterodactyl edge probe for ${DOMAIN_GAME} returned HTTP ${PTERO_CODE}; auto-healing port flow..."
      if [ -f "${INSTALL_DIR}/fix.sh" ]; then
        bash "${INSTALL_DIR}/fix.sh" --auto >> "${LOG_FILE}" 2>&1 || true
      else
        systemctl restart nginx >/dev/null 2>&1 || true
        docker exec "${PROXY_CNAME}" nginx -s reload >/dev/null 2>&1 || docker restart "${PROXY_CNAME}" >/dev/null 2>&1 || true
      fi
    fi
  fi
fi

# 6. Native fallback check if Docker is not active
if systemctl is-enabled --quiet sparrowx-native.service 2>/dev/null; then
  if ! systemctl is-active --quiet sparrowx-native.service 2>/dev/null; then
    log_wd "HEAL: Restarting sparrowx-native.service..."
    systemctl restart sparrowx-native.service >/dev/null 2>&1 || true
  fi
fi

# 7. Game DDoS Defense portal (sparrowx-gamesec) keepalive
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 && docker ps -a --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-gamesec"; then
  if ! docker ps --filter status=running --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-gamesec"; then
    log_wd "HEAL: Starting stopped sparrowx-gamesec container..."
    docker start sparrowx-gamesec >/dev/null 2>&1 || true
  fi
elif systemctl is-enabled --quiet sparrowx-gamesec.service 2>/dev/null; then
  if ! systemctl is-active --quiet sparrowx-gamesec.service 2>/dev/null; then
    log_wd "HEAL: Restarting sparrowx-gamesec.service..."
    systemctl restart sparrowx-gamesec.service >/dev/null 2>&1 || true
  fi
fi

# 8. Network DDoS Dashboard (sparrowx-netsec) keepalive
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 && docker ps -a --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-netsec"; then
  if ! docker ps --filter status=running --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-netsec"; then
    log_wd "HEAL: Starting stopped sparrowx-netsec container..."
    docker start sparrowx-netsec >/dev/null 2>&1 || true
  fi
elif systemctl is-enabled --quiet sparrowx-netsec.service 2>/dev/null; then
  if ! systemctl is-active --quiet sparrowx-netsec.service 2>/dev/null; then
    log_wd "HEAL: Restarting sparrowx-netsec.service..."
    systemctl restart sparrowx-netsec.service >/dev/null 2>&1 || true
  fi
fi
