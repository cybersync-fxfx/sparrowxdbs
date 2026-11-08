#!/usr/bin/env bash
# ============================================================================
# SPARROWX SUPABASE-STYLE TERMINAL DATABASE MANAGEMENT SYSTEM (TUI + CLI)
# ============================================================================
# Mirrors the Supabase Studio experience directly in your OVH Ubuntu terminal:
#  • Switch between all 13 tables & inspect live row counts
#  • View, filter, insert, edit, and delete rows via PostgREST / PostgreSQL
#  • Manage isolated per-user folders (/opt/sparrowx/data/users/<username>/)
#  • 1-Click Cloud Supabase -> Local OVH Database shift
#  • Interactive SQL prompt, backups, and restores
# ============================================================================
set -u

INSTALL_DIR="/opt/sparrowx"
[ ! -d "${INSTALL_DIR}" ] && INSTALL_DIR="$(pwd)"
DATA_DIR="${INSTALL_DIR}/data"
USERS_DIR="${DATA_DIR}/users"
BACKUP_DIR="${DATA_DIR}/backups"

if [ -f "${INSTALL_DIR}/.env" ]; then
  # shellcheck disable=SC1090
  source "${INSTALL_DIR}/.env" 2>/dev/null || true
fi

PGRST_PORT="${PGRST_HOST_PORT:-3001}"
APP_PORT="${APP_HOST_PORT:-3000}"
PG_USER="${POSTGRES_USER:-sparrowx}"
PG_DB="${POSTGRES_DB:-sparrowx_db}"
REST_URL="http://127.0.0.1:${PGRST_PORT}"

# If PostgREST container port isn't responding directly, use app server's /rest/v1
if ! curl -fsS "${REST_URL}/" >/dev/null 2>&1; then
  REST_URL="http://127.0.0.1:${APP_PORT}/rest/v1"
fi

C_RESET="\033[0m"
C_BOLD="\033[1m"
C_EMERALD="\033[1;32m"
C_CYAN="\033[1;36m"
C_YELLOW="\033[1;33m"
C_RED="\033[1;31m"
C_DIM="\033[2m"

TABLES=(
  "app_users"
  "client_tenants"
  "protected_services"
  "incidents"
  "assets"
  "threat_indicators"
  "vulnerabilities"
  "verification_proofs"
  "billing_transactions"
  "audit_logs"
  "reports"
  "team_members"
  "integrations"
)

CURRENT_TABLE="app_users"

mkdir -p "${USERS_DIR}" "${BACKUP_DIR}" 2>/dev/null || true

count_table_rows() {
  local tbl="$1"
  local url="${REST_URL}/${tbl}?select=*"
  local resp
  resp="$(curl -fsS "${url}" 2>/dev/null || echo "[]")"
  if command -v node >/dev/null 2>&1; then
    node -e "try{const d=JSON.parse(process.argv[1]);console.log(Array.isArray(d)?d.length:0)}catch{console.log(0)}" "${resp}" 2>/dev/null || echo "0"
  else
    echo "${resp}" | grep -o '"id"' | wc -l | tr -d ' '
  fi
}

provision_user_folder() {
  local uname
  uname="$(echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/@.*//; s/[^a-z0-9_-]/_/g')"
  [ -z "${uname}" ] && uname="default_user"
  local udir="${USERS_DIR}/${uname}"
  mkdir -p "${udir}"
  [ ! -f "${udir}/profile.json" ] && echo "{\"username\":\"${uname}\",\"createdAt\":\"$(date -Iseconds)\"}" > "${udir}/profile.json"
  [ ! -f "${udir}/vulnerabilities.json" ] && echo "[]" > "${udir}/vulnerabilities.json"
  [ ! -f "${udir}/blocked_data.json" ] && echo "[]" > "${udir}/blocked_data.json"
  [ ! -f "${udir}/incidents.json" ] && echo "[]" > "${udir}/incidents.json"
  [ ! -f "${udir}/services.json" ] && echo "[]" > "${udir}/services.json"
  [ ! -f "${udir}/database.sql" ] && echo "-- Dedicated User Schema: ${uname}\nCREATE SCHEMA IF NOT EXISTS user_${uname};" > "${udir}/database.sql"
  echo -e "${C_EMERALD}[OK]${C_RESET} Dedicated user database folder ready: ${C_BOLD}${udir}/${C_RESET}"
}

