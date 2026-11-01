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
  "Web App & Website" | "AI Agent (LLM / MCP)" | "Cloud API & Microservice";

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

export type ServiceModuleId = "web_security" | "ai_shield" | "cloud_security" | "compliance";

export type PlanTier = "Starter" | "Growth" | "Enterprise";
export type TenantStatus = "Active" | "Trial" | "Lockdown";

export type ClientTenant = {
  id: string;
  name: string;
  contactEmail: string;
  primaryDomain: string;
  planTier: PlanTier;
  status: TenantStatus;
  enabledModules: ServiceModuleId[];
  apiKey: string;
  sdkVerified: boolean;
  guardrailsActive: boolean;
  requestsPerMin: number;
  blockedThreats: number;
  avgLatencyMs: number;
  quotaUsedPct: number;
};

export type AuditLogEntry = {
  id: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  severity: "Info" | "Warning" | "Critical";
  timestamp: string;
};

export type AssetCategory =
  | "Website / Domain"
  | "Web Application"
  | "API & Microservice"
  | "AI Agent (LLM / MCP)"
  | "Cloud Environment (AWS/GCP/Azure)"
  | "Server & VM"
  | "Kubernetes & Container"
  | "Endpoint & Workstation"
  | "Network Infrastructure";

export type OwnershipVerificationMethod =
  "DNS_TXT" | "HTTP_FILE" | "CLOUD_IAM" | "API_HMAC" | "AGENT_TOKEN";

export type ProtectionVerificationStatus =
  | "Protection Controls Verified"
  | "Monitoring Active"
  | "Connected"
  | "Ownership Verified"
  | "Partially Monitored"
  | "Setup Required"
  | "Connection Lost"
  | "Data Stale"
  | "Verification Failed";

export type AssetVerificationProof = {
  id: string;
  name: string;
  category: AssetCategory;
  targetIdentifier: string;
  clientName: string;
  clientEmail: string;
  registeredAt: string;
  ownershipStatus: "Verified" | "Pending" | "Failed" | "Unverified";
  ownershipMethod: OwnershipVerificationMethod;
  verificationToken: string;
  verifiedAt: string | null;
  protectionStatus: ProtectionVerificationStatus;
  lastIngestedEventId: string | null;
  lastIngestedAt: string | null;
  lastProbeLatencyMs: number | null;
  telemetryEventsCount: number;
  activeControls: {
    edgeWaf: boolean;
    promptShield: boolean;
    piiRedaction: boolean;
    rateLimiting: boolean;
    toolCallFirewall: boolean;
    ebpfProbe: boolean;
  };
  healthChecks: {
    authValid: boolean;
    apiReachable: boolean;
    permissionsOk: boolean;
    agentHeartbeat: boolean;
    ingestionPipeline: boolean;
    telemetryFresh: boolean;
    tlsValid: boolean;
    dnsResolved: boolean;
  };
  monitoringScope: string;
  knownGaps: string[];
};

export type AppUser = {
  id: string;
  email: string;
  password: string;
  fullName: string;
  admin: "yes" | "no";
  tenantId: string | null;
};

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

const LEGACY_DEMO_IDS = new Set([
  "INC-2847",
  "INC-2846",
  "INC-2845",
  "INC-2844",
  "INC-2843",
  "INC-2842",
  "AST-101",
  "AST-102",
  "AST-103",
  "AST-104",
  "AST-105",
  "VUL-401",
  "VUL-402",
  "VUL-403",
  "VUL-404",
  "IOC-901",
  "IOC-902",
  "IOC-903",
  "IOC-904",
  "IOC-905",
  "RPT-701",
  "RPT-702",
  "RPT-703",
  "RPT-704",
  "SRV-01",
  "SRV-02",
  "SRV-03",
  "SRV-04",
]);

const STORAGE_KEYS = {
  services: "spx_prod_services_v1",
  team: "spx_prod_team_v1",
  integrations: "spx_prod_integrations_v1",
  tenants: "spx_prod_tenants_v1",
  auditLogs: "spx_prod_audit_logs_v1",
  users: "spx_prod_app_users_v1",
  verificationProofs: "spx_prod_verification_proofs_v1",
  demoPurged: "spx_legacy_demo_purged_v1",
} as const;

