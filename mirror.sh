#!/usr/bin/env bash
# ==============================================================================
# SPARROWX UNIVERSAL VPS MIRROR, CONTINUOUS WATCHER & ANY-OS RESTORE ENGINE
# ==============================================================================
# Keeps an always-ready, complete mirror snapshot of this VPS in the background
# (auto-packing on any file/git/config/cert/DB change) and restores an exact
# mirror on ANY Linux VPS (Ubuntu, Debian, Rocky, Alma, RHEL, Fedora, Arch,
# openSUSE — any version) in one command.
#
# Commands:
#   sudo ./mirror.sh pack [--encrypt] [--push] [--auto]
#   sudo ./mirror.sh install-daemon          # Enable 24/7 live watcher + 6h timer
#   sudo ./mirror.sh watch                   # Run foreground change observer
#   sudo ./mirror.sh status                  # Show daemon, latest snapshot & size
#   sudo ./mirror.sh restore [options]       # Mirror onto ANY Linux VPS
#     --from <file.tar.gz|.enc>              Restore from local snapshot archive
#     --from-vps <user@old-vps-ip>           Pack & pull live over SSH from old VPS
#     --from-git <private-vault-repo-url>    Pull encrypted snapshot from private git
#     --passphrase <secret>                  Decryption/encryption passphrase
#     --yes, -y                              Non-interactive mode
# ==============================================================================
set -uo pipefail
export GIT_TERMINAL_PROMPT=0
export GCM_INTERACTIVE=never

SCRIPT_SOURCE="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
INSTALL_DIR="$(cd "$(dirname "${SCRIPT_SOURCE}")" && pwd)"
BACKUP_ROOT="${MIRROR_BACKUP_ROOT:-/var/backups/sparrowx-mirror}"
MIRROR_CONF="/etc/sparrowx/mirror.env"
MIRROR_LOG="/var/log/sparrowx-mirror.log"
LOCK_FILE="/var/run/sparrowx-mirror.lock"
RETENTION_COUNT="${MIRROR_RETENTION:-7}"

# Colors
C_RESET="\033[0m"
C_BOLD="\033[1m"
C_GREEN="\033[1;32m"
C_CYAN="\033[1;36m"
C_YELLOW="\033[1;33m"
C_RED="\033[1;31m"

log_info() { echo -e "  ${C_CYAN}[MIRROR]${C_RESET}   $*"; printf "[%s] [INFO] %s\n" "$(date '+%F %T')" "$*" >> "${MIRROR_LOG}" 2>/dev/null || true; }
log_ok()   { echo -e "  ${C_GREEN}[  OK  ]${C_RESET}   $*"; printf "[%s] [OK]   %s\n" "$(date '+%F %T')" "$*" >> "${MIRROR_LOG}" 2>/dev/null || true; }
log_warn() { echo -e "  ${C_YELLOW}[ WARN ]${C_RESET}   $*"; printf "[%s] [WARN] %s\n" "$(date '+%F %T')" "$*" >> "${MIRROR_LOG}" 2>/dev/null || true; }
log_err()  { echo -e "  ${C_RED}[ ERR  ]${C_RESET}   $*" >&2; printf "[%s] [ERR]  %s\n" "$(date '+%F %T')" "$*" >> "${MIRROR_LOG}" 2>/dev/null || true; }

# Load optional mirror config (encryption passphrase, private git vault URL, remote rsync target)
[ -f "${MIRROR_CONF}" ] && source "${MIRROR_CONF}" 2>/dev/null || true
[ -f "${INSTALL_DIR}/.env" ] && source "${INSTALL_DIR}/.env" 2>/dev/null || true
[ -f "/etc/sparrowx/app.env" ] && source "/etc/sparrowx/app.env" 2>/dev/null || true

# Auto-elevate to root for system commands
require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    if command -v sudo >/dev/null 2>&1; then
      exec sudo -E bash "${SCRIPT_SOURCE}" "$@"
    else
      log_err "Please run as root (sudo ./mirror.sh ...)."
      exit 1
    fi
  fi
}

# ==============================================================================
# 1. UNIVERSAL LINUX OS & PACKAGE MANAGER ABSTRACTION (ALL DISTROS & VERSIONS)
# ==============================================================================
OS_ID="unknown"
OS_LIKE=""
OS_VERSION="unknown"
PKG_MGR="unknown"

detect_os() {
  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    OS_ID="${ID:-unknown}"
    OS_LIKE="${ID_LIKE:-}"
    OS_VERSION="${VERSION_ID:-rolling}"
  fi

  if command -v apt-get >/dev/null 2>&1; then
    PKG_MGR="apt"
  elif command -v dnf >/dev/null 2>&1; then
    PKG_MGR="dnf"
  elif command -v yum >/dev/null 2>&1; then
    PKG_MGR="yum"
  elif command -v pacman >/dev/null 2>&1; then
    PKG_MGR="pacman"
  elif command -v zypper >/dev/null 2>&1; then
    PKG_MGR="zypper"
  elif command -v apk >/dev/null 2>&1; then
    PKG_MGR="apk"
  fi
}

pkg_update() {
  case "${PKG_MGR}" in
    apt)
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -qq >/dev/null 2>&1 || true
      ;;
    dnf)    dnf makecache -q >/dev/null 2>&1 || true ;;
    yum)    yum makecache -q >/dev/null 2>&1 || true ;;
    pacman) pacman -Sy --noconfirm >/dev/null 2>&1 || true ;;
    zypper) zypper --non-interactive refresh >/dev/null 2>&1 || true ;;
    apk)    apk update >/dev/null 2>&1 || true ;;
  esac
}

pkg_install() {
  local pkgs=("$@")
  [ "${#pkgs[@]}" -eq 0 ] && return 0
  case "${PKG_MGR}" in
    apt)
      export DEBIAN_FRONTEND=noninteractive
      apt-get install -y -qq "${pkgs[@]}" >/dev/null 2>&1 || true
      ;;
    dnf)    dnf install -y -q "${pkgs[@]}" >/dev/null 2>&1 || true ;;
    yum)    yum install -y -q "${pkgs[@]}" >/dev/null 2>&1 || true ;;
    pacman) pacman -S --noconfirm --needed "${pkgs[@]}" >/dev/null 2>&1 || true ;;
    zypper) zypper --non-interactive install -y "${pkgs[@]}" >/dev/null 2>&1 || true ;;
    apk)    apk add --no-cache "${pkgs[@]}" >/dev/null 2>&1 || true ;;
  esac
}

