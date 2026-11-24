#!/usr/bin/env bash
# ============================================================================
# SPARROWX OVH PERFORMANCE OPTIMIZER & 24/7 AUTONOMOUS MAINTAINER
# ============================================================================
# Usage:
#   sudo bash /opt/sparrowxdbs/ovh/optimize-and-maintain.sh --optimize
#   sudo bash /opt/sparrowxdbs/ovh/optimize-and-maintain.sh --maintain
#   sudo bash /opt/sparrowxdbs/ovh/optimize-and-maintain.sh --install-daemon
#   sudo bash /opt/sparrowxdbs/ovh/optimize-and-maintain.sh --all
# ============================================================================

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_FILE="/var/log/sparrowx-maintainer.log"
PTERO_DIR="/var/www/pterodactyl"

[ -f "${INSTALL_DIR}/.env" ] && set -a && source "${INSTALL_DIR}/.env" && set +a

SPARROWX_DOMAIN="${SPARROWX_DOMAIN:-sparrowx.net}"
DOMAIN_GAME="${DOMAIN_GAME:-game.panel.${SPARROWX_DOMAIN}}"
HTTP_PORT="${HTTP_PORT:-80}"
HTTPS_PORT="${HTTPS_PORT:-443}"
PTERO_PORT="${PTERO_PORT:-8090}"
DISCORD_WEBHOOK="${DISCORD_ALERT_WEBHOOK:-https://discord.com/api/webhooks/1571155240747536484/SRH2ShHvjM0n9NVXf0oqqWeI7_3R-jR-1-eOE3Z600-XlHOgFopyVkKsdUTxa1pttlWh}"

log_msg() {
  local level="$1"; shift
  local line="[$(date '+%Y-%m-%d %H:%M:%S')] [${level}] $*"
  echo "${line}"
  mkdir -p "$(dirname "${LOG_FILE}")" 2>/dev/null || true
  echo "${line}" >> "${LOG_FILE}" 2>/dev/null || true
}

notify_discord() {
  local title="$1"
  local desc="$2"
  local color="${3:-15158332}" # red default
  [ -z "${DISCORD_WEBHOOK}" ] && return 0
  command -v curl >/dev/null 2>&1 || return 0
  local payload
  payload=$(cat <<JSON
{"username":"SparrowX Maintainer","embeds":[{"title":"${title}","description":"${desc}","color":${color},"footer":{"text":"OVH Self-Healer • ${SPARROWX_DOMAIN}"}}]}
JSON
)
  curl -fsS -m 6 -H "Content-Type: application/json" -d "${payload}" "${DISCORD_WEBHOOK}" >/dev/null 2>&1 || true
}

