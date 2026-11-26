#!/usr/bin/env bash
# ==============================================================================
# SPARROWX MULTI-DOMAIN LET'S ENCRYPT SSL AUTO-ISSUER & RENEWAL ENGINE
# Automatically upgrades self-signed fallback certs to live Let's Encrypt SSL
# once DNS propagates, and renews certificates every 12 hours via cron.
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

[ -f "${INSTALL_DIR}/.env" ] && source "${INSTALL_DIR}/.env" 2>/dev/null || true

DOMAIN_ROOT="${DOMAIN_ROOT:-${SPARROWX_DOMAIN:-sparrowx.local}}"
DOMAIN_STUDIO="${DOMAIN_STUDIO:-db.${DOMAIN_ROOT}}"
DOMAIN_SEC="${DOMAIN_SEC:-sec.${DOMAIN_ROOT}}"
DOMAIN_FILE="${DOMAIN_FILE:-file.${DOMAIN_ROOT}}"
DOMAIN_PASSWORD="${DOMAIN_PASSWORD:-password.${DOMAIN_ROOT}}"
DOMAIN_API="${DOMAIN_API:-api.${DOMAIN_ROOT}}"
DOMAIN_INFRA="${DOMAIN_INFRA:-infra.${DOMAIN_ROOT}}"
DOMAIN_GAME_WEB="${DOMAIN_GAME_WEB:-game.${DOMAIN_ROOT}}"
DOMAIN_GAME_DASH="${DOMAIN_GAME_DASH:-game.dash.${DOMAIN_ROOT}}"
DOMAIN_GAMESEC="${DOMAIN_GAMESEC:-gamesec.${DOMAIN_ROOT}}"
DOMAIN_NETSEC="${DOMAIN_NETSEC:-netsec.${DOMAIN_ROOT}}"
if [ -z "${DOMAIN_GAME:-}" ] || [ "${DOMAIN_GAME}" = "game.${DOMAIN_ROOT}" ]; then
  DOMAIN_GAME="game.panel.${DOMAIN_ROOT}"
fi
SPARROWX_ADMIN_EMAIL="${SPARROWX_ADMIN_EMAIL:-admin@${DOMAIN_ROOT}}"
SPARROWX_PUBLIC_IP="${SPARROWX_PUBLIC_IP:-}"
WEBROOT="${INSTALL_DIR}/ovh/certbot-www"
SSL_DIR="${INSTALL_DIR}/ovh/ssl"
LOG_FILE="/var/log/sparrowx-ssl.log"

log_ssl() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}" >/dev/null 2>&1 || true
}

if [[ "${DOMAIN_ROOT}" == *.local ]] || ! command -v certbot >/dev/null 2>&1; then
  exit 0
fi

mkdir -p "${WEBROOT}/.well-known/acme-challenge" "${SSL_DIR}"

if [ -z "${SPARROWX_PUBLIC_IP}" ]; then
  SPARROWX_PUBLIC_IP="$(curl -4 -fsS --max-time 4 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
fi

# Collect all domains whose DNS A record currently resolves to this server IP
CANDIDATE_DOMAINS=(
  "${DOMAIN_ROOT}"
  "www.${DOMAIN_ROOT}"
  "${DOMAIN_STUDIO}"
  "${DOMAIN_SEC}"
  "shield.${DOMAIN_ROOT}"
  "${DOMAIN_FILE}"
  "drop.${DOMAIN_ROOT}"
  "${DOMAIN_PASSWORD}"
  "passwd.${DOMAIN_ROOT}"
  "keys.${DOMAIN_ROOT}"
  "${DOMAIN_API}"
  "${DOMAIN_INFRA}"
  "metal.${DOMAIN_ROOT}"
  "deploy.${DOMAIN_ROOT}"
  "ai.${DOMAIN_ROOT}"
  "agents.${DOMAIN_ROOT}"
  "dpdp.${DOMAIN_ROOT}"
  "dpd.${DOMAIN_ROOT}"
  "php.${DOMAIN_ROOT}"
  "${DOMAIN_GAME_WEB}"
  "${DOMAIN_GAME_DASH}"
  "${DOMAIN_GAME}"
  "panel.${DOMAIN_ROOT}"
  "${DOMAIN_GAMESEC}"
  "${DOMAIN_NETSEC}"
)

