#!/usr/bin/env bash
# ==============================================================================
# SPARROWX ONE-CLICK BACKUP & EXPORT SCRIPT
# Creates a self-contained compressed archive for instant migration to any VPS
# ==============================================================================

set -euo pipefail

# Dynamically resolve root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${PWD}/docker-compose.sparrowx.yml" ]; then
    ROOT_DIR="${PWD}"
elif [ -f "${SCRIPT_DIR}/../docker-compose.sparrowx.yml" ]; then
    ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
elif [ -f "${SCRIPT_DIR}/docker-compose.sparrowx.yml" ]; then
    ROOT_DIR="${SCRIPT_DIR}"
else
    ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
fi

cd "${ROOT_DIR}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/tmp/sparrowx_backup_${TIMESTAMP}"
ARCHIVE_NAME="sparrowx_migration_${TIMESTAMP}.tar.gz"
TARGET_OUTPUT="${ROOT_DIR}/${ARCHIVE_NAME}"

echo "=========================================================="
echo "  SPARROWX DUAL-PLATFORM: ONE-CLICK EXPORT UTILITY"
echo "=========================================================="
echo "-> Project Root: ${ROOT_DIR}"
echo "-> Creating staging directory: ${BACKUP_DIR}..."
mkdir -p "${BACKUP_DIR}/data"
mkdir -p "${BACKUP_DIR}/config"

# 1. Export PostgreSQL Dump (if container is running)
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "sparrowx_postgres"; then
    echo "-> Dumping active PostgreSQL schemas, roles, and pgvector tables..."
    docker exec -t sparrowx_postgres pg_dumpall -U postgres > "${BACKUP_DIR}/data/postgres_dumpall.sql"
    echo "   [✓] PostgreSQL dump completed."
else
    echo "-> [!] sparrowx_postgres is not running. Backing up local data directory if present."
    if [ -d "./init-scripts" ]; then
        cp -r ./init-scripts "${BACKUP_DIR}/data/"
    fi
    if [ -d "./data" ]; then
        cp -r ./data "${BACKUP_DIR}/data/"
    fi
fi

# 2. Copy Configurations, Source & Compose Definitions
echo "-> Archiving platform configs and orchestration files..."
[ -f "docker-compose.sparrowx.yml" ] && cp docker-compose.sparrowx.yml "${BACKUP_DIR}/"
[ -f "Dockerfile" ] && cp Dockerfile "${BACKUP_DIR}/"
[ -f "package.json" ] && cp package.json "${BACKUP_DIR}/"
[ -f "package-lock.json" ] && cp package-lock.json "${BACKUP_DIR}/"
[ -f "Caddyfile" ] && cp Caddyfile "${BACKUP_DIR}/"
[ -f "nginx.conf" ] && cp nginx.conf "${BACKUP_DIR}/"
[ -f ".env" ] && cp .env "${BACKUP_DIR}/"
[ -d "deploy" ] && cp -r deploy "${BACKUP_DIR}/"
[ -d "ovh" ] && cp -r ovh "${BACKUP_DIR}/"
[ -d "src" ] && cp -r src "${BACKUP_DIR}/"
[ -d "public" ] && cp -r public "${BACKUP_DIR}/"

# Write Migration Manifest
cat <<EOF > "${BACKUP_DIR}/MANIFEST.json"
{
  "platform": "SparrowX Dual-Engine (Security + SparrowX DB)",
  "export_timestamp": "${TIMESTAMP}",
  "archived_by": "${USER:-root}",
  "version": "2.0.0"
}
EOF

# 3. Create Compressed Archive
echo "-> Compressing into ${TARGET_OUTPUT}..."
tar -czf "${TARGET_OUTPUT}" -C "/tmp" "sparrowx_backup_${TIMESTAMP}"

# Clean up staging directory
rm -rf "${BACKUP_DIR}"

# 4. Success Verification & Next Step Instructions
FILESIZE=$(du -h "${TARGET_OUTPUT}" | cut -f1)
echo "=========================================================="
echo "  [SUCCESS] SPARROWX BACKUP ARCHIVE CREATED!"
echo "=========================================================="
echo "  Archive Path: ${TARGET_OUTPUT}"
echo "  Archive Size: ${FILESIZE}"
echo ""
echo "-> TO MIGRATE TO YOUR NEW VPS:"
echo "1. Transfer this archive to the new VPS:"
echo "   scp ${ARCHIVE_NAME} root@NEW_VPS_IP:/root/"
echo ""
echo "2. SSH into your new VPS and execute:"
echo "   tar -xzf ${ARCHIVE_NAME}"
echo "   cd sparrowx_backup_${TIMESTAMP}"
echo "   chmod +x deploy/restore-import.sh"
echo "   ./deploy/restore-import.sh"
echo "=========================================================="
