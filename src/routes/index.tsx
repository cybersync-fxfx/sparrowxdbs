import { AiGuardrailSandbox } from "@/components/AiGuardrailSandbox";
import {
  BackgroundEngineToaster,
  emitEngineActivity,
  emitEngineToast,
} from "@/components/BackgroundEngineToaster";
import { ClientIntegrationModal } from "@/components/ClientIntegrationModal";
import { generateComplianceReportDocument } from "@/lib/client-sdk-generator";
import { FirewallRuleExporter } from "@/components/FirewallRuleExporter";
import { IncidentTimelineView } from "@/components/IncidentTimelineView";
import { LiveWebhookDispatcherManager } from "@/components/LiveWebhookDispatcherManager";
import { NotificationCenterDrawer } from "@/components/NotificationCenterDrawer";
import { CheckpointsAndProbesView } from "@/components/CheckpointsAndProbesView";
import { LiveOperationsView } from "@/components/LiveOperationsView";
import { IncidentStatisticsView } from "@/components/IncidentStatisticsView";
import { ThreatHuntingView } from "@/components/ThreatHuntingView";
import { SiemAndDetectionRulesView } from "@/components/SiemAndDetectionRulesView";
import { ProtectionVerificationCenter } from "@/components/ProtectionVerificationCenter";
import { ErrorDocumentationCenter } from "@/components/ErrorDocumentationCenter";
import { AdminErrorMonitoring } from "@/components/AdminErrorMonitoring";
import { UserActivityHistory } from "@/components/UserActivityHistory";
import { SystemStatusSection } from "@/components/SystemStatusSection";
import {
  notifySuccess,
  notifyError,
  notifyWarning,
  notifyInfo,
  notifyLoading,
  registerGlobalDocsNavigator,
} from "@/lib/feedback";
import {
  GlobalAiBrainFloatingDock,
  SparrowxAiBrainCenter,
} from "@/components/SparrowxAiBrainCenter";
import { GlobalTrafficMeshGlobe } from "@/components/GlobalTrafficMeshGlobe";
import { SovereignDatabaseStudio } from "@/components/SovereignDatabaseStudio";
import { SparrowxApiGatewayPortal } from "@/components/SparrowxApiGatewayPortal";
import { SparrowxDropEngine } from "@/components/SparrowxDropEngine";
import { SparrowxKeysEngine } from "@/components/SparrowxKeysEngine";
import { SparrowxShieldEngine } from "@/components/SparrowxShieldEngine";
import { SparrowxMasterLanding } from "@/components/SparrowxMasterLanding";
import { useEffect, useMemo, useState, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Brain,
  Building2,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Coins,
  Command,
  Copy,
  CreditCard,
  Crosshair,
  Database,
  Download,
  Ellipsis,
  Eye,
  FileSearch,
  FileText,
  Filter,
  Globe2,
  KeyRound,
  Layers3,
  LockKeyhole,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Trash2,
  Bug,
  Users,
  Wrench,
  X,
  Zap,
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
import { DashboardSettingsAndConnector } from "@/components/DashboardSettingsAndConnector";
import {
  analyzePromptInSandbox,
  dispatchIncidentWebhook,
  exportFirewallBlocklist,
  getIncidentTimeline,
  appendIncidentTimelineEvent,
  getSavedWebhooks,
  saveWebhooks,
  issueSignedSessionToken,
  verifySessionToken,
  clearSessionToken,
  type WebhookConfig,
  type AiGuardrailTestResult,
  type FirewallFormat,
} from "@/lib/advanced-features";
import {
  type AppUser,
  type Asset,
  type AuditLogEntry,
  clearAllIncidentsFromBackend,
  type ClientTenant,
  computeLiveSnapshot,
  deleteRecordFromBackend,
  fetchAllWorkspaceData,
  fetchAppUserByEmailFromBackend,
  generateSecureSparrowKey,
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
  type TeamMember,
  type ThreatIndicator,
  type Vulnerability,
} from "@/lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SparrowX | Here for you" },
      {
        name: "description",
        content:
          "SparrowX — Autonomous Security Operations Platform, Real-Time Threat Interception & AI Guardrails.",
      },
      { property: "og:title", content: "SparrowX | Here for you" },
      {
        property: "og:description",
        content:
          "SparrowX — Autonomous Security Operations Platform, Real-Time Threat Interception & AI Guardrails.",
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

  const [showAuthLogin, setShowAuthLogin] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return (
      params.get("login") === "1" ||
      params.get("auth") === "1" ||
      params.get("signin") === "1"
    );
  });

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
  const [activeDocCode, setActiveDocCode] = useState<string | null>(null);
  const [activeDocRef, setActiveDocRef] = useState<string | null>(null);
  const [activeDocSection, setActiveDocSection] = useState<"sdk_install" | "errors" | "dns_verification">("sdk_install");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapseMode, setSidebarCollapseMode] = useState<"icon" | "offcanvas">("icon");
  const [incidentFilter, setIncidentFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<RangeOption>("24 hours");
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("Unauthorized Access");

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

  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "cooking" = "success",
  ) => {
    setNotice(message);
    if (type === "success") {
      notifySuccess(message, { target: activeNav });
    } else if (type === "error") {
      notifyError(message, {
        target: activeNav,
        onNavigateToDocs: (code, refId) => {
          setActiveDocCode(code);
          if (refId) setActiveDocRef(refId);
          handleNavigate("Troubleshooting & Docs");
        },
      });
    } else if (type === "cooking") {
      notifyLoading(message, { target: activeNav });
    } else {
      notifyInfo(message, { target: activeNav });
    }
    window.setTimeout(() => setNotice(""), 3500);
  };

  useEffect(() => {
    document.title = "SparrowX | Here for you";
    registerGlobalDocsNavigator((code, refId) => {
      setActiveDocCode(code);
      if (refId) setActiveDocRef(refId);
      handleNavigate("Troubleshooting & Docs");
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      } else if (e.key === "Escape") {
        setSearchOpen(false);
        searchInputRef.current?.blur();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setIsLoadingWorkspace(true);

    // Restore authenticated session from signed token if present
    const storedSession = verifySessionToken();
    if (storedSession) {
      if (storedSession.role === "admin") {
        setAuthSession({
          role: "admin",
          operatorName: storedSession.fullName || "SparrowX Admin",
          operatorEmail: storedSession.email,
        });
        setPortalMode("soc");
      } else {
        setAuthSession({
          role: "client",
          tenantId: storedSession.tenantId,
          userEmail: storedSession.email,
        });
        if (storedSession.tenantId) {
          setSelectedTenantId(storedSession.tenantId);
        }
        setPortalMode("client");
        setActiveNav((prev) => (prev === "Overview" ? "My Services" : prev));
      }
      setCurrentUser({
        id: storedSession.sub,
        email: storedSession.email,
        password: "",
        fullName: storedSession.fullName || storedSession.email.split("@")[0] || "Operator",
        admin: storedSession.role === "admin" ? "yes" : "no",
        tenantId: storedSession.tenantId,
      });

      // Live sync `admin` column ("yes" vs "no") from `app_users` database table
      void fetchAppUserByEmailFromBackend(storedSession.email).then((dbUser) => {
        if (!active || !dbUser) return;
        const isDbAdmin = dbUser.admin === "yes";
        setCurrentUser(dbUser);
        issueSignedSessionToken({
          id: dbUser.id || storedSession.sub,
          email: dbUser.email,
          fullName: dbUser.fullName || storedSession.fullName,
          role: isDbAdmin ? "admin" : "client",
          tenantId: dbUser.tenantId ?? storedSession.tenantId,
        });
        if (isDbAdmin) {
          setAuthSession({
            role: "admin",
            operatorName: dbUser.fullName || storedSession.fullName || "SparrowX Admin",
            operatorEmail: dbUser.email,
          });
          setPortalMode("soc");
        } else {
          setAuthSession({
            role: "client",
            tenantId: dbUser.tenantId ?? storedSession.tenantId,
            userEmail: dbUser.email,
          });
          if (dbUser.tenantId) {
            setSelectedTenantId(dbUser.tenantId);
          }
          setPortalMode("client");
          setActiveNav((prev) => (prev === "Overview" ? "My Services" : prev));
        }
      });
    }

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
        setSelectedTenantId((prev) => prev ?? data.clientTenants[0]?.id ?? null);
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
        ? "Synced live records from SparrowX Cloud"
        : "Unable to reach cloud backend — check connection settings",
    );
  };

  const handlePurgeAllIncidents = async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "CAUTION: Are you sure you want to purge all security incident records from the backend? This action cannot be undone.",
      )
    ) {
      return;
    }
    setIsSyncing(true);
    await clearAllIncidentsFromBackend();
    setIncidents([]);
    setIsSyncing(false);
    showToast("All incident records purged");
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
      apiKey: generateSecureSparrowKey(`spx_live_${prefix}`),
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
    if (
      typeof window !== "undefined" &&
      !window.confirm("Are you sure you want to delete this protected service configuration?")
    ) {
      return;
    }
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
    // Auto-dispatch High & Critical security alerts to Slack/Discord/PagerDuty
    void dispatchIncidentWebhook(created).then((res) => {
      if (res.dispatched > 0) {
        showToast(`Alert broadcast to ${res.dispatched} webhook channel(s)`);
      }
    });

    showToast(`Verification event ${created.id} persisted to SparrowX Cloud`);
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

  const chartPath = useMemo(() => {
    const pts = currentSnapshot.riskPoints;
    const maxVal = Math.max(1, ...pts);
    return pts
      .map((value, index) => {
        const x = (index / Math.max(1, pts.length - 1)) * 720;
        const y = 126 - (value > 0 ? (value / maxVal) * 95 : 0);
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }, [currentSnapshot]);

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

  const highOpenCount = useMemo(
    () =>
      incidents.filter((item) => item.status !== "Contained" && item.severity === "High").length,
    [incidents],
  );

  const onDutyCount = useMemo(() => teamMembers.filter((m) => m.onCall).length, [teamMembers]);

  const unreadNotifCount = useMemo(
    () =>
      incidents.filter((item) => item.status !== "Contained" && item.severity === "Critical")
        .length +
      vulnerabilities.filter((v) => v.status === "Open" && v.severity === "Critical").length +
      threatIndicators.filter((t) => t.blocked && t.severity === "Critical").length,
    [incidents, vulnerabilities, threatIndicators],
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
    appendIncidentTimelineEvent(id, {
      stage: "Contained",
      actor: primaryOperator?.name ?? "SecOps Responder",
      summary: "Containment executed. Perimeter firewall updated and target isolated.",
    });
    showToast(`${id} marked as contained`);
  };

  const deleteIncident = async (id: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Are you sure you want to permanently delete incident ${id}?`)
    ) {
      return;
    }
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
      title: `[${newCategory}] ${newTitle.trim()}`,
      source: newSource.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      severity: newSeverity,
      status: "Investigating",
      assignee: newAssignee.trim() || teamMembers[0]?.name || "Unassigned",
      summary: `${newCategory}: ${newSummary.trim() || "Incident logged for triage and containment review."}`,
      playbook: newPlaybook.trim() || `${newCategory} Response Playbook`,
      affectedAssets: 1,
    };
    setIncidents((current) => [created, ...current]);
    setShowCreateModal(false);
    setNewTitle("");
    setNewSource("");
    setNewSummary("");
    setSelectedIncidentId(created.id);
    await persistIncidentToBackend(created);
    showToast(`${created.id} created and persisted to SparrowX Cloud`);
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
    if (
      typeof window !== "undefined" &&
      !window.confirm("Remove this indicator from active firewall IOC blocking?")
    ) {
      return;
    }
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
      parts.length >= 2 && Boolean(parts[0]) && Boolean(parts[parts.length - 1])
        ? `${(parts[0] || "").charAt(0)}${(parts[parts.length - 1] || "").charAt(0)}`.toUpperCase()
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
      description: newIntegrationDesc.trim() || "Production security telemetry & webhook pipeline.",
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
      apiKey: generateSecureSparrowKey("spx_tenant_live"),
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
          apiKey: generateSecureSparrowKey("spx_tenant_live"),
        };
        return updated;
      }),
    );
    if (updated) {
      await persistClientTenantToBackend(updated);
      await recordAudit(
        "Rotated production tenant API key",
        (updated as ClientTenant).name,
        "Warning",
      );
      showToast(`Rotated API key for ${(updated as ClientTenant).name}`);
    }
  };

  const handleDeleteTenant = async (tenantId: string) => {
    const target = clientTenants.find((t) => t.id === tenantId);
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Are you sure you want to permanently remove "${target?.name ?? "this client service"}"? All associated keys and protection rules will be terminated.`,
      )
    ) {
      return;
    }
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
      password: updates.newPassword ? updates.newPassword : "",
    };
    setCurrentUser({ ...updatedUser, password: "" });
    await persistAppUserToBackend(updatedUser);
    showToast("Account profile updated");
  };

  const handleEnforceGlobalAutoBlock = async (learnedCount: number) => {
    const unblockedIocs = threatIndicators.filter((i) => !i.blocked);
    if (unblockedIocs.length > 0) {
      setThreatIndicators((prev) => prev.map((item) => ({ ...item, blocked: true })));
      await Promise.all(
        unblockedIocs.map((ioc) => persistThreatIndicatorToBackend({ ...ioc, blocked: true })),
      );
    }

    const auditOnlyServices = protectedServices.filter((s) => s.mode === "Monitor Only");
    if (auditOnlyServices.length > 0) {
      setProtectedServices((prev) =>
        prev.map((s) => ({ ...s, mode: "Active Shield" as ProtectionMode })),
      );
      await Promise.all(
        auditOnlyServices.map((s) =>
          persistProtectedServiceToBackend({ ...s, mode: "Active Shield" }),
        ),
      );
    }

    await recordAudit(
      `SparrowX AI Brain learned ${learnedCount} new signature(s), auto-blocked ${unblockedIocs.length} indicator(s), and enforced Active Blocking across all services`,
      "Global AI Brain Defense Mesh",
      "Info",
    );
  };

  const handleSignOut = () => {
    clearSessionToken();
    setCurrentUser(null);
    setAuthSession({ role: "unauthenticated" });
    setMenuOpen(false);
    showToast("Logged out of account");
  };

  const visibleClientTenants = useMemo(() => {
    if (authSession.role === "admin") return clientTenants;
    if (authSession.role !== "client") return [];
    return clientTenants.filter((t) => {
      if (authSession.tenantId && t.id === authSession.tenantId) {
        return true;
      }
      if (t.contactEmail.toLowerCase() === authSession.userEmail.toLowerCase()) {
        return true;
      }
      const domainPart = authSession.userEmail.split("@")[1]?.toLowerCase();
      if (domainPart && t.primaryDomain.toLowerCase().includes(domainPart)) {
        return true;
      }
      return false;
    });
  }, [clientTenants, authSession]);

  const activeClientTenant = useMemo(() => {
    return (
      visibleClientTenants.find((t) => t.id === selectedTenantId) ??
      visibleClientTenants[0] ??
      null
    );
  }, [visibleClientTenants, selectedTenantId]);

  const visibleClientServices = useMemo(() => {
    if (authSession.role !== "client") return protectedServices;
    const clientTenantIds = new Set(visibleClientTenants.map((t) => t.id));
    const clientDomains = new Set(
      visibleClientTenants
        .map((t) =>
          t.primaryDomain
            .replace(/^https?:\/\//i, "")
            .replace(/^agent:\/\//i, "")
            .split("/")[0]
            .split(":")[0]
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    );
    return protectedServices.filter((s) => {
      if (s.tenantId && clientTenantIds.has(s.tenantId)) return true;
      const cleanEp = s.endpoint
        .replace(/^https?:\/\//i, "")
        .replace(/^agent:\/\//i, "")
        .split("/")[0]
        .split(":")[0]
        .trim()
        .toLowerCase();
      if (clientDomains.has(cleanEp)) return true;
      return false;
    });
  }, [protectedServices, visibleClientTenants, authSession]);

  const handleNavigate = (navLabel: string) => {
    if (navLabel === "AI Brain" || navLabel === "SparrowX AI Brain") {
      if (authSession.role !== "admin") {
        showToast("SparrowX AI Brain is restricted to administrator accounts.", "error");
        setActiveNav("My Services");
        return;
      }
    }

    if (authSession.role === "client") {
      // Strict multi-tenant isolation: prevent client users from opening global SOC or admin screens
      const restrictedForClients = [
        "Overview",
        "Dashboard",
        "Security Overview",
        "Live Operations",
        "Incidents",
        "Threat Hunting",
        "Incident Statistics",
        "Detection Rules & SIEM",
        "Checkpoints & Probes",
        "Client Subscriptions",
        "Performance & Kill-Switch",
        "Access Control & Audit",
      ];
      if (restrictedForClients.includes(navLabel)) {
        showToast("Access Restricted: This view requires Administrator or SOC privileges.", "error");
        setActiveNav("My Services");
        setPortalMode("client");
        return;
      }
    }

    if (navLabel === "Notifications") {
      setNotificationDrawerOpen(true);
      return;
    }
    if (
      navLabel === "Error Monitoring" ||
      navLabel === "SOC Error Monitoring" ||
      navLabel === "error_monitoring"
    ) {
      if (authSession.role !== "admin") {
        showToast("Access Restricted: Error Monitoring Dashboard is for Administrators.", "error");
        return;
      }
      setPortalMode("admin");
      setActiveNav("Error Monitoring");
      return;
    }
    if (
      navLabel === "Installation & Integration Docs" ||
      navLabel === "How-To Install Docs"
    ) {
      setActiveDocSection("sdk_install");
      setActiveNav("Troubleshooting & Docs");
      return;
    }
    if (
      navLabel === "Troubleshooting & Docs" ||
      navLabel === "Troubleshooting & Error Center" ||
      navLabel === "docs_errors"
    ) {
      setActiveNav("Troubleshooting & Docs");
      return;
    }
    if (
      navLabel === "System Status" ||
      navLabel === "System Status & Health" ||
      navLabel === "system_status"
    ) {
      setActiveNav("System Status");
      return;
    }
    if (
      navLabel === "Activity History" ||
      navLabel === "Activity & Operations History" ||
      navLabel === "activity_history"
    ) {
      setActiveNav("Activity History");
      return;
    }
    if (navLabel === "Client Subscriptions" || navLabel === "Performance & Kill-Switch") {
      if (authSession.role !== "admin") {
        showToast("Access Restricted: Admin Master requires Administrator credentials.", "error");
        return;
      }
      setPortalMode("admin");
    } else if (navLabel === "Access Control & Audit") {
      if (authSession.role !== "admin") {
        showToast("Access Restricted: Access Control requires Administrator credentials.", "error");
        return;
      }
      if (portalMode !== "soc") {
        setPortalMode("admin");
      }
    } else if (
      navLabel === "My Services" ||
      navLabel === "Clients & Services" ||
      navLabel === "Subscriptions & Due Dates" ||
      navLabel === "Billing & Credits" ||
      navLabel === "Profile Management"
    ) {
      setPortalMode("client");
    } else if (
      navLabel === "Client Overview" ||
      navLabel === "Web & WAF Security" ||
      navLabel === "AI Agent & LLM Shield" ||
      navLabel === "Cloud & Endpoint Security" ||
      navLabel === "Compliance & Evidence" ||
      navLabel === "Subscription & Modules"
    ) {
      setPortalMode("client");
    } else if (
      navLabel === "Help center" ||
      navLabel === "Settings" ||
      navLabel === "AI Brain" ||
      navLabel === "SparrowX AI Brain" ||
      navLabel === "Protection Status & Verification" ||
      navLabel === "Protection Verification" ||
      navLabel === "Protection Status" ||
      navLabel === "Global Traffic Mesh" ||
      navLabel === "Live Traffic Mesh"
    ) {
      // Retain current active portalMode (works in SOC Command, Client Area, and Admin)
    } else {
      // All SOC Operations (Overview, Incidents, Threat indicators, CVEs, Assets, Team, Integrations)
      if (authSession.role === "admin") {
        setPortalMode("soc");
      } else {
        setPortalMode("client");
      }
    }
    setActiveNav(navLabel === "SparrowX AI Brain" ? "AI Brain" : navLabel);
  };

  // Dedicated Domain Ingress Routing (Priority checks before login/SOC)
  const isStudioDomainOrParam =
    typeof window !== "undefined" &&
    (window.location.hostname.startsWith("db.") ||
      window.location.hostname.startsWith("studio.") ||
      window.location.hostname.startsWith("supabase.") ||
      window.location.hostname.startsWith("sparrowbase.") ||
      new URLSearchParams(window.location.search).get("studio") === "1" ||
      new URLSearchParams(window.location.search).get("studio") === "true" ||
      new URLSearchParams(window.location.search).get("sparrowbase") === "1" ||
      new URLSearchParams(window.location.search).get("db") === "1");

  const isApiDomainOrParam =
    typeof window !== "undefined" &&
    (window.location.hostname.startsWith("api.") ||
      window.location.hostname.startsWith("rest.") ||
      new URLSearchParams(window.location.search).get("api") === "1");

  const isFileDomainOrParam =
    typeof window !== "undefined" &&
    (window.location.hostname.startsWith("file.") ||
      window.location.hostname.startsWith("drop.") ||
      window.location.hostname.startsWith("share.") ||
      new URLSearchParams(window.location.search).get("file") === "1" ||
      new URLSearchParams(window.location.search).get("drop") === "1");

  const isPasswordDomainOrParam =
    typeof window !== "undefined" &&
    (window.location.hostname.startsWith("password.") ||
      window.location.hostname.startsWith("passwd.") ||
      window.location.hostname.startsWith("pass.") ||
      window.location.hostname.startsWith("keys.") ||
      new URLSearchParams(window.location.search).get("password") === "1" ||
      new URLSearchParams(window.location.search).get("passwd") === "1" ||
      new URLSearchParams(window.location.search).get("keys") === "1");

  const isShieldDomainOrParam =
    typeof window !== "undefined" &&
    (window.location.hostname.startsWith("shield.") ||
      window.location.hostname.startsWith("sec.") ||
      new URLSearchParams(window.location.search).get("shield") === "1" ||
      new URLSearchParams(window.location.search).get("sec") === "1");

  // 1. If visiting db.sparrowx.net or ?db=1 -> Direct to Sovereign DB Studio
  if (isStudioDomainOrParam) {
    return (
      <>
        <SovereignDatabaseStudio
          isStandaloneDomain={true}
          onClose={() => setActiveNav("Overview")}
        />
        <BackgroundEngineToaster />
      </>
    );
  }

  // 2. If visiting api.sparrowx.net or ?api=1 -> Direct to REST API Gateway Portal & Documentation
  if (isApiDomainOrParam) {
    return (
      <>
        <SparrowxApiGatewayPortal />
        <BackgroundEngineToaster />
      </>
    );
  }

  // 3. If visiting file.sparrowx.net or ?file=1 -> Direct to SparrowX Drop Ephemeral File Sharing
  if (isFileDomainOrParam) {
    return (
      <>
        <SparrowxDropEngine />
        <BackgroundEngineToaster />
      </>
    );
  }

  // 4. If visiting password.sparrowx.net or passwd.sparrowx.net -> Direct to SparrowX Keys Cryptographic Engine
  if (isPasswordDomainOrParam) {
    return (
      <>
        <SparrowxKeysEngine />
        <BackgroundEngineToaster />
      </>
    );
  }

  // 5. If visiting shield.sparrowx.net or ?shield=1 -> Direct to SparrowX Shield Edge Defense
  if (isShieldDomainOrParam) {
    return (
      <>
        <SparrowxShieldEngine />
        <BackgroundEngineToaster />
      </>
    );
  }

  // 6. Root domain (sparrowx.net / www.sparrowx.net) -> Central Master Landing Page of SparrowX Technologies
  if (authSession.role === "unauthenticated") {
    if (!showAuthLogin) {
      return (
        <>
          <SparrowxMasterLanding
            onOpenLogin={() => setShowAuthLogin(true)}
            onDirectNav={(target) => {
              if (typeof window === "undefined") return;
              const url = new URL(window.location.href);
              if (target === "db") url.searchParams.set("db", "1");
              else if (target === "file") url.searchParams.set("file", "1");
              else if (target === "password") url.searchParams.set("password", "1");
              else if (target === "sec") url.searchParams.set("shield", "1");
              else if (target === "api") url.searchParams.set("api", "1");
              window.location.href = url.toString();
            }}
          />
          <BackgroundEngineToaster />
        </>
      );
    }

    return (
      <>
        <div className="bg-[#070D18] border-b border-[#1E293B] px-6 py-2.5 flex items-center justify-between text-xs font-sans">
          <button
            type="button"
            onClick={() => setShowAuthLogin(false)}
            className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-2 transition-colors"
          >
            <span>← Return to SparrowX Technologies Master Landing</span>
          </button>
          <span className="text-zinc-500 font-mono text-[11px] hidden sm:inline">
            SparrowX SOC &amp; Operator Authentication Portal
          </span>
        </div>
        <PortalLoginScreen
          backendSource={backendSource}
          onRegisterAndLoginUser={async (input) => {
            emitEngineActivity(
              "Auth Register",
              `Provisioning workspace for ${input.email}...`,
              "cooking",
            );
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
                apiKey: generateSecureSparrowKey("spx_tenant_live"),
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

            // Issue signed cryptographic session token
            issueSignedSessionToken({
              id: createdUser.id,
              email: createdUser.email,
              fullName: createdUser.fullName,
              role: "client",
              tenantId: createdTenant?.id ?? null,
            });
            setCurrentUser({ ...createdUser, password: "" });
            setAuthSession({
              role: "client",
              tenantId: createdTenant?.id ?? null,
              userEmail: createdUser.email,
            });
            setPortalMode("client");
            setActiveNav("My Services");
            emitEngineToast(
              `Welcome ${createdUser.fullName} — Workspace ready`,
              "success",
              "Account Created",
            );
            emitEngineActivity("Auth", `Session created for ${createdUser.email}`, "success");
            showToast(`Welcome ${createdUser.fullName} — Client Area ready`);
            return {};
          }}
          onUserAuthenticated={(user) => {
            issueSignedSessionToken({
              id: user.id,
              email: user.email,
              fullName: user.fullName,
              role: user.admin === "yes" ? "admin" : "client",
              tenantId: user.tenantId,
            });
            setCurrentUser(user);
            if (user.admin === "yes") {
              setAuthSession({
                role: "admin",
                operatorName: user.fullName || "SparrowX Admin",
                operatorEmail: user.email,
              });
              setPortalMode("soc");
              setActiveNav("Overview");
              void recordAudit(
                `Admin user ${user.email} (admin=yes) authenticated into Admin Command Center`,
                "Admin & Subscriptions Portal",
                "Info",
              );
              emitEngineToast(
                `Admin session active (${user.email})`,
                "success",
                "Admin Authenticated",
              );
              emitEngineActivity("Auth", `Admin ${user.email} logged into SOC command`, "success");
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
              emitEngineToast(
                `Welcome back, ${user.fullName || user.email}`,
                "success",
                "Authenticated",
              );
              emitEngineActivity("Auth", `Client user ${user.email} session restored`, "success");
              showToast(`Welcome back, ${user.fullName || user.email}`);
            }
          }}
          tenants={clientTenants}
        />
        <BackgroundEngineToaster />
      </>
    );
  }

  if (
    authSession.role === "admin" &&
    (activeNav === "Supabase Studio" || activeNav === "SparrowX DB")
  ) {
    return (
      <>
        <SovereignDatabaseStudio
          isStandaloneDomain={false}
          onClose={() => setActiveNav("Overview")}
        />
        <BackgroundEngineToaster />
      </>
    );
  }

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];

    const results: Array<{
      id: string;
      title: string;
      description: string;
      category: "Security Module" | "Navigation" | "Incident" | "Service" | "Database";
      badge: string;
      action: () => void;
    }> = [];

    // 1. Core Security & WAF Rules
    const securityItems = [
      {
        title: "Web & WAF Security",
        description: "Edge reverse proxy, SQL injection filters, OWASP Top 10, rate limiting & DDoS mitigation",
        category: "Security Module" as const,
        badge: "WAF Active",
        keywords: ["waf", "web", "firewall", "shield", "sqli", "sql injection", "xss", "ddos", "proxy", "edge", "rules"],
        action: () => {
          handleNavigate("Web & WAF Security");
          setSearch("");
          setSearchOpen(false);
          showToast("Navigated to Web & WAF Security module");
        },
      },
      {
        title: "AI Agent & LLM Shield",
        description: "Zero-latency prompt firewall, adversarial jailbreak protection, and MCP tool call defense",
        category: "Security Module" as const,
        badge: "AI Guard",
        keywords: ["ai", "llm", "agent", "prompt", "jailbreak", "mcp", "guardrails", "guard"],
        action: () => {
          handleNavigate("AI Agent & LLM Shield");
          setSearch("");
          setSearchOpen(false);
          showToast("Navigated to AI Agent & LLM Shield");
        },
      },
      {
        title: "Protection Status & Verification",
        description: "Live health probe, edge DNS verification, latency checks, and inline protection auditing",
        category: "Security Module" as const,
        badge: "Verification",
        keywords: ["verify", "verification", "status", "probe", "dns", "latency", "health", "audit"],
        action: () => {
          handleNavigate("Protection Status & Verification");
          setSearch("");
          setSearchOpen(false);
          showToast("Navigated to Protection Status & Verification Center");
        },
      },
      {
        title: "SparrowX DB (DBaaS)",
        description: "Sovereign Postgres 16, pgvector embeddings, connection pooler (:6543), and REST APIs",
        category: "Database" as const,
        badge: "DBaaS",
        keywords: ["db", "database", "postgres", "sparrowbase", "supabase", "sql", "pooler", "keys", "vector"],
        action: () => {
          handleNavigate("SparrowX DB");
          setSearch("");
          setSearchOpen(false);
        },
      },
      {
        title: "Live Traffic Mesh & Threat Map",
        description: "Visual attack vectors, live threat arcs, host beacons, and connection streams",
        category: "Navigation" as const,
        badge: "Threat Map",
        keywords: ["map", "globe", "traffic", "mesh", "matrix", "threats", "arcs", "streams", "live"],
        action: () => {
          handleNavigate("Live Traffic Mesh");
          setSearch("");
          setSearchOpen(false);
        },
      },
      {
        title: "Client Portal & Services",
        description: "Service onboarding wizard, DNS CNAME configuration, and active service credentials",
        category: "Navigation" as const,
        badge: "Client Area",
        keywords: ["client", "services", "portal", "onboarding", "dns", "cname", "customer", "my services"],
        action: () => {
          handleNavigate("My Services");
          setSearch("");
          setSearchOpen(false);
        },
      },
      {
        title: "SIEM & Detection Rules",
        description: "Configured perimeter detection triggers, anomaly heuristics, and automated block rules",
        category: "Security Module" as const,
        badge: "SIEM",
        keywords: ["siem", "rules", "detection", "anomaly", "heuristics", "block rules"],
        action: () => {
          handleNavigate("SIEM Rules");
          setSearch("");
          setSearchOpen(false);
        },
      },
      {
        title: "Activity & Operations History",
        description: "Immutable security audit log, operator access events, and incident resolution history",
        category: "Navigation" as const,
        badge: "Audit Log",
        keywords: ["audit", "logs", "activity", "history", "events", "compliance"],
        action: () => {
          handleNavigate("Activity History");
          setSearch("");
          setSearchOpen(false);
        },
      },
      {
        title: "Billing & Credits",
        description: "Manage subscription plans, top up usage credits, and inspect payment transactions",
        category: "Navigation" as const,
        badge: "Finance",
        keywords: ["billing", "credits", "payment", "invoice", "plan", "subscription", "pricing"],
        action: () => {
          handleNavigate("Billing & Credits");
          setSearch("");
          setSearchOpen(false);
        },
      },
    ];

    securityItems.forEach((item, idx) => {
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchKw = item.keywords.some((k) => k.includes(q) || q.includes(k));
      if (matchTitle || matchDesc || matchKw) {
        results.push({
          id: `sec-${idx}`,
          title: item.title,
          description: item.description,
          category: item.category,
          badge: item.badge,
          action: item.action,
        });
      }
    });

    // 2. Search Protected Services & Client Tenants
    clientTenants.forEach((tenant) => {
      if (
        tenant.name.toLowerCase().includes(q) ||
        (tenant.primaryDomain && tenant.primaryDomain.toLowerCase().includes(q)) ||
        tenant.enabledModules.some((m) => m.toLowerCase().includes(q))
      ) {
        results.push({
          id: `tenant-${tenant.id}`,
          title: tenant.name,
          description: `Domain: ${tenant.primaryDomain || "Internal"} · Plan: ${tenant.planTier} · Modules: ${tenant.enabledModules.join(", ")}`,
          category: "Service",
          badge: tenant.planTier,
          action: () => {
            setSelectedTenantId(tenant.id);
            handleNavigate("Client Overview");
            setSearch("");
            setSearchOpen(false);
          },
        });
      }
    });

    // 3. Search Incidents
    incidents.forEach((inc) => {
      if (
        inc.title.toLowerCase().includes(q) ||
        inc.id.toLowerCase().includes(q) ||
        inc.source.toLowerCase().includes(q) ||
        inc.summary.toLowerCase().includes(q)
      ) {
        results.push({
          id: `inc-${inc.id}`,
          title: `${inc.id}: ${inc.title}`,
          description: `Source: ${inc.source} · Severity: ${inc.severity} · Status: ${inc.status}`,
          category: "Incident",
          badge: inc.severity,
          action: () => {
            setSelectedIncidentId(inc.id);
            handleNavigate("Incidents");
            setSearch("");
            setSearchOpen(false);
          },
        });
      }
    });

    // 4. Search Vulnerabilities
    vulnerabilities.forEach((vuln) => {
      if (
        vuln.cve.toLowerCase().includes(q) ||
        vuln.package.toLowerCase().includes(q) ||
        vuln.title.toLowerCase().includes(q)
      ) {
        results.push({
          id: `vuln-${vuln.id}`,
          title: `${vuln.cve} in ${vuln.package}`,
          description: `${vuln.title} · CVSS ${vuln.cvss}`,
          category: "Security Module",
          badge: vuln.severity,
          action: () => {
            handleNavigate("CVEs & Patch Tracker");
            setSearch("");
            setSearchOpen(false);
          },
        });
      }
    });

    return results.slice(0, 10);
  }, [search, clientTenants, incidents, vulnerabilities, handleNavigate]);

  const userInitials = currentUser?.fullName
    ? currentUser.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "SX";

  return (
    <SidebarProvider className="bg-background" onOpenChange={setSidebarOpen} open={sidebarOpen}>
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
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 sm:gap-4 border-b border-white/10 bg-black/65 px-3 sm:px-7 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_8px_30px_rgba(0,0,0,0.65)] transform-gpu">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <SidebarTrigger
              aria-label="Toggle navigation"
              className="size-9 border border-border bg-card hover:bg-secondary lg:hidden"
            />
            <Button
              aria-label={sidebarOpen ? "Minimize sidebar" : "Expand sidebar"}
              className="hidden h-8 gap-1.5 border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-secondary lg:inline-flex"
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

            <div className="hidden sm:flex items-center gap-2 pr-1">
              <img src="/sparrowx-logo.png" alt="SparrowX" className="size-5 object-contain" />
            </div>
            <span className="hidden text-muted-foreground/60 sm:block">/</span>
            <span className="truncate text-xs sm:text-sm font-semibold text-foreground max-w-[100px] sm:max-w-[200px]">
              {activeNav}
            </span>

            {/* Operational Status Badge */}
            {criticalOpenCount > 0 ? (
              <span className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-[10px] font-semibold text-destructive animate-pulse">
                <AlertTriangle className="size-3" />
                <span>ALERT: {criticalOpenCount} CRITICAL</span>
              </span>
            ) : (
              <span className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-[10px] font-semibold text-success">
                <CheckCircle2 className="size-3" />
                <span>SYSTEMS NOMINAL</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Top Workspace Switcher (SOC Dashboard vs Client Area vs Admin) */}
            {authSession.role === "admin" ? (
              <div className="flex items-center gap-0.5 sm:gap-1 rounded-lg border border-border bg-card/90 p-0.5 text-xs shadow-sm shrink-0">
                <button
                  type="button"
                  onClick={() => handleNavigate("Overview")}
                  className={`flex items-center gap-1 sm:gap-1.5 rounded-md px-1.5 sm:px-2.5 py-1 text-xs font-semibold transition-all ${
                    portalMode === "soc"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                  title="Security Operations Center (Incidents, IOCs, CVEs, Assets)"
                >
                  <ShieldAlert className="size-3.5 shrink-0" />
                  <span className="hidden sm:inline">SOC Command</span>
                  <span className="sm:hidden text-[11px]">SOC</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate("My Services")}
                  className={`flex items-center gap-1 sm:gap-1.5 rounded-md px-1.5 sm:px-2.5 py-1 text-xs font-semibold transition-all ${
                    portalMode === "client"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                  title="Client Portal (Protected Services, Credits, SDKs)"
                >
                  <Boxes className="size-3.5 shrink-0" />
                  <span className="hidden sm:inline">Client Area</span>
                  <span className="sm:hidden text-[11px]">Client</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate("Client Subscriptions")}
                  className={`flex items-center gap-1 sm:gap-1.5 rounded-md px-1.5 sm:px-2.5 py-1 text-xs font-semibold transition-all ${
                    portalMode === "admin" && activeNav !== "Supabase Studio"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                  title="Multi-Tenant Subscription Master"
                >
                  <Users className="size-3.5 shrink-0" />
                  <span className="hidden sm:inline">Admin Master</span>
                  <span className="sm:hidden text-[11px]">Admin</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveNav("SparrowX DB")}
                  className={`flex items-center gap-1 sm:gap-1.5 rounded-md px-1.5 sm:px-2.5 py-1 text-xs font-semibold transition-all ${
                    activeNav === "SparrowX DB" || activeNav === "Supabase Studio"
                      ? "bg-[#3ECF8E] text-[#11181C] shadow-sm"
                      : "text-[#3ECF8E] hover:bg-[#3ECF8E]/15"
                  }`}
                  title="Open Sovereign SparrowX DB (DBaaS) Studio"
                >
                  <Database className="size-3.5 shrink-0" />
                  <span className="hidden sm:inline">SparrowX DB</span>
                  <span className="sm:hidden text-[11px]">DB</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-border bg-card/90 px-2 sm:px-3 py-1 text-xs shadow-sm shrink-0">
                <Boxes className="size-3.5 text-primary shrink-0" />
                <span className="font-semibold text-foreground truncate max-w-[85px] xs:max-w-[140px] sm:max-w-none">
                  {activeClientTenant?.name || "Client"} Dashboard
                </span>
                <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-mono text-primary font-bold shrink-0">
                  {activeClientTenant?.planTier || "Active"}
                </span>
              </div>
            )}

            {/* Global Search Bar & Command Palette */}
            <div
              ref={searchContainerRef}
              className="relative hidden h-8.5 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-muted-foreground lg:flex shadow-xs"
            >
              <Search className="size-3.5 shrink-0" />
              <input
                ref={searchInputRef}
                aria-label="Search operational assets, incidents, and threat feeds"
                className="w-44 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search telemetry, WAF, AI..."
                type="text"
                value={search}
              />
              {search ? (
                <button
                  aria-label="Clear search"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSearch("");
                    setSearchOpen(false);
                  }}
                  type="button"
                >
                  <X className="size-3" />
                </button>
              ) : (
                <kbd className="rounded border border-border px-1 py-0.2 font-mono text-[9px] text-muted-foreground">
                  <Command className="inline size-2.5" /> K
                </kbd>
              )}

              {/* FLOATING SEARCH PALETTE DROPDOWN */}
              {searchOpen && search.trim().length > 0 && (
                <div className="absolute top-10 right-0 z-50 w-[420px] rounded-xl border border-border bg-popover/95 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 max-h-[460px] overflow-y-auto">
                  <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-mono text-muted-foreground border-b border-border/60 pb-1.5 mb-1.5">
                    <span>SECURITY SEARCH RESULTS ({searchResults.length})</span>
                    <span>ESC to close</span>
                  </div>

                  {searchResults.length > 0 ? (
                    <div className="space-y-1">
                      {searchResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={item.action}
                          className="w-full text-left rounded-lg p-2 hover:bg-accent/80 transition-colors flex items-start gap-2.5 group cursor-pointer"
                        >
                          <div className="grid size-7 place-items-center rounded-md bg-secondary/80 border border-border/60 text-primary shrink-0 group-hover:border-primary/50 transition-colors">
                            {item.category === "Security Module" ? (
                              <ShieldCheck className="size-3.5 text-primary" />
                            ) : item.category === "Database" ? (
                              <Database className="size-3.5 text-[#3ECF8E]" />
                            ) : item.category === "Incident" ? (
                              <AlertTriangle className="size-3.5 text-destructive" />
                            ) : (
                              <Globe2 className="size-3.5 text-sky-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-semibold text-xs text-foreground truncate group-hover:text-primary transition-colors">
                                {item.title}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.2 text-[9px] font-mono font-bold shrink-0 ${
                                  item.badge === "WAF Active" || item.badge === "Critical"
                                    ? "bg-destructive/15 text-destructive border border-destructive/30"
                                    : item.badge === "DBaaS"
                                    ? "bg-[#3ECF8E]/15 text-[#3ECF8E] border border-[#3ECF8E]/30"
                                    : "bg-primary/10 text-primary border border-primary/20"
                                }`}
                              >
                                {item.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {item.description}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-muted-foreground space-y-1.5">
                      <p className="font-semibold text-foreground">No matches found for "{search}"</p>
                      <p className="text-[11px]">
                        Try searching for <span className="font-mono text-primary font-bold">waf</span>, <span className="font-mono text-primary font-bold">ai</span>, <span className="font-mono text-primary font-bold">sqli</span>, <span className="font-mono text-primary font-bold">ddos</span>, or <span className="font-mono text-primary font-bold">db</span>.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notification Center Bell */}
            <button
              type="button"
              onClick={() => setNotificationDrawerOpen(true)}
              className="relative flex size-8.5 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shadow-xs"
              title="Security Operations Alerts"
              aria-label="Open notifications drawer"
            >
              <Bell className="size-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground shadow-xs ring-2 ring-background">
                  {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                </span>
              )}
            </button>

            <button
              aria-label="Open account menu"
              className="flex size-8.5 items-center justify-center rounded-full border border-border bg-secondary text-xs font-bold text-secondary-foreground shadow-xs hover:border-primary/50 transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
              type="button"
            >
              {userInitials}
            </button>
          </div>
        </header>

        {/* Global Notification Center Drawer */}
        <NotificationCenterDrawer
          isOpen={notificationDrawerOpen}
          onClose={() => setNotificationDrawerOpen(false)}
          incidents={incidents}
          threats={threatIndicators}
          vulnerabilities={vulnerabilities}
          auditLogs={auditLogs}
          onNavigate={handleNavigate}
        />

        {menuOpen && (
          <div className="absolute right-5 top-14 z-30 w-64 border border-border bg-card p-3.5 shadow-xl">
            <p className="truncate text-sm font-semibold">{currentUser?.fullName || "Account"}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{currentUser?.email}</p>
            <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-2.5">
              {authSession.role === "admin" ? (
                <>
                  <Button
                    className="w-full justify-start text-xs font-medium"
                    onClick={() => {
                      handleNavigate("Overview");
                      setMenuOpen(false);
                    }}
                    size="sm"
                    variant={portalMode === "soc" ? "secondary" : "ghost"}
                  >
                    <ShieldAlert className="size-3.5 text-primary" /> SOC Operations Command
                  </Button>
                  <Button
                    className="w-full justify-start text-xs font-medium"
                    onClick={() => {
                      handleNavigate("Client Subscriptions");
                      setMenuOpen(false);
                    }}
                    size="sm"
                    variant={portalMode === "admin" ? "secondary" : "ghost"}
                  >
                    <Users className="size-3.5 text-primary" /> Tenant Subscriptions (Admin)
                  </Button>
                </>
              ) : (
                <>
                {authSession.role === "admin" && (
                  <Button
                    className="w-full justify-start text-xs font-medium"
                    onClick={() => {
                      handleNavigate("Overview");
                      setMenuOpen(false);
                    }}
                    size="sm"
                    variant={portalMode === "soc" ? "secondary" : "ghost"}
                  >
                    <ShieldAlert className="size-3.5 text-primary" /> SOC Dashboard & Incidents
                  </Button>
                )}
                  <Button
                    className="w-full justify-start text-xs font-medium"
                    onClick={() => {
                      handleNavigate("My Services");
                      setMenuOpen(false);
                    }}
                    size="sm"
                    variant={activeNav === "My Services" ? "secondary" : "ghost"}
                  >
                    <Boxes className="size-3.5 text-primary" /> My Services & Security
                  </Button>
                  <Button
                    className="w-full justify-start text-xs font-medium"
                    onClick={() => {
                      handleNavigate("Billing & Credits");
                      setMenuOpen(false);
                    }}
                    size="sm"
                    variant={activeNav === "Billing & Credits" ? "secondary" : "ghost"}
                  >
                    <Coins className="size-3.5 text-primary" /> Billing & Credits
                  </Button>
                  <Button
                    className="w-full justify-start text-xs font-medium"
                    onClick={() => {
                      handleNavigate("Profile Management");
                      setMenuOpen(false);
                    }}
                    size="sm"
                    variant={activeNav === "Profile Management" ? "secondary" : "ghost"}
                  >
                    <Users className="size-3.5" /> Profile & Credentials
                  </Button>
                </>
              )}
              <Button
                className="w-full justify-start text-xs text-destructive hover:text-destructive"
                onClick={handleSignOut}
                size="sm"
                variant="ghost"
              >
                <LockKeyhole className="size-3.5" /> Log Out
              </Button>
            </div>
          </div>
        )}

        <main className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-4 pt-7 pb-28 sm:px-7 sm:pb-36 lg:px-9">
          {search.trim().length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs text-foreground backdrop-blur shadow-sm animate-in fade-in">
              <div className="flex items-center gap-2">
                <Search className="size-4 text-primary shrink-0" />
                <span>
                  Filtering telemetry by: <strong className="font-mono text-primary font-bold">"{search}"</strong> · {searchResults.length} {searchResults.length === 1 ? "match" : "matches"} found
                </span>
              </div>
              <div className="flex items-center gap-2">
                {searchResults.length > 0 && (
                  <button
                    type="button"
                    onClick={searchResults[0].action}
                    className="rounded bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                  >
                    Jump to {searchResults[0].title} →
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSearchOpen(false);
                  }}
                  className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Clear Filter
                </button>
              </div>
            </div>
          )}
          {(activeNav === "AI Brain" ||
            activeNav === "SparrowX AI Brain" ||
            activeNav === "Defense Updates" ||
            activeNav === "Defense Updates & Threat Intel" ||
            activeNav === "Defense Updates & Intel") && (
            authSession.role === "admin" ? (
              <SparrowxAiBrainCenter
                activeNav={activeNav}
                portalMode={portalMode}
                incidents={incidents}
                threatIndicators={threatIndicators}
                assets={assets}
                vulnerabilities={vulnerabilities}
                protectedServices={protectedServices}
                clientTenants={clientTenants}
                auditLogs={auditLogs}
                onEnforceGlobalAutoBlock={handleEnforceGlobalAutoBlock}
                onNavigate={handleNavigate}
                showToast={showToast}
                initialTab={activeNav.toLowerCase().includes("defense") ? "intel_updates" : "copilot"}
              />
            ) : (
              <div className="rounded-2xl border border-destructive/30 bg-card p-8 text-center space-y-4">
                <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive/15 border border-destructive/30 text-destructive">
                  <LockKeyhole className="size-6" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Access Restricted — Administrator Only</h2>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  The SparrowX AI Brain console is restricted to Administrator accounts.
                  Please switch to an administrator session to access this module.
                </p>
                <Button onClick={() => handleNavigate("My Services")} size="sm">
                  Return to My Services
                </Button>
              </div>
            )
          )}

          {(activeNav === "Global Traffic Mesh" ||
            activeNav === "Global Traffic Mesh (Live 3D)" ||
            activeNav === "Global Network Mesh" ||
            activeNav === "Live Traffic Mesh") && (
            <GlobalTrafficMeshGlobe
              tenants={
                authSession.role === "admin"
                  ? clientTenants
                  : activeClientTenant
                  ? [activeClientTenant]
                  : []
              }
              protectedServices={
                authSession.role === "admin"
                  ? protectedServices
                  : visibleClientServices
              }
              currentUserRole={
                authSession.role === "admin"
                  ? "admin"
                  : authSession.role === "client"
                  ? "client"
                  : "unauthenticated"
              }
              portalMode={portalMode}
              activeTenantId={activeClientTenant?.id}
              onNavigate={handleNavigate}
              showToast={showToast}
            />
          )}

          {(activeNav === "Protection Status & Verification" ||
            activeNav === "Protection Verification" ||
            activeNav === "Protection Status") && (
            <ProtectionVerificationCenter
              tenants={
                authSession.role === "admin"
                  ? clientTenants
                  : activeClientTenant
                  ? [activeClientTenant]
                  : []
              }
              services={
                authSession.role === "admin"
                  ? protectedServices
                  : visibleClientServices
              }
              assets={assets}
              auditLogs={auditLogs}
              currentClientTenant={activeClientTenant}
              currentUserRole={
                portalMode === "client" || authSession.role === "client"
                  ? "client"
                  : portalMode === "soc"
                  ? "SOC Operator"
                  : authSession.role
              }
              onNavigate={handleNavigate}
              showToast={showToast}
            />
          )}

          {(activeNav === "Troubleshooting & Docs" ||
            activeNav === "Troubleshooting & Error Center" ||
            activeNav === "docs_errors" ||
            activeNav === "Installation & Integration Docs" ||
            activeNav === "How-To Install Docs") && (
            <ErrorDocumentationCenter
              initialCode={activeDocCode}
              initialReferenceId={activeDocRef}
              initialSection={activeDocSection}
              onNavigateBack={() => handleNavigate(portalMode === "soc" ? "Overview" : "My Services")}
              onNavigateToGlobe={() => handleNavigate("Global Traffic Mesh")}
              showToast={showToast}
            />
          )}

          {(activeNav === "System Status" ||
            activeNav === "System Status & Health" ||
            activeNav === "system_status") && (
            <SystemStatusSection
              onNavigateToDocs={(code) => {
                setActiveDocCode(code);
                handleNavigate("Troubleshooting & Docs");
              }}
              showToast={showToast}
            />
          )}

          {(activeNav === "Activity History" ||
            activeNav === "Activity & Operations History" ||
            activeNav === "activity_history") && (
            <UserActivityHistory
              onNavigateToDocs={(code, refId) => {
                setActiveDocCode(code);
                if (refId) setActiveDocRef(refId);
                handleNavigate("Troubleshooting & Docs");
              }}
              showToast={showToast}
            />
          )}

          {(activeNav === "Error Monitoring" ||
            activeNav === "SOC Error Monitoring" ||
            activeNav === "error_monitoring") && (
            <AdminErrorMonitoring
              onNavigateToDoc={(code, refId) => {
                setActiveDocCode(code);
                if (refId) setActiveDocRef(refId);
                handleNavigate("Troubleshooting & Docs");
              }}
              showToast={showToast}
            />
          )}

          {((portalMode === "client" &&
            activeNav !== "Help center" &&
            activeNav !== "Settings" &&
            activeNav !== "AI Brain" &&
            activeNav !== "SparrowX AI Brain" &&
            activeNav !== "Global Traffic Mesh" &&
            activeNav !== "Global Traffic Mesh (Live 3D)" &&
            activeNav !== "Protection Status & Verification" &&
            activeNav !== "Protection Verification" &&
            activeNav !== "Protection Status" &&
            activeNav !== "Global Traffic Mesh" &&
            activeNav !== "Global Traffic Mesh (Live 3D)" &&
            activeNav !== "Troubleshooting & Docs" &&
            activeNav !== "Troubleshooting & Error Center" &&
            activeNav !== "docs_errors" &&
            activeNav !== "System Status" &&
            activeNav !== "System Status & Health" &&
            activeNav !== "system_status" &&
            activeNav !== "Activity History" &&
            activeNav !== "Activity & Operations History" &&
            activeNav !== "activity_history" &&
            activeNav !== "Error Monitoring" &&
            activeNav !== "SOC Error Monitoring" &&
            activeNav !== "error_monitoring") ||
            (portalMode === "soc" &&
              (activeNav === "My Services" ||
                activeNav === "Subscriptions & Due Dates" ||
                activeNav === "Billing & Credits" ||
                activeNav === "Profile Management"))) && (
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
              protectedServices={visibleClientServices}
              reports={reports}
              selectedTenantId={selectedTenantId}
              showToast={showToast}
              tenants={visibleClientTenants}
              vulnerabilities={vulnerabilities}
            />
          )}

          {authSession.role === "admin" &&
            ((portalMode === "admin" &&
              activeNav !== "Help center" &&
              activeNav !== "Settings" &&
              activeNav !== "AI Brain" &&
              activeNav !== "SparrowX AI Brain" &&
              activeNav !== "Global Traffic Mesh" &&
              activeNav !== "Global Traffic Mesh (Live 3D)" &&
              activeNav !== "Troubleshooting & Docs" &&
              activeNav !== "Troubleshooting & Error Center" &&
              activeNav !== "docs_errors" &&
              activeNav !== "System Status" &&
              activeNav !== "System Status & Health" &&
              activeNav !== "system_status" &&
              activeNav !== "Activity History" &&
              activeNav !== "Activity & Operations History" &&
              activeNav !== "activity_history" &&
              activeNav !== "Error Monitoring" &&
              activeNav !== "SOC Error Monitoring" &&
              activeNav !== "error_monitoring") ||
              (portalMode === "soc" && activeNav === "Access Control & Audit")) && (
            <AdminPortalView
              activeNav={activeNav}
              assets={assets}
              auditLogs={auditLogs}
              incidents={incidents}
              ipAllowlistStrict={ipAllowlistStrict}
              jitTenantApproval={jitTenantApproval}
              onCreateTenant={handleCreateTenant}
              onDeleteTenant={handleDeleteTenant}
              onEnforceGlobalAutoBlock={handleEnforceGlobalAutoBlock}
              onPreviewClientPortal={(tenantId) => {
                setSelectedTenantId(tenantId);
                setPortalMode("client");
                setActiveNav("Client Overview");
              }}
              onRecordAudit={recordAudit}
              onRotateTenantKey={handleRotateTenantKey}
              onToggleTenantLockdown={handleToggleTenantLockdown}
              onToggleTenantModule={handleToggleTenantModule}
              protectedServices={protectedServices}
              reports={reports}
              setIpAllowlistStrict={setIpAllowlistStrict}
              setJitTenantApproval={setJitTenantApproval}
              setStaffMfaEnforced={setStaffMfaEnforced}
              staffMfaEnforced={staffMfaEnforced}
              tenants={clientTenants}
              threatIndicators={threatIndicators}
              vulnerabilities={vulnerabilities}
            />
          )}

          {portalMode === "soc" &&
            (activeNav === "Overview" ||
              activeNav === "Dashboard" ||
              activeNav === "Security Overview") && (
              <>
                {/* Enterprise Operations Top Bar */}
                <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                  <div>
                    <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                      <Radio className="size-3.5 text-primary animate-pulse" />
                      Operational Security Command Center
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
                      Welcome, {currentUser?.fullName || "Security Commander"}
                    </h1>
                    <p className="mt-1 text-xs text-muted-foreground max-w-2xl leading-relaxed">
                      Live operational telemetry, incident command, and autonomous edge guardrails
                      computed from your SparrowX Sovereign Cloud Vault.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                    <label className="sr-only" htmlFor="range-select">
                      Time range
                    </label>
                    <select
                      className="h-8.5 rounded-md border border-border bg-card px-3 text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring shadow-xs"
                      id="range-select"
                      onChange={(event) => setRange(event.target.value as RangeOption)}
                      value={range}
                    >
                      <option value="24 hours">Last 24 Hours</option>
                      <option value="7 days">Last 7 Days</option>
                      <option value="30 days">Last 30 Days</option>
                    </select>
                    <Button
                      aria-label="Sync backend"
                      className="size-8.5 shadow-xs"
                      disabled={isSyncing}
                      onClick={syncWithBackend}
                      size="icon"
                      variant="outline"
                    >
                      <RefreshCw className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                    </Button>
                    <Button
                      onClick={() => setShowCreateModal(true)}
                      size="sm"
                      className="h-8.5 gap-1.5 text-xs font-semibold shadow-xs"
                    >
                      <Plus className="size-3.5" />
                      <span>Report Incident</span>
                    </Button>
                  </div>
                </section>

                {/* Quick Actions Operations Toolbar */}
                <section className="flex flex-wrap items-center gap-2 border border-border bg-card p-2.5 rounded-md shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2">
                    Quick Actions:
                  </span>
                  {authSession.role === "admin" && (
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-[11px] gap-1.5 font-semibold"
                      onClick={() => handleNavigate("AI Brain")}
                    >
                      <Brain className="size-3.5" /> SparrowX AI Brain
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1.5 font-semibold border-primary/40 text-primary hover:bg-primary/15"
                    onClick={() => handleNavigate("Global Traffic Mesh")}
                  >
                    <Globe2 className="size-3.5" /> 3D Global Traffic Mesh
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1.5 font-medium"
                    onClick={() => setShowCreateModal(true)}
                  >
                    <Siren className="size-3 text-destructive" /> Create Incident
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1.5 font-medium"
                    onClick={() => handleNavigate("Threat Hunting")}
                  >
                    <Crosshair className="size-3 text-cyan-400" /> Hunt Telemetry
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1.5 font-medium"
                    onClick={() => handleNavigate("Threat intel")}
                  >
                    <Globe2 className="size-3 text-primary" /> Block Threat IOC
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1.5 font-medium"
                    onClick={() => handleNavigate("Assets")}
                  >
                    <Server className="size-3 text-primary" /> Endpoints & Hosts
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1.5 font-medium"
                    onClick={() => handleNavigate("SIEM & Detection Rules")}
                  >
                    <Terminal className="size-3 text-primary" /> SIEM Rules
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1.5 font-medium"
                    onClick={() => handleNavigate("Protection Status & Verification")}
                  >
                    <ShieldCheck className="size-3 text-emerald-400" /> Verify Protection
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1.5 font-medium"
                    onClick={() => handleNavigate("Checkpoints & Probes")}
                  >
                    <CheckCircle2 className="size-3 text-success" /> Run Probes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1.5 font-medium"
                    onClick={() => handleNavigate("Live Operations")}
                  >
                    <Radio className="size-3 text-cyan-400" /> Live Stream
                  </Button>
                </section>

                {/* 6 Enterprise Security Metric Cards */}
                <section
                  aria-label="Security metrics"
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
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
                    change={`${criticalOpenCount} critical · ${highOpenCount} high`}
                    footnote={openIncidentCount === 0 ? "Queue clear" : "Needs attention"}
                    icon={<Siren />}
                    label="Open incidents"
                    trend={openIncidentCount > 0 ? "alert" : "up"}
                    value={String(openIncidentCount).padStart(2, "0")}
                  />
                  <MetricCard
                    change={`${onDutyCount} on call`}
                    footnote={`${teamMembers.length} team total`}
                    icon={<Users />}
                    label="Personnel on duty"
                    trend="up"
                    value={`${onDutyCount} / ${teamMembers.length}`}
                  />
                  <MetricCard
                    change={currentSnapshot.assetsChange}
                    footnote="registered targets"
                    icon={<LockKeyhole />}
                    label="Protected targets"
                    trend="up"
                    value={String(protectedServices.length + assets.length)}
                  />
                  <MetricCard
                    change="Threat-feed IOCs"
                    footnote="IPs on blocklist (not attacks)"
                    icon={<Globe2 />}
                    label="Blocklist entries"
                    trend="up"
                    value={String(threatIndicators.filter((i) => i.blocked).length)}
                  />
                  <MetricCard
                    change={`${clientTenants.filter((t) => t.sdkVerified).length} verified`}
                    footnote="synthetic probes"
                    icon={<CheckCircle2 />}
                    label="Checkpoint health"
                    trend="up"
                    value={`${clientTenants.filter((t) => t.sdkVerified).length} / ${clientTenants.length || 1}`}
                  />
                </section>

                <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
                  <div className="min-w-0 border border-border bg-card p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold">Threat & telemetry activity</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Live telemetry events and blocked attacks ({range})
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
                      <span className="text-xs text-muted-foreground">
                        across onboarded targets
                      </span>
                    </div>
                    <div className="mt-3 w-full overflow-hidden">
                      {currentSnapshot.riskPoints.some((p) => p > 0) ||
                      (parseInt(currentSnapshot.totalEvents.replace(/,/g, "")) || 0) > 0 ? (
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
                          {(() => {
                            const pts = currentSnapshot.riskPoints;
                            const maxVal = Math.max(1, ...pts);
                            const lastVal = pts.at(-1) ?? 0;
                            const cy = 126 - (lastVal > 0 ? (lastVal / maxVal) * 95 : 0);
                            return <circle cx="720" cy={cy} fill="currentColor" r="4.5" />;
                          })()}
                        </svg>
                      ) : (
                        <div className="flex h-[170px] flex-col items-center justify-center rounded border border-dashed border-border/70 p-4 text-center">
                          <Activity className="mb-2 size-6 text-muted-foreground" />
                          <p className="text-xs font-medium text-foreground">
                            No security events recorded in this time range
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Telemetry ingestion active · Connect endpoints or trigger probes to
                            stream live telemetry.
                          </p>
                        </div>
                      )}
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
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          assets.length + protectedServices.length === 0
                            ? "text-zinc-500 font-mono"
                            : criticalOpenCount === 0
                              ? "text-success"
                              : "text-destructive"
                        }`}
                      >
                        <ArrowDownRight className="size-3.5" />{" "}
                        {assets.length + protectedServices.length === 0
                          ? "Not Configured (0 endpoints)"
                          : criticalOpenCount === 0
                            ? "Healthy"
                            : "Action required"}
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
                    detail={
                      threatIndicators.length > 0
                        ? `${threatIndicators.length} indicator(s) tracked`
                        : "No threat feed connected"
                    }
                    icon={<Globe2 />}
                    label="Threat intelligence"
                    onClick={() => setActiveNav("Threat intel")}
                    state={threatIndicators.length > 0 ? "Live" : "Not Configured"}
                  />
                  <SignalItem
                    detail={
                      assets.length > 0
                        ? `${assets.length} host(s) registered`
                        : "No host assets registered"
                    }
                    icon={<Layers3 />}
                    label="Infrastructure assets"
                    onClick={() => setActiveNav("Assets")}
                    state={assets.length > 0 ? "Monitored" : "Not Configured"}
                  />
                  <SignalItem
                    detail={
                      protectedServices.length > 0
                        ? `${protectedServices.length} Web / AI service(s)`
                        : "No services onboarded"
                    }
                    icon={<ShieldCheck />}
                    label="Web & AI Agent Shield"
                    onClick={() => setActiveNav("Web & AI Shield")}
                    state={protectedServices.length > 0 ? "Active" : "Not Configured"}
                  />
                </section>
              </>
            )}

          {portalMode === "soc" && activeNav === "Live Operations" && (
            <LiveOperationsView
              incidents={incidents}
              threats={threatIndicators}
              assets={assets}
              protectedServices={protectedServices}
              teamMembers={teamMembers}
              auditLogs={auditLogs}
              onResolveIncident={resolveIncident}
              onToggleAssetIsolation={toggleAssetIsolation}
              onNavigate={handleNavigate}
              showToast={showToast}
            />
          )}

          {authSession.role === "admin" && portalMode === "soc" && activeNav === "Checkpoints & Probes" && (
            <CheckpointsAndProbesView
              tenants={clientTenants}
              protectedServices={protectedServices}
              onVerifyTenant={handleVerifyTenantSdk}
              showToast={showToast}
            />
          )}

          {portalMode === "soc" &&
            (activeNav === "Incident Statistics" || activeNav === "Performance Analytics") && (
              <IncidentStatisticsView
                incidents={incidents}
                vulnerabilities={vulnerabilities}
                threats={threatIndicators}
                onNavigate={handleNavigate}
                showToast={showToast}
              />
            )}

          {portalMode === "soc" && activeNav === "Threat Hunting" && (
            <ThreatHuntingView
              assets={assets}
              auditLogs={auditLogs}
              incidents={incidents}
              onCreateIncidentFromHunt={(title, source, severity) => {
                const created: Incident = {
                  id: `INC-${Date.now().toString().slice(-4)}`,
                  title,
                  source,
                  time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  severity,
                  status: "Investigating",
                  assignee: teamMembers[0]?.name ?? "Unassigned",
                  summary:
                    "Forensic hunting ticket automatically escalated from threat hunting correlation engine.",
                  playbook: "Threat Hunt Investigation Playbook",
                  affectedAssets: 1,
                };
                setIncidents((current) => [created, ...current]);
                setSelectedIncidentId(created.id);
                void persistIncidentToBackend(created);
                showToast(`Created forensic case ${created.id}`);
                handleNavigate("Incidents");
              }}
              onNavigate={handleNavigate}
              protectedServices={protectedServices}
              showToast={showToast}
              threats={threatIndicators}
              vulnerabilities={vulnerabilities}
            />
          )}

          {portalMode === "soc" &&
            (activeNav === "SIEM & Detection Rules" ||
              activeNav === "SIEM" ||
              activeNav === "Detection Rules") && (
              <SiemAndDetectionRulesView
                incidents={incidents}
                auditLogs={auditLogs}
                integrations={integrations}
                protectedServices={protectedServices}
                onNavigate={handleNavigate}
                onRecordAudit={recordAudit}
                showToast={showToast}
              />
            )}

          {(activeNav === "Web & AI Shield" || activeNav === "Security Devices & Gateways") && (
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
                    Register production websites, web apps, and autonomous AI agents (LLM / MCP) to
                    issue ingestion keys and enforce guardrails.
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
                  onChange={(event) => setNewServiceCategory(event.target.value as ServiceCategory)}
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

              {/* Interactive AI Guardrail Sandbox */}
              <AiGuardrailSandbox
                onIncidentLogged={(newInc) => setIncidents((prev) => [newInc, ...prev])}
                showToast={showToast}
              />

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
                            <div className="mt-0.5 font-mono text-xs font-semibold">{srv.id}</div>
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
                  <h2 className="mt-3 text-sm font-semibold">
                    No production services onboarded yet
                  </h2>
                  <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                    Use the form above to register your first Web App, Cloud API, or AI Agent and
                    generate its live SparrowX Cloud ingestion SDK snippet.
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
                    Investigate live detections, assign responders, and execute containment
                    playbooks.
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

          {(activeNav === "Threat intel" || activeNav === "Alerts & Threats") && (
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
                    Correlate indicators of compromise and enforce perimeter firewall blocklists in
                    SparrowX Cloud.
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

              {/* Perimeter WAF & Firewall Exporter */}
              <FirewallRuleExporter indicators={threatIndicators} showToast={showToast} />

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
                        Add an IPv4, domain, SHA-256 hash, or ASN above to enforce perimeter
                        blocking.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {(activeNav === "Assets" || activeNav === "Sites & Locations") && (
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
                    Register production cloud nodes, API gateways, databases, and endpoints with
                    host isolation controls.
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
                  onChange={(event) => setNewAssetEnv(event.target.value as Asset["environment"])}
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
                    (asset) => assetEnvFilter === "All" || asset.environment === assetEnvFilter,
                  ).length > 0 ? (
                    assets
                      .filter(
                        (asset) => assetEnvFilter === "All" || asset.environment === assetEnvFilter,
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
                        Register your production hosts, Kubernetes nodes, and databases above to
                        track posture.
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
                    Track production CVEs by CVSS score and record package remediation rollouts in
                    SparrowX Cloud.
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
                  {vulnerabilities.filter((v) => vulnFilter === "All" || v.severity === vulnFilter)
                    .length > 0 ? (
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
                        Log CVEs discovered by your scanner above to track remediation across
                        production hosts.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {(activeNav === "Reports" || activeNav === "Reports & Compliance") && (
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
                    Generate audit-ready posture snapshots for SOC 2, ISO 27001, NIST CSF, and
                    executive briefings.
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
                  <Button onClick={() => generateNewReport("Executive Summary")} size="sm">
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
                              const fw = (
                                [
                                  "SOC 2 Type II",
                                  "ISO 27001",
                                  "NIST CSF",
                                  "Executive Summary",
                                ].includes(report.framework)
                                  ? report.framework
                                  : "SOC 2 Type II"
                              ) as "SOC 2 Type II" | "ISO 27001" | "NIST CSF" | "Executive Summary";
                              const doc = generateComplianceReportDocument(fw, {
                                tenantName: "SparrowX Sovereign Cloud",
                                domain: "app.sparrowx.internal",
                                activeIncidentsCount: incidents.length,
                                protectedAssetsCount: assets.length,
                                guardrailStatus: "Enforced & Active",
                                author: report.author,
                              });
                              const blob = new Blob([doc.content], { type: doc.mimeType });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = doc.filename;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                              showToast(`Downloaded verified ${doc.filename}`);
                            }}
                            size="sm"
                            variant="outline"
                          >
                            <Download className="size-3.5" /> Attestation (.md)
                          </Button>
                          <Button
                            className="h-8 px-3 text-xs"
                            onClick={() => {
                              exportIncidents();
                              showToast(`Exported CSV for ${report.title}`);
                            }}
                            size="sm"
                            variant="outline"
                          >
                            <Download className="size-3.5" /> Incidents (.csv)
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
                      <p className="mt-3 text-sm font-medium">
                        No compliance reports generated yet
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Click one of the report generators above to capture a live posture
                        attestation snapshot.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {(activeNav === "Team & access" || activeNav === "Security Personnel") && (
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
                  onChange={(event) => setNewMemberRole(event.target.value as TeamMember["role"])}
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
                        Add your security engineers and admins above to assign incidents and on-call
                        shifts.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {(activeNav === "Integrations" || activeNav === "Integrations & Webhooks") && (
            <>
              <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-primary">
                    <Database className="size-3.5" />
                    Backend & telemetry pipelines
                  </div>
                  <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">
                    Integrations & Cloud Backend
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Manage your live SparrowX Cloud database connection and external telemetry
                    pipelines.
                  </p>
                </div>
                <Button disabled={isSyncing} onClick={syncWithBackend}>
                  <RefreshCw className={`size-4 ${isSyncing ? "animate-spin" : ""}`} />
                  Sync Cloud now
                </Button>
              </section>

              <section className="border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold">
                        SparrowX Sovereign Cloud Vault &amp; Telemetry Mesh
                      </h2>
                      <span
                        className={`rounded-sm border px-2 py-0.5 text-[10px] font-semibold ${
                          backendSource === "supabase"
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-warning/30 bg-warning/10 text-warning"
                        }`}
                      >
                        {backendSource === "supabase"
                          ? "SparrowX Vault Connected & Encrypted"
                          : "SparrowX Local Vault Mode"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ingestion Endpoint:{" "}
                      <code className="text-foreground font-mono">
                        wss://vault.sparrowx.io/v2/telemetry
                      </code>{" "}
                      · Cipher:{" "}
                      <span className="font-mono text-emerald-400">
                        TLS 1.3 · AES-256-GCM · Zero-Knowledge Redaction Enforced
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Protected Telemetry Streams:{" "}
                      <span className="text-success font-mono font-medium">
                        SOC Incidents, Asset Registry, CVE Intelligence, Threat Feeds, AI Shield
                        Guardrails &amp; Immutable Audit Ledger
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() => {
                        void syncWithBackend();
                        showToast(
                          "SparrowX Vault integrity & zero-trust secret masking verified (100% compliant)",
                        );
                      }}
                      size="sm"
                      variant="outline"
                    >
                      <ShieldCheck className="size-3.5 text-emerald-400" /> Verify Vault Integrity
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
                    Add your SIEM, EDR, or cloud log connectors above to track external ingestion
                    pipelines alongside SparrowX Cloud.
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
                    Production operating procedures for onboarding services, cloud database schema
                    setup, and incident containment.
                  </p>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-3">
                <article className="border border-border bg-card p-5 rounded-xl">
                  <BookOpen className="size-5 text-primary" />
                  <h2 className="mt-3 text-base font-semibold">Troubleshooting & Error Center</h2>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Search all known application error codes, view evidence-based causes, copy
                    step-by-step repair guides, and submit safe diagnostic reports.
                  </p>
                  <Button
                    className="mt-4 h-8 px-3 text-xs"
                    onClick={() => handleNavigate("Troubleshooting & Docs")}
                    size="sm"
                  >
                    Open Error Center
                  </Button>
                </article>

                <article className="border border-border bg-card p-5 rounded-xl">
                  <Activity className="size-5 text-emerald-400" />
                  <h2 className="mt-3 text-base font-semibold">System Status & Health Probes</h2>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Verify real-time operational states across all 10 core subsystems: API, Auth,
                    Database, Scanner, Firewall, AI Guardrail, SDK, and Webhooks.
                  </p>
                  <Button
                    className="mt-4 h-8 px-3 text-xs"
                    onClick={() => handleNavigate("System Status")}
                    size="sm"
                    variant="outline"
                  >
                    View System Status
                  </Button>
                </article>

                <article className="border border-border bg-card p-5 rounded-xl">
                  <Clock3 className="size-5 text-amber-400" />
                  <h2 className="mt-3 text-base font-semibold">Activity & Operation History</h2>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Full transparency record of what SparrowX has actually done: successful,
                    pending, failed, and retried user operations with reference IDs.
                  </p>
                  <Button
                    className="mt-4 h-8 px-3 text-xs"
                    onClick={() => handleNavigate("Activity History")}
                    size="sm"
                    variant="outline"
                  >
                    View Activity Log
                  </Button>
                </article>

                <article className="border border-border bg-card p-5 rounded-xl">
                  <Globe2 className="size-5 text-emerald-400" />
                  <h2 className="mt-3 text-base font-semibold">Defense Updates & Threat Intel</h2>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Review live cyber threat feeds harvested from the internet (CISA KEV, AbuseIPDB,
                    OWASP GenAI) and inspect the exact block rules added to your defense system.
                  </p>
                  <Button
                    className="mt-4 h-8 px-3 text-xs"
                    onClick={() => handleNavigate("Defense Updates")}
                    size="sm"
                    variant="outline"
                  >
                    View Defense Updates
                  </Button>
                </article>

                <article className="border border-border bg-card p-5">
                  <Terminal className="size-5 text-primary" />
                  <h2 className="mt-3 text-base font-semibold">Web & AI Agent SDK Integration</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Onboard any web application or LLM/MCP agent to generate a live ingestion
                    snippet that streams incidents directly into SparrowX Cloud.
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
                  <h2 className="mt-3 text-base font-semibold">Database Schema Provisioning</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Provision all production security tables with Row-Level Security in your cloud
                    database engine.
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
                    Register your security responders in Team & Access to assign incidents and
                    manage on-call rotations.
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
            <DashboardSettingsAndConnector
              tenant={activeClientTenant}
              onVerifyTenantSdk={handleVerifyTenantSdk}
              showToast={showToast}
              autoContainCritical={autoContainCritical}
              setAutoContainCritical={setAutoContainCritical}
              realtimePagerDuty={realtimePagerDuty}
              setRealtimePagerDuty={setRealtimePagerDuty}
              enforceStrictMfa={enforceStrictMfa}
              setEnforceStrictMfa={setEnforceStrictMfa}
            />
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
                  <div className="mb-1 font-semibold text-muted-foreground">Telemetry summary</div>
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

              {/* Forensic Incident Timeline & Remediation Log */}
              <IncidentTimelineView
                incident={selectedIncident}
                currentOperator={primaryOperator?.name ?? "SecOps Responder"}
                showToast={showToast}
              />

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
                  <Button onClick={() => setSelectedIncidentId(null)} size="sm" variant="ghost">
                    Close
                  </Button>
                  {selectedIncident.status !== "Contained" ? (
                    <Button onClick={() => resolveIncident(selectedIncident.id)} size="sm">
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
              className="w-full max-w-md max-h-[92vh] overflow-y-auto border border-border bg-card p-4 sm:p-5 shadow-2xl"
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
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="inc-cat">
                      Category
                    </label>
                    <select
                      className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none"
                      id="inc-cat"
                      onChange={(e) => setNewCategory(e.target.value)}
                      value={newCategory}
                    >
                      <option value="Unauthorized Access">Unauthorized Access</option>
                      <option value="Perimeter & Injection Attack">Perimeter & Injection</option>
                      <option value="Rogue Tool / Shell Execution">Rogue Tool / Shell</option>
                      <option value="Data Exfiltration & Privacy">Data Exfiltration</option>
                      <option value="Infrastructure & Network">Infrastructure & Network</option>
                      <option value="Intrusion & Breach">Intrusion & Breach</option>
                      <option value="Prompt Injection">Prompt Injection</option>
                      <option value="Malware & C2 Activity">Malware & C2 Activity</option>
                    </select>
                  </div>
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

                <div>
                  <label
                    className="text-xs font-medium text-muted-foreground"
                    htmlFor="inc-playbook"
                  >
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
                  <label
                    className="text-xs font-medium text-muted-foreground"
                    htmlFor="inc-summary"
                  >
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
        {sdkServiceId &&
          (() => {
            const targetSrv = protectedServices.find((item) => item.id === sdkServiceId);
            if (!targetSrv) return null;
            return (
              <ClientIntegrationModal
                onClose={() => setSdkServiceId(null)}
                onVerificationComplete={async () => {
                  await sendVerificationEventForService(targetSrv);
                }}
                service={{
                  id: targetSrv.id,
                  name: targetSrv.name,
                  endpoint: targetSrv.endpoint,
                  apiKey: targetSrv.apiKey,
                  ...(targetSrv.category ? { category: targetSrv.category } : {}),
                }}
                showToast={showToast}
              />
            );
          })()}

        {authSession.role === "admin" && (
          <GlobalAiBrainFloatingDock
            activeNav={activeNav}
            portalMode={portalMode}
            incidents={incidents}
            threatIndicators={threatIndicators}
            assets={assets}
            vulnerabilities={vulnerabilities}
            protectedServices={protectedServices}
            clientTenants={clientTenants}
            auditLogs={auditLogs}
            onEnforceGlobalAutoBlock={handleEnforceGlobalAutoBlock}
            onOpenFullBrainView={() => handleNavigate("AI Brain")}
            showToast={showToast}
          />
        )}
        <BackgroundEngineToaster />
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
            Real-time security incidents persisted in SparrowX Cloud.
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
              <div className="flex flex-wrap items-center justify-between gap-2 pl-5 sm:justify-end sm:pl-0">
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {incident.time}
                </span>
                <StatusTag status={incident.status} />
                <div className="flex items-center gap-1.5">
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
              </div>
            </article>
          ))
        ) : (
          <div className="px-5 py-12 text-center">
            <ShieldCheck className="mx-auto size-6 text-success" />
            <p className="mt-3 text-sm font-medium">No active incidents in queue</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your production incident queue is clean. Connect a service SDK or report an incident
              manually.
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
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleNavClick = (navKey: string) => {
    onNavigate(navKey);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Enterprise Cybersecurity SOC Navigation Groups (Section 18 Architecture)
  const socOverviewItems: Array<{
    label: string;
    navKey: string;
    icon: typeof Activity;
    count?: string | undefined;
  }> = [
    { label: "SOC Dashboard", navKey: "Overview", icon: Activity },
    { label: "Global Traffic Mesh", navKey: "Global Traffic Mesh", icon: Globe2, count: "LIVE" },
    ...(isAdminSession
      ? [{ label: "SparrowX AI Brain", navKey: "AI Brain", icon: Brain, count: "AI" }]
      : []),
    { label: "Live Operations", navKey: "Live Operations", icon: Radio },
  ];

  const socOperationsItems: Array<{
    label: string;
    navKey: string;
    icon: typeof Activity;
    count?: string | undefined;
  }> = [
    {
      label: "Security Incidents",
      navKey: "Incidents",
      icon: Siren,
      count: incidentCount > 0 ? String(incidentCount) : undefined,
    },
    { label: "Threat Hunting", navKey: "Threat Hunting", icon: Crosshair },
    { label: "Incident Analytics & MTTD", navKey: "Incident Statistics", icon: BarChart3 },
  ];

  const socDetectionItems: Array<{
    label: string;
    navKey: string;
    icon: typeof Activity;
    count?: string | undefined;
  }> = [
    { label: "SIEM & Detection Rules", navKey: "SIEM & Detection Rules", icon: Terminal },
    { label: "Security Boundary Probes", navKey: "Checkpoints & Probes", icon: CheckCircle2 },
    {
      label: "Activity & Forensic Logs",
      navKey: "Access Control & Audit",
      icon: FileSearch,
      count: auditCount > 0 ? String(auditCount) : undefined,
    },
  ];

  const socThreatIntelItems: Array<{
    label: string;
    navKey: string;
    icon: typeof Activity;
    count?: string | undefined;
  }> = [{ label: "Threat Feeds & IOCs", navKey: "Threat intel", icon: Globe2 }];

  const socAssetSecurityItems: Array<{
    label: string;
    navKey: string;
    icon: typeof Activity;
    count?: string | undefined;
  }> = [
    {
      label: "Protection Verification",
      navKey: "Protection Status & Verification",
      icon: ShieldCheck,
    },
    { label: "Endpoints & Cloud Assets", navKey: "Assets", icon: Server },
    {
      label: "Web & AI Agent Shield",
      navKey: "Web & AI Shield",
      icon: ShieldCheck,
      count: serviceCount > 0 ? String(serviceCount) : undefined,
    },
    {
      label: "Vulnerability Management",
      navKey: "Vulnerabilities",
      icon: ShieldAlert,
      count: vulnCount > 0 ? String(vulnCount) : undefined,
    },
  ];

  const socAutomationItems: Array<{
    label: string;
    navKey: string;
    icon: typeof Activity;
    count?: string | undefined;
  }> = [{ label: "SOAR & Integrations", navKey: "Integrations", icon: Boxes }];

  const socManagementItems: Array<{
    label: string;
    navKey: string;
    icon: typeof Activity;
    count?: string | undefined;
  }> = [
    {
      label: "Clients & Services",
      navKey: "My Services",
      icon: Boxes,
      count: tenantCount > 0 ? String(tenantCount) : undefined,
    },
    { label: "Subscriptions & Due Dates", navKey: "Subscriptions & Due Dates", icon: CreditCard },
    { label: "Billing & Credits", navKey: "Billing & Credits", icon: Coins },
    { label: "Reports & Compliance", navKey: "Reports", icon: FileText },
    { label: "SOC Analysts & Access", navKey: "Team & access", icon: Users },
    { label: "Defense Updates & Threat Intel", navKey: "Defense Updates", icon: Globe2, count: "LIVE" },
    { label: "System Status & Health", navKey: "System Status", icon: Activity },
    { label: "Activity & Operations History", navKey: "Activity History", icon: Clock3 },
    { label: "SOC Error Monitoring", navKey: "Error Monitoring", icon: AlertTriangle },
    { label: "Troubleshooting & Docs", navKey: "Troubleshooting & Docs", icon: BookOpen },
    { label: "Platform Settings & MFA", navKey: "Settings", icon: Wrench },
  ];

  // Client Area Hub Navigation
  const clientAreaNavItems: Array<{
    label: string;
    icon: typeof Activity;
    count?: string | undefined;
  }> = [
    {
      label: "My Services",
      icon: Boxes,
      count: tenantCount > 0 ? String(tenantCount) : undefined,
    },
    {
      label: "Global Traffic Mesh",
      icon: Globe2,
      count: "LIVE",
    },
    ...(isAdminSession
      ? [
          {
            label: "SparrowX AI Brain",
            icon: Brain,
            count: "AI",
          },
        ]
      : []),
    {
      label: "Protection Status & Verification",
      icon: ShieldCheck,
    },
    { label: "Defense Updates & Intel", icon: Globe2 },
    { label: "Subscriptions & Due Dates", icon: Activity },
    { label: "Billing & Credits", icon: Coins },
    { label: "Profile Management", icon: Users },
    { label: "Activity History", icon: Clock3 },
    { label: "System Status", icon: Activity },
    { label: "Troubleshooting & Docs", icon: BookOpen },
  ];

  // Service-Specific Dynamic Dashboard Sidebar: Only renders modules enabled on the selected service!
  const clientEnabledModules = activeClientTenant?.enabledModules ?? [];
  const clientServiceDashboardItems: Array<{
    label: string;
    icon: typeof Activity;
    count?: string | undefined;
  }> = [
    { label: "Client Overview", icon: Sparkles },
    { label: "Global Traffic Mesh", icon: Globe2, count: "LIVE" },
    ...(isAdminSession ? [{ label: "SparrowX AI Brain", icon: Brain, count: "AI" }] : []),
    { label: "Protection Status & Verification", icon: ShieldCheck },
    { label: "Defense Updates & Intel", icon: Globe2 },
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
  const adminNavItems: Array<{ label: string; icon: typeof Activity; count?: string | undefined }> =
    [
      {
        label: "Client Subscriptions",
        icon: Users,
        count: tenantCount > 0 ? String(tenantCount) : undefined,
      },
      { label: "Global Traffic Mesh", icon: Globe2, count: "LIVE" },
      { label: "SparrowX AI Brain", icon: Brain, count: "AI" },
      { label: "Defense Updates & Intel", icon: Globe2 },
      { label: "Performance & Kill-Switch", icon: Activity },
      { label: "Error Monitoring", icon: AlertTriangle },
      { label: "System Status", icon: Activity },
      { label: "Activity History", icon: Clock3 },
      { label: "Troubleshooting & Docs", icon: BookOpen },
      {
        label: "Access Control & Audit",
        icon: LockKeyhole,
        count: auditCount > 0 ? String(auditCount) : undefined,
      },
    ];

  const isInClientArea =
    portalMode === "client" &&
    (activeNav === "My Services" ||
      activeNav === "Global Traffic Mesh" ||
      activeNav === "Global Traffic Mesh (Live 3D)" ||
      activeNav === "Protection Status & Verification" ||
      activeNav === "Protection Verification" ||
      activeNav === "Defense Updates" ||
      activeNav === "Defense Updates & Intel" ||
      activeNav === "Defense Updates & Threat Intel" ||
      activeNav === "Subscriptions & Due Dates" ||
      activeNav === "Billing & Credits" ||
      activeNav === "Profile Management" ||
      activeNav === "Troubleshooting & Docs" ||
      activeNav === "System Status" ||
      activeNav === "Activity History" ||
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
            className="relative grid size-9 shrink-0 place-items-center rounded-lg bg-black/60 border border-white/10 p-1 shadow-sm transition-transform hover:scale-105 overflow-hidden"
            onClick={() =>
              isCollapsed
                ? toggleSidebar()
                : handleNavClick(
                    portalMode === "soc"
                      ? "Overview"
                      : isAdminSession
                        ? "Client Subscriptions"
                        : "My Services",
                  )
            }
            title={isCollapsed ? "Expand sidebar (Ctrl+B)" : "SparrowX Home"}
            type="button"
          >
            <img
              src="/sparrowx-logo.png"
              alt="SparrowX Logo"
              className="size-full object-contain"
            />
          </button>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="font-display text-base font-semibold">
              sparrow<span className="text-primary">x</span>
            </div>
            <div className="text-[10px] uppercase text-muted-foreground font-semibold">
              {portalMode === "soc"
                ? "SOC Incident Command"
                : portalMode === "admin"
                  ? "Admin Control"
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
            {isCollapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 group-data-[collapsible=icon]:hidden">
          <span
            className={`size-2 rounded-full ${
              backendSource === "supabase" ? "bg-success" : "bg-warning"
            }`}
          />
          <span className="truncate text-xs font-medium">
            {portalMode === "soc"
              ? "Security Operations Center"
              : portalMode === "admin"
                ? "Admin Master"
                : isInClientArea
                  ? currentUser?.fullName || "Client Account"
                  : activeClientTenant?.name || "Service"}
          </span>
          <span className="ml-auto text-[10px] font-mono text-muted-foreground">
            {portalMode === "soc"
              ? "SOC LIVE"
              : portalMode === "admin"
                ? "ADMIN"
                : !isInClientArea && activeClientTenant
                  ? activeClientTenant.planTier.toUpperCase()
                  : "ACTIVE"}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {portalMode === "soc" ? (
          <>
            {/* 1. OVERVIEW */}
            <SidebarGroup className="group-data-[collapsible=icon]:items-center">
              <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 px-2">
                OVERVIEW
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                  {socOverviewItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNav === item.navKey || activeNav === item.label;
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => handleNavClick(item.navKey)}
                          tooltip={item.label}
                          className="font-medium"
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </SidebarMenuButton>
                        {item.count && <SidebarMenuBadge>{item.count}</SidebarMenuBadge>}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* 2. OPERATIONS */}
            <SidebarGroup className="mt-1 group-data-[collapsible=icon]:items-center">
              <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 px-2">
                OPERATIONS
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                  {socOperationsItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNav === item.navKey || activeNav === item.label;
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => handleNavClick(item.navKey)}
                          tooltip={item.label}
                          className="font-medium"
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </SidebarMenuButton>
                        {item.count && <SidebarMenuBadge>{item.count}</SidebarMenuBadge>}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* 3. DETECTION & SIEM */}
            <SidebarGroup className="mt-1 group-data-[collapsible=icon]:items-center">
              <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 px-2">
                DETECTION
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                  {socDetectionItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNav === item.navKey || activeNav === item.label;
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => handleNavClick(item.navKey)}
                          tooltip={item.label}
                          className="font-medium"
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </SidebarMenuButton>
                        {item.count && <SidebarMenuBadge>{item.count}</SidebarMenuBadge>}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* 4. THREAT INTELLIGENCE */}
            <SidebarGroup className="mt-1 group-data-[collapsible=icon]:items-center">
              <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 px-2">
                THREAT INTELLIGENCE
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                  {socThreatIntelItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNav === item.navKey || activeNav === item.label;
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => handleNavClick(item.navKey)}
                          tooltip={item.label}
                          className="font-medium"
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </SidebarMenuButton>
                        {item.count && <SidebarMenuBadge>{item.count}</SidebarMenuBadge>}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* 5. ASSET SECURITY */}
            <SidebarGroup className="mt-1 group-data-[collapsible=icon]:items-center">
              <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 px-2">
                ASSET SECURITY
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                  {socAssetSecurityItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNav === item.navKey || activeNav === item.label;
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => handleNavClick(item.navKey)}
                          tooltip={item.label}
                          className="font-medium"
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </SidebarMenuButton>
                        {item.count && <SidebarMenuBadge>{item.count}</SidebarMenuBadge>}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* 6. AUTOMATION */}
            <SidebarGroup className="mt-1 group-data-[collapsible=icon]:items-center">
              <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 px-2">
                AUTOMATION
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                  {socAutomationItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNav === item.navKey || activeNav === item.label;
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => handleNavClick(item.navKey)}
                          tooltip={item.label}
                          className="font-medium"
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </SidebarMenuButton>
                        {item.count && <SidebarMenuBadge>{item.count}</SidebarMenuBadge>}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* 7. MANAGEMENT */}
            <SidebarGroup className="mt-1 group-data-[collapsible=icon]:items-center">
              <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 px-2">
                MANAGEMENT
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                  {socManagementItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNav === item.navKey || activeNav === item.label;
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => handleNavClick(item.navKey)}
                          tooltip={item.label}
                          className="font-medium"
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </SidebarMenuButton>
                        {item.count && <SidebarMenuBadge>{item.count}</SidebarMenuBadge>}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : portalMode === "admin" ? (
          <>
            <SidebarGroup className="group-data-[collapsible=icon]:items-center">
              <SidebarGroupLabel>Admin & Subscriptions</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                  {adminNavItems.map(({ label, icon: Icon, count }) => (
                    <SidebarMenuItem key={label}>
                      <SidebarMenuButton
                        isActive={activeNav === label}
                        onClick={() => handleNavClick(label)}
                        tooltip={label}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate">{label}</span>
                      </SidebarMenuButton>
                      {count && <SidebarMenuBadge>{count}</SidebarMenuBadge>}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup className="mt-1 group-data-[collapsible=icon]:items-center">
              <SidebarGroupLabel>Operations</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={activeNav === "Overview"}
                      onClick={() => handleNavClick("Overview")}
                      tooltip="Switch to SOC Command"
                    >
                      <ShieldAlert className="size-4 text-primary shrink-0" />
                      <span className="truncate">Switch to SOC Command</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : isInClientArea ? (
          <>
            <SidebarGroup className="group-data-[collapsible=icon]:items-center">
              <SidebarGroupLabel>Client Area</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                  {clientAreaNavItems.map(({ label, icon: Icon, count }) => (
                    <SidebarMenuItem key={label}>
                      <SidebarMenuButton
                        isActive={activeNav === label}
                        onClick={() => handleNavClick(label)}
                        tooltip={label}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate">{label}</span>
                      </SidebarMenuButton>
                      {count && <SidebarMenuBadge>{count}</SidebarMenuBadge>}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {isAdminSession && (
              <SidebarGroup className="mt-2 border-t border-sidebar-border/50 pt-2 group-data-[collapsible=icon]:items-center">
                <SidebarGroupLabel>Security Operations</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className="font-medium text-primary hover:text-primary"
                        onClick={() => handleNavClick("Overview")}
                        tooltip="SOC Operations & Live Telemetry"
                      >
                        <ShieldAlert className="size-4 text-primary shrink-0" />
                        <span className="truncate">SOC Dashboard</span>
                      </SidebarMenuButton>
                      <SidebarMenuBadge className="border border-primary/30 bg-primary/15 text-primary">
                        Live
                      </SidebarMenuBadge>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </>
        ) : (
          <>
            <SidebarGroup className="group-data-[collapsible=icon]:items-center">
              <SidebarGroupLabel>Service Dashboard</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="border border-sidebar-border bg-sidebar-accent/40 font-medium text-primary"
                      onClick={() => handleNavClick("My Services")}
                      tooltip="Back to Client Area"
                    >
                      <Boxes className="size-4 shrink-0" />
                      <span className="truncate">← Back to Client Area</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {clientServiceDashboardItems.map(({ label, icon: Icon, count }) => (
                    <SidebarMenuItem key={label}>
                      <SidebarMenuButton
                        isActive={activeNav === label || (activeNav === "Overview" && label === "Client Overview")}
                        onClick={() => handleNavClick(label)}
                        tooltip={label}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate">{label}</span>
                      </SidebarMenuButton>
                      {count && <SidebarMenuBadge>{count}</SidebarMenuBadge>}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {isAdminSession && (
              <SidebarGroup className="mt-2 border-t border-sidebar-border/50 pt-2 group-data-[collapsible=icon]:items-center">
                <SidebarGroupLabel>Security Operations</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className="font-medium text-primary hover:text-primary"
                        onClick={() => handleNavClick("Overview")}
                        tooltip="SOC Operations & Live Telemetry"
                      >
                        <ShieldAlert className="size-4 text-primary shrink-0" />
                        <span className="truncate">SOC Dashboard</span>
                      </SidebarMenuButton>
                      <SidebarMenuBadge className="border border-primary/30 bg-primary/15 text-primary">
                        Live
                      </SidebarMenuBadge>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3 group-data-[collapsible=icon]:p-2 space-y-2">
        <SidebarMenu className="group-data-[collapsible=icon]:items-center">
          <SidebarMenuItem>
            <SidebarMenuButton
              className="border border-sidebar-border bg-sidebar-accent/30 font-medium text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={toggleSidebar}
              tooltip={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Minimize sidebar (Ctrl+B)"}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="text-primary" />
              ) : (
                <PanelLeftClose className="text-primary" />
              )}
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
              isActive={activeNav === "Troubleshooting & Docs" || activeNav === "Troubleshooting & Error Center"}
              onClick={() => handleNavClick("Troubleshooting & Docs")}
              tooltip="Troubleshooting & Error Docs"
            >
              <BookOpen />
              <span>Troubleshooting & Docs</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activeNav === "Help center"}
              onClick={() => handleNavClick("Help center")}
              tooltip="Help center"
            >
              <CircleHelp />
              <span>Help center</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activeNav === "Settings"}
              onClick={() => handleNavClick("Settings")}
              tooltip="Settings"
            >
              <Menu />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Operational Clock Timer placed in left navbar bottom */}
        <div className="pt-1">
          <OperationalClock />
        </div>

        {/* User Account & Prominent Log Out placed in left navbar bottom */}
        <div className="flex items-center gap-2 border-t border-sidebar-border pt-2.5 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1 group-data-[collapsible=icon]:justify-center">
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-semibold border border-sidebar-border">
              {initials}
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="truncate text-xs font-semibold">{currentUser?.fullName || "Account"}</div>
              <div className="truncate text-[10px] text-muted-foreground">
                {currentUser?.email || "Authenticated"}
              </div>
            </div>
          </div>
          
          <Button
            aria-label="Log Out to login page"
            className="h-8 px-2.5 text-xs font-medium border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors group-data-[collapsible=icon]:hidden"
            onClick={onSignOut}
            size="sm"
            title="Log Out of SparrowX"
            variant="outline"
          >
            <LockKeyhole className="size-3.5 mr-1" />
            <span>Log Out</span>
          </Button>

          {/* Icon-mode Log Out button when sidebar is collapsed */}
          <div className="hidden group-data-[collapsible=icon]:block">
            <Button
              aria-label="Log out"
              className="size-8 p-0 text-destructive hover:bg-destructive/15 hover:text-destructive"
              onClick={onSignOut}
              size="sm"
              title="Log Out"
              variant="ghost"
            >
              <LockKeyhole className="size-4" />
            </Button>
          </div>
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
        <span
          className={`font-semibold ${trend === "alert" ? "text-destructive" : "text-success"}`}
        >
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
  const isCrit = severity === "Critical";
  const isHigh = severity === "High";
  const style = isCrit
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : isHigh
      ? "border-warning/30 bg-warning/10 text-warning"
      : "border-primary/30 bg-primary/10 text-primary";
  const Icon = isCrit ? ShieldAlert : isHigh ? AlertTriangle : AlertCircle;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${style}`}
    >
      <Icon className="size-3 shrink-0" />
      <span>{severity}</span>
    </span>
  );
}

function StatusTag({ status }: { status: IncidentStatus }) {
  const isContained = status === "Contained";
  const isInvestigating = status === "Investigating";
  const style = isContained
    ? "border-success/30 bg-success/10 text-success"
    : isInvestigating
      ? "border-info/30 bg-info/10 text-info"
      : "border-border bg-secondary text-muted-foreground";
  const Icon = isContained ? CheckCircle2 : isInvestigating ? Activity : Clock3;
  return (
    <span
      className={`inline-flex min-w-[95px] items-center justify-center gap-1 rounded-sm border px-2 py-0.5 text-center text-[10px] font-medium ${style}`}
    >
      <Icon className="size-3 shrink-0" />
      <span>{status}</span>
    </span>
  );
}

function OperationalClock() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const utcStr = time.toUTCString().slice(17, 25) + " UTC";
  const localStr = time.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = time.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="w-full">
      {/* Expanded sidebar view: clean, high-contrast operational telemetry clock */}
      <div className="rounded-md border border-sidebar-border/70 bg-sidebar-accent/25 px-2.5 py-1.5 font-mono text-[11px] shadow-2xs select-none group-data-[collapsible=icon]:hidden">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-bold text-foreground">
            <span className="size-2 rounded-full bg-primary animate-pulse" />
            <span>{localStr}</span>
          </span>
          <span className="text-[10px] text-muted-foreground font-medium">{utcStr}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground/80 font-sans">
          <span>{dateStr}</span>
          <span className="rounded bg-primary/10 px-1 py-0.2 font-mono text-[9px] text-primary font-bold">
            LIVE OPS
          </span>
        </div>
      </div>

      {/* Collapsed sidebar view: compact pulse indicator */}
      <div
        className="hidden group-data-[collapsible=icon]:flex items-center justify-center py-1 cursor-default text-muted-foreground"
        title={`${localStr} · ${utcStr} · ${dateStr}`}
      >
        <span className="relative flex size-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full size-2.5 bg-primary" />
        </span>
      </div>
    </div>
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
  const isOff =
    state.toLowerCase().includes("not configured") ||
    state.toLowerCase().includes("inactive") ||
    state.toLowerCase().includes("off") ||
    state.toLowerCase().includes("paused");

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
      <span
        className={`hidden items-center gap-1 text-[10px] sm:flex ${
          isOff ? "text-zinc-500 font-mono" : "text-success"
        }`}
      >
        <span
          className={`size-1.5 rounded-full ${isOff ? "bg-zinc-600" : "bg-success"}`}
        />
        {state}
      </span>
    </button>
  );
}