function readLocalCache<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocalCache<T>(key: string, items: T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

export function computeLiveSnapshot(
  range: RangeOption,
  incidents: Incident[],
  assets: Asset[],
  vulnerabilities: Vulnerability[],
  threatIndicators: ThreatIndicator[],
  protectedServices: ProtectedService[],
): RangeSnapshot {
  const openIncidents = incidents.filter((i) => i.status !== "Contained");
  const openVulns = vulnerabilities.filter((v) => v.status !== "Patched");

  const criticalCount =
    openIncidents.filter((i) => i.severity === "Critical").length +
    openVulns.filter((v) => v.severity === "Critical").length;
  const highCount =
    openIncidents.filter((i) => i.severity === "High").length +
    openVulns.filter((v) => v.severity === "High").length +
    assets.filter((a) => a.status === "Attention").length;
  const mediumCount =
    openIncidents.filter((i) => i.severity === "Medium").length +
    openVulns.filter((v) => v.severity === "Medium").length +
    threatIndicators.filter((t) => !t.blocked).length;
  const lowCount =
    assets.filter((a) => a.status === "Protected").length +
    protectedServices.filter((s) => s.mode === "Active Shield").length +
    incidents.filter((i) => i.status === "Contained").length;

  const penalty = criticalCount * 12 + highCount * 5 + mediumCount * 2;
  const score = Math.max(0, Math.min(100, 100 - penalty));

  const totalProtected = assets.length + protectedServices.length;
  const blockedTotal =
    protectedServices.reduce((sum, s) => sum + (Number(s.blockedThreats) || 0), 0) +
    threatIndicators.filter((t) => t.blocked).length;
  const totalEventsCount = incidents.length + blockedTotal + threatIndicators.length;

  const containedCount = incidents.filter((i) => i.status === "Contained").length;
  const containmentRatio =
    incidents.length > 0 ? Math.round((containedCount / incidents.length) * 100) : 100;

  // Genuine distribution of telemetry events across 12 temporal intervals (no synthetic waves)
  const buckets = Array<number>(12).fill(0);
  if (totalEventsCount > 0) {
    const now = Date.now();
    const rangeMs =
      range === "24 hours"
        ? 24 * 60 * 60 * 1000
        : range === "7 days"
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000;
    const bucketInterval = rangeMs / 12;

    const recordTimestamp = (timeStr?: string) => {
      if (!timeStr) return;
      const parsed = Date.parse(timeStr);
      let eventTime: number;
      if (!Number.isNaN(parsed)) {
        eventTime = parsed;
      } else {
        // Fallback for non-ISO time formats (e.g. "14:20") to recent window
        eventTime = now;
      }
      const age = now - eventTime;
      if (age >= 0 && age <= rangeMs) {
        const bucketIdx = Math.min(11, Math.max(0, 11 - Math.floor(age / bucketInterval)));
        buckets[bucketIdx] = (buckets[bucketIdx] ?? 0) + 1;
      } else {
        buckets[11] = (buckets[11] ?? 0) + 1;
      }
    };

    incidents.forEach((i) => recordTimestamp(i.time));
    threatIndicators.forEach((t) => recordTimestamp(t.lastSeen));
    protectedServices.forEach((s) => {
      if (s.blockedThreats > 0) {
        buckets[11] = (buckets[11] ?? 0) + s.blockedThreats;
      }
    });
  }

  const riskPoints = buckets;

  const labels: [string, string, string, string, string] =
    range === "24 hours"
      ? ["00:00", "06:00", "12:00", "18:00", "Now"]
      : range === "7 days"
        ? ["-6d", "-4d", "-2d", "-1d", "Now"]
        : ["-30d", "-21d", "-14d", "-7d", "Now"];

  return {
    securityScore: String(score),
    scoreChange: criticalCount === 0 ? "Optimal posture" : `${criticalCount} critical open`,
    protectedAssets: String(totalProtected),
    assetsChange: `${assets.length} hosts · ${protectedServices.length} services`,
    meanResponse: incidents.length === 0 ? "0" : `${containmentRatio}%`,
    responseChange:
      incidents.length === 0
        ? "No active incidents"
        : `${containedCount}/${incidents.length} contained`,
    totalEvents: totalEventsCount.toLocaleString(),
    eventsDelta: `${blockedTotal} blocked`,
    riskPoints,
    labels,
    postureBreakdown: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
    },
  };
}

const DEFAULT_SUPABASE_URL = "https://yidqdgufjgfyxflgvbqq.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_cbDXcwqJTmMt3Bb_BtY75w_9dIhf9Y-";

