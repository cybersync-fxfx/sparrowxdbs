import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Check,
  Download,
  Flame,
  Gamepad2,
  Globe,
  Lock,
  Pause,
  Play,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
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
import { PurchasePolicyNotice } from "@/components/PurchasePolicyNotice";
import { UnderAttackModal } from "@/components/shield/UnderAttackModal";
import { SmoothScroll } from "@/components/shared/SmoothScroll";
import { ParticleField } from "@/components/shared/ParticleField";
import { GridCanvas } from "@/components/shared/GridCanvas";
import { ThreeModelViewer } from "@/components/shared/ThreeModelViewer";
import { InteractiveCard } from "@/components/shared/InteractiveCard";
import { BentoCard, BentoGrid } from "@/components/shared/BentoGrid";

export const GAMESEC_URL = "https://gamesec.sparrowx.net";

export interface ShieldLandingViewProps {
  activeUser: AppUser | null;
  onOpenAuthModal: (mode?: "signin" | "register", planLabel?: string) => void;
  onEnterClientArea: () => void;
  onEnterDashboard: () => void;
  onSignOut: () => void;
}

interface SimPacket {
  id: number;
  kind: "legit" | "ddos" | "sqli" | "prompt";
  label: string;
  source: string;
  action: "PASSED" | "DROPPED";
  latencyMs: number;
}

