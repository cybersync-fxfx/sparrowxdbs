import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Box,
  Command,
  CreditCard,
  Database,
  FileText,
  Globe,
  KeyRound,
  LayoutGrid,
  Menu,
  Plus,
  Server,
  Shield,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { buildMasterHref, buildProductHref } from "@/lib/routing";
import { SubdomainAuthChip } from "@/components/SubdomainAuthChip";
import { SparrowxFooter } from "@/components/SparrowxFooter";
import { AiGuardrailSandbox } from "@/components/AiGuardrailSandbox";
import { UpiAutoPayModal } from "@/components/UpiAutoPayModal";
import { emitEngineToast } from "@/components/BackgroundEngineToaster";
import { verifySessionToken } from "@/lib/advanced-features";
import {
  AI_TEMPLATES,
  type AiAuditLogRecord,
  type AiComputePlan,
  type AiInstanceRecord,
  type AiInvoiceRecord,
} from "@/lib/ai/contracts";
import { AiLandingView } from "./ai/AiLandingView";
import { AiDeployWizard } from "./ai/AiDeployWizard";
import { AiInstanceCenter } from "./ai/AiInstanceCenter";
import { AiBillingCenter, AiFounderAdminView } from "./ai/AiBillingAndAdminViews";
import { AiCommandPalette } from "./ai/AiCommandPalette";
import { AiCopyButton } from "./ai/AiCopyButton";

type SurfaceMode = "landing" | "console";
type ConsoleSection =
  | "overview"
  | "deployments"
  | "new"
  | "instance"
  | "templates"
  | "vectordb"
  | "domains"
  | "security"
  | "billing"
  | "keys"
  | "audit"
  | "admin";

interface PlatformApiKey {
  id: string;
  label: string;
  token: string;
  scope: "deploy:write" | "instances:read" | "admin:metrics";
  createdAt: string;
}

const SIDEBAR_ITEMS: Array<{
  id: ConsoleSection;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}> = [
  { id: "overview", label: "Overview", icon: <LayoutGrid className="size-4" aria-hidden="true" /> },
  { id: "deployments", label: "Deployments", icon: <Terminal className="size-4" aria-hidden="true" /> },
  { id: "templates", label: "Templates", icon: <Box className="size-4" aria-hidden="true" /> },
  {
    id: "vectordb",
    label: "Vector DBs",
    icon: <Database className="size-4" aria-hidden="true" />,
    badge: "db.",
  },
  { id: "domains", label: "Domains & SSL", icon: <Globe className="size-4" aria-hidden="true" /> },
  {
    id: "security",
    label: "Security & WAF",
    icon: <Shield className="size-4" aria-hidden="true" />,
    badge: "sec.",
  },
  { id: "billing", label: "Billing & UPI", icon: <CreditCard className="size-4" aria-hidden="true" /> },
  { id: "keys", label: "API Keys", icon: <KeyRound className="size-4" aria-hidden="true" /> },
  { id: "audit", label: "Audit Logs", icon: <FileText className="size-4" aria-hidden="true" /> },
  {
    id: "admin",
    label: "Founder Admin",
    icon: <Server className="size-4" aria-hidden="true" />,
    badge: "PVE",
  },
];