sync_cloud_to_local() {
  echo -e "${C_CYAN}[SYNC]${C_RESET} Shifting Cloud Supabase records & creating per-user database folders..."
  if command -v node >/dev/null 2>&1 && [ -f "${INSTALL_DIR}/ovh/migrate-from-supabase.mjs" ]; then
    SPARROWX_DATA_DIR="${DATA_DIR}" POSTGREST_INTERNAL_URL="http://127.0.0.1:${PGRST_PORT}" \
      node "${INSTALL_DIR}/ovh/migrate-from-supabase.mjs"
  elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q "sparrowx-app"; then
    docker exec sparrowx-app node /app/ovh/migrate-from-supabase.mjs || true
  fi
  echo -e "${C_EMERALD}[OK]${C_RESET} Cloud -> Local OVH Database shift complete."
}

# Support direct CLI subcommands
if [ "${1:-}" = "sync" ] || [ "${1:-}" = "migrate-db" ]; then
  sync_cloud_to_local
  exit 0
elif [ "${1:-}" = "create-user-db" ] && [ -n "${2:-}" ]; then
  provision_user_folder "$2"
  exit 0
elif [ "${1:-}" = "status" ]; then
  echo -e "${C_EMERALD}=== SPARROWX SOVEREIGN DATABASE STATUS ===${C_RESET}"
  for t in "${TABLES[@]}"; do
    printf "  • %-24s : %s rows\n" "${t}" "$(count_table_rows "${t}")"
  done
  echo -e "  • Per-User DB Folders      : $(find "${USERS_DIR}" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l) folders in ${USERS_DIR}"
  exit 0
fi

