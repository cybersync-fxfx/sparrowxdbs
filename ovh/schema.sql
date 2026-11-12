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
