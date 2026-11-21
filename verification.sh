#!/usr/bin/env bash
# ==============================================================================
# SPARROWX INFRASTRUCTURE TOTAL VERIFICATION & DEEP AUDIT ENGINE
# ==============================================================================
# Read-only A-to-Z inspector covering every layer of the SparrowX platform:
#   01. Host OS, Kernel, CPU/RAM/Swap, Disk, Inodes, Clock Sync & Dependencies
#   02. Git Repository Integrity, LF Line Endings, Script Syntax & CLI Symlinks
#   03. Environment (.env), Secret Hygiene, Build Freshness & Integration Configs
#   04. Docker Engine, Container Fleet Health, OOM/Restart Counts & Port Bindings
#   05. Systemd Services, Auto-Update Timer, Cron Jobs & Pterodactyl Panel Flow
#   06. Sovereign PostgreSQL 16 Cluster, 22-Table Schema, Roles, PII ACLs & Backups
#   07. Nginx Reverse Proxy Config, Internal Upstreams & Multi-Domain TLS/SSL Audit
#   08. All 12+ SparrowX Virtual Host Routes & GameSec / NetSec / Ptero Live Checks
#   09. Live API Health, SSR Hydration Integrity, Security Headers & WAF Probes
#   10. L3/L4/L7 DDoS Defense (Kernel Sysctl, UFW, Fail2Ban & XDP/eBPF Maps)
#   11. Public DNS Records (A, CAA, TXT/SPF) & Optional Repo Code/Build Tests
#
# Usage:
#   ./verification.sh [options]
#   curl -sSL https://sparrowx.net/verification.sh | sudo bash
#
# Options:
#   --quick          Fast infra checks (skip remote DNS & repo code/test suites)
#   --code           Also run repo checks (bash -n, node --check, tsc, vitest, build)
#   --live-dns       Verify public DNS A/CAA/TXT propagation across subdomains
#   --domain <host>  Override root domain (default: from .env or sparrowx.net)
#   --json           Write structured JSON report to /var/log/sparrowx/verification-latest.json
#   --json-only      Suppress ANSI console report and print JSON summary to stdout
#   --strict         Exit with code 1 if any warnings OR failures are found
#   --no-sudo        Skip automatic sudo re-exec when run as non-root
#   --log <file>     Custom plain-text log file path
#   --help, -h       Show help
# ==============================================================================
set -u

ORIG_ARGS=("$@")
QUICK_MODE="false"
RUN_CODE_CHECKS="false"
RUN_LIVE_DNS="auto"
WRITE_JSON="false"
JSON_ONLY="false"
STRICT_MODE="false"
NO_SUDO="false"
DOMAIN_OVERRIDE=""
CUSTOM_LOG_FILE=""
START_EPOCH="$(date +%s 2>/dev/null || echo 0)"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --quick|-q)
      QUICK_MODE="true"
      RUN_LIVE_DNS="false"
      shift
      ;;
    --code|--with-code|--with-build)
      RUN_CODE_CHECKS="true"
      shift
      ;;
    --live-dns|--dns)
      RUN_LIVE_DNS="true"
      shift
      ;;
    --no-dns)
      RUN_LIVE_DNS="false"
      shift
      ;;
    --domain)
      DOMAIN_OVERRIDE="${2:-}"
      shift 2
      ;;
    --json)
      WRITE_JSON="true"
      shift
      ;;
    --json-only)
      WRITE_JSON="true"
      JSON_ONLY="true"
      shift
      ;;
    --strict)
      STRICT_MODE="true"
      shift
      ;;
    --no-sudo)
      NO_SUDO="true"
      shift
      ;;
    --log)
      CUSTOM_LOG_FILE="${2:-}"
      shift 2
      ;;
    --help|-h)
      sed -n '2,31p' "${BASH_SOURCE[0]:-$0}" 2>/dev/null || cat <<'HELP'
SparrowX Infrastructure Total Verification Engine
Usage: ./verification.sh [--quick] [--code] [--live-dns] [--json] [--json-only] [--strict] [--domain <host>] [--no-sudo] [--log <file>]
HELP
      exit 0
      ;;
    *)
      shift
      ;;
  esac
done

UNAME_S="$(uname -s 2>/dev/null || echo unknown)"
IS_WIN_BASH="false"
case "${UNAME_S}" in
  MINGW*|MSYS*|CYGWIN*) IS_WIN_BASH="true" ;;
esac

# Resolve INSTALL_DIR safely (supports cloned repo AND `curl ... | bash`)
RAW_SOURCE="${BASH_SOURCE[0]:-}"
SCRIPT_SOURCE=""
if [ -n "${RAW_SOURCE}" ] && [ -f "${RAW_SOURCE}" ]; then
  SCRIPT_SOURCE="$(readlink -f "${RAW_SOURCE}" 2>/dev/null || echo "${RAW_SOURCE}")"
fi

INSTALL_DIR=""
if [ -n "${SCRIPT_SOURCE}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${SCRIPT_SOURCE}")" 2>/dev/null && pwd || pwd)"
  PARENT_NAME="$(basename "${SCRIPT_DIR}")"
  if [ "${PARENT_NAME}" = "deploy" ] || [ "${PARENT_NAME}" = "ovh" ] || [ "${PARENT_NAME}" = "public" ]; then
    CAND_UP="$(cd "${SCRIPT_DIR}/.." 2>/dev/null && pwd || true)"
    if [ -n "${CAND_UP}" ] && { [ -f "${CAND_UP}/package.json" ] || [ -f "${CAND_UP}/docker-compose.ovh.yml" ]; }; then
      INSTALL_DIR="${CAND_UP}"
    fi
  elif [ -f "${SCRIPT_DIR}/package.json" ] || [ -f "${SCRIPT_DIR}/docker-compose.ovh.yml" ]; then
    INSTALL_DIR="${SCRIPT_DIR}"
  fi
fi

if [ -z "${INSTALL_DIR}" ]; then
  for cand in "${SPARROWX_INSTALL_DIR:-}" "$(pwd)" "/opt/sparrowxdbs" "/opt/sparrowx"; do
    if [ -n "${cand}" ] && [ -d "${cand}" ] && { [ -f "${cand}/docker-compose.ovh.yml" ] || [ -f "${cand}/package.json" ] || [ -f "${cand}/.env" ]; }; then
      INSTALL_DIR="${cand}"
      break
    fi
  done
fi
[ -z "${INSTALL_DIR}" ] && INSTALL_DIR="$(pwd)"
cd "${INSTALL_DIR}" 2>/dev/null || true

# Elevate cleanly only when running as a real file on Linux & sudo is available
if [ "${IS_WIN_BASH}" = "false" ] && [ "${NO_SUDO}" = "false" ] && [ "$(id -u 2>/dev/null || echo 1)" -ne 0 ]; then
  if [ -n "${SCRIPT_SOURCE}" ] && [ -f "${SCRIPT_SOURCE}" ] && command -v sudo >/dev/null 2>&1; then
    if [ "${#ORIG_ARGS[@]}" -gt 0 ]; then
      exec sudo -E bash "${SCRIPT_SOURCE}" --no-sudo "${ORIG_ARGS[@]}"
    else
      exec sudo -E bash "${SCRIPT_SOURCE}" --no-sudo
    fi
  fi
fi

# ------------------------------------------------------------------------------
# Logging, Counters & JSON Collector
# ------------------------------------------------------------------------------
if [ -t 1 ] && [ "${JSON_ONLY}" != "true" ]; then
  C_RESET="\033[0m"
  C_BOLD="\033[1m"
  C_DIM="\033[2m"
  C_CYAN="\033[1;36m"
  C_BLUE="\033[1;34m"
  C_GREEN="\033[1;32m"
  C_YELLOW="\033[1;33m"
  C_RED="\033[1;31m"
  C_WHITE="\033[1;37m"
else
  C_RESET="" C_BOLD="" C_DIM="" C_CYAN="" C_BLUE="" C_GREEN="" C_YELLOW="" C_RED="" C_WHITE=""
fi

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
CURRENT_SECTION="init"

declare -a WARN_ITEMS=()
declare -a FAIL_ITEMS=()
declare -a FIX_HINTS=()
declare -a JSON_RECORDS=()

LOG_DIR="/var/log/sparrowx"
if [ "${IS_WIN_BASH}" = "true" ] || ! mkdir -p "${LOG_DIR}" 2>/dev/null || [ ! -w "${LOG_DIR}" ]; then
  LOG_DIR="${INSTALL_DIR}/logs"
  mkdir -p "${LOG_DIR}" 2>/dev/null || LOG_DIR="/tmp"
fi

LOG_FILE="${CUSTOM_LOG_FILE:-${LOG_DIR}/verification-latest.log}"
JSON_FILE="${LOG_DIR}/verification-latest.json"
: > "${LOG_FILE}" 2>/dev/null || LOG_FILE="/dev/null"

out_line() {
  local clean_line
  if [ "${JSON_ONLY}" != "true" ]; then
    echo -e "$*"
  fi
  clean_line="$(echo -e "$*" | sed -r 's/\x1B\[[0-9;]*[mK]//g' 2>/dev/null || echo "$*")"
  echo "${clean_line}" >> "${LOG_FILE}" 2>/dev/null || true
}

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\t/\\t/g' -e 's/\r//g' | tr '\n' ' '
}

record_item() {
  local status="$1"
  local msg="$2"
  local hint="${3:-}"
  JSON_RECORDS+=("{\"section\":\"$(json_escape "${CURRENT_SECTION}")\",\"status\":\"${status}\",\"message\":\"$(json_escape "${msg}")\",\"hint\":\"$(json_escape "${hint}")\"}")
}

section_banner() {
  local idx="$1"
  local total="$2"
  local title="$3"
  CURRENT_SECTION="${title}"
  out_line ""
  out_line "${C_BLUE}┌────────────────────────────────────────────────────────────────────────────┐${C_RESET}"
  out_line "${C_BLUE}│${C_RESET} ${C_CYAN}[${idx}/${total}]${C_RESET} ${C_BOLD}${C_WHITE}${title}${C_RESET}"
  out_line "${C_BLUE}└────────────────────────────────────────────────────────────────────────────┘${C_RESET}"
}

log_info() {
  out_line "  ${C_CYAN}[INFO]${C_RESET}  $*"
}

log_pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  out_line "  ${C_GREEN}[PASS]${C_RESET}  $*"
  record_item "PASS" "$*"
}

log_warn() {
  local msg="$1"
  local hint="${2:-}"
  WARN_COUNT=$((WARN_COUNT + 1))
  WARN_ITEMS+=("[${CURRENT_SECTION}] ${msg}")
  [ -n "${hint}" ] && FIX_HINTS+=("${hint}")
  out_line "  ${C_YELLOW}[WARN]${C_RESET}  ${msg}"
  record_item "WARN" "${msg}" "${hint}"
}

log_fail() {
  local msg="$1"
  local hint="${2:-}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAIL_ITEMS+=("[${CURRENT_SECTION}] ${msg}")
  [ -n "${hint}" ] && FIX_HINTS+=("${hint}")
  out_line "  ${C_RED}[FAIL]${C_RESET}  ${msg}"
  record_item "FAIL" "${msg}" "${hint}"
}

log_skip() {
  SKIP_COUNT=$((SKIP_COUNT + 1))
  out_line "  ${C_DIM}[SKIP]${C_RESET}  $*"
  record_item "SKIP" "$*"
}

# Safe helper to read single key from .env without evaluating arbitrary code
read_env_var() {
  local file="$1"
  local key="$2"
  [ -f "${file}" ] || return 1
  awk -F= -v k="${key}" '
    $0 ~ "^[[:space:]]*" k "=" {
      sub(/^[^=]*=/, "");
      gsub(/\r$/, "");
      gsub(/^[[:space:]]+|[[:space:]]+$/, "");
      if ((substr($0,1,1) == "\"" && substr($0,length($0),1) == "\"") || (substr($0,1,1) == "'"'"'" && substr($0,length($0),1) == "'"'"'")) {
        $0 = substr($0, 2, length($0)-2);
      }
      print;
      exit;
    }
  ' "${file}" 2>/dev/null
}

