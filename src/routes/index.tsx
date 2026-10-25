import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Boxes,
  Check,
  CircleHelp,
  Clock3,
  Command,
  Copy,
  Database,
  Download,
  Ellipsis,
  Eye,
  FileSearch,
  Filter,
  Globe2,
  KeyRound,
  Layers3,
  LockKeyhole,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Terminal,
  Trash2,
  Users,
  Wrench,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  AdminPortalView,
  ClientPortalView,
  PortalLoginScreen,
  SERVICE_MODULES,
} from "@/components/portals/ClientAndAdminPortals";
import supabaseSchemaSql from "../../supabase/schema.sql?raw";
import {
  type AppUser,
  type Asset,
  type AuditLogEntry,
  clearAllIncidentsFromBackend,
  type ClientTenant,
  computeLiveSnapshot,
  deleteRecordFromBackend,
  fetchAllWorkspaceData,
  type Incident,
  type IncidentStatus,
  type IntegrationItem,
  isSupabaseConfigured,
  persistAppUserToBackend,
  persistAssetToBackend,
  persistAuditLogToBackend,
  persistClientTenantToBackend,
  persistIncidentToBackend,
  persistIntegrationToBackend,
  persistProtectedServiceToBackend,
  persistReportToBackend,
  persistTeamMemberToBackend,
  persistThreatIndicatorToBackend,
  persistVulnerabilityToBackend,
  type PlanTier,
  type ProtectedService,
  type ProtectionMode,
  type RangeOption,
  type ReportItem,
  type ServiceCategory,
  type ServiceModuleId,
  type Severity,
  supabaseAnonKey,
  supabaseUrl,
  type TeamMember,
  type ThreatIndicator,
  type Vulnerability,
} from "@/lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SparrowX | Security operations" },
      {
        name: "description",
        content: "Production security operations, live incident response, and Web & AI Agent guardrails.",
      },
      { property: "og:title", content: "SparrowX | Security operations" },
      {
        property: "og:description",
        content: "Production security operations, live incident response, and Web & AI Agent guardrails.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [threatIndicators, setThreatIndicators] = useState<ThreatIndicator[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [protectedServices, setProtectedServices] = useState<ProtectedService[]>([]);
  const [clientTenants, setClientTenants] = useState<ClientTenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // 3-Tier Portal Mode: "client" (Dynamic Client Portal) | "soc" (SparrowX SOC) | "admin" (Subscriptions & Access Control)
  const [portalMode, setPortalMode] = useState<"client" | "soc" | "admin">("client");
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authSession, setAuthSession] = useState<
    | { role: "unauthenticated" }
    | { role: "client"; tenantId: string | null; userEmail: string }
    | { role: "admin"; operatorName: string; operatorEmail: string }
  >({ role: "unauthenticated" });

  // Internal SparrowX Access Control policies
  const [staffMfaEnforced, setStaffMfaEnforced] = useState(true);
  const [jitTenantApproval, setJitTenantApproval] = useState(true);
  const [ipAllowlistStrict, setIpAllowlistStrict] = useState(true);

  // Web App & AI Agent onboarding state
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceCategory, setNewServiceCategory] =
    useState<ServiceCategory>("AI Agent (LLM / MCP)");
  const [newServiceEndpoint, setNewServiceEndpoint] = useState("");
  const [sdkServiceId, setSdkServiceId] = useState<string | null>(null);

  // Navigation & layout state
  const [activeNav, setActiveNav] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapseMode, setSidebarCollapseMode] = useState<"icon" | "offcanvas">("icon");
  const [incidentFilter, setIncidentFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<RangeOption>("24 hours");
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  // Backend & Incident Triage / Creation state
  const [backendSource, setBackendSource] = useState<"supabase" | "offline">(
    isSupabaseConfigured ? "supabase" : "offline",
  );
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newSeverity, setNewSeverity] = useState<Severity>("High");
  const [newAssignee, setNewAssignee] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [newPlaybook, setNewPlaybook] = useState("Standard Triage Playbook");

  // Section-specific creation forms & filters
  const [assetEnvFilter, setAssetEnvFilter] = useState("All");
  const [newAssetHostname, setNewAssetHostname] = useState("");
  const [newAssetType, setNewAssetType] = useState<Asset["type"]>("API Gateway");
  const [newAssetIp, setNewAssetIp] = useState("");
  const [newAssetEnv, setNewAssetEnv] = useState<Asset["environment"]>("Production");
  const [newAssetOwner, setNewAssetOwner] = useState("");

  const [vulnFilter, setVulnFilter] = useState("All");
  const [newVulnCve, setNewVulnCve] = useState("");
  const [newVulnPackage, setNewVulnPackage] = useState("");
  const [newVulnCvss, setNewVulnCvss] = useState("7.5");
  const [newVulnSeverity, setNewVulnSeverity] = useState<Severity>("High");
  const [newVulnFix, setNewVulnFix] = useState("");

  const [newIocValue, setNewIocValue] = useState("");
  const [newIocActor, setNewIocActor] = useState("");
  const [newIocSeverity, setNewIocSeverity] = useState<Severity>("High");
  const [newIocRegion, setNewIocRegion] = useState("Global");

  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<TeamMember["role"]>("Incident Responder");
  const [newMemberShift, setNewMemberShift] = useState("Primary On-Call");

  const [newIntegrationName, setNewIntegrationName] = useState("");
  const [newIntegrationCategory, setNewIntegrationCategory] = useState("Cloud Telemetry");
  const [newIntegrationDesc, setNewIntegrationDesc] = useState("");

  const [autoContainCritical, setAutoContainCritical] = useState(true);
  const [realtimePagerDuty, setRealtimePagerDuty] = useState(true);
  const [enforceStrictMfa, setEnforceStrictMfa] = useState(true);

  const showToast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  };

  useEffect(() => {
    let active = true;
    setIsLoadingWorkspace(true);
    fetchAllWorkspaceData().then((data) => {
      if (!active) return;
      setIncidents(data.incidents);
      setBackendSource(data.source);
      setThreatIndicators(data.threatIndicators);
      setAssets(data.assets);
      setVulnerabilities(data.vulnerabilities);
      setReports(data.reports);
      setProtectedServices(data.protectedServices);
      setTeamMembers(data.teamMembers);
      setIntegrations(data.integrations);
      setClientTenants(data.clientTenants);
      if (data.clientTenants.length > 0) {
        setSelectedTenantId((prev) => prev ?? data.clientTenants[0].id);
      }
      setAuditLogs(data.auditLogs);
      setIsLoadingWorkspace(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const syncWithBackend = async () => {
    setIsSyncing(true);
    const data = await fetchAllWorkspaceData();
    setIncidents(data.incidents);
    setBackendSource(data.source);
    setThreatIndicators(data.threatIndicators);
    setAssets(data.assets);
    setVulnerabilities(data.vulnerabilities);
    setReports(data.reports);
    setProtectedServices(data.protectedServices);
    setTeamMembers(data.teamMembers);
    setIntegrations(data.integrations);
    setClientTenants(data.clientTenants);
    setAuditLogs(data.auditLogs);
    setIsSyncing(false);
    showToast(
      data.source === "supabase"
        ? "Synced live records from Supabase"
        : "Unable to reach Supabase — check connection settings",
    );
  };

  const handlePurgeAllIncidents = async () => {
    setIsSyncing(true);
    await clearAllIncidentsFromBackend();
    setIncidents([]);
    setIsSyncing(false);
    showToast("All incident records purged from Supabase");
  };

  const handleAddProtectedService = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newServiceName.trim() || !newServiceEndpoint.trim()) return;
    const isAi = newServiceCategory === "AI Agent (LLM / MCP)";
    const prefix = isAi ? "ai" : newServiceCategory === "Web App & Website" ? "web" : "api";
    const created: ProtectedService = {
      id: `SRV-${Date.now().toString().slice(-4)}`,
      name: newServiceName.trim(),
      category: newServiceCategory,
      endpoint: newServiceEndpoint.trim(),
      mode: "Active Shield",
      requests24h: "0",
      blockedThreats: 0,
      apiKey: `spx_live_${prefix}_${Math.random().toString(16).slice(2, 10)}`,
      promptShield: isAi,
      piiRedaction: true,
      toolCallFirewall: isAi,
      lastHeartbeat: "Connected",
    };
    setProtectedServices((current) => [created, ...current]);
    setNewServiceName("");
    setNewServiceEndpoint("");
    setSdkServiceId(created.id);
    await persistProtectedServiceToBackend(created);
    showToast(`${created.name} onboarded — production SDK key generated`);
  };

  const updateServiceMode = async (id: string, mode: ProtectionMode) => {
    let updatedItem: ProtectedService | null = null;
    setProtectedServices((current) =>
      current.map((srv) => {
        if (srv.id === id) {
          updatedItem = { ...srv, mode };
          return updatedItem;
        }
        return srv;
      }),
    );
    if (updatedItem) {
      await persistProtectedServiceToBackend(updatedItem);
      showToast(`${(updatedItem as ProtectedService).name} set to ${mode}`);
    }
  };

  const toggleServiceGuardrail = async (
    id: string,
    field: "promptShield" | "piiRedaction" | "toolCallFirewall",
  ) => {
    let updatedItem: ProtectedService | null = null;
    setProtectedServices((current) =>
      current.map((srv) => {
        if (srv.id === id) {
          updatedItem = { ...srv, [field]: !srv[field] };
          return updatedItem;
        }
        return srv;
      }),
    );
    if (updatedItem) {
      await persistProtectedServiceToBackend(updatedItem);
    }
    showToast("Updated service guardrail policy");
  };

  const handleDeleteProtectedService = async (id: string) => {
    setProtectedServices((current) => current.filter((srv) => srv.id !== id));
    await deleteRecordFromBackend("protected_services", id);
    showToast("Service removed");
  };

  const sendVerificationEventForService = async (srv: ProtectedService) => {
    const created: Incident = {
      id: `INC-${Date.now().toString().slice(-4)}`,
      title: `Webhook verification ping from ${srv.name}`,
      source: `${srv.category} · ${srv.endpoint}`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      severity: "Medium",
      status: "Open",
      assignee: teamMembers[0]?.name ?? "Unassigned",
      summary: `Production telemetry verification event emitted for service ${srv.name} (${srv.id}).`,
      playbook: "Automated Web & AI Shield Playbook",
      affectedAssets: 1,
    };
    setIncidents((current) => [created, ...current]);
    await persistIncidentToBackend(created);
    showToast(`Verification event ${created.id} persisted to Supabase`);
  };

  const selectedIncident = useMemo(
    () => incidents.find((item) => item.id === selectedIncidentId) ?? null,
    [incidents, selectedIncidentId],
  );

  const currentSnapshot = useMemo(
    () =>
      computeLiveSnapshot(
        range,
        incidents,
        assets,
        vulnerabilities,
        threatIndicators,
        protectedServices,
      ),
    [range, incidents, assets, vulnerabilities, threatIndicators, protectedServices],
  );

  const chartPath = useMemo(
    () =>
      currentSnapshot.riskPoints
        .map(
          (value, index) =>
            `${index === 0 ? "M" : "L"} ${(index / Math.max(1, currentSnapshot.riskPoints.length - 1)) * 720} ${126 - value}`,
        )
        .join(" "),
    [currentSnapshot],
  );

  const openIncidentCount = useMemo(
    () => incidents.filter((item) => item.status !== "Contained").length,
    [incidents],
  );

  const criticalOpenCount = useMemo(
    () =>
      incidents.filter((item) => item.status !== "Contained" && item.severity === "Critical")
        .length,
    [incidents],
  );

  const openVulnCount = useMemo(
    () => vulnerabilities.filter((item) => item.status !== "Patched").length,
    [vulnerabilities],
  );

  const filteredIncidents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return incidents.filter((incident) => {
      const matchesFilter =
        incidentFilter === "All" ||
        incident.severity === incidentFilter ||
        incident.status === incidentFilter;
      const matchesSearch =
        !normalizedSearch ||
        `${incident.title} ${incident.id} ${incident.source} ${incident.assignee}`
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesFilter && matchesSearch;
    });
  }, [incidents, incidentFilter, search]);

  const resolveIncident = async (id: string) => {
    let updatedItem: Incident | null = null;
    setIncidents((current) =>
      current.map((incident) => {
        if (incident.id === id) {
          updatedItem = { ...incident, status: "Contained" };
          return updatedItem;
        }
        return incident;
      }),
    );
    if (updatedItem) {
      await persistIncidentToBackend(updatedItem);
    }
    showToast(`${id} marked as contained`);
  };

  const deleteIncident = async (id: string) => {
    setIncidents((current) => current.filter((incident) => incident.id !== id));
    if (selectedIncidentId === id) {
      setSelectedIncidentId(null);
    }
    await deleteRecordFromBackend("incidents", id);
    showToast(`Deleted incident ${id}`);
  };

  const updateIncidentField = async (
    id: string,
    patch: Partial<Pick<Incident, "status" | "severity" | "assignee">>,
  ) => {
    let updatedItem: Incident | null = null;
    setIncidents((current) =>
      current.map((incident) => {
        if (incident.id === id) {
          updatedItem = { ...incident, ...patch };
          return updatedItem;
        }
        return incident;
      }),
    );
    if (updatedItem) {
      await persistIncidentToBackend(updatedItem);
    }
    showToast(`Updated ${id}`);
  };

  const handleCreateIncident = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTitle.trim() || !newSource.trim()) return;
    const created: Incident = {
      id: `INC-${Date.now().toString().slice(-4)}`,
      title: newTitle.trim(),
      source: newSource.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      severity: newSeverity,
      status: "Investigating",
      assignee: newAssignee.trim() || teamMembers[0]?.name || "Unassigned",
      summary: newSummary.trim() || "Incident logged for triage and containment review.",
      playbook: newPlaybook.trim() || "Standard Triage Playbook",
      affectedAssets: 1,
    };
    setIncidents((current) => [created, ...current]);
    setShowCreateModal(false);
    setNewTitle("");
    setNewSource("");
    setNewSummary("");
    setSelectedIncidentId(created.id);
    await persistIncidentToBackend(created);
    showToast(`${created.id} created and persisted to Supabase`);
  };

  const exportIncidents = () => {
    const rows = [
      ["ID", "Incident", "Source", "Severity", "Status", "Assignee", "Time"],
      ...filteredIncidents.map((incident) => [
        incident.id,
        incident.title,
        incident.source,
        incident.severity,
        incident.status,
        incident.assignee,
        incident.time,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "sparrowx-incidents.csv";
    link.click();
    URL.revokeObjectURL(url);
    showToast("Incident report exported");
  };

  const toggleBlockIndicator = async (id: string) => {
    let updated: ThreatIndicator | null = null;
    setThreatIndicators((current) =>
      current.map((item) => {
        if (item.id === id) {
          updated = { ...item, blocked: !item.blocked };
          return updated;
        }
        return item;
      }),
    );
    if (updated) {
      await persistThreatIndicatorToBackend(updated);
      showToast(
        `${(updated as ThreatIndicator).indicator} ${(updated as ThreatIndicator).blocked ? "blocked at edge firewall" : "removed from blocklist"}`,
      );
    }
  };

  const handleAddIndicator = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newIocValue.trim()) return;
    const raw = newIocValue.trim();
    const detectedType: ThreatIndicator["type"] =
      raw.toUpperCase().startsWith("AS") && /^AS\d+/i.test(raw)
        ? "ASN"
        : /^[a-f0-9]{32,64}$/i.test(raw)
          ? "SHA-256"
          : /^\d{1,3}(\.\d{1,3}){3}$/.test(raw)
            ? "IPv4"
            : "Domain";
    const nextIoc: ThreatIndicator = {
      id: `IOC-${Date.now().toString().slice(-4)}`,
      indicator: raw,
      type: detectedType,
      actor: newIocActor.trim() || "Operator Submission",
      confidence: 95,
      severity: newIocSeverity,
      region: newIocRegion.trim() || "Global",
      blocked: true,
      lastSeen: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setThreatIndicators((current) => [nextIoc, ...current]);
    await persistThreatIndicatorToBackend(nextIoc);
    setNewIocValue("");
    setNewIocActor("");
    showToast(`Indicator ${nextIoc.indicator} persisted and blocked`);
  };

  const deleteIndicator = async (id: string) => {
    setThreatIndicators((current) => current.filter((item) => item.id !== id));
    await deleteRecordFromBackend("threat_feeds", id);
    showToast("Indicator removed");
  };

  const handleAddAsset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newAssetHostname.trim() || !newAssetIp.trim()) return;
    const created: Asset = {
      id: `AST-${Date.now().toString().slice(-4)}`,
      hostname: newAssetHostname.trim(),
      type: newAssetType,
      ip: newAssetIp.trim(),
      environment: newAssetEnv,
      owner: newAssetOwner.trim() || "SecOps",
      riskScore: 10,
      status: "Protected",
      lastCheckin: "Connected",
    };
    setAssets((current) => [created, ...current]);
    await persistAssetToBackend(created);
    setNewAssetHostname("");
    setNewAssetIp("");
    setNewAssetOwner("");
    showToast(`Asset ${created.hostname} registered`);
  };

  const toggleAssetIsolation = async (id: string) => {
    let updated: Asset | null = null;
    setAssets((current) =>
      current.map((asset) => {
        if (asset.id !== id) return asset;
        const nextStatus = asset.status === "Isolated" ? "Protected" : "Isolated";
        updated = {
          ...asset,
          status: nextStatus,
          riskScore: nextStatus === "Isolated" ? 15 : asset.riskScore,
        };
        return updated;
      }),
    );
    if (updated) {
      await persistAssetToBackend(updated);
      showToast(
        (updated as Asset).status === "Isolated"
          ? `${(updated as Asset).hostname} isolated from network`
          : `${(updated as Asset).hostname} reconnected to network`,
      );
    }
  };

  const deleteAsset = async (id: string) => {
    setAssets((current) => current.filter((a) => a.id !== id));
    await deleteRecordFromBackend("assets", id);
    showToast("Asset removed");
  };

  const handleAddVulnerability = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newVulnCve.trim() || !newVulnPackage.trim()) return;
    const parsedCvss = Math.min(10, Math.max(0, Number.parseFloat(newVulnCvss) || 7.5));
    const created: Vulnerability = {
      id: `VUL-${Date.now().toString().slice(-4)}`,
      cve: newVulnCve.trim().toUpperCase(),
      packageName: newVulnPackage.trim(),
      cvss: parsedCvss,
      severity: newVulnSeverity,
      affectedHosts: Math.max(1, assets.length || 1),
      status: "Open",
      fixVersion: newVulnFix.trim() || "Latest patched release",
    };
    setVulnerabilities((current) => [created, ...current]);
    await persistVulnerabilityToBackend(created);
    setNewVulnCve("");
    setNewVulnPackage("");
    setNewVulnFix("");
    showToast(`${created.cve} logged to vulnerability queue`);
  };

  const patchVulnerability = async (id: string) => {
    let updated: Vulnerability | null = null;
    setVulnerabilities((current) =>
      current.map((vuln) => {
        if (vuln.id === id) {
          updated = { ...vuln, status: "Patched" };
          return updated;
        }
        return vuln;
      }),
    );
    if (updated) {
      await persistVulnerabilityToBackend(updated);
      showToast(`Marked ${(updated as Vulnerability).cve} as patched`);
    }
  };

  const deleteVulnerability = async (id: string) => {
    setVulnerabilities((current) => current.filter((v) => v.id !== id));
    await deleteRecordFromBackend("vulnerabilities", id);
    showToast("Vulnerability record deleted");
  };

  const generateNewReport = async (framework: ReportItem["framework"]) => {
    const created: ReportItem = {
      id: `RPT-${Date.now().toString().slice(-4)}`,
      title: `${framework} Production Posture Audit (${incidents.length} incidents, ${assets.length} assets)`,
      framework,
      period: `Last ${range}`,
      generatedAt: new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      author: teamMembers[0]?.name ?? "Security Operator",
      status: "Ready",
    };
    setReports((current) => [created, ...current]);
    await persistReportToBackend(created);
    showToast(`${created.framework} report generated and saved`);
  };

  const deleteReport = async (id: string) => {
    setReports((current) => current.filter((r) => r.id !== id));
    await deleteRecordFromBackend("reports", id);
    showToast("Report deleted");
  };

  const handleAddTeamMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;
    const parts = newMemberName.trim().split(/\s+/);
    const initials =
      parts.length >= 2
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : newMemberName.trim().slice(0, 2).toUpperCase();
    const created: TeamMember = {
      id: `USR-${Date.now().toString().slice(-4)}`,
      name: newMemberName.trim(),
      initials,
      email: newMemberEmail.trim(),
      role: newMemberRole,
      mfaEnabled: true,
      onCall: teamMembers.length === 0,
      shift: newMemberShift.trim() || "Primary On-Call",
    };
    setTeamMembers((current) => [created, ...current]);
    await persistTeamMemberToBackend(created);
    setNewMemberName("");
    setNewMemberEmail("");
    showToast(`Added ${created.name} to security team`);
  };

  const toggleMemberOnCall = async (id: string) => {
    let updated: TeamMember | null = null;
    setTeamMembers((current) =>
      current.map((m) => {
        if (m.id === id) {
          updated = { ...m, onCall: !m.onCall };
          return updated;
        }
        return m;
      }),
    );
    if (updated) {
      await persistTeamMemberToBackend(updated);
      showToast(`Updated on-call status for ${(updated as TeamMember).name}`);
    }
  };

  const deleteTeamMember = async (id: string) => {
    setTeamMembers((current) => current.filter((m) => m.id !== id));
    await deleteRecordFromBackend("team_members", id);
    showToast("Team member removed");
  };

  const handleAddIntegration = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newIntegrationName.trim()) return;
    const created: IntegrationItem = {
      id: `INT-${Date.now().toString().slice(-4)}`,
      name: newIntegrationName.trim(),
      category: newIntegrationCategory.trim() || "Telemetry",
      description:
        newIntegrationDesc.trim() || "Production security telemetry & webhook pipeline.",
      connected: true,
      eventsPerMin: "Live",
      lastSync: "Connected",
    };
    setIntegrations((current) => [created, ...current]);
    await persistIntegrationToBackend(created);
    setNewIntegrationName("");
    setNewIntegrationDesc("");
    showToast(`Connected integration ${created.name}`);
  };

  const toggleIntegrationConnection = async (id: string) => {
    let updated: IntegrationItem | null = null;
    setIntegrations((current) =>
      current.map((item) => {
        if (item.id === id) {
          updated = {
            ...item,
            connected: !item.connected,
            lastSync: !item.connected ? "Connected" : "Paused",
          };
          return updated;
        }
        return item;
      }),
    );
    if (updated) {
      await persistIntegrationToBackend(updated);
      showToast(
        `${(updated as IntegrationItem).name} ${(updated as IntegrationItem).connected ? "connected" : "paused"}`,
      );
    }
  };

  const deleteIntegration = async (id: string) => {
    setIntegrations((current) => current.filter((i) => i.id !== id));
    await deleteRecordFromBackend("integrations", id);
    showToast("Integration removed");
  };

  const primaryOperator = teamMembers[0] ?? null;

  const recordAudit = async (
    action: string,
    target: string,
    severity: AuditLogEntry["severity"] = "Info",
  ) => {
    const entry: AuditLogEntry = {
      id: `AUD-${Date.now().toString().slice(-4)}`,
      actor: primaryOperator ? primaryOperator.name : "SparrowX Admin",
      role: primaryOperator ? primaryOperator.role : "Security Admin",
      action,
      target,
      severity,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setAuditLogs((prev) => [entry, ...prev]);
    await persistAuditLogToBackend(entry);
  };

  const handleCreateTenant = async (input: {
    name: string;
    contactEmail: string;
    primaryDomain: string;
    planTier: PlanTier;
    enabledModules: ServiceModuleId[];
  }) => {
    const created: ClientTenant = {
      id: `TNT-${Date.now().toString().slice(-4)}`,
      name: input.name,
      contactEmail: input.contactEmail,
      primaryDomain: input.primaryDomain,
      planTier: input.planTier,
      status: "Active",
      enabledModules: input.enabledModules,
      apiKey: `spx_tenant_live_${Math.random().toString(16).slice(2, 12)}`,
      sdkVerified: false,
      guardrailsActive: true,
      requestsPerMin: 0,
      blockedThreats: 0,
      avgLatencyMs: 11,
      quotaUsedPct: 1,
    };
    setClientTenants((prev) => [created, ...prev]);
    setSelectedTenantId(created.id);
    await persistClientTenantToBackend(created);
    await recordAudit(
      `Provisioned client tenant (${input.planTier}) with modules: ${input.enabledModules.join(", ")}`,
      created.name,
      "Info",
    );
    if (authSession.role === "client") {
      setPortalMode("client");
      setActiveNav("My Services");
      showToast(`${created.name} added to My Services — click it to open dashboard or manage`);
    } else {
      showToast(`${created.name} provisioned`);
    }
  };

  const handleToggleTenantModule = async (tenantId: string, moduleId: ServiceModuleId) => {
    let updatedTenant: ClientTenant | null = null;
    setClientTenants((prev) =>
      prev.map((tenant) => {
        if (tenant.id !== tenantId) return tenant;
        const exists = tenant.enabledModules.includes(moduleId);
        if (exists && tenant.enabledModules.length <= 1) {
          showToast("At least one protection module must remain active");
          return tenant;
        }
        const nextModules = exists
          ? tenant.enabledModules.filter((m) => m !== moduleId)
          : [...tenant.enabledModules, moduleId];
        updatedTenant = { ...tenant, enabledModules: nextModules };
        return updatedTenant;
      }),
    );
    if (updatedTenant) {
      await persistClientTenantToBackend(updatedTenant);
      const modMeta = SERVICE_MODULES.find((m) => m.id === moduleId);
      const isNowActive = (updatedTenant as ClientTenant).enabledModules.includes(moduleId);
      await recordAudit(
        `${isNowActive ? "Enabled" : "Disabled"} module "${modMeta?.shortLabel ?? moduleId}"`,
        (updatedTenant as ClientTenant).name,
        "Info",
      );
      showToast(
        `${modMeta?.shortLabel ?? moduleId} ${isNowActive ? "added to" : "removed from"} ${(updatedTenant as ClientTenant).name} dashboard`,
      );
    }
  };

  const handleVerifyTenantSdk = async (tenant: ClientTenant) => {
    const updated: ClientTenant = {
      ...tenant,
      sdkVerified: true,
      requestsPerMin: Math.max(1, tenant.requestsPerMin + 1),
    };
    setClientTenants((prev) => prev.map((t) => (t.id === tenant.id ? updated : t)));
    await persistClientTenantToBackend(updated);

    const verificationIncident: Incident = {
      id: `INC-${Date.now().toString().slice(-4)}`,
      title: `[${tenant.name}] Automated SDK Telemetry Handshake Verified`,
      source: tenant.primaryDomain,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      severity: "Medium",
      status: "Contained",
      assignee: primaryOperator ? primaryOperator.name : "Autonomous Guardrail",
      summary: `Client workspace ${tenant.name} (${tenant.id}) completed automated SDK webhook verification across modules: ${tenant.enabledModules.join(", ")}.`,
      playbook: "Automated Client Onboarding Verification",
      affectedAssets: 1,
    };
    setIncidents((prev) => [verificationIncident, ...prev]);
    await persistIncidentToBackend(verificationIncident);
    await recordAudit("Verified live SDK telemetry webhook", tenant.name, "Info");
    showToast(`SDK verified for ${tenant.name} — live telemetry connected`);
  };

  const handleToggleTenantLockdown = async (tenantId: string) => {
    let updated: ClientTenant | null = null;
    setClientTenants((prev) =>
      prev.map((t) => {
        if (t.id !== tenantId) return t;
        const nextStatus = t.status === "Lockdown" ? "Active" : "Lockdown";
        updated = { ...t, status: nextStatus };
        return updated;
      }),
    );
    if (updated) {
      await persistClientTenantToBackend(updated);
      const isLockdown = (updated as ClientTenant).status === "Lockdown";
      await recordAudit(
        isLockdown
          ? "Triggered emergency tenant kill-switch lockdown"
          : "Lifted tenant lockdown and restored Active state",
        (updated as ClientTenant).name,
        isLockdown ? "Critical" : "Info",
      );
      showToast(
        isLockdown
          ? `${(updated as ClientTenant).name} placed in emergency Lockdown`
          : `${(updated as ClientTenant).name} restored to Active`,
      );
    }
  };

  const handleRotateTenantKey = async (tenantId: string) => {
    let updated: ClientTenant | null = null;
    setClientTenants((prev) =>
      prev.map((t) => {
        if (t.id !== tenantId) return t;
        updated = {
          ...t,
          apiKey: `spx_tenant_live_${Math.random().toString(16).slice(2, 12)}`,
        };
        return updated;
      }),
    );
    if (updated) {
      await persistClientTenantToBackend(updated);
      await recordAudit("Rotated production tenant API key", (updated as ClientTenant).name, "Warning");
      showToast(`Rotated API key for ${(updated as ClientTenant).name}`);
    }
  };

  const handleDeleteTenant = async (tenantId: string) => {
    const target = clientTenants.find((t) => t.id === tenantId);
    setClientTenants((prev) => prev.filter((t) => t.id !== tenantId));
    if (selectedTenantId === tenantId) {
      setSelectedTenantId(null);
    }
    await deleteRecordFromBackend("client_tenants", tenantId);
    if (target) {
      await recordAudit("Removed client service subscription", target.name, "Warning");
    }
    showToast("Service removed from your account");
  };

  const handleRenameOrUpdateTenant = async (
    tenantId: string,
    updates: Partial<Pick<ClientTenant, "name" | "primaryDomain" | "planTier">>,
  ) => {
    let updatedItem: ClientTenant | null = null;
    setClientTenants((prev) =>
      prev.map((t) => {
        if (t.id !== tenantId) return t;
        updatedItem = { ...t, ...updates };
        return updatedItem;
      }),
    );
    if (updatedItem) {
      await persistClientTenantToBackend(updatedItem);
      await recordAudit(
        `Updated service configuration (${(updatedItem as ClientTenant).name})`,
        (updatedItem as ClientTenant).name,
        "Info",
      );
      showToast(`Updated service ${(updatedItem as ClientTenant).name}`);
    }
  };

  const handleUpdateUserProfile = async (updates: {
    fullName: string;
    email: string;
    newPassword?: string;
  }) => {
    if (!currentUser) return;
    const updatedUser: AppUser = {
      ...currentUser,
      fullName: updates.fullName,
      email: updates.email.toLowerCase(),
      password: updates.newPassword ? updates.newPassword : currentUser.password,
    };
    setCurrentUser(updatedUser);
    await persistAppUserToBackend(updatedUser);
    showToast("Account profile updated in Supabase");
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    setAuthSession({ role: "unauthenticated" });
    setMenuOpen(false);
    showToast("Logged out of account");
  };

  const visibleClientTenants =
    authSession.role === "client"
      ? clientTenants.filter(
          (t) =>
            t.contactEmail.toLowerCase() === authSession.userEmail.toLowerCase() ||
            t.id === authSession.tenantId,
        )
      : clientTenants;

  const activeClientTenant =
    visibleClientTenants.find((t) => t.id === selectedTenantId) ??
    visibleClientTenants[0] ??
    null;

  const handleNavigate = (navLabel: string) => {
    if (authSession.role === "admin") {
      if (
        navLabel === "Client Subscriptions" ||
        navLabel === "Performance & Kill-Switch" ||
        navLabel === "Access Control & Audit"
      ) {
        setPortalMode("admin");
      } else {
        setPortalMode("soc");
      }
    } else {
      setPortalMode("client");
    }
    setActiveNav(navLabel);
  };

  if (authSession.role === "unauthenticated") {
    return (
      <PortalLoginScreen
        backendSource={backendSource}
        onRegisterAndLoginUser={async (input) => {
          let createdTenant: ClientTenant | null = null;
          if (input.orgName && input.primaryDomain) {
            createdTenant = {
              id: `TNT-${Date.now().toString().slice(-4)}`,
              name: input.orgName,
              contactEmail: input.email,
              primaryDomain: input.primaryDomain,
              planTier: input.planTier,
              status: "Active",
              enabledModules: input.enabledModules,
              apiKey: `spx_tenant_live_${Math.random().toString(16).slice(2, 12)}`,
              sdkVerified: false,
              guardrailsActive: true,
              requestsPerMin: 0,
              blockedThreats: 0,
              avgLatencyMs: 11,
              quotaUsedPct: 1,
            };
            setClientTenants((prev) => [createdTenant as ClientTenant, ...prev]);
            setSelectedTenantId(createdTenant.id);
            await persistClientTenantToBackend(createdTenant);
          }

          const createdUser: AppUser = {
            id: `USR-${Date.now().toString().slice(-4)}`,
            email: input.email.toLowerCase(),
            password: input.password,
            fullName: input.fullName,
            admin: "no",
            tenantId: createdTenant?.id ?? null,
          };

          await persistAppUserToBackend(createdUser);
          await recordAudit(
            `Registered user ${createdUser.email} (admin=no)`,
            createdTenant?.name ?? createdUser.email,
            "Info",
          );

          setCurrentUser(createdUser);
          setAuthSession({
            role: "client",
            tenantId: createdTenant?.id ?? null,
            userEmail: createdUser.email,
          });
          setPortalMode("client");
          setActiveNav("My Services");
          showToast(`Welcome ${createdUser.fullName} — Client Area ready`);
          return {};
        }}
        onUserAuthenticated={(user) => {
          setCurrentUser(user);
          if (user.admin === "yes") {
            setAuthSession({
              role: "admin",
              operatorName: user.fullName || "SparrowX Admin",
              operatorEmail: user.email,
            });
            setPortalMode("admin");
            setActiveNav("Client Subscriptions");
            void recordAudit(
              `Admin user ${user.email} (admin=yes) authenticated into Admin Command Center`,
              "Admin & Subscriptions Portal",
              "Info",
            );
            showToast(`Admin session active (${user.email})`);
          } else {
            const matchedTenant =
              clientTenants.find(
                (t) =>
                  t.id === user.tenantId ||
                  t.contactEmail.toLowerCase() === user.email.toLowerCase(),
              ) ?? null;
            if (matchedTenant) {
              setSelectedTenantId(matchedTenant.id);
            }
            setAuthSession({
              role: "client",
              tenantId: matchedTenant?.id ?? user.tenantId,
              userEmail: user.email,
            });
            setPortalMode("client");
            setActiveNav("My Services");
            void recordAudit(
              `Client user ${user.email} (admin=no) authenticated into Client Area`,
              matchedTenant?.name ?? user.email,
              "Info",
            );
            showToast(`Welcome back, ${user.fullName || user.email}`);
          }
        }}
        tenants={clientTenants}
      />
    );
  }

  const userInitials = currentUser?.fullName
    ? currentUser.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "SX";

  return (
    <SidebarProvider
      className="bg-background"
      onOpenChange={setSidebarOpen}
      open={sidebarOpen}
    >
      <AppSidebar
        activeClientTenant={activeClientTenant}
        activeNav={activeNav}
        auditCount={auditLogs.length}
        backendSource={backendSource}
        collapseMode={sidebarCollapseMode}
        currentUser={currentUser}
        incidentCount={openIncidentCount}
        isAdminSession={authSession.role === "admin"}
        onCollapseModeChange={setSidebarCollapseMode}
        onNavigate={handleNavigate}
        onSignOut={handleSignOut}
        portalMode={portalMode}
        serviceCount={protectedServices.length}
        tenantCount={visibleClientTenants.length}
        vulnCount={openVulnCount}
      />
      <SidebarInset className="min-h-svh bg-background">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 backdrop-blur-md sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger
              aria-label="Toggle navigation"
              className="size-9 border border-border bg-card hover:bg-secondary md:hidden"
            />
            <Button
              aria-label={sidebarOpen ? "Minimize sidebar" : "Expand sidebar"}
              className="hidden h-8 gap-1.5 border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-secondary md:inline-flex"
              onClick={() => setSidebarOpen((prev) => !prev)}
              size="sm"
              title={sidebarOpen ? "Minimize sidebar (Ctrl+B)" : "Expand sidebar (Ctrl+B)"}
              variant="outline"
            >
              {sidebarOpen ? (
                <>
                  <PanelLeftClose className="size-3.5 text-primary" />
                  <span>Minimize</span>
                </>
              ) : (
                <>
                  <PanelLeftOpen className="size-3.5 text-primary" />
                  <span>Expand sidebar</span>
                </>
              )}
            </Button>

            <span className="hidden text-muted-foreground/60 sm:block">/</span>
            <span className="truncate text-sm font-semibold text-foreground">
              {activeNav}
            </span>
            <span className="hidden items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground lg:inline-flex">
              <Database className="size-3 text-primary" />
              {backendSource === "supabase" ? "Supabase Live" : "Offline"}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {authSession.role === "admin" && (
              <div className="hidden h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-muted-foreground lg:flex">
                <Search className="size-4" />
                <input
                  aria-label="Search incidents"
                  className="w-40 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search incidents, IOCs..."
                  value={search}
                />
                {search ? (
                  <button
                    aria-label="Clear search"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setSearch("")}
                    type="button"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : (
                  <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    <Command className="inline size-3" /> K
                  </kbd>
                )}
              </div>
            )}
            <Button
              className="h-9 px-3 text-xs"
              onClick={handleSignOut}
              size="sm"
              variant="outline"
            >
              <LockKeyhole className="size-3.5 text-primary" />
              <span>Log Out</span>
            </Button>
            <button
              aria-label="Open account menu"
              className="flex size-9 items-center justify-center rounded-full border border-border bg-secondary text-xs font-bold text-secondary-foreground"
              onClick={() => setMenuOpen(!menuOpen)}
              type="button"
            >
              {userInitials}
            </button>
          </div>
        </header>

        {menuOpen && (
          <div className="absolute right-5 top-14 z-30 w-64 border border-border bg-card p-3.5 shadow-xl">
            <p className="truncate text-sm font-semibold">
              {currentUser?.fullName || "Account"}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {currentUser?.email}
            </p>
            <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-2.5">
              {authSession.role === "client" ? (
                <>
                  <Button
                    className="w-full justify-start text-xs"
                    onClick={() => {
                      handleNavigate("My Services");
                      setMenuOpen(false);
                    }}
                    size="sm"
                    variant="secondary"
                  >
                    <Boxes /> My Services (Client Area)
                  </Button>
                  <Button
                    className="w-full justify-start text-xs"
                    onClick={() => {
                      handleNavigate("Profile Management");
                      setMenuOpen(false);
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    <Users /> Profile Management
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className="w-full justify-start text-xs"
                    onClick={() => {
                      handleNavigate("Client Subscriptions");
                      setMenuOpen(false);
                    }}
                    size="sm"
                    variant="secondary"
                  >
                    <Users /> Client Subscriptions
                  </Button>
                  <Button
                    className="w-full justify-start text-xs"
                    onClick={() => {
                      handleNavigate("Integrations");
                      setMenuOpen(false);
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    <Database /> Supabase connection
                  </Button>
                </>
              )}
              <Button
                className="w-full justify-start text-xs text-destructive hover:text-destructive"
                onClick={handleSignOut}
                size="sm"
                variant="ghost"
              >
                <LockKeyhole /> Log Out to Login Page
              </Button>
            </div>
          </div>
        )}

        <main className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-4 py-7 sm:px-7 lg:px-9">
          {portalMode === "client" &&
            activeNav !== "Help center" &&
            activeNav !== "Settings" && (
            <ClientPortalView
              activeNav={activeNav}
              assets={assets}
              currentUser={currentUser}
              incidents={incidents}
              onCreateTenant={handleCreateTenant}
              onDeleteTenant={handleDeleteTenant}
              onGenerateReport={generateNewReport}
              onNavigate={handleNavigate}
              onOpenServiceSdk={(id) => setSdkServiceId(id)}
              onRenameOrUpdateTenant={handleRenameOrUpdateTenant}
              onSelectTenant={setSelectedTenantId}
              onSignOut={handleSignOut}
              onToggleTenantModule={handleToggleTenantModule}
              onUpdateUserProfile={handleUpdateUserProfile}
              onVerifyTenantSdk={handleVerifyTenantSdk}
              protectedServices={protectedServices}
              reports={reports}
              selectedTenantId={selectedTenantId}
              showToast={showToast}
              supabaseAnonKey={supabaseAnonKey}
              supabaseUrl={supabaseUrl}
              tenants={visibleClientTenants}
              vulnerabilities={vulnerabilities}
            />
          )}

          {portalMode === "admin" &&
            activeNav !== "Help center" &&
            activeNav !== "Settings" && (
            <AdminPortalView
              activeNav={activeNav}
              auditLogs={auditLogs}
              ipAllowlistStrict={ipAllowlistStrict}
              jitTenantApproval={jitTenantApproval}
              onCreateTenant={handleCreateTenant}
              onDeleteTenant={handleDeleteTenant}
              onPreviewClientPortal={(tenantId) => {
                setSelectedTenantId(tenantId);
                setPortalMode("client");
                setActiveNav("Client Overview");
              }}
              onRecordAudit={recordAudit}
              onRotateTenantKey={handleRotateTenantKey}
              onToggleTenantLockdown={handleToggleTenantLockdown}
              onToggleTenantModule={handleToggleTenantModule}
              setIpAllowlistStrict={setIpAllowlistStrict}
              setJitTenantApproval={setJitTenantApproval}
              setStaffMfaEnforced={setStaffMfaEnforced}
              staffMfaEnforced={staffMfaEnforced}
              tenants={clientTenants}
            />
          )}

          {portalMode === "soc" && activeNav === "Overview" && (
            <>
              <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-success">
                    <span className="size-2 animate-pulse rounded-full bg-success" />
                    {isLoadingWorkspace
                      ? "Loading live telemetry..."
                      : criticalOpenCount > 0
                        ? `${criticalOpenCount} critical incident(s) active`
                        : "Production telemetry active"}
                  </div>
                  <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">
                    Security overview
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Live security posture computed from your Supabase production records.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <label className="sr-only" htmlFor="range-select">
                    Time range
                  </label>
                  <select
                    className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    id="range-select"
                    onChange={(event) => setRange(event.target.value as RangeOption)}
                    value={range}
                  >
                    <option value="24 hours">24 hours</option>
                    <option value="7 days">7 days</option>
                    <option value="30 days">30 days</option>
                  </select>
                  <Button
                    aria-label="Sync backend"
                    className="size-9"
                    disabled={isSyncing}
                    onClick={syncWithBackend}
                    size="icon"
                    variant="outline"
                  >
                    <RefreshCw className={`size-4 ${isSyncing ? "animate-spin" : ""}`} />
                  </Button>
                  <Button onClick={() => setShowCreateModal(true)}>
                    <Plus />
                    <span className="hidden sm:inline">Report incident</span>
                    <span className="sm:hidden">New</span>
                  </Button>
                </div>
              </section>

              <section className="flex flex-col justify-between gap-4 border border-primary/30 bg-card p-4 sm:flex-row sm:items-center sm:p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-sm bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                      Production Guardrails
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {protectedServices.length} onboarded service(s) · {assets.length} monitored host(s) ·{" "}
                      {incidents.length} incident(s) in Supabase
                    </span>
                  </div>
                  <h2 className="mt-1.5 text-sm font-semibold">
                    Onboard your Web Apps, Cloud APIs, and AI Agents (LLM / MCP)
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Register production endpoints to generate live SDK keys and stream security events directly into Supabase.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    className="h-8 px-3 text-xs"
                    onClick={() => setActiveNav("Assets")}
                    size="sm"
                    variant="outline"
                  >
                    <Server className="size-3.5" /> Register host asset
                  </Button>
                  <Button
                    className="h-8 px-3 text-xs"
                    onClick={() => setActiveNav("Web & AI Shield")}
                    size="sm"
                  >
                    Onboard Web / AI service <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </section>

              <section
                aria-label="Security metrics"
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
              >
                <MetricCard
                  change={currentSnapshot.scoreChange}
                  footnote="live posture"
                  icon={<ShieldCheck />}
                  label="Security score"
                  suffix="/ 100"
                  trend={criticalOpenCount > 0 ? "alert" : "up"}
                  value={currentSnapshot.securityScore}
                />
                <MetricCard
                  change={`${criticalOpenCount} critical`}
                  footnote={openIncidentCount === 0 ? "Queue clear" : "Needs attention"}
                  icon={<Siren />}
                  label="Open incidents"
                  trend={openIncidentCount > 0 ? "alert" : "up"}
                  value={String(openIncidentCount).padStart(2, "0")}
                />
                <MetricCard
                  change={currentSnapshot.assetsChange}
                  footnote="registered targets"
                  icon={<LockKeyhole />}
                  label="Protected targets"
                  trend="up"
                  value={currentSnapshot.protectedAssets}
                />
                <MetricCard
                  change={currentSnapshot.responseChange}
                  footnote="resolution rate"
                  icon={<Clock3 />}
                  label="Containment rate"
                  trend="up"
                  value={currentSnapshot.meanResponse}
                />
              </section>

              <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
                <div className="min-w-0 border border-border bg-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">Threat & telemetry activity</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Live security events, IOCs, and blocked threats ({range})
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-2 rounded-full bg-primary" /> Live telemetry
                      <Button
                        aria-label="Threat activity options"
                        className="ml-1 size-8"
                        onClick={() => setActiveNav("Threat intel")}
                        size="icon"
                        variant="ghost"
                      >
                        <Ellipsis />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-display text-3xl font-semibold">
                      {currentSnapshot.totalEvents}
                    </span>
                    <span className="inline-flex items-center text-xs font-medium text-primary">
                      <ArrowUpRight className="size-3.5" /> {currentSnapshot.eventsDelta}
                    </span>
                    <span className="text-xs text-muted-foreground">across onboarded targets</span>
                  </div>
                  <div className="mt-3 w-full overflow-hidden">
                    <svg
                      aria-label={`Threat activity trend over the last ${range}`}
                      className="h-[170px] w-full overflow-visible text-primary"
                      preserveAspectRatio="none"
                      role="img"
                      viewBox="0 0 720 140"
                    >
                      {[25, 58, 91, 124].map((y) => (
                        <line
                          className="stroke-border"
                          key={y}
                          strokeDasharray="3 6"
                          x1="0"
                          x2="720"
                          y1={y}
                          y2={y}
                        />
                      ))}
                      <path
                        d={chartPath}
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        vectorEffect="non-scaling-stroke"
                      />
                      <circle
                        cx="720"
                        cy={126 - (currentSnapshot.riskPoints.at(-1) ?? 6)}
                        fill="currentColor"
                        r="4.5"
                      />
                    </svg>
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                    {currentSnapshot.labels.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                </div>

                <div className="border border-border bg-card p-4 sm:p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-base font-semibold">Risk posture</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Live exposure by severity
                      </p>
                    </div>
                    <Button
                      aria-label="Risk posture details"
                      className="size-8"
                      onClick={() => setActiveNav("Vulnerabilities")}
                      size="icon"
                      variant="ghost"
                    >
                      <ArrowRight />
                    </Button>
                  </div>
                  <div className="my-6 flex items-center gap-5">
                    <div
                      className="relative grid size-28 shrink-0 place-items-center rounded-full"
                      style={{
                        background:
                          criticalOpenCount > 0
                            ? "conic-gradient(var(--color-destructive) 0% 25%, var(--color-primary) 25% 45%, var(--color-warning) 45% 65%, var(--color-success) 65% 100%)"
                            : "conic-gradient(var(--color-success) 0% 100%)",
                      }}
                    >
                      <div className="grid size-[82px] place-items-center rounded-full bg-card">
                        <div className="text-center">
                          <div className="font-display text-2xl font-semibold">
                            {currentSnapshot.securityScore}
                          </div>
                          <div className="text-[10px] text-muted-foreground">/ 100 score</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 text-xs">
                      <RiskLegend
                        color="bg-destructive"
                        count={String(currentSnapshot.postureBreakdown.critical)}
                        label="Critical"
                      />
                      <RiskLegend
                        color="bg-primary"
                        count={String(currentSnapshot.postureBreakdown.high)}
                        label="High"
                      />
                      <RiskLegend
                        color="bg-warning"
                        count={String(currentSnapshot.postureBreakdown.medium)}
                        label="Medium"
                      />
                      <RiskLegend
                        color="bg-success"
                        count={String(currentSnapshot.postureBreakdown.low)}
                        label="Protected"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-4 text-xs">
                    <span className="text-muted-foreground">Live posture state</span>
                    <span className="inline-flex items-center gap-1 font-medium text-success">
                      <ArrowDownRight className="size-3.5" />{" "}
                      {criticalOpenCount === 0 ? "Healthy" : "Action required"}
                    </span>
                  </div>
                </div>
              </section>

              <IncidentsSection
                filteredIncidents={filteredIncidents}
                incidentFilter={incidentFilter}
                incidents={incidents}
                onDelete={deleteIncident}
                onExport={exportIncidents}
                onFilterChange={setIncidentFilter}
                onInspect={(id) => setSelectedIncidentId(id)}
                onOpenCreate={() => setShowCreateModal(true)}
                onResolve={resolveIncident}
                onViewAll={() => {
                  setIncidentFilter("All");
                  setSearch("");
                  setActiveNav("Incidents");
                }}
              />

              <section className="grid gap-3 pb-4 sm:grid-cols-3">
                <SignalItem
                  detail={`${threatIndicators.length} indicator(s) tracked`}
                  icon={<Globe2 />}
                  label="Threat intelligence"
                  onClick={() => setActiveNav("Threat intel")}
                  state="Live"
                />
                <SignalItem
                  detail={`${assets.length} host(s) registered`}
                  icon={<Layers3 />}
                  label="Infrastructure assets"
                  onClick={() => setActiveNav("Assets")}
                  state="Monitored"
                />
                <SignalItem
                  detail={`${protectedServices.length} Web / AI service(s)`}
                  icon={<ShieldCheck />}
                  label="Web & AI Agent Shield"
                  onClick={() => setActiveNav("Web & AI Shield")}
                  state="Active"
                />
              </section>
            </>
          )}

          {activeNav === "Web & AI Shield" && (
            <>
              <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-primary">
                    <ShieldCheck className="size-3.5" />
                    Unified Web App, Cloud API & AI Agent Protection
                  </div>
                  <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">
                    Web & AI Agent Shield
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Register production websites, web apps, and autonomous AI agents (LLM / MCP) to issue ingestion keys and enforce guardrails.
                  </p>
                </div>
              </section>

              {/* Onboard New Service Form */}
              <form
                className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-[1.2fr_1fr_1.3fr_auto] sm:p-5"
                onSubmit={handleAddProtectedService}
              >
                <input
                  aria-label="Service or AI agent name"
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setNewServiceName(event.target.value)}
                  placeholder="Production service name (e.g. Customer Portal or Billing AI Agent)"
                  required
                  value={newServiceName}
                />
                <select
                  aria-label="Service category"
                  className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none"
                  onChange={(event) =>
                    setNewServiceCategory(event.target.value as ServiceCategory)
                  }
                  value={newServiceCategory}
                >
                  <option value="AI Agent (LLM / MCP)">AI Agent (LLM / MCP)</option>
                  <option value="Web App & Website">Web App & Website</option>
                  <option value="Cloud API & Microservice">Cloud API & Microservice</option>
                </select>
                <input
                  aria-label="Domain or AI agent URI"
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setNewServiceEndpoint(event.target.value)}
                  placeholder="https://your-domain.com or agent://production-agent"
                  required
                  value={newServiceEndpoint}
                />
                <Button type="submit">
                  <Plus /> Onboard service
                </Button>
              </form>

              {/* Protected Services & AI Agents List */}
              {protectedServices.length > 0 ? (
                <section className="grid gap-4 lg:grid-cols-2">
                  {protectedServices.map((srv) => (
                    <article
                      className="flex flex-col justify-between border border-border bg-card p-5"
                      key={srv.id}
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="rounded-sm border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold">
                            {srv.category}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-sm border px-2 py-0.5 text-[10px] font-semibold ${
                                srv.mode === "Active Shield"
                                  ? "border-success/30 bg-success/10 text-success"
                                  : srv.mode === "Lockdown"
                                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                                    : "border-warning/30 bg-warning/10 text-warning"
                              }`}
                            >
                              {srv.mode}
                            </span>
                            <Button
                              aria-label={`Remove ${srv.name}`}
                              className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteProtectedService(srv.id)}
                              size="icon"
                              variant="ghost"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>

                        <h3 className="mt-3 text-base font-semibold">{srv.name}</h3>
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                          {srv.endpoint}
                        </p>

                        <div className="mt-4 grid grid-cols-3 gap-2 border-y border-border py-3 text-xs">
                          <div>
                            <div className="text-[10px] text-muted-foreground">Service ID</div>
                            <div className="mt-0.5 font-mono text-xs font-semibold">
                              {srv.id}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground">Threats Blocked</div>
                            <div className="mt-0.5 font-display text-sm font-semibold text-primary">
                              {srv.blockedThreats}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground">Status</div>
                            <div className="mt-0.5 text-xs font-medium text-success">
                              {srv.lastHeartbeat}
                            </div>
                          </div>
                        </div>

                        {/* Guardrail Toggles */}
                        <div className="mt-4">
                          <div className="text-[11px] font-medium text-muted-foreground">
                            Active Security & AI Guardrails
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              className="h-7 px-2.5 text-[11px]"
                              onClick={() => toggleServiceGuardrail(srv.id, "promptShield")}
                              size="sm"
                              variant={srv.promptShield ? "secondary" : "outline"}
                            >
                              {srv.promptShield ? <Check className="size-3 text-success" /> : null}
                              Prompt Injection Shield
                            </Button>
                            <Button
                              className="h-7 px-2.5 text-[11px]"
                              onClick={() => toggleServiceGuardrail(srv.id, "piiRedaction")}
                              size="sm"
                              variant={srv.piiRedaction ? "secondary" : "outline"}
                            >
                              {srv.piiRedaction ? <Check className="size-3 text-success" /> : null}
                              PII & Secret Redaction
                            </Button>
                            <Button
                              className="h-7 px-2.5 text-[11px]"
                              onClick={() => toggleServiceGuardrail(srv.id, "toolCallFirewall")}
                              size="sm"
                              variant={srv.toolCallFirewall ? "secondary" : "outline"}
                            >
                              {srv.toolCallFirewall ? (
                                <Check className="size-3 text-success" />
                              ) : null}
                              MCP Tool-Call Firewall
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                        <div className="flex items-center gap-1">
                          {(["Active Shield", "Monitor Only", "Lockdown"] as ProtectionMode[]).map(
                            (modeOption) => (
                              <Button
                                className="h-7 px-2 text-[11px]"
                                key={modeOption}
                                onClick={() => updateServiceMode(srv.id, modeOption)}
                                size="sm"
                                variant={srv.mode === modeOption ? "default" : "ghost"}
                              >
                                {modeOption}
                              </Button>
                            ),
                          )}
                        </div>
                        <Button
                          className="h-8 px-3 text-xs"
                          onClick={() => setSdkServiceId(srv.id)}
                          size="sm"
                          variant="outline"
                        >
                          <Terminal className="size-3.5" /> Connect / SDK Code
                        </Button>
                      </div>
                    </article>
                  ))}
                </section>
              ) : (
                <section className="border border-border bg-card px-6 py-12 text-center">
                  <ShieldCheck className="mx-auto size-6 text-primary" />
                  <h2 className="mt-3 text-sm font-semibold">No production services onboarded yet</h2>
                  <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                    Use the form above to register your first Web App, Cloud API, or AI Agent and generate its live Supabase ingestion SDK snippet.
                  </p>
                </section>
              )}
            </>
          )}

          {activeNav === "Incidents" && (
            <>
              <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-primary">
                    <Siren className="size-3.5" />
                    Incident response queue
                  </div>
                  <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">
                    Incidents & triage
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Investigate live detections, assign responders, and execute containment playbooks.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {incidents.length > 0 && (
                    <Button
                      disabled={isSyncing}
                      onClick={handlePurgeAllIncidents}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 className="size-3.5" /> Purge all
                    </Button>
                  )}
                  <Button onClick={exportIncidents} size="sm" variant="outline">
                    <Download /> Export CSV
                  </Button>
                  <Button onClick={() => setShowCreateModal(true)} size="sm">
                    <Plus /> Report incident
                  </Button>
                </div>
              </section>

              <IncidentsSection
                filteredIncidents={filteredIncidents}
                incidentFilter={incidentFilter}
                incidents={incidents}
                onDelete={deleteIncident}
                onExport={exportIncidents}
                onFilterChange={setIncidentFilter}
                onInspect={(id) => setSelectedIncidentId(id)}
                onOpenCreate={() => setShowCreateModal(true)}
                onResolve={resolveIncident}
              />
            </>
          )}

          {activeNav === "Threat intel" && (
            <>
              <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-info">
                    <Globe2 className="size-3.5" />
                    Global threat intelligence
                  </div>
                  <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">
                    Threat intel & IOCs
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Correlate indicators of compromise and enforce perimeter firewall blocklists in Supabase.
                  </p>
                </div>
              </section>

              <form
                className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-[1.3fr_1fr_0.7fr_0.8fr_auto]"
                onSubmit={handleAddIndicator}
              >
                <input
                  aria-label="New indicator value"
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setNewIocValue(event.target.value)}
                  placeholder="IPv4, Domain, SHA-256, or ASN"
                  required
                  value={newIocValue}
                />
                <input
                  aria-label="Threat actor or source"
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setNewIocActor(event.target.value)}
                  placeholder="Attribution / source"
                  value={newIocActor}
                />
                <select
                  aria-label="IOC severity"
                  className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none"
                  onChange={(event) => setNewIocSeverity(event.target.value as Severity)}
                  value={newIocSeverity}
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                </select>
                <input
                  aria-label="IOC region"
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setNewIocRegion(event.target.value)}
                  placeholder="Region (e.g. Global)"
                  value={newIocRegion}
                />
                <Button type="submit">
                  <Plus /> Block indicator
                </Button>
              </form>

              <section className="border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-5">
                  <div>
                    <h2 className="text-base font-semibold">Active indicators of compromise</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {threatIndicators.filter((i) => i.blocked).length} of{" "}
                      {threatIndicators.length} indicator(s) actively blocked at perimeter
                    </p>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {threatIndicators.length > 0 ? (
                    threatIndicators.map((ioc) => (
                      <article
                        className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                        key={ioc.id}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-foreground">
                              {ioc.indicator}
                            </span>
                            <span className="rounded-sm border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium">
                              {ioc.type}
                            </span>
                            <SeverityTag severity={ioc.severity} />
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{ioc.actor}</span>
                            <span>·</span>
                            <span>Confidence: {ioc.confidence}%</span>
                            <span>·</span>
                            <span>{ioc.region}</span>
                            <span>·</span>
                            <span>Seen {ioc.lastSeen}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-sm border px-2 py-1 text-[10px] font-medium ${
                              ioc.blocked
                                ? "border-success/30 bg-success/10 text-success"
                                : "border-warning/30 bg-warning/10 text-warning"
                            }`}
                          >
                            {ioc.blocked ? "Blocked at Edge" : "Monitoring"}
                          </span>
                          <Button
                            className="h-8 px-3 text-xs"
                            onClick={() => toggleBlockIndicator(ioc.id)}
                            size="sm"
                            variant={ioc.blocked ? "ghost" : "outline"}
                          >
                            {ioc.blocked ? "Unblock" : "Enforce block"}
                          </Button>
                          <Button
                            aria-label={`Delete ${ioc.indicator}`}
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteIndicator(ioc.id)}
                            size="icon"
                            variant="ghost"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="px-5 py-12 text-center">
                      <Globe2 className="mx-auto size-5 text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">No threat indicators logged</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Add an IPv4, domain, SHA-256 hash, or ASN above to enforce perimeter blocking.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {activeNav === "Assets" && (
            <>
              <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-success">
                    <Server className="size-3.5" />
                    Protected infrastructure
                  </div>
                  <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">
                    Monitored assets
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Register production cloud nodes, API gateways, databases, and endpoints with host isolation controls.
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
                  {["All", "Production", "Staging", "Corporate"].map((env) => (
                    <Button
                      className="h-7 px-2.5 text-xs"
                      key={env}
                      onClick={() => setAssetEnvFilter(env)}
                      size="sm"
                      variant={assetEnvFilter === env ? "secondary" : "ghost"}
                    >
                      {env}
                    </Button>
                  ))}
                </div>
              </section>

              <form
                className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-[1.2fr_0.9fr_0.9fr_0.8fr_0.9fr_auto]"
                onSubmit={handleAddAsset}
              >
                <input
                  aria-label="Asset hostname"
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setNewAssetHostname(event.target.value)}
                  placeholder="Hostname (e.g. prod-api-01.internal)"
                  required
                  value={newAssetHostname}
                />
                <select
                  aria-label="Asset type"
                  className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none"
                  onChange={(event) => setNewAssetType(event.target.value as Asset["type"])}
                  value={newAssetType}
                >
                  <option value="API Gateway">API Gateway</option>
                  <option value="Kubernetes Node">Kubernetes Node</option>
                  <option value="Database">Database</option>
                  <option value="Identity Provider">Identity Provider</option>
                  <option value="Workstation">Workstation</option>
                </select>
                <input
                  aria-label="Asset IP address"
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setNewAssetIp(event.target.value)}
                  placeholder="IP / CIDR (e.g. 10.24.4.10)"
                  required
                  value={newAssetIp}
                />
                <select
                  aria-label="Asset environment"
                  className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none"
                  onChange={(event) =>
                    setNewAssetEnv(event.target.value as Asset["environment"])
                  }
                  value={newAssetEnv}
                >
                  <option value="Production">Production</option>
                  <option value="Staging">Staging</option>
                  <option value="Corporate">Corporate</option>
                </select>
                <input
                  aria-label="Asset owner"
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setNewAssetOwner(event.target.value)}
                  placeholder="Owner team (e.g. Platform)"
                  value={newAssetOwner}
                />
                <Button type="submit">
                  <Plus /> Register asset
                </Button>
              </form>

              <section className="border border-border bg-card">
                <div className="divide-y divide-border">
                  {assets.filter(
                    (asset) =>
                      assetEnvFilter === "All" || asset.environment === assetEnvFilter,
                  ).length > 0 ? (
                    assets
                      .filter(
                        (asset) =>
                          assetEnvFilter === "All" || asset.environment === assetEnvFilter,
                      )
                      .map((asset) => (
                        <article
                          className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                          key={asset.id}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm font-semibold">
                                {asset.hostname}
                              </span>
                              <span className="rounded-sm border border-border bg-secondary px-1.5 py-0.5 text-[10px]">
                                {asset.type}
                              </span>
                              <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {asset.environment}
                              </span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>{asset.id}</span>
                              <span>·</span>
                              <span>IP: {asset.ip}</span>
                              <span>·</span>
                              <span>Owner: {asset.owner}</span>
                              <span>·</span>
                              <span>Check-in: {asset.lastCheckin}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="mr-2 text-right">
                              <div className="text-xs font-semibold">
                                Risk {asset.riskScore}/100
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {asset.status}
                              </div>
                            </div>
                            <Button
                              className="h-8 px-3 text-xs"
                              onClick={() => toggleAssetIsolation(asset.id)}
                              size="sm"
                              variant={asset.status === "Isolated" ? "secondary" : "outline"}
                            >
                              {asset.status === "Isolated" ? "Restore network" : "Isolate host"}
                            </Button>
                            <Button
                              aria-label={`Delete ${asset.hostname}`}
                              className="size-8 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteAsset(asset.id)}
                              size="icon"
                              variant="ghost"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </article>
                      ))
                  ) : (
                    <div className="px-5 py-12 text-center">
                      <Server className="mx-auto size-5 text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">No monitored assets registered</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Register your production hosts, Kubernetes nodes, and databases above to track posture.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {activeNav === "Vulnerabilities" && (
            <>
              <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-warning">
                    <ShieldAlert className="size-3.5" />
                    CVE remediation center
                  </div>
                  <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">
                    Vulnerabilities
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Track production CVEs by CVSS score and record package remediation rollouts in Supabase.
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
                  {["All", "Critical", "High", "Medium"].map((sev) => (
                    <Button
                      className="h-7 px-2.5 text-xs"
                      key={sev}
                      onClick={() => setVulnFilter(sev)}
                      size="sm"
                      variant={vulnFilter === sev ? "secondary" : "ghost"}
                    >
                      {sev}
                    </Button>
                  ))}
                </div>
              </section>

              <form
                className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-[0.9fr_1.2fr_0.6fr_0.8fr_1fr_auto]"
                onSubmit={handleAddVulnerability}
              >
                <input
                  aria-label="CVE identifier"
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setNewVulnCve(event.target.value)}
                  placeholder="CVE ID (e.g. CVE-2026-1042)"
                  required
                  value={newVulnCve}
                />
                <input
                  aria-label="Affected package"
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setNewVulnPackage(event.target.value)}
                  placeholder="Package & version (e.g. openssl 3.0.1)"
                  required
                  value={newVulnPackage}
                />
                <input
                  aria-label="CVSS score"
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  max="10"
                  min="0"
                  onChange={(event) => setNewVulnCvss(event.target.value)}
                  placeholder="CVSS"
                  step="0.1"
                  type="number"
                  value={newVulnCvss}
                />
                <select
                  aria-label="Vulnerability severity"
                  className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none"
                  onChange={(event) => setNewVulnSeverity(event.target.value as Severity)}
                  value={newVulnSeverity}
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                </select>
                <input
                  aria-label="Fix version"
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setNewVulnFix(event.target.value)}
                  placeholder="Target fix version"
                  value={newVulnFix}
                />
                <Button type="submit">
                  <Plus /> Log CVE
                </Button>
              </form>

              <section className="border border-border bg-card">
                <div className="divide-y divide-border">
                  {vulnerabilities.filter(
                    (v) => vulnFilter === "All" || v.severity === vulnFilter,
                  ).length > 0 ? (
                    vulnerabilities
                      .filter((v) => vulnFilter === "All" || v.severity === vulnFilter)
                      .map((vuln) => (
                        <article
                          className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                          key={vuln.id}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm font-semibold">{vuln.cve}</span>
                              <SeverityTag severity={vuln.severity} />
                              <span className="rounded-sm border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-semibold">
                                CVSS {vuln.cvss}
                              </span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>Package: {vuln.packageName}</span>
                              <span>·</span>
                              <span>{vuln.affectedHosts} host(s) affected</span>
                              <span>·</span>
                              <span>Fix version: {vuln.fixVersion}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-sm border px-2 py-1 text-[10px] font-medium ${
                                vuln.status === "Patched"
                                  ? "border-success/30 bg-success/10 text-success"
                                  : "border-warning/30 bg-warning/10 text-warning"
                              }`}
                            >
                              {vuln.status}
                            </span>
                            {vuln.status !== "Patched" ? (
                              <Button
                                className="h-8 px-3 text-xs"
                                onClick={() => patchVulnerability(vuln.id)}
                                size="sm"
                                variant="outline"
                              >
                                <Wrench className="size-3.5" /> Mark patched
                              </Button>
                            ) : (
                              <Button
                                className="size-8 text-success"
                                disabled
                                size="icon"
                                variant="ghost"
                              >
                                <Check />
                              </Button>
                            )}
                            <Button
                              aria-label={`Delete ${vuln.cve}`}
                              className="size-8 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteVulnerability(vuln.id)}
                              size="icon"
                              variant="ghost"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </article>
                      ))
                  ) : (
                    <div className="px-5 py-12 text-center">
                      <ShieldAlert className="mx-auto size-5 text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">No open vulnerabilities recorded</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Log CVEs discovered by your scanner above to track remediation across production hosts.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {activeNav === "Reports" && (
            <>
              <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-primary">
                    <FileSearch className="size-3.5" />
                    Compliance & audit exports
                  </div>
                  <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">
                    Security reports
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Generate audit-ready posture snapshots for SOC 2, ISO 27001, NIST CSF, and executive briefings.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => generateNewReport("SOC 2 Type II")}
                    size="sm"
                    variant="outline"
                  >
                    <Plus /> SOC 2 Type II
                  </Button>
                  <Button
                    onClick={() => generateNewReport("ISO 27001")}
                    size="sm"
                    variant="outline"
                  >
                    <Plus /> ISO 27001
                  </Button>
                  <Button
                    onClick={() => generateNewReport("Executive Summary")}
                    size="sm"
                  >
                    <Sparkles /> Generate executive digest
                  </Button>
                </div>
              </section>

              <section className="border border-border bg-card">
                <div className="divide-y divide-border">
                  {reports.length > 0 ? (
                    reports.map((report) => (
                      <article
                        className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                        key={report.id}
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-medium">{report.title}</h3>
                            <span className="rounded-sm border border-border bg-secondary px-1.5 py-0.5 text-[10px]">
                              {report.framework}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{report.id}</span>
                            <span>·</span>
                            <span>Period: {report.period}</span>
                            <span>·</span>
                            <span>{report.generatedAt}</span>
                            <span>·</span>
                            <span>By {report.author}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            className="h-8 px-3 text-xs"
                            onClick={() => {
                              exportIncidents();
                              showToast(`Exported CSV for ${report.title}`);
                            }}
                            size="sm"
                            variant="outline"
                          >
                            <Download className="size-3.5" /> Export CSV
                          </Button>
                          <Button
                            aria-label={`Delete ${report.title}`}
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteReport(report.id)}
                            size="icon"
                            variant="ghost"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="px-5 py-12 text-center">
                      <FileSearch className="mx-auto size-5 text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">No compliance reports generated yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Click one of the report generators above to capture a live posture attestation snapshot.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {activeNav === "Team & access" && (
            <>
              <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-success">
                    <Users className="size-3.5" />
                    Identity & on-call roster
                  </div>
                  <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">
                    Team & access
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Register security responders, manage roles, and assign active on-call rotations.
                  </p>
                </div>
              </section>

              <form
                className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-[1.1fr_1.2fr_1fr_1fr_auto]"
                onSubmit={handleAddTeamMember}
              >
                <input
                  aria-label="Responder full name"
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setNewMemberName(event.target.value)}
                  placeholder="Full name"
                  required
                  value={newMemberName}
                />
                <input
                  aria-label="Responder email"
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setNewMemberEmail(event.target.value)}
                  placeholder="Email address"
                  required
                  type="email"
                  value={newMemberEmail}
                />
                <select
                  aria-label="Responder role"
                  className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none"
                  onChange={(event) =>
                    setNewMemberRole(event.target.value as TeamMember["role"])
                  }
                  value={newMemberRole}
                >
                  <option value="Security Admin">Security Admin</option>
                  <option value="Incident Responder">Incident Responder</option>
                  <option value="Threat Hunter">Threat Hunter</option>
                  <option value="Compliance Auditor">Compliance Auditor</option>
                </select>
                <input
                  aria-label="Responder shift"
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setNewMemberShift(event.target.value)}
                  placeholder="Shift / rotation"
                  value={newMemberShift}
                />
                <Button type="submit">
                  <Plus /> Add responder
                </Button>
              </form>

              <section className="border border-border bg-card">
                <div className="divide-y divide-border">
                  {teamMembers.length > 0 ? (
                    teamMembers.map((member) => (
                      <article
                        className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                        key={member.id}
                      >
                        <div className="flex items-center gap-3">
                          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">
                            {member.initials}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium">{member.name}</span>
                              <span className="rounded-sm border border-border bg-secondary px-1.5 py-0.5 text-[10px]">
                                {member.role}
                              </span>
                              {member.onCall && (
                                <span className="rounded-sm border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                                  On-Call
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {member.email} · {member.shift}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <KeyRound className="size-3.5 text-success" /> WebAuthn MFA
                          </span>
                          <Button
                            className="h-8 px-3 text-xs"
                            onClick={() => toggleMemberOnCall(member.id)}
                            size="sm"
                            variant="outline"
                          >
                            {member.onCall ? "Rotate off-call" : "Set on-call"}
                          </Button>
                          <Button
                            aria-label={`Remove ${member.name}`}
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteTeamMember(member.id)}
                            size="icon"
                            variant="ghost"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="px-5 py-12 text-center">
                      <Users className="mx-auto size-5 text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">No team responders registered</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Add your security engineers and admins above to assign incidents and on-call shifts.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {activeNav === "Integrations" && (
            <>
              <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-primary">
                    <Database className="size-3.5" />
                    Backend & telemetry pipelines
                  </div>
                  <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">
                    Integrations & Supabase backend
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Manage your live Supabase PostgreSQL connection and external telemetry pipelines.
                  </p>
                </div>
                <Button disabled={isSyncing} onClick={syncWithBackend}>
                  <RefreshCw className={`size-4 ${isSyncing ? "animate-spin" : ""}`} />
                  Sync Supabase now
                </Button>
              </section>

              <section className="border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold">Supabase Production Database</h2>
                      <span
                        className={`rounded-sm border px-2 py-0.5 text-[10px] font-semibold ${
                          backendSource === "supabase"
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-warning/30 bg-warning/10 text-warning"
                        }`}
                      >
                        {backendSource === "supabase" ? "Connected & Live" : "Offline"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Endpoint: <code className="text-foreground">{supabaseUrl}</code>. Execute{" "}
                      <code className="text-foreground">supabase/schema.sql</code> in the Supabase SQL
                      Editor to ensure all production tables (<code className="text-foreground">incidents</code>,{" "}
                      <code className="text-foreground">threat_feeds</code>,{" "}
                      <code className="text-foreground">assets</code>,{" "}
                      <code className="text-foreground">vulnerabilities</code>,{" "}
                      <code className="text-foreground">reports</code>,{" "}
                      <code className="text-foreground">protected_services</code>,{" "}
                      <code className="text-foreground">team_members</code>,{" "}
                      <code className="text-foreground">integrations</code>) are provisioned.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() => {
                        navigator.clipboard?.writeText(supabaseSchemaSql);
                        showToast("Copied full 10-table SQL schema to clipboard");
                      }}
                      size="sm"
                    >
                      <Copy className="size-3.5" /> Copy Full SQL Schema
                    </Button>
                    <Button
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          `VITE_SUPABASE_URL=${supabaseUrl}\nVITE_SUPABASE_ANON_KEY=${supabaseAnonKey}`,
                        );
                        showToast("Copied .env configuration to clipboard");
                      }}
                      size="sm"
                      variant="outline"
                    >
                      <Copy className="size-3.5" /> Copy .env variables
                    </Button>
                  </div>
                </div>
              </section>

              <form
                className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-[1fr_0.9fr_1.4fr_auto]"
                onSubmit={handleAddIntegration}
              >
                <input
                  aria-label="Integration name"
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setNewIntegrationName(event.target.value)}
                  placeholder="Connector name (e.g. AWS CloudTrail, CrowdStrike)"
                  required
                  value={newIntegrationName}
                />
                <input
                  aria-label="Integration category"
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setNewIntegrationCategory(event.target.value)}
                  placeholder="Category (e.g. Cloud Telemetry)"
                  value={newIntegrationCategory}
                />
                <input
                  aria-label="Integration description"
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setNewIntegrationDesc(event.target.value)}
                  placeholder="Description / webhook scope"
                  value={newIntegrationDesc}
                />
                <Button type="submit">
                  <Plus /> Add connector
                </Button>
              </form>

              {integrations.length > 0 ? (
                <section className="grid gap-3 sm:grid-cols-2">
                  {integrations.map((integration) => (
                    <article
                      className="flex flex-col justify-between border border-border bg-card p-4 sm:p-5"
                      key={integration.id}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            {integration.category}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${
                                integration.connected
                                  ? "border-success/30 bg-success/10 text-success"
                                  : "border-border bg-secondary text-muted-foreground"
                              }`}
                            >
                              {integration.connected ? "Connected" : "Paused"}
                            </span>
                            <Button
                              aria-label={`Remove ${integration.name}`}
                              className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteIntegration(integration.id)}
                              size="icon"
                              variant="ghost"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                        <h3 className="mt-2 text-base font-semibold">{integration.name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {integration.description}
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
                        <span className="text-muted-foreground">
                          Stream: {integration.eventsPerMin} · Status: {integration.lastSync}
                        </span>
                        <Button
                          className="h-7 px-2.5 text-xs"
                          onClick={() => toggleIntegrationConnection(integration.id)}
                          size="sm"
                          variant="outline"
                        >
                          {integration.connected ? "Pause" : "Connect"}
                        </Button>
                      </div>
                    </article>
                  ))}
                </section>
              ) : (
                <section className="border border-border bg-card px-6 py-10 text-center">
                  <Boxes className="mx-auto size-5 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">No external connectors registered</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add your SIEM, EDR, or cloud log connectors above to track external ingestion pipelines alongside Supabase.
                  </p>
                </section>
              )}
            </>
          )}

          {activeNav === "Help center" && (
            <>
              <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-info">
                    <BookOpen className="size-3.5" />
                    Runbooks & documentation
                  </div>
                  <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">
                    Help center & playbooks
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Production operating procedures for onboarding services, Supabase schema setup, and incident containment.
                  </p>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-3">
                <article className="border border-border bg-card p-5">
                  <Terminal className="size-5 text-primary" />
                  <h2 className="mt-3 text-base font-semibold">Web & AI Agent SDK Integration</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Onboard any web application or LLM/MCP agent to generate a live ingestion snippet that streams incidents directly into Supabase.
                  </p>
                  <Button
                    className="mt-4 h-8 px-3 text-xs"
                    onClick={() => setActiveNav("Web & AI Shield")}
                    size="sm"
                    variant="outline"
                  >
                    Open Web & AI Shield
                  </Button>
                </article>
                <article className="border border-border bg-card p-5">
                  <Database className="size-5 text-success" />
                  <h2 className="mt-3 text-base font-semibold">Supabase Schema Provisioning</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Run <code className="text-foreground">supabase/schema.sql</code> in your Supabase SQL Editor to create all production tables with Row-Level Security.
                  </p>
                  <Button
                    className="mt-4 h-8 px-3 text-xs"
                    onClick={() => setActiveNav("Integrations")}
                    size="sm"
                    variant="outline"
                  >
                    View database config
                  </Button>
                </article>
                <article className="border border-border bg-card p-5">
                  <Siren className="size-5 text-warning" />
                  <h2 className="mt-3 text-base font-semibold">On-Call Roster & Escalation</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Register your security responders in Team & Access to assign incidents and manage on-call rotations.
                  </p>
                  <Button
                    className="mt-4 h-8 px-3 text-xs"
                    onClick={() => setActiveNav("Team & access")}
                    size="sm"
                  >
                    Manage team roster
                  </Button>
                </article>
              </section>
            </>
          )}

          {activeNav === "Settings" && (
            <>
              <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                    <Wrench className="size-3.5" />
                    Workspace configuration
                  </div>
                  <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">
                    Security & automation settings
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Control autonomous containment rules, alerting thresholds, and layout preferences.
                  </p>
                </div>
              </section>

              <section className="divide-y divide-border border border-border bg-card">
                <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
                  <div>
                    <h2 className="text-sm font-semibold">
                      Autonomous containment for Critical EDR detections
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Automatically isolate endpoints when high-confidence ransomware or unauthorized shell activity is detected.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setAutoContainCritical(!autoContainCritical);
                      showToast(
                        `Autonomous containment ${!autoContainCritical ? "enabled" : "disabled"}`,
                      );
                    }}
                    size="sm"
                    variant={autoContainCritical ? "default" : "outline"}
                  >
                    {autoContainCritical ? "Enabled" : "Disabled"}
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
                  <div>
                    <h2 className="text-sm font-semibold">
                      Realtime PagerDuty escalation on Critical incidents
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Immediately notify the primary on-call engineer when an incident is triaged as Critical.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setRealtimePagerDuty(!realtimePagerDuty);
                      showToast(
                        `PagerDuty escalation ${!realtimePagerDuty ? "enabled" : "disabled"}`,
                      );
                    }}
                    size="sm"
                    variant={realtimePagerDuty ? "default" : "outline"}
                  >
                    {realtimePagerDuty ? "Enabled" : "Disabled"}
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
                  <div>
                    <h2 className="text-sm font-semibold">
                      Hardware WebAuthn MFA enforcement
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Require FIDO2 security keys for all Security Admin and Incident Responder actions.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setEnforceStrictMfa(!enforceStrictMfa);
                      showToast(`Strict MFA ${!enforceStrictMfa ? "enforced" : "relaxed"}`);
                    }}
                    size="sm"
                    variant={enforceStrictMfa ? "default" : "outline"}
                  >
                    {enforceStrictMfa ? "Enforced" : "Optional"}
                  </Button>
                </div>
              </section>
            </>
          )}
        </main>

        {/* Incident Detail Drawer / Modal */}
        {selectedIncident && (
          <div
            aria-label="Incident details"
            className="fixed inset-0 z-40 flex justify-end bg-background/70 backdrop-blur-xs"
            role="dialog"
          >
            <div className="flex h-full w-full max-w-lg flex-col justify-between overflow-y-auto border-l border-border bg-card p-5 shadow-2xl">
              <div>
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {selectedIncident.id}
                    </span>
                    <SeverityTag severity={selectedIncident.severity} />
                    <StatusTag status={selectedIncident.status} />
                  </div>
                  <Button
                    aria-label="Close incident details"
                    className="size-8"
                    onClick={() => setSelectedIncidentId(null)}
                    size="icon"
                    variant="ghost"
                  >
                    <X />
                  </Button>
                </div>

                <h2 className="mt-4 text-lg font-semibold">{selectedIncident.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Source: {selectedIncident.source} · Logged {selectedIncident.time}
                </p>

                <div className="mt-4 border border-border bg-background p-3.5 text-xs leading-relaxed text-foreground">
                  <div className="mb-1 font-semibold text-muted-foreground">
                    Telemetry summary
                  </div>
                  {selectedIncident.summary}
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      className="block text-xs font-medium text-muted-foreground"
                      htmlFor="detail-status"
                    >
                      Triage status
                    </label>
                    <select
                      className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none"
                      id="detail-status"
                      onChange={(e) =>
                        updateIncidentField(selectedIncident.id, {
                          status: e.target.value as IncidentStatus,
                        })
                      }
                      value={selectedIncident.status}
                    >
                      <option value="Open">Open</option>
                      <option value="Investigating">Investigating</option>
                      <option value="Contained">Contained</option>
                    </select>
                  </div>

                  <div>
                    <label
                      className="block text-xs font-medium text-muted-foreground"
                      htmlFor="detail-severity"
                    >
                      Severity level
                    </label>
                    <select
                      className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none"
                      id="detail-severity"
                      onChange={(e) =>
                        updateIncidentField(selectedIncident.id, {
                          severity: e.target.value as Severity,
                        })
                      }
                      value={selectedIncident.severity}
                    >
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                    </select>
                  </div>

                  <div>
                    <label
                      className="block text-xs font-medium text-muted-foreground"
                      htmlFor="detail-assignee"
                    >
                      Assigned responder
                    </label>
                    <input
                      className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none"
                      id="detail-assignee"
                      onChange={(e) =>
                        updateIncidentField(selectedIncident.id, {
                          assignee: e.target.value,
                        })
                      }
                      placeholder="Responder name"
                      value={selectedIncident.assignee}
                    />
                  </div>

                  <div>
                    <div className="text-xs font-medium text-muted-foreground">
                      Response playbook
                    </div>
                    <div className="mt-1.5 flex h-9 items-center rounded-md border border-border bg-background px-3 text-xs font-medium">
                      {selectedIncident.playbook}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteIncident(selectedIncident.id)}
                  size="sm"
                  variant="ghost"
                >
                  <Trash2 className="size-3.5" /> Delete incident
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setSelectedIncidentId(null)}
                    size="sm"
                    variant="ghost"
                  >
                    Close
                  </Button>
                  {selectedIncident.status !== "Contained" ? (
                    <Button
                      onClick={() => resolveIncident(selectedIncident.id)}
                      size="sm"
                    >
                      <Check /> Execute containment
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                      <Check className="size-4" /> Incident contained
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Incident Modal */}
        {showCreateModal && (
          <div
            aria-label="Report new incident"
            className="fixed inset-0 z-40 grid place-items-center bg-background/70 p-4 backdrop-blur-xs"
            role="dialog"
          >
            <form
              className="w-full max-w-md border border-border bg-card p-5 shadow-2xl"
              onSubmit={handleCreateIncident}
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-base font-semibold">Report security incident</h2>
                <Button
                  aria-label="Close modal"
                  className="size-8"
                  onClick={() => setShowCreateModal(false)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X />
                </Button>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="inc-title">
                    Incident title
                  </label>
                  <input
                    className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
                    id="inc-title"
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Unauthorized IAM role assumption"
                    required
                    value={newTitle}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="inc-source">
                    Telemetry source / host
                  </label>
                  <input
                    className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
                    id="inc-source"
                    onChange={(e) => setNewSource(e.target.value)}
                    placeholder="e.g. Cloud · k8s-prod-us-east"
                    required
                    value={newSource}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="inc-sev">
                      Severity
                    </label>
                    <select
                      className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none"
                      id="inc-sev"
                      onChange={(e) => setNewSeverity(e.target.value as Severity)}
                      value={newSeverity}
                    >
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="inc-assign">
                      Assignee
                    </label>
                    <input
                      className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none"
                      id="inc-assign"
                      onChange={(e) => setNewAssignee(e.target.value)}
                      placeholder={teamMembers[0]?.name ?? "Responder name"}
                      value={newAssignee}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="inc-playbook">
                    Response playbook
                  </label>
                  <input
                    className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none"
                    id="inc-playbook"
                    onChange={(e) => setNewPlaybook(e.target.value)}
                    value={newPlaybook}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="inc-summary">
                    Initial findings
                  </label>
                  <textarea
                    className="mt-1 min-h-20 w-full rounded-md border border-border bg-background p-2.5 text-xs text-foreground outline-none"
                    id="inc-summary"
                    onChange={(e) => setNewSummary(e.target.value)}
                    placeholder="Describe observed indicators, affected assets, and initial scope..."
                    value={newSummary}
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
                <Button
                  onClick={() => setShowCreateModal(false)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button size="sm" type="submit">
                  Create & persist incident
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* SDK & AI Guardrail Integration Modal */}
        {sdkServiceId && (
          <div
            aria-label="Connect Service SDK"
            className="fixed inset-0 z-40 grid place-items-center bg-background/75 p-4 backdrop-blur-xs"
            role="dialog"
          >
            {(() => {
              const targetSrv = protectedServices.find((item) => item.id === sdkServiceId);
              if (!targetSrv) return null;
              const snippet = `// SparrowX Production Guardrail SDK (${targetSrv.name})
// Service ID: ${targetSrv.id} | Key: ${targetSrv.apiKey}
const SPARROWX_SUPABASE_URL = "${supabaseUrl}";
const SPARROWX_INGEST_KEY = "${supabaseAnonKey}";

export async function reportThreatToSparrowX(event: {
  title: string;
  severity: "Critical" | "High" | "Medium";
  summary: string;
}) {
  await fetch(\`\${SPARROWX_SUPABASE_URL}/rest/v1/incidents\`, {
    method: "POST",
    headers: {
      apikey: SPARROWX_INGEST_KEY,
      Authorization: \`Bearer \${SPARROWX_INGEST_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: \`INC-\${Date.now().toString().slice(-4)}\`,
      title: event.title,
      source: "${targetSrv.category} · ${targetSrv.endpoint}",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      severity: event.severity,
      status: "Investigating",
      assignee: "${teamMembers[0]?.name ?? "Unassigned"}",
      summary: event.summary,
      playbook: "Automated Web & AI Shield Playbook",
      affected_assets: 1,
    }),
  });
}`;
              return (
                <div className="w-full max-w-2xl border border-border bg-card p-5 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <h2 className="text-base font-semibold">
                        Connect {targetSrv.name} to SparrowX
                      </h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Add this guardrail helper to your production Web App middleware or AI Agent tool-runner to stream security incidents directly into Supabase.
                      </p>
                    </div>
                    <Button
                      aria-label="Close SDK modal"
                      className="size-8"
                      onClick={() => setSdkServiceId(null)}
                      size="icon"
                      variant="ghost"
                    >
                      <X />
                    </Button>
                  </div>

                  <pre className="mt-4 max-h-80 overflow-x-auto border border-border bg-background p-3.5 font-mono text-xs leading-relaxed text-foreground">
                    {snippet}
                  </pre>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                    <span className="text-xs text-muted-foreground">
                      Service API Key: <code className="text-foreground">{targetSrv.apiKey}</code>
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => {
                          navigator.clipboard?.writeText(snippet);
                          showToast("Copied SparrowX SDK snippet to clipboard");
                        }}
                        size="sm"
                        variant="outline"
                      >
                        <Copy className="size-3.5" /> Copy SDK Snippet
                      </Button>
                      <Button
                        onClick={() => {
                          setSdkServiceId(null);
                          void sendVerificationEventForService(targetSrv);
                        }}
                        size="sm"
                      >
                        <Sparkles className="size-3.5" /> Send Verification Ping
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {notice && (
          <div
            className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-2.5rem)] items-center gap-3 border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg"
            role="status"
          >
            <Check className="size-4 shrink-0 text-success" />
            <span>{notice}</span>
            <Button
              aria-label="Dismiss notification"
              className="ml-1 size-7"
              onClick={() => setNotice("")}
              size="icon"
              variant="ghost"
            >
              <X />
            </Button>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}

function IncidentsSection({
  incidents,
  filteredIncidents,
  incidentFilter,
  onFilterChange,
  onResolve,
  onDelete,
  onExport,
  onInspect,
  onOpenCreate,
  onViewAll,
}: {
  incidents: Incident[];
  filteredIncidents: Incident[];
  incidentFilter: string;
  onFilterChange: (filter: string) => void;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onInspect: (id: string) => void;
  onOpenCreate: () => void;
  onViewAll?: () => void;
}) {
  return (
    <section className="border border-border bg-card">
      <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Live incidents</h2>
            <span className="grid size-5 place-items-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">
              {incidents.filter((item) => item.status !== "Contained").length}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Real-time security incidents persisted in Supabase.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-border p-1">
            {["All", "Critical", "High", "Medium"].map((filter) => (
              <Button
                aria-pressed={incidentFilter === filter}
                className="h-7 px-2.5 text-xs"
                key={filter}
                onClick={() => onFilterChange(filter)}
                size="sm"
                variant={incidentFilter === filter ? "secondary" : "ghost"}
              >
                {filter}
              </Button>
            ))}
          </div>
          <Button
            aria-label="Filter incidents by status"
            className="size-9"
            onClick={() => onFilterChange(incidentFilter === "Open" ? "All" : "Open")}
            size="icon"
            variant="outline"
          >
            <Filter />
          </Button>
          <Button
            aria-label="Export incidents as CSV"
            className="size-9"
            onClick={onExport}
            size="icon"
            variant="outline"
          >
            <Download />
          </Button>
        </div>
      </div>
      <div className="divide-y divide-border">
        {filteredIncidents.length > 0 ? (
          filteredIncidents.map((incident) => (
            <article
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              key={incident.id}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${
                    incident.severity === "Critical"
                      ? "bg-destructive"
                      : incident.severity === "High"
                        ? "bg-primary"
                        : "bg-warning"
                  }`}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <button
                      className="text-left text-sm font-medium hover:text-primary hover:underline"
                      onClick={() => onInspect(incident.id)}
                      type="button"
                    >
                      {incident.title}
                    </button>
                    <SeverityTag severity={incident.severity} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>{incident.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>{incident.source}</span>
                    <span aria-hidden="true">·</span>
                    <span>Assignee: {incident.assignee}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pl-5 sm:justify-end sm:pl-0">
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {incident.time}
                </span>
                <StatusTag status={incident.status} />
                <Button
                  aria-label={`Inspect ${incident.id}`}
                  className="h-8 px-2.5 text-xs"
                  onClick={() => onInspect(incident.id)}
                  size="sm"
                  variant="ghost"
                >
                  <Eye className="size-3.5" /> Details
                </Button>
                {incident.status !== "Contained" ? (
                  <Button
                    aria-label={`Mark ${incident.id} as contained`}
                    className="h-8 px-3 text-xs"
                    onClick={() => onResolve(incident.id)}
                    size="sm"
                    variant="outline"
                  >
                    <Check /> Contain
                  </Button>
                ) : (
                  <Button
                    aria-label={`${incident.id} contained`}
                    className="size-8 text-success"
                    disabled
                    size="icon"
                    variant="ghost"
                  >
                    <Check />
                  </Button>
                )}
                <Button
                  aria-label={`Delete ${incident.id}`}
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(incident.id)}
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </article>
          ))
        ) : (
          <div className="px-5 py-12 text-center">
            <ShieldCheck className="mx-auto size-6 text-success" />
            <p className="mt-3 text-sm font-medium">No active incidents in queue</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your production incident queue is clean. Connect a service SDK or report an incident manually.
            </p>
            <Button className="mt-4" onClick={onOpenCreate} size="sm" variant="outline">
              <Plus /> Report incident
            </Button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs sm:px-5">
        <span className="text-muted-foreground">
          Showing {filteredIncidents.length} of {incidents.length} incident(s)
        </span>
        {onViewAll && (
          <Button className="h-8 px-2 text-xs" onClick={onViewAll} variant="ghost">
            View all incidents <ArrowRight />
          </Button>
        )}
      </div>
    </section>
  );
}

function AppSidebar({
  activeNav,
  onNavigate,
  incidentCount,
  vulnCount,
  serviceCount,
  tenantCount,
  auditCount,
  backendSource,
  collapseMode,
  onCollapseModeChange,
  currentUser,
  isAdminSession,
  onSignOut,
  portalMode,
  activeClientTenant,
}: {
  activeNav: string;
  onNavigate: (label: string) => void;
  incidentCount: number;
  vulnCount: number;
  serviceCount: number;
  tenantCount: number;
  auditCount: number;
  backendSource: "supabase" | "offline";
  collapseMode: "icon" | "offcanvas";
  onCollapseModeChange: (mode: "icon" | "offcanvas") => void;
  currentUser: AppUser | null;
  isAdminSession: boolean;
  onSignOut: () => void;
  portalMode: "client" | "soc" | "admin";
  activeClientTenant: ClientTenant | null;
}) {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  const socNavItems = [
    { label: "Overview", icon: Activity },
    {
      label: "Web & AI Shield",
      icon: ShieldCheck,
      count: serviceCount > 0 ? String(serviceCount) : undefined,
    },
    {
      label: "Incidents",
      icon: Siren,
      count: incidentCount > 0 ? String(incidentCount) : undefined,
    },
    { label: "Threat intel", icon: Globe2 },
    { label: "Assets", icon: Boxes },
    {
      label: "Vulnerabilities",
      icon: ShieldAlert,
      count: vulnCount > 0 ? String(vulnCount) : undefined,
    },
    { label: "Reports", icon: FileSearch },
  ];

  // Client Area Hub Navigation
  const clientAreaNavItems: Array<{ label: string; icon: typeof Activity; count?: string }> = [
    {
      label: "My Services",
      icon: Boxes,
      count: tenantCount > 0 ? String(tenantCount) : undefined,
    },
    { label: "Subscriptions & Due Dates", icon: Activity },
    { label: "Profile Management", icon: Users },
  ];

  // Service-Specific Dynamic Dashboard Sidebar: Only renders modules enabled on the selected service!
  const clientEnabledModules = activeClientTenant?.enabledModules ?? [];
  const clientServiceDashboardItems: Array<{
    label: string;
    icon: typeof Activity;
    count?: string;
  }> = [
    { label: "Client Overview", icon: Sparkles },
    ...(clientEnabledModules.includes("web_security")
      ? [{ label: "Web & WAF Security", icon: Globe2 }]
      : []),
    ...(clientEnabledModules.includes("ai_shield")
      ? [{ label: "AI Agent & LLM Shield", icon: ShieldCheck }]
      : []),
    ...(clientEnabledModules.includes("cloud_security")
      ? [{ label: "Cloud & Endpoint Security", icon: Server }]
      : []),
    ...(clientEnabledModules.includes("compliance")
      ? [{ label: "Compliance & Evidence", icon: FileSearch }]
      : []),
    { label: "Subscription & Modules", icon: Wrench },
  ];

  // SparrowX Admin & Subscription Command Center Sidebar
  const adminNavItems: Array<{ label: string; icon: typeof Activity; count?: string }> = [
    {
      label: "Client Subscriptions",
      icon: Users,
      count: tenantCount > 0 ? String(tenantCount) : undefined,
    },
    { label: "Performance & Kill-Switch", icon: Activity },
    {
      label: "Access Control & Audit",
      icon: LockKeyhole,
      count: auditCount > 0 ? String(auditCount) : undefined,
    },
  ];

  const isInClientArea =
    !isAdminSession &&
    (activeNav === "My Services" ||
      activeNav === "Subscriptions & Due Dates" ||
      activeNav === "Profile Management" ||
      !activeClientTenant);

  const initials = currentUser?.fullName
    ? currentUser.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "SX";

  return (
    <Sidebar
      collapsible={collapseMode}
      className="border-r-2 border-sidebar-border bg-sidebar shadow-[6px_0_24px_-12px_rgba(0,0,0,0.75)]"
    >
      <SidebarHeader className="border-b border-sidebar-border/70 px-4 pb-3 pt-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
        <div className="flex items-center gap-3 px-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2 group-data-[collapsible=icon]:px-0">
          <button
            aria-label={isCollapsed ? "Expand sidebar" : "SparrowX Home"}
            className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105"
            onClick={() =>
              isCollapsed
                ? toggleSidebar()
                : onNavigate(isAdminSession ? "Client Subscriptions" : "My Services")
            }
            title={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Home"}
            type="button"
          >
            <ShieldCheck className="size-5" />
          </button>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="font-display text-base font-semibold">
              sparrow<span className="text-primary">x</span>
            </div>
            <div className="text-[10px] uppercase text-muted-foreground">
              {isAdminSession
                ? "Admin & SOC Command"
                : isInClientArea
                  ? "Client Area"
                  : "Service Dashboard"}
            </div>
          </div>
          <Button
            aria-label={isCollapsed ? "Expand sidebar" : "Minimize sidebar"}
            className="ml-auto size-8 border border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground hover:bg-sidebar-accent group-data-[collapsible=icon]:ml-0"
            onClick={toggleSidebar}
            size="icon"
            title={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Minimize sidebar (Ctrl+B)"}
            variant="ghost"
          >
            {isCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 group-data-[collapsible=icon]:hidden">
          <span
            className={`size-2 rounded-full ${
              backendSource === "supabase" ? "bg-success" : "bg-warning"
            }`}
          />
          <span className="truncate text-xs font-medium">
            {isAdminSession
              ? "Master Control"
              : isInClientArea
                ? currentUser?.fullName || "Client Account"
                : activeClientTenant?.name || "Service"}
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {isAdminSession
              ? "ADMIN"
              : !isInClientArea && activeClientTenant
                ? activeClientTenant.planTier.toUpperCase()
                : "ACTIVE"}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {isAdminSession ? (
          <>
            <SidebarGroup className="group-data-[collapsible=icon]:items-center">
              <SidebarGroupLabel>Admin & Subscriptions</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                  {adminNavItems.map(({ label, icon: Icon, count }) => (
                    <SidebarMenuItem key={label}>
                      <SidebarMenuButton
                        isActive={activeNav === label}
                        onClick={() => onNavigate(label)}
                        tooltip={label}
                      >
                        <Icon />
                        <span>{label}</span>
                        {count && <SidebarMenuBadge>{count}</SidebarMenuBadge>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup className="mt-1 group-data-[collapsible=icon]:items-center">
              <SidebarGroupLabel>SOC Operations</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                  {socNavItems.map(({ label, icon: Icon, count }) => (
                    <SidebarMenuItem key={label}>
                      <SidebarMenuButton
                        isActive={activeNav === label}
                        onClick={() => onNavigate(label)}
                        tooltip={label}
                      >
                        <Icon />
                        <span>{label}</span>
                        {count && <SidebarMenuBadge>{count}</SidebarMenuBadge>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={activeNav === "Team & access"}
                      onClick={() => onNavigate("Team & access")}
                      tooltip="Team & access"
                    >
                      <Users />
                      <span>Team & access</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={activeNav === "Integrations"}
                      onClick={() => onNavigate("Integrations")}
                      tooltip="Integrations"
                    >
                      <Boxes />
                      <span>Integrations</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : isInClientArea ? (
          <SidebarGroup className="group-data-[collapsible=icon]:items-center">
            <SidebarGroupLabel>Client Area</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                {clientAreaNavItems.map(({ label, icon: Icon, count }) => (
                  <SidebarMenuItem key={label}>
                    <SidebarMenuButton
                      isActive={activeNav === label}
                      onClick={() => onNavigate(label)}
                      tooltip={label}
                    >
                      <Icon />
                      <span>{label}</span>
                      {count && <SidebarMenuBadge>{count}</SidebarMenuBadge>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <SidebarGroup className="group-data-[collapsible=icon]:items-center">
            <SidebarGroupLabel>Service Dashboard</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="border border-sidebar-border bg-sidebar-accent/40 font-medium text-primary"
                    onClick={() => onNavigate("My Services")}
                    tooltip="Back to Client Area"
                  >
                    <Boxes />
                    <span>← Back to Client Area</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {clientServiceDashboardItems.map(({ label, icon: Icon, count }) => (
                  <SidebarMenuItem key={label}>
                    <SidebarMenuButton
                      isActive={activeNav === label}
                      onClick={() => onNavigate(label)}
                      tooltip={label}
                    >
                      <Icon />
                      <span>{label}</span>
                      {count && <SidebarMenuBadge>{count}</SidebarMenuBadge>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:p-2">
        <SidebarMenu className="group-data-[collapsible=icon]:items-center">
          <SidebarMenuItem>
            <SidebarMenuButton
              className="border border-sidebar-border bg-sidebar-accent/30 font-medium text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={toggleSidebar}
              tooltip={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Minimize sidebar (Ctrl+B)"}
            >
              {isCollapsed ? <PanelLeftOpen className="text-primary" /> : <PanelLeftClose className="text-primary" />}
              <span>{isCollapsed ? "Expand sidebar" : "Minimize sidebar"}</span>
              <kbd className="ml-auto rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">
                ^B
              </kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
            <div className="flex items-center justify-between rounded-md border border-sidebar-border/70 bg-sidebar/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
              <span>Minimize mode</span>
              <div className="flex items-center gap-1">
                <button
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                    collapseMode === "icon"
                      ? "bg-primary text-primary-foreground"
                      : "hover:text-foreground"
                  }`}
                  onClick={() => onCollapseModeChange("icon")}
                  title="Collapse to compact icon rail"
                  type="button"
                >
                  Icons
                </button>
                <button
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                    collapseMode === "offcanvas"
                      ? "bg-primary text-primary-foreground"
                      : "hover:text-foreground"
                  }`}
                  onClick={() => onCollapseModeChange("offcanvas")}
                  title="Completely hide sidebar when minimized"
                  type="button"
                >
                  Full hide
                </button>
              </div>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activeNav === "Help center"}
              onClick={() => onNavigate("Help center")}
              tooltip="Help center"
            >
              <CircleHelp />
              <span>Help center</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activeNav === "Settings"}
              onClick={() => onNavigate("Settings")}
              tooltip="Settings"
            >
              <Menu />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="mt-2 flex items-center gap-2 border-t border-sidebar-border px-1 pt-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-semibold">
            {initials}
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-xs font-medium">
              {currentUser?.fullName || "Account"}
            </div>
            <div className="truncate text-[10px] text-muted-foreground">
              {currentUser?.email || "Authenticated"}
            </div>
          </div>
          <Button
            aria-label="Log out to login page"
            className="ml-auto h-7 px-2 text-[11px] text-destructive hover:text-destructive group-data-[collapsible=icon]:hidden"
            onClick={onSignOut}
            size="sm"
            title="Log Out to Login Page"
            variant="ghost"
          >
            Log Out
          </Button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function MetricCard({
  icon,
  label,
  value,
  suffix,
  change,
  trend,
  footnote,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  change: string;
  trend: "up" | "alert";
  footnote: string;
}) {
  return (
    <article className="border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="grid size-8 place-items-center rounded-md bg-secondary text-muted-foreground [&_svg]:size-4">
          {icon}
        </span>
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-semibold">{value}</span>
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className={`font-semibold ${trend === "alert" ? "text-destructive" : "text-success"}`}>
          {change}
        </span>
        <span className="text-muted-foreground">{footnote}</span>
      </div>
    </article>
  );
}

function RiskLegend({ label, count, color }: { label: string; count: string; color: string }) {
  return (
    <div className="flex min-w-28 items-center gap-2">
      <span className={`size-2 rounded-full ${color}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium text-foreground">{count}</span>
    </div>
  );
}

function SeverityTag({ severity }: { severity: Severity }) {
  const style =
    severity === "Critical"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : severity === "High"
        ? "border-primary/30 bg-primary/10 text-primary"
        : "border-warning/30 bg-warning/10 text-warning";
  return (
    <span className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${style}`}>
      {severity}
    </span>
  );
}

function StatusTag({ status }: { status: IncidentStatus }) {
  const style =
    status === "Contained"
      ? "border-success/30 bg-success/10 text-success"
      : status === "Investigating"
        ? "border-info/30 bg-info/10 text-info"
        : "border-border bg-secondary text-muted-foreground";
  return (
    <span className={`min-w-[91px] rounded-sm border px-2 py-1 text-center text-[10px] font-medium ${style}`}>
      {status}
    </span>
  );
}

function SignalItem({
  icon,
  label,
  detail,
  state,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  state: string;
  onClick?: () => void;
}) {
  return (
    <button
      className="flex w-full items-center gap-3 border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
      onClick={onClick}
      type="button"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{label}</div>
        <div className="mt-1 truncate text-[10px] text-muted-foreground">{detail}</div>
      </div>
      <span className="hidden items-center gap-1 text-[10px] text-success sm:flex">
        <span className="size-1.5 rounded-full bg-success" />
        {state}
      </span>
    </button>
  );
}
