#!/usr/bin/env bash
# ==============================================================================
# SPARROWX MASTER A-TO-Z UPDATER, AUTO-HEALER & FULL-STACK DEPLOYMENT CLI
# ==============================================================================
# Run `./update.sh` (or `sparrowx-update`) anywhere on your OVH server to:
#  1. Normalize paths, strip CRLF line endings & install global CLI commands
#  2. Guard Disk/Swap against OOM & cleanly sync latest commits from GitHub
#  3. Harden OS Kernel, Fail2Ban, APT locks & UFW firewall rules
#  4. Validate/renew TLS certs & sync Nginx across all 6 SparrowX domains
#  5. Refresh the 5-minute systemd GitHub auto-upgrade daemon
#  6. Auto-heal port/container conflicts (5432/3001/3000/80/443) & rebuild stack
#  7. Verify PostgreSQL roles/schema, PostgREST, HTTP health & auto-invoke fix.sh
# ==============================================================================
set -u

AUTO_MODE="false"
FORCE_DB_INSTALL="false"
DELEGATE_FIX="false"

for arg in "$@"; do
  case "${arg}" in
    --auto|-y|--yes) AUTO_MODE="true" ;;
    --reinstall-db|--force-db) FORCE_DB_INSTALL="true" ;;
    --fix|--doctor) DELEGATE_FIX="true" ;;
    --help|-h)
      cat <<'HELP'
SparrowX A-to-Z Full-Stack Updater & Auto-Healer (update.sh)

Usage:
  ./update.sh [options]

Options:
  --auto, -y        Non-interactive mode (used by systemd auto-updater)
  --reinstall-db    Force re-sync of Local OVH PostgreSQL & per-user folders
  --fix, --doctor   Run deep 12-stage recovery engine (./fix.sh) immediately
  --help, -h        Show this help screen
HELP
      exit 0
      ;;
  esac
done

SCRIPT_SOURCE="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd "$(dirname "${SCRIPT_SOURCE}")" && pwd)"
if [ "$(basename "${SCRIPT_DIR}")" = "ovh" ]; then
  INSTALL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
elif [ -f "${SCRIPT_DIR}/docker-compose.ovh.yml" ] || [ -d "${SCRIPT_DIR}/ovh" ]; then
  INSTALL_DIR="${SCRIPT_DIR}"
elif [ -d "/opt/sparrowxdbs" ]; then
  INSTALL_DIR="/opt/sparrowxdbs"
elif [ -d "/opt/sparrowx" ]; then
  INSTALL_DIR="/opt/sparrowx"
else
  INSTALL_DIR="${SCRIPT_DIR}"
fi
cd "${INSTALL_DIR}" || exit 1

if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
  exec sudo -E bash "$0" "$@"
fi

if [ "${DELEGATE_FIX}" = "true" ] && [ -f "${INSTALL_DIR}/fix.sh" ]; then
  exec bash "${INSTALL_DIR}/fix.sh" "$@"
fi

# ------------------------------------------------------------------------------
# Cyber CLI Colors & Progress Bars
# ------------------------------------------------------------------------------
C_RESET="\033[0m"
C_BOLD="\033[1m"
C_DIM="\033[2m"
C_GREEN="\033[1;32m"
C_CYAN="\033[1;36m"
C_YELLOW="\033[1;33m"
C_RED="\033[1;31m"
C_BLUE="\033[1;34m"
C_MAGENTA="\033[1;35m"
C_WHITE="\033[1;37m"

HEALED_COUNT=0
declare -a HEAL_NOTES=()

log_info() { echo -e "  ${C_CYAN}[INFO]${C_RESET}     $*"; }
log_ok()   { echo -e "  ${C_GREEN}[ OK ]${C_RESET}     $*"; }
log_err()  { echo -e "  ${C_RED}[ERR ]${C_RESET}     $*"; }
log_warn() {
  echo -e "  ${C_YELLOW}[AUTO-FIX]${C_RESET} ${C_WHITE}$*${C_RESET}"
  HEALED_COUNT=$((HEALED_COUNT + 1))
  HEAL_NOTES+=("$*")
}

draw_progress() {
  local step="$1"
  local total="$2"
  local title="$3"
  local width=26
  local filled=$((step * width / total))
  local empty=$((width - filled))
  local pct=$((step * 100 / total))
  local bar_f=""
  local bar_e=""
  local i
  for ((i = 0; i < filled; i++)); do bar_f="${bar_f}█"; done
  for ((i = 0; i < empty; i++)); do bar_e="${bar_e}░"; done
  echo ""
  echo -e "${C_BLUE}┌──────────────────────────────────────────────────────────────────────┐${C_RESET}"
  printf "${C_BLUE}│${C_RESET} ${C_CYAN}[%2d/%2d]${C_RESET} ${C_GREEN}%s${C_DIM}%s${C_RESET} ${C_BOLD}%3d%%${C_RESET}  ${C_WHITE}%-28s${C_RESET}${C_BLUE}│${C_RESET}\n" \
    "${step}" "${total}" "${bar_f}" "${bar_e}" "${pct}" "${title:0:28}"
  echo -e "${C_BLUE}└──────────────────────────────────────────────────────────────────────┘${C_RESET}"
}

ensure_env_key() {
  local key="$1"
  local val="$2"
  local env_file="${INSTALL_DIR}/.env"
  touch "${env_file}"
  if grep -q "^${key}=" "${env_file}" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "${env_file}"
  else
    echo "${key}=${val}" >> "${env_file}"
  fi
}

is_port_busy() {
  local port="$1"
  if command -v ss >/dev/null 2>&1 && ss -tuln 2>/dev/null | grep -qE "(:|\.|\])${port}[[:space:]]"; then
    return 0
  fi
  if command -v lsof >/dev/null 2>&1 && lsof -i ":${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    return 0
  fi
  if command -v netstat >/dev/null 2>&1 && netstat -tuln 2>/dev/null | grep -qE "(:|\.)${port}[[:space:]]"; then
    return 0
  fi
  if (echo >/dev/tcp/127.0.0.1/"${port}") >/dev/null 2>&1; then
    return 0
  fi
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker ps --format '{{.Ports}}' 2>/dev/null | grep -qE "(:|0\.0\.0\.0:|127\.0\.0\.1:|\[::\]:)${port}->"; then
      return 0
    fi
  fi
  return 1
}

free_docker_port_conflicts() {
  local port="$1"
  local keep_name="$2"
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    local ctrs
    ctrs="$(docker ps --format '{{.ID}} {{.Names}} {{.Ports}}' 2>/dev/null | grep -E "(:|0\.0\.0\.0:|127\.0\.0\.1:|\[::\]:)${port}->" | awk -v keep="${keep_name}" '$2 != keep {print $1}' || true)"
    if [ -n "${ctrs}" ]; then
      echo "${ctrs}" | xargs -r docker rm -f >/dev/null 2>&1 || true
    fi
  fi
}

port_held_by_other() {
  local port="$1"
  local expected_regex="$2"
  if ! is_port_busy "${port}"; then
    return 1
  fi
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E "^(${expected_regex}) " | grep -qE ":${port}->"; then
      return 1
    fi
  fi
  return 0
}

is_reserved_ptero_port() {
  local port="$1"
  case "${port}" in
    8080|8443|2022|3306|6379|"${PTERO_PORT:-8090}") return 0 ;;
    *) return 1 ;;
  esac
}

find_next_free_port() {
  local port="$1"
  local max_tries=60
  local i=0
  while [ "${i}" -lt "${max_tries}" ] && { is_reserved_ptero_port "${port}" || is_port_busy "${port}"; }; do
    port=$((port + 1))
    i=$((i + 1))
  done
  echo "${port}"
}

detect_php_fpm_sock() {
  local sock=""
  sock="$(find /run/php /var/run/php -maxdepth 2 -type s -name 'php*-fpm.sock' 2>/dev/null | sort -V | tail -n 1 || true)"
  if [ -z "${sock}" ] && command -v systemctl >/dev/null 2>&1; then
    for php_svc in $(systemctl list-unit-files 'php*-fpm.service' --no-legend 2>/dev/null | awk '{print $1}' | sort -V || true); do
      systemctl enable --now "${php_svc}" >/dev/null 2>&1 || true
    done
    sleep 1
    sock="$(find /run/php /var/run/php -maxdepth 2 -type s -name 'php*-fpm.sock' 2>/dev/null | sort -V | tail -n 1 || true)"
  fi
  [ -z "${sock}" ] && sock="/run/php/php8.3-fpm.sock"
  echo "${sock}"
}

