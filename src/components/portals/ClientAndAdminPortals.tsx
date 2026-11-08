import { emitEngineActivity, emitEngineToast } from "@/components/BackgroundEngineToaster";
import { useState, useEffect } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Brain,
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
import {
  SPARROWX_PLANS,
  getPlanById,
  getClientActiveSubscription,
  subscribeToPlan,
  type SparrowxPlan,
  type ClientSubscriptionRecord,
} from "@/lib/sparrowx-plans";
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

  const [activeSubscription, setActiveSubscription] = useState<ClientSubscriptionRecord>(() =>
    getClientActiveSubscription(activeTenant?.id),
  );
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<SparrowxPlan | null>(null);
  const [checkoutBillingCycle, setCheckoutBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<"card" | "wire" | "upi" | "binance">("card");
  const [billingCycleToggle, setBillingCycleToggle] = useState<"monthly" | "annual">("monthly");
  const [showCostArchitectureBreakdown, setShowCostArchitectureBreakdown] = useState(false);

  useEffect(() => {
    setActiveSubscription(getClientActiveSubscription(activeTenant?.id));
  }, [activeTenant?.id]);

  const handleSubscribeToPlan = (
    plan: SparrowxPlan,
    cycle: "monthly" | "annual" = "monthly",
    method = "Credit Card / Auto-Pay",
  ) => {
    const sub = subscribeToPlan(plan.id, cycle, method, activeTenant?.id);
    setActiveSubscription(sub);

    const price = cycle === "annual" ? plan.annualPriceMonthly * 12 : plan.monthlyPrice;
    const newTx = recordBillingTransaction(
      {
        type: "service_purchase",
        credits: 0,
        costUsd: price,
        title: `Subscription Activated: ${plan.name} (${cycle.toUpperCase()})`,
        description: `Plan activated with ${plan.maxDomains === -1 ? "unlimited" : plan.maxDomains} domain(s), ${plan.requestQuotaMonthly.toLocaleString()} req/mo quota, ${plan.sla}.`,
        paymentMethod: method,
      },
      activeTenant?.id,
      currentUser?.email,
    );
    setBillingTransactions((prev) => [newTx, ...prev]);

    if (activeTenant) {
      void onRenameOrUpdateTenant(activeTenant.id, { planTier: plan.name as PlanTier });
    }

    showToast(`Subscribed to ${plan.name} (${cycle})! Protection is active.`);
    setSelectedPlanForCheckout(null);
  };

  const clickedService = tenants.find((t) => t.id === clickedServiceId) ?? null;

  const getPlanPrice = (tier: PlanTier) => {
    const t = String(tier);
    if (t === "Developer Starter" || t === "Starter") return 29;
    if (t === "Startup Shield" || t === "Growth") return 79;
    if (t === "Business Pro") return 199;
    if (t === "AI Agent & LLM Shield" || t === "AI Agent Shield") return 399;
    if (t === "Enterprise Sovereign SOC" || t === "Enterprise SOC" || t === "Enterprise") return 799;
    if (t === "Hyperscale Defense & Custom Mesh" || t === "Hyperscale Defense") return 1499;
    return 79;
  };

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

    // Check active plan domain quota
    const plan = getPlanById(activeSubscription.planId);
    if (plan.maxDomains !== -1 && tenants.length >= plan.maxDomains) {
      showToast(
        `Plan domain limit reached (${tenants.length}/${plan.maxDomains}). Upgrade your plan to protect additional domains.`,
      );
      onNavigate("Billing & Credits");
      return;
    }

    await onCreateTenant({
      name: serviceName.trim(),
      contactEmail: currentUser?.email ?? "client@company.com",
      primaryDomain: primaryDomain.trim(),
      planTier,
      enabledModules: selectedModules,
    });

    showToast(
      `Successfully provisioned ${serviceName.trim()} under your ${plan.name} subscription!`,
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
      activeNav === "Plans & Subscriptions" ||
      activeNav === "Profile Management"
        ? activeNav === "Plans & Subscriptions"
          ? "Billing & Credits"
          : activeNav
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
              onClick={() => onNavigate("Billing & Credits")}
              className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-all shadow-sm cursor-pointer"
              type="button"
              title="Click to view all 6 plans or switch subscriptions"
            >
              <ShieldCheck className="size-3.5 text-emerald-400" />
              <span>Plan: {activeSubscription.planName}</span>
              <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary font-mono font-bold">
                ${activeSubscription.priceUsd}/mo
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
            {
              label: "Plans & Subscriptions",
              icon: ShieldCheck,
              targetNav: "Billing & Credits",
              count: "6 Plans",
            },
            { label: "Profile Management", icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const active =
              currentAreaTab === tab.label ||
              (currentAreaTab === "Billing & Credits" && tab.label === "Plans & Subscriptions");
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
                  const plan = getPlanById(activeSubscription.planId);
                  const isLimitReached = plan.maxDomains !== -1 && tenants.length >= plan.maxDomains;

                  return (
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border pt-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Active Subscription:</span>
                        <span className="font-semibold text-primary">
                          {plan.name} (${activeSubscription.priceUsd}/mo)
                        </span>
                        <span className="text-muted-foreground">· Domain Allocation:</span>
                        <span
                          className={`font-mono font-bold ${isLimitReached ? "text-amber-400" : "text-emerald-400"}`}
                        >
                          {tenants.length} / {plan.maxDomains === -1 ? "Unlimited" : plan.maxDomains} Domains Used
                        </span>
                        {isLimitReached && (
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-400">
                            Domain Quota Reached
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
                        {isLimitReached ? (
                          <Button
                            onClick={() => {
                              setShowAddServiceForm(false);
                              onNavigate("Billing & Credits");
                            }}
                            size="sm"
                            type="button"
                            className="bg-primary text-primary-foreground font-semibold"
                          >
                            <ShieldCheck className="size-3.5 mr-1" /> Upgrade Plan to Add More
                          </Button>
                        ) : (
                          <Button size="sm" type="submit" className="bg-primary text-primary-foreground font-semibold">
                            <Plus className="size-3.5 mr-1" /> Provision & Protect Service
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
                          <option value="Developer Starter">Developer Starter ($29/mo)</option>
                          <option value="Startup Shield">Startup Shield ($79/mo)</option>
                          <option value="Business Pro">Business Pro ($199/mo)</option>
                          <option value="AI Agent & LLM Shield">AI Agent & LLM Shield ($399/mo)</option>
                          <option value="Enterprise Sovereign SOC">Enterprise Sovereign SOC ($799/mo)</option>
                          <option value="Hyperscale Defense & Custom Mesh">Hyperscale Defense ($1,499/mo)</option>
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
                          <option value="Developer Starter">Developer Starter ($29/mo)</option>
                          <option value="Startup Shield">Startup Shield ($79/mo)</option>
                          <option value="Business Pro">Business Pro ($199/mo)</option>
                          <option value="AI Agent & LLM Shield">AI Agent & LLM Shield ($399/mo)</option>
                          <option value="Enterprise Sovereign SOC">Enterprise Sovereign SOC ($799/mo)</option>
                          <option value="Hyperscale Defense & Custom Mesh">Hyperscale Defense ($1,499/mo)</option>
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

        {/* TAB: PLANS & SUBSCRIPTIONS (REPLACED CREDIT COINS WITH 6 OFFICIAL BUSINESS PLANS) */}
        {currentAreaTab === "Billing & Credits" && (() => {
          const currentPlan = getPlanById(activeSubscription.planId);
          const domainsUsed = tenants.length;
          const isAtLimit = currentPlan.maxDomains !== -1 && domainsUsed >= currentPlan.maxDomains;

          return (
            <section className="space-y-6">
              {/* 1. Hero Active Plan & Resource Utilization HUD */}
              <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-card via-primary/[0.04] to-card p-6 shadow-xl">
                <div className="pointer-events-none absolute -right-20 -top-20 size-60 rounded-full bg-primary/10 blur-3xl" />
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                      <ShieldCheck className="size-4 text-emerald-400" />
                      <span>Active Sovereign Subscription</span>
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Autonomous Shield Live
                      </span>
                      {currentPlan.badge && (
                        <span className="rounded-md bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                          {currentPlan.badge}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-baseline gap-3">
                      <span className="font-display text-3xl font-extrabold tracking-tight text-foreground">
                        {currentPlan.name}
                      </span>
                      <span className="font-mono text-lg font-bold text-primary">
                        ${activeSubscription.priceUsd} USD
                        <span className="text-xs font-normal text-muted-foreground">
                          /{activeSubscription.billingCycle === "annual" ? "yr" : "mo"}
                        </span>
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground max-w-xl">
                      {currentPlan.tagline} Next automated renewal due on{" "}
                      <strong className="text-foreground">{activeSubscription.nextRenewalDate}</strong> via{" "}
                      <span className="text-foreground">{activeSubscription.paymentMethod}</span>.
                    </p>
                  </div>

                  {/* Plan Quota Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
                    <div className="rounded-xl border border-border/70 bg-background/60 p-3 text-center">
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">Protected Domains</div>
                      <div className={`mt-1 font-mono text-sm font-bold ${isAtLimit ? "text-amber-400" : "text-emerald-400"}`}>
                        {domainsUsed} / {currentPlan.maxDomains === -1 ? "Unlimited" : currentPlan.maxDomains}
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">
                        {isAtLimit ? "Quota Reached" : "Available"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-background/60 p-3 text-center">
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">Monthly Quota</div>
                      <div className="mt-1 font-mono text-sm font-bold text-foreground">
                        {(currentPlan.requestQuotaMonthly / 1_000_000).toFixed(currentPlan.requestQuotaMonthly >= 1_000_000 ? 1 : 2)}M
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">Requests/mo</div>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-background/60 p-3 text-center">
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">Vault Retention</div>
                      <div className="mt-1 font-mono text-sm font-bold text-foreground">
                        {currentPlan.retentionDays} Days
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">Audit Trail</div>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-background/60 p-3 text-center">
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">Response SLA</div>
                      <div className="mt-1 font-mono text-xs font-bold text-primary truncate">
                        {currentPlan.sla.split("(")[0]}
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">Guaranteed</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Billing Cycle Toggle Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
                <div>
                  <h3 className="text-base font-bold text-foreground">Choose Your SparrowX Defense Plan</h3>
                  <p className="text-xs text-muted-foreground">
                    Select from 6 production-grade subscription tiers designed for your exact workload and scale.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto rounded-xl border border-border bg-card p-1">
                  <button
                    type="button"
                    onClick={() => setBillingCycleToggle("monthly")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      billingCycleToggle === "monthly"
                        ? "bg-primary text-black shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Monthly Billing
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycleToggle("annual")}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      billingCycleToggle === "annual"
                        ? "bg-primary text-black shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>Annual Billing</span>
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-bold text-emerald-400">
                      Save up to 20%
                    </span>
                  </button>
                </div>
              </div>

              {/* 3. The 6 Official SparrowX Subscription Plans Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {SPARROWX_PLANS.map((plan) => {
                  const isCurrent = activeSubscription.planId === plan.id;
                  const priceToDisplay =
                    billingCycleToggle === "annual" ? plan.annualPriceMonthly : plan.monthlyPrice;

                  return (
                    <div
                      key={plan.id}
                      className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all shadow-md ${
                        isCurrent
                          ? "border-emerald-500/70 bg-gradient-to-b from-emerald-950/20 via-card to-card ring-1 ring-emerald-500/40"
                          : plan.popular
                          ? "border-primary/60 bg-gradient-to-b from-primary/[0.07] via-card to-card hover:border-primary hover:shadow-xl"
                          : "border-border bg-card hover:border-primary/40 hover:shadow-lg"
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="rounded-md border border-border bg-secondary/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground">
                          {plan.tier}
                        </span>
                        {isCurrent ? (
                          <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="size-3" /> Active Plan
                          </span>
                        ) : plan.badge ? (
                          <span className="rounded-full bg-primary/20 border border-primary/40 px-2.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                            {plan.badge}
                          </span>
                        ) : null}
                      </div>

                      {/* Header Info */}
                      <div>
                        <h4 className="text-lg font-bold text-foreground">{plan.name}</h4>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          {plan.tagline}
                        </p>

                        {/* Price */}
                        <div className="mt-4 flex items-baseline gap-1.5 border-y border-border/60 py-3">
                          <span className="font-display text-3xl font-extrabold text-foreground">
                            ${priceToDisplay}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            USD / month
                          </span>
                          {billingCycleToggle === "annual" && (
                            <span className="ml-auto text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                              Billed ${plan.annualPriceMonthly * 12}/yr
                            </span>
                          )}
                        </div>

                        {/* Quota Highlights */}
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                          <div className="rounded-lg bg-background/50 border border-border/50 p-2">
                            <span className="text-muted-foreground block text-[10px]">Domains</span>
                            <strong className="text-foreground font-mono">
                              {plan.maxDomains === -1 ? "Unlimited" : `${plan.maxDomains} Domain${plan.maxDomains > 1 ? "s" : ""}`}
                            </strong>
                          </div>
                          <div className="rounded-lg bg-background/50 border border-border/50 p-2">
                            <span className="text-muted-foreground block text-[10px]">Monthly Requests</span>
                            <strong className="text-foreground font-mono">
                              {plan.requestQuotaMonthly.toLocaleString()}
                            </strong>
                          </div>
                          <div className="rounded-lg bg-background/50 border border-border/50 p-2">
                            <span className="text-muted-foreground block text-[10px]">Audit Retention</span>
                            <strong className="text-foreground font-mono">{plan.retentionDays} Days</strong>
                          </div>
                          <div className="rounded-lg bg-background/50 border border-border/50 p-2">
                            <span className="text-muted-foreground block text-[10px]">Response SLA</span>
                            <strong className="text-primary font-mono text-[10px] truncate block">
                              {plan.sla.split("(")[0]}
                            </strong>
                          </div>
                        </div>

                        {/* Feature Checklist */}
                        <div className="mt-4 space-y-1.5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                            Included Capabilities
                          </div>
                          {plan.features.slice(0, 5).map((feat, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                              <Check className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span className="leading-tight text-[11px]">{feat}</span>
                            </div>
                          ))}
                        </div>

                        {/* Cost Measurement / Unit Economics Pill */}
                        <div className="mt-4 rounded-lg border border-primary/20 bg-primary/[0.04] p-2.5 text-[10px] text-muted-foreground">
                          <div className="flex items-center justify-between font-mono font-semibold text-foreground">
                            <span>Cost to Serve:</span>
                            <span className="text-primary">${plan.costAnalysis.totalMonthlyCost.toFixed(2)}/mo</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[10px]">
                            <span>Gross Margin:</span>
                            <span className="font-bold text-emerald-400">{plan.costAnalysis.grossMarginPct}%</span>
                          </div>
                          <div className="mt-1 text-[9px] text-zinc-400">
                            Target: {plan.targetAudience}
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="mt-5 pt-3 border-t border-border/70">
                        {isCurrent ? (
                          <Button
                            disabled
                            size="sm"
                            className="w-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold cursor-default"
                          >
                            <CheckCircle2 className="size-4 mr-1.5" /> Current Active Subscription
                          </Button>
                        ) : (
                          <Button
                            onClick={() => {
                              setSelectedPlanForCheckout(plan);
                              setCheckoutBillingCycle(billingCycleToggle);
                            }}
                            size="sm"
                            className="w-full bg-primary font-bold text-black hover:opacity-95 shadow-md shadow-primary/20 cursor-pointer"
                          >
                            <Sparkles className="size-3.5 mr-1.5" />
                            {plan.monthlyPrice > currentPlan.monthlyPrice ? "Upgrade to " : "Switch to "}
                            {plan.name}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 4. Unit Economics & Measured Cost Architecture Section */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Database className="size-4 text-primary" />
                      <span>SparrowX Unit Economics & Measured Cost Architecture</span>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Complete visibility into our edge infrastructure expenses, bandwidth allocations, and sustainable ~85% gross margins.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCostArchitectureBreakdown(!showCostArchitectureBreakdown)}
                    className="text-xs shrink-0"
                  >
                    {showCostArchitectureBreakdown ? "Hide Economics Table" : "View Cost Breakdown Table"}
                  </Button>
                </div>

                {showCostArchitectureBreakdown && (
                  <div className="overflow-x-auto no-scrollbar rounded-xl border border-border/80">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="border-b border-border bg-muted/30 text-[10px] text-muted-foreground uppercase font-sans">
                        <tr>
                          <th className="py-2.5 px-3">Plan Tier</th>
                          <th className="py-2.5 px-3">Monthly Price</th>
                          <th className="py-2.5 px-3">Edge DNS & Bandwidth</th>
                          <th className="py-2.5 px-3">WAF Pattern Compute</th>
                          <th className="py-2.5 px-3">AI Neural Engine</th>
                          <th className="py-2.5 px-3">Sovereign Vault Storage</th>
                          <th className="py-2.5 px-3">24/7 SecOps SLA</th>
                          <th className="py-2.5 px-3 text-primary">Total Cost/mo</th>
                          <th className="py-2.5 px-3 text-emerald-400">Net Profit/mo</th>
                          <th className="py-2.5 px-3 text-emerald-400">Gross Margin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {SPARROWX_PLANS.map((p) => (
                          <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-foreground font-sans">{p.name}</td>
                            <td className="py-2.5 px-3 font-bold">${p.monthlyPrice}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">${p.costAnalysis.edgeDnsBandwidth.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">${p.costAnalysis.wafCompute.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">${p.costAnalysis.aiNeuralEngine.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">${p.costAnalysis.storageAndVault.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">${p.costAnalysis.secOpsOverhead.toFixed(2)}</td>
                            <td className="py-2.5 px-3 font-bold text-primary">${p.costAnalysis.totalMonthlyCost.toFixed(2)}</td>
                            <td className="py-2.5 px-3 font-bold text-emerald-400">${p.costAnalysis.grossProfitMonthly.toFixed(2)}</td>
                            <td className="py-2.5 px-3 font-bold text-emerald-400">{p.costAnalysis.grossMarginPct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-3.5 text-xs text-muted-foreground space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-primary" />
                    Why SparrowX Maintains Sustainable Unit Economics
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    By operating high-throughput edge inspection with zero unneeded third-party SaaS middle layers,
                    SparrowX achieves an average <strong>85.5% gross profit margin</strong>. This structure completely protects client
                    workloads from service cutoffs, guarantees 99.99% sovereign edge uptime, and funds continuous autonomous
                    AI threat memory research.
                  </p>
                </div>
              </div>

              {/* 5. Subscription Invoices & Receipts Ledger */}
              <div className="rounded-xl border border-border bg-card shadow-sm">
                <div className="border-b border-border px-5 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Official Subscription Invoices & Tax Receipts</h3>
                    <p className="text-xs text-muted-foreground">
                      Download official verified VAT/Tax invoices and cryptographic payment proofs.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    {billingTransactions.length} Recorded Invoices
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
                            <div className="font-mono font-bold text-sm text-foreground">
                              ${(tx.costUsd || currentPlan.monthlyPrice).toFixed(2)} USD
                            </div>
                            <div className="text-[10px] text-emerald-400 font-semibold uppercase">
                              {(tx.status ?? "completed")}
                            </div>
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
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      No subscription invoices recorded yet. Active plan: {currentPlan.name}.
                    </div>
                  )}
                </div>
              </div>

              {/* 6. Checkout & Plan Switch Confirmation Modal */}
              {selectedPlanForCheckout && (
                <div
                  role="dialog"
                  aria-modal="true"
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                >
                  <div className="relative w-full max-w-lg rounded-2xl border border-primary/40 bg-card p-6 shadow-2xl space-y-5">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="size-4 text-primary" />
                        <h3 className="text-base font-bold text-foreground">
                          Confirm Subscription: {selectedPlanForCheckout.name}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPlanForCheckout(null)}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    {/* Pricing summary */}
                    <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-4 flex items-center justify-between">
                      <div>
                        <div className="text-xs uppercase font-semibold text-muted-foreground">
                          {checkoutBillingCycle === "annual" ? "Annual Plan (Discounted)" : "Monthly Subscription"}
                        </div>
                        <div className="text-xl font-extrabold text-foreground font-display mt-0.5">
                          ${checkoutBillingCycle === "annual"
                            ? selectedPlanForCheckout.annualPriceMonthly * 12
                            : selectedPlanForCheckout.monthlyPrice}{" "}
                          USD
                          <span className="text-xs font-normal text-muted-foreground font-mono">
                            /{checkoutBillingCycle === "annual" ? "year" : "month"}
                          </span>
                        </div>
                      </div>

                      <div className="flex rounded-lg border border-border bg-background p-1 text-xs">
                        <button
                          type="button"
                          onClick={() => setCheckoutBillingCycle("monthly")}
                          className={`px-2.5 py-1 rounded font-semibold transition-all ${
                            checkoutBillingCycle === "monthly" ? "bg-primary text-black font-bold" : "text-muted-foreground"
                          }`}
                        >
                          Monthly
                        </button>
                        <button
                          type="button"
                          onClick={() => setCheckoutBillingCycle("annual")}
                          className={`px-2.5 py-1 rounded font-semibold transition-all ${
                            checkoutBillingCycle === "annual" ? "bg-primary text-black font-bold" : "text-muted-foreground"
                          }`}
                        >
                          Annual (-20%)
                        </button>
                      </div>
                    </div>

                    {/* What happens next */}
                    <div className="text-[11px] text-muted-foreground bg-muted/20 border border-border/60 rounded-xl p-3 space-y-1">
                      <div className="font-semibold text-foreground">Immediate Activation SLA:</div>
                      <div>• Domain quota upgrades to {selectedPlanForCheckout.maxDomains === -1 ? "Unlimited" : selectedPlanForCheckout.maxDomains} domains immediately.</div>
                      <div>• Guaranteed {selectedPlanForCheckout.sla} incident response takes effect upon confirmation.</div>
                      <div>• Provisioned directly on your sovereign server for {currentUser?.email || "your workspace"}.</div>
                    </div>

                    {/* Modal Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedPlanForCheckout(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          handleSubscribeToPlan(
                            selectedPlanForCheckout,
                            checkoutBillingCycle,
                            "Sovereign Self-Hosted Provisioning",
                          );
                        }}
                        className="bg-primary font-bold text-black hover:opacity-95 shadow-md shadow-primary/25"
                      >
                        <ShieldCheck className="size-4 mr-1.5" />
                        Confirm & Activate {selectedPlanForCheckout.name}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          );
        })()}

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
            onOpenAttackSimulator={() => {
              setShowAttackSimulator(true);
              setIntegrationTenant(null);
            }}
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
      {(activeNav === "Client Overview" || activeNav === "Overview") && (
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
          onOpenAttackSimulator={() => {
            setShowAttackSimulator(true);
            setIntegrationTenant(null);
          }}
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
                  Contact your organization administrator or email <strong className="text-primary">security@sparrowx.net</strong> to verify identity and issue a temporary sign-in credential.
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
    <div className="relative min-h-svh w-full bg-black text-white selection:bg-primary/30 selection:text-white overflow-x-clip font-sans">
      {/* Subtle Matrix / Tactical Grid Overlay */}
      <div className="pointer-events-none fixed inset-0 vibe-subtle-grid z-0 opacity-45" />

      {/* Atmospheric Ambient Light Flares */}
      <div className="pointer-events-none fixed -top-48 -left-40 size-[480px] rounded-full bg-primary/15 blur-[160px] z-0" />
      <div className="pointer-events-none fixed top-1/3 -right-48 size-[440px] rounded-full bg-emerald-500/10 blur-[170px] z-0" />
      <div className="pointer-events-none fixed bottom-0 left-1/3 size-[380px] rounded-full bg-blue-500/10 blur-[160px] z-0" />

      {/* Top Fixed Liquid-Glass Cyber-Dock Navigation Bar (Zero Scroll Jitter, Always Follows) */}
      <header className="fixed top-0 left-0 right-0 z-50 w-full py-3 transform-gpu will-change-transform">
        <div className="mx-auto max-w-7xl px-3 sm:px-6">
          <div
            className={`relative flex items-center justify-between gap-3 sm:gap-4 rounded-2xl md:rounded-full border px-4 py-2.5 sm:px-6 backdrop-blur-2xl backdrop-saturate-150 transition-colors duration-300 ${
              scrolled
                ? "border-white/20 bg-black/55 shadow-[0_16px_48px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.22),0_0_24px_rgba(249,115,22,0.12)]"
                : "border-white/15 bg-black/40 shadow-[0_12px_36px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.18)]"
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
            </div>

            {/* Center Quick Navigation Links (Capsule Cyber Dock) */}
            {viewStage === "landing" && (
              <nav className="hidden md:flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-xs font-medium text-zinc-400 backdrop-blur-xl shadow-inner">
                <a
                  href="#free-scanner"
                  onClick={() => setActiveSection("free-scanner")}
                  className={`inline-flex items-center rounded-full px-3 py-1.5 transition-all whitespace-nowrap ${
                    activeSection === "free-scanner"
                      ? "bg-white/10 text-white font-semibold shadow-xs"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  Free Scanner
                </a>

                <a
                  href="#world-threats"
                  onClick={() => setActiveSection("world-threats")}
                  className={`inline-flex items-center rounded-full px-3 py-1.5 transition-all whitespace-nowrap ${
                    activeSection === "world-threats"
                      ? "bg-white/10 text-white font-semibold shadow-xs"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  Threats We Stop
                </a>

                <a
                  href="#defense-grid"
                  onClick={() => setActiveSection("defense-grid")}
                  className={`inline-flex items-center rounded-full px-3 py-1.5 transition-all whitespace-nowrap ${
                    activeSection === "defense-grid"
                      ? "bg-white/10 text-white font-semibold shadow-xs"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  What We Do
                </a>

                <a
                  href="#pricing"
                  onClick={() => setActiveSection("pricing")}
                  className={`inline-flex items-center rounded-full px-3 py-1.5 transition-all whitespace-nowrap ${
                    activeSection === "pricing"
                      ? "bg-white/10 text-white font-semibold shadow-xs"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  Contact Us
                </a>

                <a
                  href="#how-it-works"
                  onClick={() => setActiveSection("how-it-works")}
                  className={`inline-flex items-center rounded-full px-3 py-1.5 transition-all whitespace-nowrap ${
                    activeSection === "how-it-works"
                      ? "bg-white/10 text-white font-semibold shadow-xs"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  Onboarding
                </a>
              </nav>
            )}

            {/* Right Action CTAs & Mobile Toggle */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">

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
        <main className="relative z-10 mx-auto max-w-6xl px-4 sm:px-8 pt-24 pb-12 lg:pt-28 lg:pb-16">
          <div className="grid gap-10 lg:grid-cols-12 items-center">
            {/* Left 5 Cols: Clean & Simple Welcome */}
            <div className="lg:col-span-5 space-y-4">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-[1.12]">
                Step inside your{" "}
                <span className="bg-gradient-to-r from-primary via-orange-400 to-amber-300 bg-clip-text text-transparent">
                  cyber command center.
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Sign in or create your isolated workspace to manage your domains, connectors, and
                autonomous edge security.
              </p>
            </div>

            {/* Right 7 Cols: Auth Card */}
            <div className="lg:col-span-7">{renderAuthCard()}</div>
          </div>
        </main>
      ) : (
        /* STAGE 2: EYE-CATCHING ANIMATED CYBER DEFENSE STARTUP LANDING PAGE */
        <main className="relative z-10 pt-20 sm:pt-24">
          {/* TOP FIRST: LIVE PUBLIC DOMAIN & API VULNERABILITY SCANNER (FIRST THING VISITORS SEE & USE) */}
          <section id="free-scanner" className="mx-auto max-w-7xl px-4 sm:px-8 pt-4 pb-2 sm:pt-6 sm:pb-3 scroll-mt-24">
            <LandingLiveSecurityScanner
              onClaimAndProtectDomain={(domain, suggestedOrgName) => {
                setPrimaryDomain(domain);
                setOrgName(suggestedOrgName);
                openAuthGateway("signup");
              }}
              onOpenInstantCheckout={(_neededCredits, domain) => {
                if (domain) {
                  setPrimaryDomain(domain);
                }
                openAuthGateway("signup");
              }}
            />
          </section>

          {/* HERO SECTION */}
          <section className="mx-auto max-w-7xl px-4 sm:px-8 pt-6 pb-12 lg:pt-10 lg:pb-16">
            <div className="grid gap-10 lg:grid-cols-12 items-center">
              {/* Hero Left: Concise Value Proposition */}
              <div className="lg:col-span-6 space-y-5">
                <h1 className="text-3xl sm:text-5xl lg:text-[52px] font-extrabold tracking-tight text-white leading-[1.08]">
                  The threat world never sleeps.{" "}
                  <span className="bg-gradient-to-r from-primary via-orange-400 to-amber-300 bg-clip-text text-transparent">
                    Neither does your shield.
                  </span>
                </h1>

                <p className="text-sm sm:text-base leading-relaxed text-zinc-300 max-w-xl">
                  Autonomous edge WAF, AI prompt guardrails, and dedicated per-tenant database
                  isolation—deployed in 60 seconds.
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

              {/* Hero Right: Clean Sovereign Protection Card */}
              <div id="sovereign-architecture" className="lg:col-span-6">
                <div className="relative rounded-2xl border border-[#1F1F1F] bg-black p-5 sm:p-6 shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden space-y-4">
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
                          Status: <strong className="text-emerald-400">Isolated & Online</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Onboard your domain or server in seconds with isolated workspace telemetry and
                    live edge protection.
                  </p>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1F1F1F]">
                    <a
                      href="#free-scanner"
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

          {/* LIVE 3D SATELLITE HOST CONNECTION GLOBE & THREATS WE STOP */}
          <section id="world-threats" className="mx-auto max-w-7xl px-4 sm:px-8 py-12 lg:py-16 border-t border-[#1F1F1F] scroll-mt-24">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="max-w-2xl">
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
                  LIVE SATELLITE HOST TELEMETRY
                </div>
                <h2 className="mt-1.5 text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                  Real-time host connections & threat interception.
                </h2>
              </div>
              <a
                href="#free-scanner"
                className="inline-flex items-center gap-2 self-start md:self-auto rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-xs font-bold text-primary hover:bg-primary/20 transition-all"
              >
                <Search className="size-3.5" />
                <span>Scan Your Domain</span>
              </a>
            </div>

            {/* Live Interactive 3D Cyber Threat Globe Interception Engine */}
            <div className="mt-6">
              <CyberThreatGlobe
                height={520}
                showControls={true}
                showFeed={true}
                showStats={true}
                className="border-[#1F1F1F] bg-black"
              />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  code: "OWASP A03 · SQLi",
                  threat: "SQL Injection & DB Shield",
                  defense: "Drops malicious UNION/SELECT/DROP payloads at the edge in <2ms.",
                },
                {
                  code: "OWASP LLM01 · AI",
                  threat: "AI Prompt Guardrails",
                  defense: "Sanitizes prompts and blocks rogue MCP tool execution before LLM runs.",
                },
                {
                  code: "MITRE T1110 · BOTNET",
                  threat: "Botnet & Brute-Force Defense",
                  defense: "Detects credential-stuffing bursts and exports 1-click firewall rules.",
                },
                {
                  code: "OWASP A10 · SSRF",
                  threat: "SSRF & Zero-Day Shield",
                  defense: "Blocks internal metadata probes, dotfile leaks, and unpatched CVE scans.",
                },
              ].map((item) => (
                <div
                  key={item.threat}
                  className="rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-4 flex flex-col justify-between hover:border-zinc-700 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded">
                        {item.code}
                      </span>
                      <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
                    </div>
                    <h3 className="mt-2.5 text-sm font-bold text-white">{item.threat}</h3>
                    <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{item.defense}</p>
                  </div>
                </div>
              ))}
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
