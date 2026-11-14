#!/usr/bin/env bash
# ==============================================================================
# SPARROWX MULTI-DATABASE AUTOMATED BACKUP ENGINE
# Backs up all 5 isolated databases (Auth Hub, DB Studio, Shield, Files, API)
# ==============================================================================
set -u

INSTALL_DIR="/opt/sparrowx"
[ -f "./docker-compose.standalone.yml" ] && INSTALL_DIR="$(pwd)"
cd "${INSTALL_DIR}" 2>/dev/null || exit 0

[ -f "${INSTALL_DIR}/.env" ] && source "${INSTALL_DIR}/.env" 2>/dev/null || true

PG_USER="${POSTGRES_USER:-postgres}"
BACKUP_ROOT="${INSTALL_DIR}/backups"
STAMP="$(date +%Y%m%d_%H%M%S)"
DAY_DIR="${BACKUP_ROOT}/$(date +%Y-%m-%d)"
mkdir -p "${DAY_DIR}"

DATABASES=("sparrowbase" "sparrowx_db_studio" "sparrowx_shield" "sparrowx_files" "sparrowx_api")

if docker ps --format '{{.Names}}' | grep -qx "sparrowx_postgres"; then
  for db in "${DATABASES[@]}"; do
    OUT_FILE="${DAY_DIR}/${db}_${STAMP}.sql.gz"
    if docker exec sparrowx_postgres pg_dump -U "${PG_USER}" -d "${db}" --no-owner --no-acl 2>/dev/null | gzip -9 > "${OUT_FILE}"; then
      chmod 600 "${OUT_FILE}"
    else
      rm -f "${OUT_FILE}" 2>/dev/null || true
    fi
  done
fi

# Retain backups for 14 days
find "${BACKUP_ROOT}" -maxdepth 1 -type d -mtime +14 -exec rm -rf {} + 2>/dev/null || true