# Load non-empty environment config safely
ENV_FILE="${INSTALL_DIR}/.env"
if [ -f "${ENV_FILE}" ]; then
  while IFS= read -r line; do
    line="${line%$'\r'}"
    case "${line}" in
      ""|\#*) continue ;;
    esac
    if [[ "${line}" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      k="${BASH_REMATCH[1]}"
      v="${BASH_REMATCH[2]}"
      v="${v#\"}" ; v="${v%\"}"
      v="${v#\'}" ; v="${v%\'}"
      if [ -z "${!k:-}" ]; then
        export "${k}=${v}" 2>/dev/null || true
      fi
    fi
  done < "${ENV_FILE}"
fi

DOMAIN_ROOT="${DOMAIN_OVERRIDE:-${DOMAIN_ROOT:-${SPARROWX_DOMAIN:-sparrowx.net}}}"
DOMAIN_ROOT="${DOMAIN_ROOT#http://}"
DOMAIN_ROOT="${DOMAIN_ROOT#https://}"
DOMAIN_ROOT="${DOMAIN_ROOT%%/*}"
DOMAIN_STUDIO="${DOMAIN_STUDIO:-db.${DOMAIN_ROOT}}"
DOMAIN_SEC="${DOMAIN_SEC:-sec.${DOMAIN_ROOT}}"
DOMAIN_FILE="${DOMAIN_FILE:-file.${DOMAIN_ROOT}}"
DOMAIN_DROP="${DOMAIN_DROP:-drop.${DOMAIN_ROOT}}"
DOMAIN_PASSWORD="${DOMAIN_PASSWORD:-password.${DOMAIN_ROOT}}"
DOMAIN_KEYS="${DOMAIN_KEYS:-keys.${DOMAIN_ROOT}}"
DOMAIN_API="${DOMAIN_API:-api.${DOMAIN_ROOT}}"
DOMAIN_GAME_WEB="${DOMAIN_GAME_WEB:-game.${DOMAIN_ROOT}}"
DOMAIN_GAME_DASH="${DOMAIN_GAME_DASH:-game.dash.${DOMAIN_ROOT}}"
DOMAIN_GAMESEC="${DOMAIN_GAMESEC:-gamesec.${DOMAIN_ROOT}}"
DOMAIN_NETSEC="${DOMAIN_NETSEC:-netsec.${DOMAIN_ROOT}}"
DOMAIN_GAME="${DOMAIN_GAME:-game.panel.${DOMAIN_ROOT}}"
[ "${DOMAIN_GAME}" = "game.${DOMAIN_ROOT}" ] && DOMAIN_GAME="game.panel.${DOMAIN_ROOT}"

HTTP_PORT="${HTTP_PORT:-80}"
HTTPS_PORT="${HTTPS_PORT:-443}"
APP_HOST_PORT="${APP_HOST_PORT:-3000}"
PGRST_HOST_PORT="${PGRST_HOST_PORT:-3001}"
PG_HOST_PORT="${PG_HOST_PORT:-5432}"
PTERO_PORT="${PTERO_PORT:-8090}"
GAMESEC_PORT="${GAMESEC_PORT:-3005}"
NETSEC_PORT="${NETSEC_PORT:-3006}"
POSTGRES_USER="${POSTGRES_USER:-sparrowx}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-sparrowx_ovh_secret_2026}"
POSTGRES_DB="${POSTGRES_DB:-sparrowx_db}"
SPARROWX_PUBLIC_IP="${SPARROWX_PUBLIC_IP:-}"
COMPOSE_FILE="${INSTALL_DIR}/docker-compose.ovh.yml"
[ ! -f "${COMPOSE_FILE}" ] && [ -f "${INSTALL_DIR}/docker-compose.standalone.yml" ] && COMPOSE_FILE="${INSTALL_DIR}/docker-compose.standalone.yml"
[ ! -f "${COMPOSE_FILE}" ] && [ -f "${INSTALL_DIR}/docker-compose.yml" ] && COMPOSE_FILE="${INSTALL_DIR}/docker-compose.yml"

if [ "${RUN_LIVE_DNS}" = "auto" ]; then
  if [ "${IS_WIN_BASH}" = "true" ] || [ "${DOMAIN_ROOT}" = "localhost" ] || [[ "${DOMAIN_ROOT}" == *.local ]]; then
    RUN_LIVE_DNS="false"
  else
    RUN_LIVE_DNS="true"
  fi
fi

# Banner
out_line "${C_CYAN}╔════════════════════════════════════════════════════════════════════════════╗${C_RESET}"
out_line "${C_CYAN}║${C_RESET}  ${C_BOLD}${C_WHITE}SPARROWX INFRASTRUCTURE TOTAL VERIFICATION & DEEP AUDIT ENGINE${C_RESET}          ${C_CYAN}║${C_RESET}"
out_line "${C_CYAN}╚════════════════════════════════════════════════════════════════════════════╝${C_RESET}"
out_line "  ${C_DIM}Timestamp  : $(date -u '+%Y-%m-%d %H:%M:%S UTC' 2>/dev/null || date)${C_RESET}"
out_line "  ${C_DIM}Install Dir: ${INSTALL_DIR} | Domain: ${DOMAIN_ROOT} | OS: ${UNAME_S}$([ "${IS_WIN_BASH}" = "true" ] && echo " (Git Bash)" || echo "")${C_RESET}"
if [ "${IS_WIN_BASH}" = "false" ] && [ "$(id -u 2>/dev/null || echo 1)" -ne 0 ]; then
  out_line "  ${C_YELLOW}Note: Running as non-root (UID $(id -u)). Some kernel/firewall/cert checks may be skipped; use 'sudo ./verification.sh' for full coverage.${C_RESET}"
fi

# ==============================================================================
# [01/11] Host OS, Kernel, CPU/RAM/Swap, Disk, Inodes, Clock Sync & Tooling
# ==============================================================================
section_banner "01" "11" "Host OS, Hardware Resources, Clock Sync & Core Toolchain"

if [ "${IS_WIN_BASH}" = "true" ]; then
  log_skip "Linux host hardware, swap, inodes, and systemd clock checks skipped on Windows Git Bash (${UNAME_S})"
else
  if [ -f /etc/os-release ]; then
    OS_PRETTY="$(awk -F= '/^PRETTY_NAME=/{gsub(/"/,""); print $2; exit}' /etc/os-release 2>/dev/null || echo Linux)"
    log_pass "Host OS detected: ${OS_PRETTY} (Kernel $(uname -r 2>/dev/null || echo unknown))"
  else
    log_warn "/etc/os-release not found; unable to identify Linux distribution"
  fi

  # Memory & Swap check
  if command -v free >/dev/null 2>&1; then
    MEM_TOTAL_MB="$(free -m | awk '/^Mem:/ {print $2; exit}' || echo 0)"
    MEM_AVAIL_MB="$(free -m | awk '/^Mem:/ {print $7; exit}' || echo 0)"
    SWAP_TOTAL_MB="$(free -m | awk '/^Swap:/ {print $2; exit}' || echo 0)"
    if [ "${MEM_TOTAL_MB}" -gt 0 ]; then
      if [ "${MEM_AVAIL_MB}" -lt 300 ]; then
        log_warn "Low available RAM: ${MEM_AVAIL_MB}MB free of ${MEM_TOTAL_MB}MB total (Vite/Docker builds may OOM)" "Run ./fix.sh --auto to configure swap or reclaim memory"
      else
        log_pass "RAM headroom healthy: ${MEM_AVAIL_MB}MB available / ${MEM_TOTAL_MB}MB total"
      fi
      if [ "${MEM_TOTAL_MB}" -le 4096 ] && [ "${SWAP_TOTAL_MB}" -lt 512 ]; then
        log_warn "Low or missing swap (${SWAP_TOTAL_MB}MB) on <=4GB host; recommended >= 2GB swap for Docker/Nitro builds" "Run ./fix.sh --auto or add a /swapfile"
      else
        log_pass "Swap configured: ${SWAP_TOTAL_MB}MB"
      fi
    fi
  fi

  # Disk & Inodes
  if command -v df >/dev/null 2>&1; then
    ROOT_PCT="$(df -P "${INSTALL_DIR}" 2>/dev/null | awk 'NR==2 {gsub(/%/,"",$5); print $5}' || echo 0)"
    ROOT_AVAIL="$(df -hP "${INSTALL_DIR}" 2>/dev/null | awk 'NR==2 {print $4}' || echo unknown)"
    INODE_PCT="$(df -iP "${INSTALL_DIR}" 2>/dev/null | awk 'NR==2 {gsub(/%/,"",$5); print $5}' || echo 0)"
    if [ "${ROOT_PCT:-0}" -ge 92 ]; then
      log_fail "Critical disk usage on ${INSTALL_DIR}: ${ROOT_PCT}% used (${ROOT_AVAIL} free)" "Prune old Docker layers: docker system prune -af && ./deploy/backup-all-dbs.sh"
    elif [ "${ROOT_PCT:-0}" -ge 80 ]; then
      log_warn "High disk usage on ${INSTALL_DIR}: ${ROOT_PCT}% used (${ROOT_AVAIL} free)" "Consider cleaning stale Docker images: docker image prune -f"
    else
      log_pass "Disk usage healthy on ${INSTALL_DIR}: ${ROOT_PCT}% used (${ROOT_AVAIL} free)"
    fi
    if [ "${INODE_PCT:-0}" -ge 85 ]; then
      log_warn "High inode utilization: ${INODE_PCT}% used" "Check /tmp and /var/lib/docker overlay usage"
    else
      log_pass "Inode utilization healthy: ${INODE_PCT:-0}% used"
    fi
  fi

  # Clock / NTP check (critical for JWT/TOTP/TLS)
  if command -v timedatectl >/dev/null 2>&1; then
    NTP_SYNC="$(timedatectl show -p NTPSynchronized --value 2>/dev/null || timedatectl status 2>/dev/null | awk -F: '/synchronized|NTP/ {gsub(/^[[:space:]]+/,"",$2); print $2; exit}' || echo unknown)"
    if [ "${NTP_SYNC}" = "yes" ] || [ "${NTP_SYNC}" = "active" ]; then
      log_pass "System clock NTP synchronized (${NTP_SYNC})"
    else
      log_warn "NTP synchronization state is '${NTP_SYNC}'; clock drift can break TLS, JWT & Discord OAuth" "Run: timedatectl set-ntp true"
    fi
  fi

  # APT/DPKG lock sanity
  if command -v dpkg >/dev/null 2>&1; then
    if fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 && ! pgrep -x "apt|apt-get|dpkg|unattended-upgr" >/dev/null 2>&1; then
      log_fail "Stale dpkg lock detected with no active apt process" "Run: sudo bash fix.sh --auto"
    else
      log_pass "Package manager (dpkg/apt) locks clean"
    fi
  fi
fi

# Core CLI toolchain presence
REQUIRED_CMDS=("bash" "git" "curl" "openssl")
for c in "${REQUIRED_CMDS[@]}"; do
  if command -v "${c}" >/dev/null 2>&1; then
    log_pass "Core CLI present: ${c} ($(command -v "${c}"))"
  else
    log_fail "Missing required CLI tool: ${c}" "Install ${c} cleanly (apt-get install -y ${c})"
  fi
done
for c in node npm docker ss; do
  if command -v "${c}" >/dev/null 2>&1; then
    log_pass "Runtime CLI available: ${c}"
  elif [ "${IS_WIN_BASH}" = "true" ]; then
    log_skip "Runtime CLI '${c}' not required in local Git Bash check"
  else
    log_warn "Runtime CLI missing: ${c}" "Install via ./setup.sh or ./fix.sh"
  fi
