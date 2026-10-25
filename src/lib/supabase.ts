export type Severity = "Critical" | "High" | "Medium";
export type IncidentStatus = "Investigating" | "Open" | "Contained";
export type RangeOption = "24 hours" | "7 days" | "30 days";

export type Incident = {
  id: string;
  title: string;
  source: string;
  time: string;
  severity: Severity;
  status: IncidentStatus;
  assignee: string;
  summary: string;
  playbook: string;
  affectedAssets: number;
};

export type ThreatIndicator = {
  id: string;
  indicator: string;
  type: "IPv4" | "Domain" | "SHA-256" | "ASN";
  actor: string;
  confidence: number;
  severity: Severity;
  region: string;
  blocked: boolean;
  lastSeen: string;
};

export type Asset = {
  id: string;
  hostname: string;
  type: "Kubernetes Node" | "API Gateway" | "Workstation" | "Database" | "Identity Provider";
  ip: string;
  environment: "Production" | "Staging" | "Corporate";
  owner: string;
  riskScore: number;
  status: "Protected" | "Isolated" | "Attention";
  lastCheckin: string;
};

export type Vulnerability = {
  id: string;
  cve: string;
  packageName: string;
  cvss: number;
  severity: Severity;
  affectedHosts: number;
  status: "Open" | "In Progress" | "Patched";
  fixVersion: string;
};

export type ReportItem = {
  id: string;
  title: string;
  framework: "SOC 2 Type II" | "ISO 27001" | "NIST CSF" | "Executive Summary";
  period: string;
  generatedAt: string;
  author: string;
  status: "Ready" | "Scheduled";
};

export type TeamMember = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: "Security Admin" | "Incident Responder" | "Threat Hunter" | "Compliance Auditor";
  mfaEnabled: boolean;
  onCall: boolean;
  shift: string;
};

export type IntegrationItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  connected: boolean;
  eventsPerMin: string;
  lastSync: string;
};

export type ServiceCategory =
  | "Web App & Website"
  | "AI Agent (LLM / MCP)"
  | "Cloud API & Microservice";

export type ProtectionMode = "Active Shield" | "Monitor Only" | "Lockdown";

export type ProtectedService = {
  id: string;
  name: string;
  category: ServiceCategory;
  endpoint: string;
  mode: ProtectionMode;
  requests24h: string;
  blockedThreats: number;
  apiKey: string;
  promptShield: boolean;
  piiRedaction: boolean;
  toolCallFirewall: boolean;
  lastHeartbeat: string;
};

export const initialProtectedServices: ProtectedService[] = [
  {
    id: "SRV-01",
    name: "Customer Portal & Marketing Web App",
    category: "Web App & Website",
    endpoint: "https://app.sparrowx-client.io",
    mode: "Active Shield",
    requests24h: "142,800",
    blockedThreats: 318,
    apiKey: "spx_live_web_98a4f2c1",
    promptShield: false,
    piiRedaction: true,
    toolCallFirewall: false,
    lastHeartbeat: "4 sec ago",
  },
  {
    id: "SRV-02",
    name: "Autonomous Support & Billing AI Agent",
    category: "AI Agent (LLM / MCP)",
    endpoint: "agent://support-copilot-prod (GPT-4o + MCP)",
    mode: "Active Shield",
    requests24h: "28,450",
    blockedThreats: 94,
    apiKey: "spx_live_ai_77d1e9b0",
    promptShield: true,
    piiRedaction: true,
    toolCallFirewall: true,
    lastHeartbeat: "2 sec ago",
  },
  {
    id: "SRV-03",
    name: "DevOps Code & SQL Execution Agent",
    category: "AI Agent (LLM / MCP)",
    endpoint: "agent://devops-sql-runner (Claude + DB Tools)",
    mode: "Active Shield",
    requests24h: "6,120",
    blockedThreats: 41,
    apiKey: "spx_live_ai_34c8a112",
    promptShield: true,
    piiRedaction: true,
    toolCallFirewall: true,
    lastHeartbeat: "9 sec ago",
  },
  {
    id: "SRV-04",
    name: "Core Payments & Identity Gateway API",
    category: "Cloud API & Microservice",
    endpoint: "https://api.sparrowx-client.io/v2",
    mode: "Active Shield",
    requests24h: "419,200",
    blockedThreats: 612,
    apiKey: "spx_live_api_51f0b8e4",
    promptShield: false,
    piiRedaction: true,
    toolCallFirewall: false,
    lastHeartbeat: "1 sec ago",
  },
];