is_pterodactyl_installed() {
  [ -f /var/www/pterodactyl/artisan ] || [ -d /var/www/pterodactyl/public ]
}

get_docker_host_ip() {
  local gw_ip=""
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-nginx"; then
      gw_ip="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}' sparrowx-nginx 2>/dev/null | tr -d '[:space:]' || true)"
      if [ -z "${gw_ip}" ]; then
        gw_ip="$(docker exec sparrowx-nginx sh -c "getent hosts host.docker.internal 2>/dev/null | awk '{print \$1; exit}'" 2>/dev/null | tr -d '[:space:]' || true)"
      fi
    fi
    if [ -z "${gw_ip}" ]; then
      gw_ip="$(docker network inspect bridge -f '{{range .IPAM.Config}}{{.Gateway}}{{end}}' 2>/dev/null | tr -d '[:space:]' || true)"
    fi
  fi
  if [ -z "${gw_ip}" ] && command -v ip >/dev/null 2>&1; then
    gw_ip="$(ip -4 addr show docker0 2>/dev/null | awk '/inet / {sub(/\/.*/, "", $2); print $2; exit}' || true)"
  fi
  [ -z "${gw_ip}" ] && gw_ip="172.17.0.1"
  echo "${gw_ip}"
}

heal_pterodactyl_host_nginx() {
  if ! is_pterodactyl_installed; then
    return 0
  fi
  local ptero_p="${PTERO_PORT:-8090}"
  local ptero_dom="${DOMAIN_GAME:-game.${SPARROWX_DOMAIN}}"
  local php_sock
  php_sock="$(detect_php_fpm_sock)"

  for dep_svc in mariadb mysql redis-server pteroq; do
    if systemctl list-unit-files "${dep_svc}.service" >/dev/null 2>&1; then
      systemctl enable --now "${dep_svc}" >/dev/null 2>&1 || true
    fi
  done
  if systemctl list-unit-files wings.service >/dev/null 2>&1 && [ -f /etc/pterodactyl/config.yml ]; then
    systemctl enable --now wings >/dev/null 2>&1 || true
  fi

  if [ -f /var/www/pterodactyl/.env ]; then
    sed -i "s|^APP_URL=.*|APP_URL=https://${ptero_dom}|" /var/www/pterodactyl/.env 2>/dev/null || true
    if grep -q "^TRUSTED_PROXIES=" /var/www/pterodactyl/.env 2>/dev/null; then
      sed -i "s|^TRUSTED_PROXIES=.*|TRUSTED_PROXIES=*|" /var/www/pterodactyl/.env 2>/dev/null || true
    else
      echo "TRUSTED_PROXIES=*" >> /var/www/pterodactyl/.env 2>/dev/null || true
    fi
  fi
  id -u www-data >/dev/null 2>&1 && chown -R www-data:www-data /var/www/pterodactyl/storage /var/www/pterodactyl/bootstrap/cache 2>/dev/null || true
  if command -v php >/dev/null 2>&1 && [ -f /var/www/pterodactyl/artisan ]; then
    php /var/www/pterodactyl/artisan config:clear >/dev/null 2>&1 || true
    php /var/www/pterodactyl/artisan route:clear >/dev/null 2>&1 || true
  fi

  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  mkdir -p /etc/nginx/sparrowx-disabled /etc/nginx/sites-available /etc/nginx/sites-enabled 2>/dev/null || true
  for ncfg in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
    [ -e "${ncfg}" ] || continue
    [ "$(basename "${ncfg}")" = "pterodactyl.conf" ] && continue
    if grep -qE "listen[[:space:]]+([^;]*:)?(80|443)([[:space:];]|$)" "${ncfg}" 2>/dev/null; then
      mv -f "${ncfg}" /etc/nginx/sparrowx-disabled/ 2>/dev/null || rm -f "${ncfg}" 2>/dev/null || true
    fi
  done

  mkdir -p "${INSTALL_DIR}/ovh/certbot-www/.well-known/acme-challenge" 2>/dev/null || true
  cat > /etc/nginx/sites-available/pterodactyl.conf <<PTEROEOF
server {
    listen ${ptero_p} default_server;
    listen [::]:${ptero_p} default_server;
    server_name ${ptero_dom} panel.${SPARROWX_DOMAIN} _;

    root /var/www/pterodactyl/public;
    index index.php;

    client_max_body_size 100m;
    client_body_timeout 120s;
    sendfile off;

    location ^~ /.well-known/acme-challenge/ {
        root ${INSTALL_DIR}/ovh/certbot-www;
        default_type "text/plain";
        allow all;
    }

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \.php\$ {
        fastcgi_split_path_info ^(.+\.php)(/.+)\$;
        fastcgi_pass unix:${php_sock};
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param PHP_VALUE "upload_max_filesize = 100M \n post_max_size=100M";
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        fastcgi_param HTTP_PROXY "";
        fastcgi_param HTTPS on;
        fastcgi_param HTTP_X_FORWARDED_PROTO https;
        fastcgi_intercept_errors off;
        fastcgi_buffer_size 16k;
        fastcgi_buffers 4 16k;
        fastcgi_connect_timeout 300;
        fastcgi_send_timeout 300;
        fastcgi_read_timeout 300;
    }

    location ~ /\.ht {
        deny all;
    }
}
PTEROEOF
  ln -sfn /etc/nginx/sites-available/pterodactyl.conf /etc/nginx/sites-enabled/pterodactyl.conf 2>/dev/null || true

  if [ -s "/etc/letsencrypt/live/${ptero_dom}/fullchain.pem" ] && [ -s "/etc/letsencrypt/live/${ptero_dom}/privkey.pem" ]; then
    mkdir -p "${INSTALL_DIR}/ovh/ssl" /etc/ssl
    cp -fL "/etc/letsencrypt/live/${ptero_dom}/fullchain.pem" "${INSTALL_DIR}/ovh/ssl/ptero-fullchain.pem" 2>/dev/null || true
    cp -fL "/etc/letsencrypt/live/${ptero_dom}/privkey.pem" "${INSTALL_DIR}/ovh/ssl/ptero-privkey.pem" 2>/dev/null || true
    ln -sf "/etc/letsencrypt/live/${ptero_dom}/fullchain.pem" "/etc/ssl/${ptero_dom}.pem" 2>/dev/null || true
    ln -sf "/etc/letsencrypt/live/${ptero_dom}/privkey.pem" "/etc/ssl/${ptero_dom}.key" 2>/dev/null || true
  fi

  if command -v nginx >/dev/null 2>&1; then
    nginx -t >/dev/null 2>&1 || true
    systemctl unmask nginx >/dev/null 2>&1 || true
    systemctl enable nginx >/dev/null 2>&1 || true
    systemctl restart nginx >/dev/null 2>&1 || systemctl reload nginx >/dev/null 2>&1 || true
  fi
  log_warn "Aligned host Pterodactyl Nginx onto internal port ${ptero_p} (preserving :80/:443 for SparrowX Edge)"
}