CERTBOT_ARGS=()
VALID_DOMAINS=()

for d in "${CANDIDATE_DOMAINS[@]}"; do
  resolved_ip=""
  if command -v dig >/dev/null 2>&1; then
    resolved_ip="$(dig +short A "${d}" @1.1.1.1 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -n 1 || true)"
  fi
  if [ -z "${resolved_ip}" ]; then
    resolved_ip="$(getent ahostsv4 "${d}" 2>/dev/null | awk '{print $1; exit}' || true)"
  fi
  if [ "${resolved_ip}" = "${SPARROWX_PUBLIC_IP}" ]; then
    # Deduplicate
    if [[ ! " ${VALID_DOMAINS[*]:-} " =~ " ${d} " ]]; then
      VALID_DOMAINS+=("${d}")
      CERTBOT_ARGS+=("-d" "${d}")
    fi
  fi
done

if [ "${#VALID_DOMAINS[@]}" -eq 0 ]; then
  log_ssl "No domains resolve to ${SPARROWX_PUBLIC_IP} via dig yet. Retaining SAN fallback cert until DNS propagates."
else
  log_ssl "Requesting/renewing Let's Encrypt SSL for: ${VALID_DOMAINS[*]}"

  LIVE_DIR="/etc/letsencrypt/live/${DOMAIN_ROOT}"
  MISSING_SAN="false"
  if [ -s "${LIVE_DIR}/fullchain.pem" ] && command -v openssl >/dev/null 2>&1; then
    CERT_SANS="$(openssl x509 -in "${LIVE_DIR}/fullchain.pem" -noout -text 2>/dev/null | grep -oE 'DNS:[^, ]+' | sed 's/^DNS://' || true)"
    for d in "${VALID_DOMAINS[@]}"; do
      if ! printf '%s\n' "${CERT_SANS}" | grep -Fxiq "${d}"; then
        MISSING_SAN="true"
        log_ssl "Detected subdomain missing from active SAN cert: ${d} — forcing cert expansion"
        break
      fi
    done
  fi

  RENEW_FLAGS=(--expand --keep-until-expiring)
  if [ "${MISSING_SAN}" = "true" ]; then
    RENEW_FLAGS=(--expand)
  fi

  if certbot certonly \
    --webroot -w "${WEBROOT}" \
    --non-interactive \
    --agree-tos \
    "${RENEW_FLAGS[@]}" \
    --cert-name "${DOMAIN_ROOT}" \
    -m "${SPARROWX_ADMIN_EMAIL}" \
    "${CERTBOT_ARGS[@]}" >> "${LOG_FILE}" 2>&1; then

    if [ -f "${LIVE_DIR}/fullchain.pem" ] && [ -f "${LIVE_DIR}/privkey.pem" ]; then
      cp -fL "${LIVE_DIR}/fullchain.pem" "${SSL_DIR}/fullchain.pem"
      cp -fL "${LIVE_DIR}/privkey.pem" "${SSL_DIR}/privkey.pem"
      chmod 644 "${SSL_DIR}/fullchain.pem"
      chmod 600 "${SSL_DIR}/privkey.pem"
      for proxy_name in sparrowx-nginx sparrowx_edge_proxy; do
        if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "${proxy_name}"; then
          docker exec "${proxy_name}" nginx -s reload >/dev/null 2>&1 || true
        fi
      done
      log_ssl "SUCCESS: Live Let's Encrypt SSL active for ${VALID_DOMAINS[*]}"
    fi
  else
    log_ssl "WARN: Multi-domain webroot issuance/renewal deferred (check ${LOG_FILE})."
  fi