export type RangeSnapshot = {
  securityScore: string;
  scoreChange: string;
  protectedAssets: string;
  assetsChange: string;
  meanResponse: string;
  responseChange: string;
  totalEvents: string;
  eventsDelta: string;
  riskPoints: number[];
  labels: [string, string, string, string, string];
  postureBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
};

export const rangeSnapshots: Record<RangeOption, RangeSnapshot> = {
  "24 hours": {
    securityScore: "92",
    scoreChange: "+4.2%",
    protectedAssets: "248",
    assetsChange: "+12",
    meanResponse: "14",
    responseChange: "−18%",
    totalEvents: "1,284",
    eventsDelta: "12.8%",
    riskPoints: [22, 28, 25, 34, 31, 45, 39, 44, 36, 50, 48, 58, 47, 54, 49, 65, 58, 69, 57, 64, 55, 71, 65, 76],
    labels: ["12:00 AM", "6:00 AM", "12:00 PM", "6:00 PM", "Now"],
    postureBreakdown: { critical: 3, high: 12, medium: 28, low: 91 },
  },
  "7 days": {
    securityScore: "94",
    scoreChange: "+6.1%",
    protectedAssets: "248",
    assetsChange: "+19",
    meanResponse: "11",
    responseChange: "−24%",
    totalEvents: "8,940",
    eventsDelta: "7.4%",
    riskPoints: [30, 35, 29, 42, 38, 46, 40, 52, 47, 43, 56, 50, 61, 53, 48, 62, 59, 66, 60, 68, 63, 70, 67, 74],
    labels: ["Mon", "Tue", "Wed", "Thu", "Now"],
    postureBreakdown: { critical: 2, high: 9, medium: 24, low: 99 },
  },
  "30 days": {
    securityScore: "89",
    scoreChange: "+9.5%",
    protectedAssets: "248",
    assetsChange: "+34",
    meanResponse: "16",
    responseChange: "−31%",
    totalEvents: "34,612",
    eventsDelta: "19.2%",
    riskPoints: [18, 24, 21, 29, 36, 33, 41, 38, 49, 45, 53, 60, 52, 58, 64, 55, 62, 70, 61, 67, 73, 68, 79, 82],
    labels: ["Oct 1", "Oct 8", "Oct 15", "Oct 22", "Now"],
    postureBreakdown: { critical: 4, high: 15, medium: 33, low: 82 },
  },
};