# Interactive Terminal Supabase Studio Loop
while true; do
  echo ""
  echo -e "${C_EMERALD}========================================================================${C_RESET}"
  echo -e "${C_BOLD}  ⚡ SPARROWX SUPABASE STUDIO — TERMINAL DATABASE MANAGER (OVH LOCAL)  ${C_RESET}"
  echo -e "${C_EMERALD}========================================================================${C_RESET}"
  echo -e "  Active Table : ${C_BOLD}${C_EMERALD}public.${CURRENT_TABLE}${C_RESET} ($(count_table_rows "${CURRENT_TABLE}") rows)"
  echo -e "  REST Engine  : ${C_CYAN}${REST_URL}${C_RESET}"
  echo -e "  User DB Root : ${C_CYAN}${USERS_DIR}/<username>/${C_RESET}"
  echo -e "  Web Studio   : ${C_YELLOW}https://${SPARROWX_STUDIO_DOMAIN:-db.${SPARROWX_DOMAIN:-localhost}} (or /?studio=1)${C_RESET}"
  echo -e "${C_EMERALD}------------------------------------------------------------------------${C_RESET}"
  echo -e "  ${C_BOLD}[1]${C_RESET} Switch Table (View all 13 tables & row counts)"
  echo -e "  ${C_BOLD}[2]${C_RESET} View Rows in ${C_EMERALD}public.${CURRENT_TABLE}${C_RESET}"
  echo -e "  ${C_BOLD}[3]${C_RESET} Insert / Update Row (JSON) in ${C_EMERALD}public.${CURRENT_TABLE}${C_RESET}"
  echo -e "  ${C_BOLD}[4]${C_RESET} Delete Row by ID/Email from ${C_EMERALD}public.${CURRENT_TABLE}${C_RESET}"
  echo -e "  ${C_BOLD}[5]${C_RESET} Per-User Isolated Databases (${C_CYAN}${USERS_DIR}/<username>/${C_RESET})"
  echo -e "  ${C_BOLD}[6]${C_RESET} Shift / Sync Cloud Supabase -> Local OVH Database"
  echo -e "  ${C_BOLD}[7]${C_RESET} Open Interactive PostgreSQL SQL Shell (psql)"
  echo -e "  ${C_BOLD}[8]${C_RESET} Backup Entire Local Database to ${BACKUP_DIR}"
  echo -e "  ${C_BOLD}[0]${C_RESET} Exit Terminal Studio"
  echo -e "${C_EMERALD}------------------------------------------------------------------------${C_RESET}"
  read -r -p "Select option [0-8]: " OPT </dev/tty || exit 0

  case "${OPT}" in
    1)
      echo ""
      echo -e "${C_BOLD}Available Tables in schema 'public':${C_RESET}"
      idx=1
      for t in "${TABLES[@]}"; do
        printf "  [%2d] %-24s (%s rows)\n" "${idx}" "${t}" "$(count_table_rows "${t}")"
        idx=$((idx + 1))
      done
      read -r -p "Enter table number [1-${#TABLES[@]}]: " TNUM </dev/tty || true
      if [[ "${TNUM}" =~ ^[0-9]+$ ]] && [ "${TNUM}" -ge 1 ] && [ "${TNUM}" -le "${#TABLES[@]}" ]; then
        CURRENT_TABLE="${TABLES[$((TNUM - 1))]}"
        echo -e "${C_EMERALD}[OK] Switched active table to public.${CURRENT_TABLE}${C_RESET}"
      fi
      ;;
    2)
      echo ""
      echo -e "${C_CYAN}Fetching rows from public.${CURRENT_TABLE}...${C_RESET}"
      RAW="$(curl -fsS "${REST_URL}/${CURRENT_TABLE}?select=*&limit=25" 2>/dev/null || echo "[]")"
      if command -v node >/dev/null 2>&1; then
        node -e "try{console.log(JSON.stringify(JSON.parse(process.argv[1]),null,2))}catch{console.log(process.argv[1])}" "${RAW}"
      else
        echo "${RAW}"
      fi
      ;;
    3)
      echo ""
      read -r -p "Paste JSON object to insert/upsert into public.${CURRENT_TABLE}: " JSON_ROW </dev/tty || true
      if [ -n "${JSON_ROW}" ]; then
        curl -fsS -X POST "${REST_URL}/${CURRENT_TABLE}" \
          -H "Content-Type: application/json" \
          -H "Prefer: resolution=merge-duplicates,return=representation" \
          -d "${JSON_ROW}" && echo "" && echo -e "${C_EMERALD}[OK] Row saved.${C_RESET}"
      fi
      ;;
    4)
      echo ""
      read -r -p "Enter column name to match (default: id): " DEL_COL </dev/tty || true
      DEL_COL="${DEL_COL:-id}"
      read -r -p "Enter value of ${DEL_COL} to delete: " DEL_VAL </dev/tty || true
      if [ -n "${DEL_VAL}" ]; then
        curl -fsS -X DELETE "${REST_URL}/${CURRENT_TABLE}?${DEL_COL}=eq.${DEL_VAL}" && \
          echo -e "${C_EMERALD}[OK] Deleted row where ${DEL_COL}=${DEL_VAL}.${C_RESET}"
      fi
      ;;
    5)
      echo ""
      echo -e "${C_BOLD}Per-User Isolated Database Folders (${USERS_DIR}):${C_RESET}"
      ls -1 "${USERS_DIR}" 2>/dev/null || echo "  (no user folders yet)"
      echo ""
      read -r -p "Enter a username/email to create or inspect its folder (or press Enter to skip): " UNAME </dev/tty || true
      if [ -n "${UNAME}" ]; then
        provision_user_folder "${UNAME}"
        CLEAN_U="$(echo "${UNAME}" | tr '[:upper:]' '[:lower:]' | sed 's/@.*//; s/[^a-z0-9_-]/_/g')"
        ls -lh "${USERS_DIR}/${CLEAN_U}"
      fi
      ;;
    6)
      sync_cloud_to_local
      ;;
    7)
      if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "sparrowx-postgres"; then
        docker exec -it sparrowx-postgres psql -U "${PG_USER}" -d "${PG_DB}"
      elif command -v psql >/dev/null 2>&1; then
        sudo -u postgres psql -d "${PG_DB}"
      else
        echo -e "${C_RED}PostgreSQL interactive shell not found.${C_RESET}"
      fi
      ;;
    8)
      STAMP="$(date +%Y%m%d-%H%M%S)"
      BFILE="${BACKUP_DIR}/sparrowx-backup-${STAMP}.sql"
      if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "sparrowx-postgres"; then
        docker exec sparrowx-postgres pg_dump -U "${PG_USER}" "${PG_DB}" > "${BFILE}" 2>/dev/null || true
      fi
      tar -czf "${BACKUP_DIR}/sparrowx-user-dbs-${STAMP}.tar.gz" -C "${DATA_DIR}" . 2>/dev/null || true
      echo -e "${C_EMERALD}[OK] Backup saved in ${BACKUP_DIR} (${STAMP})${C_RESET}"
      ;;
    0)
      echo -e "${C_EMERALD}Exiting SparrowX Terminal Database Studio.${C_RESET}"
      exit 0
      ;;
  esac
done
