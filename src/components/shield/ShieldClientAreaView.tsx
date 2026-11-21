import React, { useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  Gamepad2,
  Globe,
  KeyRound,
  LayoutDashboard,
  Plus,
  Server,
  ShieldCheck,
  Terminal,
  Webhook,
} from "lucide-react";
import {
  persistClientTenantToBackend,
  persistProtectedServiceToBackend,
  type AppUser,
  type ClientTenant,
  type Incident,
  type ProtectedService,
  type ServiceModuleId,
} from "@/lib/supabase";
import { getSavedWebhooks } from "@/lib/advanced-features";
import { validateSafePublicTarget } from "@/components/GrowthAndMonetizationHub";
import { SparrowxFooter } from "@/components/SparrowxFooter";
import { emitEngineToast } from "@/components/BackgroundEngineToaster";
import { GAMESEC_URL } from "./ShieldLandingView";

export interface ShieldClientAreaViewProps {
  activeUser: AppUser;
  tenants: ClientTenant[];
  services: ProtectedService[];
  incidents: Incident[];
  onTenantsUpdated: (next: ClientTenant[]) => void;
  onServicesUpdated: (next: ProtectedService[]) => void;
  onOpenDashboard: () => void;
  onBackToLanding: () => void;
  onSignOut: () => void;
}

const MODULE_META: Array<{ id: ServiceModuleId; label: string }> = [
  { id: "web_security", label: "Edge L7 WAF" },
  { id: "ai_shield", label: "AI Prompt Firewall" },
  { id: "cloud_security", label: "Cloud API Shield" },
  { id: "compliance", label: "SOC Audit Logs" },
];

function makeApiKey(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `spx_live_${hex || Date.now().toString(16)}`;
}