ensure_base_tools() {
  detect_os
  log_info "Detected OS: ${OS_ID} ${OS_VERSION} (package manager: ${PKG_MGR})"
  pkg_update

  case "${PKG_MGR}" in
    apt)    pkg_install curl git tar gzip openssl python3 rsync ca-certificates inotify-tools cron jq psmisc ;;
    dnf|yum) pkg_install curl git tar gzip openssl python3 rsync ca-certificates inotify-tools cronie jq psmisc ;;
    pacman) pkg_install curl git tar gzip openssl python rsync ca-certificates inotify-tools cronie jq psmisc ;;
    zypper) pkg_install curl git tar gzip openssl python3 rsync ca-certificates inotify-tools cron jq psmisc ;;
    apk)    pkg_install bash curl git tar gzip openssl python3 rsync ca-certificates inotify-tools jq psmisc ;;
  esac
}

ensure_docker_universal() {
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker compose version >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1; then
      log_ok "Docker Engine + Compose ready."
      return 0
    fi
  fi

  log_info "Installing Docker Engine + Compose plugin for ${OS_ID} ${OS_VERSION}..."
  case "${PKG_MGR}" in
    pacman)
      pkg_install docker docker-compose
      ;;
    apk)
      pkg_install docker docker-cli-compose
      ;;
    *)
      if ! command -v docker >/dev/null 2>&1; then
        curl -fsSL https://get.docker.com -o /tmp/get-docker.sh && sh /tmp/get-docker.sh >/dev/null 2>&1 || {
          # Fallback to distro packages if get.docker.com fails on bleeding-edge OS versions
          case "${PKG_MGR}" in
            apt) pkg_install docker.io docker-compose-v2 docker-compose-plugin ;;
            dnf|yum) pkg_install docker docker-compose-plugin ;;
            zypper) pkg_install docker docker-compose ;;
          esac
        }
        rm -f /tmp/get-docker.sh
      fi
      if ! docker compose version >/dev/null 2>&1; then
        case "${PKG_MGR}" in
          apt) pkg_install docker-compose-plugin docker-compose-v2 ;;
          dnf|yum) pkg_install docker-compose-plugin ;;
          zypper) pkg_install docker-compose ;;
        esac
      fi
      ;;
  esac

  if command -v systemctl >/dev/null 2>&1; then
    systemctl enable --now containerd >/dev/null 2>&1 || true
    systemctl enable --now docker >/dev/null 2>&1 || true
  elif command -v rc-service >/dev/null 2>&1; then
    rc-update add docker boot >/dev/null 2>&1 || true
    rc-service docker start >/dev/null 2>&1 || true
  fi
  sleep 2
  docker info >/dev/null 2>&1 && log_ok "Docker Engine active." || log_err "Docker daemon did not start cleanly."
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

ensure_swap_guard() {
  local ram_mb swap_mb disk_mb
  ram_mb="$(free -m 2>/dev/null | awk '/^Mem:/ {print $2}' || echo 4096)"
  swap_mb="$(free -m 2>/dev/null | awk '/^Swap:/ {print $2}' || echo 0)"
  disk_mb="$(df -Pm / 2>/dev/null | awk 'NR==2 {print $4}' || echo 0)"
  if [ "${ram_mb:-4096}" -lt 4096 ] && [ "${swap_mb:-0}" -lt 1024 ] && [ ! -f /swapfile ] && [ "${disk_mb:-0}" -gt 4096 ]; then
    log_info "Provisioning 2 GB swapfile for safe container builds..."
    (fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none) && \
      chmod 600 /swapfile && mkswap /swapfile >/dev/null 2>&1 && swapon /swapfile 2>/dev/null || true
    grep -q "^/swapfile " /etc/fstab 2>/dev/null || echo "/swapfile none swap sw 0 0" >> /etc/fstab
  fi
}

open_firewall_universal() {
  local ssh_port="22"
  ssh_port="$(ss -tulnp 2>/dev/null | awk '/sshd/ {print $5}' | sed -E 's/.*:([0-9]+)$/\1/' | head -n1 || echo 22)"
  [ -z "${ssh_port}" ] && ssh_port="22"

  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi "Status: active"; then
    ufw allow "${ssh_port}/tcp" >/dev/null 2>&1 || true
    ufw allow 80/tcp >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
    ufw allow 2022/tcp >/dev/null 2>&1 || true
    ufw allow 8080/tcp >/dev/null 2>&1 || true
    log_ok "Opened UFW ports (${ssh_port}, 80, 443, 2022, 8080)."
  elif command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld 2>/dev/null; then
    firewall-cmd --permanent --add-service=http --add-service=https --add-port="${ssh_port}/tcp" --add-port=2022/tcp --add-port=8080/tcp >/dev/null 2>&1 || true
    firewall-cmd --reload >/dev/null 2>&1 || true
    log_ok "Opened firewalld ports (${ssh_port}, 80, 443, 2022, 8080)."
  fi
}

