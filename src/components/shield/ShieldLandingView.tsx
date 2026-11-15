import React, { useState } from "react";
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  Cpu,
  Download,
  Flame,
  Gamepad2,
  Globe,
  Lock,
  RefreshCw,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { SPARROWX_PLANS, type SparrowxPlan } from "@/lib/sparrowx-plans";
import type { AppUser } from "@/lib/supabase";
import {
  downloadBrandedHtmlSecurityReport,
  runLivePublicDomainScan,
  validateSafePublicTarget,
  type LiveDomainAuditResult,
} from "@/components/GrowthAndMonetizationHub";
import { SparrowxFooter } from "@/components/SparrowxFooter";

export const GAMESEC_URL = "https://gamesec.sparrowx.net";

export interface ShieldLandingViewProps {
  activeUser: AppUser | null;
  onOpenAuthModal: (mode?: "signin" | "register") => void;
  onEnterClientArea: () => void;
  onEnterDashboard: () => void;
  onSignOut: () => void;
}

export function ShieldLandingView({
  activeUser,
  onOpenAuthModal,
  onEnterClientArea,
  onEnterDashboard,
  onSignOut,
}: ShieldLandingViewProps) {
  const [scanInput, setScanInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [liveAudit, setLiveAudit] = useState<LiveDomainAuditResult | null>(null);
  const [currency, setCurrency] = useState<"INR" | "USD" | "EUR">("INR");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const runLandingScan = async (overrideDomain?: string) => {
    const raw = (overrideDomain ?? scanInput).trim();
    if (!raw) {
      setScanError("Enter a public domain such as yourdomain.com to inspect headers & TLS.");
      return;
    }
    setScanning(true);
    setScanError(null);
    try {
      const check = validateSafePublicTarget(raw);
      if (!check.valid) {
        setScanError(check.error ?? "Invalid public domain.");
        return;
      }
      const res = await runLivePublicDomainScan(check.cleanHost);
      setLiveAudit(res);
      setScanInput(check.cleanHost);
    } catch {
      setScanError("Unable to reach public inspection endpoint right now.");
    } finally {
      setScanning(false);
    }
  };

  const formatPlanPrice = (plan: SparrowxPlan) => {
    const usd = billingCycle === "annual" ? plan.annualPriceMonthly : plan.monthlyPrice;
    if (currency === "INR") return `₹${Math.round(usd * 85).toLocaleString("en-IN")}`;
    if (currency === "EUR") return `€${Math.round(usd * 0.92)}`;
    return `$${usd}`;
  };

  return (
    <div className="font-soc min-h-screen bg-[#090B11] text-[#F4F6FA] flex flex-col selection:bg-[#F9103A] selection:text-[#F4F6FA]">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-40 border-b border-[#F4F6FA]/[0.08] bg-[#090B11]/92 backdrop-blur-xl px-4 sm:px-6 py-3">
        <div className="max-w-[1380px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/logos/sparrowx-shield.png"
              alt="SparrowX Shield"
              width={36}
              height={36}
              className="size-9 object-contain shrink-0 drop-shadow-[0_4px_14px_rgba(249,16,58,0.28)]"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold tracking-tight text-[#F4F6FA]">SparrowX Shield</span>
                <span className="hidden sm:inline-flex items-center rounded-full border border-[#F9103A]/35 bg-[#F9103A]/10 px-2 py-0.5 font-mono text-[10px] text-[#F96246]">
                  sec.sparrowx.net
                </span>
              </div>
              <p className="text-[11px] text-[#F4F6FA]/45 hidden sm:block">Edge WAF · Origin Cloaking · Autonomous SOC</p>
            </div>
          </div>

          <nav aria-label="SparrowX Shield Navigation" className="hidden md:flex items-center gap-6 text-xs text-[#F4F6FA]/70">
            <a href="#shield-features" className="hover:text-[#F4F6FA] transition-colors">Capabilities</a>
            <a href="#shield-scanner" className="hover:text-[#F4F6FA] transition-colors">Live Audit</a>
            <a href="#shield-game-ddos" className="text-[#F96246] hover:text-[#F9103A] font-medium transition-colors flex items-center gap-1.5">
              <Gamepad2 className="size-3.5" /> Game DDoS Defense
            </a>
            <a href="#shield-agent-plans" className="hover:text-[#F4F6FA] transition-colors">Plans</a>
          </nav>

          <div className="flex items-center gap-2.5">
            {activeUser ? (
              <>
                <button
                  type="button"
                  onClick={onEnterClientArea}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#F9103A] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#F9103A]/90 transition-colors cursor-pointer shadow-[0_6px_20px_rgba(249,16,58,0.28)]"
                >
                  <span>Client Area</span>
                  <ArrowRight className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onEnterDashboard}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[#10B981]/35 bg-[#10B981]/10 px-3 py-2 text-xs font-medium text-[#10B981] hover:bg-[#10B981]/20 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="size-3.5" />
                  <span>SOC Dashboard</span>
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="rounded-lg border border-[#F4F6FA]/12 bg-[#121620] px-3 py-2 text-xs text-[#F4F6FA]/75 hover:text-[#F4F6FA] cursor-pointer"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onOpenAuthModal("register")}
                  className="hidden sm:inline-flex items-center rounded-lg border border-[#F4F6FA]/12 bg-[#121620] px-3.5 py-2 text-xs font-medium text-[#F4F6FA]/85 hover:border-[#F4F6FA]/25 cursor-pointer"
                >
                  Create Account
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuthModal("signin")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#F9103A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#F9103A]/90 transition-colors cursor-pointer shadow-[0_6px_20px_rgba(249,16,58,0.32)]"
                >
                  <Lock className="size-3.5" />
                  <span>Client Login</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-[#F4F6FA]/[0.07]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-36 left-1/2 -translate-x-1/2 h-[460px] w-[780px] rounded-full bg-[radial-gradient(circle,rgba(249,16,58,0.16),rgba(249,98,70,0.06)_45%,transparent_72%)] blur-2xl"
          />
          <div className="max-w-[1380px] mx-auto px-4 sm:px-6 py-14 sm:py-20 grid gap-10 lg:grid-cols-[1.15fr_0.95fr] items-center relative">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#F9103A]/35 bg-[#F9103A]/10 px-3.5 py-1 text-[11px] font-medium text-[#F96246]">
                <span className="size-1.5 rounded-full bg-[#10B981]" />
                <span>SPARROWX SHIELD · EDGE WAF &amp; AUTONOMOUS SOC</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-semibold tracking-[-0.03em] leading-[1.08] text-[#F4F6FA]">
                Stop L7 floods, prompt exploits, and origin leaks before packets hit your app.
              </h1>

              <p className="max-w-2xl text-sm sm:text-base text-[#F4F6FA]/65 leading-relaxed">
                Deploy SparrowX Shield in front of websites, APIs, and LLM agents. Sign in to provision your Client Area key, inspect live origin headers, export Cloudflare &amp; NGINX blocklists, and operate a clean autonomous SOC workbench.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                {activeUser ? (
                  <>
                    <button
                      type="button"
                      onClick={onEnterClientArea}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#F9103A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#F9103A]/90 transition-all cursor-pointer shadow-[0_10px_28px_rgba(249,16,58,0.34)]"
                    >
                      <span>Go to Client Area</span>
                      <ArrowRight className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={onEnterDashboard}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#10B981]/35 bg-[#10B981]/10 px-5 py-3 text-sm font-medium text-[#10B981] hover:bg-[#10B981]/20 transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="size-4" />
                      <span>Open SOC Dashboard</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenAuthModal("signin")}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#F9103A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#F9103A]/90 transition-all cursor-pointer shadow-[0_10px_28px_rgba(249,16,58,0.34)]"
                    >
                      <Lock className="size-4" />
                      <span>Sign In to Client Area</span>
                      <ArrowRight className="size-4" />
                    </button>
                    <a
                      href="#shield-scanner"
                      className="inline-flex items-center gap-2 rounded-xl border border-[#F4F6FA]/14 bg-[#111520] px-5 py-3 text-sm font-medium text-[#F4F6FA]/85 hover:border-[#F4F6FA]/30 transition-colors"
                    >
                      <Globe className="size-4 text-[#F96246]" />
                      <span>Run Free Header Audit</span>
                    </a>
                  </>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#F4F6FA]/[0.08] max-w-lg text-xs">
                <div>
                  <span className="block font-semibold text-[#F4F6FA]">Zero Fake Alerts</span>
                  <span className="text-[#F4F6FA]/50 text-[11px]">Unconfigured modules stay OFF</span>
                </div>
                <div>
                  <span className="block font-semibold text-[#F4F6FA]">SHA-256 Audit Chain</span>
                  <span className="text-[#F4F6FA]/50 text-[11px]">Tamper-evident SOC logs</span>
                </div>
                <div>
                  <span className="block font-semibold text-[#F4F6FA]">1-Click Export</span>
                  <span className="text-[#F4F6FA]/50 text-[11px]">Cloudflare, AWS, NGINX, UFW</span>
                </div>
              </div>
            </div>

            {/* Interactive Live Perimeter Audit Card */}
            <div
              id="shield-scanner"
              className="rounded-2xl border border-[#F4F6FA]/[0.09] bg-[#0D1017]/95 p-5 sm:p-6 shadow-[0_24px_70px_rgba(0,0,0,0.75)] space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F4F6FA]">
                    <Globe className="size-4 text-[#F96246]" /> Live Public Domain Perimeter Audit
                  </span>
                  <p className="text-[11px] text-[#F4F6FA]/50 mt-0.5">
                    Real DNS, TLS, and HTTP security header verification — no synthetic data.
                  </p>
                </div>
                <span className="rounded-full border border-[#F4F6FA]/12 bg-[#131823] px-2.5 py-0.5 font-mono text-[10px] text-[#10B981]">
                  {liveAudit ? `Score ${liveAudit.score}/100` : "Standby"}
                </span>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void runLandingScan();
                }}
                className="flex flex-col sm:flex-row gap-2"
              >
                <div className="relative flex-1">
                  <Globe className="size-4 text-[#F4F6FA]/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="yourdomain.com"
                    aria-label="Enter public domain for audit"
                    className="h-10 w-full rounded-xl border border-[#F4F6FA]/12 bg-[#07090E] pl-9 pr-3 font-mono text-xs text-[#F4F6FA] placeholder-[#F4F6FA]/35 outline-none focus:border-[#F9103A]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={scanning}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F9103A] px-5 h-10 text-xs font-semibold text-white hover:bg-[#F9103A]/90 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <RefreshCw className={`size-3.5 ${scanning ? "animate-spin" : ""}`} />
                  <span>{scanning ? "Scanning..." : "Inspect Domain"}</span>
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#F4F6FA]/50">
                <span>Try example:</span>
                <button
                  type="button"
                  onClick={() => void runLandingScan("sparrowx.net")}
                  className="rounded border border-[#F4F6FA]/12 bg-[#121622] px-2 py-0.5 font-mono text-[#F4F6FA]/80 hover:border-[#F96246]/50 cursor-pointer"
                >
                  sparrowx.net
                </button>
                <button
                  type="button"
                  onClick={() => void runLandingScan("yourdomain.com")}
                  className="rounded border border-[#F4F6FA]/12 bg-[#121622] px-2 py-0.5 font-mono text-[#F4F6FA]/80 hover:border-[#F96246]/50 cursor-pointer"
                >
                  yourdomain.com
                </button>
              </div>

              {scanError && (
                <div className="rounded-xl border border-[#F9103A]/35 bg-[#F9103A]/10 px-3.5 py-2.5 text-xs text-[#FFEBB9]">
                  {scanError}
                </div>
              )}

              {liveAudit ? (
                <div className="space-y-3 rounded-xl border border-[#F4F6FA]/[0.08] bg-[#07090E]/90 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F4F6FA]/[0.07] pb-2.5">
                    <div>
                      <span className="font-mono text-xs font-semibold text-[#F4F6FA]">{liveAudit.cleanHost}</span>
                      <p className="text-[11px] text-[#F4F6FA]/50 mt-0.5">
                        {liveAudit.findings.length} live checks evaluated
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadBrandedHtmlSecurityReport(liveAudit)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#F4F6FA]/15 bg-[#121622] px-3 py-1.5 text-[11px] font-medium text-[#F4F6FA] hover:border-[#10B981]/50 cursor-pointer"
                    >
                      <Download className="size-3.5 text-[#10B981]" /> HTML Report
                    </button>
                  </div>
                  <ul className="space-y-2 max-h-52 overflow-y-auto pr-1 text-xs">
                    {liveAudit.findings.slice(0, 5).map((f, idx) => (
                      <li
                        key={`${f.title}-${idx}`}
                        className="flex items-start justify-between gap-3 rounded-lg border border-[#F4F6FA]/[0.05] bg-[#0D1017] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-[#F4F6FA] truncate">{f.title}</p>
                          <p className="text-[11px] text-[#F4F6FA]/55 truncate">{f.detail}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded px-2 py-0.5 font-mono text-[10px] uppercase ${
                            f.status === "passed"
                              ? "bg-[#10B981]/15 text-[#10B981]"
                              : f.status === "warning"
                                ? "bg-[#FFEBB9]/15 text-[#FFEBB9]"
                                : "bg-[#F9103A]/15 text-[#F9103A]"
                          }`}
                        >
                          {f.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#F4F6FA]/12 bg-[#07090E]/60 p-5 text-center space-y-1.5">
                  <p className="text-xs font-medium text-[#F4F6FA]/80">No Domain Audited Yet</p>
                  <p className="text-[11px] text-[#F4F6FA]/45">
                    Enter your domain above to run live HSTS, CSP, X-Frame-Options, and DNS verification.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Capabilities Grid */}
        <section id="shield-features" className="max-w-[1380px] mx-auto px-4 sm:px-6 py-14 sm:py-18 space-y-8">
          <div className="max-w-2xl">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#F96246]">
              PRODUCTION DEFENSE STACK
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">
              Built for operators who need real signal — never noisy dashboards.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Shield,
                accent: "text-[#F9103A] border-[#F9103A]/30 bg-[#F9103A]/10",
                title: "Origin Cloaking & L7 WAF",
                desc: "Inspect real headers, enforce HSTS/CSP policies, and block automated vulnerability scanners before origin access.",
              },
              {
                icon: Cpu,
                accent: "text-[#F96246] border-[#F96246]/30 bg-[#F96246]/10",
                title: "AI Prompt & Tool Firewall",
                desc: "Detect jailbreaks, PII/secret leakage, and destructive MCP tool calls inline with deterministic sub-15ms sanitization.",
              },
              {
                icon: Activity,
                accent: "text-[#10B981] border-[#10B981]/30 bg-[#10B981]/10",
                title: "SOC Triage & Audit Chain",
                desc: "Isolate compromised assets and record immutable SHA-256 chained audit logs across your team.",
              },
              {
                icon: Terminal,
                accent: "text-cyan-300 border-cyan-400/30 bg-cyan-500/10",
                title: "1-Click Firewall Rules",
                desc: "Compile active IOCs directly into Cloudflare Expressions, AWS WAF IP Sets, NGINX deny lists, or iptables scripts.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-[#F4F6FA]/[0.08] bg-[#0D1017] p-5 space-y-3 hover:border-[#F4F6FA]/20 transition-colors"
                >
                  <div className={`size-10 rounded-xl border grid place-items-center ${item.accent}`}>
                    <Icon className="size-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#F4F6FA]">{item.title}</h3>
                  <p className="text-xs text-[#F4F6FA]/60 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* SEPARATE DEDICATED GAME SERVER / DDOS REDIRECT SECTION */}
        <section id="shield-game-ddos" className="max-w-[1380px] mx-auto px-4 sm:px-6 py-4">
          <div className="relative overflow-hidden rounded-2xl border border-[#F96246]/35 bg-gradient-to-br from-[#160D12] via-[#0D1017] to-[#0A1116] p-6 sm:p-10 shadow-[0_20px_70px_rgba(249,16,58,0.14)]">
            <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[#F9103A]/15 blur-3xl" />
            <div className="relative grid gap-6 lg:grid-cols-[1.4fr_auto] items-center">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#F96246]/40 bg-[#F96246]/12 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-[#FFEBB9]">
                  <Flame className="size-3.5 text-[#F96246]" />
                  <span>Separate Game &amp; L4 Server Protection Portal</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F4F6FA]">
                  Want to secure your game? Need to protect your server from DDoS attack?
                </h2>
                <p className="max-w-2xl text-xs sm:text-sm text-[#F4F6FA]/65 leading-relaxed">
                  FiveM, Minecraft, SA-MP, Rust, and raw TCP/UDP game servers require dedicated Anycast L4 packet scrubbing and stateful RakNet/ENet filtering. Launch our dedicated Game DDoS Defense platform on <span className="font-mono text-[#F4F6FA]">gamesec.sparrowx.net</span>.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                <a
                  href={GAMESEC_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#F9103A] to-[#F96246] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(249,16,58,0.34)] hover:brightness-110 transition-all"
                >
                  <Server className="size-4" />
                  <span>Protect Your Game Server</span>
                  <ArrowRight className="size-4" />
                </a>
                <span className="text-center font-mono text-[11px] text-[#F4F6FA]/50">
                  Redirects to gamesec.sparrowx.net
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Plans Section */}
        <section id="shield-agent-plans" className="max-w-[1380px] mx-auto px-4 sm:px-6 py-14 sm:py-18 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#10B981]">
                EDGE &amp; SOC PLANS
              </span>
              <h2 className="mt-1.5 text-2xl sm:text-3xl font-semibold tracking-tight">
                Scale from single-domain cloaking to sovereign SOC operations.
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-[#F4F6FA]/12 bg-[#0D1017] p-0.5 text-xs">
                {(["monthly", "annual"] as const).map((cycle) => (
                  <button
                    key={cycle}
                    type="button"
                    onClick={() => setBillingCycle(cycle)}
                    className={`rounded-md px-3 py-1.5 capitalize cursor-pointer transition-colors ${
                      billingCycle === cycle
                        ? "bg-[#F9103A] text-white font-medium"
                        : "text-[#F4F6FA]/60 hover:text-[#F4F6FA]"
                    }`}
                  >
                    {cycle}
                  </button>
                ))}
              </div>
              <div className="flex rounded-lg border border-[#F4F6FA]/12 bg-[#0D1017] p-0.5 text-xs font-mono">
                {(["INR", "USD", "EUR"] as const).map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => setCurrency(cur)}
                    className={`rounded-md px-2.5 py-1.5 cursor-pointer transition-colors ${
                      currency === cur
                        ? "bg-[#F4F6FA]/15 text-white font-semibold"
                        : "text-[#F4F6FA]/55 hover:text-[#F4F6FA]"
                    }`}
                  >
                    {cur}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SPARROWX_PLANS.map((plan) => {
              const popular = plan.id === "STARTUP_SHIELD" || plan.id === "AI_AGENT_SHIELD";
              return (
                <div
                  key={plan.id}
                  className={`flex flex-col justify-between rounded-2xl border p-6 space-y-5 bg-[#0D1017] ${
                    popular
                      ? "border-[#F9103A]/55 shadow-[0_12px_40px_rgba(249,16,58,0.14)]"
                      : "border-[#F4F6FA]/[0.08]"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] uppercase tracking-wider text-[#F96246]">
                        {plan.tier}
                      </span>
                      {popular && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F9103A]/15 border border-[#F9103A]/35 px-2.5 py-0.5 text-[10px] font-semibold text-[#F9103A]">
                          <Sparkles className="size-3" /> Popular
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-[#F4F6FA]">{plan.name}</h3>
                    <p className="text-xs text-[#F4F6FA]/55">{plan.tagline}</p>
                    <div className="pt-1 flex items-baseline gap-1.5">
                      <span className="text-3xl font-semibold text-[#F4F6FA]">{formatPlanPrice(plan)}</span>
                      <span className="text-xs text-[#F4F6FA]/45">/month</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-[#F4F6FA]/65 border-t border-[#F4F6FA]/[0.06]">
                      <span>Domains: <strong className="text-[#F4F6FA]">{plan.maxDomains === -1 ? "Unlimited" : plan.maxDomains}</strong></span>
                      <span>SLA: <strong className="text-[#10B981]">{plan.sla}</strong></span>
                    </div>
                    <ul className="space-y-2 pt-1 text-xs text-[#F4F6FA]/75">
                      {plan.highlights.map((h) => (
                        <li key={h} className="flex items-start gap-2 text-[11px]">
                          <Check className="size-3.5 text-[#10B981] shrink-0 mt-0.5" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => (activeUser ? onEnterClientArea() : onOpenAuthModal("register"))}
                    className={`w-full rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      popular
                        ? "bg-[#F9103A] text-white hover:bg-[#F9103A]/90 shadow-[0_6px_20px_rgba(249,16,58,0.28)]"
                        : "border border-[#F4F6FA]/14 bg-[#121622] text-[#F4F6FA] hover:bg-white hover:text-black"
                    }`}
                  >
                    <Zap className="size-3.5" />
                    <span>{activeUser ? "Configure in Client Area" : `Start with ${plan.name}`}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <SparrowxFooter
        isAuthenticated={Boolean(activeUser)}
        onSignIn={() => onOpenAuthModal("signin")}
        onSignOut={onSignOut}
      />
    </div>
  );
}