done

# ==============================================================================
# [02/11] Git Repository Integrity, Line Endings, Script Syntax & CLI Symlinks
# ==============================================================================
section_banner "02" "11" "Git Repo Sync, LF Line Endings, Script Syntax & Public Mirrors"

if [ -d "${INSTALL_DIR}/.git" ] && command -v git >/dev/null 2>&1; then
  CUR_COMMIT="$(git -C "${INSTALL_DIR}" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  CUR_BRANCH="$(git -C "${INSTALL_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
  DIRTY_FILES="$(git -C "${INSTALL_DIR}" status --porcelain 2>/dev/null | wc -l | tr -d '[:space:]')"
  if [ "${DIRTY_FILES:-0}" -gt 0 ]; then
    log_warn "Git working tree has ${DIRTY_FILES} uncommitted change(s) on ${CUR_BRANCH} (${CUR_COMMIT})" "Commit or review changes with 'git status -s'"
  else
    log_pass "Git working tree clean on ${CUR_BRANCH} (${CUR_COMMIT})"
  fi

  # Check unmerged conflict markers in tracked source/scripts
  CONFLICTS_FOUND="$(git -C "${INSTALL_DIR}" grep -lE '^(<<<<<<<[[:space:]]|=======$|>>>>>>>[[:space:]])' -- 'src/' 'deploy/' 'ovh/' '*.sh' 2>/dev/null || true)"
  if [ -n "${CONFLICTS_FOUND}" ]; then
    log_fail "Unresolved git conflict markers found in: ${CONFLICTS_FOUND}" "Resolve merge conflicts and rebuild"
  else
    log_pass "Zero unresolved git merge conflict markers in repo"
  fi

  if [ "${QUICK_MODE}" = "false" ]; then
    REMOTE_HASH="$(git -C "${INSTALL_DIR}" ls-remote --heads origin main 2>/dev/null | awk '{print $1; exit}' || true)"
    LOCAL_FULL="$(git -C "${INSTALL_DIR}" rev-parse HEAD 2>/dev/null || echo "")"
    if [ -n "${REMOTE_HASH}" ] && [ -n "${LOCAL_FULL}" ]; then
      if [ "${REMOTE_HASH}" = "${LOCAL_FULL}" ]; then
        log_pass "Repository matches origin/main (${CUR_COMMIT})"
      else
        log_warn "Local commit (${CUR_COMMIT}) differs from origin/main ($(echo "${REMOTE_HASH}" | cut -c1-7))" "Push local edits or pull & rebuild with ./update.sh --rebuild"
      fi
    fi
  fi
else
  log_warn "No .git metadata detected in ${INSTALL_DIR}" "Re-clone cleanly via ./setup.sh if managed updates are needed"
fi

# Check LF line endings & bash -n across all non-vendor .sh files
CRLF_LIST=""
SYNTAX_ERR_LIST=""
SH_CHECKED=0
while IFS= read -r -d '' shf; do
  SH_CHECKED=$((SH_CHECKED + 1))
  if grep -q $'\r' "${shf}" 2>/dev/null; then
    CRLF_LIST="${CRLF_LIST} ${shf}"
  fi
  if ! bash -n "${shf}" >/dev/null 2>&1; then
    SYNTAX_ERR_LIST="${SYNTAX_ERR_LIST} ${shf}"
  fi
done < <(find "${INSTALL_DIR}" -maxdepth 4 \( -path '*/node_modules' -o -path '*/.git' -o -path '*/sbs' \) -prune -o -type f -name '*.sh' -print0 2>/dev/null)

if [ "${SH_CHECKED}" -eq 0 ]; then
  log_warn "No shell scripts found under ${INSTALL_DIR}"
else
  if [ -z "${CRLF_LIST}" ]; then
    log_pass "All ${SH_CHECKED} shell scripts use clean Unix LF endings"
  else
    log_fail "Windows CRLF line endings found in:${CRLF_LIST}" "Fix with: sed -i 's/\r$//' <file> or ./fix.sh --auto"
  fi
  if [ -z "${SYNTAX_ERR_LIST}" ]; then
    log_pass "All ${SH_CHECKED} shell scripts pass 'bash -n' syntax check"
  else
    log_fail "Shell syntax errors reported by bash -n in:${SYNTAX_ERR_LIST}" "Inspect with bash -n <file>"
  fi
fi

# Check ovh/node-server.mjs syntax
if [ -f "${INSTALL_DIR}/ovh/node-server.mjs" ] && command -v node >/dev/null 2>&1; then
  if node --check "${INSTALL_DIR}/ovh/node-server.mjs" >/dev/null 2>&1; then
    log_pass "Edge server syntax valid: ovh/node-server.mjs"
  else
    log_fail "Syntax error in ovh/node-server.mjs" "Run node --check ovh/node-server.mjs"
  fi
fi

# Check public mirror parity & manifest JSON validity
for pair in \
  "deploy/ddos-setup.sh:public/ddos-setup.sh" \
  "deploy/xdp/sparrowx_xdp_ddos.c:public/xdp/sparrowx_xdp_ddos.c" \
  "deploy/xdp/attach-xdp.sh:public/xdp/attach-xdp.sh" \
  "verification.sh:public/verification.sh" \
  "fix.sh:deploy/doctor-fix.sh"; do
  left="${INSTALL_DIR}/${pair%%:*}"
  right="${INSTALL_DIR}/${pair##*:}"
  if [ -f "${left}" ] && [ -f "${right}" ]; then
    if cmp -s "${left}" "${right}"; then
      log_pass "Script mirror in sync: ${pair%%:*} == ${pair##*:}"
    else
      log_warn "Script mirror out of sync: ${pair%%:*} differs from ${pair##*:}" "Sync copies before deploying: cp -f ${pair%%:*} ${pair##*:}"
    fi
  elif [ ! -f "${left}" ] || [ ! -f "${right}" ]; then
    log_warn "Missing expected script mirror pair: ${pair}"
  fi
done

if [ -f "${INSTALL_DIR}/public/setup-manifest.json" ] && command -v node >/dev/null 2>&1; then
  if node -e "const m=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); if(!Array.isArray(m.scripts)||m.scripts.length<5) process.exit(1);" "${INSTALL_DIR}/public/setup-manifest.json" 2>/dev/null; then
    log_pass "public/setup-manifest.json is valid JSON with all setup script links"
  else
    log_fail "public/setup-manifest.json is invalid or missing script entries"
  fi
fi

# Check /usr/local/bin/sparrowx-* CLI symlinks on Linux
if [ "${IS_WIN_BASH}" = "false" ] && [ -d /usr/local/bin ]; then
  MISSING_BINS=""
  for bin_name in sparrowx-setup sparrowx-update sparrowx-fix sparrowx-doctor sparrowx-db sparrowx-heal sparrowx-ddos sparrowx-xdp sparrowx-verify; do
    if [ ! -e "/usr/local/bin/${bin_name}" ]; then
      MISSING_BINS="${MISSING_BINS} ${bin_name}"
    fi
  done
  if [ -z "${MISSING_BINS}" ]; then
    log_pass "All 9 global CLI symlinks installed in /usr/local/bin"
  else
    log_warn "Missing global CLI symlinks in /usr/local/bin:${MISSING_BINS}" "Run ./update.sh or ./fix.sh --auto to refresh symlinks"
  fi
fi

# ==============================================================================
# [03/11] Environment (.env), Secret Hygiene, Build Freshness & Integrations
# ==============================================================================
section_banner "03" "11" "Environment (.env), Secret Hygiene & Application Build Freshness"

if [ -f "${ENV_FILE}" ]; then
  log_pass "Environment file exists: ${ENV_FILE}"
  if [ "${IS_WIN_BASH}" = "false" ]; then
    ENV_PERMS="$(stat -c '%a' "${ENV_FILE}" 2>/dev/null || echo 644)"
    case "${ENV_PERMS}" in
      *7|*6|*3|*2) log_warn ".env permissions are world-writable (${ENV_PERMS}); tighten to 600" "chmod 600 ${ENV_FILE}" ;;
      *) log_pass ".env file permissions safe (${ENV_PERMS})" ;;
    esac
  fi

  # Detect whether .env is server deployment config or frontend-only local Vite .env
  JWT_VAL="$(read_env_var "${ENV_FILE}" "SPARROWX_JWT_SECRET" || true)"
  SSO_VAL="$(read_env_var "${ENV_FILE}" "SPARROWX_MASTER_SSO_SECRET" || true)"
  PGU_VAL="$(read_env_var "${ENV_FILE}" "POSTGRES_USER" || true)"
  PGP_VAL="$(read_env_var "${ENV_FILE}" "POSTGRES_PASSWORD" || true)"
  PGD_VAL="$(read_env_var "${ENV_FILE}" "POSTGRES_DB" || true)"

  if [ "${IS_WIN_BASH}" = "true" ] && [ -z "${PGU_VAL}" ] && [ -z "${PGP_VAL}" ] && [ -z "${JWT_VAL}" ]; then
    log_skip "Local Vite frontend .env detected on workstation; server PostgreSQL/JWT secret checks run on Linux deployment host"
  else
    # Required keys check (never print actual values!)
    MISSING_ENV_KEYS=""
    for req_k in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB SPARROWX_JWT_SECRET; do
      val_k="$(read_env_var "${ENV_FILE}" "${req_k}" || true)"
      if [ -z "${val_k}" ]; then
        MISSING_ENV_KEYS="${MISSING_ENV_KEYS} ${req_k}"
      fi
    done
    if [ -z "${MISSING_ENV_KEYS}" ]; then
      log_pass "Core PostgreSQL & JWT .env variables are populated"
    else
      log_fail "Missing required .env variables:${MISSING_ENV_KEYS}" "Populate missing keys or run ./setup.sh"
    fi

    # Secret strength & default placeholder audit
    if [ "${#JWT_VAL}" -lt 24 ] || [ "${JWT_VAL}" = "sparrowx_jwt_secret_key_32_characters_2026" ]; then
      log_warn "SPARROWX_JWT_SECRET is weak or using default placeholder" "Rotate SPARROWX_JWT_SECRET in .env to a 48-char random secret"
    else
      log_pass "SPARROWX_JWT_SECRET length/entropy OK (len=${#JWT_VAL}, masked)"
    fi
    if [ -z "${SSO_VAL}" ]; then
      log_warn "SPARROWX_MASTER_SSO_SECRET is unset (falling back to JWT secret)" "Set dedicated SPARROWX_MASTER_SSO_SECRET in .env"
    else
      log_pass "SPARROWX_MASTER_SSO_SECRET configured (len=${#SSO_VAL}, masked)"
    fi
    if [ "${PGP_VAL}" = "sparrowx_ovh_secret_2026" ] || [ "${PGP_VAL}" = "SparrowxMasterSecretPass2026!" ] || [ "${#PGP_VAL}" -lt 12 ]; then
      log_warn "POSTGRES_PASSWORD is using a sample default or short password" "Set a strong unique POSTGRES_PASSWORD and restart DB if migrating"
    else
      log_pass "POSTGRES_PASSWORD strength OK (len=${#PGP_VAL}, masked)"
    fi
  fi

  # Feature Integration Readiness (Discord OAuth, Pterodactyl SSO, Razorpay, DB Encryption)
  DC_ID="$(read_env_var "${ENV_FILE}" "DISCORD_CLIENT_ID" || true)"
  DC_SEC="$(read_env_var "${ENV_FILE}" "DISCORD_CLIENT_SECRET" || true)"
  DC_URI="$(read_env_var "${ENV_FILE}" "DISCORD_REDIRECT_URI" || true)"
  if [ -n "${DC_ID}" ] && [ -n "${DC_SEC}" ]; then
    log_pass "Discord OAuth credentials present (CLIENT_ID len=${#DC_ID}, SECRET masked)"
    if [ -n "${DC_URI}" ] && [[ "${DC_URI}" != *"${DOMAIN_ROOT}"* ]]; then
      log_warn "DISCORD_REDIRECT_URI (${DC_URI}) does not match current root domain (${DOMAIN_ROOT})"
    fi
  else
    log_info "Discord OAuth keys empty in .env (Game Portal uses demo or disabled Discord login until set)"
  fi

  RZP_ID="$(read_env_var "${ENV_FILE}" "RAZORPAY_KEY_ID" || true)"
  RZP_SEC="$(read_env_var "${ENV_FILE}" "RAZORPAY_KEY_SECRET" || true)"
  if [ -n "${RZP_ID}" ] && [ -n "${RZP_SEC}" ]; then
    log_pass "Razorpay billing keys configured (Key ID masked)"
  elif [ -n "${RZP_ID}" ] || [ -n "${RZP_SEC}" ]; then
    log_warn "Partial Razorpay config in .env (both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET required)"
  else
    log_info "Razorpay keys unset (live INR/USD Razorpay checkout inactive until set)"
  fi