# ==============================================================================
# 2. FULL VPS MIRROR PACKAGER (pack)
# ==============================================================================
do_pack() {
  local encrypt_flag="${MIRROR_ENCRYPT:-false}"
  local push_flag="false"
  local auto_flag="false"
  local passphrase="${MIRROR_PASSPHRASE:-}"

  while [ $# -gt 0 ]; do
    case "$1" in
      --encrypt)    encrypt_flag="true" ;;
      --no-encrypt) encrypt_flag="false" ;;
      --push)       push_flag="true" ;;
      --auto)       auto_flag="true" ;;
      --passphrase) shift; passphrase="${1:-}" ;;
    esac
    shift || true
  done

  mkdir -p "${BACKUP_ROOT}" "$(dirname "${MIRROR_LOG}")"
  chmod 700 "${BACKUP_ROOT}" 2>/dev/null || true

  # Atomic lock so overlapping watcher/timer/manual runs never corrupt an archive
  if command -v flock >/dev/null 2>&1; then
    exec 8>"${LOCK_FILE}"
    if ! flock -n 8; then
      [ "${auto_flag}" = "true" ] && exit 0
      log_info "Another mirror pack is already running — waiting..."
      flock 8
    fi
  fi

  detect_os
  local stamp stage_dir archive_raw archive_final git_sha git_branch pub_ip
  stamp="$(date +%Y%m%d_%H%M%S)"
  stage_dir="$(mktemp -d /tmp/sparrowx-mirror-stage.XXXXXX)"
  trap 'rm -rf "${stage_dir:-}"' RETURN

  mkdir -p \
    "${stage_dir}/env" \
    "${stage_dir}/db/postgres" \
    "${stage_dir}/db/mariadb" \
    "${stage_dir}/docker-volumes" \
    "${stage_dir}/ssl" \
    "${stage_dir}/nginx" \
    "${stage_dir}/dkim" \
    "${stage_dir}/pterodactyl" \
    "${stage_dir}/companions" \
    "${stage_dir}/xdp"

  git_sha="$(git -C "${INSTALL_DIR}" rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
  git_branch="$(git -C "${INSTALL_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'main')"
  pub_ip="$(curl -4 -fsS --max-time 4 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo 'unknown')"

  log_info "Packing full VPS mirror snapshot (${stamp}, commit ${git_sha})..."

  # A. Environment & Secret Files (never stored in public git; preserved in mirror archive)
  [ -f "${INSTALL_DIR}/.env" ] && cp -a "${INSTALL_DIR}/.env" "${stage_dir}/env/repo.env"
  [ -d "/etc/sparrowx" ] && cp -a /etc/sparrowx/. "${stage_dir}/env/etc-sparrowx/" 2>/dev/null || true
  [ -f "${INSTALL_DIR}/.env.local" ] && cp -a "${INSTALL_DIR}/.env.local" "${stage_dir}/env/repo.env.local"

  # B. PostgreSQL Full Cluster Dump (all databases, roles, schemas, Cloud DBs, users)
  local pg_dumped="false"
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-postgres"; then
    local pg_u="${POSTGRES_USER:-sparrowx}"
    if docker exec -e PGPASSWORD="${POSTGRES_PASSWORD:-}" sparrowx-postgres pg_dumpall --clean --if-exists -U "${pg_u}" 2>/dev/null | gzip -6 > "${stage_dir}/db/postgres/cluster_dumpall.sql.gz"; then
      [ -s "${stage_dir}/db/postgres/cluster_dumpall.sql.gz" ] && pg_dumped="true"
    fi
  elif command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx_postgres"; then
    if docker exec sparrowx_postgres pg_dumpall --clean --if-exists -U postgres 2>/dev/null | gzip -6 > "${stage_dir}/db/postgres/cluster_dumpall.sql.gz"; then
      [ -s "${stage_dir}/db/postgres/cluster_dumpall.sql.gz" ] && pg_dumped="true"
    fi
  fi
  [ "${pg_dumped}" = "true" ] && log_ok "PostgreSQL cluster dumped." || log_warn "PostgreSQL container not running — skipped live SQL dump."

  # C. MariaDB / MySQL Dump (Pterodactyl panel DB, Stellar theme settings, eggs, game DBs)
  local maria_dumped="false"
  local dump_bin=""
  dump_bin="$(command -v mariadb-dump || command -v mysqldump || true)"
  if [ -n "${dump_bin}" ]; then
    if "${dump_bin}" --all-databases --single-transaction --routines --triggers --events 2>/dev/null | gzip -6 > "${stage_dir}/db/mariadb/all_databases.sql.gz"; then
      [ -s "${stage_dir}/db/mariadb/all_databases.sql.gz" ] && maria_dumped="true"
    elif [ -n "${PTERO_DB_PASSWORD:-}" ] && [ -n "${PTERO_DB_USER:-}" ]; then
      "${dump_bin}" -u"${PTERO_DB_USER}" -p"${PTERO_DB_PASSWORD}" "${PTERO_DB_NAME:-panel}" --single-transaction 2>/dev/null | gzip -6 > "${stage_dir}/db/mariadb/panel.sql.gz" && maria_dumped="true" || true
    fi
  fi
  [ "${maria_dumped}" = "true" ] && log_ok "MariaDB/MySQL databases dumped."

  # D. Docker Volumes (sparrowx_appdata) & Local Persistent Data
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    local app_vol
    app_vol="$(docker volume ls -q 2>/dev/null | grep -E '(^|_)sparrowx_appdata$' | head -n1 || true)"
    if [ -n "${app_vol}" ]; then
      docker run --rm -v "${app_vol}:/src:ro" -v "${stage_dir}/docker-volumes:/dst" alpine:3.20 \
        sh -c 'tar -czf /dst/sparrowx_appdata.tar.gz -C /src .' >/dev/null 2>&1 && log_ok "Packed Docker volume ${app_vol}." || true
    fi
  fi
  if [ -d "${INSTALL_DIR}/data" ]; then
    tar -czf "${stage_dir}/docker-volumes/repo_data.tar.gz" -C "${INSTALL_DIR}" data 2>/dev/null || true
  fi

  # E. SSL Certificates (Let's Encrypt + OVH SSL), Nginx & OpenDKIM Keys
  [ -d "/etc/letsencrypt" ] && tar -czf "${stage_dir}/ssl/letsencrypt.tar.gz" -C /etc letsencrypt 2>/dev/null || true
  [ -d "${INSTALL_DIR}/ovh/ssl" ] && tar -czf "${stage_dir}/ssl/ovh_ssl.tar.gz" -C "${INSTALL_DIR}/ovh" ssl 2>/dev/null || true
  [ -d "${INSTALL_DIR}/ovh/dkim" ] && tar -czf "${stage_dir}/dkim/ovh_dkim.tar.gz" -C "${INSTALL_DIR}/ovh" dkim 2>/dev/null || true
  [ -f "${INSTALL_DIR}/ovh/nginx.conf" ] && cp -a "${INSTALL_DIR}/ovh/nginx.conf" "${stage_dir}/nginx/ovh_nginx.conf"
  [ -f "/etc/nginx/sites-available/pterodactyl.conf" ] && cp -a "/etc/nginx/sites-available/pterodactyl.conf" "${stage_dir}/nginx/pterodactyl.conf"

  # F. Pterodactyl Panel (Stellar Theme, Midnight Black CSS, .env, storage, Wings config)
  local ptero_packed="false"
  if [ -d "/var/www/pterodactyl" ]; then
    [ -f "/var/www/pterodactyl/.env" ] && cp -a "/var/www/pterodactyl/.env" "${stage_dir}/pterodactyl/panel.env"
    [ -d "/var/www/pterodactyl/public/sparrowx" ] && tar -czf "${stage_dir}/pterodactyl/public_sparrowx.tar.gz" -C /var/www/pterodactyl/public sparrowx 2>/dev/null || true
    [ -f "/var/www/pterodactyl/resources/views/templates/wrapper.blade.php" ] && cp -a "/var/www/pterodactyl/resources/views/templates/wrapper.blade.php" "${stage_dir}/pterodactyl/wrapper.blade.php"
    # Pack entire Pterodactyl tree (including Stellar theme assets) excluding heavy transient logs/cache
    tar --exclude='storage/logs/*' --exclude='storage/framework/cache/*' --exclude='storage/framework/sessions/*' --exclude='storage/framework/views/*' \
      --exclude='.sparrowx-brand-backups/*' \
      -czf "${stage_dir}/pterodactyl/pterodactyl_full.tar.gz" -C /var/www pterodactyl 2>/dev/null && ptero_packed="true" || true
    [ -f "/etc/pterodactyl/config.yml" ] && cp -a "/etc/pterodactyl/config.yml" "${stage_dir}/pterodactyl/wings_config.yml"
    [ "${ptero_packed}" = "true" ] && log_ok "Packed Pterodactyl Panel + Stellar Theme + Wings config."
  fi

  # G. Companion Portals (GameSec, NetSec) & XDP / Fail2Ban Whitelists
  [ -f "/opt/sparrowx-gamesec/.env" ] && cp -a "/opt/sparrowx-gamesec/.env" "${stage_dir}/companions/gamesec.env"
  [ -f "/opt/sparrowx-netsec/.env" ] && cp -a "/opt/sparrowx-netsec/.env" "${stage_dir}/companions/netsec.env"
  [ -f "/opt/sparrowx/xdp/whitelist_ipv4.txt" ] && cp -a "/opt/sparrowx/xdp/whitelist_ipv4.txt" "${stage_dir}/xdp/whitelist_ipv4.txt"
  [ -f "/etc/fail2ban/jail.d/sparrowx-ddos.conf" ] && cp -a "/etc/fail2ban/jail.d/sparrowx-ddos.conf" "${stage_dir}/xdp/sparrowx-ddos.conf"

  # H. Manifest & SHA-256 Checksums
  cat > "${stage_dir}/MANIFEST.json" <<EOF
{
  "format": "sparrowx-vps-mirror-v2",
  "created_at_utc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "source_hostname": "$(hostname 2>/dev/null || echo ovh)",
  "source_os": "${OS_ID} ${OS_VERSION}",
  "source_public_ip": "${pub_ip}",
  "git_branch": "${git_branch}",
  "git_commit": "${git_sha}",
  "components": {
    "postgres_dump": ${pg_dumped},
    "mariadb_dump": ${maria_dumped},
    "pterodactyl_full": ${ptero_packed}
  }
}
EOF
  (cd "${stage_dir}" && find . -type f ! -name 'SHA256SUMS' -print0 | xargs -0 sha256sum > SHA256SUMS 2>/dev/null || true)

  archive_raw="${BACKUP_ROOT}/sparrowx-mirror-${stamp}.tar.gz"
  tar -czf "${archive_raw}" -C "${stage_dir}" .
  chmod 600 "${archive_raw}"

  archive_final="${archive_raw}"
  if [ "${encrypt_flag}" = "true" ]; then
    if [ -z "${passphrase}" ]; then
      passphrase="$(openssl rand -base64 32 | tr -d '\n')"
      mkdir -p /etc/sparrowx
      chmod 700 /etc/sparrowx
      {
        grep -v '^MIRROR_PASSPHRASE=' "${MIRROR_CONF}" 2>/dev/null || true
        echo "MIRROR_PASSPHRASE='${passphrase}'"
      } > "${MIRROR_CONF}.tmp" && mv "${MIRROR_CONF}.tmp" "${MIRROR_CONF}" && chmod 600 "${MIRROR_CONF}"
      log_warn "Generated AES-256 mirror passphrase & saved to ${MIRROR_CONF} (save a copy offline!)."
    fi
    archive_final="${archive_raw}.enc"
    openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
      -in "${archive_raw}" -out "${archive_final}" -pass "pass:${passphrase}"
    chmod 600 "${archive_final}"
    rm -f "${archive_raw}"
    ln -sfn "$(basename "${archive_final}")" "${BACKUP_ROOT}/latest.tar.gz.enc"
    sha256sum "${archive_final}" > "${BACKUP_ROOT}/latest.sha256"
  else
    ln -sfn "$(basename "${archive_final}")" "${BACKUP_ROOT}/latest.tar.gz"
    sha256sum "${archive_final}" > "${BACKUP_ROOT}/latest.sha256"
  fi

  # Prune old snapshots beyond retention limit
  ls -1t "${BACKUP_ROOT}"/sparrowx-mirror-*.tar.gz* 2>/dev/null | tail -n +"$((RETENTION_COUNT + 1))" | xargs -r rm -f || true

  local size_h
  size_h="$(du -h "${archive_final}" | awk '{print $1}')"
  log_ok "Mirror snapshot ready: ${archive_final} (${size_h})"

  # Optional off-server push (private backup git repo or remote SSH/rsync target)
  if [ "${push_flag}" = "true" ] || [ -n "${MIRROR_REMOTE_TARGET:-}" ] || [ -n "${MIRROR_GIT_REMOTE:-}" ]; then
    sync_offsite_mirror "${archive_final}"
  fi
}

