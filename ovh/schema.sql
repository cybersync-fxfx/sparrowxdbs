-- ============================================================================
-- SPARROWX SOVEREIGN SELF-HOSTED POSTGRESQL SCHEMA (OVH UBUNTU SERVER)
-- ============================================================================
-- Initializes all core workspace tables, multi-tenant IP tables, billing
-- ledgers, and PostgREST API roles so SparrowX runs 100% on your own OVH
-- server with zero third-party cloud dependencies.
-- ============================================================================

BEGIN;

-- 1. Create PostgREST roles for self-hosted REST API (/rest/v1/*)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'web_anon') THEN
    CREATE ROLE web_anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'sparrowx_ovh_authenticator';
  END IF;
END
$$;

GRANT web_anon TO authenticator;
GRANT USAGE ON SCHEMA public TO web_anon;

-- 2. Security Incidents Table
CREATE TABLE IF NOT EXISTS public.incidents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  time TEXT NOT NULL DEFAULT 'Just now',
  severity TEXT NOT NULL DEFAULT 'Medium',
  status TEXT NOT NULL DEFAULT 'Open',
  assignee TEXT NOT NULL DEFAULT 'Unassigned',
  summary TEXT NOT NULL DEFAULT '',
  playbook TEXT NOT NULL DEFAULT 'Standard Triage Playbook',
  affected_assets INTEGER NOT NULL DEFAULT 1,
  tenant_id TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Threat Intelligence Feeds (IOCs & Blocklist)
CREATE TABLE IF NOT EXISTS public.threat_feeds (
  id TEXT PRIMARY KEY,
  indicator TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'IPv4',
  actor TEXT NOT NULL DEFAULT 'Unknown',
  confidence INTEGER NOT NULL DEFAULT 85,
  severity TEXT NOT NULL DEFAULT 'High',
  region TEXT NOT NULL DEFAULT 'Global',
  blocked BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen TEXT NOT NULL DEFAULT 'Just now',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Protected Infrastructure Assets
CREATE TABLE IF NOT EXISTS public.assets (
  id TEXT PRIMARY KEY,
  hostname TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'API Gateway',
  ip TEXT NOT NULL DEFAULT '',
  environment TEXT NOT NULL DEFAULT 'Production',
  owner TEXT NOT NULL DEFAULT '',
  risk_score INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'Protected',
  last_checkin TEXT NOT NULL DEFAULT 'Just now',
  tenant_id TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. CVE & Vulnerability Ledger
CREATE TABLE IF NOT EXISTS public.vulnerabilities (
  id TEXT PRIMARY KEY,
  cve TEXT NOT NULL,
  package_name TEXT NOT NULL DEFAULT '',
  cvss NUMERIC(4,1) NOT NULL DEFAULT 5.0,
  severity TEXT NOT NULL DEFAULT 'Medium',
  affected_hosts INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Open',
  fix_version TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Compliance & Executive Reports
CREATE TABLE IF NOT EXISTS public.reports (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  framework TEXT NOT NULL DEFAULT 'SOC 2 Type II',
  period TEXT NOT NULL DEFAULT '',
  generated_at TEXT NOT NULL DEFAULT 'Just now',
  author TEXT NOT NULL DEFAULT 'SparrowX Autonomous Compliance',
  status TEXT NOT NULL DEFAULT 'Ready',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Protected Web, API & AI Services
CREATE TABLE IF NOT EXISTS public.protected_services (
  id TEXT PRIMARY KEY,
  tenant_id TEXT DEFAULT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Web App & Website',
  endpoint TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'Active Shield',
  requests_24h TEXT NOT NULL DEFAULT '0',
  blocked_threats INTEGER NOT NULL DEFAULT 0,
  api_key TEXT NOT NULL,
  prompt_shield BOOLEAN NOT NULL DEFAULT FALSE,
  pii_redaction BOOLEAN NOT NULL DEFAULT TRUE,
  tool_call_firewall BOOLEAN NOT NULL DEFAULT FALSE,
  last_heartbeat TEXT NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. SOC Team Members
CREATE TABLE IF NOT EXISTS public.team_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  initials TEXT NOT NULL DEFAULT 'OP',
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Incident Responder',
  mfa_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  on_call BOOLEAN NOT NULL DEFAULT FALSE,
  shift TEXT NOT NULL DEFAULT 'Primary Shift',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. External Integrations
CREATE TABLE IF NOT EXISTS public.integrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  connected BOOLEAN NOT NULL DEFAULT TRUE,
  events_per_min TEXT NOT NULL DEFAULT 'Active',
  last_sync TEXT NOT NULL DEFAULT 'Live',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Multi-Tenant Client Workspaces
CREATE TABLE IF NOT EXISTS public.client_tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  primary_domain TEXT NOT NULL,
  plan_tier TEXT NOT NULL DEFAULT 'Growth',
  status TEXT NOT NULL DEFAULT 'Active',
  enabled_modules JSONB NOT NULL DEFAULT '["web_security"]'::jsonb,
  api_key TEXT NOT NULL,
  api_client_id TEXT DEFAULT NULL,
  database_name TEXT DEFAULT NULL,
  ip_table_name TEXT DEFAULT NULL,
  sdk_verified BOOLEAN NOT NULL DEFAULT FALSE,
  guardrails_active BOOLEAN NOT NULL DEFAULT TRUE,
  requests_per_min INTEGER NOT NULL DEFAULT 0,
  blocked_threats INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms INTEGER NOT NULL DEFAULT 12,
  quota_used_pct INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Dedicated Tenant IP Database Table (Isolated by tenant_id & table_name)
CREATE TABLE IF NOT EXISTS public.tenant_ips (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  database_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Server Origin Host',
  type TEXT NOT NULL DEFAULT 'server_wan',
  status TEXT NOT NULL DEFAULT 'Active',
  last_probe_status TEXT DEFAULT 'Pending',
  last_probe_latency_ms INTEGER DEFAULT NULL,
  last_probe_at TIMESTAMPTZ DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Platform Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL DEFAULT 'System Automation',
  role TEXT NOT NULL DEFAULT 'Platform',
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'Info',
  timestamp TEXT NOT NULL DEFAULT 'Just now',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Authenticated Operators & Client Users
CREATE TABLE IF NOT EXISTS public.app_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL DEFAULT '',
  admin TEXT NOT NULL DEFAULT 'no',
  tenant_id TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Billing Credits & Subscription Balances
CREATE TABLE IF NOT EXISTS public.billing_credits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT DEFAULT NULL,
  user_email TEXT DEFAULT NULL,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Billing & Subscription Transactions Ledger
CREATE TABLE IF NOT EXISTS public.billing_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT DEFAULT NULL,
  user_email TEXT DEFAULT NULL,
  type TEXT NOT NULL DEFAULT 'service_purchase',
  credits NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'Payment Gateway',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  receipt_number TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast tenant & time-series queries
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON public.incidents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_tenant_id ON public.incidents (tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_tenants_created_at ON public.client_tenants (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_ips_tenant_id ON public.tenant_ips (tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON public.app_users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_billing_tx_tenant ON public.billing_transactions (tenant_id, created_at DESC);

-- Grant full CRUD on public tables to PostgREST role
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO web_anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO web_anon;

COMMIT;

-- 15. Public Contact Inquiries (insert via POST /api/v1/contact; ip stored hashed only)
CREATE TABLE IF NOT EXISTS public.contact_inquiries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  topic TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  ip_hash TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_created_at ON public.contact_inquiries (created_at DESC);
-- Inquiries contain personal data: the anonymous PostgREST role may only insert, never read back.
REVOKE ALL ON public.contact_inquiries FROM web_anon;
GRANT INSERT ON public.contact_inquiries TO web_anon;

-- 16. SparrowX Game Hosting Portal (/game & /game/dashboard)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.clients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id          TEXT NOT NULL UNIQUE,
  discord_username    TEXT NOT NULL,
  discord_avatar      TEXT,
  email               TEXT,
  ptero_user_id       INTEGER UNIQUE,
  ptero_username      TEXT,
  ptero_password_enc  TEXT,
  coins               INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ptero_server_id  INTEGER,
  service_type     TEXT NOT NULL CHECK (service_type IN ('fivem','samp','minecraft','discord')),
  plan_name        TEXT NOT NULL,
  price_coins      INTEGER NOT NULL CHECK (price_coins > 0),
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS subscriptions_client_idx ON public.subscriptions(client_id);
CREATE INDEX IF NOT EXISTS subscriptions_expiry_idx ON public.subscriptions(expires_at) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('topup','promo','purchase','refund','bonus')),
  description  TEXT NOT NULL,
  reference    TEXT UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS coin_tx_client_idx ON public.coin_transactions(client_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.promo_codes (
  code        TEXT PRIMARY KEY,
  coins       INTEGER NOT NULL CHECK (coins > 0),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.spend_coins(p_client_id UUID, p_amount INTEGER, p_description TEXT)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE new_balance INTEGER;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  UPDATE public.clients SET coins = coins - p_amount
   WHERE id = p_client_id AND coins >= p_amount
   RETURNING coins INTO new_balance;
  IF new_balance IS NULL THEN RAISE EXCEPTION 'insufficient_coins'; END IF;
  INSERT INTO public.coin_transactions (client_id, amount, type, description)
  VALUES (p_client_id, -p_amount, 'purchase', p_description);
  RETURN new_balance;
END $$;

CREATE OR REPLACE FUNCTION public.credit_coins(
  p_client_id UUID, p_amount INTEGER, p_type TEXT, p_description TEXT, p_reference TEXT
) RETURNS TABLE (balance INTEGER, applied BOOLEAN) LANGUAGE plpgsql AS $$
DECLARE inserted BOOLEAN := FALSE;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  INSERT INTO public.coin_transactions (client_id, amount, type, description, reference)
  VALUES (p_client_id, p_amount, p_type, p_description, p_reference)
  ON CONFLICT (reference) DO NOTHING
  RETURNING TRUE INTO inserted;
  IF COALESCE(inserted, FALSE) THEN
    UPDATE public.clients SET coins = coins + p_amount WHERE id = p_client_id;
  END IF;
  RETURN QUERY SELECT c.coins, COALESCE(inserted, FALSE) FROM public.clients c WHERE c.id = p_client_id;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sparrowx_service') THEN
    CREATE ROLE sparrowx_service NOLOGIN;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO sparrowx_service;
GRANT SELECT, INSERT, UPDATE ON public.clients, public.subscriptions, public.coin_transactions TO sparrowx_service;
GRANT SELECT ON public.promo_codes TO sparrowx_service;
GRANT EXECUTE ON FUNCTION public.spend_coins(UUID, INTEGER, TEXT) TO sparrowx_service;
GRANT EXECUTE ON FUNCTION public.credit_coins(UUID, INTEGER, TEXT, TEXT, TEXT) TO sparrowx_service;
GRANT SELECT, INSERT, UPDATE ON public.clients, public.subscriptions, public.coin_transactions TO web_anon;
GRANT SELECT ON public.promo_codes TO web_anon;
GRANT EXECUTE ON FUNCTION public.spend_coins(UUID, INTEGER, TEXT) TO web_anon;
GRANT EXECUTE ON FUNCTION public.credit_coins(UUID, INTEGER, TEXT, TEXT, TEXT) TO web_anon;

-- 17. NetSec DDoS Control Panel (netsec.sparrowx.net) tables backed by sovereign PostgreSQL
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT,
  master_user_id TEXT,
  tenant_id TEXT,
  api_key TEXT UNIQUE NOT NULL,
  agent_id TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'approved',
  tunnel_status TEXT DEFAULT 'inactive',
  client_ip TEXT,
  tunnel_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_user_profiles_agent_id ON public.user_profiles (agent_id);

CREATE TABLE IF NOT EXISTS public.threat_radar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  reason TEXT DEFAULT '',
  country TEXT DEFAULT '',
  abuseipdb_score INTEGER DEFAULT 0,
  action TEXT DEFAULT 'watched',
  target_ip TEXT,
  target_agent_id TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_threat_radar_ip ON public.threat_radar (ip);
CREATE INDEX IF NOT EXISTS idx_threat_radar_detected_at ON public.threat_radar (detected_at DESC);
