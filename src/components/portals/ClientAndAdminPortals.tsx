import { useState, useEffect } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  CheckCircle2,
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
  LockKeyhole,
  Mail,
  Plus,
  RefreshCw,
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
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ClientIntegrationModal } from "@/components/ClientIntegrationModal";
import { PaymentGatewayModal } from "@/components/PaymentGatewayModal";
import {
  calculateServiceCost,
  downloadTransactionReceipt,
  fetchBillingTransactions,
  fetchCreditBalance,
  getStoredBillingTransactions,
  getStoredCreditBalance,
  recordBillingTransaction,
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
  persistAuditLogToBackend,
  persistClientTenantToBackend,
  type PlanTier,
  type ProtectedService,
  type ReportItem,
  type ServiceModuleId,
  type Vulnerability,
} from "@/lib/supabase";

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
  supabaseUrl,
  supabaseAnonKey,
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
  supabaseUrl: string;
  supabaseAnonKey: string;
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
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          {[
            { label: "My Services", icon: Boxes, count: tenants.length },
            { label: "Subscriptions & Due Dates", icon: Activity },
            { label: "Billing & Credits", icon: Coins, count: creditBalance },
            { label: "Profile Management", icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = currentAreaTab === tab.label;
            return (
              <button
                className={`flex items-center gap-2 rounded-md border px-3.5 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
                key={tab.label}
                onClick={() => onNavigate(tab.label)}
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
                className="fixed inset-0 z-50 grid place-items-center bg-background/75 p-4 backdrop-blur-xs"
                role="dialog"
              >
                <div className="w-full max-w-md border border-border bg-card p-6 shadow-2xl">
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
                    <span>Security Credit Vault & Balance</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-mono text-emerald-400 lowercase">
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      supabase postgresql live
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
const SPARROWX_URL = "${supabaseUrl}";
const SPARROWX_KEY = "${supabaseAnonKey}";
const TENANT_API_KEY = "${activeTenant.apiKey}";

export async function emitSecurityTelemetry(event: {
  title: string;
  severity: "Critical" | "High" | "Medium";
  summary: string;
}) {
  await fetch(\`\${SPARROWX_URL}/rest/v1/incidents\`, {
    method: "POST",
    headers: {
      apikey: SPARROWX_KEY,
      Authorization: \`Bearer \${SPARROWX_KEY}\`,
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
      summary: \`\${event.summary} (Tenant Key: \${TENANT_API_KEY.slice(0, 14)}...)\`,
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
                        `SQLi/XSS Edge Block ${next ? "enabled & logged to Supabase" : "disabled & logged"}`,
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
                        `Prompt Shield ${next ? "enabled & logged to Supabase" : "disabled & logged"}`,
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

export function AdminPortalView({
  activeNav,
  tenants,
  auditLogs,
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
                placeholder="Client name (e.g. NovaPay)"
                required
                value={newName}
              />
              <input
                aria-label="Client contact email"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="secops@novapay.io"
                required
                type="email"
                value={newEmail}
              />
              <input
                aria-label="Primary domain or URI"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="https://app.novapay.io"
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
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  // Sign-In fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [loginError, setLoginError] = useState("");

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

  // Interactive Active Feature Highlight on Left Column
  const [activeHighlightModule, setActiveHighlightModule] = useState<ServiceModuleId>("ai_shield");

  const toggleModule = (id: ServiceModuleId) => {
    setSelectedModules((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((item) => item !== id)
          : prev
        : [...prev, id],
    );
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
      title: "Web & API Protection",
      desc: "Drop-in middleware blocking SQL injections, XSS payloads, and malformed requests before they hit your code.",
      badge: "Edge Middleware",
      icon: Globe2,
      accent: "from-orange-500/20 to-amber-500/10 text-orange-400 border-orange-500/30",
    },
    {
      id: "ai_shield" as ServiceModuleId,
      shortLabel: "AI Agent Guardrails",
      title: "LLM & Tool Firewall",
      desc: "Inspect prompt injections in a live sandbox, filter system prompts, and restrict dangerous AI tool executions.",
      badge: "Interactive Sandbox",
      icon: Sparkles,
      accent: "from-purple-500/20 to-primary/10 text-purple-400 border-purple-500/30",
    },
    {
      id: "cloud_security" as ServiceModuleId,
      shortLabel: "Cloud & Endpoints",
      title: "Firewall & IP Export",
      desc: "Generate iptables, UFW, or Cloudflare blocklists directly from flagged security incident logs.",
      badge: "1-Click Rule Exporter",
      icon: Server,
      accent: "from-blue-500/20 to-cyan-500/10 text-blue-400 border-blue-500/30",
    },
    {
      id: "compliance" as ServiceModuleId,
      shortLabel: "Continuous Audit",
      title: "Evidence & Audit Logs",
      desc: "Download real Markdown attestation documents and CSV incident reports directly from your live data.",
      badge: "Real .MD & .CSV",
      icon: FileSearch,
      accent: "from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30",
    },
  ];

  return (
    <div className="relative min-h-svh w-full bg-[#09090b] text-foreground vibe-mesh-bg selection:bg-primary/20 selection:text-primary overflow-x-hidden font-sans">
      {/* Subtle Matrix / Grid Overlay */}
      <div className="pointer-events-none absolute inset-0 vibe-subtle-grid z-0 opacity-60" />

      {/* Atmospheric Ambient Light Flares */}
      <div className="pointer-events-none absolute -top-40 -left-40 size-96 rounded-full bg-primary/15 blur-[140px] z-0" />
      <div className="pointer-events-none absolute top-1/2 -right-40 size-96 rounded-full bg-emerald-500/10 blur-[150px] z-0" />

      {/* Top Floating Glass Navigation */}
      <header className="relative z-10 border-b border-white/[0.07] bg-[#0c0c0e]/85 backdrop-blur-xl px-4 sm:px-8 py-3.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative grid size-10 place-items-center rounded-xl bg-black/60 border border-white/15 p-1 text-white shadow-lg shadow-primary/25 overflow-hidden shrink-0">
              <img
                src="/sparrowx-logo.png"
                alt="SparrowX Logo"
                className="size-full object-contain"
              />
              <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 border-2 border-[#09090b]" />
            </div>
            <div>
              <div className="font-display text-base font-bold tracking-tight">
                sparrow<span className="text-primary">x</span>
              </div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                Developer SecOps & AI Guardrails
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden md:flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
              <span className="relative flex size-2">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full ${
                    backendSource === "supabase" ? "bg-emerald-400" : "bg-amber-400"
                  } opacity-75`}
                />
                <span
                  className={`relative inline-flex size-2 rounded-full ${
                    backendSource === "supabase" ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
              </span>
              <span>
                {backendSource === "supabase" ? "Supabase Live Connected" : "Local Offline Mode"}
              </span>
              <span className="text-white/20">·</span>
              <span className="font-mono text-emerald-400/90 font-medium">
                {backendSource === "supabase" ? "PostgreSQL Active" : "Cache Active"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setLoginError("");
                  setSignupError("");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-white/10 shadow-sm whitespace-nowrap"
              >
                {mode === "signin" ? (
                  <>
                    <Sparkles className="size-3.5 text-primary" />
                    <span>Create Account</span>
                  </>
                ) : (
                  <>
                    <LockKeyhole className="size-3.5 text-primary" />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area: Balanced 2-Column Layout */}
      <main className="relative z-10 mx-auto grid max-w-6xl gap-8 lg:gap-10 px-4 sm:px-6 py-6 lg:py-10 lg:grid-cols-2 items-start">
        {/* Left Column: Honest, Grounded Story */}
        <section className="space-y-5">
          <div className="space-y-3.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary shadow-[0_0_20px_rgba(240,90,40,0.15)]">
              <img
                src="/sparrowx-logo.png"
                alt="SparrowX"
                className="size-4 object-contain inline-block"
              />
              <span>SparrowX Autonomous Security · Under Active Development</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight">
              Straightforward security <br />
              <span className="bg-gradient-to-r from-primary via-orange-400 to-amber-300 bg-clip-text text-transparent">
                for your apps and AI tools.
              </span>
            </h1>

            <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground max-w-lg">
              We are just getting started. No bloated consoles, no sales calls, and no fake
              enterprise metrics. SparrowX gives you simple drop-in middleware, real-time threat
              logging, and an AI prompt firewall so you can see what’s hitting your apps and take
              control.
            </p>
          </div>

          {/* Interactive Feature Pillars */}
          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            {modulePillars.map((mod) => {
              const IconComp = mod.icon;
              const isSelected = activeHighlightModule === mod.id;
              return (
                <div
                  key={mod.id}
                  onClick={() => setActiveHighlightModule(mod.id)}
                  className={`vibe-feature-card cursor-pointer rounded-xl p-3.5 transition-all ${
                    isSelected
                      ? "border-primary/50 bg-[#1e1e24] shadow-[0_0_25px_rgba(240,90,40,0.18)] ring-1 ring-primary/40"
                      : "hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`grid size-8 place-items-center rounded-lg border bg-gradient-to-br ${mod.accent}`}
                    >
                      <IconComp className="size-4" />
                    </span>
                    <span className="rounded-full bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {mod.badge}
                    </span>
                  </div>
                  <h3 className="mt-2.5 text-sm font-semibold text-foreground tracking-tight">
                    {mod.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{mod.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Live Trust & Human Metrics Footer */}
          <div className="pt-3 border-t border-white/[0.07] flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="inline-block size-2 rounded-full bg-emerald-400" />
              <span className="font-medium text-foreground/90">100% sovereign & self-hostable</span>
            </div>

            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="text-muted-foreground">Zero hidden tracking</span>
              <span>·</span>
              <span className="text-primary font-medium">Own your data</span>
            </div>
          </div>
        </section>

        {/* Right Column: High-End Glassmorphic Workspace Gateway */}
        <section className="relative w-full">
          {/* Subtle Outer Glow Behind Form */}
          <div className="pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-to-b from-primary/20 via-orange-500/10 to-transparent blur-xl opacity-60" />

          <div className="relative vibe-glass-panel rounded-2xl p-5 sm:p-7 shadow-2xl border border-white/[0.09]">
            {/* Form Mode Header & Segmented Pill */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  {mode === "signin" ? (
                    <>
                      <LockKeyhole className="size-4 text-primary" /> Welcome Back
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4 text-primary" /> Create Your Workspace
                    </>
                  )}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {mode === "signin"
                    ? "Sign in to access your security telemetry and live guardrails"
                    : "Zero-commitment setup. Launch your custom dashboard in 60s."}
                </p>
              </div>

              {/* Segmented Pill Switcher */}
              <div className="flex items-center self-start sm:self-auto rounded-xl border border-white/10 bg-black/40 p-1 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setLoginError("");
                  }}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                    mode === "signin"
                      ? "bg-primary text-white shadow-md shadow-primary/30"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setSignupError("");
                  }}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                    mode === "signup"
                      ? "bg-primary text-white shadow-md shadow-primary/30"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Create Account
                </button>
              </div>
            </div>

            {/* SIGN IN FORM */}
            {mode === "signin" ? (
              <form className="mt-4 space-y-3.5" onSubmit={handleSignIn}>
                <div>
                  <label
                    className="text-xs font-medium text-foreground/90 block mb-1"
                    htmlFor="login-email"
                  >
                    Work Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                      <Mail className="size-4" />
                    </span>
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="alex.rivera@acme.io"
                      className="h-10 w-full rounded-xl border border-white/10 bg-black/40 pl-9 pr-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/80 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      className="text-xs font-medium text-foreground/90"
                      htmlFor="login-password"
                    >
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                      <LockKeyhole className="size-4" />
                    </span>
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="h-10 w-full rounded-xl border border-white/10 bg-black/40 pl-9 pr-10 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/80 focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                    <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSigningIn}
                  className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-500 font-semibold text-sm text-white shadow-lg shadow-primary/25 transition-all hover:opacity-95 hover:shadow-primary/40 active:scale-[0.99] disabled:opacity-50 whitespace-nowrap px-4"
                >
                  <ShieldCheck className="size-4 shrink-0" />
                  <span>{isSigningIn ? "Signing in..." : "Sign In to Workspace"}</span>
                </button>

                <div className="pt-3 border-t border-white/[0.08] text-center text-xs text-muted-foreground">
                  New to SparrowX?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="font-semibold text-primary hover:underline"
                  >
                    Create an account & choose your modules
                  </button>
                </div>
              </form>
            ) : (
              /* CREATE ACCOUNT / ONBOARDING FORM */
              <form className="mt-4 space-y-3.5" onSubmit={handleSignUp}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      className="text-xs font-medium text-foreground/90 block mb-1"
                      htmlFor="signup-name"
                    >
                      Full Name
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-muted-foreground">
                        <User className="size-3.5" />
                      </span>
                      <input
                        id="signup-name"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Alex Rivera"
                        className="h-9 w-full rounded-xl border border-white/10 bg-black/40 pl-8 pr-3 text-xs text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/80 focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className="text-xs font-medium text-foreground/90 block mb-1"
                      htmlFor="signup-email"
                    >
                      Work Email
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-muted-foreground">
                        <Mail className="size-3.5" />
                      </span>
                      <input
                        id="signup-email"
                        type="email"
                        required
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="alex@acme.io"
                        className="h-9 w-full rounded-xl border border-white/10 bg-black/40 pl-8 pr-3 text-xs text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/80 focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    className="text-xs font-medium text-foreground/90 block mb-1"
                    htmlFor="signup-password"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-muted-foreground">
                      <LockKeyhole className="size-3.5" />
                    </span>
                    <input
                      id="signup-password"
                      type={showSignupPassword ? "text" : "password"}
                      required
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="h-9 w-full rounded-xl border border-white/10 bg-black/40 pl-8 pr-9 text-xs text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/80 focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted-foreground hover:text-foreground"
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
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      First Service Target (Optional)
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Can also add later
                    </span>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div>
                      <input
                        id="signup-org"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="Service Name (e.g. Acme Web)"
                        className="h-8 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary"
                      />
                    </div>
                    <div>
                      <input
                        id="signup-domain"
                        value={primaryDomain}
                        onChange={(e) => setPrimaryDomain(e.target.value)}
                        placeholder="Domain (https://app.acme.io)"
                        className="h-8 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary"
                      />
                    </div>
                  </div>
                </div>

                {/* Plan Tier Selection */}
                <div>
                  <label
                    className="text-xs font-medium text-foreground/90 block mb-1"
                    htmlFor="signup-plan"
                  >
                    Plan Tier
                  </label>
                  <select
                    id="signup-plan"
                    value={planTier}
                    onChange={(e) => setPlanTier(e.target.value as PlanTier)}
                    className="h-9 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-xs text-foreground outline-none focus:border-primary"
                  >
                    <option value="Starter">Starter — Individual & Developer Testing (Free)</option>
                    <option value="Growth">
                      Growth — Active Apps & Production Endpoints ($199/mo)
                    </option>
                    <option value="Enterprise">
                      Enterprise — Multi-Service Workspaces ($699/mo)
                    </option>
                  </select>
                </div>

                {/* Modular Protection Selection */}
                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-foreground/90 mb-1.5">
                    <span>Select Security Modules</span>
                    <span className="text-[10px] text-primary">Customizes your workspace</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {SERVICE_MODULES.map((mod) => {
                      const checked = selectedModules.includes(mod.id);
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => toggleModule(mod.id)}
                          className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                            checked
                              ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(240,90,40,0.12)] ring-1 ring-primary/30"
                              : "border-white/10 bg-black/30 hover:border-white/20"
                          }`}
                        >
                          <span
                            className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded border text-[10px] transition-all ${
                              checked
                                ? "border-primary bg-primary text-white"
                                : "border-white/20 bg-white/5"
                            }`}
                          >
                            {checked && <Check className="size-3" />}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-foreground truncate">
                              {mod.shortLabel}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {mod.title}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {signupError && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                    <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                    <span>{signupError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSigningUp}
                  className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-500 font-semibold text-sm text-white shadow-lg shadow-primary/25 transition-all hover:opacity-95 hover:shadow-primary/40 active:scale-[0.99] disabled:opacity-50 whitespace-nowrap px-4"
                >
                  <Sparkles className="size-4 shrink-0" />
                  <span>
                    {isSigningUp ? "Creating Workspace..." : "Create Account & Launch Dashboard"}
                  </span>
                </button>

                <div className="pt-3 border-t border-white/[0.08] text-center text-xs text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="font-semibold text-primary hover:underline"
                  >
                    Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