export function SparrowxAiPlatform() {
  const [surface, setSurface] = useState<SurfaceMode>("landing");
  const [section, setSection] = useState<ConsoleSection>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Live workspace data from /api/ai/instances
  const [instances, setInstances] = useState<AiInstanceRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AiAuditLogRecord[]>([]);
  const [invoices, setInvoices] = useState<AiInvoiceRecord[]>([]);
  const [walletBalanceInr, setWalletBalanceInr] = useState(3450);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [wizardTemplateId, setWizardTemplateId] = useState<string | undefined>(undefined);
  const [wizardPlanId, setWizardPlanId] = useState<AiComputePlan["id"] | undefined>(undefined);

  // UPI Checkout Modal state
  const [upiModalPlan, setUpiModalPlan] = useState<AiComputePlan | null>(null);

  // Platform API Keys
  const [apiKeys, setApiKeys] = useState<PlatformApiKey[]>([
    {
      id: "k-bom1-prod",
      label: "CI/CD Deploy Token (GitHub Actions)",
      token: "spx_ai_deploy_8f2c91a4e0b77d31f92c11a8",
      scope: "deploy:write",
      createdAt: "2026-11-18",
    },
  ]);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [userEmail, setUserEmail] = useState("developer@sparrowx.net");

  const loadWorkspace = useCallback(async () => {
    setLoadingWorkspace(true);
    try {
      const res = await fetch("/api/ai/instances");
      const json = (await res.json()) as {
        ok?: boolean;
        instances?: AiInstanceRecord[];
        auditLogs?: AiAuditLogRecord[];
        invoices?: AiInvoiceRecord[];
        walletBalanceInr?: number;
      };
      if (json.ok && Array.isArray(json.instances)) {
        setInstances(json.instances);
        setAuditLogs(json.auditLogs || []);
        setInvoices(json.invoices || []);
        if (typeof json.walletBalanceInr === "number") {
          setWalletBalanceInr(json.walletBalanceInr);
        }
      }
    } catch {
      // Keep UI functional on transient fetch failure
    } finally {
      setLoadingWorkspace(false);
    }
  }, []);

  useEffect(() => {
    const sess = verifySessionToken();
    if (sess?.email) setUserEmail(sess.email);

    // Support deep links like ?view=console or ?view=admin or ?view=new
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    if (view === "console" || view === "overview") {
      setSurface("console");
      setSection("overview");
    } else if (view === "new") {
      setSurface("console");
      setSection("new");
    } else if (view === "billing") {
      setSurface("console");
      setSection("billing");
    } else if (view === "admin") {
      setSurface("console");
      setSection("admin");
    }

    void loadWorkspace();
  }, [loadWorkspace]);

  // Keyboard Cmd/Ctrl + K for Command Palette
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const openDeployWizard = (templateId?: string, planId?: AiComputePlan["id"]) => {
    setWizardTemplateId(templateId);
    setWizardPlanId(planId);
    setSurface("console");
    setSection("new");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openInstance = (instanceId: string) => {
    setSelectedInstanceId(instanceId);
    setSurface("console");
    setSection("instance");
  };

  const handlePaletteNavigate = (target: string, instanceId?: string) => {
    if (target === "instance" && instanceId) {
      openInstance(instanceId);
      return;
    }
    setSurface("console");
    setSection(target as ConsoleSection);
  };

  const selectedInstance =
    instances.find((i) => i.id === selectedInstanceId) ?? instances[0] ?? null;

  const totalVcpu = instances.reduce((s, i) => s + (i.status === "live" ? i.vcpu : 0), 0);
  const totalRamGb = instances.reduce((s, i) => s + (i.status === "live" ? i.ramGb : 0), 0);
  const totalTransferUsed = instances.reduce((s, i) => s + i.transferUsedGb, 0);
  const totalTransferQuota = Math.max(
    500,
    instances.reduce((s, i) => s + i.transferQuotaGb, 0),
  );
  const bwPct = Math.min(100, Math.round((totalTransferUsed / totalTransferQuota) * 100));

  return (
    <div className="min-h-screen bg-[#05060A] text-white font-sans antialiased flex flex-col">
      {/* Top Global Bar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#05060A]/90 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto h-14 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {surface === "console" ? (
              <button
                type="button"
                aria-label="Toggle console sidebar"
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="lg:hidden inline-flex size-8 items-center justify-center rounded-md border border-white/10 bg-[#090B11] text-zinc-300 cursor-pointer"
              >
                {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setSurface("landing")}
              className="flex items-center gap-2.5 shrink-0 cursor-pointer"
            >
              <img
                src="/logos/sparrowx-main.png"
                alt="SparrowX AI"
                width={26}
                height={26}
                className="size-6.5 object-contain"
              />
              <span className="font-semibold text-sm tracking-tight text-white">
                SparrowX <span className="spx-silver-text">AI</span>
              </span>
              <span className="hidden sm:inline rounded border border-white/[0.08] bg-[#090B11] px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                ai.sparrowx.net
              </span>
            </button>

            <nav aria-label="Primary AI platform views" className="hidden md:flex items-center gap-1 ml-3">
              <button
                type="button"
                onClick={() => setSurface("landing")}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  surface === "landing"
                    ? "bg-[#10131C] text-white border border-white/12"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => {
                  setSurface("console");
                  setSection("overview");
                }}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  surface === "console" && section !== "admin"
                    ? "bg-[#10131C] text-white border border-white/12"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Console
              </button>
              <button
                type="button"
                onClick={() => {
                  setSurface("console");
                  setSection("admin");
                }}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  surface === "console" && section === "admin"
                    ? "bg-[#10131C] text-white border border-white/12"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Host Admin
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
              className="hidden sm:inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-[#090B11] hover:border-white/[0.16] px-2.5 py-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <Command className="size-3" aria-hidden="true" />
              <span>Search...</span>
              <kbd className="rounded bg-[#10131C] px-1 text-[10px] text-zinc-500">⌘K</kbd>
            </button>

            <SubdomainAuthChip nextPath="/ai" />

            <button
              type="button"
              onClick={() => openDeployWizard()}
              className="spx-silver-btn inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-[#05060A] cursor-pointer"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span className="hidden xs:inline">Deploy</span>
            </button>

            <a
              href={buildMasterHref("/")}
              className="hidden xl:inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-[#090B11] hover:bg-[#10131C] px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white transition-colors"
            >
              <span>sparrowx.net</span>
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Surface */}
      {surface === "landing" ? (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6">
          <AiLandingView
            onDeployTemplate={openDeployWizard}
            onOpenConsole={() => {
              setSurface("console");
              setSection("overview");
            }}
            onSelectPlanBilling={(plan) => setUpiModalPlan(plan)}
          />
        </main>
      ) : (
        <div className="flex-1 max-w-[1440px] w-full mx-auto flex relative">
          {/* Persistent Developer Console Sidebar */}
          <aside
            aria-label="Developer Console Navigation"
            className={`${
              mobileMenuOpen
                ? "fixed inset-y-14 left-0 z-30 block w-64 shadow-2xl"
                : "hidden"
            } lg:block lg:static lg:w-60 shrink-0 border-r border-white/[0.08] bg-[#05060A] p-3 space-y-1`}
          >
            <div className="px-2.5 py-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              Developer Console
            </div>
            {SIDEBAR_ITEMS.map((item) => {
              const active =
                section === item.id || (section === "instance" && item.id === "deployments");
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSection(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? "bg-[#10131C] text-white border border-white/12"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-[#090B11] border border-transparent"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                  {item.badge ? (
                    <span className="rounded border border-white/[0.08] bg-[#05060A] px-1.5 py-0.5 text-[9px] font-mono text-zinc-400">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}

            <div className="pt-4 mt-4 border-t border-white/[0.08] px-2 space-y-2">
              <div className="rounded-lg border border-white/[0.08] bg-[#090B11] p-3 space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>BOM1 Transfer</span>
                  <span className="text-zinc-200">{bwPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full bg-[#38BDF8]"
                    style={{ width: `${Math.max(4, bwPct)}%` }}
                  />
                </div>
                <div className="text-[10px] text-zinc-500">
                  {totalTransferUsed.toFixed(1)} / {totalTransferQuota} GB
                </div>
              </div>
            </div>
          </aside>

          {/* Console Viewport */}
          <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Live Incident / Status Banner */}
            <div className="rounded-lg border border-[#10B981]/20 bg-[#090B11] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <span className="inline-flex items-center gap-2 text-zinc-200">
                <span className="size-2 rounded-full bg-[#10B981]" aria-hidden="true" />
                <span>OVH Mumbai Gateway (103.174.10.24) &amp; Proxmox pve-in-01 Operational — 0 active incidents</span>
              </span>
              <span className="text-zinc-500">99.5% Uptime SLA • Outbound TCP/25 Blocked</span>
            </div>

            {section === "new" ? (
              <AiDeployWizard
                initialTemplateId={wizardTemplateId}
                initialPlanId={wizardPlanId}
                userEmail={userEmail}
                onCancel={() => setSection("overview")}
                onDeployed={(created) => {
                  setInstances((prev) => [created, ...prev]);
                  setSelectedInstanceId(created.id);
                  setSection("instance");
                  emitEngineToast(`Deployed ${created.publicUrl} on Mumbai BOM1`, "success");
                  void loadWorkspace();
                }}
              />
            ) : null}

            {section === "instance" && selectedInstance ? (
              <AiInstanceCenter
                instance={selectedInstance}
                userEmail={userEmail}
                onBack={() => setSection("deployments")}
                onUpdated={(updated) => {
                  setInstances((prev) =>
                    prev.map((i) => (i.id === updated.id ? updated : i)),
                  );
                }}
              />
            ) : null}

            {(section === "overview" || section === "deployments") ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-white">
                      {section === "overview" ? "Workspace Overview" : "AI Agent Deployments"}
                    </h1>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Dedicated Indian bare-metal containers with AES-256-GCM env vaults and Mumbai SSL.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openDeployWizard()}
                    className="spx-silver-btn inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-[#05060A] cursor-pointer"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    <span>New Deployment</span>
                  </button>
                </div>

                {/* Aggregate Metrics Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Active Instances", value: `${instances.filter((i) => i.status === "live").length} / ${instances.length}` },
                    { label: "Allocated vCPU", value: `${totalVcpu} vCPU` },
                    { label: "ECC RAM Pool", value: `${totalRamGb} GB` },
                    { label: "INR Wallet", value: `₹${walletBalanceInr.toLocaleString("en-IN")}` },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-xl border border-white/[0.08] bg-[#090B11] p-4"
                    >
                      <div className="text-[11px] font-mono uppercase text-zinc-500">{s.label}</div>
                      <div className="mt-1 text-2xl font-mono font-semibold text-white">{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Instances List */}
                <div className="rounded-xl border border-white/[0.08] bg-[#090B11] overflow-hidden">
                  <div className="border-b border-white/[0.08] px-5 py-3 flex items-center justify-between text-xs font-mono text-zinc-300">
                    <span>Running &amp; Provisioned Workloads</span>
                    <span className="text-zinc-500">Click any instance for Metrics, Logs &amp; Web Terminal</span>
                  </div>
                  {loadingWorkspace ? (
                    <div className="p-5 space-y-3">
                      <div className="h-16 rounded-lg bg-white/[0.04] animate-pulse" />
                      <div className="h-16 rounded-lg bg-white/[0.04] animate-pulse" />
                    </div>
                  ) : instances.length === 0 ? (
                    <div className="p-10 text-center space-y-3">
                      <p className="text-sm text-zinc-400">No AI workloads deployed yet.</p>
                      <button
                        type="button"
                        onClick={() => openDeployWizard()}
                        className="spx-silver-btn rounded-lg px-4 py-2 text-xs font-semibold text-[#05060A] cursor-pointer"
                      >
                        Launch First Agent in 60s
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/[0.06]">
                      {instances.map((inst) => (
                        <div
                          key={inst.id}
                          className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#10131C]/60 transition-colors"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openInstance(inst.id)}
                                className="text-sm font-semibold text-white hover:underline cursor-pointer"
                              >
                                {inst.name}
                              </button>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase border ${
                                  inst.status === "live"
                                    ? "border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981]"
                                    : "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#F59E0B]"
                                }`}
                              >
                                {inst.status}
                              </span>
                              <span className="text-[11px] font-mono text-zinc-500">
                                {inst.templateName}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-400">
                              <span className="text-[#38BDF8]">{inst.publicUrl}</span>
                              <span>•</span>
                              <span>
                                {inst.vcpu} vCPU / {inst.ramGb} GB / {inst.portMbps} Mbps
                              </span>
                              {inst.pgVectorProvisioned ? (
                                <span className="rounded bg-[#F59E0B]/10 border border-[#F59E0B]/25 px-1.5 py-0.5 text-[10px] text-[#F59E0B]">
                                  pgvector
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <AiCopyButton value={inst.publicUrl} ariaLabel={`Copy ${inst.publicUrl}`} />
                            <button
                              type="button"
                              onClick={() => openInstance(inst.id)}
                              className="rounded-lg border border-white/12 bg-[#05060A] hover:bg-white hover:text-[#05060A] px-3 py-1.5 text-xs font-medium text-zinc-100 transition-colors cursor-pointer"
                            >
                              Control Center
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick-Deploy Cards on Overview */}
                {section === "overview" ? (
                  <div className="space-y-3">
                    <div className="text-xs font-mono uppercase tracking-wider text-zinc-500">
                      Quick-Deploy Templates
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {AI_TEMPLATES.slice(0, 3).map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => openDeployWizard(tpl.id)}
                          className="rounded-xl border border-white/[0.08] bg-[#090B11] hover:bg-[#10131C] hover:border-white/[0.14] p-4 text-left transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-white">{tpl.name}</span>
                            <span className="text-[11px] font-mono text-zinc-400">
                              ₹{tpl.startingInr}/mo
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-400">{tpl.tagline}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {section === "templates" ? (
              <div className="space-y-5">
                <h1 className="text-2xl font-semibold text-white">1-Click AI &amp; MCP Templates</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {AI_TEMPLATES.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="rounded-xl border border-white/[0.08] bg-[#090B11] p-5 flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <h2 className="text-base font-semibold text-white">{tpl.name}</h2>
                          <span className="text-xs font-mono text-zinc-400">{tpl.badge}</span>
                        </div>
                        <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">{tpl.description}</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/[0.08] pt-3">
                        <span className="text-xs font-mono text-zinc-300">
                          {tpl.minVcpu} vCPU • {tpl.minRamGb} GB RAM • from ₹{tpl.startingInr}/mo
                        </span>
                        <button
                          type="button"
                          onClick={() => openDeployWizard(tpl.id)}
                          className="spx-silver-btn rounded-lg px-3.5 py-1.5 text-xs font-semibold text-[#05060A] cursor-pointer"
                        >
                          Deploy
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {section === "vectordb" ? (
              <div className="rounded-xl border border-white/[0.08] bg-[#090B11] p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="text-xl font-semibold text-white">
                      Managed Vector DBs (db.sparrowx.net)
                    </h1>
                    <p className="text-xs text-zinc-400 mt-1">
                      Isolated PostgreSQL 16 + pgvector clusters over private Mumbai subnet (&lt;2 ms RTT).
                    </p>
                  </div>
                  <a
                    href={buildProductHref("db")}
                    className="spx-silver-btn inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-[#05060A]"
                  >
                    <span>Open db.sparrowx.net Studio</span>
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </a>
                </div>
                <div className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-[#05060A]">
                  {instances
                    .filter((i) => i.pgVectorProvisioned)
                    .map((inst) => (
                      <div
                        key={inst.id}
                        className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
                      >
                        <div>
                          <div className="text-white font-semibold">
                            vec_{inst.subdomain.replace(/-/g, "_")}
                          </div>
                          <div className="text-zinc-500 mt-0.5">
                            Linked to {inst.name} • Host: {inst.pgVectorHost} • Extension: pgvector 0.8
                          </div>
                        </div>
                        <span className="rounded bg-[#10B981]/10 border border-[#10B981]/25 px-2.5 py-0.5 text-[10px] text-[#10B981]">
                          DATABASE_URL INJECTED
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}

            {section === "domains" ? (
              <div className="rounded-xl border border-white/[0.08] bg-[#090B11] p-6 space-y-4">
                <h1 className="text-xl font-semibold text-white">Domains &amp; Automated SSL</h1>
                <p className="text-xs text-zinc-400">
                  Wildcard <code className="font-mono text-zinc-200">*.ai.sparrowx.net</code> TLS 1.3 + custom CNAME Let&apos;s Encrypt provisioning with HTTP/2 and WebSocket Upgrade.
                </p>
                <div className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-[#05060A]">
                  {instances.flatMap((inst) =>
                    inst.domains.map((dom) => (
                      <div
                        key={dom.id}
                        className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
                      >
                        <div>
                          <div className="text-white font-semibold">{dom.hostname}</div>
                          <div className="text-zinc-500 mt-0.5">
                            Instance: {inst.name} • CNAME → {dom.cnameTarget}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openInstance(inst.id)}
                          className="rounded border border-white/12 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-[#10131C] cursor-pointer"
                        >
                          Manage Route
                        </button>
                      </div>
                    )),
                  )}
                </div>
              </div>
            ) : null}

            {section === "security" ? (
              <div className="space-y-6">
                <div className="rounded-xl border border-white/[0.08] bg-[#090B11] p-6 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-semibold text-white">
                      Security, Webhook WAF &amp; Prompt Guardrails (sec.sparrowx.net)
                    </h1>
                    <p className="text-xs text-zinc-400 mt-1">
                      Mumbai L4/L7 DDoS scrubbing, outbound TCP/25 SMTP blocking, and inline LLM prompt-injection &amp; PII firewall.
                    </p>
                  </div>
                  <a
                    href={buildProductHref("shield")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#05060A] hover:bg-[#10131C] px-3.5 py-2 text-xs font-medium text-zinc-100"
                  >
                    <span>Open sec.sparrowx.net SOC</span>
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </a>
                </div>
                <AiGuardrailSandbox />
              </div>
            ) : null}

            {section === "billing" ? (
              <AiBillingCenter
                walletBalanceInr={walletBalanceInr}
                instances={instances}
                invoices={invoices}
                onTriggerUpiCheckout={(plan) => setUpiModalPlan(plan)}
              />
            ) : null}

            {section === "keys" ? (
              <div className="rounded-xl border border-white/[0.08] bg-[#090B11] p-6 space-y-5">
                <div>
                  <h1 className="text-xl font-semibold text-white">Platform API Keys</h1>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Scoped bearer tokens for CI/CD deployments, MCP inspection, and automated snapshot triggers.
                  </p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newKeyLabel.trim()) return;
                    const rand = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) =>
                      b.toString(16).padStart(2, "0"),
                    ).join("");
                    setApiKeys((prev) => [
                      {
                        id: `k-${Date.now().toString(36)}`,
                        label: newKeyLabel.trim(),
                        token: `spx_ai_deploy_${rand}`,
                        scope: "deploy:write",
                        createdAt: new Date().toISOString().slice(0, 10),
                      },
                      ...prev,
                    ]);
                    setNewKeyLabel("");
                    emitEngineToast("Issued scoped SparrowX AI API key", "success");
                  }}
                  className="flex flex-col sm:flex-row gap-2"
                >
                  <input
                    type="text"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    placeholder="Token label (e.g. GitHub Actions Prod)"
                    aria-label="New API key label"
                    className="flex-1 rounded-lg border border-white/12 bg-[#05060A] px-3 py-2 text-xs font-mono text-white"
                  />
                  <button
                    type="submit"
                    className="spx-silver-btn rounded-lg px-4 py-2 text-xs font-semibold text-[#05060A] cursor-pointer"
                  >
                    Create API Key
                  </button>
                </form>

                <div className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-[#05060A]">
                  {apiKeys.map((k) => (
                    <div
                      key={k.id}
                      className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
                    >
                      <div>
                        <div className="text-white font-semibold">{k.label}</div>
                        <div className="text-zinc-400 mt-0.5">{k.token}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded border border-white/10 bg-[#090B11] px-2 py-0.5 text-[10px] text-zinc-400">
                          {k.scope}
                        </span>
                        <AiCopyButton value={k.token} ariaLabel={`Copy API key ${k.label}`} />
                        <button
                          type="button"
                          aria-label={`Revoke ${k.label}`}
                          onClick={() => setApiKeys((prev) => prev.filter((x) => x.id !== k.id))}
                          className="rounded border border-white/10 p-1.5 text-zinc-500 hover:text-[#EF4444] cursor-pointer"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {section === "audit" ? (
              <div className="rounded-xl border border-white/[0.08] bg-[#090B11] overflow-hidden">
                <div className="border-b border-white/[0.08] px-5 py-3 flex items-center gap-2 text-xs font-mono text-zinc-300">
                  <Activity className="size-3.5 text-[#38BDF8]" aria-hidden="true" />
                  <span>Immutable Workspace Audit Trail</span>
                </div>
                <div className="divide-y divide-white/[0.06] text-xs font-mono">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="px-5 py-3 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <span className="text-white font-semibold">{log.action}</span>
                        <span className="text-zinc-500"> → {log.target}</span>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          Actor: {log.actor} • IP: {log.ip}
                        </div>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] uppercase ${
                          log.status === "blocked"
                            ? "bg-[#EF4444]/10 text-[#EF4444]"
                            : log.status === "warning"
                              ? "bg-[#F59E0B]/10 text-[#F59E0B]"
                              : "bg-[#10B981]/10 text-[#10B981]"
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {section === "admin" ? (
              <AiFounderAdminView onInstancesMutated={() => void loadWorkspace()} />
            ) : null}
          </main>
        </div>
      )}

      <SparrowxFooter />

      {/* Cmd/Ctrl + K Native Dialog Command Palette */}
      <AiCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        instances={instances}
        onNavigate={handlePaletteNavigate}
      />

      {/* Live UPI QR / AutoPay Modal */}
      {upiModalPlan ? (
        <UpiAutoPayModal
          open={Boolean(upiModalPlan)}
          onClose={() => setUpiModalPlan(null)}
          service="deploy"
          planId={`ai-${upiModalPlan.id}`}
          planName={`SparrowX AI — ${upiModalPlan.name} (${upiModalPlan.vcpu} vCPU / ${upiModalPlan.ramGb} GB)`}
          amountInr={upiModalPlan.monthlyInr}
          customerEmail={userEmail}
          onPaymentConfirmed={() => {
            setWalletBalanceInr((prev) => prev + upiModalPlan.monthlyInr);
            emitEngineToast(
              `UPI payment confirmed for ${upiModalPlan.name} — ready to deploy`,
              "success",
            );
            setUpiModalPlan(null);
          }}
        />
      ) : null}
    </div>
  );
}