export const initialIncidents: Incident[] = [
  {
    id: "INC-2847",
    title: "Unusual sign-in activity detected",
    source: "Identity · accounts.sparrowx.io",
    time: "2 min ago",
    severity: "Critical",
    status: "Investigating",
    assignee: "Jordan Davis",
    summary:
      "Multiple impossible-travel OAuth token exchanges observed from ASN 4134 followed by privilege escalation attempts against production identity roles.",
    playbook: "Identity Compromise Response",
    affectedAssets: 3,
  },
  {
    id: "INC-2846",
    title: "Possible data exfiltration over DNS",
    source: "Network · 10.24.8.142",
    time: "18 min ago",
    severity: "High",
    status: "Open",
    assignee: "Elena Rostova",
    summary:
      "High-entropy TXT queries burst to an uncategorized external resolver exceeding 48 MB over 12 minutes from workload subnet.",
    playbook: "DNS Tunneling Containment",
    affectedAssets: 2,
  },
  {
    id: "INC-2845",
    title: "Outdated OpenSSL on production host",
    source: "Vulnerability · prod-api-03",
    time: "41 min ago",
    severity: "High",
    status: "Open",
    assignee: "Marcus Vance",
    summary:
      "Runtime library scan detected OpenSSL 3.0.1 prior to CVE remediation window on public-facing edge gateway.",
    playbook: "Zero-Downtime Hotpatch",
    affectedAssets: 4,
  },
  {
    id: "INC-2844",
    title: "Suspicious PowerShell execution",
    source: "Endpoint · FINANCE-LAPTOP-12",
    time: "1 hr ago",
    severity: "Medium",
    status: "Contained",
    assignee: "Jordan Davis",
    summary:
      "Encoded command invocation spawned by macro-enabled attachment; child process tree terminated automatically by EDR sensor.",
    playbook: "Endpoint Isolation & Forensics",
    affectedAssets: 1,
  },
  {
    id: "INC-2843",
    title: "New admin token used from unknown IP",
    source: "Identity · admin.sparrowx.io",
    time: "2 hrs ago",
    severity: "Medium",
    status: "Investigating",
    assignee: "Priya Nair",
    summary:
      "Service principal token issued outside scheduled CI window accessed audit log configuration endpoints.",
    playbook: "API Key Rotation",
    affectedAssets: 1,
  },
  {
    id: "INC-2842",
    title: "Container privilege escalation attempt",
    source: "Cloud · k8s-prod-us-east",
    time: "3 hrs ago",
    severity: "Critical",
    status: "Open",
    assignee: "Marcus Vance",
    summary:
      "Worker pod attempted hostPath mount and Linux capabilities expansion via unapproved admission request.",
    playbook: "Kubernetes Runtime Lockdown",
    affectedAssets: 5,
  },
];

export const initialThreatIndicators: ThreatIndicator[] = [
  {
    id: "IOC-901",
    indicator: "185.220.101.47",
    type: "IPv4",
    actor: "UNC-4812 · Velvet Tempest",
    confidence: 98,
    severity: "Critical",
    region: "Frankfurt, DE",
    blocked: true,
    lastSeen: "4 min ago",
  },
  {
    id: "IOC-902",
    indicator: "auth-sync-sparrowx.net",
    type: "Domain",
    actor: "Scattered Spider Cluster",
    confidence: 94,
    severity: "Critical",
    region: "Reykjavik, IS",
    blocked: false,
    lastSeen: "11 min ago",
  },
  {
    id: "IOC-903",
    indicator: "e3b0c44298fc1c149afbf4c8996fb924",
    type: "SHA-256",
    actor: "BlackCat Loader",
    confidence: 89,
    severity: "High",
    region: "Global CDN",
    blocked: true,
    lastSeen: "27 min ago",
  },
  {
    id: "IOC-904",
    indicator: "AS4134 · No.31 Jin-rong Backbones",
    type: "ASN",
    actor: "Automated Credential Stuffing",
    confidence: 82,
    severity: "High",
    region: "APAC",
    blocked: false,
    lastSeen: "39 min ago",
  },
  {
    id: "IOC-905",
    indicator: "telemetry-dns-tunnel.io",
    type: "Domain",
    actor: "Exfil Beacon Group",
    confidence: 91,
    severity: "Medium",
    region: "Bucharest, RO",
    blocked: false,
    lastSeen: "1 hr ago",
  },
];