else
  if [ "${IS_WIN_BASH}" = "true" ]; then
    log_skip "No ${ENV_FILE} found in local dev workspace (checked optional .env)"
  else
    log_fail "Missing ${ENV_FILE} configuration file" "Run ./setup.sh or ./update.sh to generate .env"
  fi
fi

# Check built .output freshness vs src/ modifications
OUT_SRV="${INSTALL_DIR}/.output/server/index.mjs"
OUT_PUB="${INSTALL_DIR}/.output/public"
if [ -f "${OUT_SRV}" ] && [ -d "${OUT_PUB}" ]; then
  log_pass "Production build artifacts present (.output/server/index.mjs & .output/public)"
  if command -v node >/dev/null 2>&1; then
    STALE_BUILD="$(node -e "
      const fs = require('fs'), path = require('path');
      const outM = fs.statSync(process.argv[1]).mtimeMs;
      let newest = 0, newestFile = '';
      function walk(dir){
        for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) walk(p);
          else {
            const m = fs.statSync(p).mtimeMs;
            if (m > newest) { newest = m; newestFile = p; }
          }
        }
      }
      if (fs.existsSync(process.argv[2])) walk(process.argv[2]);
      if (newest > outM + 2000) console.log(newestFile);
    " "${OUT_SRV}" "${INSTALL_DIR}/src" 2>/dev/null || true)"
    if [ -n "${STALE_BUILD}" ]; then
      log_warn "Local .output bundle is older than source edits (e.g. ${STALE_BUILD#${INSTALL_DIR}/})" "Run 'npm run build' locally or './update.sh --rebuild' on server"
    else
      log_pass "Production .output bundle is up-to-date with src/"
    fi
  fi
else
  log_warn "No compiled .output build directory found locally" "Run 'npm run build' or './update.sh --rebuild'"
fi

# ==============================================================================
# [04/11] Docker Engine, Container Fleet Health, OOM/Restarts & Port Bindings
# ==============================================================================
section_banner "04" "11" "Docker Engine, Container Fleet Health & Port Binding Audit"

DOCKER_READY="false"
PROXY_CTR=""
APP_CTR=""
PG_CTR=""
PGRST_CTR=""

if [ "${IS_WIN_BASH}" = "true" ] && ! docker info >/dev/null 2>&1; then
  log_skip "Docker Engine checks skipped in local Git Bash (no running Docker daemon)"
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  DOCKER_READY="true"
  log_pass "Docker daemon active and responsive"

  for c in sparrowx-postgres sparrowx_postgres; do
    docker ps -a --format '{{.Names}}' | grep -Fxq "${c}" && PG_CTR="${c}" && break
  done
  for c in sparrowx-postgrest sparrowx_postgrest; do
    docker ps -a --format '{{.Names}}' | grep -Fxq "${c}" && PGRST_CTR="${c}" && break
  done
  for c in sparrowx-app sparrowx_studio; do
    docker ps -a --format '{{.Names}}' | grep -Fxq "${c}" && APP_CTR="${c}" && break
  done
  for c in sparrowx-nginx sparrowx_edge_proxy; do
    docker ps -a --format '{{.Names}}' | grep -Fxq "${c}" && PROXY_CTR="${c}" && break
  done

  check_container() {
    local cname="$1"
    local required="${2:-yes}"
    if [ -z "${cname}" ]; then
      [ "${required}" = "yes" ] && log_fail "Missing expected container" "Run: ./fix.sh --auto or docker compose up -d"
      return 1
    fi
    if ! docker ps -a --format '{{.Names}}' | grep -Fxq "${cname}"; then
      [ "${required}" = "yes" ] && log_fail "Container '${cname}' does not exist" "Run: docker compose -f ${COMPOSE_FILE} up -d"
      return 1
    fi
    local state oom restarts health started
    state="$(docker inspect -f '{{.State.Status}}' "${cname}" 2>/dev/null || echo unknown)"
    oom="$(docker inspect -f '{{.State.OOMKilled}}' "${cname}" 2>/dev/null || echo false)"
    restarts="$(docker inspect -f '{{.RestartCount}}' "${cname}" 2>/dev/null || echo 0)"
    health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "${cname}" 2>/dev/null || echo none)"
    started="$(docker inspect -f '{{.State.StartedAt}}' "${cname}" 2>/dev/null | cut -c1-19 || echo "")"

    if [ "${state}" != "running" ]; then
      log_fail "Container '${cname}' is ${state} (restarts=${restarts})" "Inspect logs: docker logs ${cname} --tail 40"
      return 1
    fi
    if [ "${oom}" = "true" ]; then
      log_warn "Container '${cname}' previously suffered OOMKilled!" "Add swap or raise memory limits"
    fi
    if [ "${restarts:-0}" -ge 5 ]; then
      log_warn "Container '${cname}' has restarted ${restarts} times (started ${started})" "Inspect logs: docker logs ${cname} --tail 50"
    fi
    if [ "${health}" = "unhealthy" ]; then
      log_fail "Container '${cname}' healthcheck reports UNHEALTHY" "Check: docker inspect ${cname}"
    else
      log_pass "Container '${cname}' running (health=${health}, restarts=${restarts}, started=${started})"
    fi

    # Scan recent container logs for fatal runtime errors
    local fatal_hits
    fatal_hits="$(docker logs "${cname}" --tail 60 2>&1 | grep -iE 'EADDRINUSE|Minified React error|FATAL:|terminating connection due to administrator command|bind\(\) to 0\.0\.0\.0:(80|443) failed' | head -n 2 || true)"
    if [ -n "${fatal_hits}" ]; then
      log_warn "Recent critical log patterns in ${cname}: $(echo "${fatal_hits}" | tr '\n' '; ')" "Inspect full logs: docker logs ${cname} --tail 80"
    fi
    return 0
  }

  check_container "${PG_CTR:-sparrowx-postgres}" "yes"
  check_container "${PGRST_CTR:-sparrowx-postgrest}" "yes"
  if [ -n "${APP_CTR}" ]; then
    check_container "${APP_CTR}" "yes"
    # Check container build freshness against latest git commit
    if [ -d "${INSTALL_DIR}/.git" ]; then
      GIT_COMMIT_EPOCH="$(git -C "${INSTALL_DIR}" log -1 --format=%ct 2>/dev/null || echo 0)"
      CTR_IMAGE_ID="$(docker inspect -f '{{.Image}}' "${APP_CTR}" 2>/dev/null || echo "")"
      IMG_CREATED_ISO="$(docker inspect -f '{{.Created}}' "${CTR_IMAGE_ID}" 2>/dev/null || echo "")"
      if [ -n "${IMG_CREATED_ISO}" ] && command -v date >/dev/null 2>&1; then
        IMG_EPOCH="$(date -d "${IMG_CREATED_ISO}" +%s 2>/dev/null || echo 0)"
        if [ "${GIT_COMMIT_EPOCH:-0}" -gt "$((IMG_EPOCH + 10))" ] && [ "${IMG_EPOCH:-0}" -gt 0 ]; then
          log_warn "Running ${APP_CTR} image predates latest git commit — live container may run old code!" "Deploy latest build: ./update.sh --rebuild"
        else
          log_pass "Running ${APP_CTR} image timestamp matches/exceeds latest git commit"
        fi
      fi
    fi
    # Check internal Docker DNS connectivity from APP_CTR -> postgres & postgrest
    if docker exec "${APP_CTR}" node -e "
      const net=require('net'), http=require('http');
      const pHost=process.env.POSTGRES_HOST||'postgres', pPort=Number(process.env.POSTGRES_PORT||5432);
      const rHost=process.env.POSTGREST_HOST||'postgrest', rPort=Number(process.env.POSTGREST_PORT||3001);
      const s=net.createConnection({host:pHost,port:pPort,timeout:3000},()=>{
        s.end();
        const req=http.get({host:rHost,port:rPort,path:'/',timeout:3000},res=>{
          process.exit(res.statusCode<500?0:1);
        });
        req.on('error',()=>process.exit(1));
      });
      s.on('error',()=>process.exit(1));
    " >/dev/null 2>&1; then
      log_pass "Internal container mesh verified: ${APP_CTR} -> Postgres:${PG_HOST_PORT} & PostgREST:${PGRST_HOST_PORT}"
    else
      log_fail "Container '${APP_CTR}' cannot reach Postgres or PostgREST on internal Docker network" "Run: ./fix.sh --auto"
    fi

    # Check host .env vs running container env sync drift (presence & SHA256 prefix only, never print secrets)
    if [ -f "${ENV_FILE}" ]; then
      CTR_ENV_DUMP="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "${APP_CTR}" 2>/dev/null || true)"
      for sync_k in SPARROWX_JWT_SECRET SPARROWX_MASTER_SSO_SECRET DISCORD_CLIENT_ID PTERO_SSO_SECRET RAZORPAY_KEY_ID; do
        host_v="$(read_env_var "${ENV_FILE}" "${sync_k}" || true)"
        ctr_v="$(echo "${CTR_ENV_DUMP}" | awk -F= -v k="${sync_k}" '$1==k {sub(/^[^=]*=/,""); print; exit}' 2>/dev/null || true)"
        if [ -n "${host_v}" ] && [ -z "${ctr_v}" ]; then
          log_warn ".env sets ${sync_k}, but running container ${APP_CTR} does NOT have it yet" "Recreate container: ./update.sh (or docker compose up -d)"
        elif [ -n "${host_v}" ] && [ -n "${ctr_v}" ] && [ "${host_v}" != "${ctr_v}" ]; then
          log_warn ".env ${sync_k} differs from running container ${APP_CTR} environment" "Recreate container to apply updated .env: ./update.sh"
        fi
      done
    fi
  elif command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet sparrowx-native.service 2>/dev/null; then
    log_pass "Host-native fallback sparrowx-native.service is active cleanly"
  else
    log_fail "Neither sparrowx-app container nor sparrowx-native.service is running" "Run: ./update.sh --rebuild or ./fix.sh --auto"
  fi
  check_container "${PROXY_CTR:-sparrowx-nginx}" "yes"

  # Optional sidecar/edge containers
  for opt_c in sparrowx_pgbouncer sparrowx_threat_cache sparrowx-gamesec sparrowx-netsec; do
    if docker ps -a --format '{{.Names}}' | grep -Fxq "${opt_c}"; then
      check_container "${opt_c}" "no"
    fi
  done
elif [ "${IS_WIN_BASH}" = "false" ]; then
  log_fail "Docker daemon not running or unavailable" "Start Docker: systemctl restart containerd docker && ./fix.sh --auto"