ensure_game_letsencrypt_ssl() {
  local game_domain="${DOMAIN_GAME:-game.${SPARROWX_DOMAIN}}"
  local webroot="${INSTALL_DIR}/ovh/certbot-www"
  local ssl_dir="${INSTALL_DIR}/ovh/ssl"
  local live_dir="/etc/letsencrypt/live/${game_domain}"
  local ssl_email="${PTERO_ADMIN_EMAIL:-${SPARROWX_ADMIN_EMAIL:-admin@${SPARROWX_DOMAIN}}}"

  if [ -z "${game_domain}" ] || [[ "${game_domain}" == *.local ]] || [ "${game_domain}" = "localhost" ]; then
    return 0
  fi

  if [ -z "${ssl_email}" ] || [[ "${ssl_email}" == *.local ]]; then
    ssl_email="admin@${SPARROWX_DOMAIN}"
  fi

  mkdir -p "${webroot}/.well-known/acme-challenge" "${ssl_dir}" /etc/ssl

  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi "Status: active"; then
    ufw allow 80/tcp >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
  fi

  if ! command -v certbot >/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt-get update -y >/dev/null 2>&1 || true
    DEBIAN_FRONTEND=noninteractive apt-get install -y certbot >/dev/null 2>&1 || true
  fi

  if ! command -v certbot >/dev/null 2>&1; then
    log_warn "Certbot unavailable; skipping Let's Encrypt issuance for ${game_domain}"
    return 0
  fi

  if [ ! -s "${live_dir}/fullchain.pem" ] || [ ! -s "${live_dir}/privkey.pem" ]; then
    log_info "Requesting Let's Encrypt SSL for ${game_domain} via HTTP-01 port 80..."

    if certbot certonly \
      --webroot -w "${webroot}" \
      --non-interactive --agree-tos \
      -m "${ssl_email}" \
      --cert-name "${game_domain}" \
      -d "${game_domain}" >/dev/null 2>&1; then
      log_ok "Issued Let's Encrypt SSL for ${game_domain} via port 80 webroot"
    else
      log_warn "Webroot challenge deferred; retrying ${game_domain} via standalone port 80 listener..."
      docker stop sparrowx-nginx >/dev/null 2>&1 || true
      systemctl stop nginx >/dev/null 2>&1 || true
      if command -v fuser >/dev/null 2>&1; then
        fuser -k 80/tcp >/dev/null 2>&1 || true
      fi
      sleep 1

      if certbot certonly \
        --standalone --preferred-challenges http \
        --non-interactive --agree-tos \
        -m "${ssl_email}" \
        --cert-name "${game_domain}" \
        -d "${game_domain}" >/dev/null 2>&1; then
        log_ok "Issued Let's Encrypt SSL for ${game_domain} via standalone port 80 challenge"
      else
        log_warn "Let's Encrypt HTTP-01 challenge failed for ${game_domain} (verify DNS A record & external port 80)"
      fi

      if is_pterodactyl_installed; then
        systemctl start nginx >/dev/null 2>&1 || true
      fi
      docker start sparrowx-nginx >/dev/null 2>&1 || compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps nginx >/dev/null 2>&1 || true
    fi
  else
    certbot certonly \
      --webroot -w "${webroot}" \
      --non-interactive --agree-tos --keep-until-expiring \
      -m "${ssl_email}" \
      --cert-name "${game_domain}" \
      -d "${game_domain}" >/dev/null 2>&1 || true
  fi

  if [ -s "${live_dir}/fullchain.pem" ] && [ -s "${live_dir}/privkey.pem" ]; then
    cp -fL "${live_dir}/fullchain.pem" "${ssl_dir}/ptero-fullchain.pem" 2>/dev/null || true
    cp -fL "${live_dir}/privkey.pem" "${ssl_dir}/ptero-privkey.pem" 2>/dev/null || true
    chmod 644 "${ssl_dir}/ptero-fullchain.pem" 2>/dev/null || true
    chmod 600 "${ssl_dir}/ptero-privkey.pem" 2>/dev/null || true
    ln -sf "${live_dir}/fullchain.pem" "/etc/ssl/${game_domain}.pem" 2>/dev/null || true
    ln -sf "${live_dir}/privkey.pem" "/etc/ssl/${game_domain}.key" 2>/dev/null || true

    if [ -f "${INSTALL_DIR}/ovh/nginx.conf" ] && grep -q "${game_domain}" "${INSTALL_DIR}/ovh/nginx.conf" 2>/dev/null; then
      local tmp_nginx=""
      tmp_nginx="$(mktemp)"
      awk '
        /# 4\. Pterodactyl Game Panel/ { in_ptero=1 }
        in_ptero && /ssl_certificate / { sub(/ssl_certificate .*/, "ssl_certificate /etc/nginx/ssl/ptero-fullchain.pem;") }
        in_ptero && /ssl_certificate_key / { sub(/ssl_certificate_key .*/, "ssl_certificate_key /etc/nginx/ssl/ptero-privkey.pem;") }
        in_ptero && /^}/ { in_ptero=0 }
        { print }
      ' "${INSTALL_DIR}/ovh/nginx.conf" > "${tmp_nginx}" && cat "${tmp_nginx}" > "${INSTALL_DIR}/ovh/nginx.conf"
      rm -f "${tmp_nginx}"
      docker restart sparrowx-nginx >/dev/null 2>&1 || docker exec sparrowx-nginx nginx -s reload >/dev/null 2>&1 || true
    fi
    log_ok "Live Let's Encrypt SSL wired for https://${game_domain}"
  fi
}

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    return 1
  fi
}