export const initialAssets: Asset[] = [
  {
    id: "AST-101",
    hostname: "prod-api-03.sparrowx.internal",
    type: "API Gateway",
    ip: "10.24.4.19",
    environment: "Production",
    owner: "Platform Core",
    riskScore: 78,
    status: "Attention",
    lastCheckin: "30 sec ago",
  },
  {
    id: "AST-102",
    hostname: "k8s-prod-us-east-node-07",
    type: "Kubernetes Node",
    ip: "10.24.8.142",
    environment: "Production",
    owner: "Cloud Infra",
    riskScore: 84,
    status: "Attention",
    lastCheckin: "1 min ago",
  },
  {
    id: "AST-103",
    hostname: "FINANCE-LAPTOP-12",
    type: "Workstation",
    ip: "172.16.42.88",
    environment: "Corporate",
    owner: "Finance Ops",
    riskScore: 24,
    status: "Isolated",
    lastCheckin: "3 min ago",
  },
  {
    id: "AST-104",
    hostname: "pg-ledger-primary-01",
    type: "Database",
    ip: "10.24.12.5",
    environment: "Production",
    owner: "Data Engineering",
    riskScore: 12,
    status: "Protected",
    lastCheckin: "15 sec ago",
  },
  {
    id: "AST-105",
    hostname: "accounts.sparrowx.io",
    type: "Identity Provider",
    ip: "10.24.1.10",
    environment: "Production",
    owner: "Identity & Access",
    riskScore: 62,
    status: "Protected",
    lastCheckin: "10 sec ago",
  },
];

export const initialVulnerabilities: Vulnerability[] = [
  {
    id: "VUL-401",
    cve: "CVE-2026-2148",
    packageName: "openssl-libssl3 (3.0.1)",
    cvss: 9.8,
    severity: "Critical",
    affectedHosts: 4,
    status: "Open",
    fixVersion: "3.0.15-r2",
  },
  {
    id: "VUL-402",
    cve: "CVE-2026-1892",
    packageName: "containerd-shim (1.7.11)",
    cvss: 8.8,
    severity: "Critical",
    affectedHosts: 6,
    status: "In Progress",
    fixVersion: "1.7.22",
  },
  {
    id: "VUL-403",
    cve: "CVE-2026-1104",
    packageName: "nginx-ingress-controller (1.9.4)",
    cvss: 7.5,
    severity: "High",
    affectedHosts: 3,
    status: "Open",
    fixVersion: "1.11.2",
  },
  {
    id: "VUL-404",
    cve: "CVE-2025-9941",
    packageName: "libcurl4-gnutls (8.4.0)",
    cvss: 6.4,
    severity: "Medium",
    affectedHosts: 11,
    status: "Patched",
    fixVersion: "8.9.1",
  },
];

export const initialReports: ReportItem[] = [
  {
    id: "RPT-701",
    title: "Q4 SOC 2 Continuous Controls Attestation",
    framework: "SOC 2 Type II",
    period: "Oct 1 – Oct 25, 2026",
    generatedAt: "Today, 09:15 AM",
    author: "Jordan Davis",
    status: "Ready",
  },
  {
    id: "RPT-702",
    title: "Weekly Executive Threat & Posture Digest",
    framework: "Executive Summary",
    period: "Oct 18 – Oct 25, 2026",
    generatedAt: "Today, 06:00 AM",
    author: "SparrowX Automation",
    status: "Ready",
  },
  {
    id: "RPT-703",
    title: "ISO 27001 Annex A Vulnerability Remediation Log",
    framework: "ISO 27001",
    period: "October 2026",
    generatedAt: "Yesterday, 04:45 PM",
    author: "Priya Nair",
    status: "Ready",
  },
  {
    id: "RPT-704",
    title: "NIST CSF 2.0 Incident Response Readiness Drill",
    framework: "NIST CSF",
    period: "Q4 2026",
    generatedAt: "Scheduled · Tomorrow",
    author: "Elena Rostova",
    status: "Scheduled",
  },
];

