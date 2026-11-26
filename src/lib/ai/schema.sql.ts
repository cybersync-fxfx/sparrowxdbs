/**
 * Production PostgreSQL 16 + pgvector + Row-Level Security DDL for SparrowX AI (ai.sparrowx.net).
 * Covers all 13 control-plane tables:
 *   users, workspaces, plans, templates, instances, env_secrets, domains,
 *   deployments, snapshots, usage_metrics, invoices, ip_allocations, audit_logs
 */
export const SPARROWX_AI_POSTGRES_DDL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE IF NOT EXISTS ai_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  oauth_provider TEXT NOT NULL CHECK (oauth_provider IN ('google', 'github')),
  oauth_subject TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'developer' CHECK (role IN ('developer', 'founder_admin')),
  kyc_phone_hash TEXT,
  kyc_verified_at TIMESTAMPTZ,
  wallet_balance_inr INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES ai_users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  gstin TEXT,
  billing_email TEXT NOT NULL,
  suspended_at TIMESTAMPTZ,
  suspension_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  vcpu INTEGER NOT NULL,
  ram_gb INTEGER NOT NULL,
  ssd_gb INTEGER NOT NULL,
  port_mbps INTEGER NOT NULL,
  transfer_quota_gb INTEGER NOT NULL,
  pids_limit INTEGER NOT NULL DEFAULT 512,
  monthly_inr INTEGER NOT NULL,
  isolation_mode TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS ai_templates (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  docker_image TEXT NOT NULL,
  default_port INTEGER NOT NULL DEFAULT 8080,
  min_vcpu INTEGER NOT NULL DEFAULT 2,
  min_ram_gb INTEGER NOT NULL DEFAULT 4,
  supports_pgvector BOOLEAN NOT NULL DEFAULT TRUE,
  websocket_ready BOOLEAN NOT NULL DEFAULT TRUE,
  default_env_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES ai_workspaces(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES ai_plans(id),
  template_id TEXT REFERENCES ai_templates(id),
  name TEXT NOT NULL,
  subdomain TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL CHECK (source_type IN ('template', 'github')),
  git_repo_url TEXT,
  git_branch TEXT NOT NULL DEFAULT 'main',
  detected_runtime TEXT NOT NULL DEFAULT 'docker',
  status TEXT NOT NULL DEFAULT 'queued',
  proxmox_node TEXT NOT NULL DEFAULT 'pve-in-01',
  proxmox_vmid INTEGER,
  container_id TEXT,
  internal_ip INET,
  internal_port INTEGER NOT NULL DEFAULT 8080,
  pgvector_db_name TEXT,
  webhook_waf_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  smtp_blocked BOOLEAN NOT NULL DEFAULT TRUE,
  execution_prune_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  transfer_used_gb NUMERIC(10, 2) NOT NULL DEFAULT 0,
  grace_period_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_env_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES ai_instances(id) ON DELETE CASCADE,
  secret_key TEXT NOT NULL,
  ciphertext_aes256gcm TEXT NOT NULL,
  iv_hex TEXT NOT NULL,
  auth_tag_hex TEXT NOT NULL,
  key_version SMALLINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (instance_id, secret_key)
);

CREATE TABLE IF NOT EXISTS ai_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES ai_instances(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL UNIQUE,
  cname_target TEXT NOT NULL DEFAULT 'edge.ai.sparrowx.net',
  ssl_status TEXT NOT NULL DEFAULT 'pending_dns' CHECK (ssl_status IN ('pending_dns', 'issuing', 'active', 'failed')),
  websocket_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  cert_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES ai_instances(id) ON DELETE CASCADE,
  bullmq_job_id TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('queued', 'allocating', 'configuring_ssl', 'live', 'failed')),
  git_commit_sha TEXT,
  build_log_tail TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ai_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES ai_instances(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('daily-auto', 'manual')),
  storage_uri TEXT NOT NULL,
  size_mb INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ready',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_usage_metrics (
  id BIGSERIAL PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES ai_instances(id) ON DELETE CASCADE,
  bucket_hour TIMESTAMPTZ NOT NULL,
  avg_cpu_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  peak_ram_mb INTEGER NOT NULL DEFAULT 0,
  disk_io_mb NUMERIC(10, 2) NOT NULL DEFAULT 0,
  rx_bytes BIGINT NOT NULL DEFAULT 0,
  tx_bytes BIGINT NOT NULL DEFAULT 0,
  UNIQUE (instance_id, bucket_hour)
);

CREATE TABLE IF NOT EXISTS ai_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES ai_workspaces(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_subscription_id TEXT,
  subtotal_inr INTEGER NOT NULL,
  gst_inr INTEGER NOT NULL,
  total_inr INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'PAID', 'FAILED', 'VOID')),
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ai_ip_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ipv4 INET NOT NULL UNIQUE,
  cidr SMALLINT NOT NULL DEFAULT 32,
  gateway_region TEXT NOT NULL DEFAULT 'ovh-bom1',
  workspace_id UUID REFERENCES ai_workspaces(id) ON DELETE SET NULL,
  instance_id UUID REFERENCES ai_instances(id) ON DELETE SET NULL,
  port_cap_mbps INTEGER NOT NULL DEFAULT 100,
  smtp_blocked BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('active', 'reserved', 'throttled')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  workspace_id UUID REFERENCES ai_workspaces(id) ON DELETE SET NULL,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  client_ip INET,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row-Level Security (RLS) tenant isolation
ALTER TABLE ai_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_env_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_invoices ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_instances_workspace ON ai_instances(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_metrics_instance_hour ON ai_usage_metrics(instance_id, bucket_hour DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_workspace_time ON ai_audit_logs(workspace_id, created_at DESC);
`;