const PACKET_TEMPLATES: Omit<SimPacket, "id">[] = [
  { kind: "legit", label: "GET /api/v1/products · TLS 1.3", source: "Mumbai IN", action: "PASSED", latencyMs: 11 },
  { kind: "ddos", label: "L7 HTTP/2 Flood · 48k RPS burst", source: "Botnet AS4134", action: "DROPPED", latencyMs: 0 },
  { kind: "sqli", label: "POST /login · ' OR 1=1-- SQLi", source: "Scanner Proxy", action: "DROPPED", latencyMs: 0 },
  { kind: "legit", label: "POST /api/checkout · Verified", source: "Bengaluru IN", action: "PASSED", latencyMs: 14 },
  { kind: "prompt", label: "LLM Jailbreak · System Override", source: "AI Abuse Bot", action: "DROPPED", latencyMs: 0 },
  { kind: "legit", label: "GET /assets/app.js · Edge Cache", source: "Chennai IN", action: "PASSED", latencyMs: 6 },
];

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
  const [underAttackOpen, setUnderAttackOpen] = useState(false);
  const [simPaused, setSimPaused] = useState(false);
  const [burstMode, setBurstMode] = useState(false);
  const [packets, setPackets] = useState<SimPacket[]>(() =>
    PACKET_TEMPLATES.slice(0, 4).map((p, i) => ({ ...p, id: i + 1 })),
  );
  const [droppedCount, setDroppedCount] = useState(1420);
  const [passedCount, setPassedCount] = useState(8940);

  useEffect(() => {
    if (simPaused) return;
    let seq = 10;
    const interval = window.setInterval(
      () => {
        seq += 1;
        const pool = burstMode
          ? PACKET_TEMPLATES.filter((p) => p.action === "DROPPED")
          : PACKET_TEMPLATES;
        const nextTpl = pool[seq % pool.length]!;
        const pkt: SimPacket = { ...nextTpl, id: seq };
        setPackets((prev) => [pkt, ...prev].slice(0, 6));
        if (pkt.action === "DROPPED") {
          setDroppedCount((c) => c + (burstMode ? 48 : 7));
        } else {
          setPassedCount((c) => c + 19);
        }
      },
      burstMode ? 650 : 1400,
    );
    return () => window.clearInterval(interval);
  }, [simPaused, burstMode]);

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
    <SmoothScroll>
      <div className="font-soc min-h-screen bg-[#030407] text-[#F4F6FA] flex flex-col selection:bg-[#06B6D4] selection:text-[#030407]">
        {/* Sticky Obsidian Header */}
        <header className="sticky top-0 z-40 border-b border-[#141A29] bg-[#030407]/90 backdrop-blur-xl px-4 sm:px-6 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
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
                  <span className="text-sm sm:text-base font-extrabold tracking-tight text-white">
                    SparrowX Shield
                  </span>
                  <span className="hidden sm:inline-flex items-center rounded-full border border-[#06B6D4]/35 bg-[#06B6D4]/10 px-2 py-0.5 font-mono text-[10px] text-[#06B6D4]">
                    sec.sparrowx.net
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 hidden sm:block">
                  Edge WAF · L3/L4/L7 DDoS · AI Prompt Guardrails
                </p>
              </div>
            </div>

            <nav aria-label="SparrowX Shield Navigation" className="hidden md:flex items-center gap-6 text-xs text-zinc-400">
              <a href="#shield-traffic-sim" className="hover:text-white transition-colors">Live WAF Sim</a>
              <a href="#shield-features" className="hover:text-white transition-colors">Capabilities</a>
              <a href="#shield-scanner" className="hover:text-white transition-colors">Live Audit</a>
              <a href="#shield-game-ddos" className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1.5">
                <Gamepad2 className="size-3.5" /> Game DDoS Defense
              </a>
              <a href="#shield-agent-plans" className="hover:text-white transition-colors">Plans</a>
            </nav>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUnderAttackOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/45 bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/25 cursor-pointer"
              >
                <Flame className="size-3.5" />
                <span>Under Attack?</span>
              </button>

              {activeUser ? (
                <>
                  <button
                    type="button"
                    onClick={onEnterClientArea}
                    className="rounded-xl border border-[#06B6D4]/40 bg-[#06B6D4]/15 px-3 py-1.5 text-xs font-semibold text-[#06B6D4] hover:bg-[#06B6D4]/25 cursor-pointer"
                  >
                    Client Area
                  </button>
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="rounded-xl border border-[#141A29] bg-[#080B12] px-3 py-1.5 text-xs text-zinc-300 hover:text-white cursor-pointer"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenAuthModal("signin")}
                  className="rounded-xl bg-white px-4 py-1.5 text-xs font-bold text-[#030407] hover:bg-zinc-200 cursor-pointer"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1">
          {/* SPATIAL HERO WITH 3D HOLOGRAPHIC SHIELD NODE */}
          <GridCanvas accent="cyan" variant="blueprint" className="border-b border-[#141A29]">
            <ParticleField accentColor="6, 182, 212" secondaryColor="244, 63, 94" density={46} />

            <section className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-12 pb-16 sm:pt-18 sm:pb-22">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="lg:col-span-7 space-y-6"
                >
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#06B6D4]/35 bg-[#080B12]/90 px-3.5 py-1.5 font-mono text-[11px] text-[#06B6D4]">
                    <ShieldCheck className="size-3.5 text-[#10B981]" />
                    <span>SPARROWX SEC · L3/L4/L7 EDGE WAF &amp; THREAT INTERCEPTION</span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold tracking-tight leading-[1.06]">
                    <span className="spx-silver-text block">Drop Attacks at the Edge.</span>
                    <span className="bg-gradient-to-r from-[#06B6D4] via-[#8F9CFF] to-rose-400 bg-clip-text text-transparent block mt-1">
                      Keep Clean Traffic Flying.
                    </span>
                  </h1>

                  <p className="max-w-2xl text-sm sm:text-base text-zinc-400 leading-relaxed">
                    Autonomous Layer 3/4/7 DDoS mitigation, managed OWASP WAF rules, origin IP cloaking, and AI prompt-injection guardrails engineered for websites, APIs, and production servers.
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href="#shield-scanner"
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#8F9CFF] px-6 py-3.5 text-sm font-extrabold text-[#030407] shadow-[0_0_32px_rgba(6,182,212,0.35)]"
                    >
                      <Shield className="size-4" />
                      <span>Run Free Domain Security Audit</span>
                      <ArrowRight className="size-4" />
                    </a>
                    {activeUser ? (
                      <button
                        type="button"
                        onClick={onEnterClientArea}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#141A29] bg-[#080B12] px-5 py-3.5 text-sm font-semibold text-white hover:border-[#06B6D4]/50 cursor-pointer"
                      >
                        <span>Enter Shield Client Area</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenAuthModal("register")}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#141A29] bg-[#080B12] px-5 py-3.5 text-sm font-semibold text-white hover:border-[#06B6D4]/50 cursor-pointer"
                      >
                        <span>Protect My Domain</span>
                      </button>
                    )}
                  </div>
                </motion.div>

                <div className="lg:col-span-5">
                  <ThreeModelViewer
                    variant="shield-dome"
                    heightClass="h-[340px] sm:h-[400px]"
                    label="SPARROWX SHIELD · 3D HOLOGRAPHIC WAF"
                  />
                </div>
              </div>
            </section>
          </GridCanvas>

          {/* LIVE WAF TRAFFIC SIMULATION */}
          <section id="shield-traffic-sim" className="spx-scroll-reveal mx-auto max-w-7xl px-4 sm:px-6 py-16">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-1.5">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#06B6D4]">
                  Interactive WAF Telemetry Demo
                </p>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Live Traffic Filtering &amp; Packet Interception
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBurstMode((b) => !b)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 font-mono text-xs font-bold cursor-pointer transition-colors ${
                    burstMode
                      ? "border-rose-500 bg-rose-500/20 text-rose-300"
                      : "border-[#141A29] bg-[#080B12] text-zinc-300 hover:border-rose-500/40"
                  }`}
                >
                  <Zap className="size-3.5" />
                  <span>{burstMode ? "Stop DDoS Burst" : "Simulate DDoS Burst"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSimPaused((p) => !p)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#141A29] bg-[#080B12] px-3.5 py-2 font-mono text-xs text-zinc-300 hover:text-white cursor-pointer"
                >
                  {simPaused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                  <span>{simPaused ? "Play Stream" : "Pause Stream"}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <InteractiveCard className="lg:col-span-4 p-5 space-y-4">
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-rose-300">
                    Malicious Packets Dropped (Demo)
                  </p>
                  <p className="mt-1 font-display text-3xl font-extrabold text-rose-400 tabular-nums">
                    {droppedCount.toLocaleString("en-IN")}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    DDoS floods, SQLi, XSS &amp; prompt injections dropped at XDP edge
                  </p>
                </div>

                <div className="rounded-xl border border-[#10B981]/30 bg-[#10B981]/10 p-4">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[#10B981]">
                    Legitimate Requests Passed (Demo)
                  </p>
                  <p className="mt-1 font-display text-3xl font-extrabold text-[#10B981] tabular-nums">
                    {passedCount.toLocaleString("en-IN")}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    Clean users forwarded to origin with sub-15ms Mumbai latency
                  </p>
                </div>
              </InteractiveCard>

              <div className="lg:col-span-8 rounded-2xl border border-[#141A29] bg-[#080B12] p-5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-[#141A29] pb-2.5 font-mono text-[11px] text-zinc-400">
                  <span className="flex items-center gap-2">
                    <Terminal className="size-3.5 text-[#06B6D4]" />
                    <span>SPARROWX EDGE PACKET PIPELINE (SIMULATED STREAM)</span>
                  </span>
                  <span className={burstMode ? "text-rose-400 font-bold" : "text-[#10B981]"}>
                    {burstMode ? "MITIGATING FLOOD" : "NOMINAL"}
                  </span>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  {packets.map((pkt) => {
                    const dropped = pkt.action === "DROPPED";
                    return (
                      <div
                        key={pkt.id}
                        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 ${
                          dropped
                            ? "border-rose-500/35 bg-rose-500/10 text-rose-200"
                            : "border-[#10B981]/25 bg-[#10B981]/5 text-emerald-100"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {dropped ? (
                            <ShieldAlert className="size-4 text-rose-400 shrink-0" />
                          ) : (
                            <ShieldCheck className="size-4 text-[#10B981] shrink-0" />
                          )}
                          <span className="truncate">{pkt.label}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-[10px]">
                          <span className="text-zinc-400">{pkt.source}</span>
                          <span
                            className={`rounded px-2 py-0.5 font-bold ${
                              dropped ? "bg-rose-500 text-white" : "bg-[#10B981] text-[#030407]"
                            }`}
                          >
                            {pkt.action}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* FEATURE BENTO */}
          <section id="shield-features" className="spx-scroll-reveal border-y border-[#141A29] bg-[#05070D]/80 py-16">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="mb-8 space-y-1.5">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#8F9CFF]">
                  Defense Architecture
                </p>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Full-Stack Edge Protection
                </h2>
              </div>
              <BentoGrid className="lg:grid-cols-4">
                <BentoCard
                  title="L3 / L4 / L7 DDoS Mitigation"
                  description="Kernel XDP/eBPF scrubbing drops SYN floods, HTTP/2 rapid resets, and volumetric spikes before origin sockets saturate."
                  badge="ALWAYS ON"
                  accent="cyan"
                  icon={<Activity className="size-5 text-[#06B6D4]" />}
                />
                <BentoCard
                  title="Managed OWASP WAF Rules"
                  description="Pre-tuned rulesets blocking SQL injection, XSS, SSRF, RCE, and credential stuffing out of the box."
                  badge="OWASP CRS"
                  accent="crimson"
                  icon={<Shield className="size-5 text-rose-400" />}
                />
                <BentoCard
                  title="Real-Time Security Logs"
                  description="Inspect live blocked payloads, ASN threat reputation, and export Cloudflare or NGINX blocklists in one click."
                  badge="LIVE STREAM"
                  accent="periwinkle"
                  icon={<Terminal className="size-5 text-[#8F9CFF]" />}
                />
                <BentoCard
                  title="Custom Rate Limiting"
                  description="Per-route token buckets and AI endpoint prompt-injection guardrails with zero false-positive CAPTCHA loops."
                  badge="ZERO FRICTION"
                  accent="emerald"
                  icon={<Lock className="size-5 text-[#10B981]" />}
                />
              </BentoGrid>
            </div>
          </section>

          {/* LIVE PUBLIC DOMAIN SECURITY SCANNER (REAL BACKEND AUDIT) */}
          <section id="shield-scanner" className="spx-scroll-reveal mx-auto max-w-5xl px-4 sm:px-6 py-16">
            <InteractiveCard spotlightColor="rgba(6, 182, 212, 0.16)" className="p-6 sm:p-8 space-y-5">
              <div className="space-y-1.5">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#06B6D4]">
                  Real 8-Tool Live Audit
                </p>
                <h2 className="text-2xl font-extrabold text-white">
                  Inspect Your Public Domain Security Posture
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400">
                  Enter any public domain (e.g., <code className="font-mono text-zinc-200">yourdomain.com</code>) to check live TLS ciphers, security headers, DNS/SPF/DMARC, and exposed endpoints.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void runLandingScan();
                }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <input
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="yourdomain.com"
                  aria-label="Domain to scan"
                  className="flex-1 rounded-xl border border-[#141A29] bg-[#030407] px-4 py-3 font-mono text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#06B6D4]"
                />
                <button
                  type="submit"
                  disabled={scanning}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#8F9CFF] px-6 py-3 text-sm font-extrabold text-[#030407] cursor-pointer disabled:opacity-60"
                >
                  {scanning ? <RefreshCw className="size-4 animate-spin" /> : <Globe className="size-4" />}
                  <span>{scanning ? "Scanning…" : "Run Security Scan"}</span>
                </button>
              </form>

              {scanError && (
                <p className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
                  {scanError}
                </p>
              )}

              {liveAudit && (
                <div className="rounded-xl border border-[#141A29] bg-[#030407] p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm font-bold text-white">{liveAudit.target}</p>
                      <p className="text-xs text-zinc-400">
                        Security Grade: <strong className="text-[#10B981]">{liveAudit.grade}</strong> · Score {liveAudit.score}/100
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadBrandedHtmlSecurityReport(liveAudit)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#06B6D4]/40 bg-[#06B6D4]/10 px-3 py-1.5 font-mono text-xs text-[#06B6D4] cursor-pointer"
                    >
                      <Download className="size-3.5" />
                      <span>Download Report</span>
                    </button>
                  </div>
                </div>
              )}
            </InteractiveCard>
          </section>

          {/* DEDICATED GAME DDOS DEFENSE SECTION (Preserved for shield-flow.test.tsx) */}
          <section id="shield-game-ddos" className="mx-auto max-w-5xl px-4 sm:px-6 pb-16">
            <InteractiveCard spotlightColor="rgba(245, 158, 11, 0.16)" className="p-6 sm:p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                    <Gamepad2 className="size-3.5" />
                    <span>GAME SERVER L4 PROTECTION</span>
                  </span>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                    Want to secure your game? Need to protect your server from DDoS attack?
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                    FiveM, Minecraft, SA-MP, Rust, and raw TCP/UDP game servers require dedicated Anycast L4 packet scrubbing and stateful RakNet/ENet filtering.
                  </p>
                </div>
                <a
                  href={GAMESEC_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 px-5 py-3 text-xs font-extrabold text-[#030407] shrink-0 transition-colors"
                >
                  <span>Open GameSec L4 Defense</span>
                  <ArrowRight className="size-4" />
                </a>
              </div>
            </InteractiveCard>
          </section>

          {/* PLANS SECTION */}
          <section id="shield-agent-plans" className="border-t border-[#141A29] bg-[#05070D]/80 py-16">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#8F9CFF]">
                    Transparent Security Plans
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                    Flat Rate Edge WAF &amp; Autonomous SOC
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {(["INR", "USD", "EUR"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCurrency(c)}
                      className={`rounded-lg px-2.5 py-1 font-mono text-xs cursor-pointer ${
                        currency === c
                          ? "bg-[#06B6D4] text-[#030407] font-bold"
                          : "border border-[#141A29] bg-[#080B12] text-zinc-400"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setBillingCycle((b) => (b === "monthly" ? "annual" : "monthly"))}
                    className="rounded-lg border border-[#141A29] bg-[#080B12] px-3 py-1 font-mono text-xs text-zinc-300 cursor-pointer"
                  >
                    {billingCycle === "annual" ? "Annual (-20%)" : "Monthly"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {SPARROWX_PLANS.slice(0, 3).map((plan) => (
                  <InteractiveCard key={plan.id} className="p-6 flex flex-col justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                      <p className="mt-1 text-xs text-zinc-400">{plan.tagline}</p>
                      <div className="mt-4 pb-4 border-b border-[#141A29] flex items-baseline gap-1">
                        <span className="font-display text-3xl font-extrabold text-white">
                          {formatPlanPrice(plan)}
                        </span>
                        <span className="text-xs text-zinc-400">/mo</span>
                      </div>
                      <ul className="mt-4 space-y-2 text-xs text-zinc-300">
                        {plan.features.slice(0, 4).map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check className="mt-0.5 size-3.5 text-[#06B6D4] shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        activeUser ? onEnterDashboard() : onOpenAuthModal("register", plan.name)
                      }
                      className="mt-6 w-full rounded-xl border border-[#06B6D4]/40 bg-[#06B6D4]/12 py-2.5 text-xs font-bold text-white hover:bg-[#06B6D4] hover:text-[#030407] transition-colors cursor-pointer"
                    >
                      Activate {plan.name}
                    </button>
                  </InteractiveCard>
                ))}
              </div>
              <PurchasePolicyNotice className="max-w-2xl mx-auto" />
            </div>
          </section>
        </main>

        <SparrowxFooter />
        <UnderAttackModal
          open={underAttackOpen}
          onClose={() => setUnderAttackOpen(false)}
          onStartProtection={() => {
            setUnderAttackOpen(false);
            if (activeUser) onEnterClientArea();
            else onOpenAuthModal("register", "Under Attack Emergency");
          }}
        />
      </div>
    </SmoothScroll>
  );
}