export const initialTeamMembers: TeamMember[] = [
  {
    id: "USR-01",
    name: "Jordan Davis",
    initials: "JD",
    email: "jordan.davis@sparrowx.io",
    role: "Security Admin",
    mfaEnabled: true,
    onCall: true,
    shift: "Primary On-Call · US-East",
  },
  {
    id: "USR-02",
    name: "Elena Rostova",
    initials: "ER",
    email: "elena.rostova@sparrowx.io",
    role: "Incident Responder",
    mfaEnabled: true,
    onCall: true,
    shift: "Secondary On-Call · EU-Central",
  },
  {
    id: "USR-03",
    name: "Marcus Vance",
    initials: "MV",
    email: "marcus.vance@sparrowx.io",
    role: "Threat Hunter",
    mfaEnabled: true,
    onCall: false,
    shift: "Cloud & Kubernetes SecOps",
  },
  {
    id: "USR-04",
    name: "Priya Nair",
    initials: "PN",
    email: "priya.nair@sparrowx.io",
    role: "Compliance Auditor",
    mfaEnabled: true,
    onCall: false,
    shift: "GRC & Identity Governance",
  },
];

export const initialIntegrations: IntegrationItem[] = [
  {
    id: "INT-01",
    name: "Supabase Security Backend",
    category: "Database & Realtime",
    description: "Stores live incidents, assets, vulnerabilities, and audit logs with Row-Level Security.",
    connected: true,
    eventsPerMin: "Realtime",
    lastSync: "Live",
  },
  {
    id: "INT-02",
    name: "AWS CloudTrail & GuardDuty",
    category: "Cloud Telemetry",
    description: "Ingests IAM activity, VPC flow logs, and EKS runtime findings across 6 production accounts.",
    connected: true,
    eventsPerMin: "4,820 / min",
    lastSync: "12 sec ago",
  },
  {
    id: "INT-03",
    name: "CrowdStrike Falcon EDR",
    category: "Endpoint Sensor",
    description: "Streams process trees, host isolation commands, and kernel telemetry from 248 endpoints.",
    connected: true,
    eventsPerMin: "3,190 / min",
    lastSync: "8 sec ago",
  },
  {
    id: "INT-04",
    name: "Okta Workforce Identity",
    category: "Identity Provider",
    description: "Monitors OAuth token grants, impossible travel anomalies, and admin role changes.",
    connected: true,
    eventsPerMin: "940 / min",
    lastSync: "20 sec ago",
  },
  {
    id: "INT-05",
    name: "PagerDuty Incident Escalation",
    category: "SOAR & Alerting",
    description: "Triggers high-urgency pages for Critical severity incidents and tracks SLA acknowledgement.",
    connected: false,
    eventsPerMin: "Standby",
    lastSync: "Paused",
  },
];

const DEFAULT_SUPABASE_URL = "https://yidqdgufjgfyxflgvbqq.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_cbDXcwqJTmMt3Bb_BtY75w_9dIhf9Y-";

const supabaseUrl = (
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_SUPABASE_URL
).replace(/\/$/, "");
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith("http") &&
    !supabaseUrl.includes("your-project-id"),
);

function getSupabaseHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    apikey: supabaseAnonKey ?? "",
    Authorization: `Bearer ${supabaseAnonKey ?? ""}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function fetchIncidentsFromBackend(): Promise<{
  incidents: Incident[];
  source: "supabase" | "demo";
}> {
  if (!isSupabaseConfigured || !supabaseUrl) {
    return { incidents: initialIncidents, source: "demo" };
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/incidents?select=*&order=created_at.desc`,
      {
        headers: getSupabaseHeaders(),
      },
    );

    if (!response.ok) {
      return { incidents: initialIncidents, source: "demo" };
    }

    const data = (await response.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(data)) {
      return { incidents: initialIncidents, source: "demo" };
    }

    const mapped: Incident[] = data.map((row) => ({
      id: String(row.id ?? ""),
      title: String(row.title ?? ""),
      source: String(row.source ?? ""),
      time: String(row.time ?? "Just now"),
      severity: (row.severity as Severity) ?? "Medium",
      status: (row.status as IncidentStatus) ?? "Open",
      assignee: String(row.assignee ?? "Jordan Davis"),
      summary: String(row.summary ?? ""),
      playbook: String(row.playbook ?? "Standard Triage Playbook"),
      affectedAssets: Number(row.affected_assets ?? 1),
    }));

    return { incidents: mapped, source: "supabase" };
  } catch {
    return { incidents: initialIncidents, source: "demo" };
  }
}

