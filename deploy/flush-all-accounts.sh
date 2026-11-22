#!/usr/bin/env bash
# ==============================================================================
#  SPARROWX CLEAN-SLATE FLUSH: WIPE ALL ACCOUNTS, SESSIONS & STALE DATA
# ==============================================================================
#  Run on your OVH / Ubuntu VPS as root to flush all accounts & user data
#  across ALL SparrowX services (Master Portal, Cloud DB, Shield, Drop, Game,
#  Infra, and NetSec) and restart clean:
#
#      sudo bash /opt/sparrowx/deploy/flush-all-accounts.sh --yes
# ==============================================================================
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/sparrowx}"
NETSEC_DIR="${NETSEC_DIR:-/opt/sparrowx-netsec}"
CONFIRM="${1:-}"

if [ "${CONFIRM}" != "--yes" ] && [ "${CONFIRM}" != "-y" ]; then
  echo "========================================================================"
  echo "  WARNING: THIS WILL PERMANENTLY FLUSH ALL ACCOUNTS & USER DATA ACROSS:"
  echo "  - SparrowX Master Portal & Shield (app_users, client_tenants, incidents)"
  echo "  - SparrowX Cloud DB (provisioned_databases, backups, audit logs)"
  echo "  - SparrowX Game Hosting (clients, subscriptions, transactions)"
  echo "  - SparrowX NetSec (user_profiles, sbs_users, threat_radar)"
  echo "  - Local JSON stores, uploaded drop files, and Redis sessions"
  echo "========================================================================"
  read -r -p "Type FLUSH to confirm complete clean-slate reset: " ANSWER
  if [ "${ANSWER}" != "FLUSH" ]; then
    echo "Aborted. No data was modified."
    exit 1
  fi
fi

if [ -f "${INSTALL_DIR}/.env" ]; then
  # shellcheck disable=SC1090
  source "${INSTALL_DIR}/.env" 2>/dev/null || true
fi

PG_USER="${POSTGRES_USER:-sparrowx}"
PG_DB="${POSTGRES_DB:-sparrowx_db}"

echo "[1/5] Truncating all PostgreSQL account, session, and service tables (${PG_DB})..."
SQL_FLUSH="$(cat <<'EOF_SQL'
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'public.app_users',
    'public.client_tenants',
    'public.clients',
    'public.subscriptions',
    'public.transactions',
    'public.user_profiles',
    'public.sbs_users',
    'public.email_verification_codes',
    'public.provisioned_databases',
    'public.provisioned_db_backups',
    'public.provisioned_db_audit_logs',
    'public.incidents',
    'public.threat_indicators',
    'public.assets',
    'public.vulnerabilities',
    'public.protected_services',
    'public.audit_logs',
    'public.billing_credits',
    'public.threat_radar',
    'public.reports',
    'public.team_members',
    'public.integrations'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF to_regclass(tbl) IS NOT NULL THEN
      EXECUTE format('TRUNCATE TABLE %s RESTART IDENTITY CASCADE', tbl);
      RAISE NOTICE 'Flushed %', tbl;
    END IF;
  END LOOP;
END $$;
EOF_SQL
)"

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-postgres"; then
  docker exec -i -u postgres sparrowx-postgres psql -U "${PG_USER}" -d "${PG_DB}" <<< "${SQL_FLUSH}" || \
    docker exec -i -u postgres sparrowx-postgres psql -d "${PG_DB}" <<< "${SQL_FLUSH}"
  echo "  -> PostgreSQL tables flushed cleanly."
elif command -v psql >/dev/null 2>&1; then
  psql -U "${PG_USER}" -d "${PG_DB}" <<< "${SQL_FLUSH}"
  echo "  -> Local PostgreSQL tables flushed cleanly."
else
  echo "  -> [WARN] sparrowx-postgres container not running; skipped SQL truncate."
fi

echo "[2/5] Clearing local JSON state stores & uploaded drop files..."
rm -rf "${INSTALL_DIR}/data/sparrowx-ovh-db.json" \
       "${INSTALL_DIR}/data/client-vps-registry.json" \
       "${INSTALL_DIR}/data/users" \
       "${INSTALL_DIR}/data/storage" 2>/dev/null || true

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-app"; then
  docker exec sparrowx-app sh -c 'rm -rf /app/data/sparrowx-ovh-db.json /app/data/client-vps-registry.json /app/data/users /app/data/storage' 2>/dev/null || true
  echo "  -> Cleared /app/data inside sparrowx-app."
fi

echo "[3/5] Flushing Redis sessions & rate-limit caches..."
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "sparrowx-redis"; then
  docker exec sparrowx-redis redis-cli FLUSHALL >/dev/null 2>&1 || true
  echo "  -> Flushed sparrowx-redis."
elif command -v redis-cli >/dev/null 2>&1; then
  redis-cli FLUSHALL >/dev/null 2>&1 || true
  echo "  -> Flushed host Redis."
fi

echo "[4/5] Synchronizing SPARROWX_MASTER_SSO_SECRET across Master Portal & NetSec..."
SHARED_SSO="${SPARROWX_MASTER_SSO_SECRET:-${SPARROWX_JWT_SECRET:-}}"
if [ -n "${SHARED_SSO}" ] && [ -f "${NETSEC_DIR}/.env" ]; then
  if grep -q '^SPARROWX_MASTER_SSO_SECRET=' "${NETSEC_DIR}/.env"; then
    sed -i -E "s|^SPARROWX_MASTER_SSO_SECRET=.*|SPARROWX_MASTER_SSO_SECRET=${SHARED_SSO}|" "${NETSEC_DIR}/.env"
  else
    echo "SPARROWX_MASTER_SSO_SECRET=${SHARED_SSO}" >> "${NETSEC_DIR}/.env"
  fi
  echo "  -> Synced SPARROWX_MASTER_SSO_SECRET into ${NETSEC_DIR}/.env."
fi

echo "[5/5] Restarting SparrowX services for a 100% clean boot..."
if command -v docker >/dev/null 2>&1; then
  docker restart sparrowx-app >/dev/null 2>&1 || true
  docker restart sparrowx-netsec >/dev/null 2>&1 || true
  docker restart sparrowx-postgrest >/dev/null 2>&1 || true
fi

echo "========================================================================"
echo "  CLEAN-SLATE FLUSH COMPLETE!"
echo "  All accounts, sessions, tenants, and stale data have been wiped."
echo "  Your next 'Continue with Google' login starts 100% fresh as new."
echo "========================================================================"
