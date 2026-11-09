#!/usr/bin/env bash
# ==============================================================================
# SPARROWX ONE-CLICK BACKUP & EXPORT SCRIPT
# Creates a self-contained compressed archive for instant migration to any VPS
# ==============================================================================

set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/tmp/sparrowx_backup_${TIMESTAMP}"
ARCHIVE_NAME="sparrowx_migration_${TIMESTAMP}.tar.gz"
TARGET_OUTPUT="${PWD}/${ARCHIVE_NAME}"

echo "=========================================================="
echo "  SPARROWX DUAL-PLATFORM: ONE-CLICK EXPORT UTILITY"
echo "=========================================================="
echo "-> Creating staging directory: ${BACKUP_DIR}..."
mkdir -p "${BACKUP_DIR}/data"
mkdir -p "${BACKUP_DIR}/config"

# 1. Export PostgreSQL Dump (if container is running)
if docker ps --format '{{.Names}}' | grep -q "sparrowx_postgres"; then
    echo "-> Dumping active PostgreSQL schemas, roles, and pgvector tables..."
    docker exec -t sparrowx_postgres pg_dumpall -U postgres > "${BACKUP_DIR}/data/postgres_dumpall.sql"
    echo "   [✓] PostgreSQL dump completed."
else
    echo "-> [!] sparrowx_postgres is not running. Backing up local init-scripts instead."
    if [ -d "./init-scripts" ]; then
        cp -r ./init-scripts "${BACKUP_DIR}/data/"
    fi
fi

# 2. Copy Configurations and Compose Definitions
echo "-> Archiving platform configs and orchestration files..."
cp -r docker-compose.sparrowx.yml "${BACKUP_DIR}/"
[ -f "Caddyfile" ] && cp Caddyfile "${BACKUP_DIR}/config/"
[ -f "nginx.conf" ] && cp nginx.conf "${BACKUP_DIR}/config/"
[ -f ".env" ] && cp .env "${BACKUP_DIR}/config/"
[ -d "deploy" ] && cp -r deploy "${BACKUP_DIR}/"

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
