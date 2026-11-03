import { emitEngineActivity, emitEngineToast } from "@/components/BackgroundEngineToaster";
import { useState, useEffect } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  Coins,
  CreditCard,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  FileSearch,
  Globe2,
  KeyRound,
  Layers,
  LockKeyhole,
  Mail,
  Menu,
  Plus,
  Radio,
  RefreshCw,
  Rocket,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Terminal,
  Trash2,
  User,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CyberThreatGlobe } from "@/components/CyberThreatGlobe";
import { CyberEmblem, CyberPill, type CyberEmblemVariant } from "@/components/ui/CyberBadge";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { ClientIntegrationModal } from "@/components/ClientIntegrationModal";
import {
  AdminRevenueAndOutreachEngine,
  ClientOnboardingWizard,
  LandingLiveSecurityScanner,
  LandingPricingSection,
  ViralTrustBadgeAndOutreachSection,
} from "@/components/GrowthAndMonetizationHub";
import { PaymentGatewayModal } from "@/components/PaymentGatewayModal";
import {
  calculateServiceCost,
  downloadPrintableInvoiceHtml,
  downloadTransactionReceipt,
  fetchBillingTransactions,
  fetchCreditBalance,
  getStoredBillingTransactions,
  getStoredCreditBalance,
  recordBillingTransaction,
  refundBillingTransaction,
  saveStoredCreditBalance,
  CREDIT_PACKAGES,
  type BillingTransaction,
} from "@/lib/billing-credits";
import { generateComplianceReportDocument } from "@/lib/client-sdk-generator";
import {
  type AppUser,
  type Asset,
  type AuditLogEntry,
  authenticateAppUserFromBackend,
  type ClientTenant,
  type Incident,
  maskSecretKey,
  persistAuditLogToBackend,
  persistClientTenantToBackend,
  type PlanTier,
  type ProtectedService,
  type ReportItem,
  type ServiceModuleId,
  type ThreatIndicator,
  type Vulnerability,
} from "@/lib/supabase";
import {
  type AiBrainChatTurn,
  collectUnifiedPlatformContext,
  getAiBrainConfig,
  getLearnedThreatPatterns,
  getStoredBrainChat,
  harvestTelemetryIntoAiMemory,
  querySparrowxGeminiBrain,
  saveAiBrainConfig,
  saveStoredBrainChat,
  type SparrowxBrainModel,
} from "@/lib/sparrowx-ai-brain";

export const SERVICE_MODULES: Array<{
  id: ServiceModuleId;
  navLabel: string;
  shortLabel: string;
  title: string;
  description: string;
  features: string[];
}> = [
  {
    id: "web_security",
    navLabel: "Web & WAF Security",
    shortLabel: "Web Security",
    title: "Web App & Website Security",
    description:
      "Edge WAF, SQLi/XSS payload blocking, DDoS & bot rate-limiting, and SSL/TLS health monitoring.",
    features: [
      "Edge WAF (SQLi / XSS / CSRF block)",
      "Bot & DDoS velocity rate-limiting",
      "SSL/TLS certificate & header enforcement",
    ],
  },
  {
    id: "ai_shield",
    navLabel: "AI Agent & LLM Shield",
    shortLabel: "AI Shield",
    title: "AI Agent & LLM Guardrails",
    description:
      "Prompt Injection Shield, MCP Tool-Call Firewall, PII/Secret redaction, and token-drain protection.",
    features: [
      "System prompt override & jailbreak shield",
      "MCP SQL & shell tool-call firewall",
      "Real-time PII & API secret redaction",
    ],
  },
  {
    id: "cloud_security",
    navLabel: "Cloud & Endpoint Security",
    shortLabel: "Cloud & Endpoints",
    title: "Cloud API & Infrastructure Security",
    description:
      "API Gateway telemetry, Kubernetes & server host isolation, and CVE vulnerability patching.",
    features: [
      "One-click host & container network isolation",
      "API Gateway schema & token validation",
      "Continuous CVE & package vulnerability tracking",
    ],
  },
  {
    id: "compliance",
    navLabel: "Compliance & Evidence",
    shortLabel: "Compliance",
    title: "Automated Compliance & Audit",
    description:
      "Continuous SOC 2 Type II, ISO 27001, and NIST CSF evidence collection and one-click auditor exports.",
    features: [
      "Automated SOC 2 Type II control checks",
      "ISO 27001 Annex A remediation evidence",
      "One-click CSV/audit bundle generation",
    ],
  },
];