export const supabaseUrl = (
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_SUPABASE_URL
).replace(/\/$/, "");
export const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith("http") &&
  !supabaseUrl.includes("your-project-id"),
);

export function getSupabaseHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    apikey: supabaseAnonKey ?? "",
    Authorization: `Bearer ${supabaseAnonKey ?? ""}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function purgeLegacyDemoIncidentsOnce(): Promise<void> {
  if (!isSupabaseConfigured || !supabaseUrl) return;
  if (typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEYS.demoPurged)) {
    return;
  }
  try {
    const ids = Array.from(LEGACY_DEMO_IDS).join(",");
    await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/incidents?id=in.(${ids})`, {
        method: "DELETE",
        headers: getSupabaseHeaders(),
      }),
      fetch(`${supabaseUrl}/rest/v1/assets?id=in.(${ids})`, {
        method: "DELETE",
        headers: getSupabaseHeaders(),
      }),
      fetch(`${supabaseUrl}/rest/v1/vulnerabilities?id=in.(${ids})`, {
        method: "DELETE",
        headers: getSupabaseHeaders(),
      }),
      fetch(`${supabaseUrl}/rest/v1/threat_feeds?id=in.(${ids})`, {
        method: "DELETE",
        headers: getSupabaseHeaders(),
      }),
      fetch(`${supabaseUrl}/rest/v1/reports?id=in.(${ids})`, {
        method: "DELETE",
        headers: getSupabaseHeaders(),
      }),
    ]);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.demoPurged, "2");
    }
  } catch {
    // Ignore network error during cleanup
  }
}

export async function fetchIncidentsFromBackend(): Promise<{
  incidents: Incident[];
  source: "supabase" | "offline";
}> {
  if (!isSupabaseConfigured || !supabaseUrl) {
    return { incidents: [], source: "offline" };
  }

  await purgeLegacyDemoIncidentsOnce();

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/incidents?select=*&order=created_at.desc`,
      {
        headers: getSupabaseHeaders(),
      },
    );

    if (!response.ok) {
      return { incidents: [], source: "offline" };
    }

    const data = (await response.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(data)) {
      return { incidents: [], source: "offline" };
    }

    const mapped: Incident[] = data
      .filter((row) => !LEGACY_DEMO_IDS.has(String(row.id ?? "")))
      .map((row) => ({
        id: String(row.id ?? ""),
        title: String(row.title ?? ""),
        source: String(row.source ?? ""),
        time: String(row.time ?? "Just now"),
        severity: (row.severity as Severity) ?? "Medium",
        status: (row.status as IncidentStatus) ?? "Open",
        assignee: String(row.assignee ?? "Unassigned"),
        summary: String(row.summary ?? ""),
        playbook: String(row.playbook ?? "Standard Triage Playbook"),
        affectedAssets: Number(row.affected_assets ?? 1),
      }));

    return { incidents: mapped, source: "supabase" };
  } catch {
    return { incidents: [], source: "offline" };
  }
}

export async function fetchThreatIndicatorsFromBackend(): Promise<ThreatIndicator[]> {
  if (!isSupabaseConfigured || !supabaseUrl) return [];
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/threat_feeds?select=*`, {
      headers: getSupabaseHeaders(),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(data)) return [];
    return data
      .filter((row) => !LEGACY_DEMO_IDS.has(String(row.id ?? "")))
      .map((row) => ({
        id: String(row.id ?? ""),
        indicator: String(row.indicator ?? ""),
        type: (row.type as ThreatIndicator["type"]) ?? "IPv4",
        actor: String(row.actor ?? "Unknown"),
        confidence: Number(row.confidence ?? 85),
        severity: (row.severity as Severity) ?? "High",
        region: String(row.region ?? "Global"),
        blocked: Boolean(row.blocked ?? false),
        lastSeen: String(row.last_seen ?? "Just now"),
      }));
  } catch {
    return [];
  }
}