# ============================================================================
# 1. DEEP SYSTEM & STACK OPTIMIZATION (--optimize)
# ============================================================================
run_optimize() {
  log_msg "OPT" "Starting SparrowX full-stack performance optimization..."

  # 1A. Linux Kernel TCP BBR + High-Throughput Socket Tuning
  cat > /etc/sysctl.d/99-sparrowx-perf.conf <<'EOF'
# SparrowX Low-Latency BBR & High-Concurrency Network Tuning
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
net.ipv4.tcp_fastopen = 3
net.core.somaxconn = 8192
net.core.netdev_max_backlog = 16384
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 120
net.ipv4.tcp_keepalive_intvl = 15
net.ipv4.tcp_keepalive_probes = 5
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
fs.file-max = 524288
vm.swappiness = 10
EOF
  sysctl --system >/dev/null 2>&1 || true
  log_msg "OK" "Kernel TCP BBR & socket buffers applied."

  # 1B. PHP-FPM High-Concurrency Pool & OPcache Tuning (Eliminates Pterodactyl Network Errors)
  local php_ver=""
  for v in 8.4 8.3 8.2 8.1; do
    if [ -d "/etc/php/${v}/fpm" ]; then
      php_ver="${v}"
      break
    fi
  done

  if [ -n "${php_ver}" ]; then
    local pool_conf="/etc/php/${php_ver}/fpm/pool.d/www.conf"
    if [ -f "${pool_conf}" ]; then
      sed -i -E 's/^pm\s*=.*/pm = dynamic/' "${pool_conf}"
      sed -i -E 's/^pm\.max_children\s*=.*/pm.max_children = 64/' "${pool_conf}"
      sed -i -E 's/^pm\.start_servers\s*=.*/pm.start_servers = 12/' "${pool_conf}"
      sed -i -E 's/^pm\.min_spare_servers\s*=.*/pm.min_spare_servers = 8/' "${pool_conf}"
      sed -i -E 's/^pm\.max_spare_servers\s*=.*/pm.max_spare_servers = 24/' "${pool_conf}"
      sed -i -E 's/^;?pm\.max_requests\s*=.*/pm.max_requests = 1000/' "${pool_conf}"
      sed -i -E 's/^;?request_terminate_timeout\s*=.*/request_terminate_timeout = 120s/' "${pool_conf}"
      sed -i -E 's/^;?listen\.backlog\s*=.*/listen.backlog = 4096/' "${pool_conf}"
    fi

    cat > "/etc/php/${php_ver}/fpm/conf.d/99-sparrowx-opcache.ini" <<'EOF'
; SparrowX PHP OPcache & Execution Speedup
opcache.enable=1
opcache.enable_cli=1
opcache.memory_consumption=256
opcache.interned_strings_buffer=32
opcache.max_accelerated_files=20000
opcache.revalidate_freq=2
opcache.fast_shutdown=1
opcache.validate_timestamps=1
realpath_cache_size=4096K
realpath_cache_ttl=600
memory_limit=512M
max_execution_time=120
EOF
    systemctl restart "php${php_ver}-fpm" >/dev/null 2>&1 || true
    log_msg "OK" "PHP ${php_ver}-FPM tuned (max_children=64, OPcache=256MB)."
  fi

  # 1C. MariaDB InnoDB Buffer Pool & Connection Tuning
  if [ -d "/etc/mysql/mariadb.conf.d" ]; then
    cat > /etc/mysql/mariadb.conf.d/99-sparrowx-perf.cnf <<'EOF'
[mysqld]
innodb_buffer_pool_size = 2G
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 2
innodb_flush_method = O_DIRECT
max_connections = 300
thread_cache_size = 32
table_open_cache = 4096
tmp_table_size = 64M
max_heap_table_size = 64M
skip-name-resolve
EOF
    systemctl reload-or-restart mariadb >/dev/null 2>&1 || true
    log_msg "OK" "MariaDB tuned (2GB InnoDB buffer pool, skip-name-resolve, 300 max_connections)."
  fi

  # 1D. Redis Memory Cap & LRU Eviction (Prevents Session/Cache OOM)
  if command -v redis-cli >/dev/null 2>&1 && redis-cli -h 127.0.0.1 -p 6379 ping 2>/dev/null | grep -qi "PONG"; then
    redis-cli -h 127.0.0.1 -p 6379 CONFIG SET maxmemory 1gb >/dev/null 2>&1 || true
    redis-cli -h 127.0.0.1 -p 6379 CONFIG SET maxmemory-policy allkeys-lru >/dev/null 2>&1 || true
    log_msg "OK" "Redis tuned (1GB maxmemory, allkeys-lru)."
  fi

  # 1E. Host Nginx (Pterodactyl Upstream) Buffer & Compression Tuning
  if [ -f "/etc/nginx/sites-available/pterodactyl.conf" ]; then
    sed -i 's/sendfile off;/sendfile on;\n    tcp_nopush on;\n    tcp_nodelay on;\n    keepalive_timeout 65;/' /etc/nginx/sites-available/pterodactyl.conf 2>/dev/null || true
    sed -i 's/fastcgi_buffer_size 16k;/fastcgi_buffer_size 64k;/' /etc/nginx/sites-available/pterodactyl.conf 2>/dev/null || true
    sed -i 's/fastcgi_buffers 4 16k;/fastcgi_buffers 16 32k;\n        fastcgi_busy_buffers_size 64k;/' /etc/nginx/sites-available/pterodactyl.conf 2>/dev/null || true
    if nginx -t >/dev/null 2>&1; then
      systemctl reload nginx >/dev/null 2>&1 || systemctl restart nginx >/dev/null 2>&1 || true
      log_msg "OK" "Host Pterodactyl Nginx buffers & sendfile tuned."
    fi
  fi

  # 1F. Warm Pterodactyl Laravel Caches (Eliminates Per-Request Config/Route Parsing)
  if [ -d "${PTERO_DIR}" ] && [ -f "${PTERO_DIR}/artisan" ]; then
    local php_bin
    php_bin="$(command -v php8.4 || command -v php8.3 || command -v php8.2 || command -v php || true)"
    if [ -n "${php_bin}" ]; then
      (
        cd "${PTERO_DIR}" && \
        sudo -u www-data "${php_bin}" artisan config:cache >/dev/null 2>&1 || true && \
        sudo -u www-data "${php_bin}" artisan route:cache >/dev/null 2>&1 || true && \
        sudo -u www-data "${php_bin}" artisan view:cache >/dev/null 2>&1 || true
      )
      log_msg "OK" "Pterodactyl Laravel config/route/view caches warmed."
    fi
  fi

  log_msg "OPT" "Full-stack optimization complete!"
}