sync_offsite_mirror() {
  local archive_path="$1"

  # 1. Optional rsync/scp mirror stream to standby VPS or storage box (e.g. MIRROR_REMOTE_TARGET="root@NEW_IP:/var/backups/sparrowx-mirror/")
  if [ -n "${MIRROR_REMOTE_TARGET:-}" ] && command -v rsync >/dev/null 2>&1; then
    log_info "Syncing mirror archive to remote target ${MIRROR_REMOTE_TARGET}..."
    rsync -az --timeout=60 "${archive_path}" "${BACKUP_ROOT}/latest.sha256" "${MIRROR_REMOTE_TARGET}" >/dev/null 2>&1 \
      && log_ok "Off-site rsync mirror synced." \
      || log_warn "Off-site rsync failed (check SSH key / connectivity)."
  fi

  # 2. Optional encrypted private Git vault push (ONLY allows .enc archives so plaintext secrets NEVER touch Git)
  if [ -n "${MIRROR_GIT_REMOTE:-}" ]; then
    if [[ "${archive_path}" != *.enc ]]; then
      log_warn "Skipping Git vault push: refusing to push unencrypted archive to Git. Enable MIRROR_ENCRYPT=true in ${MIRROR_CONF}."
      return 0
    fi
    local vault_dir="/var/backups/sparrowx-git-vault"
    if [ ! -d "${vault_dir}/.git" ]; then
      git clone --depth=1 "${MIRROR_GIT_REMOTE}" "${vault_dir}" >/dev/null 2>&1 || {
        mkdir -p "${vault_dir}"
        git -C "${vault_dir}" init -b main >/dev/null 2>&1
        git -C "${vault_dir}" remote add origin "${MIRROR_GIT_REMOTE}" >/dev/null 2>&1 || true
      }
    fi
    rm -f "${vault_dir}"/latest.tar.gz.enc* 2>/dev/null || true
    # Split into 45MB GitHub-safe encrypted chunks automatically if larger than 45MB
    split -b 45M -d -a 3 "${archive_path}" "${vault_dir}/latest.tar.gz.enc.part"
    cp -f "${BACKUP_ROOT}/latest.sha256" "${vault_dir}/latest.sha256"
    git -C "${vault_dir}" config user.name "SparrowX Mirror Bot" >/dev/null 2>&1 || true
    git -C "${vault_dir}" config user.email "mirror@sparrowx.net" >/dev/null 2>&1 || true
    git -C "${vault_dir}" add -A >/dev/null 2>&1
    git -C "${vault_dir}" commit -m "chore(mirror): encrypted VPS snapshot $(date -u +%Y-%m-%dT%H:%M:%SZ)" >/dev/null 2>&1 || true
    git -C "${vault_dir}" push -u origin main --force >/dev/null 2>&1 \
      && log_ok "Encrypted mirror pushed to private Git vault." \
      || log_warn "Private Git vault push failed (check token/SSH key)."
  fi
}