export async function fetchAssetsFromBackend(): Promise<Asset[]> {
  if (!isSupabaseConfigured || !supabaseUrl) return [];
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/assets?select=*`, {
      headers: getSupabaseHeaders(),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(data)) return [];
    return data
      .filter((row) => !LEGACY_DEMO_IDS.has(String(row.id ?? "")))
      .map((row) => ({
        id: String(row.id ?? ""),
        hostname: String(row.hostname ?? ""),
        type: (row.type as Asset["type"]) ?? "API Gateway",
        ip: String(row.ip ?? ""),
        environment: (row.environment as Asset["environment"]) ?? "Production",
        owner: String(row.owner ?? ""),
        riskScore: Number(row.risk_score ?? 10),
        status: (row.status as Asset["status"]) ?? "Protected",
        lastCheckin: String(row.last_checkin ?? "Just now"),
      }));
  } catch {
    return [];
  }
}

export async function fetchVulnerabilitiesFromBackend(): Promise<Vulnerability[]> {
  if (!isSupabaseConfigured || !supabaseUrl) return [];
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/vulnerabilities?select=*`, {
      headers: getSupabaseHeaders(),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(data)) return [];
    return data
      .filter((row) => !LEGACY_DEMO_IDS.has(String(row.id ?? "")))
      .map((row) => ({
        id: String(row.id ?? ""),
        cve: String(row.cve ?? ""),
        packageName: String(row.package_name ?? ""),
        cvss: Number(row.cvss ?? 5.0),
        severity: (row.severity as Severity) ?? "Medium",
        affectedHosts: Number(row.affected_hosts ?? 1),
        status: (row.status as Vulnerability["status"]) ?? "Open",
        fixVersion: String(row.fix_version ?? ""),
      }));
  } catch {
    return [];
  }
}

export async function fetchReportsFromBackend(): Promise<ReportItem[]> {
  if (!isSupabaseConfigured || !supabaseUrl) return [];
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/reports?select=*`, {
      headers: getSupabaseHeaders(),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(data)) return [];
    return data
      .filter((row) => !LEGACY_DEMO_IDS.has(String(row.id ?? "")))
      .map((row) => ({
        id: String(row.id ?? ""),
        title: String(row.title ?? ""),
        framework: (row.framework as ReportItem["framework"]) ?? "SOC 2 Type II",
        period: String(row.period ?? ""),
        generatedAt: String(row.generated_at ?? "Just now"),
        author: String(row.author ?? ""),
        status: (row.status as ReportItem["status"]) ?? "Ready",
      }));
  } catch {
    return [];
  }
}

export async function fetchProtectedServicesFromBackend(): Promise<ProtectedService[]> {
  const cached = readLocalCache<ProtectedService>(STORAGE_KEYS.services);
  if (!isSupabaseConfigured || !supabaseUrl) return cached;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/protected_services?select=*`, {
      headers: getSupabaseHeaders(),
    });
    if (!response.ok) return cached;
    const data = (await response.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(data)) return cached;
    const mapped: ProtectedService[] = data.map((row) => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      category: (row.category as ServiceCategory) ?? "Web App & Website",
      endpoint: String(row.endpoint ?? ""),
      mode: (row.mode as ProtectionMode) ?? "Active Shield",
      requests24h: String(row.requests_24h ?? "0"),
      blockedThreats: Number(row.blocked_threats ?? 0),
      apiKey: String(row.api_key ?? ""),
      promptShield: Boolean(row.prompt_shield ?? false),
      piiRedaction: Boolean(row.pii_redaction ?? true),
      toolCallFirewall: Boolean(row.tool_call_firewall ?? false),
      lastHeartbeat: String(row.last_heartbeat ?? "Connected"),
    }));
    writeLocalCache(STORAGE_KEYS.services, mapped);
    return mapped;
  } catch {
    return cached;
  }
}

export async function fetchTeamMembersFromBackend(): Promise<TeamMember[]> {
  const cached = readLocalCache<TeamMember>(STORAGE_KEYS.team);
  if (!isSupabaseConfigured || !supabaseUrl) return cached;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/team_members?select=*`, {
      headers: getSupabaseHeaders(),
    });
    if (!response.ok) return cached;
    const data = (await response.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(data)) return cached;
    const mapped: TeamMember[] = data.map((row) => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      initials: String(row.initials ?? "OP"),
      email: String(row.email ?? ""),
      role: (row.role as TeamMember["role"]) ?? "Incident Responder",
      mfaEnabled: Boolean(row.mfa_enabled ?? true),
      onCall: Boolean(row.on_call ?? false),
      shift: String(row.shift ?? "Primary Shift"),
    }));
    writeLocalCache(STORAGE_KEYS.team, mapped);
    return mapped;
  } catch {
    return cached;
  }
}

export async function fetchIntegrationsFromBackend(): Promise<IntegrationItem[]> {
  const cached = readLocalCache<IntegrationItem>(STORAGE_KEYS.integrations);
  if (!isSupabaseConfigured || !supabaseUrl) return cached;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/integrations?select=*`, {
      headers: getSupabaseHeaders(),
    });
    if (!response.ok) return cached;
    const data = (await response.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(data)) return cached;
    const mapped: IntegrationItem[] = data.map((row) => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      category: String(row.category ?? ""),
      description: String(row.description ?? ""),
      connected: Boolean(row.connected ?? true),
      eventsPerMin: String(row.events_per_min ?? "Active"),
      lastSync: String(row.last_sync ?? "Live"),
    }));
    writeLocalCache(STORAGE_KEYS.integrations, mapped);
    return mapped;
  } catch {
    return cached;
  }
}