fi

# Host port listening audit on Linux
if [ "${IS_WIN_BASH}" = "false" ] && command -v ss >/dev/null 2>&1; then
  SS_OUT="$(ss -tulnp 2>/dev/null || true)"
  for p_spec in "${HTTP_PORT}:HTTP_Edge" "${HTTPS_PORT}:HTTPS_Edge" "${APP_HOST_PORT}:App_Server" "${PGRST_HOST_PORT}:PostgREST" "${PG_HOST_PORT}:PostgreSQL"; do
    p_num="${p_spec%%:*}"
    p_lbl="${p_spec##*:}"
    if echo "${SS_OUT}" | grep -qE ":${p_num}[[:space:]]"; then
      log_pass "Port :${p_num} (${p_lbl}) is actively listening"
    else
      log_fail "Expected port :${p_num} (${p_lbl}) is NOT listening" "Run ./fix.sh --auto to reclaim and bind services"
    fi
  done

  # Ensure PostgreSQL (5432) and PostgREST (3001) are NOT exposed openly on 0.0.0.0 unless explicitly intended
  if echo "${SS_OUT}" | grep -qE "(0\.0\.0\.0|\*):(${PG_HOST_PORT}|${PGRST_HOST_PORT})[[:space:]]"; then
    log_warn "Database/PostgREST port (${PG_HOST_PORT}/${PGRST_HOST_PORT}) is bound on wildcard 0.0.0.0 instead of 127.0.0.1" "Check docker-compose.ovh.yml bindings or UFW rules"
  else
    log_pass "Postgres (:${PG_HOST_PORT}) & PostgREST (:${PGRST_HOST_PORT}) safely bound to loopback 127.0.0.1"
  fi
fi

# ==============================================================================
# [05/11] Systemd Services, Auto-Update Timer, Cron & Pterodactyl Panel Flow
# ==============================================================================
section_banner "05" "11" "Systemd Daemons, Cron Automation & Pterodactyl Game Panel"

if [ "${IS_WIN_BASH}" = "true" ] || ! command -v systemctl >/dev/null 2>&1; then
  log_skip "systemd & cron checks skipped (not running on systemd Linux host)"
else
  for unit in docker.service sparrowx-autoupdate.timer; do
    if systemctl is-active --quiet "${unit}" 2>/dev/null; then
      log_pass "Systemd unit active: ${unit}"
    else
      log_warn "Systemd unit inactive: ${unit}" "Enable via ./update.sh or systemctl enable --now ${unit}"
    fi
  done

  if systemctl list-unit-files 'sparrowx-stack.service' --no-legend 2>/dev/null | grep -q "sparrowx-stack"; then
    if systemctl is-enabled --quiet sparrowx-stack.service 2>/dev/null; then
      log_pass "Boot persistence enabled: sparrowx-stack.service"
    else
      log_warn "sparrowx-stack.service exists but is disabled" "systemctl enable sparrowx-stack.service"
    fi
  fi

  # Check optional systemd services when installed
  for opt_svc in sparrowx-gamesec.service sparrowx-netsec.service; do
    if systemctl list-unit-files "${opt_svc}" --no-legend 2>/dev/null | grep -q "${opt_svc%%.*}"; then
      if systemctl is-active --quiet "${opt_svc}" 2>/dev/null; then
        log_pass "Optional portal service active: ${opt_svc}"
      else
        log_warn "Optional portal service stopped: ${opt_svc}" "systemctl restart ${opt_svc}"
      fi
    fi
  done

  # Cron automation file & target executables
  CRON_FILE="/etc/cron.d/sparrowx-automation"
  if [ -f "${CRON_FILE}" ]; then
    log_pass "Autonomous cron schedule present: ${CRON_FILE}"
    for script_ref in watchdog.sh ssl-renew.sh backup-all-dbs.sh; do
      if grep -q "${script_ref}" "${CRON_FILE}" 2>/dev/null; then
        target_p="$(grep -oE '/[^[:space:]]*'"${script_ref}" "${CRON_FILE}" | head -n 1 || true)"
        if [ -n "${target_p}" ] && [ -x "${target_p}" ]; then
          log_pass "Cron target executable: ${target_p}"
        else
          log_warn "Cron references ${script_ref} but target is missing or not executable (${target_p:-none})" "chmod +x ${INSTALL_DIR}/deploy/${script_ref}"
        fi
      fi
    done
  else
    log_warn "Missing ${CRON_FILE} watchdog/SSL/backup schedule" "Run ./setup.sh or ./update.sh to install autonomous cron jobs"
  fi

  # Pterodactyl check (only if installed on this host)
  if [ -d "/var/www/pterodactyl" ] || systemctl list-unit-files wings.service --no-legend 2>/dev/null | grep -q "wings"; then
    log_info "Pterodactyl Game Panel detected on host — verifying port-flow & services..."
    for psvc in mariadb mysql pteroq wings; do
      if systemctl list-unit-files "${psvc}.service" --no-legend 2>/dev/null | grep -q "^${psvc}"; then
        if systemctl is-active --quiet "${psvc}" 2>/dev/null; then
          log_pass "Pterodactyl dependency active: ${psvc}.service"
        else
          log_fail "Pterodactyl dependency down: ${psvc}.service" "Run ./fix.sh --auto or systemctl restart ${psvc}"
        fi
      fi
    done
    PHP_FPM_ACTIVE=""
    for php_u in $(systemctl list-units --type=service --state=active --no-legend 'php*-fpm.service' 2>/dev/null | awk '{print $1}'); do
      PHP_FPM_ACTIVE="${php_u}"
    done
    if [ -n "${PHP_FPM_ACTIVE}" ]; then
      log_pass "Pterodactyl PHP-FPM worker active: ${PHP_FPM_ACTIVE}"
    else
      log_fail "No active php*-fpm.service found for Pterodactyl" "Start php8.x-fpm or run ./fix.sh --auto"
    fi
    if command -v ss >/dev/null 2>&1; then
      if ss -tulnp 2>/dev/null | grep -qE ":${PTERO_PORT}[[:space:]]"; then
        log_pass "Host Nginx serving Pterodactyl cleanly on dedicated internal port :${PTERO_PORT}"
      else
        log_fail "Host Nginx not listening on Pterodactyl port :${PTERO_PORT}" "Run ./fix.sh --auto to heal Pterodactyl port flow"
      fi
      if ss -tulnp 2>/dev/null | grep -E ":${HTTP_PORT}[[:space:]]|:${HTTPS_PORT}[[:space:]]" | grep -q "nginx" && \
         ! ss -tulnp 2>/dev/null | grep -E ":${HTTP_PORT}[[:space:]]|:${HTTPS_PORT}[[:space:]]" | grep -q "docker-proxy"; then
        log_fail "Host Nginx is hijacking port ${HTTP_PORT}/${HTTPS_PORT} instead of sparrowx-nginx container" "Run ./fix.sh --auto immediately"
      fi
    fi
  else
    log_info "Pterodactyl Panel not installed on host (optional; skip check)"
  fi
fi

# ==============================================================================
# [06/11] Sovereign PostgreSQL 16 Schema, Roles, PII ACLs, PostgREST & Backups
# ==============================================================================
section_banner "06" "11" "Sovereign PostgreSQL 16 Schema, Roles, PostgREST & Backups"

if [ "${IS_WIN_BASH}" = "true" ] || [ "${DOCKER_READY}" != "true" ] || [ -z "${PG_CTR}" ]; then
  log_skip "Live PostgreSQL container & PostgREST checks skipped (PostgreSQL container not active here)"
else
  if docker exec "${PG_CTR}" pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1 || docker exec "${PG_CTR}" pg_isready -q >/dev/null 2>&1; then
    log_pass "PostgreSQL ready (${PG_CTR} -> ${POSTGRES_DB})"
  else
    log_fail "PostgreSQL pg_isready failed inside ${PG_CTR}" "Check docker logs ${PG_CTR} or run ./fix.sh --auto"
  fi

  run_psql() {
    docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${PG_CTR}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "$1" 2>/dev/null | tr -d '[:space:]'
  }

  PG_VER="$(run_psql "SHOW server_version;" || true)"
  [ -n "${PG_VER}" ] && log_pass "PostgreSQL engine version: ${PG_VER}"

  # Verify all 22 expected public tables from ovh/schema.sql
  EXPECTED_TABLES=(
    incidents threat_feeds assets vulnerabilities reports protected_services
    team_members integrations client_tenants tenant_ips audit_logs app_users
    billing_credits billing_transactions contact_inquiries clients
    subscriptions coin_transactions promo_codes sbs_users user_profiles threat_radar
  )
  MISSING_TABLES=""
  for tbl in "${EXPECTED_TABLES[@]}"; do
    reg="$(run_psql "SELECT to_regclass('public.${tbl}');" || true)"
    if [ "${reg}" != "${tbl}" ] && [ "${reg}" != "public.${tbl}" ]; then
      MISSING_TABLES="${MISSING_TABLES} ${tbl}"
    fi
  done
  if [ -z "${MISSING_TABLES}" ]; then
    log_pass "All ${#EXPECTED_TABLES[@]} Sovereign Schema tables verified present in public schema"
  else
    log_fail "Missing database table(s) in public:${MISSING_TABLES}" "Apply schema: ./update.sh or psql < ovh/schema.sql"
  fi

  # Verify RPC functions & extension
  PGCRYPTO_OK="$(run_psql "SELECT COUNT(*) FROM pg_extension WHERE extname='pgcrypto';" || echo 0)"
  SPEND_FN_OK="$(run_psql "SELECT COUNT(*) FROM pg_proc WHERE proname='spend_coins';" || echo 0)"
  CREDIT_FN_OK="$(run_psql "SELECT COUNT(*) FROM pg_proc WHERE proname='credit_coins';" || echo 0)"
  if [ "${PGCRYPTO_OK:-0}" -ge 1 ] && [ "${SPEND_FN_OK:-0}" -ge 1 ] && [ "${CREDIT_FN_OK:-0}" -ge 1 ]; then
    log_pass "pgcrypto extension and billing RPCs (spend_coins, credit_coins) verified"
  else
    log_fail "Missing pgcrypto extension or billing RPC functions (pgcrypto=${PGCRYPTO_OK}, spend=${SPEND_FN_OK}, credit=${CREDIT_FN_OK})" "Re-apply ovh/schema.sql"
  fi

  # Verify PostgREST / service roles + PII ACL protection on contact_inquiries
  ROLES_OK="$(run_psql "SELECT COUNT(*) FROM pg_roles WHERE rolname IN ('web_anon','authenticator','sparrowx_service');" || echo 0)"
  if [ "${ROLES_OK:-0}" -ge 3 ]; then
    log_pass "Database roles verified (web_anon, authenticator, sparrowx_service)"
  else
    log_fail "Missing required PostgREST/service roles (found ${ROLES_OK}/3)" "Re-apply ovh/schema.sql"
  fi

  INQ_READ_PRIV="$(run_psql "SELECT has_table_privilege('web_anon','public.contact_inquiries','SELECT');" || echo "?")"
  if [ "${INQ_READ_PRIV}" = "f" ]; then
    log_pass "PII access control verified: web_anon cannot SELECT public.contact_inquiries"
  else
    log_fail "SECURITY RISK: web_anon has SELECT privilege on public.contact_inquiries (=${INQ_READ_PRIV})" "Revoke SELECT on public.contact_inquiries from web_anon"
  fi

  # Seeded account + active connections + tenant DB summary
  APP_USERS_CNT="$(run_psql "SELECT COUNT(*) FROM public.app_users;" || echo 0)"
  SBS_USERS_CNT="$(run_psql "SELECT COUNT(*) FROM public.sbs_users;" || echo 0)"
  PG_CONN_CNT="$(run_psql "SELECT COUNT(*) FROM pg_stat_activity;" || echo 0)"
  TENANT_DBS_CNT="$(run_psql "SELECT COUNT(*) FROM pg_database WHERE NOT datistemplate AND datname NOT IN ('postgres','${POSTGRES_DB}');" || echo 0)"
  if [ "${APP_USERS_CNT:-0}" -ge 1 ]; then
    log_pass "Operator directory populated (app_users=${APP_USERS_CNT}, sbs_users=${SBS_USERS_CNT:-0}, pg_conns=${PG_CONN_CNT}, provisioned_dbs=${TENANT_DBS_CNT:-0})"
  else
    log_warn "public.app_users is empty (no seeded operator account yet)" "Run ./manage-db.sh sync"
  fi

  # Live PostgREST API & PII enforcement probe
  PGRST_CODE="$(curl -s -o /dev/null -w "%{http_code}" --max-time 4 "http://127.0.0.1:${PGRST_HOST_PORT}/" 2>/dev/null || echo 000)"
  if [ "${PGRST_CODE}" = "200" ]; then
    log_pass "PostgREST OpenAPI schema live on http://127.0.0.1:${PGRST_HOST_PORT}/ (HTTP 200)"
    INQ_API_CODE="$(curl -s -o /dev/null -w "%{http_code}" --max-time 4 "http://127.0.0.1:${PGRST_HOST_PORT}/contact_inquiries?select=id&limit=1" 2>/dev/null || echo 000)"
    if [ "${INQ_API_CODE}" = "401" ] || [ "${INQ_API_CODE}" = "403" ]; then
      log_pass "PostgREST /contact_inquiries GET blocked anonymously (HTTP ${INQ_API_CODE})"
    elif [ "${INQ_API_CODE}" = "200" ]; then
      log_fail "PostgREST /contact_inquiries returned HTTP 200 to anonymous GET!" "Revoke SELECT privilege from web_anon on contact_inquiries"
    fi
  else
    log_fail "PostgREST failed health check on 127.0.0.1:${PGRST_HOST_PORT} (HTTP ${PGRST_CODE})" "Check docker logs ${PGRST_CTR}"
  fi

  # Backup directory check
  if [ -d "${INSTALL_DIR}/backups" ]; then
    LATEST_BKP="$(find "${INSTALL_DIR}/backups" -type f \( -name '*.sql' -o -name '*.sql.gz' -o -name '*.tar.gz' \) 2>/dev/null | head -n 1 || true)"
    if [ -n "${LATEST_BKP}" ]; then
      log_pass "Database backups directory present with snapshots (${INSTALL_DIR}/backups)"
    else
      log_warn "Backup directory exists (${INSTALL_DIR}/backups) but no .sql/.gz snapshot found yet" "Run ./deploy/backup-all-dbs.sh to create baseline backup"
    fi
  fi