# ==============================================================================
# 3. CONTINUOUS CHANGE OBSERVER DAEMON (watch + install-daemon)
# ==============================================================================
compute_state_fingerprint() {
  {
    git -C "${INSTALL_DIR}" rev-parse HEAD 2>/dev/null || true
    for f in \
      "${INSTALL_DIR}/.env" \
      "${INSTALL_DIR}/docker-compose.ovh.yml" \
      "${INSTALL_DIR}/ovh/nginx.conf" \
      /etc/sparrowx/app.env \
      /etc/sparrowx/cf.env \
      /etc/sparrowx/mirror.env \
      /var/www/pterodactyl/.env \
      /var/www/pterodactyl/public/sparrowx/ptero-midnight-theme.css \
      /etc/pterodactyl/config.yml \
      /etc/nginx/sites-available/pterodactyl.conf \
      /opt/sparrowx/xdp/whitelist_ipv4.txt; do
      [ -f "${f}" ] && stat -c '%n:%Y:%s' "${f}" 2>/dev/null || true
    done
    [ -d "/etc/letsencrypt/live" ] && find /etc/letsencrypt/live -maxdepth 3 -printf '%p:%T@\n' 2>/dev/null | sort || true
  } | sha256sum | awk '{print $1}'
}

do_watch() {
  log_info "Starting SparrowX continuous VPS change observer..."
  local last_fp current_fp
  last_fp="$(compute_state_fingerprint)"

  # Always ensure at least one initial snapshot exists on boot
  if [ ! -e "${BACKUP_ROOT}/latest.tar.gz" ] && [ ! -e "${BACKUP_ROOT}/latest.tar.gz.enc" ]; then
    do_pack --auto
  fi

  local watch_paths=()
  for p in \
    "${INSTALL_DIR}/.git" \
    "${INSTALL_DIR}/.env" \
    "${INSTALL_DIR}/docker-compose.ovh.yml" \
    "${INSTALL_DIR}/ovh" \
    /etc/sparrowx \
    /etc/letsencrypt/live \
    /var/www/pterodactyl/.env \
    /var/www/pterodactyl/public/sparrowx \
    /etc/pterodactyl \
    /opt/sparrowx/xdp; do
    [ -e "${p}" ] && watch_paths+=("${p}")
  done

  if command -v inotifywait >/dev/null 2>&1 && [ "${#watch_paths[@]}" -gt 0 ]; then
    log_ok "Using kernel inotifywait observer across ${#watch_paths[@]} paths (15s debounce)."
    while true; do
      inotifywait -q -r -t 300 -e close_write,moved_to,create,delete --exclude '(\.lock|backups/|node_modules/|\.output/)' "${watch_paths[@]}" >/dev/null 2>&1 || true
      # Debounce bursts (e.g. git pull / update.sh)
      sleep 15
      current_fp="$(compute_state_fingerprint)"
      if [ "${current_fp}" != "${last_fp}" ]; then
        last_fp="${current_fp}"
        log_info "Change detected — auto-packing updated VPS mirror..."
        do_pack --auto || log_warn "Auto-pack returned non-zero status; will retry on next change."
      fi
    done
  else
    log_ok "Using lightweight 30s fingerprint observer."
    while true; do
      sleep 30
      current_fp="$(compute_state_fingerprint)"
      if [ "${current_fp}" != "${last_fp}" ]; then
        last_fp="${current_fp}"
        log_info "Change detected — auto-packing updated VPS mirror..."
        do_pack --auto || log_warn "Auto-pack returned non-zero status; will retry on next change."
      fi
    done
  fi
}

do_install_daemon() {
  ensure_base_tools
  mkdir -p "${BACKUP_ROOT}" /etc/sparrowx
  chmod 700 "${BACKUP_ROOT}" /etc/sparrowx
  chmod +x "${SCRIPT_SOURCE}"
  ln -sf "${SCRIPT_SOURCE}" /usr/local/bin/sparrowx-mirror 2>/dev/null || true

  if [ ! -f "${MIRROR_CONF}" ]; then
    cat > "${MIRROR_CONF}" <<'EOF'
# SparrowX VPS Mirror Background Daemon Configuration
# Set MIRROR_ENCRYPT=true to AES-256 encrypt snapshots automatically
MIRROR_ENCRYPT=false
MIRROR_PASSPHRASE=""
MIRROR_RETENTION=7
# Optional: stream snapshots continuously to your new VPS via rsync/SSH:
# MIRROR_REMOTE_TARGET="root@NEW_VPS_IP:/var/backups/sparrowx-mirror/"
# Optional: push AES-256 encrypted snapshots to a PRIVATE GitHub vault repo (requires MIRROR_ENCRYPT=true):
# MIRROR_GIT_REMOTE=""
EOF
    chmod 600 "${MIRROR_CONF}"
  fi

  if [ -d /etc/systemd/system ] && command -v systemctl >/dev/null 2>&1; then
    cat > /etc/systemd/system/sparrowx-mirror-watch.service <<EOF
[Unit]
Description=SparrowX Continuous VPS Mirror Change Observer
After=network-online.target docker.service

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/env bash ${INSTALL_DIR}/mirror.sh watch
Restart=always
RestartSec=10
Nice=15
IOSchedulingClass=idle

[Install]
WantedBy=multi-user.target
EOF

    cat > /etc/systemd/system/sparrowx-mirror-periodic.service <<EOF
[Unit]
Description=SparrowX Periodic Full VPS Mirror Snapshot (DB + Volumes + Configs)
After=network-online.target docker.service

[Service]
Type=oneshot
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/env bash ${INSTALL_DIR}/mirror.sh pack --auto
Nice=15
IOSchedulingClass=idle
EOF

    cat > /etc/systemd/system/sparrowx-mirror-periodic.timer <<'EOF'
[Unit]
Description=Run SparrowX Full VPS Mirror Snapshot every 6 hours

[Timer]
OnBootSec=5min
OnUnitActiveSec=6h
Persistent=true

[Install]
WantedBy=timers.target
EOF

    systemctl daemon-reload
    systemctl enable --now sparrowx-mirror-watch.service
    systemctl enable --now sparrowx-mirror-periodic.timer
    log_ok "Systemd daemons active: sparrowx-mirror-watch.service + sparrowx-mirror-periodic.timer (every 6h)."
  else
    # Non-systemd fallback (Alpine/OpenRC/Container)
    (crontab -l 2>/dev/null | grep -v 'mirror.sh'; echo "0 */6 * * * /usr/bin/env bash ${INSTALL_DIR}/mirror.sh pack --auto >/dev/null 2>&1") | crontab - 2>/dev/null || true
    log_ok "Installed 6-hour cron mirror packer."
  fi

  # Run an immediate full pack so a ready-to-migrate mirror exists right away
  do_pack --auto
  echo ""
  log_ok "CLI installed: run 'sparrowx-mirror status' anytime to inspect your ready mirror."
}

