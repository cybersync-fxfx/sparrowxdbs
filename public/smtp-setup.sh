#!/usr/bin/env bash
# ==============================================================================
# SPARROWX SELF-HOSTED OPEN-SOURCE SMTP (POSTFIX + OPENDKIM) SETUP ENGINE
# ==============================================================================
# Sets up a sovereign, zero-third-party SMTP relay container (`sparrowx-smtp`)
# on your OVH/Ubuntu server for unified email verification across all SparrowX
# services (sparrowx.net, db., sec., file., api., game.).
#
# Usage:
#   curl -sSL https://sparrowx.net/smtp-setup.sh | sudo bash
#   sudo bash deploy/smtp-setup.sh [--domain sparrowx.net] [--relay host:587] [--test you@example.com]
# ==============================================================================
set -u

DOMAIN_OVERRIDE=""
RELAY_OVERRIDE=""
TEST_RECIPIENT=""
DKIM_SELECTOR="${SMTP_DKIM_SELECTOR:-mail}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN_OVERRIDE="${2:-}"; shift 2 ;;
    --relay) RELAY_OVERRIDE="${2:-}"; shift 2 ;;
    --selector) DKIM_SELECTOR="${2:-mail}"; shift 2 ;;
    --test) TEST_RECIPIENT="${2:-}"; shift 2 ;;
    --help|-h)
      cat <<'HELP'
SparrowX Open-Source SMTP (Postfix + OpenDKIM) Setup (smtp-setup.sh)

Usage:
  sudo bash deploy/smtp-setup.sh [options]

Options:
  --domain <host>       Root sender domain (default: from .env or sparrowx.net)
  --relay <host:port>   Optional external SMTP smart-host if ISP blocks outbound port 25
  --selector <name>     DKIM selector (default: mail -> mail._domainkey.<domain>)
  --test <email>        Send a live test email after starting sparrowx-smtp
  --help, -h            Show this help screen
HELP
      exit 0
      ;;
    *) shift ;;
  esac
done

C_RESET="\033[0m"
C_BOLD="\033[1m"
C_CYAN="\033[1;36m"
C_GREEN="\033[1;32m"
C_YELLOW="\033[1;33m"
C_RED="\033[1;31m"
C_WHITE="\033[1;37m"

log_info() { echo -e "  ${C_CYAN}[INFO]${C_RESET}  $*"; }
log_ok()   { echo -e "  ${C_GREEN}[ OK ]${C_RESET}  $*"; }
log_warn() { echo -e "  ${C_YELLOW}[WARN]${C_RESET}  $*"; }
log_err()  { echo -e "  ${C_RED}[ERR ]${C_RESET}  $*"; }

# Resolve installation directory
INSTALL_DIR=""
for cand in "${SPARROWX_INSTALL_DIR:-}" "$(pwd)" "/opt/sparrowxdbs" "/opt/sparrowx"; do
  if [ -n "${cand}" ] && [ -f "${cand}/docker-compose.ovh.yml" ]; then
    INSTALL_DIR="${cand}"
    break
  fi
done
[ -z "${INSTALL_DIR}" ] && INSTALL_DIR="/opt/sparrowxdbs"
cd "${INSTALL_DIR}" 2>/dev/null || exit 1

if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
  exec sudo -E bash "$0" "$@"
fi

ENV_FILE="${INSTALL_DIR}/.env"
[ -f "${ENV_FILE}" ] && source "${ENV_FILE}" 2>/dev/null || true

DOMAIN_ROOT="${DOMAIN_OVERRIDE:-${DOMAIN_ROOT:-${SPARROWX_DOMAIN:-sparrowx.net}}}"
DOMAIN_ROOT="${DOMAIN_ROOT#http://}"
DOMAIN_ROOT="${DOMAIN_ROOT#https://}"
DOMAIN_ROOT="${DOMAIN_ROOT%%/*}"
SPARROWX_PUBLIC_IP="${SPARROWX_PUBLIC_IP:-$(curl -4 -fsS --max-time 4 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')}"

upsert_env() {
  local key="$1"
  local val="$2"
  touch "${ENV_FILE}"
  if grep -qE "^${key}=" "${ENV_FILE}" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "${ENV_FILE}"
  else
    echo "${key}=${val}" >> "${ENV_FILE}"
  fi
}

echo -e "${C_CYAN}==================================================================${C_RESET}"
echo -e "${C_BOLD}${C_WHITE}  SPARROWX OPEN-SOURCE SMTP (POSTFIX + OPENDKIM) SETUP${C_RESET}"
echo -e "${C_CYAN}==================================================================${C_RESET}"
log_info "Domain: ${DOMAIN_ROOT} | Mail Host: mail.${DOMAIN_ROOT} | Server IP: ${SPARROWX_PUBLIC_IP}"

# 1. Generate persistent 2048-bit DKIM keys if missing
DKIM_DIR="${INSTALL_DIR}/ovh/dkim"
mkdir -p "${DKIM_DIR}"
DKIM_PRIV="${DKIM_DIR}/${DOMAIN_ROOT}.private"
DKIM_PUB_PEM="${DKIM_DIR}/${DOMAIN_ROOT}.pub.pem"
DKIM_TXT="${DKIM_DIR}/${DOMAIN_ROOT}.txt"