fi

# ==============================================================================
# [07/11] Nginx Reverse Proxy Config, Internal Upstreams & TLS/SSL Audit
# ==============================================================================
section_banner "07" "11" "Nginx Reverse Proxy Configuration & Multi-Domain TLS/SSL Audit"

if [ "${IS_WIN_BASH}" = "true" ] || [ "${DOCKER_READY}" != "true" ] || [ -z "${PROXY_CTR}" ]; then
  log_skip "Live Nginx proxy & container SSL checks skipped"
else
  if docker exec "${PROXY_CTR}" nginx -t >/dev/null 2>&1; then
    log_pass "Nginx configuration syntax clean inside ${PROXY_CTR} (nginx -t OK)"
  else
    NGINX_ERR="$(docker exec "${PROXY_CTR}" nginx -t 2>&1 | tr '\n' ' ' || true)"
    log_fail "Nginx configuration test failed: ${NGINX_ERR}" "Run ./fix.sh --auto to regenerate ovh/nginx.conf"
  fi

  if [ -f "${INSTALL_DIR}/ovh/nginx.conf" ] && grep -qE '__DOCKER_HOST_IP__|__SERVER_IP__|__DOMAIN__' "${INSTALL_DIR}/ovh/nginx.conf" 2>/dev/null; then
    log_fail "Unrendered template placeholder found in ovh/nginx.conf" "Re-render via ./update.sh or ./fix.sh --auto"
  else
    log_pass "ovh/nginx.conf contains no unrendered placeholder tokens"
  fi

  # Verify TLS certificate files & pubkey match & expiry
  CERT_PATH="${INSTALL_DIR}/ovh/ssl/fullchain.pem"
  KEY_PATH="${INSTALL_DIR}/ovh/ssl/privkey.pem"
  if [ -s "${CERT_PATH}" ] && [ -s "${KEY_PATH}" ]; then
    CERT_PUB="$(openssl x509 -in "${CERT_PATH}" -noout -pubkey 2>/dev/null | openssl sha256 2>/dev/null || echo a)"
    KEY_PUB="$(openssl pkey -in "${KEY_PATH}" -pubout 2>/dev/null | openssl sha256 2>/dev/null || echo b)"
    if [ "${CERT_PUB}" = "${KEY_PUB}" ]; then
      log_pass "SSL certificate public key matches privkey.pem"
    else
      log_fail "SSL fullchain.pem does NOT match privkey.pem!" "Re-issue or regenerate TLS cert with ./deploy/ssl-renew.sh"
    fi

    CERT_ISSUER="$(openssl x509 -in "${CERT_PATH}" -noout -issuer 2>/dev/null || echo unknown)"
    CERT_END="$(openssl x509 -in "${CERT_PATH}" -noout -enddate 2>/dev/null | cut -d= -f2 || echo "")"
    if [ -n "${CERT_END}" ]; then
      EXP_EPOCH="$(date -d "${CERT_END}" +%s 2>/dev/null || echo 0)"
      NOW_EPOCH="$(date +%s 2>/dev/null || echo 0)"
      DAYS_LEFT="$(((EXP_EPOCH - NOW_EPOCH) / 86400))"
      if [ "${DAYS_LEFT}" -le 0 ]; then
        log_fail "TLS certificate EXPIRED (${CERT_END})" "Renew immediately: ./deploy/ssl-renew.sh"
      elif [ "${DAYS_LEFT}" -le 14 ]; then
        log_warn "TLS certificate expiring in ${DAYS_LEFT} days (${CERT_END})" "Check Let's Encrypt renewal: ./deploy/ssl-renew.sh"
      else
        log_pass "TLS certificate valid for ${DAYS_LEFT} days (expires ${CERT_END})"
      fi
    fi

    if echo "${CERT_ISSUER}" | grep -qiE "Let's Encrypt|ZeroSSL|R[0-9]|E[0-9]|DigiCert|GlobalSign"; then
      log_pass "Trusted CA TLS certificate active (${CERT_ISSUER})"
    else
      log_warn "Self-signed / local fallback TLS certificate active (${CERT_ISSUER})" "Once DNS points here, run ./deploy/ssl-renew.sh"
    fi

    CERT_SANS="$(openssl x509 -in "${CERT_PATH}" -noout -ext subjectAltName 2>/dev/null | tr '\n' ' ' || true)"
    MISSING_SANS=""
    for sub in "${DOMAIN_ROOT}" "${DOMAIN_STUDIO}" "${DOMAIN_SEC}" "${DOMAIN_FILE}" "${DOMAIN_PASSWORD}" "${DOMAIN_API}" "${DOMAIN_GAME_WEB}"; do
      if ! echo "${CERT_SANS}" | grep -qE "DNS:${sub}([ ,]|$)|DNS:\*\.${DOMAIN_ROOT}"; then
        MISSING_SANS="${MISSING_SANS} ${sub}"
      fi
    done
    if [ -z "${MISSING_SANS}" ]; then
      log_pass "TLS SAN list covers all primary SparrowX domains"
    else
      log_warn "TLS certificate SAN missing domain(s):${MISSING_SANS}" "Expand cert via ./deploy/ssl-renew.sh"
    fi
  else
    log_fail "Missing TLS certificate or key in ${INSTALL_DIR}/ovh/ssl/" "Run ./fix.sh --auto or ./deploy/ssl-renew.sh"
  fi
fi

# ==============================================================================
# [08/11] All SparrowX Virtual Host Routes & Optional Portals Check
# ==============================================================================
section_banner "08" "11" "Multi-Domain Edge Proxy Routing & Subdomain Probe Matrix"

if [ "${IS_WIN_BASH}" = "true" ] && ! curl -fsS --max-time 2 "http://127.0.0.1:${APP_HOST_PORT}/api/v1/health" >/dev/null 2>&1; then
  log_skip "Live HTTP/HTTPS multi-domain routing probes skipped (no local SparrowX server running)"
else
  probe_edge_vhost() {
    local label="$1"
    local host_hdr="$2"
    local path="${3:-/}"
    local required="${4:-yes}"
    local code
    code="$(curl -sk -o /dev/null -w "%{http_code}" --max-time 6 -H "Host: ${host_hdr}" "https://127.0.0.1:${HTTPS_PORT}${path}" 2>/dev/null || echo 000)"
    if [ "${code}" = "000" ]; then
      code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 6 -H "Host: ${host_hdr}" "http://127.0.0.1:${HTTP_PORT}${path}" 2>/dev/null || echo 000)"
    fi
    if [[ "${code}" =~ ^(200|301|302|307|308)$ ]]; then
      log_pass "VHost ${label} (${host_hdr}${path}) -> HTTP ${code}"
    elif [ "${required}" = "yes" ]; then
      log_fail "VHost ${label} (${host_hdr}${path}) returned HTTP ${code}" "Run ./fix.sh --auto or check nginx logs"
    else
      log_warn "Optional VHost ${label} (${host_hdr}${path}) returned HTTP ${code}" "Check corresponding service or upstream port"
    fi
  }

  probe_edge_vhost "Master Hub"         "${DOMAIN_ROOT}"      "/" "yes"
  probe_edge_vhost "Cloud DB Studio"    "${DOMAIN_STUDIO}"    "/" "yes"
  probe_edge_vhost "Shield WAF / SOC"   "${DOMAIN_SEC}"       "/" "yes"
  probe_edge_vhost "File Drop Vault"    "${DOMAIN_FILE}"      "/" "yes"
  probe_edge_vhost "Drop Alias"         "${DOMAIN_DROP}"      "/" "yes"
  probe_edge_vhost "Password / Keys"    "${DOMAIN_PASSWORD}"  "/" "yes"
  probe_edge_vhost "Keys Alias"         "${DOMAIN_KEYS}"      "/" "yes"
  probe_edge_vhost "PostgREST API GW"   "${DOMAIN_API}"       "/" "yes"
  probe_edge_vhost "Game Storefront"    "${DOMAIN_GAME_WEB}"  "/game" "yes"
  probe_edge_vhost "Game Client Dash"   "${DOMAIN_GAME_DASH}" "/" "yes"

  if [ -d "${GAMESEC_DIR:-/opt/sparrowx-gamesec}" ] || docker ps -a --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-gamesec" || systemctl list-unit-files sparrowx-gamesec.service --no-legend 2>/dev/null | grep -q "sparrowx-gamesec"; then
    probe_edge_vhost "Game DDoS Portal" "${DOMAIN_GAMESEC}" "/" "no"
  else
    log_info "Game DDoS portal (${DOMAIN_GAMESEC}) external backend not deployed on host (skip)"
  fi

  if [ -d "${NETSEC_DIR:-/opt/sparrowx-netsec}" ] || docker ps -a --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-netsec" || systemctl list-unit-files sparrowx-netsec.service --no-legend 2>/dev/null | grep -q "sparrowx-netsec"; then
    probe_edge_vhost "Net DDoS Dash" "${DOMAIN_NETSEC}" "/" "no"
  else
    log_info "NetSec DDoS dashboard (${DOMAIN_NETSEC}) external backend not deployed on host (skip)"
  fi

  if [ -d "/var/www/pterodactyl" ]; then
    probe_edge_vhost "Pterodactyl Panel" "${DOMAIN_GAME}" "/" "yes"
  fi