# ============================================================================
# 2. AUTONOMOUS SELF-HEALING WATCHDOG (--maintain)
# ============================================================================
run_maintain() {
  local healed=()

  # 2A. Check Core Docker Containers
  if command -v docker >/dev/null 2>&1; then
    for cname in sparrowx-postgres sparrowx-postgrest sparrowx-app sparrowx-nginx; do
      if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "${cname}"; then
        local state
        state="$(docker inspect -f '{{.State.Running}}' "${cname}" 2>/dev/null || echo "false")"
        if [ "${state}" != "true" ]; then
          log_msg "HEAL" "Container ${cname} was stopped — restarting..."
          docker start "${cname}" >/dev/null 2>&1 || true
          healed+=("docker:${cname}")
        fi
      fi
    done
  fi

  # 2B. Check Host Services (MariaDB, Redis, PHP-FPM, Host Nginx, Pteroq, Wings)
  for svc in mariadb redis-server nginx pteroq wings; do
    if systemctl list-unit-files "${svc}.service" 2>/dev/null | grep -q "${svc}.service"; then
      if ! systemctl is-active --quiet "${svc}"; then
        log_msg "HEAL" "Service ${svc} was inactive — restarting..."
        systemctl restart "${svc}" >/dev/null 2>&1 || true
        healed+=("systemd:${svc}")
      fi
    fi
  done

  for fpm in php8.4-fpm php8.3-fpm php8.2-fpm php8.1-fpm; do
    if systemctl list-unit-files "${fpm}.service" 2>/dev/null | grep -q "${fpm}.service"; then
      if ! systemctl is-active --quiet "${fpm}"; then
        log_msg "HEAL" "PHP-FPM ${fpm} was inactive — restarting..."
        systemctl restart "${fpm}" >/dev/null 2>&1 || true
        healed+=("systemd:${fpm}")
      fi
    fi
  done

  # 2C. Live HTTP Probe: Main Website (sparrowx.net)
  local web_code
  web_code="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 6 -H "Host: ${SPARROWX_DOMAIN}" "https://127.0.0.1:${HTTPS_PORT}/api/v1/health" 2>/dev/null || echo "000")"
  if ! echo "${web_code}" | grep -qE "^(200|301|302)$"; then
    log_msg "HEAL" "Main site probe returned HTTP ${web_code} — restarting sparrowx-app & reloading sparrowx-nginx..."
    docker restart sparrowx-app >/dev/null 2>&1 || true
    sleep 3
    docker exec sparrowx-nginx nginx -s reload >/dev/null 2>&1 || docker restart sparrowx-nginx >/dev/null 2>&1 || true
    healed+=("web-probe:${web_code}")
  fi

  # 2D. Live HTTP Probe: Pterodactyl Panel (game.panel.sparrowx.net)
  if [ -d "${PTERO_DIR}" ]; then
    local ptero_code
    ptero_code="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 6 -H "Host: ${DOMAIN_GAME}" "https://127.0.0.1:${HTTPS_PORT}/auth/login" 2>/dev/null || echo "000")"
    if ! echo "${ptero_code}" | grep -qE "^(200|301|302)$"; then
      log_msg "HEAL" "Pterodactyl panel probe returned HTTP ${ptero_code} — restarting php-fpm, host nginx, and reloading edge nginx..."
      for fpm in php8.4-fpm php8.3-fpm php8.2-fpm php8.1-fpm; do
        systemctl is-enabled "${fpm}" >/dev/null 2>&1 && systemctl restart "${fpm}" >/dev/null 2>&1 || true
      done
      systemctl restart nginx >/dev/null 2>&1 || true
      docker exec sparrowx-nginx nginx -s reload >/dev/null 2>&1 || docker restart sparrowx-nginx >/dev/null 2>&1 || true
      healed+=("ptero-probe:${ptero_code}")
    fi
  fi

  # 2E. Disk Pressure Auto-Cleanup (>85% used)
  local disk_pct
  disk_pct="$(df / --output=pcent 2>/dev/null | tail -n 1 | tr -dc '0-9' || echo 0)"
  if [ "${disk_pct:-0}" -ge 85 ]; then
    log_msg "CLEAN" "Disk usage at ${disk_pct}% — pruning old journal logs & dangling Docker images..."
    journalctl --vacuum-time=3d >/dev/null 2>&1 || true
    docker image prune -f >/dev/null 2>&1 || true
    docker builder prune -f --filter "until=48h" >/dev/null 2>&1 || true
    healed+=("disk-cleanup:${disk_pct}%")
  fi

  # 2F. Rotate maintainer log if > 5MB
  if [ -f "${LOG_FILE}" ] && [ "$(stat -c%s "${LOG_FILE}" 2>/dev/null || echo 0)" -gt 5242880 ]; then
    tail -n 500 "${LOG_FILE}" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "${LOG_FILE}"
  fi

  # Alert Discord only when a real self-heal action was triggered
  if [ "${#healed[@]}" -gt 0 ]; then
    local joined
    joined="$(IFS=', '; echo "${healed[*]}")"
    log_msg "ALERT" "Auto-healed components: ${joined}"
    notify_discord "🛠️ SparrowX OVH Auto-Healer Triggered" "Detected and automatically recovered: \`${joined}\`" 15105570
  fi
}