export async function clearAllIncidentsFromBackend(): Promise<boolean> {
  if (!isSupabaseConfigured || !supabaseUrl) return false;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/incidents?id=neq.__none__`, {
      method: "DELETE",
      headers: getSupabaseHeaders(),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function seedDemoIncidentsToBackend(): Promise<boolean> {
  if (!isSupabaseConfigured || !supabaseUrl) return false;
  try {
    const payload = initialIncidents.map((incident) => ({
      id: incident.id,
      title: incident.title,
      source: incident.source,
      time: incident.time,
      severity: incident.severity,
      status: incident.status,
      assignee: incident.assignee,
      summary: incident.summary,
      playbook: incident.playbook,
      affected_assets: incident.affectedAssets,
    }));
    const response = await fetch(`${supabaseUrl}/rest/v1/incidents`, {
      method: "POST",
      headers: getSupabaseHeaders({
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function persistIncidentToBackend(incident: Incident): Promise<boolean> {
  if (!isSupabaseConfigured || !supabaseUrl) return false;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/incidents`, {
      method: "POST",
      headers: getSupabaseHeaders({
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify({
        id: incident.id,
        title: incident.title,
        source: incident.source,
        time: incident.time,
        severity: incident.severity,
        status: incident.status,
        assignee: incident.assignee,
        summary: incident.summary,
        playbook: incident.playbook,
        affected_assets: incident.affectedAssets,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function persistThreatIndicatorToBackend(item: ThreatIndicator): Promise<boolean> {
  if (!isSupabaseConfigured || !supabaseUrl) return false;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/threat_feeds`, {
      method: "POST",
      headers: getSupabaseHeaders({
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify({
        id: item.id,
        indicator: item.indicator,
        type: item.type,
        actor: item.actor,
        confidence: item.confidence,
        severity: item.severity,
        region: item.region,
        blocked: item.blocked,
        last_seen: item.lastSeen,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function persistAssetToBackend(asset: Asset): Promise<boolean> {
  if (!isSupabaseConfigured || !supabaseUrl) return false;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/assets`, {
      method: "POST",
      headers: getSupabaseHeaders({
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify({
        id: asset.id,
        hostname: asset.hostname,
        type: asset.type,
        ip: asset.ip,
        environment: asset.environment,
        owner: asset.owner,
        risk_score: asset.riskScore,
        status: asset.status,
        last_checkin: asset.lastCheckin,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function persistVulnerabilityToBackend(vuln: Vulnerability): Promise<boolean> {
  if (!isSupabaseConfigured || !supabaseUrl) return false;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/vulnerabilities`, {
      method: "POST",
      headers: getSupabaseHeaders({
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify({
        id: vuln.id,
        cve: vuln.cve,
        package_name: vuln.packageName,
        cvss: vuln.cvss,
        severity: vuln.severity,
        affected_hosts: vuln.affectedHosts,
        status: vuln.status,
        fix_version: vuln.fixVersion,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function persistReportToBackend(report: ReportItem): Promise<boolean> {
  if (!isSupabaseConfigured || !supabaseUrl) return false;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/reports`, {
      method: "POST",
      headers: getSupabaseHeaders({
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify({
        id: report.id,
        title: report.title,
        framework: report.framework,
        period: report.period,
        generated_at: report.generatedAt,
        author: report.author,
        status: report.status,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