fi

# ==============================================================================
# [09/11] API Health, SSR Hydration Integrity, Security Headers & WAF Probes
# ==============================================================================
section_banner "09" "11" "Application API Health, SSR UI Sanity, Security Headers & WAF Probes"

PROBE_BASE="http://127.0.0.1:${APP_HOST_PORT}"
EDGE_BASE="http://127.0.0.1:${HTTP_PORT}"
curl -sk -o /dev/null --max-time 2 "https://127.0.0.1:${HTTPS_PORT}/api/v1/health" 2>/dev/null && EDGE_BASE="https://127.0.0.1:${HTTPS_PORT}"

if [ "${IS_WIN_BASH}" = "true" ] && ! curl -fsS --max-time 2 "${PROBE_BASE}/api/v1/health" >/dev/null 2>&1; then
  log_skip "Live App API, SSR route rendering, and WAF header probes skipped (no running local server)"
else
  # 1. Core API JSON Endpoints
  H_BODY="$(curl -fsS --max-time 5 "${PROBE_BASE}/api/v1/health" 2>/dev/null || echo "")"
  if echo "${H_BODY}" | grep -q '"healthy"'; then
    log_pass "App health endpoint /api/v1/health -> healthy"
  else
    log_fail "App health endpoint /api/v1/health failed or unhealthy (${H_BODY:0:80})" "Check sparrowx-app logs"
  fi

  DBH_CODE="$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${PROBE_BASE}/api/db/health" 2>/dev/null || echo 000)"
  if [ "${DBH_CODE}" = "200" ]; then
    log_pass "PostgreSQL Provisioner health /api/db/health -> HTTP 200"
  else
    log_warn "/api/db/health returned HTTP ${DBH_CODE} (PG provisioner connection degraded)" "Verify POSTGRES_HOST/PG_HOST_PORT in container .env"
  fi

  SSO_CODE="$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${PROBE_BASE}/api/auth/master-sso" 2>/dev/null || echo 000)"
  if [ "${SSO_CODE}" = "401" ] || [ "${SSO_CODE}" = "200" ]; then
    log_pass "Unified Master SSO route /api/auth/master-sso active (HTTP ${SSO_CODE})"
  else
    log_fail "/api/auth/master-sso returned unexpected HTTP ${SSO_CODE}" "Verify SSR route bundle build"
  fi

  DISCORD_CODE="$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${PROBE_BASE}/api/public/auth/discord/login" 2>/dev/null || echo 000)"
  if [ "${DISCORD_CODE}" = "302" ] || [ "${DISCORD_CODE}" = "200" ]; then
    log_pass "Discord OAuth endpoint /api/public/auth/discord/login responsive (HTTP ${DISCORD_CODE})"
  else
    log_warn "/api/public/auth/discord/login returned HTTP ${DISCORD_CODE}"
  fi

  FILES_JSON="$(curl -fsS --max-time 5 "${PROBE_BASE}/api/storage/files" 2>/dev/null || echo "")"
  if [[ "${FILES_JSON}" == \[* ]]; then
    log_pass "Encrypted Storage API /api/storage/files returns valid JSON array"
  else
    log_warn "/api/storage/files returned unexpected payload"
  fi

  # 2. Verify Public Setup & DDoS Static Assets (must NOT return 404 or SPA HTML fallback!)
  check_static_script() {
    local url_path="$1"
    local expected_token="$2"
    local tmp_body="/tmp/spx_vrfy_body.$$"
    local sc
    sc="$(curl -sk -o "${tmp_body}" -w "%{http_code}" --max-time 5 "${PROBE_BASE}${url_path}" 2>/dev/null || echo 000)"
    if [ "${sc}" = "200" ] && grep -q "${expected_token}" "${tmp_body}" 2>/dev/null && ! grep -qi "<!doctype html" "${tmp_body}" 2>/dev/null; then
      log_pass "Public asset live & authentic: ${url_path} (HTTP 200)"
    else
      log_fail "Public asset broken or falling back to HTML: ${url_path} (HTTP ${sc})" "Ensure file exists in public/ & rebuild .output"
    fi
    rm -f "${tmp_body}" 2>/dev/null || true
  }

  check_static_script "/setup.sh"                    "SPARROWX"
  check_static_script "/ddos-setup.sh"               "SPARROWX"
  check_static_script "/verification.sh"             "SPARROWX INFRASTRUCTURE TOTAL VERIFICATION"
  check_static_script "/update.sh"                   "SPARROWX"
  check_static_script "/fix.sh"                      "SPARROWX"
  check_static_script "/install-connector.sh"        "SPARROWX"
  check_static_script "/xdp/sparrowx_xdp_ddos.c"     "xdp_anti_ddos"
  check_static_script "/xdp/attach-xdp.sh"           "attach-xdp"
  check_static_script "/setup-manifest.json"         "ddos-setup"
  check_static_script "/.well-known/security.txt"    "Contact:"

  # 3. SSR Route Render Sanity (detect ErrorComponent / Minified React error #310!)
  for ui_route in "/" "/db" "/shield" "/drop" "/keys" "/gateway" "/game" "/docs/errors"; do
    ui_html="$(curl -sk -L --max-time 6 -H "Host: ${DOMAIN_ROOT}" "${EDGE_BASE}${ui_route}" 2>/dev/null || echo "")"
    ui_code="$(curl -sk -o /dev/null -w "%{http_code}" --max-time 6 -H "Host: ${DOMAIN_ROOT}" "${EDGE_BASE}${ui_route}" 2>/dev/null || echo 000)"
    if [ "${ui_code}" != "200" ]; then
      log_fail "SSR UI route ${ui_route} returned HTTP ${ui_code}" "Check sparrowx-app and nginx logs"
    elif echo "${ui_html}" | grep -qiE "Minified React error|Platform Service Initializing"; then
      log_fail "SSR UI route ${ui_route} rendered ErrorBoundary crash screen (React error / ErrorComponent)!" "Run git pull && ./update.sh --rebuild"
    else
      log_pass "SSR UI route ${ui_route} renders cleanly (HTTP 200, zero ErrorBoundary crash)"
    fi
  done

  # 4. Security Headers & Active WAF Probes on Edge Proxy
  HDRS="$(curl -skI --max-time 5 -H "Host: ${DOMAIN_ROOT}" "${EDGE_BASE}/" 2>/dev/null || echo "")"
  for req_hdr in "X-Frame-Options" "X-Content-Type-Options" "Strict-Transport-Security" "Content-Security-Policy" "Referrer-Policy" "X-SparrowX-WAF" "X-SparrowX-Shield"; do
    if echo "${HDRS}" | grep -qi "^${req_hdr}:"; then
      log_pass "Security header present on edge response: ${req_hdr}"
    else
      log_warn "Missing security header on ${EDGE_BASE}/: ${req_hdr}" "Verify ovh/node-server.mjs SECURITY_HEADERS and ovh/nginx.conf"
    fi
  done

  DOTENV_CODE="$(curl -sk -o /dev/null -w "%{http_code}" --max-time 4 -H "Host: ${DOMAIN_ROOT}" "${EDGE_BASE}/.env" 2>/dev/null || echo 000)"
  TRAV_CODE="$(curl -sk --path-as-is -o /dev/null -w "%{http_code}" --max-time 4 -H "Host: ${DOMAIN_ROOT}" "${EDGE_BASE}/..%2f..%2fetc/passwd" 2>/dev/null || echo 000)"
  if [ "${DOTENV_CODE}" = "403" ] || [ "${DOTENV_CODE}" = "404" ]; then
    log_pass "WAF dotfile probe (/.env) blocked cleanly (HTTP ${DOTENV_CODE})"
  else
    log_fail "CRITICAL: /.env probe returned HTTP ${DOTENV_CODE}!" "Check ovh/node-server.mjs dotfile WAF guard"
  fi
  if [ "${TRAV_CODE}" = "403" ] || [ "${TRAV_CODE}" = "400" ] || [ "${TRAV_CODE}" = "404" ]; then
    log_pass "WAF path traversal probe rejected cleanly (HTTP ${TRAV_CODE})"
  else
    log_fail "Path traversal probe returned unexpected HTTP ${TRAV_CODE}" "Verify traversal filter in ovh/node-server.mjs"
  fi
fi

# ==============================================================================
# [10/11] L3/L4/L7 DDoS Defense (Kernel Sysctl, UFW, Fail2Ban & XDP/eBPF Maps)
# ==============================================================================
section_banner "10" "11" "L3/L4/L7 DDoS Shield (Kernel Sysctl, UFW, Fail2Ban & XDP/eBPF)"

if [ "${IS_WIN_BASH}" = "true" ]; then
  log_skip "Linux Kernel sysctl, UFW, Fail2Ban, and XDP/eBPF interface checks skipped on Windows Git Bash"
else
  # Kernel sysctl checks
  if command -v sysctl >/dev/null 2>&1; then
    SYN_COOKIES="$(sysctl -n net.ipv4.tcp_syncookies 2>/dev/null || echo 0)"
    RP_FILT="$(sysctl -n net.ipv4.conf.all.rp_filter 2>/dev/null || echo 0)"
    CC_ALG="$(sysctl -n net.ipv4.tcp_congestion_control 2>/dev/null || echo unknown)"
    SYN_BACKLOG="$(sysctl -n net.ipv4.tcp_max_syn_backlog 2>/dev/null || echo 0)"
    if [ "${SYN_COOKIES}" = "1" ]; then
      log_pass "Kernel SYN flood cookies enabled (tcp_syncookies=1, backlog=${SYN_BACKLOG}, cc=${CC_ALG})"
    else
      log_warn "Kernel net.ipv4.tcp_syncookies=${SYN_COOKIES} (expected 1)" "Run: sparrowx-ddos --auto"
    fi
    if [ "${RP_FILT}" = "1" ] || [ "${RP_FILT}" = "2" ]; then
      log_pass "Kernel anti-spoof reverse-path filter active (rp_filter=${RP_FILT})"
    else
      log_warn "Kernel rp_filter=${RP_FILT} (anti-IP-spoofing disabled)" "Run: sparrowx-ddos --auto"
    fi
  fi

  # UFW Firewall status
  if command -v ufw >/dev/null 2>&1; then
    UFW_STAT="$(ufw status 2>/dev/null | head -n 1 || echo "")"
    if echo "${UFW_STAT}" | grep -qi "active"; then
      log_pass "UFW host firewall active (${UFW_STAT})"
    elif [ "$(id -u)" -ne 0 ]; then
      log_skip "UFW status requires root (re-run with sudo)"
    else
      log_warn "UFW firewall is inactive" "Enable safely with SSH/80/443 allowed via ./deploy/ddos-setup.sh"
    fi
  fi

  # Fail2Ban status
  if command -v fail2ban-client >/dev/null 2>&1; then
    if f2b_out="$(fail2ban-client status 2>/dev/null)"; then
      jail_cnt="$(echo "${f2b_out}" | awk -F: '/Number of jail/ {gsub(/[[:space:]]/,"",$2); print $2}' || echo 0)"
      log_pass "Fail2Ban daemon running (${jail_cnt} active jail(s))"
    elif [ "$(id -u)" -ne 0 ]; then
      log_skip "Fail2Ban client status requires root"
    else
      log_warn "Fail2Ban installed but service unreachable" "Run: systemctl restart fail2ban"
    fi
  else
    log_warn "Fail2Ban not installed" "Install via: ./deploy/ddos-setup.sh --auto"
  fi

  # XDP / eBPF filter & maps
  IFACE="${SPARROWX_XDP_IFACE:-$(ip route show default 2>/dev/null | awk '/default/ {print $5; exit}' || true)}"
  if [ -n "${IFACE}" ] && command -v ip >/dev/null 2>&1; then
    LINK_DTL="$(ip -details link show dev "${IFACE}" 2>/dev/null || true)"
    if echo "${LINK_DTL}" | grep -qiE "xdp|prog/xdp"; then
      XDP_MODE_LIVE="$(echo "${LINK_DTL}" | grep -oE 'xdpgeneric|xdp/id:[0-9]+|xdp' | head -n 1 || echo xdp)"
      log_pass "XDP/eBPF packet scrubber ATTACHED on ${IFACE} (${XDP_MODE_LIVE})"
      if command -v bpftool >/dev/null 2>&1 && [ "$(id -u)" -eq 0 ]; then
        MAPS_OUT="$(bpftool map show 2>/dev/null || true)"
        FOUND_MAPS=0
        for mname in blocked_ipv4 whitelist challenge_sent xdp_stats; do
          echo "${MAPS_OUT}" | grep -q "${mname}" && FOUND_MAPS=$((FOUND_MAPS + 1))
        done
        if [ "${FOUND_MAPS}" -eq 4 ]; then
          log_pass "All 4 XDP eBPF maps verified loaded (blocked_ipv4, whitelist, challenge_sent, xdp_stats)"
        else
          log_warn "Only ${FOUND_MAPS}/4 expected XDP BPF maps visible in bpftool" "Re-attach via: sparrowx-xdp --attach"
        fi
        if command -v node >/dev/null 2>&1; then
          STATS_JSON="$(bpftool -j map dump name xdp_stats 2>/dev/null || true)"
          if [ -n "${STATS_JSON}" ]; then
            STATS_SUMMARY="$(node -e "
              try {
                const arr = JSON.parse(process.argv[1]);
                const sum = [0,0,0,0];
                for (const row of arr) {
                  const k = Array.isArray(row.key) ? row.key.reduce((a,b,i)=>a+(parseInt(b,16)<<(8*i)),0) : Number(row.key||0);
                  let v = 0;
                  if (Array.isArray(row.values)) {
                    for (const c of row.values) {
                      if (typeof c.value === 'number') v += c.value;
                      else if (Array.isArray(c.value)) v += c.value.reduce((a,b,i)=>a+(parseInt(b,16)*(2**(8*i))),0);
                    }
                  }
                  if (k >= 0 && k < 4) sum[k] = v;
                }
                console.log('passed='+sum[0]+' challenged='+sum[1]+' dropped='+sum[2]+' whitelisted='+sum[3]);
              } catch { process.exit(1); }
            " "${STATS_JSON}" 2>/dev/null || true)"
            [ -n "${STATS_SUMMARY}" ] && log_pass "Live XDP telemetry counters: ${STATS_SUMMARY}"
          fi
        fi
      fi
    else
      log_warn "No XDP/eBPF program attached to primary interface '${IFACE}' (OVH/KVM or unattached)" "Compile & attach via: ./deploy/ddos-setup.sh --auto"
    fi

    if [ -f "/opt/sparrowx/xdp/sparrowx_xdp_ddos.o" ]; then
      log_pass "Compiled eBPF ELF binary present: /opt/sparrowx/xdp/sparrowx_xdp_ddos.o"
    else
      log_warn "Compiled /opt/sparrowx/xdp/sparrowx_xdp_ddos.o not built yet" "Run ./deploy/ddos-setup.sh --auto"
    fi
  else
    log_warn "Could not determine default network interface for XDP verification"
  fi
fi

# ==============================================================================
# [11/11] Public DNS Records & Optional Codebase Verification (--code)
# ==============================================================================
section_banner "11" "11" "Public DNS Records & Codebase Quality Checks"

if [ "${RUN_LIVE_DNS}" = "true" ] && command -v dig >/dev/null 2>&1; then
  PUB_IP_CHK="${SPARROWX_PUBLIC_IP:-$(curl -4 -fsS --max-time 4 https://api.ipify.org 2>/dev/null || true)}"
  for d_chk in "${DOMAIN_ROOT}" "${DOMAIN_STUDIO}" "${DOMAIN_SEC}" "${DOMAIN_FILE}" "${DOMAIN_PASSWORD}" "${DOMAIN_API}" "${DOMAIN_GAME_WEB}"; do
    a_rec="$(dig +short A "${d_chk}" @1.1.1.1 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -n 1 || true)"
    if [ -n "${a_rec}" ]; then
      if [ -n "${PUB_IP_CHK}" ] && [ "${a_rec}" = "${PUB_IP_CHK}" ]; then
        log_pass "DNS A record ${d_chk} -> ${a_rec} (matches server IP)"
      else
        log_pass "DNS A record ${d_chk} -> ${a_rec} (proxied/edge target; server IP=${PUB_IP_CHK:-unknown})"
      fi
    else
      log_warn "No public DNS A record returned for ${d_chk}" "Create A record pointing to ${PUB_IP_CHK:-your_server_ip}"
    fi
  done

  CAA_REC="$(dig +short CAA "${DOMAIN_ROOT}" @1.1.1.1 2>/dev/null | head -n 1 || true)"
  if [ -n "${CAA_REC}" ]; then
    log_pass "DNS CAA record configured on ${DOMAIN_ROOT}: ${CAA_REC}"
  else
    log_warn "Missing DNS CAA record on ${DOMAIN_ROOT} (recommended for Shield A+ score)" "Add DNS CAA record: 0 issue \"letsencrypt.org\""
  fi
else
  log_skip "Public DNS A/CAA audit skipped (use --live-dns to run external DNS lookups)"
fi

if [ "${RUN_CODE_CHECKS}" = "true" ]; then
  if command -v npx >/dev/null 2>&1 && [ -f "${INSTALL_DIR}/package.json" ]; then
    log_info "Running TypeScript check (npx tsc --noEmit)..."
    if (cd "${INSTALL_DIR}" && npx tsc --noEmit >/dev/null 2>&1); then
      log_pass "TypeScript check (npx tsc --noEmit) passed with 0 errors"
    else
      log_fail "TypeScript errors detected by npx tsc --noEmit" "Inspect with: npx tsc --noEmit"
    fi

    log_info "Running ESLint quality check..."
    if (cd "${INSTALL_DIR}" && npx eslint . --quiet --rule "prettier/prettier: off" >/dev/null 2>&1); then
      log_pass "ESLint passed with 0 errors"
    else
      log_fail "ESLint errors detected" "Inspect with: npx eslint . --quiet"
    fi

    log_info "Running full Vitest test suite (npm test)..."
    if (cd "${INSTALL_DIR}" && npm test >/dev/null 2>&1); then
      log_pass "Full Vitest suite (npm test) passed"
    else
      log_fail "One or more Vitest tests failed" "Inspect with: npm test"
    fi
  else
    log_warn "Cannot run --code checks: npx or package.json missing in ${INSTALL_DIR}"
  fi
else
  log_skip "Repo tsc/eslint/vitest checks skipped (pass --code to execute)"
fi

# ==============================================================================
# FINAL SCORECARD & JSON REPORT
# ==============================================================================
END_EPOCH="$(date +%s 2>/dev/null || echo 0)"
DURATION_SEC="$((END_EPOCH - START_EPOCH))"
[ "${DURATION_SEC}" -lt 0 ] && DURATION_SEC=0

OVERALL_STATUS="HEALTHY"
EXIT_CODE=0
if [ "${FAIL_COUNT}" -gt 0 ]; then
  OVERALL_STATUS="FAILED"
  EXIT_CODE=1
elif [ "${WARN_COUNT}" -gt 0 ]; then
  OVERALL_STATUS="DEGRADED_WARNINGS"
  [ "${STRICT_MODE}" = "true" ] && EXIT_CODE=1
fi

if [ "${WRITE_JSON}" = "true" ]; then
  {
    echo "{"
    echo "  \"timestamp\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date)\","
    echo "  \"status\": \"${OVERALL_STATUS}\","
    echo "  \"installDir\": \"$(json_escape "${INSTALL_DIR}")\","
    echo "  \"domain\": \"$(json_escape "${DOMAIN_ROOT}")\","
    echo "  \"durationSec\": ${DURATION_SEC},"
    echo "  \"counts\": {\"passed\": ${PASS_COUNT}, \"warnings\": ${WARN_COUNT}, \"failed\": ${FAIL_COUNT}, \"skipped\": ${SKIP_COUNT}},"
    echo "  \"checks\": ["
    for idx in "${!JSON_RECORDS[@]}"; do
      comma=","
      [ "${idx}" -eq "$((${#JSON_RECORDS[@]} - 1))" ] && comma=""
      echo "    ${JSON_RECORDS[${idx}]}${comma}"
    done
    echo "  ]"
    echo "}"
  } > "${JSON_FILE}" 2>/dev/null || true
fi

if [ "${JSON_ONLY}" = "true" ]; then
  cat "${JSON_FILE}" 2>/dev/null || true
  exit "${EXIT_CODE}"
fi

out_line ""
out_line "${C_CYAN}╔════════════════════════════════════════════════════════════════════════════╗${C_RESET}"
out_line "${C_CYAN}║${C_RESET}  ${C_BOLD}${C_WHITE}SPARROWX INFRASTRUCTURE VERIFICATION SCORECARD${C_RESET}                          ${C_CYAN}║${C_RESET}"
out_line "${C_CYAN}╠════════════════════════════════════════════════════════════════════════════╣${C_RESET}"
out_line "${C_CYAN}║${C_RESET}  Overall Status : $([ "${EXIT_CODE}" -eq 0 ] && [ "${WARN_COUNT}" -eq 0 ] && echo -e "${C_GREEN}HEALTHY (ALL CHECKS PASSED)${C_RESET}" || ([ "${FAIL_COUNT}" -gt 0 ] && echo -e "${C_RED}FAILURES DETECTED (${FAIL_COUNT})${C_RESET}" || echo -e "${C_YELLOW}HEALTHY WITH ${WARN_COUNT} WARNING(S)${C_RESET}"))"
out_line "${C_CYAN}║${C_RESET}  Summary Counts : ${C_GREEN}PASS=${PASS_COUNT}${C_RESET}  ${C_YELLOW}WARN=${WARN_COUNT}${C_RESET}  ${C_RED}FAIL=${FAIL_COUNT}${C_RESET}  ${C_DIM}SKIP=${SKIP_COUNT}${C_RESET}  (${DURATION_SEC}s)"
out_line "${C_CYAN}║${C_RESET}  Audit Log File : ${LOG_FILE}"
[ "${WRITE_JSON}" = "true" ] && out_line "${C_CYAN}║${C_RESET}  JSON Report    : ${JSON_FILE}"
out_line "${C_CYAN}╚════════════════════════════════════════════════════════════════════════════╝${C_RESET}"

if [ "${FAIL_COUNT}" -gt 0 ]; then
  out_line ""
  out_line "  ${C_RED}${C_BOLD}Failures Requiring Attention:${C_RESET}"
  for item in "${FAIL_ITEMS[@]}"; do
    out_line "    ${C_RED}•${C_RESET} ${item}"
  done
fi

if [ "${WARN_COUNT}" -gt 0 ]; then
  out_line ""
  out_line "  ${C_YELLOW}${C_BOLD}Warnings / Optimizations:${C_RESET}"
  for item in "${WARN_ITEMS[@]}"; do
    out_line "    ${C_YELLOW}•${C_RESET} ${item}"
  done
fi

if [ "${#FIX_HINTS[@]}" -gt 0 ]; then
  out_line ""
  out_line "  ${C_CYAN}${C_BOLD}Recommended Actions:${C_RESET}"
  printf '%s\n' "${FIX_HINTS[@]}" | awk '!seen[$0]++' | while IFS= read -r h; do
    out_line "    ${C_CYAN}->${C_RESET} ${h}"
  done
fi

exit "${EXIT_CODE}"