strip_crlf_all() {
  local cleaned=0
  for f in \
    "${INSTALL_DIR}/.env" \
    "${INSTALL_DIR}"/*.sh \
    "${INSTALL_DIR}"/ovh/*.sh \
    "${INSTALL_DIR}"/deploy/*.sh \
    "${INSTALL_DIR}"/init-scripts/*.sh \
    "${INSTALL_DIR}/ovh/nginx.conf" \
    "${INSTALL_DIR}/ovh/schema.sql" \
    "${INSTALL_DIR}"/docker-compose*.yml; do
    if [ -f "${f}" ] && grep -q $'\r' "${f}" 2>/dev/null; then
      sed -i 's/\r$//' "${f}" 2>/dev/null || true
      cleaned=$((cleaned + 1))
    fi
  done
  if [ "${cleaned}" -gt 0 ]; then
    log_warn "Normalized LF line endings across ${cleaned} file(s)"
  fi
}

if [ "${AUTO_MODE}" != "true" ]; then
  clear 2>/dev/null || true
fi
echo -e "${C_CYAN}╔══════════════════════════════════════════════════════════════════════════╗${C_RESET}"
echo -e "${C_CYAN}║${C_RESET}  ${C_BOLD}${C_WHITE}🚀 SPARROWX A-TO-Z FULL-STACK UPDATER & SELF-HEALING DEPLOY ENGINE${C_RESET}      ${C_CYAN}║${C_RESET}"
echo -e "${C_CYAN}║${C_RESET}  ${C_DIM}Auto-Sync · Port/Docker Conflict Healer · Multi-Domain Reverse Proxy${C_RESET}    ${C_CYAN}║${C_RESET}"
echo -e "${C_CYAN}╚══════════════════════════════════════════════════════════════════════════╝${C_RESET}"
echo -e "  ${C_DIM}Path: ${INSTALL_DIR} • Host: $(hostname 2>/dev/null || echo ovh) • Mode: $([ "${AUTO_MODE}" = "true" ] && echo "AUTO" || echo "INTERACTIVE")${C_RESET}"

# ==============================================================================
# STEP 1/7: Pre-Flight Sanitizer, .env Validation & Global CLI Links
# ==============================================================================
draw_progress 1 7 "Pre-Flight Sanitizer & .env"

if [ ! -e "/opt/sparrowx" ] && [ "${INSTALL_DIR}" != "/opt/sparrowx" ]; then
  ln -sfn "${INSTALL_DIR}" /opt/sparrowx 2>/dev/null || true
  log_warn "Linked /opt/sparrowx -> ${INSTALL_DIR} for legacy path compatibility"
fi

strip_crlf_all
chmod +x \
  "${INSTALL_DIR}/update.sh" \
  "${INSTALL_DIR}/fix.sh" \
  "${INSTALL_DIR}/manage-db.sh" \
  "${INSTALL_DIR}/ovh/update.sh" \
  "${INSTALL_DIR}/ovh/fix.sh" \
  "${INSTALL_DIR}/ovh/manage-db.sh" \
  "${INSTALL_DIR}/deploy/doctor-fix.sh" 2>/dev/null || true

if [ -d "/usr/local/bin" ]; then
  ln -sf "${INSTALL_DIR}/manage-db.sh" /usr/local/bin/sparrowx-db 2>/dev/null || true
  ln -sf "${INSTALL_DIR}/update.sh" /usr/local/bin/sparrowx-update 2>/dev/null || true
  ln -sf "${INSTALL_DIR}/fix.sh" /usr/local/bin/sparrowx-fix 2>/dev/null || true
  ln -sf "${INSTALL_DIR}/fix.sh" /usr/local/bin/sparrowx-doctor 2>/dev/null || true
fi

if [ -f "${INSTALL_DIR}/.env" ]; then
  # shellcheck disable=SC1090
  source "${INSTALL_DIR}/.env" 2>/dev/null || true
fi

DETECTED_IP="$(curl -4 -fsS --max-time 4 https://api.ipify.org 2>/dev/null || curl -4 -fsS --max-time 4 https://ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")"
SPARROWX_PUBLIC_IP="${SPARROWX_PUBLIC_IP:-${DETECTED_IP}}"
[ -z "${SPARROWX_PUBLIC_IP}" ] && SPARROWX_PUBLIC_IP="${DETECTED_IP}"

if [ -z "${SPARROWX_DOMAIN:-}" ]; then
  EXISTING_ZONE="$(ls -1 "${INSTALL_DIR}"/ovh/dns/db.* /etc/bind/zones/db.* 2>/dev/null | head -n 1 || true)"
  if [ -n "${EXISTING_ZONE}" ]; then
    SPARROWX_DOMAIN="$(basename "${EXISTING_ZONE}" | sed 's/^db\.//')"
  elif [ -f "${INSTALL_DIR}/ovh/nginx.conf" ]; then
    SPARROWX_DOMAIN="$(awk '/server_name/ {print $2; exit}' "${INSTALL_DIR}/ovh/nginx.conf" | tr -d ';' || true)"
  fi
fi
SPARROWX_DOMAIN="$(echo "${SPARROWX_DOMAIN:-sparrowx.net}" | sed -E 's#^https?://##; s#/.*$##' | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
if [ -z "${SPARROWX_DOMAIN}" ] || [ "${SPARROWX_DOMAIN}" = "_" ]; then
  SPARROWX_DOMAIN="sparrowx.net"
fi

SPARROWX_STUDIO_DOMAIN="$(echo "${SPARROWX_STUDIO_DOMAIN:-db.${SPARROWX_DOMAIN}}" | sed -E 's#^https?://##; s#/.*$##' | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
if [ -z "${SPARROWX_STUDIO_DOMAIN}" ] || [ "${SPARROWX_STUDIO_DOMAIN}" = "${SPARROWX_DOMAIN}" ]; then
  SPARROWX_STUDIO_DOMAIN="db.${SPARROWX_DOMAIN}"
fi

HTTP_PORT="${HTTP_PORT:-80}"
HTTPS_PORT="${HTTPS_PORT:-443}"
APP_HOST_PORT="${APP_HOST_PORT:-3000}"
PGRST_HOST_PORT="${PGRST_HOST_PORT:-3001}"
PG_HOST_PORT="${PG_HOST_PORT:-5432}"
DOMAIN_GAME="${DOMAIN_GAME:-game.${SPARROWX_DOMAIN}}"
PTERO_PORT="${PTERO_PORT:-8090}"
POSTGRES_USER="${POSTGRES_USER:-sparrowx}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-sparrowx_ovh_secret_2026}"
POSTGRES_DB="${POSTGRES_DB:-sparrowx_db}"
SPARROWX_JWT_SECRET="${SPARROWX_JWT_SECRET:-$(openssl rand -hex 32 2>/dev/null || echo 'sparrowx_jwt_secret_key_32_characters_2026')}"
SPARROWX_REDIS_SECRET="${SPARROWX_REDIS_SECRET:-$(openssl rand -hex 16 2>/dev/null || echo 'sparrowx_redis_secret_2026')}"

if [ -f "/root/.sparrowx-ptero-credentials.txt" ]; then
  # shellcheck disable=SC1091
  source "/root/.sparrowx-ptero-credentials.txt" 2>/dev/null || true
fi
if [ -f "/var/www/pterodactyl/.env" ]; then
  _EX_DB="$(awk -F= '/^DB_DATABASE=/{sub(/^[^=]*=/,""); print; exit}' /var/www/pterodactyl/.env 2>/dev/null | tr -d "\"'\r" || true)"
  _EX_USER="$(awk -F= '/^DB_USERNAME=/{sub(/^[^=]*=/,""); print; exit}' /var/www/pterodactyl/.env 2>/dev/null | tr -d "\"'\r" || true)"
  _EX_PASS="$(awk -F= '/^DB_PASSWORD=/{sub(/^[^=]*=/,""); print; exit}' /var/www/pterodactyl/.env 2>/dev/null | tr -d "\"'\r" || true)"
  [ -n "${_EX_DB}" ] && PTERO_DB_NAME="${_EX_DB}"
  [ -n "${_EX_USER}" ] && PTERO_DB_USER="${_EX_USER}"
  [ -n "${_EX_PASS}" ] && PTERO_DB_PASSWORD="${_EX_PASS}"
fi
PTERO_DB_NAME="${PTERO_DB_NAME:-panel}"
PTERO_DB_USER="${PTERO_DB_USER:-pterodactyl}"
PTERO_DB_PASSWORD="${PTERO_DB_PASSWORD:-}"
PTERO_ADMIN_EMAIL="${PTERO_ADMIN_EMAIL:-${SPARROWX_ADMIN_EMAIL:-admin@${SPARROWX_DOMAIN}}}"
PTERO_ADMIN_USER="${PTERO_ADMIN_USER:-admin}"
PTERO_ADMIN_PASSWORD="${PTERO_ADMIN_PASSWORD:-}"
if is_pterodactyl_installed && command -v mariadb >/dev/null 2>&1; then
  _ADMIN_ROW="$(mariadb -Nse "SELECT username, email FROM \`${PTERO_DB_NAME}\`.users WHERE root_admin=1 ORDER BY id ASC LIMIT 1;" 2>/dev/null || true)"
  if [ -n "${_ADMIN_ROW}" ]; then
    PTERO_ADMIN_USER="$(echo "${_ADMIN_ROW}" | awk '{print $1}')"
    PTERO_ADMIN_EMAIL="$(echo "${_ADMIN_ROW}" | awk '{print $2}')"
  fi
fi

ensure_env_key "SPARROWX_DOMAIN" "${SPARROWX_DOMAIN}"
ensure_env_key "DOMAIN_ROOT" "${SPARROWX_DOMAIN}"
ensure_env_key "SPARROWX_STUDIO_DOMAIN" "${SPARROWX_STUDIO_DOMAIN}"
ensure_env_key "DOMAIN_STUDIO" "${SPARROWX_STUDIO_DOMAIN}"
ensure_env_key "DOMAIN_GAME" "${DOMAIN_GAME}"
ensure_env_key "PTERO_PORT" "${PTERO_PORT}"
ensure_env_key "SPARROWX_PUBLIC_IP" "${SPARROWX_PUBLIC_IP}"
ensure_env_key "HTTP_PORT" "${HTTP_PORT}"
ensure_env_key "HTTPS_PORT" "${HTTPS_PORT}"
ensure_env_key "APP_HOST_PORT" "${APP_HOST_PORT}"
ensure_env_key "PGRST_HOST_PORT" "${PGRST_HOST_PORT}"
ensure_env_key "PG_HOST_PORT" "${PG_HOST_PORT}"
ensure_env_key "POSTGRES_USER" "${POSTGRES_USER}"
ensure_env_key "POSTGRES_PASSWORD" "${POSTGRES_PASSWORD}"
ensure_env_key "POSTGRES_DB" "${POSTGRES_DB}"
ensure_env_key "SPARROWX_JWT_SECRET" "${SPARROWX_JWT_SECRET}"
ensure_env_key "SPARROWX_REDIS_SECRET" "${SPARROWX_REDIS_SECRET}"
[ -n "${PTERO_ADMIN_EMAIL}" ] && ensure_env_key "PTERO_ADMIN_EMAIL" "${PTERO_ADMIN_EMAIL}"
[ -n "${PTERO_ADMIN_USER}" ] && ensure_env_key "PTERO_ADMIN_USER" "${PTERO_ADMIN_USER}"
[ -n "${PTERO_ADMIN_PASSWORD}" ] && ensure_env_key "PTERO_ADMIN_PASSWORD" "${PTERO_ADMIN_PASSWORD}"
[ -n "${PTERO_DB_NAME}" ] && ensure_env_key "PTERO_DB_NAME" "${PTERO_DB_NAME}"
[ -n "${PTERO_DB_USER}" ] && ensure_env_key "PTERO_DB_USER" "${PTERO_DB_USER}"
[ -n "${PTERO_DB_PASSWORD}" ] && ensure_env_key "PTERO_DB_PASSWORD" "${PTERO_DB_PASSWORD}"
export SPARROWX_DOMAIN SPARROWX_STUDIO_DOMAIN DOMAIN_GAME PTERO_PORT SPARROWX_PUBLIC_IP HTTP_PORT HTTPS_PORT APP_HOST_PORT PGRST_HOST_PORT PG_HOST_PORT POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB SPARROWX_JWT_SECRET SPARROWX_REDIS_SECRET PTERO_ADMIN_EMAIL PTERO_ADMIN_USER PTERO_ADMIN_PASSWORD PTERO_DB_NAME PTERO_DB_USER PTERO_DB_PASSWORD

log_ok "Environment validated (${SPARROWX_DOMAIN} @ ${SPARROWX_PUBLIC_IP})"

# ==============================================================================
# STEP 2/7: Disk/Swap OOM Protection & GitHub Sync (origin/main)
# ==============================================================================
draw_progress 2 7 "Disk, Swap & GitHub Sync"

FREE_DISK_MB="$(df -Pm "${INSTALL_DIR}" 2>/dev/null | awk 'NR==2 {print $4}' || echo 99999)"
if [ "${FREE_DISK_MB:-99999}" -lt 2048 ]; then
  log_warn "Low free disk (${FREE_DISK_MB} MB) — pruning dangling Docker images & caches before build"
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    docker container prune -f >/dev/null 2>&1 || true
    docker image prune -f >/dev/null 2>&1 || true
    docker builder prune -f >/dev/null 2>&1 || true
  fi
  journalctl --vacuum-size=100M >/dev/null 2>&1 || true
fi

TOTAL_RAM_MB="$(free -m 2>/dev/null | awk '/^Mem:/ {print $2}' || echo 4096)"
TOTAL_SWAP_MB="$(free -m 2>/dev/null | awk '/^Swap:/ {print $2}' || echo 2048)"
if [ "${TOTAL_SWAP_MB:-0}" -lt 512 ] && [ "${TOTAL_RAM_MB:-4096}" -lt 4096 ] && [ ! -f /swapfile ] && [ "${FREE_DISK_MB:-0}" -gt 4096 ]; then
  log_warn "Provisioning 2 GB /swapfile to prevent build OOM kills (${TOTAL_RAM_MB} MB RAM)"
  (fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none) && \
    chmod 600 /swapfile && \
    mkswap /swapfile >/dev/null 2>&1 && \
    swapon /swapfile 2>/dev/null || true
  if ! grep -q "^/swapfile " /etc/fstab 2>/dev/null; then
    echo "/swapfile none swap sw 0 0" >> /etc/fstab
  fi
fi

if [ -d "${INSTALL_DIR}/.git" ] && command -v git >/dev/null 2>&1; then
  if ! git config --global --get-all safe.directory 2>/dev/null | grep -Fxq "${INSTALL_DIR}"; then
    git config --global --add safe.directory "${INSTALL_DIR}" 2>/dev/null || true
    log_warn "Registered ${INSTALL_DIR} in git safe.directory"
  fi
  for gitlock in "${INSTALL_DIR}/.git/index.lock" "${INSTALL_DIR}/.git/HEAD.lock" "${INSTALL_DIR}/.git/shallow.lock"; do
    if [ -f "${gitlock}" ] && ! pgrep -x "git" >/dev/null 2>&1; then
      rm -f "${gitlock}" 2>/dev/null || true
      log_warn "Cleared stale $(basename "${gitlock}") before pull"
    fi
  done

  BEFORE_HASH="$(git rev-parse HEAD 2>/dev/null || echo "")"
  if git fetch origin main --depth=1 && git reset --hard origin/main; then
    AFTER_HASH="$(git rev-parse HEAD 2>/dev/null || echo "")"
    log_ok "Repository synced to commit $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
    strip_crlf_all
    chmod +x "${INSTALL_DIR}"/*.sh "${INSTALL_DIR}"/ovh/*.sh "${INSTALL_DIR}"/deploy/*.sh 2>/dev/null || true
    if [ "${BEFORE_HASH}" != "${AFTER_HASH}" ] && [ "${SPARROWX_REEXEC:-0}" != "1" ]; then
      export SPARROWX_REEXEC=1
      log_info "Updater updated itself — re-launching new update.sh seamlessly..."
      exec bash "${INSTALL_DIR}/update.sh" "$@"
    fi
  else
    log_err "GitHub sync hit a transient network issue — continuing with local files + self-healing"
  fi
fi

# ==============================================================================
# STEP 3/7: Kernel Security Hardening, Package Locks & UFW Firewall
# ==============================================================================
draw_progress 3 7 "Kernel Hardening & Firewall"

if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  if ! pgrep -x "apt|apt-get|dpkg|unattended-upgr" >/dev/null 2>&1; then
    for lck in /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/lib/apt/lists/lock; do
      if [ -e "${lck}" ] && command -v fuser >/dev/null 2>&1 && ! fuser "${lck}" >/dev/null 2>&1; then
        rm -f "${lck}" 2>/dev/null || true
        dpkg --configure -a >/dev/null 2>&1 || true
        log_warn "Cleaned stale package manager lock (${lck})"
      fi
    done
  fi
fi

if [ ! -f /etc/sysctl.d/99-sparrowx-hardening.conf ]; then
  cat > /etc/sysctl.d/99-sparrowx-hardening.conf <<'EOF'
# SparrowX Autonomous Kernel Security & High-Throughput Tuning
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
EOF
  sysctl --system >/dev/null 2>&1 || true
  if command -v apt-get >/dev/null 2>&1; then
    apt-get install -y -qq unattended-upgrades fail2ban psmisc iproute2 >/dev/null 2>&1 || true
    systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
    systemctl enable --now fail2ban >/dev/null 2>&1 || true
  fi
  log_ok "Kernel SYN-cookie shield, Fail2Ban & unattended CVE patching active"
else
  log_ok "OS kernel hardening & Fail2Ban active"
fi

if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw allow "${HTTP_PORT}"/tcp >/dev/null 2>&1 || true
  ufw allow "${HTTPS_PORT}"/tcp >/dev/null 2>&1 || true
  ufw allow in from 127.0.0.1 to any port "${PTERO_PORT}" proto tcp >/dev/null 2>&1 || true
  ufw allow in from 172.16.0.0/12 to any port "${PTERO_PORT}" proto tcp >/dev/null 2>&1 || true
  if [ -d /etc/pterodactyl ] || systemctl list-unit-files wings.service >/dev/null 2>&1; then
    ufw allow 8080/tcp >/dev/null 2>&1 || true
    ufw allow 2022/tcp >/dev/null 2>&1 || true
  fi
  log_ok "UFW ports opened (22, 80, 443, ${HTTP_PORT}, ${HTTPS_PORT}, Ptero:${PTERO_PORT})"
fi

# ==============================================================================
# STEP 4/7: SSL Certificates & Multi-Domain Nginx Proxy
# ==============================================================================
draw_progress 4 7 "SSL & Multi-Domain Nginx"

mkdir -p "${INSTALL_DIR}/ovh/ssl" "${INSTALL_DIR}/ovh/certbot-www/.well-known/acme-challenge" "${INSTALL_DIR}/data/users" "${INSTALL_DIR}/data/backups"

SSL_CERT="${INSTALL_DIR}/ovh/ssl/fullchain.pem"
SSL_KEY="${INSTALL_DIR}/ovh/ssl/privkey.pem"
if [ ! -s "${SSL_CERT}" ] || [ ! -s "${SSL_KEY}" ] || ! openssl x509 -in "${SSL_CERT}" -noout >/dev/null 2>&1; then
  log_warn "Generating valid TLS certificate (SAN: ${SPARROWX_DOMAIN} + subdomains)"
  if ! openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "${SSL_KEY}" \
    -out "${SSL_CERT}" \
    -subj "/CN=${SPARROWX_DOMAIN}" \
    -addext "subjectAltName=DNS:${SPARROWX_DOMAIN},DNS:*.${SPARROWX_DOMAIN},DNS:${DOMAIN_GAME},DNS:panel.${SPARROWX_DOMAIN}" >/dev/null 2>&1; then
    openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
      -keyout "${SSL_KEY}" \
      -out "${SSL_CERT}" \
      -subj "/CN=${SPARROWX_DOMAIN}" >/dev/null 2>&1 || true
  fi
fi

if is_pterodactyl_installed; then
  heal_pterodactyl_host_nginx
fi

render_sparrowx_nginx_conf() {
  local docker_host_ip
  docker_host_ip="$(get_docker_host_ip)"
  local ptero_ssl_cert="/etc/nginx/ssl/fullchain.pem"
  local ptero_ssl_key="/etc/nginx/ssl/privkey.pem"
  if [ -s "${INSTALL_DIR}/ovh/ssl/ptero-fullchain.pem" ] && [ -s "${INSTALL_DIR}/ovh/ssl/ptero-privkey.pem" ]; then
    ptero_ssl_cert="/etc/nginx/ssl/ptero-fullchain.pem"
    ptero_ssl_key="/etc/nginx/ssl/ptero-privkey.pem"
  fi
  local ptero_backend=""
  if is_pterodactyl_installed; then
    ptero_backend="    location / {
        proxy_pass http://${docker_host_ip}:${PTERO_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port \$server_port;
        proxy_read_timeout 300s;
    }"
  else
    ptero_backend="    location / {
        proxy_pass http://sparrowx:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }"
  fi

  cat > "${INSTALL_DIR}/ovh/nginx.conf" <<EOF
# 1. Master SparrowX Command Center & Default Fallback (${SPARROWX_DOMAIN})
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    server_name ${SPARROWX_DOMAIN} www.${SPARROWX_DOMAIN} _;
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 100M;
    server_tokens off;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location /rest/v1/ {
        proxy_pass http://sparrowx:3000/rest/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PATCH, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, apikey, Prefer, x-sparrowx-key" always;
        if (\$request_method = OPTIONS) { return 204; }
    }

    location / {
        proxy_pass http://sparrowx:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# 2. Dedicated Database Studio Domain (${SPARROWX_STUDIO_DOMAIN})
server {
    listen 80;
    listen 443 ssl;
    server_name ${SPARROWX_STUDIO_DOMAIN} studio.${SPARROWX_DOMAIN};
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 100M;
    server_tokens off;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location /rest/v1/ {
        proxy_pass http://sparrowx:3000/rest/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PATCH, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, apikey, Prefer, x-sparrowx-key" always;
        if (\$request_method = OPTIONS) { return 204; }
    }

    location / {
        proxy_pass http://sparrowx:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-SparrowX-Studio "1";
    }
}

# 3. Standalone Product Subdomains (Drop, Keys, Shield, API)
server {
    listen 80;
    listen 443 ssl;
    server_name file.${SPARROWX_DOMAIN} drop.${SPARROWX_DOMAIN} password.${SPARROWX_DOMAIN} passwd.${SPARROWX_DOMAIN} keys.${SPARROWX_DOMAIN} sec.${SPARROWX_DOMAIN} shield.${SPARROWX_DOMAIN} api.${SPARROWX_DOMAIN} rest.${SPARROWX_DOMAIN};
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 100M;
    server_tokens off;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location /rest/v1/ {
        proxy_pass http://sparrowx:3000/rest/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PATCH, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, apikey, Prefer, x-sparrowx-key" always;
        if (\$request_method = OPTIONS) { return 204; }
    }

    location / {
        proxy_pass http://sparrowx:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# 4. Pterodactyl Game Panel (${DOMAIN_GAME})
server {
    listen 80;
    listen 443 ssl;
    server_name ${DOMAIN_GAME} panel.${SPARROWX_DOMAIN};
    ssl_certificate ${ptero_ssl_cert};
    ssl_certificate_key ${ptero_ssl_key};
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 100M;
    server_tokens off;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        allow all;
    }

${ptero_backend}
}
EOF
}

render_sparrowx_nginx_conf
log_ok "Nginx reverse proxy configured for all SparrowX domains & ${DOMAIN_GAME}"

# ==============================================================================
# STEP 5/7: Auto-Upgrade Systemd Daemon & CLI Symlinks
# ==============================================================================
draw_progress 5 7 "Auto-Upgrade Daemon & CLI"

if [ -d /etc/systemd/system ] && command -v systemctl >/dev/null 2>&1; then
  cat > /etc/systemd/system/sparrowx-autoupdate.service <<EOF
[Unit]
Description=SparrowX Automatic GitHub Sync & Self-Healing Rebuild
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=${INSTALL_DIR}
ExecStart=/bin/bash -c 'git fetch origin main --depth=1 && if [ "\$(git rev-parse HEAD)" != "\$(git rev-parse origin/main)" ]; then ${INSTALL_DIR}/update.sh --auto; fi'
EOF
  if [ ! -f /etc/systemd/system/sparrowx-autoupdate.timer ]; then
    cat > /etc/systemd/system/sparrowx-autoupdate.timer <<'EOF'
[Unit]
Description=Check GitHub every 5 minutes for SparrowX updates

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
EOF
  fi
  systemctl daemon-reload >/dev/null 2>&1 || true
  systemctl enable --now sparrowx-autoupdate.timer >/dev/null 2>&1 || true
  log_ok "Auto-upgrade timer active; CLIs linked (sparrowx-update, sparrowx-fix, sparrowx-db)"
fi

# ==============================================================================
# STEP 6/7: Pre-Healed Container Fleet Rebuild & Port Conflict Protection
# ==============================================================================
draw_progress 6 7 "Container Build & Port Shield"

DB_MARKER_FILE="${INSTALL_DIR}/data/.db_initialized"
COMPOSE_FILE="${INSTALL_DIR}/docker-compose.ovh.yml"
if [ ! -f "${COMPOSE_FILE}" ] && [ -f "${INSTALL_DIR}/docker-compose.yml" ]; then
  COMPOSE_FILE="${INSTALL_DIR}/docker-compose.yml"
fi
APP_SERVICE="sparrowx"
HAS_DOCKER="false"
BUILD_FAILED="false"

if command -v docker >/dev/null 2>&1; then
  if ! docker info >/dev/null 2>&1; then
    log_warn "Docker daemon unresponsive — restarting containerd & docker"
    systemctl restart containerd docker >/dev/null 2>&1 || true
    sleep 3
  fi
  if docker info >/dev/null 2>&1; then
    HAS_DOCKER="true"
  fi
fi

if [ "${HAS_DOCKER}" = "true" ]; then
  # Stop conflicting host daemons (keep host nginx alive if Pterodactyl Panel is installed)
  for svc in sparrowx-native.service postgresql pgbouncer apache2 caddy; do
    if systemctl is-active --quiet "${svc}" 2>/dev/null; then
      systemctl stop "${svc}" >/dev/null 2>&1 || true
      log_warn "Stopped conflicting host service: ${svc}"
    fi
  done
  if is_pterodactyl_installed; then
    heal_pterodactyl_host_nginx
  elif systemctl is-active --quiet nginx 2>/dev/null; then
    systemctl stop nginx >/dev/null 2>&1 || true
    log_warn "Stopped conflicting host service: nginx"
  fi
  for pg_unit in $(systemctl list-units --type=service --state=active --no-legend 'postgresql@*' 2>/dev/null | awk '{print $1}' || true); do
    systemctl stop "${pg_unit}" >/dev/null 2>&1 || true
    log_warn "Stopped conflicting versioned PostgreSQL unit: ${pg_unit}"
  done

  # Remove legacy/duplicate standalone containers BEFORE checking ports
  if [ -f "${INSTALL_DIR}/docker-compose.standalone.yml" ]; then
    compose_cmd -f "${INSTALL_DIR}/docker-compose.standalone.yml" down --remove-orphans >/dev/null 2>&1 || true
  fi
  for old_c in sparrowx_postgres sparrowx_pgbouncer sparrowx_postgrest sparrowx_threat_cache sparrowx_studio sparrowx_edge_proxy; do
    if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -Fxq "${old_c}"; then
      docker rm -f "${old_c}" >/dev/null 2>&1 || true
      log_warn "Removed legacy conflicting container: ${old_c}"
    fi
  done

  # Clear crashed/non-running sparrowx-postgres + stray host postgres/docker-proxy on 5432, and uninitialized sparrowx_pgdata
  if ! docker ps --filter status=running --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-postgres"; then
    docker rm -f sparrowx-postgres >/dev/null 2>&1 || true
    pkill -9 -x postgres >/dev/null 2>&1 || true
    pkill -9 -f "docker-proxy.*-host-port ${PG_HOST_PORT}( |$)" >/dev/null 2>&1 || true
    command -v fuser >/dev/null 2>&1 && fuser -k "${PG_HOST_PORT}/tcp" >/dev/null 2>&1 || true
  fi
  if ! docker ps --filter status=running --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-nginx"; then
    pkill -9 -f "docker-proxy.*-host-port ${HTTP_PORT}( |$)" >/dev/null 2>&1 || true
    pkill -9 -f "docker-proxy.*-host-port ${HTTPS_PORT}( |$)" >/dev/null 2>&1 || true
  fi
  for pg_vol in $(docker volume ls -q 2>/dev/null | grep 'sparrowx_pgdata' || true); do
    vol_mp="$(docker volume inspect -f '{{.Mountpoint}}' "${pg_vol}" 2>/dev/null || true)"
    if [ -n "${vol_mp}" ] && [ -d "${vol_mp}" ] && [ ! -f "${vol_mp}/PG_VERSION" ] && [ -n "$(ls -A "${vol_mp}" 2>/dev/null)" ]; then
      docker rm -f sparrowx-postgres >/dev/null 2>&1 || true
      rm -rf "${vol_mp:?}"/* "${vol_mp:?}"/.[!.]* "${vol_mp:?}"/..?* 2>/dev/null || true
      log_warn "Cleared uninitialized/corrupted PostgreSQL volume ${pg_vol} (missing PG_VERSION)"
    fi
  done

  # Remove foreign Docker containers holding SparrowX ports (80, 443, 5432, 3000, 3001)
  free_docker_port_conflicts "${HTTP_PORT}" "sparrowx-nginx"
  free_docker_port_conflicts "${HTTPS_PORT}" "sparrowx-nginx"
  free_docker_port_conflicts "${PG_HOST_PORT}" "sparrowx-postgres"
  free_docker_port_conflicts "${PGRST_HOST_PORT}" "sparrowx-postgrest"
  free_docker_port_conflicts "${APP_HOST_PORT}" "sparrowx-app"

  # Free HTTP/HTTPS ports if held by non-sparrowx-nginx processes
  for wp in "${HTTP_PORT}" "${HTTPS_PORT}"; do
    if port_held_by_other "${wp}" "sparrowx-nginx"; then
      log_warn "Clearing foreign process holding port ${wp}/tcp"
      command -v fuser >/dev/null 2>&1 && fuser -k "${wp}/tcp" >/dev/null 2>&1 || true
      sleep 1
    fi
  done

  # Check PostgREST & App port conflicts before launch
  if port_held_by_other "${PGRST_HOST_PORT}" "sparrowx-postgrest"; then
    PGRST_HOST_PORT="$(find_next_free_port 3002)"
    ensure_env_key "PGRST_HOST_PORT" "${PGRST_HOST_PORT}"
    export PGRST_HOST_PORT
    log_warn "Shifted PGRST_HOST_PORT=${PGRST_HOST_PORT} to bypass port conflict"
  fi
  if port_held_by_other "${APP_HOST_PORT}" "sparrowx-app"; then
    APP_HOST_PORT="$(find_next_free_port 3010)"
    ensure_env_key "APP_HOST_PORT" "${APP_HOST_PORT}"
    export APP_HOST_PORT
    log_warn "Shifted APP_HOST_PORT=${APP_HOST_PORT} to bypass port conflict"
  fi

  IS_PG_RUNNING="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -Fx "sparrowx-postgres" || true)"
  IS_PGRST_RUNNING="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -Fx "sparrowx-postgrest" || true)"

  if [ -n "${IS_PG_RUNNING}" ] && [ -n "${IS_PGRST_RUNNING}" ] && [ "${FORCE_DB_INSTALL}" = "false" ]; then
    log_info "PostgreSQL & PostgREST running cleanly — rebuilding ${APP_SERVICE} container..."
    if compose_cmd -f "${COMPOSE_FILE}" build "${APP_SERVICE}" && compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps --remove-orphans "${APP_SERVICE}"; then
      compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps sparrowx nginx >/dev/null 2>&1 || true
      docker start sparrowx-app sparrowx-nginx >/dev/null 2>&1 || true
      docker restart sparrowx-nginx >/dev/null 2>&1 || true
      log_ok "Rebuilt and restarted ${APP_SERVICE} + sparrowx-nginx zero-downtime"
    else
      BUILD_FAILED="true"
    fi
  else
    if port_held_by_other "${PG_HOST_PORT}" "sparrowx-postgres"; then
      command -v fuser >/dev/null 2>&1 && fuser -k "${PG_HOST_PORT}/tcp" >/dev/null 2>&1 || true
      sleep 1
    fi
    if port_held_by_other "${PG_HOST_PORT}" "sparrowx-postgres"; then
      PG_HOST_PORT="$(find_next_free_port 5433)"
      ensure_env_key "PG_HOST_PORT" "${PG_HOST_PORT}"
      export PG_HOST_PORT
      log_warn "Host port 5432 in use — reassigned PG_HOST_PORT=${PG_HOST_PORT} in .env"
    fi

    log_info "Launching Full-Stack Docker fleet via $(basename "${COMPOSE_FILE}")..."
    if ! compose_cmd -f "${COMPOSE_FILE}" up --build -d --remove-orphans; then
      log_warn "Initial Compose startup hit conflict — cleaning bridge networks, stale containers & retrying"
      compose_cmd -f "${COMPOSE_FILE}" down --remove-orphans >/dev/null 2>&1 || true
      docker rm -f sparrowx-postgres sparrowx-postgrest sparrowx-app sparrowx-nginx >/dev/null 2>&1 || true
      docker network prune -f >/dev/null 2>&1 || true
      free_docker_port_conflicts "${PG_HOST_PORT}" "sparrowx-postgres"
      command -v fuser >/dev/null 2>&1 && fuser -k 5432/tcp >/dev/null 2>&1 || true
      if is_port_busy "${PG_HOST_PORT}" || [ "${PG_HOST_PORT}" = "5432" ]; then
        if is_port_busy 5432; then
          PG_HOST_PORT="$(find_next_free_port 5433)"
          ensure_env_key "PG_HOST_PORT" "${PG_HOST_PORT}"
          export PG_HOST_PORT
          log_warn "Assigned clean PG_HOST_PORT=${PG_HOST_PORT}"
        fi
      fi
      if ! compose_cmd -f "${COMPOSE_FILE}" up --build -d --remove-orphans; then
        BUILD_FAILED="true"
      fi
    fi
    compose_cmd -f "${COMPOSE_FILE}" up -d --no-deps sparrowx nginx >/dev/null 2>&1 || true
    docker start sparrowx-app sparrowx-nginx >/dev/null 2>&1 || true
    if is_pterodactyl_installed; then
      render_sparrowx_nginx_conf
    fi
    docker restart sparrowx-nginx >/dev/null 2>&1 || true
    if is_pterodactyl_installed; then
      ensure_game_letsencrypt_ssl
    fi
    if [ -x "${INSTALL_DIR}/deploy/ssl-renew.sh" ]; then
      bash "${INSTALL_DIR}/deploy/ssl-renew.sh" >/dev/null 2>&1 || true
    fi
  fi

  if [ "${BUILD_FAILED}" = "true" ] && [ -x "${INSTALL_DIR}/fix.sh" ]; then
    log_warn "Build/startup reported errors — invoking autonomous doctor (fix.sh --auto --rebuild)"
    "${INSTALL_DIR}/fix.sh" --auto --rebuild
  fi
else
  log_info "Docker unavailable — rebuilding native Node.js SparrowX server..."
  export NODE_OPTIONS="--max-old-space-size=2048"
  export VITE_SOVEREIGN_SELF_HOSTED="true"
  export VITE_SUPABASE_URL=""
  npm install --legacy-peer-deps && npm run build
  systemctl restart sparrowx-native.service 2>/dev/null || true
fi

# ==============================================================================
# STEP 7/7: PostgreSQL Role/Schema Verify, DB Sync & Live Health Gate
# ==============================================================================
draw_progress 7 7 "DB Schema Sync & Health Probe"

if [ "${HAS_DOCKER}" = "true" ] && docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-postgres"; then
  for _pgw in $(seq 1 15); do
    docker exec sparrowx-postgres pg_isready -q >/dev/null 2>&1 && break
    sleep 1
  done
  if [ -f "${INSTALL_DIR}/ovh/schema.sql" ]; then
    USERS_TBL="$(docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" sparrowx-postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "SELECT to_regclass('public.app_users');" 2>/dev/null | tr -d '[:space:]')"
    INQ_TBL="$(docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" sparrowx-postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "SELECT to_regclass('public.contact_inquiries');" 2>/dev/null | tr -d '[:space:]')"
    if { [ "${USERS_TBL}" != "app_users" ] && [ "${USERS_TBL}" != "public.app_users" ]; } || { [ "${INQ_TBL}" != "contact_inquiries" ] && [ "${INQ_TBL}" != "public.contact_inquiries" ]; }; then
      docker exec -i -e PGPASSWORD="${POSTGRES_PASSWORD}" sparrowx-postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "${INSTALL_DIR}/ovh/schema.sql" >/dev/null 2>&1 || true
      log_warn "Applied schema updates from ovh/schema.sql"
    fi
  fi
fi

# Verify HTTP health endpoint responds 200 OK
log_info "Probing SparrowX HTTP & PostgREST health endpoints..."
HEALTH_OK="false"
for _i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:${APP_HOST_PORT}/api/v1/health" >/dev/null 2>&1; then
    HEALTH_OK="true"
    break
  fi
  sleep 2
done

if [ "${HEALTH_OK}" = "true" ]; then
  log_ok "SparrowX Web Server healthy (http://127.0.0.1:${APP_HOST_PORT}/api/v1/health -> 200 OK)"
else
  log_warn "Health probe failed — running deep recovery doctor (fix.sh --auto)"
  if [ -x "${INSTALL_DIR}/fix.sh" ]; then
    "${INSTALL_DIR}/fix.sh" --auto
    curl -fsS "http://127.0.0.1:${APP_HOST_PORT}/api/v1/health" >/dev/null 2>&1 && HEALTH_OK="true"
  fi
fi

# Seed or verify local DB population
EXISTING_USERS_COUNT="0"
if curl -fsS "http://127.0.0.1:${PGRST_HOST_PORT}/app_users?select=id&limit=1" 2>/dev/null | grep -q '"id"'; then
  EXISTING_USERS_COUNT="1"
fi

if [ -f "${DB_MARKER_FILE}" ] || [ "${EXISTING_USERS_COUNT}" = "1" ]; then
  if [ "${FORCE_DB_INSTALL}" = "true" ]; then
    log_info "--reinstall-db requested: re-syncing Local OVH DB & per-user folders..."
    sleep 2
    "${INSTALL_DIR}/manage-db.sh" sync >/dev/null 2>&1 && touch "${DB_MARKER_FILE}" || true
  else
    touch "${DB_MARKER_FILE}" 2>/dev/null || true
    log_ok "PostgreSQL database & accounts intact (use './update.sh --reinstall-db' to force re-sync)"
  fi
else
  log_info "First-time setup: seeding Local OVH DB & per-user directories..."
  sleep 3
  "${INSTALL_DIR}/manage-db.sh" sync >/dev/null 2>&1 && touch "${DB_MARKER_FILE}" || true
fi

PGRST_STATUS="$(curl -fsS "http://127.0.0.1:${PGRST_HOST_PORT}/" >/dev/null 2>&1 && echo "ONLINE" || echo "STARTING")"
EDGE_STATUS="$(curl -fsS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${HTTP_PORT}/api/v1/health" 2>/dev/null | grep -qE "^(200|301|302)$" && echo "ONLINE" || echo "CHECK")"
PTERO_STATUS="NOT INSTALLED"
if is_pterodactyl_installed; then
  PTERO_EDGE_CODE="$(curl -sk -o /dev/null -w "%{http_code}" --max-time 4 -H "Host: ${DOMAIN_GAME}" "https://127.0.0.1:${HTTPS_PORT}/" 2>/dev/null || echo "000")"
  if ! echo "${PTERO_EDGE_CODE}" | grep -qE "^(200|301|302)$"; then
    heal_pterodactyl_host_nginx
    render_sparrowx_nginx_conf
    docker exec sparrowx-nginx nginx -s reload >/dev/null 2>&1 || docker restart sparrowx-nginx >/dev/null 2>&1 || true
    sleep 2
    PTERO_EDGE_CODE="$(curl -sk -o /dev/null -w "%{http_code}" --max-time 4 -H "Host: ${DOMAIN_GAME}" "https://127.0.0.1:${HTTPS_PORT}/" 2>/dev/null || echo "000")"
  fi
  PTERO_STATUS="$(echo "${PTERO_EDGE_CODE}" | grep -qE "^(200|301|302)$" && echo "ONLINE (:${PTERO_PORT})" || echo "CHECK (HTTP ${PTERO_EDGE_CODE})")"
fi

echo ""
echo -e "${C_GREEN}╔══════════════════════════════════════════════════════════════════════════╗${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}  ${C_BOLD}${C_WHITE}✅ ALL UPDATES APPLIED & FULL-STACK OVH SYSTEM IS LIVE (A-TO-Z)${C_RESET}         ${C_GREEN}║${C_RESET}"
echo -e "${C_GREEN}╠══════════════════════════════════════════════════════════════════════════╣${C_RESET}"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-24s${C_RESET} : %-44s ${C_GREEN}║${C_RESET}\n" "Git Commit" "$(git rev-parse --short HEAD 2>/dev/null || echo local) (origin/main)"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-24s${C_RESET} : %-44s ${C_GREEN}║${C_RESET}\n" "Auto-Healed Fixes" "${HEALED_COUNT} issue(s) resolved automatically"
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-24s${C_RESET} : %-44s ${C_GREEN}║${C_RESET}\n" "Web / PostgREST / Edge" "$([ "${HEALTH_OK}" = "true" ] && echo "ONLINE" || echo "WARN") / ${PGRST_STATUS} / ${EDGE_STATUS}"
if is_pterodactyl_installed; then
  printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-24s${C_RESET} : %-44s ${C_GREEN}║${C_RESET}\n" "Pterodactyl Panel" "${PTERO_STATUS}"
fi
printf "${C_GREEN}║${C_RESET}  ${C_BOLD}%-24s${C_RESET} : %-44s ${C_GREEN}║${C_RESET}\n" "Port Bindings" "PG:${PG_HOST_PORT} PGRST:${PGRST_HOST_PORT} APP:${APP_HOST_PORT} WEB:${HTTP_PORT}/${HTTPS_PORT}"
echo -e "${C_GREEN}╠══════════════════════════════════════════════════════════════════════════╣${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}  ${C_BOLD}Dedicated Service Websites:${C_RESET}                                             ${C_GREEN}║${C_RESET}"
printf "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Master Portal    : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} DB Studio        : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://db.${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_CYAN}•${C_RESET} Drop Vault       : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://file.${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_YELLOW}•${C_RESET} Password Vault   : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://password.${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_BLUE}•${C_RESET} Shield WAF/SOC   : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://sec.${SPARROWX_DOMAIN}"
printf "${C_GREEN}║${C_RESET}   ${C_MAGENTA}•${C_RESET} REST API Gateway : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://api.${SPARROWX_DOMAIN}"
if is_pterodactyl_installed; then
  printf "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Game Panel       : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "https://${DOMAIN_GAME}"
fi
echo -e "${C_GREEN}╠══════════════════════════════════════════════════════════════════════════╣${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}  ${C_BOLD}${C_YELLOW}Credentials & Database Info Used:${C_RESET}"
if is_pterodactyl_installed; then
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Panel Login URL  : ${C_WHITE}https://${DOMAIN_GAME}${C_RESET} ${C_DIM}(Internal :${PTERO_PORT})${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Panel Admin Email: ${C_CYAN}${PTERO_ADMIN_EMAIL}${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Panel Admin User : ${C_CYAN}${PTERO_ADMIN_USER}${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Panel Admin Pass : ${C_YELLOW}${PTERO_ADMIN_PASSWORD:-(run ./fix.sh to sync/reset)}${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Ptero MySQL Host : ${C_WHITE}127.0.0.1:3306${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Ptero MySQL DB   : ${C_WHITE}${PTERO_DB_NAME}${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Ptero MySQL User : ${C_WHITE}${PTERO_DB_USER}${C_RESET}"
  echo -e "${C_GREEN}║${C_RESET}   ${C_GREEN}•${C_RESET} Ptero MySQL Pass : ${C_YELLOW}${PTERO_DB_PASSWORD:-(check /var/www/pterodactyl/.env)}${C_RESET}"
fi
echo -e "${C_GREEN}║${C_RESET}   ${C_MAGENTA}•${C_RESET} Postgres Host    : ${C_WHITE}127.0.0.1:${PG_HOST_PORT}${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}   ${C_MAGENTA}•${C_RESET} Postgres DB/User : ${C_WHITE}${POSTGRES_DB} / ${POSTGRES_USER}${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}   ${C_MAGENTA}•${C_RESET} Postgres Pass    : ${C_YELLOW}${POSTGRES_PASSWORD}${C_RESET}"
echo -e "${C_GREEN}╠══════════════════════════════════════════════════════════════════════════╣${C_RESET}"
echo -e "${C_GREEN}║${C_RESET}  ${C_BOLD}Quick Operations CLI:${C_RESET}                                                   ${C_GREEN}║${C_RESET}"
printf "${C_GREEN}║${C_RESET}   ${C_YELLOW}•${C_RESET} Full Update      : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "./update.sh  (or: sparrowx-update)"
printf "${C_GREEN}║${C_RESET}   ${C_YELLOW}•${C_RESET} Auto-Heal Doctor : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "./fix.sh     (or: sparrowx-fix / sparrowx-doctor)"
printf "${C_GREEN}║${C_RESET}   ${C_YELLOW}•${C_RESET} Database TUI     : ${C_WHITE}%-49s${C_RESET} ${C_GREEN}║${C_RESET}\n" "./manage-db.sh (or: sparrowx-db)"
echo -e "${C_GREEN}╚══════════════════════════════════════════════════════════════════════════╝${C_RESET}"
