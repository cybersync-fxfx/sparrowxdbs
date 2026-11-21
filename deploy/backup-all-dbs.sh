#!/usr/bin/env bash
# ==============================================================================
# SPARROWX MULTI-DATABASE AUTOMATED BACKUP ENGINE
# Backs up active sovereign OVH PostgreSQL DBs and multi-DB clusters
# ==============================================================================
set -u

INSTALL_DIR="/opt/sparrowxdbs"
for dir in "$(pwd)" "/opt/sparrowxdbs" "/opt/sparrowx"; do
  if [ -f "${dir}/docker-compose.ovh.yml" ] || [ -f "${dir}/docker-compose.standalone.yml" ]; then
    INSTALL_DIR="${dir}"
    break
  fi
done
cd "${INSTALL_DIR}" 2>/dev/null || exit 0

[ -f "${INSTALL_DIR}/.env" ] && source "${INSTALL_DIR}/.env" 2>/dev/null || true

BACKUP_ROOT="${INSTALL_DIR}/backups"
STAMP="$(date +%Y%m%d_%H%M%S)"
DAY_DIR="${BACKUP_ROOT}/$(date +%Y-%m-%d)"
mkdir -p "${DAY_DIR}"

if docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-postgres"; then
  PG_CTR="sparrowx-postgres"
  PG_USER="${POSTGRES_USER:-sparrowx}"
  PG_MAIN_DB="${POSTGRES_DB:-sparrowx_db}"
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx_postgres"; then
  PG_CTR="sparrowx_postgres"
  PG_USER="${POSTGRES_USER:-postgres}"
  PG_MAIN_DB="${POSTGRES_DB:-sparrowbase}"
else
  PG_CTR=""
fi

if [ -n "${PG_CTR}" ]; then
  DATABASES=("${PG_MAIN_DB}" "sparrowbase" "sparrowx_db_studio" "sparrowx_shield" "sparrowx_files" "sparrowx_api")
  for db in "${DATABASES[@]}"; do
    exists="$(docker exec -e PGPASSWORD="${POSTGRES_PASSWORD:-}" "${PG_CTR}" psql -U "${PG_USER}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${db}'" 2>/dev/null | tr -d '[:space:]' || true)"
    [ "${exists}" = "1" ] || continue
    OUT_FILE="${DAY_DIR}/${db}_${STAMP}.sql.gz"
    if docker exec -e PGPASSWORD="${POSTGRES_PASSWORD:-}" "${PG_CTR}" pg_dump -U "${PG_USER}" -d "${db}" --no-owner --no-acl 2>/dev/null | gzip -9 > "${OUT_FILE}"; then
      chmod 600 "${OUT_FILE}"
    else
      rm -f "${OUT_FILE}" 2>/dev/null || true
    fi
  done
fi

# Retain backups for 14 days
find "${BACKUP_ROOT}" -maxdepth 1 -type d -mtime +14 -exec rm -rf {} + 2>/dev/null || true
