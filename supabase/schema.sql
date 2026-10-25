-- SparrowX Security Operations Platform - Production Supabase Schema
-- Copy this ENTIRE file into your Supabase SQL Editor (make sure no text is highlighted) and click Run.

-- 1. Incidents
create table if not exists public.incidents (
  id text primary key,
  title text not null,
  source text not null,
  time text not null default 'Just now',
  severity text not null check (severity in ('Critical', 'High', 'Medium')),
  status text not null check (status in ('Investigating', 'Open', 'Contained')),
  assignee text not null default 'Unassigned',
  summary text not null default '',
  playbook text not null default 'Standard Triage Playbook',
  affected_assets integer not null default 1,
  created_at timestamptz not null default now()
);
alter table public.incidents enable row level security;
drop policy if exists "Allow public read/write on incidents for demo" on public.incidents;
drop policy if exists "Allow access on incidents" on public.incidents;
create policy "Allow access on incidents"
  on public.incidents for all using (true) with check (true);

-- 2. Threat Feeds (IOCs)
create table if not exists public.threat_feeds (
  id text primary key,
  indicator text not null,
  type text not null,
  actor text not null,
  confidence integer not null default 85,
  severity text not null check (severity in ('Critical', 'High', 'Medium')),
  region text not null,
  blocked boolean not null default false,
  last_seen text not null default 'Just now',
  created_at timestamptz not null default now()
);
alter table public.threat_feeds enable row level security;
drop policy if exists "Allow public read/write on threat_feeds for demo" on public.threat_feeds;
drop policy if exists "Allow access on threat_feeds" on public.threat_feeds;
create policy "Allow access on threat_feeds"
  on public.threat_feeds for all using (true) with check (true);

-- 3. Monitored Assets
create table if not exists public.assets (
  id text primary key,
  hostname text not null,
  type text not null,
  ip text not null,
  environment text not null,
  owner text not null,
  risk_score integer not null default 10,
  status text not null check (status in ('Protected', 'Isolated', 'Attention')),
  last_checkin text not null default 'Just now',
  created_at timestamptz not null default now()
);
alter table public.assets enable row level security;
drop policy if exists "Allow public read/write on assets for demo" on public.assets;
drop policy if exists "Allow access on assets" on public.assets;
create policy "Allow access on assets"
  on public.assets for all using (true) with check (true);

-- 4. Vulnerabilities (CVEs)
create table if not exists public.vulnerabilities (
  id text primary key,
  cve text not null,
  package_name text not null,
  cvss numeric(3,1) not null,
  severity text not null check (severity in ('Critical', 'High', 'Medium')),
  affected_hosts integer not null default 1,
  status text not null check (status in ('Open', 'In Progress', 'Patched')),
  fix_version text not null,
  created_at timestamptz not null default now()
);
alter table public.vulnerabilities enable row level security;
drop policy if exists "Allow public read/write on vulnerabilities for demo" on public.vulnerabilities;
drop policy if exists "Allow access on vulnerabilities" on public.vulnerabilities;
create policy "Allow access on vulnerabilities"
  on public.vulnerabilities for all using (true) with check (true);

-- 5. Compliance Reports
create table if not exists public.reports (
  id text primary key,
  title text not null,
  framework text not null,
  period text not null,
  generated_at text not null,
  author text not null,
  status text not null check (status in ('Ready', 'Scheduled')),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
drop policy if exists "Allow public read/write on reports for demo" on public.reports;
drop policy if exists "Allow access on reports" on public.reports;
create policy "Allow access on reports"
  on public.reports for all using (true) with check (true);

-- 6. Protected Web Apps, APIs & AI Agents
create table if not exists public.protected_services (
  id text primary key,
  name text not null,
  category text not null,
  endpoint text not null,
  mode text not null default 'Active Shield',
  requests_24h text not null default '0',
  blocked_threats integer not null default 0,
  api_key text not null,
  prompt_shield boolean not null default false,
  pii_redaction boolean not null default true,
  tool_call_firewall boolean not null default false,
  last_heartbeat text not null default 'Connected',
  created_at timestamptz not null default now()
);
alter table public.protected_services enable row level security;
drop policy if exists "Allow access on protected_services" on public.protected_services;
create policy "Allow access on protected_services"
  on public.protected_services for all using (true) with check (true);

-- 7. Security Team Members
create table if not exists public.team_members (
  id text primary key,
  name text not null,
  initials text not null,
  email text not null,
  role text not null,
  mfa_enabled boolean not null default true,
  on_call boolean not null default false,
  shift text not null default 'Primary Shift',
  created_at timestamptz not null default now()
);
alter table public.team_members enable row level security;
drop policy if exists "Allow access on team_members" on public.team_members;
create policy "Allow access on team_members"
  on public.team_members for all using (true) with check (true);

-- 8. External Telemetry Integrations
create table if not exists public.integrations (
  id text primary key,
  name text not null,
  category text not null,
  description text not null,
  connected boolean not null default true,
  events_per_min text not null default 'Active',
  last_sync text not null default 'Live',
  created_at timestamptz not null default now()
);
alter table public.integrations enable row level security;
drop policy if exists "Allow access on integrations" on public.integrations;
create policy "Allow access on integrations"
  on public.integrations for all using (true) with check (true);

-- 9. Client Tenants & Dynamic Service Subscriptions
create table if not exists public.client_tenants (
  id text primary key,
  name text not null,
  contact_email text not null,
  primary_domain text not null,
  plan_tier text not null default 'Growth',
  status text not null default 'Active',
  enabled_modules jsonb not null default '["web_security"]'::jsonb,
  api_key text not null,
  sdk_verified boolean not null default false,
  guardrails_active boolean not null default true,
  requests_per_min integer not null default 0,
  blocked_threats integer not null default 0,
  avg_latency_ms integer not null default 12,
  quota_used_pct integer not null default 1,
  created_at timestamptz not null default now()
);
alter table public.client_tenants enable row level security;
drop policy if exists "Allow access on client_tenants" on public.client_tenants;
create policy "Allow access on client_tenants"
  on public.client_tenants for all using (true) with check (true);

-- 10. Internal Access Control & Security Audit Logs
create table if not exists public.audit_logs (
  id text primary key,
  actor text not null,
  role text not null,
  action text not null,
  target text not null,
  severity text not null default 'Info',
  timestamp text not null,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
drop policy if exists "Allow access on audit_logs" on public.audit_logs;
create policy "Allow access on audit_logs"
  on public.audit_logs for all using (true) with check (true);