# ============================================================================
# 3. INSTALL 2-MINUTE SYSTEMD WATCHDOG DAEMON (--install-daemon)
# ============================================================================
install_daemon() {
  chmod +x "${SCRIPT_DIR}/optimize-and-maintain.sh" 2>/dev/null || true

  cat > /etc/systemd/system/sparrowx-maintainer.service <<EOF
[Unit]
Description=SparrowX OVH Autonomous Self-Healing Maintainer
After=network-online.target docker.service

[Service]
Type=oneshot
ExecStart=/usr/bin/env bash ${SCRIPT_DIR}/optimize-and-maintain.sh --maintain
Nice=10
EOF

  cat > /etc/systemd/system/sparrowx-maintainer.timer <<'EOF'
[Unit]
Description=Run SparrowX OVH Maintainer every 2 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=2min
Unit=sparrowx-maintainer.service

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload >/dev/null 2>&1 || true
  systemctl enable --now sparrowx-maintainer.timer >/dev/null 2>&1 || true
  log_msg "OK" "Installed & activated systemd timer: sparrowx-maintainer.timer (runs every 2 minutes)."
}

case "${1:---all}" in
  --optimize)       run_optimize ;;
  --maintain)       run_maintain ;;
  --install-daemon) install_daemon ;;
  --all)            run_optimize; install_daemon; run_maintain ;;
  *)
    echo "Usage: $0 [--optimize | --maintain | --install-daemon | --all]"
    exit 1
    ;;
esac