export function ClientPortalView({
  activeNav,
  onNavigate,
  tenants,
  selectedTenantId,
  onSelectTenant,
  onCreateTenant,
  onRenameOrUpdateTenant,
  onDeleteTenant,
  onToggleTenantModule,
  onVerifyTenantSdk,
  onOpenServiceSdk,
  currentUser,
  onUpdateUserProfile,
  onSignOut,
  protectedServices,
  assets,
  vulnerabilities,
  reports,
  incidents,
  onGenerateReport,
  showToast,
}: {
  activeNav: string;
  onNavigate: (nav: string) => void;
  tenants: ClientTenant[];
  selectedTenantId: string | null;
  onSelectTenant: (id: string) => void;
  onCreateTenant: (input: {
    name: string;
    contactEmail: string;
    primaryDomain: string;
    planTier: PlanTier;
    enabledModules: ServiceModuleId[];
  }) => Promise<void>;
  onRenameOrUpdateTenant: (
    tenantId: string,
    updates: Partial<Pick<ClientTenant, "name" | "primaryDomain" | "planTier">>,
  ) => Promise<void>;
  onDeleteTenant: (tenantId: string) => Promise<void>;
  onToggleTenantModule: (tenantId: string, moduleId: ServiceModuleId) => Promise<void>;
  onVerifyTenantSdk: (tenant: ClientTenant) => Promise<void>;
  onOpenServiceSdk: (serviceId: string) => void;
  currentUser: { fullName: string; email: string } | null;
  onUpdateUserProfile: (updates: {
    fullName: string;
    email: string;
    newPassword?: string;
  }) => Promise<void>;
  onSignOut: () => void;
  protectedServices: ProtectedService[];
  assets: Asset[];
  vulnerabilities: Vulnerability[];
  reports: ReportItem[];
  incidents: Incident[];
  onGenerateReport: (framework: ReportItem["framework"]) => Promise<void>;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  showToast: (msg: string) => void;
}) {
  // Add Service Modal / Form state in Client Area
  const [showAddServiceForm, setShowAddServiceForm] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [primaryDomain, setPrimaryDomain] = useState("");
  const [planTier, setPlanTier] = useState<PlanTier>("Growth");
  const [selectedModules, setSelectedModules] = useState<ServiceModuleId[]>(["web_security"]);

  // Clicked Service 2-Option Modal ("Go to Dashboard" vs "Manage Service: Rename or Delete")
  const [clickedServiceId, setClickedServiceId] = useState<string | null>(null);
  const [manageSubView, setManageSubView] = useState<"choose" | "manage">("choose");
  const [renameValue, setRenameValue] = useState("");
  const [domainValue, setDomainValue] = useState("");
  const [planValue, setPlanValue] = useState<PlanTier>("Growth");

  // Profile Management state
  const [profileName, setProfileName] = useState(currentUser?.fullName ?? "");
  const [profileEmail, setProfileEmail] = useState(currentUser?.email ?? "");
  const [profileNewPassword, setProfileNewPassword] = useState("");
  const [autoRenewBilling, setAutoRenewBilling] = useState(true);
  const activeTenant = tenants.find((t) => t.id === selectedTenantId) ?? tenants[0] ?? null;
  const [integrationTenant, setIntegrationTenant] = useState<ClientTenant | null>(null);
  const [creditBalance, setCreditBalance] = useState<number>(() =>
    getStoredCreditBalance(activeTenant?.id),
  );
  const [billingTransactions, setBillingTransactions] = useState<BillingTransaction[]>(() =>
    getStoredBillingTransactions(activeTenant?.id),
  );

  // Synchronize live credit balance & transactions from Supabase Cloud Ledger
  useEffect(() => {
    void fetchCreditBalance(activeTenant?.id, currentUser?.email).then((cloudBal) => {
      setCreditBalance(cloudBal);
    });
    void fetchBillingTransactions(activeTenant?.id, currentUser?.email).then((cloudTxs) => {
      setBillingTransactions(cloudTxs);
    });
  }, [activeTenant?.id, currentUser?.email]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [neededCreditsForService, setNeededCreditsForService] = useState<number | undefined>(
    undefined,
  );

  // Local interactive rules for Web & AI modules
  const [wafSqliBlock, setWafSqliBlock] = useState(true);
  const [wafBotChallenge, setWafBotChallenge] = useState(true);
  const [wafStrictTls, setWafStrictTls] = useState(true);
  const [aiPromptShield, setAiPromptShield] = useState(true);
  const [aiMcpFirewall, setAiMcpFirewall] = useState(true);
  const [aiPiiRedaction, setAiPiiRedaction] = useState(true);

  const clickedService = tenants.find((t) => t.id === clickedServiceId) ?? null;

  const getPlanPrice = (tier: PlanTier) =>
    tier === "Enterprise" ? 699 : tier === "Growth" ? 199 : 49;

  const getDueDateLabel = (index = 0) => {
    const due = new Date();
    due.setDate(due.getDate() + 30 - (index % 7));
    return due.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const toggleWizardModule = (id: ServiceModuleId) => {
    setSelectedModules((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((item) => item !== id)
          : prev
        : [...prev, id],
    );
  };

  const handleAddServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim() || !primaryDomain.trim()) return;
    const serviceCost = calculateServiceCost(selectedModules, planTier);
    if (creditBalance < serviceCost) {
      setNeededCreditsForService(serviceCost);
      setShowPaymentModal(true);
      return;
    }

    const nextBal = creditBalance - serviceCost;
    saveStoredCreditBalance(nextBal, activeTenant?.id, currentUser?.email);
    setCreditBalance(nextBal);

    const newTx = recordBillingTransaction(
      {
        type: "service_purchase",
        credits: -serviceCost,
        title: `Service Provisioned: ${serviceName.trim()}`,
        description: `Activated ${serviceName.trim()} (${planTier}) with modules: ${selectedModules.join(", ")}`,
        paymentMethod: "Security Credit Balance",
      },
      activeTenant?.id,
      currentUser?.email,
    );
    setBillingTransactions((prev) => [newTx, ...prev]);

    await onCreateTenant({
      name: serviceName.trim(),
      contactEmail: currentUser?.email ?? "client@company.com",
      primaryDomain: primaryDomain.trim(),
      planTier,
      enabledModules: selectedModules,
    });

    showToast(
      `Purchased & provisioned ${serviceName.trim()} for ${serviceCost} credits! Remaining: ${nextBal} credits`,
    );
    setServiceName("");
    setPrimaryDomain("");
    setShowAddServiceForm(false);
  };

  // ============================================================================
  // CLIENT AREA HUB: 1) My Services  2) Subscriptions & Due Dates  3) Profile
  // ============================================================================
  const isClientAreaView =
    activeNav === "My Services" ||
    activeNav === "Subscriptions & Due Dates" ||
    activeNav === "Billing & Credits" ||
    activeNav === "Profile Management" ||
    !activeTenant;

  if (isClientAreaView) {
    const currentAreaTab =
      activeNav === "Subscriptions & Due Dates" ||
      activeNav === "Billing & Credits" ||
      activeNav === "Profile Management"
        ? activeNav
        : "My Services";

    return (
      <div className="flex flex-col gap-6">
        {/* Client Area Top Banner */}
        <section className="flex flex-col justify-between gap-4 border border-border bg-card p-5 sm:flex-row sm:items-center">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-primary">
              <img
                src="/sparrowx-logo.png"
                alt="SparrowX Logo"
                className="size-4 object-contain inline-block"
              />
              SparrowX Client Area
            </div>
            <h1 className="text-2xl font-semibold text-foreground">
              Welcome, {currentUser?.fullName || "Client Account"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Manage your security services, subscription plans, billing due dates, and account
              profile. Click any service below to launch its dedicated dashboard or manage it.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setNeededCreditsForService(undefined);
                setShowPaymentModal(true);
              }}
              className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-all shadow-sm"
              type="button"
            >
              <Coins className="size-3.5" />
              <span>{creditBalance} Credits</span>
              <span className="rounded bg-primary/20 px-1 text-[10px] text-primary font-mono">
                + Top Up
              </span>
            </button>
            <Button
              onClick={() => onNavigate("Settings")}
              size="sm"
              variant="outline"
              className="gap-1.5 border-primary/40 text-foreground hover:bg-primary/10"
            >
              <KeyRound className="size-3.5 text-primary" />
              <span>Dashboard API & Connectors</span>
            </Button>
            <Button
              onClick={() => {
                onNavigate("My Services");
                setShowAddServiceForm(true);
              }}
              size="sm"
            >
              <Plus className="size-4" /> Add New Service
            </Button>
            <Button onClick={onSignOut} size="sm" variant="outline">
              <LockKeyhole className="size-3.5" /> Log Out
            </Button>
          </div>
        </section>

        {/* Client Area Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto no-scrollbar sm:flex-wrap">
          {[
            { label: "My Services", icon: Boxes, count: tenants.length },
            { label: "Dashboard API & Connectors", icon: KeyRound, targetNav: "Settings" },
            { label: "Subscriptions & Due Dates", icon: Activity },
            { label: "Billing & Credits", icon: Coins, count: creditBalance },
            { label: "Profile Management", icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = currentAreaTab === tab.label;
            return (
              <button
                className={`flex items-center gap-2 rounded-md border px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
                key={tab.label}
                onClick={() => onNavigate(tab.targetNav || tab.label)}
                type="button"
              >
                <Icon className="size-3.5" />
                <span>{tab.label}</span>
                {typeof tab.count === "number" && (
                  <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: MY SERVICES (Add Service + Click Service -> Go to Dashboard OR Manage/Rename/Delete) */}
        {currentAreaTab === "My Services" && (
          <>
            {activeTenant && (
              <ClientOnboardingWizard
                tenant={activeTenant}
                onVerifyTenantSdk={onVerifyTenantSdk}
                onOpenSdkModal={(t) => setIntegrationTenant(t)}
                showToast={showToast}
              />
            )}

            {showAddServiceForm && (
              <form
                className="border border-primary/40 bg-card p-5 shadow-lg"
                onSubmit={handleAddServiceSubmit}
              >
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h2 className="text-base font-semibold">Add New Security Service</h2>
                    <p className="text-xs text-muted-foreground">
                      Choose the security module(s) for this service. Its dashboard will only
                      display the options you select here.
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowAddServiceForm(false)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div>
                    <label
                      className="text-xs font-medium text-muted-foreground"
                      htmlFor="add-srv-name"
                    >
                      Service Name
                    </label>
                    <input
                      className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
                      id="add-srv-name"
                      onChange={(e) => setServiceName(e.target.value)}
                      placeholder="e.g. Main Storefront Web WAF"
                      required
                      value={serviceName}
                    />
                  </div>
                  <div>
                    <label
                      className="text-xs font-medium text-muted-foreground"
                      htmlFor="add-srv-domain"
                    >
                      Target Domain / Endpoint URI
                    </label>
                    <input
                      className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
                      id="add-srv-domain"
                      onChange={(e) => setPrimaryDomain(e.target.value)}
                      placeholder="https://app.yourdomain.com"
                      required
                      value={primaryDomain}
                    />
                  </div>
                  <div>
                    <label
                      className="text-xs font-medium text-muted-foreground"
                      htmlFor="add-srv-plan"
                    >
                      Service Plan Tier
                    </label>
                    <select
                      className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none"
                      id="add-srv-plan"
                      onChange={(e) => setPlanTier(e.target.value as PlanTier)}
                      value={planTier}
                    >
                      <option value="Starter">Starter ($49/mo · 100k req/mo)</option>
                      <option value="Growth">Growth ($199/mo · 2.5M req/mo)</option>
                      <option value="Enterprise">Enterprise ($699/mo · Unlimited)</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <span className="text-xs font-medium text-muted-foreground">
                    Select Service Type / Protection Modules
                  </span>
                  <div className="mt-2 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    {SERVICE_MODULES.map((mod) => {
                      const isSelected = selectedModules.includes(mod.id);
                      return (
                        <button
                          className={`flex flex-col justify-between border p-3.5 text-left transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10"
                              : "border-border bg-background hover:border-primary/40"
                          }`}
                          key={mod.id}
                          onClick={() => toggleWizardModule(mod.id)}
                          type="button"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-primary">
                                {mod.shortLabel}
                              </span>
                              {isSelected && <Check className="size-3.5 text-primary" />}
                            </div>
                            <div className="mt-1 text-xs font-semibold">{mod.title}</div>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {mod.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {(() => {
                  const srvCost = calculateServiceCost(selectedModules, planTier);
                  const hasFunds = creditBalance >= srvCost;
                  return (
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border pt-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Provisioning Cost:</span>
                        <span className="font-mono font-bold text-primary">
                          {srvCost} Credits/mo
                        </span>
                        <span className="text-muted-foreground">· Available Balance:</span>
                        <span
                          className={`font-mono font-bold ${hasFunds ? "text-success" : "text-destructive"}`}
                        >
                          {creditBalance} Credits
                        </span>
                        {!hasFunds && (
                          <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[11px] font-semibold text-destructive">
                            Need {srvCost - creditBalance} more credits
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => setShowAddServiceForm(false)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Cancel
                        </Button>
                        {!hasFunds ? (
                          <Button
                            onClick={() => {
                              setNeededCreditsForService(srvCost);
                              setShowPaymentModal(true);
                            }}
                            size="sm"
                            type="button"
                            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-md"
                          >
                            <Coins className="size-3.5 mr-1" /> Top Up Credits to Buy ({srvCost} Cr)
                          </Button>
                        ) : (
                          <Button size="sm" type="submit">
                            <Sparkles className="size-3.5 mr-1" /> Buy & Launch Service ({srvCost}{" "}
                            Cr)
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </form>
            )}

            {tenants.length > 0 ? (
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tenants.map((srv, idx) => {
                  const srvModules = SERVICE_MODULES.filter((m) =>
                    srv.enabledModules.includes(m.id),
                  );
                  return (
                    <article
                      className="group flex cursor-pointer flex-col justify-between border border-border bg-card p-5 transition-all hover:border-primary hover:shadow-md"
                      key={srv.id}
                      onClick={() => {
                        setClickedServiceId(srv.id);
                        setManageSubView("choose");
                        setRenameValue(srv.name);
                        setDomainValue(srv.primaryDomain);
                        setPlanValue(srv.planTier);
                      }}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {srv.id}
                          </span>
                          <span
                            className={`rounded-sm border px-2 py-0.5 text-[10px] font-semibold ${
                              srv.status === "Active"
                                ? "border-success/30 bg-success/10 text-success"
                                : "border-destructive/30 bg-destructive/10 text-destructive"
                            }`}
                          >
                            {srv.status}
                          </span>
                        </div>

                        <h3 className="mt-2.5 text-base font-semibold group-hover:text-primary">
                          {srv.name}
                        </h3>
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                          {srv.primaryDomain}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {srvModules.map((m) => (
                            <span
                              className="rounded-sm border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                              key={m.id}
                            >
                              {m.shortLabel}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mt-5 border-t border-border pt-3 text-xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>
                            Plan: <strong className="text-foreground">{srv.planTier}</strong> ($
                            {getPlanPrice(srv.planTier)}/mo)
                          </span>
                          <span>Due: {getDueDateLabel(idx)}</span>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between font-semibold text-primary">
                          <span>Click to Open Dashboard or Manage</span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              className="h-6 px-2 text-[10px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIntegrationTenant(srv);
                              }}
                              size="sm"
                              variant="outline"
                            >
                              <Terminal className="mr-1 size-2.5" /> Connect SDK
                            </Button>
                            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            ) : (
              <section className="border border-border bg-card px-6 py-12 text-center">
                <Boxes className="mx-auto size-7 text-primary" />
                <h2 className="mt-3 text-base font-semibold">No active security services yet</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add your first service (Web Security, AI Shield, Cloud & Endpoints, or Compliance)
                  to launch your custom security dashboard.
                </p>
                <Button className="mt-4" onClick={() => setShowAddServiceForm(true)} size="sm">
                  <Plus className="size-4" /> Add Your First Service
                </Button>
              </section>
            )}

            {/* 2-OPTION SERVICE ACTION MODAL: 1) Go to Dashboard  2) Manage Service (Rename / Delete) */}
            {clickedService && (
              <div
                aria-label="Service options"
                className="fixed inset-0 z-50 grid place-items-center bg-background/75 p-3 sm:p-4 backdrop-blur-xs"
                role="dialog"
              >
                <div className="w-full max-w-md max-h-[92vh] overflow-y-auto border border-border bg-card p-4 sm:p-6 shadow-2xl">
                  <div className="flex items-start justify-between border-b border-border pb-3">
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-primary">
                        {clickedService.id} · {clickedService.planTier} Plan
                      </span>
                      <h2 className="mt-0.5 text-lg font-semibold">{clickedService.name}</h2>
                      <p className="font-mono text-xs text-muted-foreground">
                        {clickedService.primaryDomain}
                      </p>
                    </div>
                    <Button
                      className="size-8"
                      onClick={() => setClickedServiceId(null)}
                      size="icon"
                      variant="ghost"
                    >
                      ✕
                    </Button>
                  </div>

                  {manageSubView === "choose" ? (
                    <div className="mt-5 space-y-3">
                      <p className="text-xs text-muted-foreground">
                        What would you like to do with <strong>{clickedService.name}</strong>?
                      </p>

                      {/* OPTION 1: GO TO DASHBOARD */}
                      <button
                        className="flex w-full items-center justify-between rounded-md border border-primary bg-primary/10 p-4 text-left transition-colors hover:bg-primary/20"
                        onClick={() => {
                          onSelectTenant(clickedService.id);
                          setClickedServiceId(null);
                          onNavigate("Client Overview");
                        }}
                        type="button"
                      >
                        <div>
                          <div className="text-sm font-semibold text-primary">
                            1. Go to Service Dashboard
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            Open the dedicated security dashboard showing only{" "}
                            {clickedService.enabledModules
                              .map((id) => SERVICE_MODULES.find((m) => m.id === id)?.shortLabel)
                              .join(", ")}{" "}
                            controls.
                          </div>
                        </div>
                        <ArrowRight className="size-4 shrink-0 text-primary" />
                      </button>

                      {/* OPTION 2: AUTOMATED CONNECTION & SDK */}
                      <button
                        className="flex w-full items-center justify-between rounded-md border border-primary/40 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10"
                        onClick={() => {
                          setIntegrationTenant(clickedService);
                          setClickedServiceId(null);
                        }}
                        type="button"
                      >
                        <div>
                          <div className="text-sm font-semibold text-primary">
                            2. Automated Connection & Diagnostics (SDK)
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            Open multi-framework integration guide (Next.js, Python, Express, MCP),
                            run automated 4-step probes, and transmit live telemetry beacons.
                          </div>
                        </div>
                        <Terminal className="size-4 shrink-0 text-primary" />
                      </button>

                      {/* OPTION 3: MANAGE SERVICE (RENAME OR DELETE) */}
                      <button
                        className="flex w-full items-center justify-between rounded-md border border-border bg-background p-4 text-left transition-colors hover:border-primary/40"
                        onClick={() => setManageSubView("manage")}
                        type="button"
                      >
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            3. Manage Service (Rename or Delete)
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            Rename this service, update its target domain/plan, or delete it from
                            your account.
                          </div>
                        </div>
                        <Wrench className="size-4 shrink-0 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <div>
                        <label
                          className="text-xs font-medium text-muted-foreground"
                          htmlFor="rename-srv-input"
                        >
                          Rename Service
                        </label>
                        <input
                          className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
                          id="rename-srv-input"
                          onChange={(e) => setRenameValue(e.target.value)}
                          value={renameValue}
                        />
                      </div>

                      <div>
                        <label
                          className="text-xs font-medium text-muted-foreground"
                          htmlFor="domain-srv-input"
                        >
                          Target Domain / Endpoint
                        </label>
                        <input
                          className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
                          id="domain-srv-input"
                          onChange={(e) => setDomainValue(e.target.value)}
                          value={domainValue}
                        />
                      </div>

                      <div>
                        <label
                          className="text-xs font-medium text-muted-foreground"
                          htmlFor="plan-srv-input"
                        >
                          Subscription Plan
                        </label>
                        <select
                          className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none"
                          id="plan-srv-input"
                          onChange={(e) => setPlanValue(e.target.value as PlanTier)}
                          value={planValue}
                        >
                          <option value="Starter">Starter ($49/mo)</option>
                          <option value="Growth">Growth ($199/mo)</option>
                          <option value="Enterprise">Enterprise ($699/mo)</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between border-t border-border pt-4">
                        <Button
                          className="text-destructive hover:text-destructive"
                          onClick={async () => {
                            await onDeleteTenant(clickedService.id);
                            setClickedServiceId(null);
                          }}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 className="size-3.5" /> Delete Service
                        </Button>

                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => setManageSubView("choose")}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            Back
                          </Button>
                          <Button
                            onClick={async () => {
                              await onRenameOrUpdateTenant(clickedService.id, {
                                name: renameValue.trim() || clickedService.name,
                                primaryDomain: domainValue.trim() || clickedService.primaryDomain,
                                planTier: planValue,
                              });
                              setClickedServiceId(null);
                            }}
                            size="sm"
                            type="button"
                          >
                            <Check className="size-3.5" /> Save Changes
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: SUBSCRIPTIONS, PLANS & DUE DATES */}
        {currentAreaTab === "Subscriptions & Due Dates" && (
          <section className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="border border-border bg-card p-4">
                <span className="text-xs text-muted-foreground">Active Services</span>
                <div className="mt-2 font-display text-2xl font-semibold">{tenants.length}</div>
                <span className="mt-1 block text-[11px] text-success">
                  All subscriptions in good standing
                </span>
              </div>
              <div className="border border-border bg-card p-4">
                <span className="text-xs text-muted-foreground">Monthly Commitment</span>
                <div className="mt-2 font-display text-2xl font-semibold">
                  ${tenants.reduce((sum, t) => sum + getPlanPrice(t.planTier), 0)}/mo
                </div>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Next Consolidated Due Date: {getDueDateLabel(0)}
                </span>
              </div>
              <div className="border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Auto-Renew Protection</span>
                  <Button
                    className="h-7 px-2.5 text-xs"
                    onClick={() => {
                      setAutoRenewBilling(!autoRenewBilling);
                      showToast(`Auto-renewal ${!autoRenewBilling ? "enabled" : "disabled"}`);
                    }}
                    size="sm"
                    variant={autoRenewBilling ? "default" : "outline"}
                  >
                    {autoRenewBilling ? "Enabled" : "Disabled"}
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Ensures uninterrupted WAF & AI Guardrail protection on your renewal due dates.
                </p>
              </div>
            </div>

            <div className="border border-border bg-card">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-base font-semibold">
                  Service Subscriptions, Plans & Renewal Due Dates
                </h2>
                <p className="text-xs text-muted-foreground">
                  Upgrade or change plans, customize subscribed modules, and track upcoming due
                  dates per service.
                </p>
              </div>
              <div className="divide-y divide-border">
                {tenants.length > 0 ? (
                  tenants.map((srv, idx) => (
                    <div
                      className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center"
                      key={srv.id}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{srv.name}</span>
                          <span className="rounded-sm bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            {srv.planTier} (${getPlanPrice(srv.planTier)}/mo)
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Domain: <code className="text-foreground">{srv.primaryDomain}</code> ·
                          Next Due Date:{" "}
                          <strong className="text-foreground">{getDueDateLabel(idx)}</strong>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          aria-label={`Change plan for ${srv.name}`}
                          className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none"
                          onChange={(e) =>
                            onRenameOrUpdateTenant(srv.id, {
                              planTier: e.target.value as PlanTier,
                            })
                          }
                          value={srv.planTier}
                        >
                          <option value="Starter">Starter ($49/mo)</option>
                          <option value="Growth">Growth ($199/mo)</option>
                          <option value="Enterprise">Enterprise ($699/mo)</option>
                        </select>
                        <Button
                          className="h-8 px-3 text-xs"
                          onClick={() => {
                            onSelectTenant(srv.id);
                            onNavigate("Client Overview");
                          }}
                          size="sm"
                          variant="outline"
                        >
                          Go to Dashboard <ArrowRight className="size-3.5" />
                        </Button>
                        <Button
                          className="h-8 px-2.5 text-xs text-destructive hover:text-destructive"
                          onClick={async () => {
                            await onDeleteTenant(srv.id);
                            showToast(`Cancelled subscription for ${srv.name}`);
                          }}
                          size="sm"
                          variant="ghost"
                        >
                          Cancel Plan
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-5 py-8 text-center text-xs text-muted-foreground">
                    No active subscriptions yet. Add a service in My Services to begin.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* TAB: BILLING & SECURITY CREDITS */}
        {currentAreaTab === "Billing & Credits" && (
          <section className="space-y-6">
            {/* Hero Balance & Top-Up Card */}
            <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-card via-primary/[0.04] to-card p-6 shadow-xl">
              <div className="pointer-events-none absolute -right-20 -top-20 size-60 rounded-full bg-primary/10 blur-3xl" />
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                    <Coins className="size-4" />
                    <span>Security Credits Balance</span>
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                      SparrowX Sovereign Ledger
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-3">
                    <span className="font-display text-4xl font-extrabold tracking-tight text-foreground">
                      {creditBalance}
                    </span>
                    <span className="text-sm font-semibold text-primary">Security Credits</span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Active monthly consumption:{" "}
                    <strong className="text-foreground">
                      {tenants.reduce(
                        (sum, t) => sum + calculateServiceCost(t.enabledModules, t.planTier),
                        0,
                      )}{" "}
                      Credits/mo
                    </strong>{" "}
                    across {tenants.length} active service(s).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() => {
                      setNeededCreditsForService(undefined);
                      setShowPaymentModal(true);
                    }}
                    size="sm"
                    className="h-10 px-5 bg-gradient-to-r from-primary to-orange-500 font-semibold text-white shadow-lg shadow-primary/25 hover:shadow-primary/40"
                  >
                    <CreditCard className="size-4 mr-1.5" /> Top Up Credits Now
                  </Button>
                </div>
              </div>
            </div>

            {/* Quick Credit Packs */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Instant Credit Packs</h3>
                  <p className="text-xs text-muted-foreground">
                    One-click checkout with automated receipt generation
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {CREDIT_PACKAGES.map((pack) => (
                  <div
                    key={pack.id}
                    className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-primary">{pack.name}</span>
                        {pack.popular && (
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[9px] font-bold uppercase text-primary">
                            Popular
                          </span>
                        )}
                        {pack.savings && !pack.popular && (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                            {pack.savings}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="font-display text-2xl font-bold">{pack.credits}</span>
                        <span className="text-xs text-muted-foreground">Credits</span>
                      </div>
                      <div className="mt-1 font-mono text-sm font-semibold text-foreground">
                        ${pack.priceUsd} USD
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{pack.description}</p>
                    </div>

                    <Button
                      onClick={() => {
                        setNeededCreditsForService(undefined);
                        setShowPaymentModal(true);
                      }}
                      size="sm"
                      variant="outline"
                      className="mt-4 w-full h-8 text-xs font-semibold"
                    >
                      <Coins className="size-3.5 mr-1" /> Buy {pack.credits} Credits
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Transaction Ledger */}
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-5 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Credit Transaction Ledger & Invoices</h3>
                  <p className="text-xs text-muted-foreground">
                    Real-time ledger of credit purchases and service deductions
                  </p>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {billingTransactions.length} Recorded Transactions
                </span>
              </div>

              <div className="divide-y divide-border">
                {billingTransactions.length > 0 ? (
                  billingTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 text-xs hover:bg-muted/10 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{tx.title}</span>
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                            {tx.receiptNumber}
                          </span>
                        </div>
                        <div className="mt-0.5 text-muted-foreground flex flex-wrap items-center gap-2 text-[11px]">
                          <span>{tx.timestamp}</span>
                          <span>·</span>
                          <span>Via {tx.paymentMethod}</span>
                          <span>·</span>
                          <span className="font-mono">{tx.id}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div
                            className={`font-mono font-bold text-sm ${
                              tx.credits >= 0 ? "text-emerald-400" : "text-orange-400"
                            }`}
                          >
                            {tx.credits >= 0 ? `+${tx.credits}` : tx.credits} Credits
                          </div>
                          {tx.costUsd !== undefined && (
                            <div className="text-[10px] text-muted-foreground">
                              ${tx.costUsd.toFixed(2)} USD
                            </div>
                          )}
                        </div>

                        <Button
                          onClick={() => downloadTransactionReceipt(tx)}
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs"
                          title="Download Official Receipt (.txt)"
                        >
                          <Download className="size-3 mr-1" /> Receipt
                        </Button>
                        <Button
                          onClick={() =>
                            downloadPrintableInvoiceHtml(tx, currentUser?.email, activeTenant?.name)
                          }
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs"
                          title="Download Printable Tax Invoice (.html)"
                        >
                          <Download className="size-3 mr-1" /> Invoice
                        </Button>
                        {tx.status !== "refunded" &&
                          tx.type !== "refund" &&
                          tx.type !== "failed_attempt" && (
                            <Button
                              onClick={() => {
                                const res = refundBillingTransaction(
                                  tx.id,
                                  "Customer requested credit refund",
                                  activeTenant?.id,
                                  currentUser?.email,
                                );
                                if (res.refundedTx) {
                                  setCreditBalance(res.newBalance);
                                  setBillingTransactions(
                                    getStoredBillingTransactions(activeTenant?.id),
                                  );
                                  showToast(
                                    `Refund processed for ${tx.receiptNumber}. Updated balance: ${res.newBalance} credits`,
                                  );
                                }
                              }}
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11px] text-amber-400 hover:text-amber-300"
                              title="Process Refund & Credit Adjustment"
                            >
                              Refund
                            </Button>
                          )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No billing transactions recorded yet.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* TAB 3: PROFILE MANAGEMENT */}
        {currentAreaTab === "Profile Management" && (
          <section className="max-w-2xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Profile & Account Security</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Update your account holder name, email address, and password.
            </p>
            <form
              className="mt-5 space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                await onUpdateUserProfile({
                  fullName: profileName.trim() || "Client User",
                  email: profileEmail.trim(),
                  ...(profileNewPassword.trim() ? { newPassword: profileNewPassword.trim() } : {}),
                });
                setProfileNewPassword("");
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="prof-name">
                    Full Name
                  </label>
                  <input
                    className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
                    id="prof-name"
                    onChange={(e) => setProfileName(e.target.value)}
                    required
                    value={profileName}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="prof-email">
                    Email Address
                  </label>
                  <input
                    className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
                    id="prof-email"
                    onChange={(e) => setProfileEmail(e.target.value)}
                    required
                    type="email"
                    value={profileEmail}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground" htmlFor="prof-pass">
                  New Password (leave blank to keep current password)
                </label>
                <input
                  className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
                  id="prof-pass"
                  onChange={(e) => setProfileNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  type="password"
                  value={profileNewPassword}
                />
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <Button
                  className="text-destructive hover:text-destructive"
                  onClick={onSignOut}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <LockKeyhole className="size-3.5" /> Log Out of Account
                </Button>
                <Button size="sm" type="submit">
                  <Check className="size-3.5" /> Save Profile Changes
                </Button>
              </div>
            </form>
          </section>
        )}

        {/* Payment Gateway Modal for Buying Security Credits */}
        {showPaymentModal && (
          <PaymentGatewayModal
            currentBalance={creditBalance}
            neededCredits={neededCreditsForService}
            tenantId={activeTenant?.id}
            tenantName={activeTenant?.name}
            userEmail={currentUser?.email}
            onClose={() => {
              setShowPaymentModal(false);
              setNeededCreditsForService(undefined);
            }}
            onCreditsAdded={(newBal) => {
              setCreditBalance(newBal);
              saveStoredCreditBalance(newBal, activeTenant?.id, currentUser?.email);
              void fetchBillingTransactions(activeTenant?.id, currentUser?.email).then(
                (cloudTxs) => {
                  setBillingTransactions(cloudTxs);
                },
              );
            }}
            showToast={showToast}
          />
        )}

        {/* Client Integration & Diagnostic Modal */}
        {integrationTenant && (
          <ClientIntegrationModal
            onClose={() => setIntegrationTenant(null)}
            onVerificationComplete={async () => {
              await onVerifyTenantSdk(integrationTenant);
            }}
            service={{
              id: integrationTenant.id,
              name: integrationTenant.name,
              endpoint: integrationTenant.primaryDomain,
              apiKey: integrationTenant.apiKey,
              category: integrationTenant.enabledModules.join(", "),
            }}
            showToast={showToast}
          />
        )}
      </div>
    );
  }

  const enabledModuleObjects = SERVICE_MODULES.filter((m) =>
    activeTenant.enabledModules.includes(m.id),
  );

  const clientSdkSnippet = `// SparrowX Automated Client Guardrail SDK
// Service: ${activeTenant.name} (${activeTenant.id})
// Subscribed Modules: ${activeTenant.enabledModules.join(", ")}
const SPARROWX_INGEST_ENDPOINT = "https://ingest.sparrowx.io/api/v1/ingest";
const TENANT_API_KEY = process.env.SPARROWX_API_KEY ?? "${maskSecretKey(activeTenant.apiKey)}";

export async function emitSecurityTelemetry(event: {
  title: string;
  severity: "Critical" | "High" | "Medium";
  summary: string;
}) {
  await fetch(SPARROWX_INGEST_ENDPOINT, {
    method: "POST",
    headers: {
      "x-sparrowx-key": TENANT_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: \`INC-\${Date.now().toString().slice(-4)}\`,
      title: \`[${activeTenant.name}] \${event.title}\`,
      source: "${activeTenant.primaryDomain}",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      severity: event.severity,
      status: "Investigating",
      assignee: "Autonomous Guardrail",
      summary: event.summary,
      playbook: "Client Automated Containment",
      affected_assets: 1,
    }),
  });
}`;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Service Dashboard Bar with "← Back to Client Area" */}
      <section className="flex flex-col justify-between gap-4 border border-border bg-card p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="h-8 px-2.5 text-xs"
            onClick={() => onNavigate("My Services")}
            size="sm"
            variant="outline"
          >
            ← Back to Client Area
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">{activeTenant.name}</h1>
              <span className="rounded-sm border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {activeTenant.planTier} Plan
              </span>
              <span
                className={`rounded-sm border px-2 py-0.5 text-[10px] font-semibold ${
                  activeTenant.status === "Active"
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                }`}
              >
                {activeTenant.status}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Target: <code className="text-foreground">{activeTenant.primaryDomain}</code> ·
              Showing <strong>{enabledModuleObjects.length}</strong> subscribed module(s) for this
              service
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="h-8 px-3 text-xs"
            onClick={() => onNavigate("Subscription & Modules")}
            size="sm"
            variant="outline"
          >
            <Wrench className="size-3.5" /> Manage Service Modules
          </Button>
          <Button className="h-8 px-3 text-xs" onClick={() => onNavigate("My Services")} size="sm">
            <Boxes className="size-3.5" /> All My Services
          </Button>
        </div>
      </section>

      {/* 1. CLIENT OVERVIEW & GUIDED AUTOMATION */}
      {activeNav === "Client Overview" && (
        <>
          {/* Guided 3-Step Automation Checklist */}
          <section className="border border-primary/30 bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold uppercase text-primary">
                  Automated Setup & Protection Guide
                </div>
                <h2 className="mt-1 text-base font-semibold">
                  3-Step Autonomous Onboarding Progress
                </h2>
              </div>
              <span className="rounded-sm bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                {activeTenant.sdkVerified ? "3 / 3 Completed (Live)" : "2 / 3 Completed"}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <article className="border border-success/30 bg-background p-4">
                <div className="flex items-center justify-between text-xs font-semibold text-success">
                  <span>Step 1 · Modules Provisioned</span>
                  <Check className="size-4" />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Your dashboard is tailored to:{" "}
                  <strong className="text-foreground">
                    {enabledModuleObjects.map((m) => m.shortLabel).join(", ")}
                  </strong>
                  .
                </p>
              </article>

              <article
                className={`border p-4 ${
                  activeTenant.sdkVerified
                    ? "border-success/30 bg-background"
                    : "border-primary bg-primary/5"
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className={activeTenant.sdkVerified ? "text-success" : "text-primary"}>
                    Step 2 · Verify Telemetry Webhook
                  </span>
                  {activeTenant.sdkVerified ? (
                    <Check className="size-4 text-success" />
                  ) : (
                    <Sparkles className="size-4 text-primary" />
                  )}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Send an automated verification ping to confirm your endpoint streams to SparrowX
                  Cloud.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    className="h-7 px-2.5 text-[11px]"
                    onClick={() => setIntegrationTenant(activeTenant)}
                    size="sm"
                  >
                    <Terminal className="size-3 mr-1" />
                    {activeTenant.sdkVerified
                      ? "Re-Test & View SDK Code"
                      : "Open Connect & Diagnostic Tool"}
                  </Button>
                  {!activeTenant.sdkVerified && (
                    <Button
                      className="h-7 px-2 text-[11px]"
                      onClick={() => onVerifyTenantSdk(activeTenant)}
                      size="sm"
                      variant="outline"
                    >
                      Quick Ping
                    </Button>
                  )}
                </div>
              </article>

              <article className="border border-success/30 bg-background p-4">
                <div className="flex items-center justify-between text-xs font-semibold text-success">
                  <span>Step 3 · Autonomous Shield Active</span>
                  <Check className="size-4" />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Key <code className="text-foreground">{activeTenant.apiKey.slice(0, 16)}...</code>{" "}
                  is active and enforcing real-time guardrails.
                </p>
              </article>
            </div>
          </section>

          {/* Dynamic Module Cards (Only shows what the client subscribed to!) */}
          <section className="grid gap-4 sm:grid-cols-2">
            {enabledModuleObjects.map((mod) => (
              <article
                className="flex flex-col justify-between border border-border bg-card p-5"
                key={mod.id}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-sm bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                      Subscribed Module
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                      <span className="size-2 rounded-full bg-success" /> Active
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold">{mod.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{mod.description}</p>
                  <ul className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
                    {mod.features.map((feat) => (
                      <li className="flex items-center gap-2" key={feat}>
                        <Check className="size-3.5 text-success" /> {feat}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-5 flex justify-end border-t border-border pt-3">
                  <Button
                    className="h-8 px-3 text-xs"
                    onClick={() => onNavigate(mod.navLabel)}
                    size="sm"
                  >
                    Open {mod.shortLabel} Dashboard <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </article>
            ))}
          </section>

          {/* Auto-Generated Tenant SDK Snippet */}
          <section className="border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">
                  Automated Integration Snippet ({activeTenant.name})
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Drop this snippet into your application or AI agent runner to stream events
                  directly into your workspace.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  className="h-8 px-3 text-xs"
                  onClick={() => {
                    navigator.clipboard?.writeText(clientSdkSnippet);
                    showToast("Copied tenant SDK snippet to clipboard");
                  }}
                  size="sm"
                  variant="outline"
                >
                  <Copy className="size-3.5" /> Copy SDK Code
                </Button>
                <Button
                  className="h-8 px-3 text-xs"
                  onClick={() => onVerifyTenantSdk(activeTenant)}
                  size="sm"
                >
                  <Sparkles className="size-3.5" /> Send Test Verification Ping
                </Button>
              </div>
            </div>
            <pre className="mt-3 max-h-60 overflow-x-auto border border-border bg-background p-3.5 font-mono text-xs text-foreground">
              {clientSdkSnippet}
            </pre>
          </section>
        </>
      )}

      {/* 2. DEDICATED WEB & WAF SECURITY DASHBOARD */}
      {activeNav === "Web & WAF Security" && (
        <>
          <section className="border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase text-primary">
                  Web & Website Security Module
                </div>
                <h2 className="mt-1 text-xl font-semibold">
                  Edge WAF, Bot Mitigation & Domain Protection
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Protecting <code className="text-foreground">{activeTenant.primaryDomain}</code>{" "}
                  against OWASP Top 10, SQL injection, XSS, and automated credential stuffing.
                </p>
              </div>
              <span className="rounded-sm border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                Edge WAF Enforced
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">OWASP SQLi & XSS Block</span>
                  <Button
                    className="h-7 px-2.5 text-xs"
                    onClick={() => {
                      const next = !wafSqliBlock;
                      setWafSqliBlock(next);
                      void persistAuditLogToBackend({
                        id: `AUD-${Date.now().toString().slice(-4)}`,
                        actor: currentUser?.fullName || "Client Operator",
                        role: "Client",
                        action: `Edge WAF: SQLi & XSS Inspection ${next ? "Enforced" : "Paused"}`,
                        target: activeTenant.name,
                        severity: "Info",
                        timestamp: "Just now",
                      });
                      showToast(
                        `SQLi/XSS Edge Block ${next ? "enabled & logged to SparrowX Vault" : "disabled & logged"}`,
                      );
                    }}
                    size="sm"
                    variant={wafSqliBlock ? "default" : "outline"}
                  >
                    {wafSqliBlock ? "Active" : "Paused"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Inspects query strings, JSON bodies, and headers at edge for injection payloads.
                </p>
              </div>

              <div className="border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">DDoS & Bot JS Challenge</span>
                  <Button
                    className="h-7 px-2.5 text-xs"
                    onClick={() => {
                      setWafBotChallenge(!wafBotChallenge);
                      showToast(`Bot challenge ${!wafBotChallenge ? "enabled" : "disabled"}`);
                    }}
                    size="sm"
                    variant={wafBotChallenge ? "default" : "outline"}
                  >
                    {wafBotChallenge ? "Active" : "Paused"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Automatically rate-limits headless scrapers and credential-stuffing bursts.
                </p>
              </div>

              <div className="border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Strict HSTS & TLS 1.3</span>
                  <Button
                    className="h-7 px-2.5 text-xs"
                    onClick={() => {
                      setWafStrictTls(!wafStrictTls);
                      showToast(`Strict TLS ${!wafStrictTls ? "enforced" : "relaxed"}`);
                    }}
                    size="sm"
                    variant={wafStrictTls ? "default" : "outline"}
                  >
                    {wafStrictTls ? "Enforced" : "Optional"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Enforces HTTPS redirects, CSP headers, and valid certificate chains.
                </p>
              </div>
            </div>
          </section>

          <section className="border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Onboarded Web Domains & Endpoints</h3>
            <div className="mt-3 divide-y divide-border">
              <div className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs">
                <div>
                  <span className="font-mono font-semibold text-foreground">
                    {activeTenant.primaryDomain}
                  </span>
                  <span className="ml-2 rounded-sm bg-secondary px-1.5 py-0.5 text-[10px]">
                    Primary Domain
                  </span>
                </div>
                <span className="text-success">SSL Valid · WAF Active Shield</span>
              </div>
              {protectedServices
                .filter((s) => s.category === "Web App & Website")
                .map((srv) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs"
                    key={srv.id}
                  >
                    <div>
                      <span className="font-semibold">{srv.name}</span> ·{" "}
                      <code className="text-muted-foreground">{srv.endpoint}</code>
                    </div>
                    <Button
                      className="h-7 px-2.5 text-xs"
                      onClick={() => onOpenServiceSdk(srv.id)}
                      size="sm"
                      variant="outline"
                    >
                      <Terminal className="size-3" /> SDK Code
                    </Button>
                  </div>
                ))}
            </div>
          </section>
        </>
      )}

      {/* 3. DEDICATED AI AGENT & LLM SHIELD DASHBOARD */}
      {activeNav === "AI Agent & LLM Shield" && (
        <>
          <section className="border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase text-primary">
                  AI Agent & LLM Shield Module
                </div>
                <h2 className="mt-1 text-xl font-semibold">
                  Autonomous AI Agent, Prompt & MCP Tool-Call Guardrails
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Real-time inspection of LLM prompts, completions, and Model Context Protocol (MCP)
                  tool executions.
                </p>
              </div>
              <span className="rounded-sm border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                AI Guardrails Enforced
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Prompt Injection Shield</span>
                  <Button
                    className="h-7 px-2.5 text-xs"
                    onClick={() => {
                      const next = !aiPromptShield;
                      setAiPromptShield(next);
                      void persistAuditLogToBackend({
                        id: `AUD-${Date.now().toString().slice(-4)}`,
                        actor: currentUser?.fullName || "Client Operator",
                        role: "Client",
                        action: `AI Shield: Prompt Injection Guardrail ${next ? "Activated" : "Paused"}`,
                        target: activeTenant.name,
                        severity: "Info",
                        timestamp: "Just now",
                      });
                      showToast(
                        `Prompt Shield ${next ? "enabled & logged to SparrowX Vault" : "disabled & logged"}`,
                      );
                    }}
                    size="sm"
                    variant={aiPromptShield ? "default" : "outline"}
                  >
                    {aiPromptShield ? "Active" : "Paused"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Blocks system-instruction overrides, indirect prompt injections, and jailbreaks.
                </p>
              </div>

              <div className="border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">MCP Tool-Call Firewall</span>
                  <Button
                    className="h-7 px-2.5 text-xs"
                    onClick={() => {
                      setAiMcpFirewall(!aiMcpFirewall);
                      showToast(`MCP Tool Firewall ${!aiMcpFirewall ? "enabled" : "disabled"}`);
                    }}
                    size="sm"
                    variant={aiMcpFirewall ? "default" : "outline"}
                  >
                    {aiMcpFirewall ? "Active" : "Paused"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Halts unauthorized destructive SQL queries, shell commands, or data exports by AI
                  agents.
                </p>
              </div>

              <div className="border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">PII & Secret Redaction</span>
                  <Button
                    className="h-7 px-2.5 text-xs"
                    onClick={() => {
                      setAiPiiRedaction(!aiPiiRedaction);
                      showToast(`PII Redaction ${!aiPiiRedaction ? "enabled" : "disabled"}`);
                    }}
                    size="sm"
                    variant={aiPiiRedaction ? "default" : "outline"}
                  >
                    {aiPiiRedaction ? "Active" : "Paused"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Masks SSNs, credit cards, and bearer tokens before prompts leave your environment.
                </p>
              </div>
            </div>
          </section>
        </>
      )}

      {/* 4. DEDICATED CLOUD & ENDPOINT SECURITY DASHBOARD */}
      {activeNav === "Cloud & Endpoint Security" && (
        <section className="border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase text-success">
                Cloud API & Infrastructure Module
              </div>
              <h2 className="mt-1 text-xl font-semibold">
                Monitored Cloud Nodes, API Gateways & CVEs
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {assets.length} registered host(s) · {vulnerabilities.length} tracked CVE(s)
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="border border-border bg-background p-4">
              <div className="text-xs font-semibold">Registered Infrastructure Hosts</div>
              <p className="mt-1 text-2xl font-semibold">{assets.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Nodes monitored with instant network isolation capability.
              </p>
            </div>
            <div className="border border-border bg-background p-4">
              <div className="text-xs font-semibold">Open Vulnerabilities (CVEs)</div>
              <p className="mt-1 text-2xl font-semibold">
                {vulnerabilities.filter((v) => v.status !== "Patched").length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Unpatched package advisories across production workloads.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 5. DEDICATED COMPLIANCE & EVIDENCE DASHBOARD */}
      {activeNav === "Compliance & Evidence" && (
        <section className="border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase text-info">
                Automated Compliance & Audit Module
              </div>
              <h2 className="mt-1 text-xl font-semibold">
                Continuous SOC 2 Type II & ISO 27001 Evidence
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Generate audit-ready posture attestations from your live security controls.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                className="h-8 px-3 text-xs"
                onClick={() => onGenerateReport("SOC 2 Type II")}
                size="sm"
                variant="outline"
              >
                <Plus className="size-3.5" /> Generate SOC 2 Bundle
              </Button>
              <Button
                className="h-8 px-3 text-xs"
                onClick={() => onGenerateReport("ISO 27001")}
                size="sm"
              >
                <Sparkles className="size-3.5" /> Generate ISO 27001 Bundle
              </Button>
            </div>
          </div>

          <div className="mt-4 divide-y divide-border border-t border-border">
            {reports.length > 0 ? (
              reports.map((r) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs"
                  key={r.id}
                >
                  <div>
                    <span className="font-semibold">{r.title}</span> ·{" "}
                    <span className="text-muted-foreground">{r.generatedAt}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-sm bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                      {r.status}
                    </span>
                    <Button
                      className="h-7 px-2.5 text-xs"
                      onClick={() => {
                        const fw = (
                          ["SOC 2 Type II", "ISO 27001", "NIST CSF", "Executive Summary"].includes(
                            r.framework,
                          )
                            ? r.framework
                            : "SOC 2 Type II"
                        ) as "SOC 2 Type II" | "ISO 27001" | "NIST CSF" | "Executive Summary";
                        const doc = generateComplianceReportDocument(fw, {
                          tenantName: activeTenant.name,
                          domain: activeTenant.primaryDomain,
                          activeIncidentsCount: incidents.length,
                          protectedAssetsCount: assets.length,
                          guardrailStatus: activeTenant.sdkVerified
                            ? "Enforced & Active"
                            : "Pending Ingestion Probe",
                          author: currentUser?.fullName ?? "SparrowX Security Officer",
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
                      <Download className="size-3 mr-1" /> Attestation (.md)
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No compliance bundles generated yet. Click a generator button above to create one.
              </p>
            )}
          </div>
        </section>
      )}

      {/* 6. SUBSCRIPTION & DYNAMIC MODULE TOGGLES */}
      {activeNav === "Subscription & Modules" && (
        <section className="border border-border bg-card p-5">
          <div>
            <div className="text-xs font-semibold uppercase text-primary">
              Dynamic Workspace Customization
            </div>
            <h2 className="mt-1 text-xl font-semibold">
              Manage Subscribed Security Modules ({activeTenant.name})
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Enable or disable modules below. Notice how the left sidebar immediately updates to
              show only the options you need—no junk menus.
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {SERVICE_MODULES.map((mod) => {
              const isEnabled = activeTenant.enabledModules.includes(mod.id);
              return (
                <div
                  className={`flex flex-col justify-between border p-4 ${
                    isEnabled ? "border-primary bg-primary/5" : "border-border bg-background"
                  }`}
                  key={mod.id}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">{mod.title}</h3>
                      <span
                        className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold ${
                          isEnabled
                            ? "bg-success/15 text-success"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {isEnabled ? "Enabled in Sidebar" : "Hidden"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">{mod.description}</p>
                  </div>
                  <div className="mt-4 flex justify-end border-t border-border pt-3">
                    <Button
                      className="h-8 px-3 text-xs"
                      onClick={() => onToggleTenantModule(activeTenant.id, mod.id)}
                      size="sm"
                      variant={isEnabled ? "outline" : "default"}
                    >
                      {isEnabled ? "Disable Module" : "Enable Module"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {/* Payment Gateway Modal for Buying Security Credits */}
      {showPaymentModal && (
        <PaymentGatewayModal
          currentBalance={creditBalance}
          neededCredits={neededCreditsForService}
          tenantId={activeTenant?.id}
          tenantName={activeTenant?.name}
          userEmail={currentUser?.email}
          onClose={() => {
            setShowPaymentModal(false);
            setNeededCreditsForService(undefined);
          }}
          onCreditsAdded={(newBal) => {
            setCreditBalance(newBal);
            saveStoredCreditBalance(newBal, activeTenant?.id, currentUser?.email);
            void fetchBillingTransactions(activeTenant?.id, currentUser?.email).then((cloudTxs) => {
              setBillingTransactions(cloudTxs);
            });
          }}
          showToast={showToast}
        />
      )}

      {/* Client Integration & Diagnostic Modal */}
      {integrationTenant && (
        <ClientIntegrationModal
          onClose={() => setIntegrationTenant(null)}
          onVerificationComplete={async () => {
            await onVerifyTenantSdk(integrationTenant);
          }}
          service={{
            id: integrationTenant.id,
            name: integrationTenant.name,
            endpoint: integrationTenant.primaryDomain,
            apiKey: integrationTenant.apiKey,
            category: integrationTenant.enabledModules.join(", "),
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function AdminMasterAiBrainConsole({
  activeNav,
  tenants,
  reports = [],
  incidents = [],
  vulnerabilities = [],
  assets = [],
  protectedServices = [],
  threatIndicators = [],
  auditLogs,
  onPreviewClientPortal,
  onEnforceGlobalAutoBlock,
  onRecordAudit,
}: {
  activeNav: string;
  tenants: ClientTenant[];
  reports?: ReportItem[] | undefined;
  incidents?: Incident[] | undefined;
  vulnerabilities?: Vulnerability[] | undefined;
  assets?: Asset[] | undefined;
  protectedServices?: ProtectedService[] | undefined;
  threatIndicators?: ThreatIndicator[] | undefined;
  auditLogs: AuditLogEntry[];
  onPreviewClientPortal: (tenantId: string) => void;
  onEnforceGlobalAutoBlock?: ((learnedCount: number) => Promise<void> | void) | undefined;
  onRecordAudit: (
    action: string,
    target: string,
    severity?: AuditLogEntry["severity"],
  ) => Promise<void>;
}) {
  const [selectedTenantId, setSelectedTenantId] = useState<string>("ALL");
  const [brainModel, setBrainModel] = useState<SparrowxBrainModel>(
    () => getAiBrainConfig().model ?? "gemini-3.8-flash",
  );
  const [chatHistory, setChatHistory] = useState<AiBrainChatTurn[]>(() => getStoredBrainChat());
  const [promptInput, setPromptInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const focusedTenant =
    selectedTenantId !== "ALL" ? tenants.find((t) => t.id === selectedTenantId) : undefined;

  const verifiedCount = tenants.filter((t) => t.sdkVerified).length;
  const totalBlockedAcrossUsers = tenants.reduce((acc, t) => acc + t.blockedThreats, 0);

  const handleModelChange = (model: SparrowxBrainModel) => {
    setBrainModel(model);
    saveAiBrainConfig({ model });
    emitEngineToast(`Admin AI Brain switched to ${model}`);
  };

  const askAdminBrain = async (rawPrompt: string, overrideTenantId?: string) => {
    const trimmed = rawPrompt.trim();
    if (!trimmed || isThinking) return;
    const targetTenantId = overrideTenantId ?? selectedTenantId;
    setPromptInput("");
    setIsThinking(true);

    const userTurn: AiBrainChatTurn = {
      id: `admin-turn-u-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    const updatedWithUser = [...chatHistory, userTurn];
    setChatHistory(updatedWithUser);
    saveStoredBrainChat(updatedWithUser);

    const digest = collectUnifiedPlatformContext({
      activeNav: `Admin Master Console · ${activeNav}`,
      portalMode: "admin",
      incidents,
      threatIndicators,
      assets,
      vulnerabilities,
      protectedServices,
      clientTenants: tenants,
      auditLogs,
      reports,
      focusedTenantId: targetTenantId === "ALL" ? null : targetTenantId,
    });

    const harvested = harvestTelemetryIntoAiMemory({
      incidents,
      threatIndicators,
      vulnerabilities,
      protectedServices,
    });

    const cfg = getAiBrainConfig();
    const res = await querySparrowxGeminiBrain({
      prompt: trimmed,
      digest,
      model: brainModel,
      previousInteractionId: cfg.lastInteractionId,
    });

    const aiTurn: AiBrainChatTurn = {
      id: `admin-turn-a-${Date.now()}`,
      role: "assistant",
      content: res.text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      modelUsed: res.modelUsed,
      interactionId: res.interactionId,
      learnedPatternsCount: harvested.allPatterns.length,
    };
    const finalTurns = [...updatedWithUser, aiTurn];
    setChatHistory(finalTurns);
    saveStoredBrainChat(finalTurns);
    setIsThinking(false);

    await onRecordAudit(
      `Admin AI Brain queried (${res.modelUsed})`,
      targetTenantId === "ALL"
        ? `All ${tenants.length} User Dashboards & ${reports.length} Reports`
        : `User Dashboard ${targetTenantId}`,
      "Info",
    );
  };

  const handleExportMultiUserReport = () => {
    const content = [
      `SPARROWX MASTER ADMIN AI BRAIN — MULTI-USER DASHBOARD & COMPLIANCE REPORT`,
      `Generated At: ${new Date().toISOString()}`,
      `AI Brain Engine: SparrowX AI Autonomous Core`,
      `Total User Workspaces: ${tenants.length} (${verifiedCount} SDK Verified)`,
      `Total Blocked Threats Across Users: ${totalBlockedAcrossUsers}`,
      `Total Compliance & Security Reports: ${reports.length}`,
      ``,
      `=== 1. ALL USER / CLIENT DASHBOARDS ===`,
      ...tenants.map(
        (t, idx) =>
          `${idx + 1}. ${t.name} (${t.contactEmail}) | Domain: ${t.primaryDomain} | Tier: ${t.planTier} | Status: ${t.status} | SDK Verified: ${t.sdkVerified ? "YES" : "NO"} | Guardrails: ${t.guardrailsActive ? "ACTIVE" : "PAUSED"} | Blocked Threats: ${t.blockedThreats} | Traffic: ${t.requestsPerMin} req/min | Latency: ${t.avgLatencyMs}ms | Quota: ${t.quotaUsedPct}% | Modules: ${t.enabledModules.join(", ")}`,
      ),
      ``,
      `=== 2. GENERATED SECURITY & COMPLIANCE REPORTS ===`,
      ...reports.map(
        (r, idx) =>
          `${idx + 1}. [${r.id}] ${r.title} (${r.framework}) | Period: ${r.period} | Status: ${r.status} | Generated: ${r.generatedAt} | Author: ${r.author}`,
      ),
      ``,
      `=== 3. LATEST AI BRAIN EXECUTIVE SYNTHESIS ===`,
      chatHistory.filter((t) => t.role === "assistant").slice(-1)[0]?.content ??
        "Run an AI Brain query to include live conversational analysis.",
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sparrowx-admin-ai-brain-all-users-report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    emitEngineToast("Downloaded Admin AI Brain Multi-User & Compliance Report.");
  };

  const latestAssistantTurns = chatHistory.slice(-6);

  return (
    <section className="overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-lg">
      {/* Header Bar */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/80 pb-4 lg:flex-row lg:items-center">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="size-3.5" />
              Master Admin SparrowX AI Brain · Full User & Report Access
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {tenants.length} User Dashboards · {reports.length} Reports Connected
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground sm:text-xl">
            Ask SparrowX AI Brain About Any User Dashboard, Tenant Posture, or Compliance Report
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Your SparrowX AI Brain has live read/analyze access to all{" "}
            <strong className="text-foreground">{tenants.length} client user dashboards</strong>,{" "}
            <strong className="text-foreground">
              {reports.length} security & compliance reports
            </strong>
            , <strong className="text-foreground">{incidents.length} SOC incidents</strong>, and{" "}
            <strong className="text-foreground">{auditLogs.length} audit events</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Select SparrowX AI Brain Engine Mode"
            value={brainModel}
            onChange={(e) => handleModelChange(e.target.value as SparrowxBrainModel)}
            className="h-9 rounded-lg border border-border bg-background px-3 font-mono text-xs text-foreground outline-none focus:border-primary"
          >
            <option value="gemini-3.8-flash">SparrowX AI Fast Neural (Sub-Second)</option>
            <option value="gemini-4-argon">SparrowX AI Deep Reasoning (Multi-Vector)</option>
          </select>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleExportMultiUserReport}
            className="h-9 gap-1.5 text-xs"
          >
            <Download className="size-3.5 text-primary" />
            Export All-Users AI Report
          </Button>

          {onEnforceGlobalAutoBlock && (
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                await onEnforceGlobalAutoBlock(getLearnedThreatPatterns().length);
                emitEngineToast(
                  "Admin AI Brain enforced learned threat signatures across all user dashboards.",
                );
              }}
              className="h-9 gap-1.5 bg-primary text-xs font-semibold text-primary-foreground"
            >
              <ShieldCheck className="size-3.5" />
              Auto-Shield All Users
            </Button>
          )}
        </div>
      </div>

      {/* User / Tenant Scope Selector + Live User Dashboards Strip */}
      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-3 lg:col-span-5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="admin-brain-user-select"
              className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              1. Inspect User Dashboard Scope
            </label>
            <span className="font-mono text-[11px] text-primary">
              {verifiedCount}/{tenants.length} Verified
            </span>
          </div>

          <select
            id="admin-brain-user-select"
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            className="h-10 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground outline-none focus:border-primary"
          >
            <option value="ALL">
              🌐 All Users & Client Dashboards ({tenants.length} Workspaces + {reports.length}{" "}
              Reports)
            </option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                👤 {t.name} ({t.contactEmail}) · {t.primaryDomain} [{t.planTier} ·{" "}
                {t.sdkVerified ? "SDK Verified" : "Unverified"}]
              </option>
            ))}
          </select>

          {/* Focused User or All-Users Quick Cards */}
          <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
            {(focusedTenant ? [focusedTenant] : tenants).map((t) => (
              <div
                key={t.id}
                className={`flex flex-col gap-2 rounded-lg border p-3 transition-colors ${
                  selectedTenantId === t.id
                    ? "border-primary/60 bg-primary/10"
                    : "border-border/80 bg-background/60 hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-foreground">
                        {t.name}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                          t.sdkVerified
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {t.sdkVerified ? "Verified" : "Unverified"}
                      </span>
                      <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {t.planTier}
                      </span>
                    </div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">
                      {t.contactEmail} · {t.primaryDomain}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTenantId(t.id);
                        void askAdminBrain(
                          `Analyze ${t.name}'s user dashboard (${t.primaryDomain}, contact: ${t.contactEmail}). Report their SDK verification status, blocked threats (${t.blockedThreats}), quota usage (${t.quotaUsedPct}%), active security modules, and what actions we should take to protect them.`,
                          t.id,
                        );
                      }}
                      className="rounded border border-primary/40 bg-primary/15 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/25"
                    >
                      Ask AI
                    </button>
                    <button
                      type="button"
                      onClick={() => onPreviewClientPortal(t.id)}
                      className="rounded border border-border bg-card px-2 py-1 text-[10px] font-medium text-foreground hover:border-primary/40"
                      title="Open this user's live dashboard"
                    >
                      Open Portal
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-1.5 font-mono text-[10px] text-muted-foreground">
                  <span>
                    Blocked: <strong className="text-foreground">{t.blockedThreats}</strong>
                  </span>
                  <span>
                    Traffic: <strong className="text-foreground">{t.requestsPerMin}/m</strong>
                  </span>
                  <span>
                    Quota: <strong className="text-foreground">{t.quotaUsedPct}%</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Connected Compliance & Executive Reports List */}
          {reports.length > 0 && (
            <div className="rounded-lg border border-border/80 bg-background/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  2. Connected Security & Compliance Reports ({reports.length})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void askAdminBrain(
                      `Review all ${reports.length} compliance and executive security reports (${reports.map((r) => r.title).join(", ")}) alongside all ${tenants.length} user dashboards. Summarize key compliance findings, readiness gaps, and executive recommendations.`,
                    )
                  }
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Audit All Reports →
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {reports.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() =>
                      void askAdminBrain(
                        `Analyze report "${r.title}" [${r.framework}, Period: ${r.period}, Status: ${r.status}] generated by ${r.author} and cross-reference it with our ${tenants.length} client user dashboards and open incidents.`,
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-left text-[11px] text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10"
                  >
                    <FileSearch className="size-3 text-primary" />
                    <span className="truncate max-w-[180px] font-medium">{r.title}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      ({r.framework})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Admin AI Brain Chat Thread & Prompt Bar */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-background/80 p-4 lg:col-span-7">
          <div>
            {/* Quick Admin Prompt Presets with High-Tech Cyber Emblems */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {[
                {
                  variant: "chart" as CyberEmblemVariant,
                  label: "Summarize All Users' Dashboards",
                  prompt:
                    "Give me a complete executive briefing of all user dashboards, including each user's domain, plan tier, SDK verification status, blocked threats, quota usage, and any workspaces that need immediate attention.",
                },
                {
                  variant: "audit" as CyberEmblemVariant,
                  label: "Audit All Compliance Reports",
                  prompt:
                    "Inspect all generated compliance and executive reports (SOC 2 Type II, ISO 27001, NIST CSF, Executive Summary) and cross-reference them with live user dashboard telemetry and open vulnerabilities.",
                },
                {
                  variant: "warning" as CyberEmblemVariant,
                  label: "Find Unverified or At-Risk Users",
                  prompt:
                    "Which user dashboards currently have unverified SDKs, paused AI guardrails, lockdown state, or high quota utilization? Tell me how to remediate each one.",
                },
                {
                  variant: "shield-alert" as CyberEmblemVariant,
                  label: "Predict & Block Threats Across All Users",
                  prompt:
                    "Correlate all open SOC incidents, unblocked threat indicators, and CVEs across all client user dashboards and generate zero-trust WAF & AI guardrail rules to block future problems.",
                },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  disabled={isThinking}
                  onClick={() => void askAdminBrain(preset.prompt)}
                  className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-foreground transition-all hover:border-primary hover:bg-primary/20 disabled:opacity-50"
                >
                  <CyberEmblem variant={preset.variant} size="sm" className="size-4 p-0.5 rounded-sm" />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>

            {/* Conversation Stream */}
            <div className="max-h-80 min-h-[220px] space-y-3 overflow-y-auto rounded-lg border border-border/70 bg-card/60 p-3">
              {latestAssistantTurns.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-center">
                  <Sparkles className="mb-2 size-7 text-primary" />
                  <div className="text-sm font-semibold text-foreground">
                    Admin Master AI Brain Ready
                  </div>
                  <p className="mt-1 max-w-md text-xs text-muted-foreground">
                    Select any user workspace on the left or click a preset above to talk with
                    SparrowX AI about all user dashboards, SDK verification states, blocked threats,
                    and compliance reports.
                  </p>
                </div>
              ) : (
                latestAssistantTurns.map((turn) => (
                  <div
                    key={turn.id}
                    className={`rounded-lg border p-3 text-xs leading-relaxed ${
                      turn.role === "user"
                        ? "ml-6 border-primary/40 bg-primary/10 text-foreground"
                        : "mr-2 border-border bg-background/90 text-foreground"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="font-semibold uppercase text-primary">
                        {turn.role === "user"
                          ? `Admin Operator ${focusedTenant ? `(Scope: ${focusedTenant.name})` : "(Global Scope)"}`
                          : `SparrowX AI Brain (${turn.modelUsed ? "Autonomous Core" : "Neural Engine"})`}
                      </span>
                      <span className="font-mono">{turn.timestamp}</span>
                    </div>
                    <div className="whitespace-pre-wrap font-sans text-xs">{turn.content}</div>
                  </div>
                ))
              )}

              {isThinking && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-primary">
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>
                    SparrowX AI Brain is inspecting all {tenants.length} user
                    dashboards and {reports.length} compliance reports...
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Chat Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void askAdminBrain(promptInput);
            }}
            className="mt-3 flex gap-2"
          >
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder={
                focusedTenant
                  ? `Ask AI Brain about ${focusedTenant.name}'s dashboard (${focusedTenant.primaryDomain}) or reports...`
                  : `Ask AI Brain about any user's dashboard, blocked threats, SDK status, or compliance report...`
              }
              className="h-10 flex-1 rounded-lg border border-border bg-card px-3.5 text-xs text-foreground outline-none focus:border-primary"
            />
            <Button
              type="submit"
              disabled={isThinking || !promptInput.trim()}
              className="h-10 gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground"
            >
              <Sparkles className="size-3.5" />
              {isThinking ? "Analyzing..." : "Ask AI Brain"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}

export function AdminPortalView({
  activeNav,
  tenants,
  auditLogs,
  reports = [],
  incidents = [],
  vulnerabilities = [],
  assets = [],
  protectedServices = [],
  threatIndicators = [],
  onEnforceGlobalAutoBlock,
  onCreateTenant,
  onToggleTenantModule,
  onToggleTenantLockdown,
  onRotateTenantKey,
  onDeleteTenant,
  onPreviewClientPortal,
  staffMfaEnforced,
  setStaffMfaEnforced,
  jitTenantApproval,
  setJitTenantApproval,
  ipAllowlistStrict,
  setIpAllowlistStrict,
  onRecordAudit,
}: {
  activeNav: string;
  tenants: ClientTenant[];
  auditLogs: AuditLogEntry[];
  reports?: ReportItem[] | undefined;
  incidents?: Incident[] | undefined;
  vulnerabilities?: Vulnerability[] | undefined;
  assets?: Asset[] | undefined;
  protectedServices?: ProtectedService[] | undefined;
  threatIndicators?: ThreatIndicator[] | undefined;
  onEnforceGlobalAutoBlock?: ((learnedCount: number) => Promise<void> | void) | undefined;
  onCreateTenant: (input: {
    name: string;
    contactEmail: string;
    primaryDomain: string;
    planTier: PlanTier;
    enabledModules: ServiceModuleId[];
  }) => Promise<void>;
  onToggleTenantModule: (tenantId: string, moduleId: ServiceModuleId) => Promise<void>;
  onToggleTenantLockdown: (tenantId: string) => Promise<void>;
  onRotateTenantKey: (tenantId: string) => Promise<void>;
  onDeleteTenant: (tenantId: string) => Promise<void>;
  onPreviewClientPortal: (tenantId: string) => void;
  staffMfaEnforced: boolean;
  setStaffMfaEnforced: (v: boolean) => void;
  jitTenantApproval: boolean;
  setJitTenantApproval: (v: boolean) => void;
  ipAllowlistStrict: boolean;
  setIpAllowlistStrict: (v: boolean) => void;
  onRecordAudit: (
    action: string,
    target: string,
    severity?: AuditLogEntry["severity"],
  ) => Promise<void>;
}) {
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newTier, setNewTier] = useState<PlanTier>("Enterprise");
  const [newModules, setNewModules] = useState<ServiceModuleId[]>(["web_security", "ai_shield"]);
  const [showAdminPaymentModal, setShowAdminPaymentModal] = useState(false);
  const [adminPaymentCredits, setAdminPaymentCredits] = useState<number | undefined>(undefined);
  const [adminCreditBalance, setAdminCreditBalance] = useState<number>(() =>
    getStoredCreditBalance(),
  );

  const toggleNewMod = (id: ServiceModuleId) => {
    setNewModules((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((m) => m !== id) : prev) : [...prev, id],
    );
  };

  const handleQuickProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newDomain.trim()) return;
    await onCreateTenant({
      name: newName.trim(),
      contactEmail: newEmail.trim(),
      primaryDomain: newDomain.trim(),
      planTier: newTier,
      enabledModules: newModules,
    });
    setNewName("");
    setNewEmail("");
    setNewDomain("");
  };

  return (
    <div className="flex flex-col gap-6">
      <AdminMasterAiBrainConsole
        activeNav={activeNav}
        tenants={tenants}
        reports={reports}
        incidents={incidents}
        vulnerabilities={vulnerabilities}
        assets={assets}
        protectedServices={protectedServices}
        threatIndicators={threatIndicators}
        auditLogs={auditLogs}
        onPreviewClientPortal={onPreviewClientPortal}
        onEnforceGlobalAutoBlock={onEnforceGlobalAutoBlock}
        onRecordAudit={onRecordAudit}
      />

      {/* 1. CLIENT SUBSCRIPTIONS & DYNAMIC MODULE CONTROL */}
      {activeNav === "Client Subscriptions" && (
        <>
          <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-primary">
                <img
                  src="/sparrowx-logo.png"
                  alt="SparrowX Logo"
                  className="size-4 object-contain inline-block"
                />
                SparrowX Master Subscription & Tenant Control
              </div>
              <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">
                Client subscriptions & service modules
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Provision client tenants, manage subscription tiers, and control which service
                modules appear in each client’s dynamic dashboard.
              </p>
            </div>
          </section>

          <AdminRevenueAndOutreachEngine
            onOpenPaymentModal={(needed) => {
              setAdminPaymentCredits(needed);
              setShowAdminPaymentModal(true);
            }}
            onConvertProspectToTenant={onCreateTenant}
            showToast={(msg) => emitEngineToast(msg)}
          />

          <form
            className="flex flex-col gap-3 border border-border bg-card p-5"
            onSubmit={handleQuickProvision}
          >
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Provision New Client Tenant
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <input
                aria-label="Client organization name"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Client name (e.g. Acme Corp)"
                required
                value={newName}
              />
              <input
                aria-label="Client contact email"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="secops@yourcompany.com"
                required
                type="email"
                value={newEmail}
              />
              <input
                aria-label="Primary domain or URI"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="https://app.yourcompany.com"
                required
                value={newDomain}
              />
              <select
                aria-label="Subscription tier"
                className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none"
                onChange={(e) => setNewTier(e.target.value as PlanTier)}
                value={newTier}
              >
                <option value="Starter">Starter Tier</option>
                <option value="Growth">Growth Tier</option>
                <option value="Enterprise">Enterprise Tier</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Subscribed Modules:</span>
                {SERVICE_MODULES.map((m) => {
                  const active = newModules.includes(m.id);
                  return (
                    <button
                      className={`rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-background text-muted-foreground"
                      }`}
                      key={m.id}
                      onClick={() => toggleNewMod(m.id)}
                      type="button"
                    >
                      {active ? "✓ " : "+ "}
                      {m.shortLabel}
                    </button>
                  );
                })}
              </div>
              <Button size="sm" type="submit">
                <Plus className="size-3.5" /> Provision Client Tenant
              </Button>
            </div>
          </form>

          {tenants.length > 0 ? (
            <section className="grid gap-4">
              {tenants.map((tenant) => (
                <article className="border border-border bg-card p-5" key={tenant.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold">{tenant.name}</h2>
                        <span className="font-mono text-xs text-muted-foreground">
                          ({tenant.id})
                        </span>
                        <span className="rounded-sm border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {tenant.planTier}
                        </span>
                        <span
                          className={`rounded-sm border px-2 py-0.5 text-[10px] font-semibold ${
                            tenant.status === "Active"
                              ? "border-success/30 bg-success/10 text-success"
                              : "border-destructive/30 bg-destructive/10 text-destructive"
                          }`}
                        >
                          {tenant.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {tenant.contactEmail} · Target:{" "}
                        <code className="text-foreground">{tenant.primaryDomain}</code>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        className="h-8 px-3 text-xs"
                        onClick={() => onPreviewClientPortal(tenant.id)}
                        size="sm"
                        variant="secondary"
                      >
                        <Eye className="size-3.5" /> Inspect Tenant Console & SDK
                      </Button>
                      <Button
                        aria-label={`Delete ${tenant.name}`}
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => onDeleteTenant(tenant.id)}
                        size="icon"
                        variant="ghost"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-border pt-4">
                    <div className="text-xs font-medium text-muted-foreground">
                      Active Dashboard Modules for {tenant.name} (Click to enable/disable in client
                      portal):
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {SERVICE_MODULES.map((mod) => {
                        const enabled = tenant.enabledModules.includes(mod.id);
                        return (
                          <Button
                            className="h-8 px-3 text-xs"
                            key={mod.id}
                            onClick={() => onToggleTenantModule(tenant.id, mod.id)}
                            size="sm"
                            variant={enabled ? "default" : "outline"}
                          >
                            {enabled && <Check className="size-3.5" />}
                            {mod.shortLabel}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <section className="border border-border bg-card px-6 py-12 text-center">
              <Users className="mx-auto size-6 text-primary" />
              <h2 className="mt-3 text-sm font-semibold">No client tenants provisioned yet</h2>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                Use the form above or switch to the Client Portal to test automated self-onboarding.
              </p>
            </section>
          )}
        </>
      )}

      {/* 2. TENANT PERFORMANCE & KILL-SWITCH */}
      {activeNav === "Performance & Kill-Switch" && (
        <>
          <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-info">
                <Activity className="size-3.5" />
                Platform SLA & Telemetry Statistics
              </div>
              <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">
                Tenant performance & emergency lockdown
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Monitor per-client ingestion volume, edge inspection latency, quota consumption, and
                API key kill-switches.
              </p>
            </div>
          </section>

          {tenants.length > 0 ? (
            <section className="grid gap-4 lg:grid-cols-2">
              {tenants.map((tenant) => (
                <article
                  className="flex flex-col justify-between border border-border bg-card p-5"
                  key={tenant.id}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-base font-semibold">{tenant.name}</h2>
                      <span
                        className={`rounded-sm border px-2 py-0.5 text-[10px] font-semibold ${
                          tenant.status === "Active"
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-destructive/30 bg-destructive/10 text-destructive"
                        }`}
                      >
                        {tenant.status}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {tenant.primaryDomain}
                    </p>

                    <div className="mt-4 grid grid-cols-3 gap-2 border-y border-border py-3 text-xs">
                      <div>
                        <div className="text-[10px] text-muted-foreground">Edge Latency</div>
                        <div className="mt-0.5 font-display text-sm font-semibold text-success">
                          {tenant.avgLatencyMs} ms
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">Threats Blocked</div>
                        <div className="mt-0.5 font-display text-sm font-semibold text-primary">
                          {tenant.blockedThreats}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">SDK Status</div>
                        <div className="mt-0.5 text-xs font-medium">
                          {tenant.sdkVerified ? "Verified Live" : "Awaiting Ping"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          Plan Quota Usage ({tenant.planTier})
                        </span>
                        <span className="font-semibold">{tenant.quotaUsedPct}%</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(100, tenant.quotaUsedPct)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                    <Button
                      className="h-8 px-3 text-xs"
                      onClick={() => onRotateTenantKey(tenant.id)}
                      size="sm"
                      variant="outline"
                    >
                      <RefreshCw className="size-3.5" /> Rotate API Key
                    </Button>
                    <Button
                      className="h-8 px-3 text-xs"
                      onClick={() => onToggleTenantLockdown(tenant.id)}
                      size="sm"
                      variant={tenant.status === "Lockdown" ? "secondary" : "destructive"}
                    >
                      <LockKeyhole className="size-3.5" />{" "}
                      {tenant.status === "Lockdown" ? "Lift Lockdown" : "Emergency Kill-Switch"}
                    </Button>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <section className="border border-border bg-card px-6 py-12 text-center">
              <Activity className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No active tenant telemetry</p>
            </section>
          )}
        </>
      )}

      {/* 3. INTERNAL ACCESS CONTROL & STAFF AUDIT LOG (OUR-SIDE SECURITY) */}
      {activeNav === "Access Control & Audit" && (
        <>
          <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-success">
                <LockKeyhole className="size-3.5" />
                SparrowX Internal Security & Governance
              </div>
              <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">
                Access control & immutable audit log
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Protect our own operations side first—enforce strict staff access controls and audit
                every action across client tenants.
              </p>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <div className="border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Hardware FIDO2 / WebAuthn MFA</span>
                <Button
                  className="h-7 px-2.5 text-xs"
                  onClick={() => {
                    const next = !staffMfaEnforced;
                    setStaffMfaEnforced(next);
                    void onRecordAudit(
                      `Hardware WebAuthn MFA ${next ? "enforced" : "relaxed"} for SparrowX staff`,
                      "Internal Security Policy",
                      next ? "Info" : "Warning",
                    );
                  }}
                  size="sm"
                  variant={staffMfaEnforced ? "default" : "outline"}
                >
                  {staffMfaEnforced ? "Enforced" : "Optional"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Requires hardware security keys before any staff member can view or modify client
                subscriptions.
              </p>
            </div>

            <div className="border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Just-In-Time (JIT) Tenant Access</span>
                <Button
                  className="h-7 px-2.5 text-xs"
                  onClick={() => {
                    const next = !jitTenantApproval;
                    setJitTenantApproval(next);
                    void onRecordAudit(
                      `JIT Tenant Access ${next ? "enabled" : "disabled"}`,
                      "Internal Security Policy",
                      "Info",
                    );
                  }}
                  size="sm"
                  variant={jitTenantApproval ? "default" : "outline"}
                >
                  {jitTenantApproval ? "Active" : "Disabled"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Automatically expires staff access tokens to client workspaces after 30 minutes.
              </p>
            </div>

            <div className="border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Strict SOC IP Allowlisting</span>
                <Button
                  className="h-7 px-2.5 text-xs"
                  onClick={() => {
                    const next = !ipAllowlistStrict;
                    setIpAllowlistStrict(next);
                    void onRecordAudit(
                      `SOC IP Allowlist ${next ? "locked to VPN CIDR" : "opened"}`,
                      "Internal Security Policy",
                      next ? "Info" : "Warning",
                    );
                  }}
                  size="sm"
                  variant={ipAllowlistStrict ? "default" : "outline"}
                >
                  {ipAllowlistStrict ? "Locked" : "Open"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Restricts SparrowX Admin Command Center actions to verified corporate VPN CIDRs.
              </p>
            </div>
          </section>

          <section className="border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">Immutable Staff & Automation Audit Trail</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Every onboarding event, module change, API key rotation, and kill-switch action is
                recorded below.
              </p>
            </div>
            <div className="divide-y divide-border">
              {auditLogs.length > 0 ? (
                auditLogs.map((log) => (
                  <div
                    className="flex flex-col justify-between gap-2 px-5 py-3.5 text-xs sm:flex-row sm:items-center"
                    key={log.id}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${
                          log.severity === "Critical"
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : log.severity === "Warning"
                              ? "border-warning/30 bg-warning/10 text-warning"
                              : "border-info/30 bg-info/10 text-info"
                        }`}
                      >
                        {log.severity}
                      </span>
                      <span className="font-medium text-foreground">{log.action}</span>
                      <span className="text-muted-foreground">· Target: {log.target}</span>
                    </div>
                    <div className="text-muted-foreground">
                      {log.actor} ({log.role}) · {log.timestamp}
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-5 py-10 text-center text-xs text-muted-foreground">
                  No audit events recorded yet. Provision a client or toggle a security control to
                  see live audit logging.
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {showAdminPaymentModal && (
        <PaymentGatewayModal
          currentBalance={adminCreditBalance}
          neededCredits={adminPaymentCredits}
          tenantName="SparrowX Master SOC"
          onClose={() => {
            setShowAdminPaymentModal(false);
            setAdminPaymentCredits(undefined);
          }}
          onCreditsAdded={(newBal) => {
            setAdminCreditBalance(newBal);
            saveStoredCreditBalance(newBal);
          }}
          showToast={(msg) => emitEngineToast(msg)}
        />
      )}
    </div>
  );
}

export function PortalLoginScreen({
  tenants,
  backendSource,
  onUserAuthenticated,
  onRegisterAndLoginUser,
}: {
  tenants: ClientTenant[];
  backendSource: "supabase" | "offline";
  onUserAuthenticated: (user: AppUser) => void;
  onRegisterAndLoginUser: (input: {
    fullName: string;
    email: string;
    password: string;
    orgName: string;
    primaryDomain: string;
    planTier: PlanTier;
    enabledModules: ServiceModuleId[];
  }) => Promise<{ error?: string }>;
}) {
  const [viewStage, setViewStage] = useState<"landing" | "auth">("landing");
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  // Sign-In fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showForgotNotice, setShowForgotNotice] = useState(false);

  // Sign-Up / Client Self-Onboarding fields
  const [fullName, setFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [primaryDomain, setPrimaryDomain] = useState("");
  const [planTier, setPlanTier] = useState<PlanTier>("Growth");
  const [selectedModules, setSelectedModules] = useState<ServiceModuleId[]>([
    "web_security",
    "ai_shield",
  ]);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signupError, setSignupError] = useState("");

  // Instant Landing Page Checkout & Payment Gateway State
  const [showLandingPaymentModal, setShowLandingPaymentModal] = useState(false);
  const [landingNeededCredits, setLandingNeededCredits] = useState<number | undefined>(500);
  const [landingPaymentLabel, setLandingPaymentLabel] = useState<string>("SparrowX Builder Shield");
  const [landingCreditBalance, setLandingCreditBalance] = useState<number>(() =>
    getStoredCreditBalance(),
  );

  // Floating Island Navbar & Active Scrollspy State
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("free-scanner");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      const sections = ["free-scanner", "world-threats", "defense-grid", "pricing", "how-it-works"];
      const scrollPos = window.scrollY + 180;
      for (const sId of sections) {
        const el = document.getElementById(sId);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            setActiveSection(sId);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleModule = (id: ServiceModuleId) => {
    setSelectedModules((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((item) => item !== id)
          : prev
        : [...prev, id],
    );
  };

  const openAuthGateway = (targetMode: "signin" | "signup") => {
    setMode(targetMode);
    setLoginError("");
    setSignupError("");
    setViewStage("auth");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError("");
    setIsSigningIn(true);

    const result = await authenticateAppUserFromBackend(loginEmail.trim(), loginPassword);
    setIsSigningIn(false);

    if (!result.user) {
      setLoginError(
        result.error ??
          "Invalid email or password. Please verify your credentials or create a new account.",
      );
      return;
    }

    // Check emergency lockdown
    if (result.user.admin !== "yes" && result.user.tenantId) {
      const linkedTenant = tenants.find((t) => t.id === result.user?.tenantId);
      if (linkedTenant && linkedTenant.status === "Lockdown") {
        setLoginError(
          `Access Denied: Workspace ${linkedTenant.name} is currently under Emergency Lockdown by SparrowX Security Operations.`,
        );
        return;
      }
    }

    onUserAuthenticated(result.user);
  };

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    setSignupError("");
    if (!fullName.trim() || !signupEmail.trim() || !signupPassword) {
      setSignupError("Please provide your full name, work email address, and password.");
      return;
    }

    setIsSigningUp(true);
    const result = await onRegisterAndLoginUser({
      fullName: fullName.trim(),
      email: signupEmail.trim().toLowerCase(),
      password: signupPassword,
      orgName: orgName.trim(),
      primaryDomain: primaryDomain.trim(),
      planTier,
      enabledModules: selectedModules,
    });
    setIsSigningUp(false);

    if (result.error) {
      setSignupError(result.error);
    }
  };

  const modulePillars = [
    {
      id: "web_security" as ServiceModuleId,
      shortLabel: "Web & Edge WAF",
      title: "Web & API Edge Shield",
      desc: "Drop-in middleware blocking SQL injections, XSS payloads, SSRF probes, and malformed requests before they hit your application code.",
      badge: "Sub-2ms Edge Inspection",
      icon: Globe2,
      accent: "from-orange-500/20 to-amber-500/10 text-orange-400 border-orange-500/30",
      snippet: `app.use(sparrowx.waf({ mode: "block", ruleset: "owasp-strict" }));`,
    },
    {
      id: "ai_shield" as ServiceModuleId,
      shortLabel: "AI Agent Guardrails",
      title: "LLM & MCP Tool Firewall",
      desc: "Inspect prompt injections in a live sandbox, prevent system-prompt leakage, and gate dangerous AI agent tool executions.",
      badge: "AI Zero-Trust Sandbox",
      icon: Sparkles,
      accent: "from-purple-500/20 to-primary/10 text-purple-400 border-purple-500/30",
      snippet: `const safePrompt = await sparrowx.aiShield.inspect(userInput);`,
    },
    {
      id: "cloud_security" as ServiceModuleId,
      shortLabel: "SIEM & Firewall Export",
      title: "SIEM, MITRE Hunting & IP Export",
      desc: "Correlate telemetry across endpoints, map adversary TTPs to MITRE ATT&CK, and export 1-click iptables, UFW, or Cloudflare blocklists.",
      badge: "1-Click Rule Exporter",
      icon: Server,
      accent: "from-blue-500/20 to-cyan-500/10 text-blue-400 border-blue-500/30",
      snippet: `sparrowx export-firewall --format=cloudflare --severity=critical`,
    },
    {
      id: "compliance" as ServiceModuleId,
      shortLabel: "Live Ownership & Proof",
      title: "Live Connection Proof & Compliance",
      desc: "Verify domain ownership via DNS TXT / HTTP tokens, run live end-to-end diagnostic probes, and download cryptographic SOC certificates.",
      badge: "Verified Proof Center",
      icon: FileSearch,
      accent: "from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30",
      snippet: `TXT _sparrowx-verify.acme.io -> "spx-verify-live-9f8a7c..."`,
    },
  ];


  const renderAuthCard = () => (
    <div className="relative w-full">
      <div className="pointer-events-none absolute -inset-1.5 rounded-3xl bg-gradient-to-b from-primary/25 via-orange-500/10 to-emerald-500/5 blur-2xl opacity-80" />
      <div className="relative rounded-2xl bg-[#0A0A0A]/95 p-6 sm:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.95)] border border-[#222222] backdrop-blur-xl">
        {/* Top Full-Width 2-Tab Mode Switcher (Never Wraps) */}
        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-[#222222] bg-black p-1.5 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setLoginError("");
            }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              mode === "signin"
                ? "bg-gradient-to-r from-primary to-orange-500 text-white shadow-md shadow-primary/30"
                : "text-zinc-400 hover:text-white hover:bg-[#111111]"
            }`}
          >
            <LockKeyhole className="size-3.5 shrink-0" />
            <span>Sign In to Console</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setSignupError("");
            }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              mode === "signup"
                ? "bg-gradient-to-r from-primary to-orange-500 text-white shadow-md shadow-primary/30"
                : "text-zinc-400 hover:text-white hover:bg-[#111111]"
            }`}
          >
            <Sparkles className="size-3.5 shrink-0" />
            <span>Create Workspace</span>
          </button>
        </div>

        {/* Clean Identity Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#1F1F1F] pb-5">
          <div className="flex items-center gap-3.5">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/30 bg-gradient-to-br from-primary/20 to-black p-2 shadow-inner">
              <img src="/sparrowx-logo.png" alt="SparrowX" className="size-full object-contain" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
                {mode === "signin" ? "Welcome back to SparrowX" : "Launch Your Protected Workspace"}
              </h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                {mode === "signin"
                  ? "Authenticate to access your live SOC telemetry, SIEM rules, and SparrowX AI Brain."
                  : "Deploy autonomous Edge WAF, AI guardrails, and ownership verification in 60s."}
              </p>
            </div>
          </div>

          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-mono font-semibold text-emerald-400 shrink-0">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            TLS 1.3 VERIFIED
          </span>
        </div>

        {/* SIGN IN FORM */}
        {mode === "signin" ? (
          <form className="mt-6 space-y-4" onSubmit={handleSignIn}>
            <div>
              <label
                className="text-xs font-semibold text-zinc-200 block mb-2"
                htmlFor="login-email"
              >
                Work Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-500">
                  <Mail className="size-4" />
                </span>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="alex.rivera@acme.io"
                  className="h-11 w-full rounded-xl border border-[#262626] bg-black pl-10 pr-3.5 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-zinc-200" htmlFor="login-password">
                  Password
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotNotice(!showForgotNotice)}
                    className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                  <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">
                    • Hashed Credential
                  </span>
                </div>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-500">
                  <LockKeyhole className="size-4" />
                </span>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="h-11 w-full rounded-xl border border-[#262626] bg-black pl-10 pr-10 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-500 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {showForgotNotice && (
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 text-xs text-primary space-y-1.5">
                <div className="font-semibold flex items-center gap-1.5 text-white">
                  <ShieldCheck className="size-3.5 text-primary" />
                  <span>Password Reset Protocol</span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  To safeguard sovereign workloads, self-service automated password reset is disabled. Please contact your organization administrator or email <strong className="text-primary">security@sparrowx.net</strong> with your organization domain to verify identity and issue a secure temporary sign-in credential.
                </p>
              </div>
            )}

            {loginError && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-xs text-red-300 flex items-start gap-2.5">
                <ShieldAlert className="size-4 shrink-0 mt-0.5 text-red-400" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSigningIn}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-500 font-bold text-sm text-white shadow-[0_0_25px_rgba(240,90,40,0.35)] transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50 whitespace-nowrap px-4 cursor-pointer"
            >
              <ShieldCheck className="size-4 shrink-0" />
              <span>{isSigningIn ? "Authenticating Session..." : "Sign In to Command Center"}</span>
              <ArrowRight className="size-4 shrink-0" />
            </button>

            {/* Security Assurance Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3">
              {["Signed Session Token", "SparrowX AI Brain Ready", "Live Edge Telemetry"].map(
                (badge) => (
                  <div
                    key={badge}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-[#1C1C1C] bg-black/70 py-1.5 px-2 text-[10px] font-mono text-zinc-400"
                  >
                    <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                    <span className="truncate">{badge}</span>
                  </div>
                ),
              )}
            </div>

            <div className="pt-3 border-t border-[#1F1F1F] text-center text-xs text-zinc-400">
              Need protection for a new app or startup?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="font-bold text-primary hover:underline cursor-pointer"
              >
                Create your protected workspace →
              </button>
            </div>
          </form>
        ) : (
          /* CREATE ACCOUNT / ONBOARDING FORM */
          <form className="mt-5 space-y-4" onSubmit={handleSignUp}>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div>
                <label
                  className="text-xs font-semibold text-zinc-200 block mb-1.5"
                  htmlFor="signup-name"
                >
                  Full Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
                    <User className="size-3.5" />
                  </span>
                  <input
                    id="signup-name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Rivera"
                    className="h-10 w-full rounded-xl border border-[#262626] bg-black pl-9 pr-3 text-xs text-white outline-none transition-all placeholder:text-zinc-600 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label
                  className="text-xs font-semibold text-zinc-200 block mb-1.5"
                  htmlFor="signup-email"
                >
                  Work Email
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
                    <Mail className="size-3.5" />
                  </span>
                  <input
                    id="signup-email"
                    type="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="alex@acme.io"
                    className="h-10 w-full rounded-xl border border-[#262626] bg-black pl-9 pr-3 text-xs text-white outline-none transition-all placeholder:text-zinc-600 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            <div>
              <label
                className="text-xs font-semibold text-zinc-200 block mb-1.5"
                htmlFor="signup-password"
              >
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
                  <LockKeyhole className="size-3.5" />
                </span>
                <input
                  id="signup-password"
                  type={showSignupPassword ? "text" : "password"}
                  required
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="h-10 w-full rounded-xl border border-[#262626] bg-black pl-9 pr-9 text-xs text-white outline-none transition-all placeholder:text-zinc-600 focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-white cursor-pointer"
                >
                  {showSignupPassword ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Optional Service Target */}
            <div className="rounded-xl border border-[#1F1F1F] bg-black/70 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                  First Asset to Protect (Optional)
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">Can also register later</span>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div>
                  <input
                    id="signup-org"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Service Name (e.g. Acme API)"
                    className="h-9 w-full rounded-lg border border-[#262626] bg-black px-3 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-primary"
                  />
                </div>
                <div>
                  <input
                    id="signup-domain"
                    value={primaryDomain}
                    onChange={(e) => setPrimaryDomain(e.target.value)}
                    placeholder="Domain (https://api.acme.io)"
                    className="h-9 w-full rounded-lg border border-[#262626] bg-black px-3 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-primary"
                  />
                </div>
              </div>
            </div>

            {/* Plan Tier Selection */}
            <div>
              <label
                className="text-xs font-semibold text-zinc-200 block mb-1.5"
                htmlFor="signup-plan"
              >
                Protection Tier
              </label>
              <select
                id="signup-plan"
                value={planTier}
                onChange={(e) => setPlanTier(e.target.value as PlanTier)}
                className="h-10 w-full rounded-xl border border-[#262626] bg-black px-3 text-xs text-white outline-none focus:border-primary"
              >
                <option value="Starter">Starter — Indie Builders & Early Prototypes</option>
                <option value="Growth">Growth — Startups & Production Apps</option>
                <option value="Enterprise">Enterprise — Multi-Cluster SOC & Dedicated SLA</option>
              </select>
            </div>

            {/* Modular Protection Selection */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-200 mb-1.5">
                <span>Active Defense Modules</span>
                <span className="text-[10px] font-mono text-primary">
                  Customizes your workspace
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {SERVICE_MODULES.map((mod) => {
                  const checked = selectedModules.includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => toggleModule(mod.id)}
                      className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                        checked
                          ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(240,90,40,0.12)] ring-1 ring-primary/30"
                          : "border-[#262626] bg-black hover:border-zinc-700"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded border text-[10px] transition-all ${
                          checked
                            ? "border-primary bg-primary text-white"
                            : "border-zinc-700 bg-zinc-900"
                        }`}
                      >
                        {checked && <Check className="size-3" />}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {mod.shortLabel}
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate">{mod.title}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {signupError && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-xs text-red-300 flex items-start gap-2.5">
                <ShieldAlert className="size-4 shrink-0 mt-0.5 text-red-400" />
                <span>{signupError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSigningUp}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-500 font-bold text-sm text-white shadow-[0_0_25px_rgba(240,90,40,0.35)] transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50 whitespace-nowrap px-4 cursor-pointer"
            >
              <Sparkles className="size-4 shrink-0" />
              <span>
                {isSigningUp ? "Provisioning SOC Workspace..." : "Create Account & Launch Shield"}
              </span>
              <ArrowRight className="size-4 shrink-0" />
            </button>

            <div className="pt-3 border-t border-[#1F1F1F] text-center text-xs text-zinc-400">
              Already have a workspace?{" "}
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="font-bold text-primary hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative min-h-svh w-full bg-black text-white selection:bg-primary/30 selection:text-white overflow-x-hidden font-sans">
      {/* Subtle Matrix / Tactical Grid Overlay */}
      <div className="pointer-events-none fixed inset-0 vibe-subtle-grid z-0 opacity-45" />

      {/* Atmospheric Ambient Light Flares */}
      <div className="pointer-events-none fixed -top-48 -left-40 size-[480px] rounded-full bg-primary/15 blur-[160px] z-0" />
      <div className="pointer-events-none fixed top-1/3 -right-48 size-[440px] rounded-full bg-emerald-500/10 blur-[170px] z-0" />
      <div className="pointer-events-none fixed bottom-0 left-1/3 size-[380px] rounded-full bg-blue-500/10 blur-[160px] z-0" />

      {/* Top Floating Cyber-Dock Navigation Bar */}
      <header
        className={`sticky top-0 z-50 w-full transition-all duration-300 ${
          scrolled ? "py-2 sm:py-2.5" : "py-3 sm:py-4"
        }`}
      >
        <div className="mx-auto max-w-7xl px-3 sm:px-6">
          <div
            className={`relative flex items-center justify-between gap-3 sm:gap-4 rounded-2xl md:rounded-full border transition-all duration-300 ${
              scrolled
                ? "border-primary/30 bg-[#07080C]/90 shadow-[0_12px_40px_rgba(0,0,0,0.85),0_0_20px_rgba(249,115,22,0.12)] backdrop-blur-2xl px-3.5 py-2 sm:px-5"
                : "border-white/10 bg-[#090A0F]/80 shadow-[0_8px_32px_rgba(0,0,0,0.65)] backdrop-blur-xl px-3.5 py-2.5 sm:px-6"
            }`}
          >
            {/* Ambient Top Hairline Shimmer */}
            <div className="pointer-events-none absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <div className="pointer-events-none absolute -bottom-px left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

            {/* Left Brand Logo */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setViewStage("landing");
                  setMobileNavOpen(false);
                }}
                className="group flex items-center gap-2.5 text-left focus:outline-none"
              >
                <div className="relative grid size-9 place-items-center rounded-xl bg-gradient-to-br from-zinc-900 to-black border border-white/15 p-1 text-white shadow-inner overflow-hidden shrink-0 group-hover:border-primary/60 group-hover:shadow-[0_0_15px_rgba(249,115,22,0.35)] transition-all">
                  <img
                    src="/sparrowx-logo.png"
                    alt="SparrowX Logo"
                    className="size-full object-contain group-hover:scale-105 transition-transform duration-200"
                  />
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span className="font-display text-base font-extrabold tracking-tight text-white group-hover:text-zinc-100 transition-colors">
                    sparrow<span className="text-primary group-hover:text-orange-400">x</span>
                  </span>
                </div>
              </button>

              {/* Live SOC Edge Status Pill (Visible on Desktop) */}
              <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.03] px-2.5 py-1 text-[11px] font-mono text-zinc-400 shadow-xs">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-zinc-300 font-medium">SHIELD ACTIVE</span>
                <span className="text-zinc-600">·</span>
                <span className="text-emerald-400/90 font-bold">0.8ms WAF</span>
              </div>
            </div>

            {/* Center Quick Navigation Links (Capsule Cyber Dock) */}
            {viewStage === "landing" && (
              <nav className="hidden md:flex items-center gap-1 lg:gap-1.5 rounded-full border border-white/5 bg-white/[0.03] p-1 text-xs font-medium text-zinc-400 shadow-inner backdrop-blur-md">
                <a
                  href="#free-scanner"
                  onClick={() => setActiveSection("free-scanner")}
                  className={`group relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-all ${
                    activeSection === "free-scanner"
                      ? "border border-primary/40 bg-gradient-to-r from-primary/25 via-orange-500/20 to-amber-500/25 text-orange-300 shadow-[0_0_12px_rgba(249,115,22,0.3)] font-semibold"
                      : "border border-primary/25 bg-primary/10 text-primary hover:border-primary/50 hover:bg-primary/20 hover:text-orange-200"
                  }`}
                >
                  <Sparkles className="size-3 text-primary animate-pulse" />
                  <span>Free Scanner</span>
                  <span className="rounded-full bg-primary/30 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-orange-200">
                    Live
                  </span>
                </a>

                <a
                  href="#world-threats"
                  onClick={() => setActiveSection("world-threats")}
                  className={`group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all hover:bg-white/[0.08] hover:text-white ${
                    activeSection === "world-threats"
                      ? "bg-white/[0.1] text-white font-semibold shadow-xs"
                      : "text-zinc-400"
                  }`}
                >
                  <ShieldAlert className="size-3.5 text-zinc-400 group-hover:text-primary transition-colors" />
                  <span>Threats We Stop</span>
                  <span className="hidden xl:inline-block text-[10px] text-zinc-500 font-mono">40+</span>
                </a>

                <a
                  href="#defense-grid"
                  onClick={() => setActiveSection("defense-grid")}
                  className={`group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all hover:bg-white/[0.08] hover:text-white ${
                    activeSection === "defense-grid"
                      ? "bg-white/[0.1] text-white font-semibold shadow-xs"
                      : "text-zinc-400"
                  }`}
                >
                  <Globe2 className="size-3.5 text-zinc-400 group-hover:text-primary transition-colors" />
                  <span>What We Do</span>
                </a>

                <a
                  href="#pricing"
                  onClick={() => setActiveSection("pricing")}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition-all hover:bg-white/[0.08] hover:text-white ${
                    activeSection === "pricing"
                      ? "bg-white/[0.1] text-white font-semibold shadow-xs"
                      : "text-zinc-400"
                  }`}
                >
                  <span>Contact Us</span>
                </a>

                <a
                  href="#how-it-works"
                  onClick={() => setActiveSection("how-it-works")}
                  className={`group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all hover:bg-white/[0.08] hover:text-white ${
                    activeSection === "how-it-works"
                      ? "bg-white/[0.1] text-white font-semibold shadow-xs"
                      : "text-zinc-400"
                  }`}
                >
                  <Zap className="size-3.5 text-zinc-400 group-hover:text-amber-400 transition-colors" />
                  <span>Onboarding</span>
                  <span className="hidden xl:inline-block rounded-md border border-white/10 bg-white/5 px-1 py-0.2 text-[9px] text-zinc-400 font-mono">
                    60s
                  </span>
                </a>
              </nav>
            )}

            {/* Right Action CTAs & Mobile Toggle */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {/* Real-time Threat Defense Counter (Ultra-wide screens) */}
              {viewStage === "landing" && (
                <div className="hidden 2xl:flex items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.02] px-2.5 py-1 text-[11px] font-mono text-zinc-400">
                  <ShieldCheck className="size-3.5 text-primary" />
                  <span className="text-zinc-200 font-bold">{protectedCounter.toLocaleString()}</span>
                  <span className="text-zinc-500">deflected</span>
                </div>
              )}

              {viewStage === "auth" ? (
                <button
                  type="button"
                  onClick={() => setViewStage("landing")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-zinc-200 transition-all hover:border-white/30 hover:text-white whitespace-nowrap"
                >
                  <span>← Back to Landing Page</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileNavOpen(false);
                      openAuthGateway("signin");
                    }}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-zinc-200 transition-all hover:border-white/30 hover:bg-white/[0.08] hover:text-white whitespace-nowrap shadow-xs"
                  >
                    <LockKeyhole className="size-3.5 text-primary group-hover:text-orange-400 group-hover:rotate-[-6deg] transition-transform duration-200" />
                    <span>Sign In</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileNavOpen(false);
                      openAuthGateway("signup");
                    }}
                    className="relative group inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-gradient-to-r from-primary via-orange-500 to-amber-500 px-3.5 py-1.5 sm:px-5 sm:py-2 text-xs font-bold text-white shadow-[0_0_20px_rgba(249,115,22,0.35)] transition-all hover:shadow-[0_0_28px_rgba(249,115,22,0.65)] hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap overflow-hidden"
                  >
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                    <Shield className="size-3.5 text-white shrink-0 group-hover:scale-110 transition-transform" />
                    <span>Get Protected</span>
                    <ArrowRight className="size-3.5 text-white/90 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </>
              )}

              {/* Mobile Menu Hamburger Toggle */}
              {viewStage === "landing" && (
                <button
                  type="button"
                  onClick={() => setMobileNavOpen((prev) => !prev)}
                  className="md:hidden flex size-8.5 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-300 hover:text-white hover:border-white/25 hover:bg-white/[0.1] transition-all"
                  aria-label="Toggle navigation menu"
                >
                  {mobileNavOpen ? <X className="size-4 text-primary" /> : <Menu className="size-4" />}
                </button>
              )}
            </div>
          </div>

          {/* Creative Mobile Dropdown Menu Drawer */}
          {viewStage === "landing" && mobileNavOpen && (
            <div className="md:hidden mt-2 rounded-2xl border border-white/15 bg-[#090A0E]/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
              {/* Live Status Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-xs font-bold text-white">SPARROWX CYBER MESH</span>
                </div>
                <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">
                  0.8ms WAF ACTIVE
                </span>
              </div>

              {/* Links List */}
              <div className="space-y-1">
                <a
                  href="#free-scanner"
                  onClick={() => {
                    setActiveSection("free-scanner");
                    setMobileNavOpen(false);
                  }}
                  className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-xs font-semibold text-orange-300 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="size-4 text-primary" />
                    <div>
                      <div>Free Vulnerability Scanner</div>
                      <div className="text-[10px] font-normal text-zinc-400">Instant OWASP & LLM threat probe</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-primary/30 px-2 py-0.5 text-[9px] font-bold uppercase text-primary">
                    Live
                  </span>
                </a>

                <a
                  href="#world-threats"
                  onClick={() => {
                    setActiveSection("world-threats");
                    setMobileNavOpen(false);
                  }}
                  className="flex items-center justify-between rounded-xl px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="size-4 text-zinc-400" />
                    <span>Threats We Stop</span>
                  </div>
                  <span className="font-mono text-[10px] text-zinc-500">40+ Vectors</span>
                </a>

                <a
                  href="#defense-grid"
                  onClick={() => {
                    setActiveSection("defense-grid");
                    setMobileNavOpen(false);
                  }}
                  className="flex items-center justify-between rounded-xl px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Globe2 className="size-4 text-zinc-400" />
                    <span>What We Do</span>
                  </div>
                  <ChevronRight className="size-3.5 text-zinc-600" />
                </a>

                <a
                  href="#pricing"
                  onClick={() => {
                    setActiveSection("pricing");
                    setMobileNavOpen(false);
                  }}
                  className="flex items-center justify-between rounded-xl px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="size-4 text-zinc-400" />
                    <span>Pricing & Plans</span>
                  </div>
                  <ChevronRight className="size-3.5 text-zinc-600" />
                </a>

                <a
                  href="#how-it-works"
                  onClick={() => {
                    setActiveSection("how-it-works");
                    setMobileNavOpen(false);
                  }}
                  className="flex items-center justify-between rounded-xl px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Zap className="size-4 text-zinc-400" />
                    <span>Onboarding Guide</span>
                  </div>
                  <span className="font-mono text-[10px] text-zinc-500">60s Setup</span>
                </a>
              </div>

              {/* Mobile Quick CTAs */}
              <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false);
                    openAuthGateway("signin");
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 py-2 text-xs font-semibold text-zinc-200"
                >
                  <LockKeyhole className="size-3.5 text-primary" />
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false);
                    openAuthGateway("signup");
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-orange-500 py-2 text-xs font-bold text-white shadow-md shadow-primary/25"
                >
                  <Shield className="size-3.5" />
                  <span>Get Protected</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* STAGE 1: DEDICATED AUTHENTICATION GATEWAY */}
      {viewStage === "auth" ? (
        <main className="relative z-10 mx-auto max-w-6xl px-4 sm:px-8 py-10 lg:py-16">
          <div className="grid gap-10 lg:grid-cols-12 items-center">
            {/* Left 5 Cols: High-Trust Live SOC Command Telemetry Preview */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-[1.12]">
                  Step inside your live{" "}
                  <span className="bg-gradient-to-r from-primary via-orange-400 to-amber-300 bg-clip-text text-transparent">
                    cyber command center.
                  </span>
                </h1>
                <p className="mt-3 text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  Every SparrowX workspace connects directly to real-time Edge WAF inspection,
                  SparrowX AI Brain predictive blocking, DNS/HTTP ownership verification, and live
                  incident response playbooks.
                </p>
              </div>

              {/* Live Subsystem Handshake Status Card */}
              <div className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-4 space-y-3 shadow-xl">
                <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-2.5">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-300">
                    SparrowX Defense Mesh Status
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold text-emerald-400">
                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    ALL NODES OPERATIONAL
                  </span>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  {[
                    {
                      sys: "Edge WAF & AST SQLi/XSS Engine",
                      state: "ACTIVE · <1.4ms",
                      color: "text-emerald-400",
                    },
                    {
                      sys: "SparrowX AI Brain Predictive Blocker",
                      state: "ONLINE · LEARNING",
                      color: "text-primary",
                    },
                    {
                      sys: "DNS TXT & HTTP Ownership Verifier",
                      state: "READY · CRYPTO-PROVEN",
                      color: "text-emerald-400",
                    },
                  ].map((row) => (
                    <div
                      key={row.sys}
                      className="flex items-center justify-between rounded-lg border border-[#181818] bg-black px-3 py-2"
                    >
                      <span className="text-zinc-300 text-[11px] truncate">{row.sys}</span>
                      <span className={`text-[10px] font-bold shrink-0 ${row.color}`}>
                        {row.state}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3 Architecture Guarantees */}
              <div className="space-y-2.5">
                {[
                  {
                    icon: Globe2,
                    title: "Real-Time Attack Interception",
                    desc: "Stop SQLi, XSS, SSRF, and LLM jailbreaks at the edge before they execute.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Cryptographic Ownership & Health Proof",
                    desc: "Verify your domains via DNS TXT or HTTP challenge files with live probes.",
                  },
                  {
                    icon: Terminal,
                    title: "1-Click Firewall Blocklist Export",
                    desc: "Export production Cloudflare, UFW, and iptables drop rules from live incidents.",
                  },
                ].map((item) => {
                  const IconComp = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="flex items-start gap-3.5 rounded-xl border border-[#1F1F1F] bg-[#0A0A0A]/90 p-3.5 transition-colors hover:border-zinc-700"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary mt-0.5">
                        <IconComp className="size-4" />
                      </span>
                      <div>
                        <div className="text-xs font-bold text-white">{item.title}</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                          {item.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 7 Cols: Auth Card */}
            <div className="lg:col-span-7">{renderAuthCard()}</div>
          </div>
        </main>
      ) : (
        /* STAGE 2: EYE-CATCHING ANIMATED CYBER DEFENSE STARTUP LANDING PAGE */
        <main className="relative z-10">
          {/* TOP FIRST: LIVE PUBLIC DOMAIN & API VULNERABILITY SCANNER (FIRST THING VISITORS SEE & USE) */}
          <section id="free-scanner" className="mx-auto max-w-7xl px-4 sm:px-8 pt-6 pb-2 sm:pt-8 sm:pb-3 scroll-mt-24">
            <LandingLiveSecurityScanner
              onClaimAndProtectDomain={(domain, suggestedOrgName) => {
                setPrimaryDomain(domain);
                setOrgName(suggestedOrgName);
                openAuthGateway("signup");
              }}
              onOpenInstantCheckout={(neededCredits, domain) => {
                setLandingNeededCredits(neededCredits);
                if (domain) {
                  setPrimaryDomain(`https://${domain}`);
                  setLandingPaymentLabel(`SparrowX Shield — ${domain}`);
                }
                setShowLandingPaymentModal(true);
              }}
            />
          </section>

          {/* HERO SECTION */}
          <section className="mx-auto max-w-7xl px-4 sm:px-8 pt-6 pb-14 lg:pt-10 lg:pb-20">
            <div className="grid gap-10 lg:grid-cols-12 items-center">
              {/* Hero Left: Startup Story & High-Impact Value Proposition */}
              <div className="lg:col-span-6 space-y-6">
                <h1 className="text-3xl sm:text-5xl lg:text-[52px] font-extrabold tracking-tight text-white leading-[1.08]">
                  The threat world never sleeps.{" "}
                  <span className="bg-gradient-to-r from-primary via-orange-400 to-amber-300 bg-clip-text text-transparent">
                    Neither does your shield.
                  </span>
                </h1>

                <p className="text-sm sm:text-base leading-relaxed text-zinc-300 max-w-xl">
                  Every minute, automated botnets, zero-day scanners, and AI prompt-injection
                  payloads hammer modern web apps and startups. Legacy security vendors charge six
                  figures and hide behind sales calls.{" "}
                  <strong className="text-white font-semibold">
                    We built SparrowX as a security startup for the rest of us
                  </strong>
                  —giving every developer, founder, and growing team an enterprise-grade autonomous
                  SOC in 60 seconds.
                </p>

                {/* Primary Hero CTAs */}
                <div className="flex flex-wrap items-center gap-3.5 pt-1">
                  <button
                    type="button"
                    onClick={() => openAuthGateway("signup")}
                    className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-primary to-orange-500 px-6 py-3.5 text-sm font-bold text-white shadow-[0_0_30px_rgba(240,90,40,0.35)] transition-all hover:opacity-95 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <Shield className="size-4" />
                    <span>Protect My App in 60s</span>
                    <ArrowRight className="size-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => openAuthGateway("signin")}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#262626] bg-[#0A0A0A] px-5 py-3.5 text-sm font-semibold text-white transition-all hover:border-zinc-600 hover:bg-zinc-900"
                  >
                    <LockKeyhole className="size-4 text-primary" />
                    <span>Sign In to SOC Console</span>
                  </button>
                </div>
              </div>

              {/* Hero Right: Sovereign Tenant Architecture & Live Verification Hub (No fake counters or simulated attacks) */}
              <div id="sovereign-architecture" className="lg:col-span-6">
                <div className="relative rounded-2xl border border-[#262626] bg-[#0A0A0A] p-5 sm:p-6 shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden space-y-4">
                  {/* Top Status Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F1F1F] pb-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex size-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full size-2.5 bg-emerald-400" />
                      </span>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-white">
                          Sovereign Protection Engine
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400">
                          Architecture Status: <strong className="text-emerald-400">Isolated & Online</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400">
                        100% Real-Time
                      </span>
                    </div>
                  </div>

                  {/* 4 Sovereign Defense Capabilities */}
                  <div className="grid gap-2.5">
                    <div className="rounded-xl border border-[#1F1F1F] bg-black/60 p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <Database className="size-3.5 text-primary" />
                        <span className="text-xs font-bold text-white">Dedicated Database Partitions</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed pl-5.5">
                        Each customer dashboard operates in its own isolated database partition (<code className="text-primary font-mono text-[10px]">spx_db_*</code>). Zero cross-tenant data exposure.
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#1F1F1F] bg-black/60 p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <Globe2 className="size-3.5 text-emerald-400" />
                        <span className="text-xs font-bold text-white">Single-Line HTML & VPS Connectors</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed pl-5.5">
                        Drop our single script into your website HTML profile or run the one-line curl agent on your VPS server to connect telemetry in under 60 seconds.
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#1F1F1F] bg-black/60 p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="size-3.5 text-primary" />
                        <span className="text-xs font-bold text-white">Authoritative Anycast DNS Verification</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed pl-5.5">
                        Every domain scan executes authentic live SparrowX Anycast DNS queries, SSL certificate handshakes, and OWASP security header audits without simulated metrics.
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#1F1F1F] bg-black/60 p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <Brain className="size-3.5 text-emerald-400" />
                        <span className="text-xs font-bold text-white">SparrowX AI Threat Intelligence Core</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed pl-5.5">
                        Autonomous edge filtering and AI prompt sanitization powered by SparrowX AI Autonomous Neural Engine with administrator-only access control.
                      </p>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1F1F1F]">
                    <a
                      href="#public-scanner"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-300 hover:text-white"
                    >
                      <Search className="size-3.5 text-primary" />
                      <span>Use Public Domain Scanner</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => openAuthGateway("signup")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-black hover:opacity-95 cursor-pointer shadow-sm"
                    >
                      <span>Connect Your Domain</span>
                      <ArrowUpRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CONTINUOUS ANIMATED THREAT TICKER MARQUEE */}
          <div className="border-y border-[#1F1F1F] bg-[#070707] py-2.5 overflow-hidden">
            <div className="flex w-max animate-spx-marquee items-center gap-3 text-xs font-sans">
              {[
                {
                  variant: "zap" as CyberEmblemVariant,
                  title: "SQL Injection Exfiltration",
                  action: "Blocked at Edge",
                  actionClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
                },
                {
                  variant: "brain" as CyberEmblemVariant,
                  title: "LLM System Prompt Extraction",
                  action: "Sanitized",
                  actionClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/25",
                },
                {
                  variant: "lock" as CyberEmblemVariant,
                  title: "DNS & HTTP Ownership Proof",
                  action: "Cryptographically Verified",
                  actionClass: "bg-primary/10 text-primary border-primary/25",
                },
                {
                  variant: "siren" as CyberEmblemVariant,
                  title: "Botnet Credential Stuffing Wave",
                  action: "ASN Quarantined",
                  actionClass: "bg-rose-500/10 text-rose-400 border-rose-500/25",
                },
                {
                  variant: "dna" as CyberEmblemVariant,
                  title: "MITRE ATT&CK TTP Correlation",
                  action: "Live SIEM Telemetry",
                  actionClass: "bg-blue-500/10 text-blue-400 border-blue-500/25",
                },
                {
                  variant: "gear" as CyberEmblemVariant,
                  title: "Cloudflare & iptables Dynamic Export",
                  action: "1-Click Sync",
                  actionClass: "bg-zinc-800 text-zinc-300 border-zinc-700",
                },
                {
                  variant: "warning" as CyberEmblemVariant,
                  title: "SSRF & Metadata Credential Harvest",
                  action: "Intercepted",
                  actionClass: "bg-amber-500/10 text-amber-400 border-amber-500/25",
                },
                {
                  variant: "shield" as CyberEmblemVariant,
                  title: "MCP AI Tool Execution Guardrails",
                  action: "Zero-Trust Enforced",
                  actionClass: "bg-purple-500/10 text-purple-400 border-purple-500/25",
                },
                // Duplicate items for seamless infinite marquee loop
                {
                  variant: "zap" as CyberEmblemVariant,
                  title: "SQL Injection Exfiltration",
                  action: "Blocked at Edge",
                  actionClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
                },
                {
                  variant: "brain" as CyberEmblemVariant,
                  title: "LLM System Prompt Extraction",
                  action: "Sanitized",
                  actionClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/25",
                },
                {
                  variant: "lock" as CyberEmblemVariant,
                  title: "DNS & HTTP Ownership Proof",
                  action: "Cryptographically Verified",
                  actionClass: "bg-primary/10 text-primary border-primary/25",
                },
                {
                  variant: "siren" as CyberEmblemVariant,
                  title: "Botnet Credential Stuffing Wave",
                  action: "ASN Quarantined",
                  actionClass: "bg-rose-500/10 text-rose-400 border-rose-500/25",
                },
                {
                  variant: "dna" as CyberEmblemVariant,
                  title: "MITRE ATT&CK TTP Correlation",
                  action: "Live SIEM Telemetry",
                  actionClass: "bg-blue-500/10 text-blue-400 border-blue-500/25",
                },
              ].map((item, index) => (
                <CyberPill
                  key={index}
                  variant={item.variant}
                  title={item.title}
                  action={item.action}
                  actionClass={item.actionClass}
                />
              ))}
            </div>
          </div>

          {/* STARTUP MISSION SECTION: WHAT WE DO, WHY WE EXIST & WORLD THREATS WE STOP */}
          <section id="startup-mission" className="mx-auto max-w-7xl px-4 sm:px-8 py-16 lg:py-20">
            <div className="max-w-3xl space-y-3">
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                What is SparrowX—and why did we build it?
              </h2>
              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
                The moment you launch a website, SaaS product, API, or AI app today, automated
                hacker scripts and AI botnets start probing it within minutes. Yet traditional
                cybersecurity companies charge $50,000+ a year and require a full-time security
                team.{" "}
                <strong className="text-white">
                  SparrowX is your autonomous 24/7 cyber defense engine
                </strong>{" "}
                that plugs into your app in 60 seconds, blocks real-world attacks before they touch
                your database or AI credits, and gives you cryptographic proof that your business is
                safe.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                {
                  step: "01 · WHY WE EXIST",
                  title: "Every Modern App Is a Target on Day One",
                  desc: "Hackers don't target only big banks anymore. They run automated bots that scan every new domain for exposed APIs, SQL injection holes, leaked env keys, and unprotected AI/LLM endpoints.",
                  highlight: "24/7 automated attack waves",
                },
                {
                  step: "02 · WHAT WE DO",
                  title: "An Autonomous SOC & Shield in 5 Lines of Code",
                  desc: "We combine four enterprise systems into one lightweight platform: an Edge Web Firewall (WAF), an AI Prompt & Token-Drain Shield, a MITRE ATT&CK Threat SIEM, and Automated Compliance Reporting.",
                  highlight: "Sub-2ms edge interception",
                },
                {
                  step: "03 · WHY TEAMS TRUST US",
                  title: "Real Cryptographic Proof—Never Fake Badges",
                  desc: "We don't just show pretty charts. SparrowX verifies your domain via DNS/HTTP challenges, runs live 7-point diagnostic probes, exports 1-click firewall rules, and issues auditor-ready SOC 2 / ISO certificates.",
                  highlight: "Verified live protection",
                },
              ].map((card) => (
                <div
                  key={card.step}
                  className="group rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-6 transition-all hover:border-primary/50 hover:shadow-[0_0_30px_rgba(240,90,40,0.12)]"
                >
                  <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-primary">
                    {card.step}
                  </div>
                  <h3 className="mt-2 text-lg font-bold text-white">{card.title}</h3>
                  <p className="mt-2 text-xs sm:text-sm text-zinc-400 leading-relaxed">
                    {card.desc}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#262626] bg-black px-2.5 py-1 text-[11px] font-mono text-zinc-300">
                    <CheckCircle2 className="size-3.5 text-emerald-400" />
                    <span>{card.highlight}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* WORLD THREAT MATRIX: THE 8 REAL-WORLD ATTACKS SPARROWX NEUTRALIZES */}
            <div id="world-threats" className="mt-16 pt-14 border-t border-[#1F1F1F] scroll-mt-24">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
                    GLOBAL THREAT INTELLIGENCE & ACTIVE DEFENSE MATRIX
                  </div>
                  <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                    What world threats does SparrowX protect you from?
                  </h2>
                  <p className="mt-2 text-xs sm:text-sm text-zinc-400 leading-relaxed">
                    Whether you run a Next.js SaaS, an e-commerce store, a fintech API, or an AI
                    agent, here are the exact real-world attacks SparrowX intercepts before they can
                    damage your business:
                  </p>
                </div>
                <a
                  href="#free-scanner"
                  className="inline-flex items-center gap-2 self-start md:self-auto rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-xs font-bold text-primary hover:bg-primary/20 transition-all"
                >
                  <Search className="size-3.5" />
                  <span>Check If Your Site Is Exposed</span>
                </a>
              </div>

              {/* Live Interactive 3D Cyber Threat Globe Interception Engine */}
              <div className="mt-8">
                <CyberThreatGlobe
                  height={500}
                  showControls={true}
                  showFeed={true}
                  showStats={true}
                  className="border-[#1F1F1F] bg-[#02050E]"
                />
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    code: "OWASP A03 · SQLi",
                    threat: "Database Theft & SQL Injection",
                    danger:
                      "Attackers inject SQL commands into forms or URLs to dump your entire user table, emails, password hashes, and billing data.",
                    defense:
                      "SparrowX Edge WAF parses query ASTs and drops malicious UNION/SELECT/DROP payloads in <2ms.",
                  },
                  {
                    code: "OWASP LLM01 · AI",
                    threat: "AI Prompt Injection & Jailbreaks",
                    danger:
                      "Malicious users trick your AI chatbot into revealing system prompts, leaking other customers' PII, or running rogue MCP tools.",
                    defense:
                      "Our AI Guardrail Sandbox sanitizes every prompt and blocks unauthorized tool calls before your LLM executes them.",
                  },
                  {
                    code: "OWASP LLM04 · API",
                    threat: "AI Token-Drain & Bill Bankruptcy",
                    danger:
                      "Automated bot scripts flood your AI model and LLM endpoints overnight, racking up thousands of dollars in API bills.",
                    defense:
                      "Autonomous velocity rate-limiting throttles abusive IPs and cuts off token-draining loops immediately.",
                  },
                  {
                    code: "MITRE T1110 · BOTNET",
                    threat: "Credential Stuffing & Account Takeover",
                    danger:
                      "Distributed proxy botnets test millions of leaked passwords against your /login route to hijack customer and admin accounts.",
                    defense:
                      "Detects brute-force bursts in real time and exports 1-click blocklists for Cloudflare, UFW, and iptables.",
                  },
                  {
                    code: "OWASP A03 · XSS",
                    threat: "Cross-Site Scripting & Cookie Theft",
                    danger:
                      "Attackers inject hidden JavaScript into inputs or URLs to hijack admin sessions and steal authentication tokens.",
                    defense:
                      "Enforces strict Content-Security-Policy (CSP) headers and neutralizes inline script injection at the edge.",
                  },
                  {
                    code: "OWASP A10 · SSRF",
                    threat: "SSRF & Cloud Key Harvesting",
                    danger:
                      "Hackers trick your webhooks or URL fetchers into reading internal cloud metadata (169.254.169.254) to steal AWS/GCP root keys.",
                    defense:
                      "Built-in SSRF and DNS-rebinding guards block private RFC 1918 and internal cloud metadata requests.",
                  },
                  {
                    code: "MITRE T1059 · RCE",
                    threat: "Zero-Day Command Injection & Scanners",
                    danger:
                      "Automated vulnerability scanners probe your servers 24/7 for unpatched CVEs, exposed .env files, and shell execution flaws.",
                    defense:
                      "Continuous CVE vulnerability tracking, server banner masking, and 1-click host isolation.",
                  },
                  {
                    code: "SOC 2 · ISO 27001",
                    threat: "Lost Enterprise Deals Due to No Compliance",
                    danger:
                      "Enterprise buyers refuse to sign contracts because you cannot prove active security monitoring, audit logs, or data protection.",
                    defense:
                      "Generates signed SOC 2 Type II, ISO 27001, and NIST readiness reports + a public Verified Protection Badge.",
                  },
                ].map((item) => (
                  <div
                    key={item.threat}
                    className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-5 flex flex-col justify-between hover:border-zinc-700 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-bold uppercase text-red-400 bg-red-500/10 border border-red-500/25 px-2 py-0.5 rounded">
                          {item.code}
                        </span>
                        <ShieldAlert className="size-4 text-red-400 shrink-0" />
                      </div>
                      <h3 className="mt-3 text-sm font-bold text-white">{item.threat}</h3>
                      <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">
                        <strong className="text-zinc-300">Without Protection:</strong> {item.danger}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-[#1F1F1F] text-xs text-emerald-300/90 leading-relaxed">
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-400 mb-0.5">
                        <ShieldCheck className="size-3.5 shrink-0" />
                        <span>How SparrowX Stops It:</span>
                      </div>
                      {item.defense}
                    </div>
                  </div>
                ))}
              </div>

              {/* BEFORE VS AFTER SPARROWX COMPARISON BANNER */}
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-red-500/25 bg-red-950/10 p-5">
                  <div className="text-xs font-mono font-bold uppercase text-red-400">
                    ✗ WITHOUT SPARROWX (EXPOSED STARTUP)
                  </div>
                  <ul className="mt-3 space-y-2 text-xs text-zinc-300">
                    <li>• Origin IP, API routes, and LLM endpoints directly exposed to botnets</li>
                    <li>• Zero visibility until a customer reports a breach or huge LLM inference bill</li>
                    <li>• Weeks lost filling out enterprise security &amp; SOC 2 questionnaires</li>
                    <li>• Legacy security vendors demanding $50,000/yr annual contracts</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-5">
                  <div className="text-xs font-mono font-bold uppercase text-emerald-400">
                    ✓ WITH SPARROWX (PROTECTED &amp; VERIFIED IN 60 SECONDS)
                  </div>
                  <ul className="mt-3 space-y-2 text-xs text-zinc-200">
                    <li>
                      • SQLi, XSS, SSRF, and AI prompt jailbreaks blocked at the edge in &lt;2ms
                    </li>
                    <li>
                      • Real-time SOC Command Center with Slack, Discord &amp; PagerDuty alerts
                    </li>
                    <li>
                      • 1-click Cloudflare, UFW &amp; iptables blocklists + SOC 2 / ISO reports
                    </li>
                    <li>
                      • Cryptographically verified Trust Badge that helps you close bigger deals
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 4 PILLARS OF AUTONOMOUS DEFENSE GRID */}
          <section
            id="defense-grid"
            className="border-t border-[#1F1F1F] bg-[#050505] py-16 lg:py-20 scroll-mt-24"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                    Four defense engines. One pitch-black command center.
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => openAuthGateway("signup")}
                  className="inline-flex items-center gap-2 self-start md:self-auto rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-zinc-200"
                >
                  <span>Select Your Modules & Launch</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>

              <div className="mt-10 grid gap-6 md:grid-cols-2">
                {modulePillars.map((mod) => {
                  const IconComp = mod.icon;
                  return (
                    <div
                      key={mod.id}
                      className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-6 transition-all hover:border-zinc-700 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className={`grid size-10 place-items-center rounded-xl border bg-gradient-to-br ${mod.accent}`}
                          >
                            <IconComp className="size-5" />
                          </span>
                          <span className="rounded-full border border-[#262626] bg-black px-3 py-1 text-[11px] font-mono text-zinc-300">
                            {mod.badge}
                          </span>
                        </div>
                        <h3 className="mt-4 text-lg font-bold text-white">{mod.title}</h3>
                        <p className="mt-1.5 text-xs sm:text-sm text-zinc-400 leading-relaxed">
                          {mod.desc}
                        </p>
                      </div>

                      <div className="mt-5 rounded-xl border border-[#1F1F1F] bg-black p-3 font-mono text-xs text-zinc-300 overflow-x-auto">
                        <span className="text-primary select-none">$ </span>
                        <code>{mod.snippet}</code>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* PUBLIC PRICING, PACKAGES & 24-HOUR DONE-FOR-YOU AUDIT */}
          <LandingPricingSection
            onSelectPlanAndSignup={(selectedTier, modules) => {
              setPlanTier(selectedTier);
              setSelectedModules(modules);
              openAuthGateway("signup");
            }}
            onOpenDirectPaymentModal={(credits, label) => {
              setLandingNeededCredits(credits);
              setLandingPaymentLabel(label);
              setShowLandingPaymentModal(true);
            }}
          />

          {/* VIRAL TRUST BADGE GENERATOR & AGENCY RESELLER PITCH */}
          <ViralTrustBadgeAndOutreachSection
            defaultDomain={
              primaryDomain ? primaryDomain.replace(/^https?:\/\//, "") : "your-startup.io"
            }
            tenants={tenants}
          />

          {/* 3-STEP 60-SECOND ONBOARDING + EMBEDDED WORKSPACE LAUNCHPAD */}
          <section id="how-it-works" className="mx-auto max-w-7xl px-4 sm:px-8 py-16 lg:py-20 scroll-mt-24">
            <div className="grid gap-10 lg:grid-cols-12 items-start">
              {/* Left 5 Cols: 3-Step Onboarding Flow */}
              <div className="lg:col-span-5 space-y-6">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Go from exposed to verified & protected in 3 steps.
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  You don&apos;t need to re-architect your stack. Create your workspace right here,
                  verify ownership of your domain or API, and drop in our lightweight SDK
                  middleware.
                </p>

                <div className="space-y-4">
                  {[
                    {
                      num: "1",
                      title: "Create Your Workspace & Choose Modules",
                      desc: "Pick Web Security, AI Shield, Cloud Endpoints, or Compliance modules tailored to your stack.",
                    },
                    {
                      num: "2",
                      title: "Prove Ownership & Connect Telemetry",
                      desc: "Verify your domain via DNS TXT or HTTP file and paste our 5-line Express, Next.js, Python, or Go middleware.",
                    },
                    {
                      num: "3",
                      title: "Monitor, Hunt & Block Threats Live",
                      desc: "Watch real-time telemetry, run end-to-end health probes, and export firewall blocklists from your SOC console.",
                    },
                  ].map((step) => (
                    <div
                      key={step.num}
                      className="flex items-start gap-3.5 rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-4"
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-xs font-black text-white">
                        {step.num}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-white">{step.title}</h3>
                        <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right 7 Cols: Embedded Auth / Workspace Launchpad */}
              <div className="lg:col-span-7">{renderAuthCard()}</div>
            </div>
          </section>

          {/* FOOTER */}
          <footer className="border-t border-[#1F1F1F] bg-black py-8 px-4 sm:px-8">
            <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
              <div className="flex items-center gap-2.5">
                <img src="/sparrowx-logo.png" alt="SparrowX" className="size-5 object-contain" />
                <span className="font-semibold text-zinc-300">SparrowX Cyber Defense</span>
                <span>
                  · Built to protect builders, startups, and enterprises from modern cyber attacks.
                </span>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => openAuthGateway("signin")}
                  className="hover:text-white transition-colors"
                >
                  Operator Sign In
                </button>
                <button
                  type="button"
                  onClick={() => openAuthGateway("signup")}
                  className="text-primary font-semibold hover:underline"
                >
                  Get Protected →
                </button>
              </div>
            </div>
          </footer>
        </main>
      )}

      {/* Instant Checkout Payment Modal on Landing Page */}
      {showLandingPaymentModal && (
        <PaymentGatewayModal
          currentBalance={landingCreditBalance}
          neededCredits={landingNeededCredits}
          tenantName={landingPaymentLabel}
          userEmail={signupEmail || loginEmail || undefined}
          onClose={() => {
            setShowLandingPaymentModal(false);
          }}
          onCreditsAdded={(newBal) => {
            setLandingCreditBalance(newBal);
            saveStoredCreditBalance(newBal);
            emitEngineToast(
              "Security Credits Added! Complete your workspace signup to activate protection.",
            );
          }}
          showToast={(msg) => emitEngineToast(msg)}
        />
      )}
    </div>
  );
}
