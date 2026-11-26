-- ============================================================================
-- SparrowX Deploy (deploy.sparrowx.net) — PostgreSQL 16 Initial Migration
-- Tables: deploy_users, deploy_sessions, deploy_oauth_accounts,
--         deploy_workspaces, deploy_projects, deploy_deployments,
--         deploy_deployment_logs, deploy_env_vars, deploy_domains,
--         deploy_usage_metrics, deploy_webhook_events, deploy_audit_logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.deploy_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'client',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.deploy_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.deploy_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deploy_sessions_user ON public.deploy_sessions(user_id);

CREATE TABLE IF NOT EXISTS public.deploy_oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.deploy_users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  username TEXT,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deploy_oauth_user_provider
  ON public.deploy_oauth_accounts(user_id, provider);

CREATE TABLE IF NOT EXISTS public.deploy_workspaces (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES public.deploy_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'starter',
  project_limit INTEGER NOT NULL DEFAULT 3,
  monthly_transfer_limit_gb INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deploy_workspaces_owner ON public.deploy_workspaces(owner_user_id);

CREATE TABLE IF NOT EXISTS public.deploy_projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES public.deploy_workspaces(id) ON DELETE CASCADE,
  owner_email TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  repo_url TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  framework TEXT NOT NULL DEFAULT 'nextjs',
  build_method TEXT NOT NULL DEFAULT 'railpack',
  build_command TEXT NOT NULL DEFAULT '',
  start_command TEXT NOT NULL DEFAULT '',
  output_dir TEXT NOT NULL DEFAULT 'dist',
  root_dir TEXT NOT NULL DEFAULT './',
  port INTEGER NOT NULL DEFAULT 3000,
  healthcheck_path TEXT NOT NULL DEFAULT '/',
  region TEXT NOT NULL DEFAULT 'Mumbai IN-1',
  tier TEXT NOT NULL DEFAULT 'starter',
  status TEXT NOT NULL DEFAULT 'Queued',
  auto_deploy BOOLEAN NOT NULL DEFAULT TRUE,
  webhook_secret TEXT,
  active_deployment_id TEXT,
  active_container_name TEXT,
  active_image_tag TEXT,
  live_path TEXT,
  custom_domain TEXT,
  commit_sha TEXT,
  commit_message TEXT NOT NULL DEFAULT 'Initial deployment',
  managed_postgres_attached BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_deployed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deploy_projects_owner ON public.deploy_projects(owner_email);
CREATE INDEX IF NOT EXISTS idx_deploy_projects_workspace ON public.deploy_projects(workspace_id);

CREATE TABLE IF NOT EXISTS public.deploy_deployments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.deploy_projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Queued',
  trigger_source TEXT NOT NULL DEFAULT 'manual',
  branch TEXT NOT NULL DEFAULT 'main',
  commit_sha TEXT,
  commit_message TEXT NOT NULL DEFAULT '',
  commit_author TEXT,
  image_tag TEXT,
  container_name TEXT,
  duration_ms INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deploy_deployments_project
  ON public.deploy_deployments(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.deploy_deployment_logs (
  id TEXT PRIMARY KEY,
  deployment_id TEXT NOT NULL REFERENCES public.deploy_deployments(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES public.deploy_projects(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'build',
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deploy_logs_deployment
  ON public.deploy_deployment_logs(deployment_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.deploy_env_vars (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.deploy_projects(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value_enc TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'Production',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deploy_env_project_key_target
  ON public.deploy_env_vars(project_id, key, target);

CREATE TABLE IF NOT EXISTS public.deploy_domains (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.deploy_projects(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  tls_status TEXT NOT NULL DEFAULT 'pending',
  verification_target TEXT NOT NULL DEFAULT 'deploy.sparrowx.net',
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deploy_domains_project ON public.deploy_domains(project_id);

CREATE TABLE IF NOT EXISTS public.deploy_usage_metrics (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.deploy_projects(id) ON DELETE CASCADE,
  cpu_pct REAL NOT NULL DEFAULT 0,
  memory_mb REAL NOT NULL DEFAULT 0,
  network_rx_mb REAL NOT NULL DEFAULT 0,
  network_tx_mb REAL NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deploy_usage_project_time
  ON public.deploy_usage_metrics(project_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS public.deploy_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'github',
  delivery_id TEXT,
  event_type TEXT NOT NULL,
  repo_url TEXT,
  branch TEXT,
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'received',
  payload_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deploy_webhooks_created
  ON public.deploy_webhook_events(created_at DESC);

CREATE TABLE IF NOT EXISTS public.deploy_audit_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deploy_audit_actor
  ON public.deploy_audit_logs(actor_email, created_at DESC);