fi

# Dedicated issuance/renewal for Game Hosting Storefront, Client Dashboard & Pterodactyl Panel via port 80
renew_dedicated_game_cert() {
  local target_domain="$1"
  local cert_prefix="$2"
  local nginx_marker="$3"
  local game_live_dir="/etc/letsencrypt/live/${target_domain}"
  local game_email="${PTERO_ADMIN_EMAIL:-${SPARROWX_ADMIN_EMAIL:-admin@${DOMAIN_ROOT}}}"

  if [ -z "${target_domain}" ] || [[ "${target_domain}" == *.local ]] || [ "${target_domain}" = "localhost" ]; then
    return 0
  fi

  if [ -s "${game_live_dir}/fullchain.pem" ] && [ -s "${game_live_dir}/privkey.pem" ]; then
    certbot certonly \
      --webroot -w "${WEBROOT}" \
      --non-interactive \
      --agree-tos \
      --keep-until-expiring \
      --cert-name "${target_domain}" \
      -m "${game_email}" \
      -d "${target_domain}" >> "${LOG_FILE}" 2>&1 || true
  else
    log_ssl "Requesting Let's Encrypt SSL for ${target_domain} (port 80 webroot -> standalone fallback)..."
    if ! certbot certonly \
      --webroot -w "${WEBROOT}" \
      --non-interactive \
      --agree-tos \
      --cert-name "${target_domain}" \
      -m "${game_email}" \
      -d "${target_domain}" >> "${LOG_FILE}" 2>&1; then
      docker stop sparrowx-nginx >/dev/null 2>&1 || true
      systemctl stop nginx >/dev/null 2>&1 || true
      command -v fuser >/dev/null 2>&1 && fuser -k 80/tcp >/dev/null 2>&1 || true
      sleep 1
      certbot certonly \
        --standalone --preferred-challenges http \
        --non-interactive \
        --agree-tos \
        --cert-name "${target_domain}" \
        -m "${game_email}" \
        -d "${target_domain}" >> "${LOG_FILE}" 2>&1 || true
      [ -f /var/www/pterodactyl/artisan ] && systemctl start nginx >/dev/null 2>&1 || true
      docker start sparrowx-nginx >/dev/null 2>&1 || true
    fi
  fi

  if [ -s "${game_live_dir}/fullchain.pem" ] && [ -s "${game_live_dir}/privkey.pem" ]; then
    cp -fL "${game_live_dir}/fullchain.pem" "${SSL_DIR}/${cert_prefix}-fullchain.pem"
    cp -fL "${game_live_dir}/privkey.pem" "${SSL_DIR}/${cert_prefix}-privkey.pem"
    chmod 644 "${SSL_DIR}/${cert_prefix}-fullchain.pem"
    chmod 600 "${SSL_DIR}/${cert_prefix}-privkey.pem"
    mkdir -p /etc/ssl
    ln -sf "${game_live_dir}/fullchain.pem" "/etc/ssl/${target_domain}.pem" 2>/dev/null || true
    ln -sf "${game_live_dir}/privkey.pem" "/etc/ssl/${target_domain}.key" 2>/dev/null || true

    if [ -n "${nginx_marker}" ] && [ -f "${INSTALL_DIR}/ovh/nginx.conf" ] && grep -q "${target_domain}" "${INSTALL_DIR}/ovh/nginx.conf" 2>/dev/null; then
      TMP_CONF="$(mktemp)"
      awk -v marker="${nginx_marker}" -v prefix="${cert_prefix}" '
        $0 ~ marker { in_blk=1 }
        in_blk && /ssl_certificate / { sub(/ssl_certificate .*/, "ssl_certificate /etc/nginx/ssl/" prefix "-fullchain.pem;") }
        in_blk && /ssl_certificate_key / { sub(/ssl_certificate_key .*/, "ssl_certificate_key /etc/nginx/ssl/" prefix "-privkey.pem;") }
        in_blk && /^}/ { in_blk=0 }
        { print }
      ' "${INSTALL_DIR}/ovh/nginx.conf" > "${TMP_CONF}" && cat "${TMP_CONF}" > "${INSTALL_DIR}/ovh/nginx.conf"
      rm -f "${TMP_CONF}"
    fi

    for proxy_name in sparrowx-nginx sparrowx_edge_proxy; do
      if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "${proxy_name}"; then
        docker restart "${proxy_name}" >/dev/null 2>&1 || docker exec "${proxy_name}" nginx -s reload >/dev/null 2>&1 || true
      fi
    done
    log_ssl "SUCCESS: Live Let's Encrypt SSL wired for ${target_domain}"
  fi
}