# ==============================================================================
# 4. UNIVERSAL ANY-LINUX-OS 1-COMMAND MIRROR RESTORE (restore)
# ==============================================================================
do_restore() {
  local from_file=""
  local from_vps=""
  local from_git=""
  local passphrase="${MIRROR_PASSPHRASE:-}"
  local auto_yes="false"

  while [ $# -gt 0 ]; do
    case "$1" in
      --from)       shift; from_file="${1:-}" ;;
      --from-vps)   shift; from_vps="${1:-}" ;;
      --from-git)   shift; from_git="${1:-}" ;;
      --passphrase) shift; passphrase="${1:-}" ;;
      --yes|-y)     auto_yes="true" ;;
    esac
    shift || true
  done

  echo -e "${C_CYAN}========================================================================${C_RESET}"
  echo -e "${C_BOLD}  SPARROWX UNIVERSAL VPS MIRROR RESTORE (UBUNTU / DEBIAN / RHEL / ARCH)${C_RESET}"
  echo -e "${C_CYAN}========================================================================${C_RESET}"

  ensure_base_tools
  ensure_swap_guard
  ensure_docker_universal
  open_firewall_universal

  mkdir -p "${BACKUP_ROOT}" /etc/sparrowx
  chmod 700 "${BACKUP_ROOT}" /etc/sparrowx
  ln -sf "${SCRIPT_SOURCE}" /usr/local/bin/sparrowx-mirror 2>/dev/null || true

  # 4A. Acquire Mirror Archive (SSH live pull, private Git vault, or local file)
  if [ -n "${from_vps}" ]; then
    log_info "Packing & streaming live mirror snapshot over SSH from ${from_vps}..."
    ssh -o StrictHostKeyChecking=accept-new "${from_vps}" \
      "cd /opt/sparrowxdbs && sudo ./mirror.sh pack --no-encrypt --auto >/dev/null && cat /var/backups/sparrowx-mirror/latest.tar.gz" \
      > "${BACKUP_ROOT}/pulled-mirror.tar.gz"
    from_file="${BACKUP_ROOT}/pulled-mirror.tar.gz"
    log_ok "Pulled live mirror archive from ${from_vps} ($(du -h "${from_file}" | awk '{print $1}'))."
  elif [ -n "${from_git}" ]; then
    local tmp_vault
    tmp_vault="$(mktemp -d /tmp/sparrowx-vault-pull.XXXXXX)"
    log_info "Pulling encrypted mirror archive from private Git vault..."
    git clone --depth=1 "${from_git}" "${tmp_vault}"
    cat "${tmp_vault}"/latest.tar.gz.enc.part* > "${BACKUP_ROOT}/pulled-vault.tar.gz.enc"
    rm -rf "${tmp_vault}"
    from_file="${BACKUP_ROOT}/pulled-vault.tar.gz.enc"
    log_ok "Reassembled encrypted archive from private Git vault."
  elif [ -z "${from_file}" ]; then
    if [ -e "${BACKUP_ROOT}/latest.tar.gz" ]; then
      from_file="${BACKUP_ROOT}/latest.tar.gz"
    elif [ -e "${BACKUP_ROOT}/latest.tar.gz.enc" ]; then
      from_file="${BACKUP_ROOT}/latest.tar.gz.enc"
    fi
  fi

  local extract_dir=""
  if [ -n "${from_file}" ] && [ -f "${from_file}" ]; then
    extract_dir="$(mktemp -d /tmp/sparrowx-mirror-restore.XXXXXX)"
    trap 'rm -rf "${extract_dir:-}"' RETURN

    local tar_src="${from_file}"
    if [[ "${from_file}" == *.enc ]]; then
      if [ -z "${passphrase}" ] && [ "${auto_yes}" != "true" ]; then
        read -rsp "Enter AES-256 mirror decryption passphrase: " passphrase
        echo ""
      fi
      if [ -z "${passphrase}" ]; then
        log_err "Encrypted archive requires --passphrase <secret> or MIRROR_PASSPHRASE."
        exit 1
      fi
      tar_src="${extract_dir}/decrypted.tar.gz"
      openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
        -in "${from_file}" -out "${tar_src}" -pass "pass:${passphrase}"
    fi

    log_info "Extracting mirror snapshot & verifying integrity..."
    tar -xzf "${tar_src}" -C "${extract_dir}"
    rm -f "${extract_dir}/decrypted.tar.gz" 2>/dev/null || true
    if [ -f "${extract_dir}/SHA256SUMS" ]; then
      (cd "${extract_dir}" && sha256sum -c SHA256SUMS --quiet 2>/dev/null) \
        && log_ok "SHA-256 integrity verification PASSED." \
        || log_warn "Some checksum entries differed; continuing restore."
    fi

    # 4B. Restore Secrets & Environment Files + Auto-Adapt Public IP to New VPS
    local new_ip
    new_ip="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || curl -4 -fsS --max-time 5 https://ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1')"
    [ -d "${extract_dir}/env/etc-sparrowx" ] && cp -a "${extract_dir}/env/etc-sparrowx/." /etc/sparrowx/ && chmod 600 /etc/sparrowx/*.env 2>/dev/null || true
    [ -f "${extract_dir}/env/repo.env" ] && cp -a "${extract_dir}/env/repo.env" "${INSTALL_DIR}/.env" && chmod 600 "${INSTALL_DIR}/.env"
    [ -f "${extract_dir}/env/repo.env.local" ] && cp -a "${extract_dir}/env/repo.env.local" "${INSTALL_DIR}/.env.local"

    if [ -f "${INSTALL_DIR}/.env" ] && [ -n "${new_ip}" ] && [ "${new_ip}" != "127.0.0.1" ]; then
      if grep -q '^SPARROWX_PUBLIC_IP=' "${INSTALL_DIR}/.env"; then
        sed -i "s|^SPARROWX_PUBLIC_IP=.*|SPARROWX_PUBLIC_IP=${new_ip}|" "${INSTALL_DIR}/.env"
      else
        echo "SPARROWX_PUBLIC_IP=${new_ip}" >> "${INSTALL_DIR}/.env"
      fi
    fi
    [ -f "${INSTALL_DIR}/.env" ] && source "${INSTALL_DIR}/.env" 2>/dev/null || true
    [ -f "/etc/sparrowx/app.env" ] && source "/etc/sparrowx/app.env" 2>/dev/null || true
    log_ok "Restored .env & /etc/sparrowx secrets (adapted SPARROWX_PUBLIC_IP=${new_ip})."

    # 4C. Restore SSL, DKIM, Nginx & XDP Whitelist
    [ -f "${extract_dir}/ssl/letsencrypt.tar.gz" ] && tar -xzf "${extract_dir}/ssl/letsencrypt.tar.gz" -C /etc && log_ok "Restored /etc/letsencrypt certificates."
    [ -f "${extract_dir}/ssl/ovh_ssl.tar.gz" ] && mkdir -p "${INSTALL_DIR}/ovh" && tar -xzf "${extract_dir}/ssl/ovh_ssl.tar.gz" -C "${INSTALL_DIR}/ovh"
    [ -f "${extract_dir}/dkim/ovh_dkim.tar.gz" ] && mkdir -p "${INSTALL_DIR}/ovh" && tar -xzf "${extract_dir}/dkim/ovh_dkim.tar.gz" -C "${INSTALL_DIR}/ovh" && log_ok "Restored OpenDKIM mail signing keys."
    [ -f "${extract_dir}/nginx/ovh_nginx.conf" ] && cp -a "${extract_dir}/nginx/ovh_nginx.conf" "${INSTALL_DIR}/ovh/nginx.conf"
    if [ -f "${extract_dir}/xdp/whitelist_ipv4.txt" ]; then
      mkdir -p /opt/sparrowx/xdp
      cp -a "${extract_dir}/xdp/whitelist_ipv4.txt" /opt/sparrowx/xdp/whitelist_ipv4.txt
    fi
    if [ -f "${extract_dir}/companions/gamesec.env" ]; then
      mkdir -p /opt/sparrowx-gamesec
      cp -a "${extract_dir}/companions/gamesec.env" /opt/sparrowx-gamesec/.env
    fi
    if [ -f "${extract_dir}/companions/netsec.env" ]; then
      mkdir -p /opt/sparrowx-netsec
      cp -a "${extract_dir}/companions/netsec.env" /opt/sparrowx-netsec/.env
    fi

    # 4D. Restore Docker Volume (sparrowx_appdata) & Repo Data
    if [ -f "${extract_dir}/docker-volumes/repo_data.tar.gz" ]; then
      tar -xzf "${extract_dir}/docker-volumes/repo_data.tar.gz" -C "${INSTALL_DIR}"
    fi
    if [ -f "${extract_dir}/docker-volumes/sparrowx_appdata.tar.gz" ]; then
      local proj_name
      proj_name="$(basename "${INSTALL_DIR}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]//g')"
      docker volume create "${proj_name}_sparrowx_appdata" >/dev/null 2>&1 || true
      docker run --rm -v "${proj_name}_sparrowx_appdata:/dst" -v "${extract_dir}/docker-volumes:/src:ro" alpine:3.20 \
        sh -c 'tar -xzf /src/sparrowx_appdata.tar.gz -C /dst' >/dev/null 2>&1 && log_ok "Restored sparrowx_appdata volume." || true
    fi

    # 4E. Boot PostgreSQL First & Restore Complete PostgreSQL Cluster
    cd "${INSTALL_DIR}"
    log_info "Starting PostgreSQL container & restoring full database cluster..."
    compose_cmd -f docker-compose.ovh.yml up -d --no-build postgres
    local pg_ready="false"
    for _i in $(seq 1 30); do
      if docker exec sparrowx-postgres pg_isready -U "${POSTGRES_USER:-sparrowx}" >/dev/null 2>&1; then
        pg_ready="true"
        break
      fi
      sleep 2
    done
    if [ "${pg_ready}" = "true" ] && [ -f "${extract_dir}/db/postgres/cluster_dumpall.sql.gz" ]; then
      gunzip -c "${extract_dir}/db/postgres/cluster_dumpall.sql.gz" \
        | docker exec -i -e PGPASSWORD="${POSTGRES_PASSWORD:-}" sparrowx-postgres psql -U "${POSTGRES_USER:-sparrowx}" -d postgres >/dev/null 2>&1 \
        && log_ok "PostgreSQL full cluster restored!" \
        || log_warn "PostgreSQL restore had non-fatal warnings (existing roles/objects)."
    fi

    # 4F. Restore Pterodactyl Panel + Stellar Theme + MariaDB (if included in mirror)
    if [ -f "${extract_dir}/pterodactyl/pterodactyl_full.tar.gz" ]; then
      log_info "Restoring Pterodactyl Panel + Stellar Theme + MariaDB..."
      case "${PKG_MGR}" in
        apt)
          pkg_install nginx mariadb-server redis-server php-fpm php-cli php-mysql php-xml php-mbstring php-curl php-zip php-gd php-bcmath
          ;;
        dnf|yum)
          pkg_install nginx mariadb-server redis php-fpm php-cli php-mysqlnd php-xml php-mbstring php-json php-gd php-bcmath
          ;;
        pacman)
          pkg_install nginx mariadb redis php-fpm php php-gd
          ;;
        zypper)
          pkg_install nginx mariadb redis php8-fpm php8-mysql php8-mbstring php8-curl php8-zip php8-gd php8-bcmath
          ;;
      esac
      systemctl enable --now mariadb redis-server redis >/dev/null 2>&1 || true
      mkdir -p /var/www
      tar -xzf "${extract_dir}/pterodactyl/pterodactyl_full.tar.gz" -C /var/www
      [ -f "${extract_dir}/pterodactyl/panel.env" ] && cp -a "${extract_dir}/pterodactyl/panel.env" /var/www/pterodactyl/.env
      if [ -f "${extract_dir}/db/mariadb/all_databases.sql.gz" ]; then
        gunzip -c "${extract_dir}/db/mariadb/all_databases.sql.gz" | mysql 2>/dev/null \
          && log_ok "MariaDB/Pterodactyl databases restored." \
          || log_warn "MariaDB restore had warnings (verify root auth)."
      fi
      if [ -f "${extract_dir}/nginx/pterodactyl.conf" ] && [ -d /etc/nginx/sites-available ]; then
        cp -a "${extract_dir}/nginx/pterodactyl.conf" /etc/nginx/sites-available/pterodactyl.conf
        ln -sf /etc/nginx/sites-available/pterodactyl.conf /etc/nginx/sites-enabled/pterodactyl.conf
        rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
        nginx -t >/dev/null 2>&1 && systemctl enable --now nginx >/dev/null 2>&1 || true
      fi
      if [ -f "${extract_dir}/pterodactyl/wings_config.yml" ]; then
        mkdir -p /etc/pterodactyl
        cp -a "${extract_dir}/pterodactyl/wings_config.yml" /etc/pterodactyl/config.yml
      fi
      chown -R www-data:www-data /var/www/pterodactyl 2>/dev/null || chown -R nginx:nginx /var/www/pterodactyl 2>/dev/null || true
      log_ok "Pterodactyl Panel + Stellar Theme restored."
    fi
  else
    log_warn "No snapshot archive supplied — provisioning fresh universal SparrowX mirror from GitHub repo."
  fi

  # 4G. Build & Launch Full SparrowX Docker Stack (Works on Every Linux Distro!)
  cd "${INSTALL_DIR}"
  log_info "Building & launching full SparrowX Docker stack..."
  compose_cmd -f docker-compose.ovh.yml build sparrowx
  compose_cmd -f docker-compose.ovh.yml up -d --no-build --remove-orphans

  # Run OVH auto-healer if on Debian/Ubuntu, or verify directly on RHEL/Fedora/Arch/openSUSE
  if [ "${PKG_MGR}" = "apt" ] && [ -x "${INSTALL_DIR}/update.sh" ]; then
    log_info "Finalizing multi-domain Nginx, SSL timers & watchdogs via update.sh..."
    bash "${INSTALL_DIR}/update.sh" --auto || true
  fi

  # Enable continuous mirror daemon on the new VPS too!
  do_install_daemon

  local final_ip health_code
  final_ip="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo 'unknown')"
  health_code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 6 "http://127.0.0.1:${APP_HOST_PORT:-3000}/api/v1/health" 2>/dev/null || echo '000')"

  echo ""
  echo -e "${C_GREEN}========================================================================${C_RESET}"
  echo -e "${C_BOLD}  SPARROWX MIRROR VPS IS LIVE! (${OS_ID} ${OS_VERSION})${C_RESET}"
  echo -e "${C_GREEN}========================================================================${C_RESET}"
  echo "  New VPS Public IP : ${final_ip}"
  echo "  App Health Check  : HTTP ${health_code}"
  echo "  Mirror Daemon     : ACTIVE (auto-packing on changes + every 6h)"
  echo ""
  echo "  Final Cutover Step: Point your DNS A-records to ${final_ip}"
  if [ -f "/etc/sparrowx/cf.env" ] && [ -x "${INSTALL_DIR}/deploy/cf-dns-sync.sh" ]; then
    echo "  (1-Command Cloudflare DNS cutover: sudo bash ${INSTALL_DIR}/deploy/cf-dns-sync.sh)"
  fi
  echo -e "${C_GREEN}========================================================================${C_RESET}"
}

# ==============================================================================
# 5. STATUS CHECK
# ==============================================================================
do_status() {
  detect_os
  echo -e "${C_CYAN}=== SparrowX Universal VPS Mirror Status ===${C_RESET}"
  echo "  OS Detected      : ${OS_ID} ${OS_VERSION} (${PKG_MGR})"
  echo "  Install Dir      : ${INSTALL_DIR}"
  echo "  Backup Vault Dir : ${BACKUP_ROOT}"
  if command -v systemctl >/dev/null 2>&1; then
    echo "  Live Watcher     : $(systemctl is-active sparrowx-mirror-watch.service 2>/dev/null || echo inactive)"
    echo "  6h Backup Timer  : $(systemctl is-active sparrowx-mirror-periodic.timer 2>/dev/null || echo inactive)"
  fi
  if [ -L "${BACKUP_ROOT}/latest.tar.gz.enc" ]; then
    echo "  Latest Snapshot  : $(readlink -f "${BACKUP_ROOT}/latest.tar.gz.enc") ($(du -h "$(readlink -f "${BACKUP_ROOT}/latest.tar.gz.enc")" | awk '{print $1}') — AES-256 encrypted)"
  elif [ -L "${BACKUP_ROOT}/latest.tar.gz" ]; then
    echo "  Latest Snapshot  : $(readlink -f "${BACKUP_ROOT}/latest.tar.gz") ($(du -h "$(readlink -f "${BACKUP_ROOT}/latest.tar.gz")" | awk '{print $1}'))"
  else
    echo "  Latest Snapshot  : None yet (run: sudo ./mirror.sh install-daemon)"
  fi
  echo "  Snapshots Stored : $(ls -1 "${BACKUP_ROOT}"/sparrowx-mirror-*.tar.gz* 2>/dev/null | wc -l | tr -d ' ')"
}

# ==============================================================================
# ENTRYPOINT
# ==============================================================================
CMD="${1:-help}"
shift || true

case "${CMD}" in
  pack)           require_root pack "$@"; do_pack "$@" ;;
  watch)          require_root watch "$@"; do_watch ;;
  install-daemon) require_root install-daemon "$@"; do_install_daemon ;;
  restore)        require_root restore "$@"; do_restore "$@" ;;
  status)         do_status ;;
  help|--help|-h)
    sed -n '2,22p' "${SCRIPT_SOURCE}" | sed 's/^# \{0,1\}//'
    ;;
  *)
    log_err "Unknown command: ${CMD}. Run './mirror.sh --help'."
    exit 1
    ;;
esac