export function ShieldClientAreaView({
  activeUser,
  tenants,
  services,
  incidents,
  onTenantsUpdated,
  onServicesUpdated,
  onOpenDashboard,
  onBackToLanding,
  onSignOut,
}: ShieldClientAreaViewProps) {
  const [domainInput, setDomainInput] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [adding, setAdding] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const toggleKeyVisibility = (id: string) => {
    setRevealedKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const webhooks = typeof window !== "undefined" ? getSavedWebhooks() : [];
  const activeIncidentsCount = incidents.filter((i) => i.status !== "Contained").length;
  const wafConfigured = tenants.length > 0;
  const aiConfigured = tenants.some((t) => t.enabledModules.includes("ai_shield") || t.guardrailsActive);
  const webhookConfigured = webhooks.some((w) => w.enabled);

  const handleCopy = (id: string, text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedId(id);
        emitEngineToast("Ready to paste into your reverse proxy or app.", "success", `${label} copied`);
        setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1600);
      },
      () => emitEngineToast("Copy the key manually.", "info", "Clipboard blocked"),
    );
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const check = validateSafePublicTarget(domainInput);
    if (!check.valid) {
      setFormError(check.error ?? "Enter a valid public domain such as yourdomain.com.");
      return;
    }

    setAdding(true);
    try {
      const apiKey = makeApiKey();
      const tenantId = `tnt-${Date.now().toString(36)}`;
      const cleanName = workspaceName.trim() || check.cleanHost;
      const newTenant: ClientTenant = {
        id: tenantId,
        name: cleanName,
        contactEmail: activeUser.email,
        primaryDomain: check.cleanHost,
        planTier: "Startup Shield",
        status: "Active",
        enabledModules: ["web_security", "ai_shield"],
        apiKey,
        sdkVerified: false,
        guardrailsActive: true,
        requestsPerMin: 0,
        blockedThreats: 0,
        avgLatencyMs: 0,
        quotaUsedPct: 0,
      };
      const newService: ProtectedService = {
        id: `svc-${Date.now().toString(36)}`,
        tenantId,
        name: cleanName,
        category: "Web App & Website",
        endpoint: `https://${check.cleanHost}`,
        mode: "Active Shield",
        requests24h: "0 req",
        blockedThreats: 0,
        apiKey,
        promptShield: true,
        piiRedaction: true,
        toolCallFirewall: true,
        lastHeartbeat: "Awaiting first telemetry beacon",
      };
      await Promise.all([
        persistClientTenantToBackend(newTenant),
        persistProtectedServiceToBackend(newService),
      ]);
      onTenantsUpdated([newTenant, ...tenants]);
      onServicesUpdated([newService, ...services]);
      setDomainInput("");
      setWorkspaceName("");
      emitEngineToast(
        `${check.cleanHost} added to your Client Area with fresh key.`,
        "success",
        "Protected Domain Registered",
      );
    } finally {
      setAdding(false);
    }
  };

  const toggleModule = async (tenant: ClientTenant, mod: ServiceModuleId) => {
    const exists = tenant.enabledModules.includes(mod);
    const nextModules = exists
      ? tenant.enabledModules.filter((m) => m !== mod)
      : [...tenant.enabledModules, mod];
    const updated: ClientTenant = {
      ...tenant,
      enabledModules: nextModules,
      guardrailsActive: nextModules.includes("ai_shield"),
    };
    await persistClientTenantToBackend(updated);
    onTenantsUpdated(tenants.map((t) => (t.id === tenant.id ? updated : t)));
  };

  return (
    <div className="font-soc min-h-screen bg-[#090B11] text-[#F4F6FA] flex flex-col selection:bg-[#F9103A] selection:text-[#F4F6FA]">
      {/* Sticky Client Area Header */}
      <header className="sticky top-0 z-40 border-b border-[#F4F6FA]/[0.08] bg-[#090B11]/95 backdrop-blur-xl px-4 sm:px-6 py-3">
        <div className="max-w-[1380px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/logos/sparrowx-shield.png"
              alt="SparrowX Shield"
              width={34}
              height={34}
              className="size-8.5 object-contain shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-semibold text-[#F4F6FA]">SparrowX Shield</span>
                <span className="rounded-md border border-[#10B981]/35 bg-[#10B981]/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#10B981]">
                  CLIENT AREA
                </span>
              </div>
              <p className="text-[11px] text-[#F4F6FA]/45 hidden sm:block">sec.sparrowx.net · Operator Workspace</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onBackToLanding}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#F4F6FA]/12 bg-[#121620] px-3 py-1.5 text-xs text-[#F4F6FA]/75 hover:text-[#F4F6FA] cursor-pointer"
            >
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">Public Landing</span>
            </button>

            <button
              type="button"
              onClick={onOpenDashboard}
              data-testid="enter-soc-dashboard-btn"
              className="inline-flex items-center gap-2 rounded-lg bg-[#F9103A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#F9103A]/90 transition-colors cursor-pointer shadow-[0_6px_20px_rgba(249,16,58,0.3)]"
            >
              <LayoutDashboard className="size-3.5" />
              <span>Open Security &amp; SOC Dashboard</span>
              <ArrowRight className="size-3.5" />
            </button>

            <button
              type="button"
              onClick={onSignOut}
              className="rounded-lg border border-[#F4F6FA]/12 bg-[#121620] px-3 py-1.5 text-xs text-[#F4F6FA]/70 hover:text-[#F4F6FA] cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1380px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Welcome Banner + Prominent Dashboard Button */}
        <section className="relative overflow-hidden rounded-2xl border border-[#F9103A]/30 bg-gradient-to-br from-[#140E16] via-[#0D1017] to-[#0A1116] p-6 sm:p-8 shadow-2xl">
          <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-[#F9103A]/15 blur-3xl" />
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#10B981]/35 bg-[#10B981]/10 px-3 py-1 font-mono text-[11px] text-[#10B981]">
                <span className="size-1.5 rounded-full bg-[#10B981]" />
                <span>Authenticated Operator · {activeUser.email}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F4F6FA]">
                Welcome back, {activeUser.fullName || activeUser.email.split("@")[0]}
              </h1>
              <p className="max-w-2xl text-xs sm:text-sm text-[#F4F6FA]/65">
                Configure your domains, ingestion keys, and defense modules here in the Client Area, or launch the live Security + SOC Dashboard to triage incidents, test AI guardrails, and export edge firewall rules.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <button
                type="button"
                onClick={onOpenDashboard}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F9103A] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#F9103A]/90 transition-all cursor-pointer shadow-[0_10px_28px_rgba(249,16,58,0.35)]"
              >
                <ShieldCheck className="size-4" />
                <span>Open Dashboard</span>
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Honest Module Status Matrix (Strict Rule: Off / Not Configured until integrated) */}
        <section aria-label="Module Configuration Status" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Edge L7 WAF",
              configured: wafConfigured,
              value: wafConfigured ? `${tenants.length} Domain${tenants.length > 1 ? "s" : ""} Registered` : "Not Configured",
              sub: wafConfigured ? "Keys issued · Ready for proxy" : "Add a domain below to enable",
              icon: Globe,
            },
            {
              title: "AI Prompt Guardrail",
              configured: aiConfigured,
              value: aiConfigured ? "Enabled" : "Not Configured",
              sub: aiConfigured ? "Prompt injection & PII sanitizer ready" : "Enable on a domain or test in SOC",
              icon: Terminal,
            },
            {
              title: "SOC Incident Queue",
              configured: true,
              value: `${activeIncidentsCount} Open Incidents`,
              sub: incidents.length === 0 ? "Perimeter quiet — zero fake alerts" : `${incidents.length} total recorded events`,
              icon: Activity,
            },
            {
              title: "Alert Webhooks",
              configured: webhookConfigured,
              value: webhookConfigured ? `${webhooks.filter((w) => w.enabled).length} Active` : "Not Configured",
              sub: webhookConfigured ? "Discord / Slack / SIEM linked" : "Off — configure inside Dashboard",
              icon: Webhook,
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="rounded-2xl border border-[#F4F6FA]/[0.08] bg-[#0D1017] p-5 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#F4F6FA]/70">{card.title}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                      card.configured
                        ? "border border-[#10B981]/35 bg-[#10B981]/10 text-[#10B981]"
                        : "border border-[#F96246]/30 bg-[#F96246]/10 text-[#F96246]"
                    }`}
                  >
                    {card.configured ? "Ready" : "Off"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-[#F4F6FA]/50 shrink-0" />
                  <span className="text-base font-semibold text-[#F4F6FA]">{card.value}</span>
                </div>
                <p className="text-[11px] text-[#F4F6FA]/50">{card.sub}</p>
              </div>
            );
          })}
        </section>

        {/* Register Protected Domain + Connected Domains List */}
        <div className="grid gap-6 lg:grid-cols-[1.05fr_1.45fr]">
          <section className="rounded-2xl border border-[#F4F6FA]/[0.08] bg-[#0D1017] p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl border border-[#F9103A]/35 bg-[#F9103A]/15 text-[#F9103A] grid place-items-center">
                <Plus className="size-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#F4F6FA]">Register Protected Domain</h2>
                <p className="text-xs text-[#F4F6FA]/50">Generates a tenant API key &amp; module config.</p>
              </div>
            </div>

            {formError && (
              <div className="rounded-xl border border-[#F9103A]/35 bg-[#F9103A]/10 px-3 py-2 text-xs text-[#FFEBB9]">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddDomain} className="space-y-3.5">
              <div>
                <label htmlFor="shield-domain-input" className="block text-xs text-[#F4F6FA]/70 mb-1.5">
                  Public Domain Hostname
                </label>
                <input
                  id="shield-domain-input"
                  type="text"
                  required
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="yourdomain.com"
                  className="h-10 w-full rounded-xl border border-[#F4F6FA]/12 bg-[#07090E] px-3.5 font-mono text-xs text-[#F4F6FA] placeholder-[#F4F6FA]/35 outline-none focus:border-[#F9103A]"
                />
              </div>
              <div>
                <label htmlFor="shield-workspace-input" className="block text-xs text-[#F4F6FA]/70 mb-1.5">
                  Service Label (Optional)
                </label>
                <input
                  id="shield-workspace-input"
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Production Web Gateway"
                  className="h-10 w-full rounded-xl border border-[#F4F6FA]/12 bg-[#07090E] px-3.5 text-xs text-[#F4F6FA] placeholder-[#F4F6FA]/35 outline-none focus:border-[#F9103A]"
                />
              </div>
              <button
                type="submit"
                disabled={adding}
                className="w-full h-10 rounded-xl bg-[#F9103A] hover:bg-[#F9103A]/90 text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Plus className="size-4" />
                <span>{adding ? "Provisioning..." : "Provision Domain & API Key"}</span>
              </button>
            </form>

            {/* Game DDoS Redirect Panel inside Client Area */}
            <div className="pt-3 border-t border-[#F4F6FA]/[0.07]">
              <div className="rounded-xl border border-[#F96246]/30 bg-[#140F14] p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#FFEBB9]">
                  <Gamepad2 className="size-4 text-[#F96246]" />
                  <span>Need Game Server DDoS Protection?</span>
                </div>
                <p className="text-[11px] text-[#F4F6FA]/60 leading-relaxed">
                  Protecting a FiveM, Minecraft, SA-MP, or dedicated game server from DDoS attacks? Visit <span className="font-mono text-[#F4F6FA]">gamesec.sparrowx.net</span>.
                </p>
                <a
                  href={GAMESEC_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#F96246]/40 bg-[#F96246]/15 px-3 py-1.5 text-xs font-medium text-[#FFEBB9] hover:bg-[#F96246]/25 transition-colors"
                >
                  <Server className="size-3.5" />
                  <span>Open gamesec.sparrowx.net</span>
                  <ArrowRight className="size-3.5" />
                </a>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#F4F6FA]/[0.08] bg-[#0D1017] p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl border border-[#10B981]/35 bg-[#10B981]/15 text-[#10B981] grid place-items-center">
                  <KeyRound className="size-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#F4F6FA]">Configured Domains &amp; Keys</h2>
                  <p className="text-xs text-[#F4F6FA]/50">Toggle defense modules or copy telemetry credentials.</p>
                </div>
              </div>
            </div>

            {tenants.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#F4F6FA]/14 bg-[#07090E]/70 p-8 text-center space-y-2">
                <p className="text-sm font-medium text-[#F4F6FA]/85">No Protected Domains Configured Yet</p>
                <p className="text-xs text-[#F4F6FA]/50 max-w-md mx-auto">
                  Everything starts OFF by default so you never mistake simulated stats for live traffic. Register your domain on the left or open the SOC Dashboard directly.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tenants.map((tenant) => (
                  <div
                    key={tenant.id}
                    className="rounded-xl border border-[#F4F6FA]/[0.08] bg-[#07090E]/90 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-[#F4F6FA]">
                            {tenant.primaryDomain}
                          </span>
                          <span className="rounded-full border border-[#10B981]/35 bg-[#10B981]/10 px-2 py-0.5 text-[10px] text-[#10B981]">
                            {tenant.planTier}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#F4F6FA]/45 mt-0.5">{tenant.name}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <code className="rounded border border-[#F4F6FA]/10 bg-[#121622] px-2.5 py-1 font-mono text-[11px] text-[#F4F6FA]/80">
                          {revealedKeys[tenant.id]
                            ? tenant.apiKey
                            : `${tenant.apiKey.slice(0, 8)}••••••••${tenant.apiKey.slice(-4)}`}
                        </code>
                        <button
                          type="button"
                          onClick={() => toggleKeyVisibility(tenant.id)}
                          aria-label={revealedKeys[tenant.id] ? `Hide API key for ${tenant.primaryDomain}` : `Reveal API key for ${tenant.primaryDomain}`}
                          title={revealedKeys[tenant.id] ? "Hide API key" : "Reveal API key"}
                          className="rounded-lg border border-[#F4F6FA]/12 bg-[#121622] p-1.5 text-[#F4F6FA]/70 hover:text-white cursor-pointer"
                        >
                          {revealedKeys[tenant.id] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(tenant.id, tenant.apiKey, "Ingestion Key")}
                          aria-label={`Copy API key for ${tenant.primaryDomain}`}
                          className="rounded-lg border border-[#F4F6FA]/12 bg-[#121622] p-1.5 text-[#F4F6FA]/70 hover:text-white cursor-pointer"
                        >
                          {copiedId === tenant.id ? <Check className="size-3.5 text-[#10B981]" /> : <Copy className="size-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {MODULE_META.map((mod) => {
                        const enabled = tenant.enabledModules.includes(mod.id);
                        return (
                          <button
                            key={mod.id}
                            type="button"
                            onClick={() => void toggleModule(tenant, mod.id)}
                            className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium cursor-pointer transition-colors ${
                              enabled
                                ? "border-[#10B981]/40 bg-[#10B981]/15 text-[#10B981]"
                                : "border-[#F4F6FA]/12 bg-[#121622] text-[#F4F6FA]/50 hover:text-[#F4F6FA]"
                            }`}
                          >
                            {mod.label}: {enabled ? "ON" : "OFF"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <SparrowxFooter
        isAuthenticated={true}
        onSignIn={() => {}}
        onSignOut={onSignOut}
      />
    </div>
  );
}