if [ -n "${DOMAIN_GAME}" ] && [[ "${DOMAIN_GAME}" != *.local ]] && { [ -f /var/www/pterodactyl/artisan ] || [[ " ${VALID_DOMAINS[*]:-} " =~ " ${DOMAIN_GAME} " ]]; }; then
  renew_dedicated_game_cert "${DOMAIN_GAME}" "ptero" "# 4\\. (Pterodactyl )?Game Panel"
fi
if [ -n "${DOMAIN_GAME_WEB}" ] && [[ "${DOMAIN_GAME_WEB}" != *.local ]] && [[ " ${VALID_DOMAINS[*]:-} " =~ " ${DOMAIN_GAME_WEB} " ]]; then
  renew_dedicated_game_cert "${DOMAIN_GAME_WEB}" "game-web" "# 5\\. Game Hosting Storefront"
fi
if [ -n "${DOMAIN_GAME_DASH}" ] && [[ "${DOMAIN_GAME_DASH}" != *.local ]] && [[ " ${VALID_DOMAINS[*]:-} " =~ " ${DOMAIN_GAME_DASH} " ]]; then
  renew_dedicated_game_cert "${DOMAIN_GAME_DASH}" "game-dash" "# 6\\. Game Client Dashboard"
fi
if [ -n "${DOMAIN_GAMESEC:-}" ] && [[ "${DOMAIN_GAMESEC}" != *.local ]] && [[ " ${VALID_DOMAINS[*]:-} " =~ " ${DOMAIN_GAMESEC} " ]]; then
  renew_dedicated_game_cert "${DOMAIN_GAMESEC}" "gamesec" "# 7\\. Game DDoS Defense"
fi
if [ -n "${DOMAIN_NETSEC:-}" ] && [[ "${DOMAIN_NETSEC}" != *.local ]] && [[ " ${VALID_DOMAINS[*]:-} " =~ " ${DOMAIN_NETSEC} " ]]; then
  renew_dedicated_game_cert "${DOMAIN_NETSEC}" "netsec" "# 8\\. Network DDoS Dashboard"
fi
if [ -n "${DOMAIN_INFRA:-}" ] && [[ "${DOMAIN_INFRA}" != *.local ]] && [[ " ${VALID_DOMAINS[*]:-} " =~ " ${DOMAIN_INFRA} " ]]; then
  renew_dedicated_game_cert "${DOMAIN_INFRA}" "infra" "# 9\\. Cloud Infrastructure Storefront"
fi
if [[ " ${VALID_DOMAINS[*]:-} " =~ " php.${DOMAIN_ROOT} " ]]; then
  renew_dedicated_game_cert "php.${DOMAIN_ROOT}" "php" "# 10\\. phpMyAdmin Database Console"
fi
for _plat_sub in ai deploy dpdp agents; do
  _plat_dom="${_plat_sub}.${DOMAIN_ROOT}"
  if [[ " ${VALID_DOMAINS[*]:-} " =~ " ${_plat_dom} " ]]; then
    renew_dedicated_game_cert "${_plat_dom}" "${_plat_sub}" "# 11\\.${_plat_sub}\\."
  fi
done
