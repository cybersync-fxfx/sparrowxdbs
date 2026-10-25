-- SparrowX Security Operations Platform - Supabase Schema & Seed Data
-- Run this full script in your Supabase SQL Editor (make sure no partial text is highlighted when clicking Run).

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

create table if not exists public.threat_feeds (
  id text primary key,
  indicator text not null,
  type text not null,
  actor text not null,
  confidence integer not null default 85,
  severity text not null check (severity in ('Critical', 'High', 'Medium')),
  region text not null,
  blocked boolean not null default false,
  last_seen text not null default '5 min ago'
);

create table if not exists public.assets (
  id text primary key,
  hostname text not null,
  type text not null,
  ip text not null,
  environment text not null,
  owner text not null,
  risk_score integer not null default 12,
  status text not null check (status in ('Protected', 'Isolated', 'Attention')),
  last_checkin text not null default '1 min ago'
);

create table if not exists public.vulnerabilities (
  id text primary key,
  cve text not null,
  package_name text not null,
  cvss numeric(3,1) not null,
  severity text not null check (severity in ('Critical', 'High', 'Medium')),
  affected_hosts integer not null default 1,
  status text not null check (status in ('Open', 'In Progress', 'Patched')),
  fix_version text not null
);

create table if not exists public.reports (
  id text primary key,
  title text not null,
  framework text not null,
  period text not null,
  generated_at text not null,
  author text not null,
  status text not null check (status in ('Ready', 'Scheduled'))
);

alter table public.incidents enable row level security;
alter table public.threat_feeds enable row level security;
alter table public.assets enable row level security;
alter table public.vulnerabilities enable row level security;
alter table public.reports enable row level security;

drop policy if exists "Allow public read/write on incidents for demo" on public.incidents;
create policy "Allow public read/write on incidents for demo"
  on public.incidents for all using (true) with check (true);

drop policy if exists "Allow public read/write on threat_feeds for demo" on public.threat_feeds;
create policy "Allow public read/write on threat_feeds for demo"
  on public.threat_feeds for all using (true) with check (true);

drop policy if exists "Allow public read/write on assets for demo" on public.assets;
create policy "Allow public read/write on assets for demo"
  on public.assets for all using (true) with check (true);

drop policy if exists "Allow public read/write on vulnerabilities for demo" on public.vulnerabilities;
create policy "Allow public read/write on vulnerabilities for demo"
  on public.vulnerabilities for all using (true) with check (true);

drop policy if exists "Allow public read/write on reports for demo" on public.reports;
create policy "Allow public read/write on reports for demo"
  on public.reports for all using (true) with check (true);

insert into public.incidents (id, title, source, time, severity, status, assignee, summary, playbook, affected_assets)
values
  ('INC-2847', 'Unusual sign-in activity detected', 'Identity · accounts.sparrowx.io', '2 min ago', 'Critical', 'Investigating', 'Jordan Davis', 'Multiple impossible-travel OAuth token exchanges observed from ASN 4134 followed by privilege escalation attempts.', 'Identity Compromise Response', 3),
  ('INC-2846', 'Possible data exfiltration over DNS', 'Network · 10.24.8.142', '18 min ago', 'High', 'Open', 'Elena Rostova', 'High-entropy TXT queries burst to uncategorized resolver exceeding 48 MB over 12 minutes.', 'DNS Tunneling Containment', 2),
  ('INC-2845', 'Outdated OpenSSL on production host', 'Vulnerability · prod-api-03', '41 min ago', 'High', 'Open', 'Marcus Vance', 'Runtime library scan detected OpenSSL 3.0.1 prior to CVE remediation window on edge gateway.', 'Zero-Downtime Hotpatch', 4),
  ('INC-2844', 'Suspicious PowerShell execution', 'Endpoint · FINANCE-LAPTOP-12', '1 hr ago', 'Medium', 'Contained', 'Jordan Davis', 'Encoded command invocation spawned by macro-enabled attachment; process tree terminated by EDR sensor.', 'Endpoint Isolation & Forensics', 1),
  ('INC-2843', 'New admin token used from unknown IP', 'Identity · admin.sparrowx.io', '2 hrs ago', 'Medium', 'Investigating', 'Priya Nair', 'Service principal token issued outside scheduled CI window accessed audit log configuration.', 'API Key Rotation', 1),
  ('INC-2842', 'Container privilege escalation attempt', 'Cloud · k8s-prod-us-east', '3 hrs ago', 'Critical', 'Open', 'Marcus Vance', 'Worker pod attempted hostPath mount and capabilities expansion via unapproved admission controller.', 'Kubernetes Runtime Lockdown', 5)
on conflict (id) do nothing;
