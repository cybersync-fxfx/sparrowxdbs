#!/usr/bin/env bash
# ==============================================================================
# SPARROWX ADMIN CLI — Security Plan Grants & SparrowCoins Manager
# ==============================================================================
# Usage (Interactive menu):
#   sudo bash scripts/sparrowx-admin.sh
#
# Usage (Direct CLI commands):
#   sudo bash scripts/sparrowx-admin.sh add-coins <email> <amount> [reason]
#   sudo bash scripts/sparrowx-admin.sh give-security <email> [plan_tier] [domain]
#   sudo bash scripts/sparrowx-admin.sh set-admin <email> <yes|no>
#   sudo bash scripts/sparrowx-admin.sh promo <CODE> <coins>
#   sudo bash scripts/sparrowx-admin.sh status <email>
#   sudo bash scripts/sparrowx-admin.sh list
# ==============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Load environment variables safely (without failing if optional files are missing)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

load_env_key() {
  local key="$1"
  local val=""
  for f in "/etc/sparrowx/app.env" "${REPO_DIR}/.env"; do
    if [[ -f "$f" ]]; then
      val=$(grep -E "^${key}=" "$f" | tail -n 1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
      if [[ -n "$val" ]]; then
        echo "$val"
        return 0
      fi
    fi
  done
  echo ""
}

PG_CONTAINER="${PG_CONTAINER:-sparrowx-postgres}"
PG_USER="${POSTGRES_USER:-$(load_env_key POSTGRES_USER)}"
PG_DB="${POSTGRES_DB:-$(load_env_key POSTGRES_DB)}"
PG_USER="${PG_USER:-sparrowx}"
PG_DB="${PG_DB:-sparrowx_db}"
DISCORD_WEBHOOK="${SPARROWX_DISCORD_WEBHOOK_URL:-$(load_env_key SPARROWX_DISCORD_WEBHOOK_URL)}"

# Execute psql inside sparrowx-postgres container (with -v variable passing for SQL injection safety)
run_psql() {
  if docker ps --format '{{.Names}}' | grep -qx "${PG_CONTAINER}"; then
    docker exec -i "${PG_CONTAINER}" psql -U "${PG_USER}" -d "${PG_DB}" -v ON_ERROR_STOP=1 "$@"
  elif command -v psql >/dev/null 2>&1; then
    PGPASSWORD="${POSTGRES_PASSWORD:-$(load_env_key POSTGRES_PASSWORD)}" \
      psql -h 127.0.0.1 -U "${PG_USER}" -d "${PG_DB}" -v ON_ERROR_STOP=1 "$@"
  else
    echo -e "${RED}[ERROR] Neither Docker container '${PG_CONTAINER}' nor local 'psql' is available.${NC}" >&2
    exit 1
  fi
}

notify_discord() {
  local title="$1"
  local desc="$2"
  local color="${3:-3066993}" # emerald green default
  if [[ -z "${DISCORD_WEBHOOK}" ]]; then
    return 0
  fi
  local payload
  payload=$(cat <<EOF
{
  "username": "SparrowX Admin CLI",
  "embeds": [{
    "title": "$(printf '%s' "$title" | sed 's/"/\\"/g')",
    "description": "$(printf '%s' "$desc" | sed 's/"/\\"/g')",
    "color": ${color},
    "footer": {"text": "SparrowX OVH Admin CLI • $(date -u '+%Y-%m-%d %H:%M:%S UTC')"}
  }]
}
EOF
)
  curl -fsS -H "Content-Type: application/json" -d "${payload}" "${DISCORD_WEBHOOK}" >/dev/null 2>&1 || true
}

validate_email() {
  local email="$1"
  if [[ ! "$email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
    echo -e "${RED}[ERROR] Invalid email address: ${email}${NC}" >&2
    exit 1
  fi
}

validate_positive_int() {
  local num="$1"
  if [[ ! "$num" =~ ^[1-9][0-9]*$ ]]; then
    echo -e "${RED}[ERROR] Amount must be a positive whole number (got: ${num})${NC}" >&2
    exit 1
  fi
}

# ==============================================================================
# 1. ADD SPARROWCOINS (Updates Game Portal `clients` + `coin_transactions` AND `billing_credits`)
# ==============================================================================
cmd_add_coins() {
  local email="${1:-}"
  local amount="${2:-}"
  local reason="${3:-Admin manual SparrowCoins grant}"

  if [[ -z "$email" || -z "$amount" ]]; then
    echo "Usage: $0 add-coins <email> <amount> [reason]"
    exit 1
  fi

  email="$(echo "$email" | tr '[:upper:]' '[:lower:]' | xargs)"
  validate_email "$email"
  validate_positive_int "$amount"

  local ref="admin:cli:$(date +%s):$(head -c 4 /dev/urandom | od -An -tx1 | tr -d ' \n')"

  echo -e "${CYAN}[INFO] Crediting ${BOLD}${amount} SparrowCoins${NC}${CYAN} to ${BOLD}${email}${NC}${CYAN}...${NC}"

  run_psql -v v_email="$email" -v v_amount="$amount" -v v_reason="$reason" -v v_ref="$ref" <<'SQL'
SELECT set_config('spx.email', :'v_email', false),
       set_config('spx.amount', :'v_amount', false),
       set_config('spx.reason', :'v_reason', false),
       set_config('spx.ref', :'v_ref', false);

DO $$
DECLARE
  v_email text := lower(current_setting('spx.email'));
  v_amount integer := current_setting('spx.amount')::integer;
  v_reason text := current_setting('spx.reason');
  v_ref text := current_setting('spx.ref');
  v_client_id uuid;
  v_new_balance integer;
  v_tenant_id text;
  v_user_name text;
BEGIN
  -- 1. Credit Game Hosting / Portal wallet (public.clients + public.coin_transactions)
  SELECT id INTO v_client_id
    FROM public.clients
   WHERE lower(email) = v_email
   LIMIT 1;

  IF v_client_id IS NULL THEN
    SELECT COALESCE(NULLIF(full_name, ''), split_part(v_email, '@', 1))
      INTO v_user_name
      FROM public.app_users
     WHERE lower(email) = v_email
     LIMIT 1;

    v_user_name := COALESCE(v_user_name, split_part(v_email, '@', 1));

    INSERT INTO public.clients (discord_id, discord_username, email, coins)
    VALUES ('email:' || v_email, v_user_name, v_email, 0)
    ON CONFLICT (discord_id) DO UPDATE SET email = EXCLUDED.email
    RETURNING id INTO v_client_id;
  END IF;

  SELECT balance INTO v_new_balance
    FROM public.credit_coins(v_client_id, v_amount, 'bonus', v_reason, v_ref);

  RAISE NOTICE 'GAME_WALLET_BALANCE=%', v_new_balance;

  -- 2. Sync Master Portal billing_credits + billing_transactions if table exists
  IF to_regclass('public.billing_credits') IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant_id
      FROM public.app_users
     WHERE lower(email) = v_email
     LIMIT 1;

    IF EXISTS (SELECT 1 FROM public.billing_credits WHERE lower(user_email) = v_email) THEN
      UPDATE public.billing_credits
         SET balance = balance + v_amount::numeric,
             updated_at = NOW()
       WHERE lower(user_email) = v_email;
    ELSE
      INSERT INTO public.billing_credits (id, tenant_id, user_email, balance)
      VALUES ('CRD-' || substr(md5(random()::text), 1, 8), v_tenant_id, v_email, v_amount::numeric);
    END IF;
  END IF;

  IF to_regclass('public.billing_transactions') IS NOT NULL THEN
    INSERT INTO public.billing_transactions (id, tenant_id, user_email, type, credits, cost_usd, payment_method, title)
    VALUES (
      'TX-' || substr(md5(random()::text), 1, 10),
      v_tenant_id,
      v_email,
      'admin_coin_grant',
      v_amount::numeric,
      0,
      'Admin CLI',
      v_reason
    );
  END IF;

  -- 3. Record audit log
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    INSERT INTO public.audit_logs (id, actor, role, action, target, severity, timestamp)
    VALUES (
      'AUD-' || substr(md5(random()::text), 1, 10),
      'OVH Root Admin CLI',
      'SuperAdmin',
      'Credited ' || v_amount::text || ' SparrowCoins (' || v_reason || ')',
      v_email,
      'Info',
      to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS UTC')
    );
  END IF;
END $$;
SQL

  echo -e "${GREEN}[OK] Successfully added ${amount} SparrowCoins to ${email}!${NC}"
  notify_discord "🪙 SparrowCoins Granted (Admin CLI)" "**User:** \`${email}\`\n**Amount:** \`+${amount} SparrowCoins\`\n**Reason:** ${reason}" 16766720
}

# ==============================================================================
# 2. GIVE SECURITY PLAN (Activates Shield / WAF / NetSec / AI Guardrails for user)
# ==============================================================================
cmd_give_security() {
  local email="${1:-}"
  local plan_tier="${2:-SparrowX Enterprise}"
  local domain="${3:-}"

  if [[ -z "$email" ]]; then
    echo "Usage: $0 give-security <email> [plan_tier] [primary_domain]"
    echo "Available plans:"
    echo "  - SparrowX Edge Core"
    echo "  - SparrowX Startup Shield"
    echo "  - SparrowX Business SOC"
    echo "  - SparrowX AI Native"
    echo "  - SparrowX Enterprise   (default)"
    echo "  - SparrowX Hyperscale"
    exit 1
  fi

  email="$(echo "$email" | tr '[:upper:]' '[:lower:]' | xargs)"
  validate_email "$email"

  if [[ -z "$domain" ]]; then
    domain="$(echo "$email" | cut -d@ -f2)"
  fi

  echo -e "${CYAN}[INFO] Granting security plan ${BOLD}${plan_tier}${NC}${CYAN} to ${BOLD}${email}${NC}${CYAN} (domain: ${domain})...${NC}"

  run_psql -v v_email="$email" -v v_plan="$plan_tier" -v v_domain="$domain" <<'SQL'
SELECT set_config('spx.email', :'v_email', false),
       set_config('spx.plan', :'v_plan', false),
       set_config('spx.domain', :'v_domain', false);

DO $$
DECLARE
  v_email text := lower(current_setting('spx.email'));
  v_plan text := current_setting('spx.plan');
  v_domain text := current_setting('spx.domain');
  v_tenant_id text;
  v_user_name text;
  v_api_key text;
BEGIN
  -- Find existing tenant via app_users or client_tenants
  SELECT tenant_id, COALESCE(NULLIF(full_name, ''), split_part(email, '@', 1))
    INTO v_tenant_id, v_user_name
    FROM public.app_users
   WHERE lower(email) = v_email
   LIMIT 1;

  IF v_tenant_id IS NULL THEN
    SELECT id INTO v_tenant_id
      FROM public.client_tenants
     WHERE lower(contact_email) = v_email
     LIMIT 1;
  END IF;

  v_user_name := COALESCE(v_user_name, split_part(v_email, '@', 1));
  v_api_key := 'spx_sec_' || encode(gen_random_bytes(16), 'hex');

  IF v_tenant_id IS NULL THEN
    v_tenant_id := 'TNT-' || substr(md5(v_email || clock_timestamp()::text), 1, 6);
    INSERT INTO public.client_tenants (
      id, name, contact_email, primary_domain, plan_tier, status,
      enabled_modules, api_key, sdk_verified, guardrails_active
    ) VALUES (
      v_tenant_id,
      v_user_name || ' Security Workspace',
      v_email,
      v_domain,
      v_plan,
      'Active',
      ARRAY['cloud_security','web_security','ai_shield','api_security','ddos_mitigation','netsec_guard'],
      v_api_key,
      TRUE,
      TRUE
    );
  ELSE
    UPDATE public.client_tenants
       SET plan_tier = v_plan,
           status = 'Active',
           primary_domain = COALESCE(NULLIF(v_domain, ''), primary_domain),
           enabled_modules = ARRAY['cloud_security','web_security','ai_shield','api_security','ddos_mitigation','netsec_guard'],
           sdk_verified = TRUE,
           guardrails_active = TRUE
     WHERE id = v_tenant_id;
  END IF;

  -- Link tenant back to app_users if account exists
  UPDATE public.app_users
     SET tenant_id = v_tenant_id
   WHERE lower(email) = v_email
     AND (tenant_id IS NULL OR tenant_id = '');

  -- Log to audit_logs
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    INSERT INTO public.audit_logs (id, actor, role, action, target, severity, timestamp)
    VALUES (
      'AUD-' || substr(md5(random()::text), 1, 10),
      'OVH Root Admin CLI',
      'SuperAdmin',
      'Granted Security Plan [' || v_plan || '] with full WAF/NetSec/AI Shield modules (Tenant: ' || v_tenant_id || ')',
      v_email,
      'Info',
      to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS UTC')
    );
  END IF;

  RAISE NOTICE 'SECURITY_GRANTED_TENANT=%', v_tenant_id;
END $$;
SQL

  echo -e "${GREEN}[OK] Security plan '${plan_tier}' granted to ${email} with all Shield/WAF/NetSec/AI modules enabled!${NC}"
  notify_discord "🛡️ Security Plan Granted (Admin CLI)" "**User:** \`${email}\`\n**Plan:** \`${plan_tier}\`\n**Domain:** \`${domain}\`\n**Modules:** \`cloud_security, web_security, ai_shield, api_security, ddos_mitigation, netsec_guard\`" 3066993
}

# ==============================================================================
# 3. SET ADMIN ACCESS (app_users.admin = yes/no)
# ==============================================================================
cmd_set_admin() {
  local email="${1:-}"
  local flag="${2:-yes}"
  if [[ -z "$email" || ( "$flag" != "yes" && "$flag" != "no" ) ]]; then
    echo "Usage: $0 set-admin <email> <yes|no>"
    exit 1
  fi
  email="$(echo "$email" | tr '[:upper:]' '[:lower:]' | xargs)"
  validate_email "$email"

  run_psql -v v_email="$email" -v v_flag="$flag" <<'SQL'
UPDATE public.app_users
   SET admin = :'v_flag'
 WHERE lower(email) = lower(:'v_email')
RETURNING id, email, full_name, admin, tenant_id;
SQL
  echo -e "${GREEN}[OK] Updated admin=${flag} for ${email}.${NC}"
  notify_discord "🔐 Admin Role Updated (Admin CLI)" "**User:** \`${email}\`\n**Admin:** \`${flag}\`" 15158332
}

# ==============================================================================
# 4. CREATE PROMO CODE
# ==============================================================================
cmd_promo() {
  local code="${1:-}"
  local coins="${2:-}"
  if [[ -z "$code" || -z "$coins" ]]; then
    echo "Usage: $0 promo <CODE> <coins>"
    exit 1
  fi
  code="$(echo "$code" | tr '[:lower:]' '[:upper:]' | tr -cd 'A-Z0-9_-')"
  validate_positive_int "$coins"

  run_psql -v v_code="$code" -v v_coins="$coins" <<'SQL'
INSERT INTO public.promo_codes (code, coins, active)
VALUES (:'v_code', (:'v_coins')::integer, TRUE)
ON CONFLICT (code) DO UPDATE SET coins = EXCLUDED.coins, active = TRUE
RETURNING code, coins, active;
SQL
  echo -e "${GREEN}[OK] Promo code '${code}' active for ${coins} SparrowCoins.${NC}"
}

# ==============================================================================
# 5. CHECK USER STATUS (Coins + Security Plan + Admin Role)
# ==============================================================================
cmd_status() {
  local email="${1:-}"
  if [[ -z "$email" ]]; then
    echo "Usage: $0 status <email>"
    exit 1
  fi
  email="$(echo "$email" | tr '[:upper:]' '[:lower:]' | xargs)"
  validate_email "$email"

  echo -e "${BOLD}${CYAN}=== Master Account & Security Tenant ===${NC}"
  run_psql -v v_email="$email" <<'SQL'
SELECT u.email, u.full_name, u.admin, u.tenant_id,
       t.plan_tier, t.status AS security_status, t.primary_domain, t.enabled_modules
  FROM public.app_users u
  LEFT JOIN public.client_tenants t ON t.id = u.tenant_id OR lower(t.contact_email) = lower(u.email)
 WHERE lower(u.email) = lower(:'v_email');
SQL

  echo -e "${BOLD}${CYAN}=== SparrowCoins Wallet & Recent Transactions ===${NC}"
  run_psql -v v_email="$email" <<'SQL'
SELECT id, email, discord_username, coins, created_at
  FROM public.clients
 WHERE lower(email) = lower(:'v_email');

SELECT ct.created_at, ct.type, ct.amount, ct.description
  FROM public.coin_transactions ct
  JOIN public.clients c ON c.id = ct.client_id
 WHERE lower(c.email) = lower(:'v_email')
 ORDER BY ct.created_at DESC
 LIMIT 10;
SQL
}

# ==============================================================================
# 6. LIST RECENT USERS
# ==============================================================================
cmd_list() {
  echo -e "${BOLD}${CYAN}=== SparrowX Users (Coins & Security Tier) ===${NC}"
  run_psql <<'SQL'
SELECT
  COALESCE(u.email, c.email) AS email,
  COALESCE(u.full_name, c.discord_username, '-') AS name,
  COALESCE(u.admin, 'no') AS admin,
  COALESCE(c.coins, 0) AS sparrow_coins,
  COALESCE(t.plan_tier, 'None') AS security_plan,
  COALESCE(t.status, '-') AS sec_status
FROM public.app_users u
FULL OUTER JOIN public.clients c ON lower(u.email) = lower(c.email)
LEFT JOIN public.client_tenants t ON t.id = u.tenant_id OR lower(t.contact_email) = lower(COALESCE(u.email, c.email))
ORDER BY sparrow_coins DESC, email ASC
LIMIT 40;
SQL
}

# ==============================================================================
# INTERACTIVE MENU
# ==============================================================================
interactive_menu() {
  while true; do
    echo ""
    echo -e "${BOLD}${CYAN}======================================================${NC}"
    echo -e "${BOLD}   SPARROWX ADMIN CLI — SECURITY & SPARROWCOINS       ${NC}"
    echo -e "${BOLD}${CYAN}======================================================${NC}"
    echo "  1) Add SparrowCoins to user"
    echo "  2) Give Security Plan (Shield / WAF / NetSec / AI)"
    echo "  3) Check User Status (Coins + Security Plan)"
    echo "  4) List Users (Coins & Security Tiers)"
    echo "  5) Set / Remove Admin Access (app_users.admin)"
    echo "  6) Create / Update Promo Code"
    echo "  0) Exit"
    echo ""
    read -rp "Select option [0-6]: " choice
    case "$choice" in
      1)
        read -rp "User email: " u_email
        read -rp "Coins to add (e.g. 500): " u_coins
        read -rp "Reason [Admin manual SparrowCoins grant]: " u_reason
        cmd_add_coins "$u_email" "$u_coins" "${u_reason:-Admin manual SparrowCoins grant}"
        ;;
      2)
        read -rp "User email: " u_email
        echo "  Plans: 1) SparrowX Edge Core  2) SparrowX Startup Shield  3) SparrowX Business SOC"
        echo "         4) SparrowX AI Native  5) SparrowX Enterprise  6) SparrowX Hyperscale"
        read -rp "Choose plan [1-6, default 5]: " p_idx
        case "${p_idx:-5}" in
          1) u_plan="SparrowX Edge Core" ;;
          2) u_plan="SparrowX Startup Shield" ;;
          3) u_plan="SparrowX Business SOC" ;;
          4) u_plan="SparrowX AI Native" ;;
          6) u_plan="SparrowX Hyperscale" ;;
          *) u_plan="SparrowX Enterprise" ;;
        esac
        read -rp "Primary domain (optional, press Enter to auto-use email domain): " u_dom
        cmd_give_security "$u_email" "$u_plan" "$u_dom"
        ;;
      3)
        read -rp "User email: " u_email
        cmd_status "$u_email"
        ;;
      4)
        cmd_list
        ;;
      5)
        read -rp "User email: " u_email
        read -rp "Grant admin? (yes/no): " u_flag
        cmd_set_admin "$u_email" "$u_flag"
        ;;
      6)
        read -rp "Promo code (e.g. SPARROW500): " p_code
        read -rp "Coins value: " p_coins
        cmd_promo "$p_code" "$p_coins"
        ;;
      0)
        exit 0
        ;;
      *)
        echo -e "${YELLOW}Invalid selection.${NC}"
        ;;
    esac
  done
}

# Entrypoint
case "${1:-}" in
  add-coins)      shift; cmd_add_coins "$@" ;;
  give-security)  shift; cmd_give_security "$@" ;;
  set-admin)      shift; cmd_set_admin "$@" ;;
  promo)          shift; cmd_promo "$@" ;;
  status)         shift; cmd_status "$@" ;;
  list)           shift; cmd_list "$@" ;;
  -h|--help|help)
    grep -E '^# (Usage|  sudo)' "$0" | sed 's/^# //'
    ;;
  "")
    interactive_menu
    ;;
  *)
    echo -e "${RED}Unknown command: $1${NC}"
    echo "Run '$0 --help' for usage."
    exit 1
    ;;
esac