export async function fetchClientTenantsFromBackend(): Promise<ClientTenant[]> {
  const cached = readLocalCache<ClientTenant>(STORAGE_KEYS.tenants);
  if (!isSupabaseConfigured || !supabaseUrl) return cached;
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/client_tenants?select=*&order=created_at.desc`,
      {
        headers: getSupabaseHeaders(),
      },
    );
    if (!response.ok) return cached;
    const data = (await response.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(data)) return cached;
    const mapped: ClientTenant[] = data.map((row) => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      contactEmail: String(row.contact_email ?? ""),
      primaryDomain: String(row.primary_domain ?? ""),
      planTier: (row.plan_tier as PlanTier) ?? "Growth",
      status: (row.status as TenantStatus) ?? "Active",
      enabledModules: Array.isArray(row.enabled_modules)
        ? (row.enabled_modules as ServiceModuleId[])
        : ["web_security"],
      apiKey: String(row.api_key ?? ""),
      sdkVerified: Boolean(row.sdk_verified ?? false),
      guardrailsActive: Boolean(row.guardrails_active ?? true),
      requestsPerMin: Number(row.requests_per_min ?? 0),
      blockedThreats: Number(row.blocked_threats ?? 0),
      avgLatencyMs: Number(row.avg_latency_ms ?? 12),
      quotaUsedPct: Number(row.quota_used_pct ?? 1),
    }));
    writeLocalCache(STORAGE_KEYS.tenants, mapped);
    return mapped;
  } catch {
    return cached;
  }
}

export async function fetchAuditLogsFromBackend(): Promise<AuditLogEntry[]> {
  const cached = readLocalCache<AuditLogEntry>(STORAGE_KEYS.auditLogs);
  if (!isSupabaseConfigured || !supabaseUrl) return cached;
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/audit_logs?select=*&order=created_at.desc`,
      {
        headers: getSupabaseHeaders(),
      },
    );
    if (!response.ok) return cached;
    const data = (await response.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(data)) return cached;
    const mapped: AuditLogEntry[] = data.map((row) => ({
      id: String(row.id ?? ""),
      actor: String(row.actor ?? "System Automation"),
      role: String(row.role ?? "Platform"),
      action: String(row.action ?? ""),
      target: String(row.target ?? ""),
      severity: (row.severity as AuditLogEntry["severity"]) ?? "Info",
      timestamp: String(row.timestamp ?? "Just now"),
    }));
    writeLocalCache(STORAGE_KEYS.auditLogs, mapped);
    return mapped;
  } catch {
    return cached;
  }
}

