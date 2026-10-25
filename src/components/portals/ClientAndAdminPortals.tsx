import { useState } from "react";
import {
  Activity,
  ArrowRight,
  Boxes,
  Check,
  Copy,
  Database,
  Eye,
  FileSearch,
  Globe2,
  KeyRound,
  LockKeyhole,
  Plus,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Terminal,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  type Asset,
  type AuditLogEntry,
  type ClientTenant,
  type Incident,
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
  onToggleTenantModule,
  onVerifyTenantSdk,
  onOpenServiceSdk,
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
  onToggleTenantModule: (tenantId: string, moduleId: ServiceModuleId) => Promise<void>;
  onVerifyTenantSdk: (tenant: ClientTenant) => Promise<void>;
  onOpenServiceSdk: (serviceId: string) => void;
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
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [orgName, setOrgName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [primaryDomain, setPrimaryDomain] = useState("");
  const [planTier, setPlanTier] = useState<PlanTier>("Growth");
  const [selectedModules, setSelectedModules] = useState<ServiceModuleId[]>(["web_security"]);

  // Local interactive rules for Web & AI modules
  const [wafSqliBlock, setWafSqliBlock] = useState(true);
  const [wafBotChallenge, setWafBotChallenge] = useState(true);
  const [wafStrictTls, setWafStrictTls] = useState(true);
  const [aiPromptShield, setAiPromptShield] = useState(true);
  const [aiMcpFirewall, setAiMcpFirewall] = useState(true);
  const [aiPiiRedaction, setAiPiiRedaction] = useState(true);

  const activeTenant =
    tenants.find((t) => t.id === selectedTenantId) ?? tenants[0] ?? null;

  const toggleWizardModule = (id: ServiceModuleId) => {
    setSelectedModules((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((item) => item !== id)
          : prev
        : [...prev, id],
    );
  };

  const handleFinishWizard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !contactEmail.trim() || !primaryDomain.trim()) return;
    await onCreateTenant({
      name: orgName.trim(),
      contactEmail: contactEmail.trim(),
      primaryDomain: primaryDomain.trim(),
      planTier,
      enabledModules: selectedModules,
    });
    setOrgName("");
    setContactEmail("");
    setPrimaryDomain("");
    setWizardStep(1);
    setShowOnboardingWizard(false);
  };

  // If no tenant exists yet or user clicked "+ Self-Onboard New Client", show the Automated Onboarding Wizard
  if (!activeTenant || showOnboardingWizard) {
    return (
      <div className="flex flex-col gap-6">
        <section className="flex flex-col justify-between gap-4 border border-primary/30 bg-card p-5 sm:flex-row sm:items-center">
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase text-primary">
              <Sparkles className="size-3.5" />
              Automated Self-Serve Client Onboarding
            </div>
            <h1 className="text-2xl font-semibold text-foreground">
              Configure your custom SparrowX workspace
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Select only the security modules your organization needs. Your dashboard and sidebar will automatically adapt with zero clutter.
            </p>
          </div>
          {activeTenant && (
            <Button
              onClick={() => setShowOnboardingWizard(false)}
              size="sm"
              variant="outline"
            >
              Back to {activeTenant.name}
            </Button>
          )}
        </section>

        {/* Stepper Indicator */}
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { step: 1, title: "1. Organization & Target", desc: "Company profile, domain & tier" },
            {
              step: 2,
              title: "2. Choose Security Modules",
              desc: "Build your custom, clutter-free dashboard",
            },
            {
              step: 3,
              title: "3. Auto-Provision & Connect",
              desc: "Instant API key & guided SDK setup",
            },
          ].map((item) => (
            <button
              className={`border p-4 text-left transition-colors ${
                wizardStep === item.step
                  ? "border-primary bg-primary/10"
                  : wizardStep > item.step
                    ? "border-success/40 bg-card"
                    : "border-border bg-card opacity-75"
              }`}
              key={item.step}
              onClick={() => {
                if (item.step === 1 || (orgName && contactEmail && primaryDomain)) {
                  setWizardStep(item.step as 1 | 2 | 3);
                }
              }}
              type="button"
            >
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>{item.title}</span>
                {wizardStep > item.step && <Check className="size-4 text-success" />}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
            </button>
          ))}
        </div>

        <form className="border border-border bg-card p-6" onSubmit={handleFinishWizard}>
          {wizardStep === 1 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-base font-semibold">Step 1 · Organization & Primary Endpoint</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="wiz-org">
                    Organization / Client Name
                  </label>
                  <input
                    className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
                    id="wiz-org"
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Acme FinTech Corp"
                    required
                    value={orgName}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="wiz-email">
                    Security Contact Email
                  </label>
                  <input
                    className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
                    id="wiz-email"
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="security@acme.com"
                    required
                    type="email"
                    value={contactEmail}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="wiz-domain">
                    Primary Production Domain or Agent URI
                  </label>
                  <input
                    className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
                    id="wiz-domain"
                    onChange={(e) => setPrimaryDomain(e.target.value)}
                    placeholder="https://app.acme.com or agent://acme-copilot"
                    required
                    value={primaryDomain}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="wiz-tier">
                    Subscription Plan Tier
                  </label>
                  <select
                    className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none"
                    id="wiz-tier"
                    onChange={(e) => setPlanTier(e.target.value as PlanTier)}
                    value={planTier}
                  >
                    <option value="Starter">Starter (Up to 100k req/mo)</option>
                    <option value="Growth">Growth (Up to 2M req/mo + Autonomous Block)</option>
                    <option value="Enterprise">Enterprise (Unlimited + 24/7 SOC SLA)</option>
                  </select>
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <Button
                  onClick={() => {
                    if (!orgName.trim() || !contactEmail.trim() || !primaryDomain.trim()) {
                      showToast("Please complete organization name, email, and domain");
                      return;
                    }
                    setWizardStep(2);
                  }}
                  type="button"
                >
                  Next: Choose Security Modules <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-base font-semibold">
                  Step 2 · Select Only the Protection Modules You Need
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your client dashboard will dynamically show only the modules selected below—no extra clutter or unused menus.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {SERVICE_MODULES.map((mod) => {
                  const isSelected = selectedModules.includes(mod.id);
                  return (
                    <button
                      className={`flex flex-col justify-between border p-4 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border bg-background/60 hover:border-border/80"
                      }`}
                      key={mod.id}
                      onClick={() => toggleWizardModule(mod.id)}
                      type="button"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground">{mod.title}</span>
                          <span
                            className={`grid size-5 place-items-center rounded-sm border text-[10px] ${
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card"
                            }`}
                          >
                            {isSelected && <Check className="size-3.5" />}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">{mod.description}</p>
                      </div>
                      <ul className="mt-3 space-y-1 border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
                        {mod.features.map((feat) => (
                          <li className="flex items-center gap-1.5" key={feat}>
                            <Check className="size-3 text-success" /> {feat}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center justify-between">
                <Button onClick={() => setWizardStep(1)} type="button" variant="ghost">
                  Back
                </Button>
                <Button onClick={() => setWizardStep(3)} type="button">
                  Next: Review & Auto-Provision <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-base font-semibold">
                  Step 3 · Automated Provisioning Summary
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  SparrowX will automatically provision your tenant in Supabase, issue your live ingestion key, and configure your custom sidebar.
                </p>
              </div>

              <div className="grid gap-3 border border-border bg-background p-4 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Organization:</span>{" "}
                  <strong className="text-foreground">{orgName}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Primary Target:</span>{" "}
                  <code className="text-foreground">{primaryDomain}</code>
                </div>
                <div>
                  <span className="text-muted-foreground">Plan Tier:</span>{" "}
                  <strong className="text-primary">{planTier}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Dynamic Sidebar Modules:</span>{" "}
                  <strong className="text-success">
                    {selectedModules
                      .map((id) => SERVICE_MODULES.find((m) => m.id === id)?.shortLabel)
                      .join(", ")}
                  </strong>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <Button onClick={() => setWizardStep(2)} type="button" variant="ghost">
                  Back
                </Button>
                <Button type="submit">
                  <Sparkles className="size-4" /> Launch Custom Client Dashboard
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>
    );
  }

  const enabledModuleObjects = SERVICE_MODULES.filter((m) =>
    activeTenant.enabledModules.includes(m.id),
  );

  const clientSdkSnippet = `// SparrowX Automated Client Guardrail SDK
// Tenant: ${activeTenant.name} (${activeTenant.id})
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
      {/* Top Tenant Bar */}
      <section className="flex flex-col justify-between gap-4 border border-border bg-card p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-primary/15 text-primary">
            <ShieldCheck className="size-5" />
          </div>
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
              Showing <strong>{enabledModuleObjects.length}</strong> subscribed module(s) in sidebar
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tenants.length > 1 && (
            <select
              aria-label="Switch active client tenant"
              className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none"
              onChange={(e) => onSelectTenant(e.target.value)}
              value={activeTenant.id}
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.planTier})
                </option>
              ))}
            </select>
          )}
          <Button
            className="h-8 px-3 text-xs"
            onClick={() => onNavigate("Subscription & Modules")}
            size="sm"
            variant="outline"
          >
            <Wrench className="size-3.5" /> Customize Modules
          </Button>
          <Button
            className="h-8 px-3 text-xs"
            onClick={() => {
              setWizardStep(1);
              setShowOnboardingWizard(true);
            }}
            size="sm"
          >
            <Plus className="size-3.5" /> Self-Onboard Client
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
                  Send an automated verification ping to confirm your endpoint streams to Supabase.
                </p>
                {!activeTenant.sdkVerified && (
                  <Button
                    className="mt-3 h-7 px-2.5 text-[11px]"
                    onClick={() => onVerifyTenantSdk(activeTenant)}
                    size="sm"
                  >
                    Run Automated Verification
                  </Button>
                )}
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
                  Drop this snippet into your application or AI agent runner to stream events directly into your workspace.
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
                      setWafSqliBlock(!wafSqliBlock);
                      showToast(`SQLi/XSS Edge Block ${!wafSqliBlock ? "enabled" : "disabled"}`);
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
                  Real-time inspection of LLM prompts, completions, and Model Context Protocol (MCP) tool executions.
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
                      setAiPromptShield(!aiPromptShield);
                      showToast(
                        `Prompt Injection Shield ${!aiPromptShield ? "enabled" : "disabled"}`,
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
                  Halts unauthorized destructive SQL queries, shell commands, or data exports by AI agents.
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
                <div className="flex items-center justify-between py-3 text-xs" key={r.id}>
                  <div>
                    <span className="font-semibold">{r.title}</span> ·{" "}
                    <span className="text-muted-foreground">{r.generatedAt}</span>
                  </div>
                  <span className="rounded-sm bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                    {r.status}
                  </span>
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
              Enable or disable modules below. Notice how the left sidebar immediately updates to show only the options you need—no junk menus.
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
  onRecordAudit: (action: string, target: string, severity?: AuditLogEntry["severity"]) => Promise<void>;
}) {
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newTier, setNewTier] = useState<PlanTier>("Enterprise");
  const [newModules, setNewModules] = useState<ServiceModuleId[]>(["web_security", "ai_shield"]);

  const toggleNewMod = (id: ServiceModuleId) => {
    setNewModules((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((m) => m !== id)
          : prev
        : [...prev, id],
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
                <Users className="size-3.5" />
                SparrowX Master Subscription & Tenant Control
              </div>
              <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">
                Client subscriptions & service modules
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Provision client tenants, manage subscription tiers, and control which service modules appear in each client’s dynamic dashboard.
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
                <article
                  className="border border-border bg-card p-5"
                  key={tenant.id}
                >
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
                        <Eye className="size-3.5" /> Open Client’s Dynamic View
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
                      Active Dashboard Modules for {tenant.name} (Click to enable/disable in client portal):
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
                Monitor per-client ingestion volume, edge inspection latency, quota consumption, and API key kill-switches.
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
                        <span className="text-muted-foreground">Plan Quota Usage ({tenant.planTier})</span>
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
                Protect our own operations side first—enforce strict staff access controls and audit every action across client tenants.
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
                Requires hardware security keys before any staff member can view or modify client subscriptions.
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
              <h2 className="text-base font-semibold">
                Immutable Staff & Automation Audit Trail
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Every onboarding event, module change, API key rotation, and kill-switch action is recorded below.
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
                  No audit events recorded yet. Provision a client or toggle a security control to see live audit logging.
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
