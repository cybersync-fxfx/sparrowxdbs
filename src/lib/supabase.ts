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

const LEGACY_DEMO_INCIDENT_IDS = new Set([
  "INC-2847",
  "INC-2846",
  "INC-2845",
  "INC-2844",
  "INC-2843",
  "INC-2842",
]);

const STORAGE_KEYS = {
  services: "spx_prod_services_v1",
  team: "spx_prod_team_v1",
  integrations: "spx_prod_integrations_v1",
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

  const baseActivity = Math.min(85, Math.max(4, totalEventsCount * 3));
  const riskPoints = Array.from({ length: 12 }, (_, idx) => {
    if (totalEventsCount === 0 && openIncidents.length === 0) {
      return 6;
    }
    const factor = (idx + 1) / 12;
    const wave = idx % 2 === 0 ? 4 : -2;
    return Math.min(110, Math.max(6, Math.round(baseActivity * factor + criticalCount * 6 + wave)));
  });

  const labels: [string, string, string, string, string] =
    range === "24 hours"
      ? ["00:00", "06:00", "12:00", "18:00", "Now"]
      : range === "7 days"
        ? ["-6d", "-4d", "-2d", "-1d", "Now"]
        : ["-30d", "-21d", "-14d", "-7d", "Now"];

  return {
    securityScore: String(score),
    scoreChange:
      criticalCount === 0 ? "Optimal posture" : `${criticalCount} critical open`,
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

function getSupabaseHeaders(extra?: Record<string, string>): HeadersInit {
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
    const ids = Array.from(LEGACY_DEMO_INCIDENT_IDS).join(",");
    const res = await fetch(`${supabaseUrl}/rest/v1/incidents?id=in.(${ids})`, {
      method: "DELETE",
      headers: getSupabaseHeaders(),
    });
    if (res.ok && typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.demoPurged, "1");
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
      .filter((row) => !LEGACY_DEMO_INCIDENT_IDS.has(String(row.id ?? "")))
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
    return data.map((row) => ({
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
    return data.map((row) => ({
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
    return data.map((row) => ({
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
    return data.map((row) => ({
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
  ] = await Promise.all([
    fetchIncidentsFromBackend(),
    fetchThreatIndicatorsFromBackend(),
    fetchAssetsFromBackend(),
    fetchVulnerabilitiesFromBackend(),
    fetchReportsFromBackend(),
    fetchProtectedServicesFromBackend(),
    fetchTeamMembersFromBackend(),
    fetchIntegrationsFromBackend(),
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
    | "integrations",
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