if [ ! -s "${DKIM_PRIV}" ]; then
  if command -v openssl >/dev/null 2>&1; then
    log_info "Generating 2048-bit RSA DKIM signing keypair for ${DOMAIN_ROOT}..."
    openssl genrsa -out "${DKIM_PRIV}" 2048 >/dev/null 2>&1
    openssl rsa -in "${DKIM_PRIV}" -pubout -out "${DKIM_PUB_PEM}" >/dev/null 2>&1
    PUB_B64="$(grep -v '^-----' "${DKIM_PUB_PEM}" | tr -d '\r\n')"
    echo "v=DKIM1; h=sha256; k=rsa; p=${PUB_B64}" > "${DKIM_TXT}"
    chmod 600 "${DKIM_PRIV}"
    chmod 644 "${DKIM_PUB_PEM}" "${DKIM_TXT}"
    log_ok "Generated DKIM keypair under ${DKIM_DIR}"
  else
    log_warn "openssl not found; boky/postfix will auto-generate DKIM keys on container startup"
  fi
else
  log_ok "Existing DKIM keypair preserved: ${DKIM_PRIV}"
fi

# 2. Configure .env SMTP variables
upsert_env "SMTP_HOST" "smtp"
upsert_env "SMTP_PORT" "587"
upsert_env "SMTP_SECURE" "false"
upsert_env "SMTP_FROM" "\"SparrowX Security <noreply@${DOMAIN_ROOT}>\""
upsert_env "SMTP_DKIM_SELECTOR" "${DKIM_SELECTOR}"
if [ -n "${RELAY_OVERRIDE}" ]; then
  upsert_env "SMTP_RELAYHOST" "${RELAY_OVERRIDE}"
  log_ok "Configured external smart-host relay: ${RELAY_OVERRIDE}"
fi
log_ok "Updated ${ENV_FILE} with sovereign SMTP configuration"

# 3. Probe outbound Port 25 reachability (informational)
if command -v timeout >/dev/null 2>&1 && command -v bash >/dev/null 2>&1; then
  if timeout 4 bash -c 'exec 3<>/dev/tcp/gmail-smtp-in.l.google.com/25' 2>/dev/null; then
    log_ok "Outbound TCP port 25 is OPEN — direct Postfix delivery supported!"
  else
    log_warn "Outbound TCP port 25 appears blocked by upstream provider; set SMTP_RELAYHOST in .env (e.g. Brevo/SES/Mailgun/Postal port 587) if direct delivery queues."
  fi
fi

# 4. Launch sparrowx-smtp container and recreate sparrowx-app with SMTP env
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  log_info "Starting open-source Postfix + OpenDKIM container (sparrowx-smtp)..."
  docker compose -f "${INSTALL_DIR}/docker-compose.ovh.yml" up -d smtp sparrowx
  sleep 2
  if docker ps --format '{{.Names}}' | grep -Fxq "sparrowx-smtp"; then
    log_ok "sparrowx-smtp is ONLINE on internal Docker network sparrowx_net (smtp:587)"
  else
    log_err "sparrowx-smtp failed to start — inspect: docker logs sparrowx-smtp"
  fi
else
  log_warn "Docker unavailable; start sparrowx-smtp later via: docker compose -f docker-compose.ovh.yml up -d smtp"
fi

# 5. Optional live test email
if [ -n "${TEST_RECIPIENT}" ]; then
  log_info "Triggering test verification email to ${TEST_RECIPIENT}..."
  curl -fsS -X POST "http://127.0.0.1:${APP_HOST_PORT:-3000}/api/auth/verify-email" \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"send\",\"email\":\"${TEST_RECIPIENT}\",\"fullName\":\"SMTP Test\",\"serviceName\":\"SparrowX SMTP Verification\"}" || true
  echo ""
fi

# 6. Print DNS records required for Inbox delivery (SPF + DKIM + DMARC + PTR)
DKIM_RECORD_VAL="$(cat "${DKIM_TXT}" 2>/dev/null || echo 'Inspect /opt/sparrowxdbs/ovh/dkim after container boot')"
echo ""
echo -e "${C_GREEN}==================================================================${C_RESET}"
echo -e "${C_BOLD}${C_WHITE}  REQUIRED DNS RECORDS FOR PRIMARY-INBOX DELIVERABILITY${C_RESET}"
echo -e "${C_GREEN}==================================================================${C_RESET}"
echo -e "  1. ${C_CYAN}A Record${C_RESET}     : mail.${DOMAIN_ROOT} -> ${SPARROWX_PUBLIC_IP}"
echo -e "  2. ${C_CYAN}rDNS / PTR${C_RESET}   : ${SPARROWX_PUBLIC_IP} -> mail.${DOMAIN_ROOT} (set in OVH Control Panel)"
echo -e "  3. ${C_CYAN}SPF (TXT)${C_RESET}    : ${DOMAIN_ROOT} -> \"v=spf1 ip4:${SPARROWX_PUBLIC_IP} ~all\""
echo -e "  4. ${C_CYAN}DMARC (TXT)${C_RESET}  : _dmarc.${DOMAIN_ROOT} -> \"v=DMARC1; p=quarantine; rua=mailto:dmarc@${DOMAIN_ROOT}\""
echo -e "  5. ${C_CYAN}DKIM (TXT)${C_RESET}   : ${DKIM_SELECTOR}._domainkey.${DOMAIN_ROOT} ->"
echo -e "     ${C_WHITE}${DKIM_RECORD_VAL}${C_RESET}"
echo -e "${C_GREEN}==================================================================${C_RESET}"