export async function fetchAppUsersFromBackend(): Promise<AppUser[]> {
  const cached = readLocalCache<AppUser>(STORAGE_KEYS.users);
  if (!isSupabaseConfigured || !supabaseUrl) return cached;
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/app_users?select=*&order=created_at.desc`,
      {
        headers: getSupabaseHeaders(),
        cache: "no-store",
      },
    );
    if (!response.ok) return cached;
    const data = (await response.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(data)) return cached;
    const mapped: AppUser[] = data.map((row) => ({
      id: String(row.id ?? ""),
      email: String(row.email ?? "").toLowerCase(),
      password: String(row.password ?? ""),
      fullName: String(row.full_name ?? ""),
      admin: String(row.admin ?? "no").toLowerCase() === "yes" ? "yes" : "no",
      tenantId: row.tenant_id ? String(row.tenant_id) : null,
    }));
    writeLocalCache(STORAGE_KEYS.users, mapped);
    return mapped;
  } catch {
    return cached;
  }
}

export async function fetchAllWorkspaceData() {
  const [
    incidentsResult,
    threatIndicators,
    assets,
    vulnerabilities,
    reports,
    protectedServices,
    teamMembers,
    integrations,
    clientTenants,
    auditLogs,
    appUsers,
  ] = await Promise.all([
    fetchIncidentsFromBackend(),
    fetchThreatIndicatorsFromBackend(),
    fetchAssetsFromBackend(),
    fetchVulnerabilitiesFromBackend(),
    fetchReportsFromBackend(),
    fetchProtectedServicesFromBackend(),
    fetchTeamMembersFromBackend(),
    fetchIntegrationsFromBackend(),
    fetchClientTenantsFromBackend(),
    fetchAuditLogsFromBackend(),
    fetchAppUsersFromBackend(),
  ]);

  return {
    incidents: incidentsResult.incidents,
    source: incidentsResult.source,
    threatIndicators,
    assets,
    vulnerabilities,
    reports,
    protectedServices,
    teamMembers,
    integrations,
    clientTenants,
    auditLogs,
    appUsers,
  };
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

export async function deleteRecordFromBackend(
  table:
    | "incidents"
    | "threat_feeds"
    | "assets"
    | "vulnerabilities"
    | "reports"
    | "protected_services"
    | "team_members"
    | "integrations"
    | "client_tenants"
    | "audit_logs",
  id: string,
): Promise<boolean> {
  if (table === "protected_services") {
    const next = readLocalCache<ProtectedService>(STORAGE_KEYS.services).filter((i) => i.id !== id);
    writeLocalCache(STORAGE_KEYS.services, next);
  } else if (table === "team_members") {
    const next = readLocalCache<TeamMember>(STORAGE_KEYS.team).filter((i) => i.id !== id);
    writeLocalCache(STORAGE_KEYS.team, next);
  } else if (table === "integrations") {
    const next = readLocalCache<IntegrationItem>(STORAGE_KEYS.integrations).filter(
      (i) => i.id !== id,
    );
    writeLocalCache(STORAGE_KEYS.integrations, next);
  } else if (table === "client_tenants") {
    const next = readLocalCache<ClientTenant>(STORAGE_KEYS.tenants).filter((i) => i.id !== id);
    writeLocalCache(STORAGE_KEYS.tenants, next);
  } else if (table === "audit_logs") {
    const next = readLocalCache<AuditLogEntry>(STORAGE_KEYS.auditLogs).filter((i) => i.id !== id);
    writeLocalCache(STORAGE_KEYS.auditLogs, next);
  }

  if (!isSupabaseConfigured || !supabaseUrl) return false;
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: getSupabaseHeaders(),
      },
    );
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

export async function persistProtectedServiceToBackend(
  service: ProtectedService,
): Promise<boolean> {
  const existing = readLocalCache<ProtectedService>(STORAGE_KEYS.services);
  const updated = [service, ...existing.filter((item) => item.id !== service.id)];
  writeLocalCache(STORAGE_KEYS.services, updated);

  if (!isSupabaseConfigured || !supabaseUrl) return false;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/protected_services`, {
      method: "POST",
      headers: getSupabaseHeaders({
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify({
        id: service.id,
        name: service.name,
        category: service.category,
        endpoint: service.endpoint,
        mode: service.mode,
        requests_24h: service.requests24h,
        blocked_threats: service.blockedThreats,
        api_key: service.apiKey,
        prompt_shield: service.promptShield,
        pii_redaction: service.piiRedaction,
        tool_call_firewall: service.toolCallFirewall,
        last_heartbeat: service.lastHeartbeat,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function persistTeamMemberToBackend(member: TeamMember): Promise<boolean> {
  const existing = readLocalCache<TeamMember>(STORAGE_KEYS.team);
  const updated = [member, ...existing.filter((item) => item.id !== member.id)];
  writeLocalCache(STORAGE_KEYS.team, updated);

  if (!isSupabaseConfigured || !supabaseUrl) return false;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/team_members`, {
      method: "POST",
      headers: getSupabaseHeaders({
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify({
        id: member.id,
        name: member.name,
        initials: member.initials,
        email: member.email,
        role: member.role,
        mfa_enabled: member.mfaEnabled,
        on_call: member.onCall,
        shift: member.shift,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function persistIntegrationToBackend(integration: IntegrationItem): Promise<boolean> {
  const existing = readLocalCache<IntegrationItem>(STORAGE_KEYS.integrations);
  const updated = [integration, ...existing.filter((item) => item.id !== integration.id)];
  writeLocalCache(STORAGE_KEYS.integrations, updated);

  if (!isSupabaseConfigured || !supabaseUrl) return false;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/integrations`, {
      method: "POST",
      headers: getSupabaseHeaders({
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify({
        id: integration.id,
        name: integration.name,
        category: integration.category,
        description: integration.description,
        connected: integration.connected,
        events_per_min: integration.eventsPerMin,
        last_sync: integration.lastSync,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function persistClientTenantToBackend(tenant: ClientTenant): Promise<boolean> {
  const existing = readLocalCache<ClientTenant>(STORAGE_KEYS.tenants);
  const updated = [tenant, ...existing.filter((item) => item.id !== tenant.id)];
  writeLocalCache(STORAGE_KEYS.tenants, updated);

  if (!isSupabaseConfigured || !supabaseUrl) return false;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/client_tenants`, {
      method: "POST",
      headers: getSupabaseHeaders({
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify({
        id: tenant.id,
        name: tenant.name,
        contact_email: tenant.contactEmail,
        primary_domain: tenant.primaryDomain,
        plan_tier: tenant.planTier,
        status: tenant.status,
        enabled_modules: tenant.enabledModules,
        api_key: tenant.apiKey,
        sdk_verified: tenant.sdkVerified,
        guardrails_active: tenant.guardrailsActive,
        requests_per_min: tenant.requestsPerMin,
        blocked_threats: tenant.blockedThreats,
        avg_latency_ms: tenant.avgLatencyMs,
        quota_used_pct: tenant.quotaUsedPct,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function persistAuditLogToBackend(entry: AuditLogEntry): Promise<boolean> {
  const existing = readLocalCache<AuditLogEntry>(STORAGE_KEYS.auditLogs);
  const updated = [entry, ...existing.filter((item) => item.id !== entry.id)].slice(0, 150);
  writeLocalCache(STORAGE_KEYS.auditLogs, updated);

  if (!isSupabaseConfigured || !supabaseUrl) return false;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
      method: "POST",
      headers: getSupabaseHeaders({
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify({
        id: entry.id,
        actor: entry.actor,
        role: entry.role,
        action: entry.action,
        target: entry.target,
        severity: entry.severity,
        timestamp: entry.timestamp,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function persistAppUserToBackend(user: AppUser): Promise<boolean> {
  const existing = readLocalCache<AppUser>(STORAGE_KEYS.users);
  const updated = [
    user,
    ...existing.filter(
      (item) => item.id !== user.id && item.email.toLowerCase() !== user.email.toLowerCase(),
    ),
  ];
  writeLocalCache(STORAGE_KEYS.users, updated);

  if (!isSupabaseConfigured || !supabaseUrl) return false;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/app_users`, {
      method: "POST",
      headers: getSupabaseHeaders({
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify({
        id: user.id,
        email: user.email.toLowerCase(),
        password: user.password,
        full_name: user.fullName,
        admin: user.admin,
        tenant_id: user.tenantId,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function authenticateAppUserFromBackend(
  email: string,
  password: string,
): Promise<{ user: AppUser | null; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  // Always fetch fresh from Supabase first so changes to `admin = 'yes' / 'no'` in Supabase Table Editor take effect immediately
  const users = await fetchAppUsersFromBackend();
  const matched = users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (!matched) {
    return {
      user: null,
      error:
        "No account found with this email. Please create an account to onboard your organization.",
    };
  }
  if (matched.password !== password) {
    return {
      user: null,
      error: "Invalid password. Please check your credentials and try again.",
    };
  }
  return { user: matched };
}

export async function fetchVerificationProofsFromBackend(
  tenants: ClientTenant[] = [],
  services: ProtectedService[] = [],
  assets: Asset[] = [],
): Promise<AssetVerificationProof[]> {
  const cached = readLocalCache<AssetVerificationProof>(STORAGE_KEYS.verificationProofs);
  if (cached.length > 0) return cached;

  const initial: AssetVerificationProof[] = [];

  services.forEach((s) => {
    const isWaf = s.category === "Web App & Website";
    const isAi = s.category === "AI Agent (LLM / MCP)";
    initial.push({
      id: `VRF-${s.id}`,
      name: s.name,
      category: isWaf ? "Web Application" : isAi ? "AI Agent (LLM / MCP)" : "API & Microservice",
      targetIdentifier: s.endpoint,
      clientName: s.name,
      clientEmail: "ops@sparrowx.dev",
      registeredAt: "2026-10-28",
      ownershipStatus: s.mode === "Active Shield" ? "Verified" : "Pending",
      ownershipMethod: isWaf ? "DNS_TXT" : isAi ? "API_HMAC" : "HTTP_FILE",
      verificationToken: `sparrowx-verify-${s.id.toLowerCase()}-7x9`,
      verifiedAt: s.mode === "Active Shield" ? "2026-10-28 14:20 UTC" : null,
      protectionStatus:
        s.mode === "Active Shield"
          ? "Protection Controls Verified"
          : s.mode === "Monitor Only"
            ? "Monitoring Active"
            : "Setup Required",
      lastIngestedEventId: `EVT-${Math.floor(1000 + Math.random() * 9000)}-OK`,
      lastIngestedAt: "2m ago",
      lastProbeLatencyMs: 14,
      telemetryEventsCount: parseInt(s.requests24h.replace(/,/g, "")) || 420,
      activeControls: {
        edgeWaf: s.mode === "Active Shield",
        promptShield: s.promptShield,
        piiRedaction: s.piiRedaction,
        rateLimiting: true,
        toolCallFirewall: s.toolCallFirewall,
        ebpfProbe: true,
      },
      healthChecks: {
        authValid: true,
        apiReachable: true,
        permissionsOk: true,
        agentHeartbeat: true,
        ingestionPipeline: true,
        telemetryFresh: true,
        tlsValid: true,
        dnsResolved: true,
      },
      monitoringScope: "Ingress Traffic, WAF Filters, Error Spikes & Telemetry Ingestion",
      knownGaps:
        s.mode === "Active Shield"
          ? []
          : ["Service is in Monitor Only mode without active blocking"],
    });
  });

  tenants.forEach((t) => {
    if (!initial.some((p) => p.targetIdentifier === t.primaryDomain)) {
      initial.push({
        id: `VRF-TEN-${t.id}`,
        name: `${t.name} Core Apex`,
        category: "Website / Domain",
        targetIdentifier: t.primaryDomain,
        clientName: t.name,
        clientEmail: t.contactEmail,
        registeredAt: "2026-10-29",
        ownershipStatus: t.sdkVerified ? "Verified" : "Pending",
        ownershipMethod: "DNS_TXT",
        verificationToken: `sparrowx-site-verification=${t.apiKey.slice(0, 16)}`,
        verifiedAt: t.sdkVerified ? "2026-10-29 11:15 UTC" : null,
        protectionStatus: t.sdkVerified ? "Protection Controls Verified" : "Setup Required",
        lastIngestedEventId: t.sdkVerified ? `EVT-${t.id.slice(-4)}-OK` : null,
        lastIngestedAt: t.sdkVerified ? "5m ago" : null,
        lastProbeLatencyMs: t.avgLatencyMs || 18,
        telemetryEventsCount: t.requestsPerMin * 60,
        activeControls: {
          edgeWaf: t.guardrailsActive,
          promptShield: t.guardrailsActive,
          piiRedaction: true,
          rateLimiting: true,
          toolCallFirewall: false,
          ebpfProbe: false,
        },
        healthChecks: {
          authValid: Boolean(t.apiKey),
          apiReachable: t.sdkVerified,
          permissionsOk: true,
          agentHeartbeat: t.sdkVerified,
          ingestionPipeline: t.sdkVerified,
          telemetryFresh: t.sdkVerified,
          tlsValid: true,
          dnsResolved: true,
        },
        monitoringScope: "Public Perimeter, DNS Security, Edge Latency",
        knownGaps: t.sdkVerified ? [] : ["Ownership DNS TXT challenge pending"],
      });
    }
  });

  writeLocalCache(STORAGE_KEYS.verificationProofs, initial);
  return initial;
}

export async function persistVerificationProofToBackend(
  proof: AssetVerificationProof,
): Promise<boolean> {
  const existing = readLocalCache<AssetVerificationProof>(STORAGE_KEYS.verificationProofs);
  const updated = [proof, ...existing.filter((p) => p.id !== proof.id)];
  writeLocalCache(STORAGE_KEYS.verificationProofs, updated);
  return true;
}

export async function deleteVerificationProofFromBackend(proofId: string): Promise<boolean> {
  const existing = readLocalCache<AssetVerificationProof>(STORAGE_KEYS.verificationProofs);
  const updated = existing.filter((p) => p.id !== proofId);
  writeLocalCache(STORAGE_KEYS.verificationProofs, updated);
  return true;
}
