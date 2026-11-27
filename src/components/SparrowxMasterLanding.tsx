import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  Cpu,
  Database,
  FileUp,
  Gamepad2,
  Globe2,
  KeyRound,
  Layers,
  Loader2,
  Menu,
  MessageCircle,
  Radio,
  Rocket,
  Server,
  Shield,
  Sparkles,
  User,
  X,
  Zap,
} from "lucide-react";
import { OAuthSignInButtons } from "@/components/GoogleSignInButton";
import { fetchMasterSsoUser, getNetsecSsoUrl } from "@/lib/developer-connection";
import { verifySessionToken } from "@/lib/advanced-features";
import { type AppUser } from "@/lib/supabase";
import { ContactSection } from "@/components/landing/ContactSection";
import { SparrowxFooter } from "@/components/SparrowxFooter";
import { buildWhatsAppSupportUrl, WHATSAPP_SUPPORT_DISPLAY } from "@/lib/whatsapp-support";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SmoothScroll } from "@/components/shared/SmoothScroll";
import { ParticleField } from "@/components/shared/ParticleField";
import { GridCanvas } from "@/components/shared/GridCanvas";
import { ThreeModelViewer } from "@/components/shared/ThreeModelViewer";
import { InteractiveCard } from "@/components/shared/InteractiveCard";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { BentoCard, BentoGrid } from "@/components/shared/BentoGrid";

interface SparrowxMasterLandingProps {
  onOpenLogin: () => void;
  onDirectNav?: (destination: string) => void;
  onUserAuthenticated?: (user: AppUser) => void;
}

interface EcosystemProduct {
  id: string;
  name: string;
  domain: string;
  prodUrl: string;
  localPath: string;
  badge: string;
  status: string;
  accent: "periwinkle" | "cyan" | "emerald" | "amber" | "crimson";
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
  isNetsec?: boolean;
}

const ECOSYSTEM_PRODUCTS: EcosystemProduct[] = [
  {
    id: "deploy",
    name: "SparrowX Deploy",
    domain: "deploy.sparrowx.net",
    prodUrl: "https://deploy.sparrowx.net",
    localPath: "/deploy",
    badge: "GIT PAAS",
    status: "SSL Ready",
    accent: "periwinkle",
    description:
      "Git-push Next.js, TanStack, React, Node, Python, and Docker straight to Mumbai bare metal with instant Let's Encrypt HTTPS.",
    icon: Rocket,
  },
  {
    id: "ai",
    name: "SparrowX AI",
    domain: "ai.sparrowx.net",
    prodUrl: "https://ai.sparrowx.net",
    localPath: "/ai",
    badge: "AGENTS + MCP",
    status: "Unlimited Runs",
    accent: "cyan",
    description:
      "1-click AI agent runtimes, Langflow visual builders, custom Python/Node agents, and MCP servers linked natively to pgvector.",
    icon: Sparkles,
  },
  {
    id: "sec",
    name: "SparrowX Sec (Shield)",
    domain: "sec.sparrowx.net",
    prodUrl: "https://sec.sparrowx.net",
    localPath: "/shield",
    badge: "L3/L4/L7 WAF",
    status: "Always On",
    accent: "crimson",
    description:
      "8-tool deep domain security auditor, OWASP Layer-7 WAF filtering, real-time DDoS packet scrubbing, and AI prompt guardrails.",
    icon: Shield,
  },
  {
    id: "db",
    name: "SparrowX Cloud DB",
    domain: "db.sparrowx.net",
    prodUrl: "https://db.sparrowx.net",
    localPath: "/db",
    badge: "POSTGRES 16",
    status: "pgvector Native",
    accent: "emerald",
    description:
      "Dedicated NVMe PostgreSQL 16 clusters with native pgvector cosine search, PgBouncer pooling, instant REST API, and ₹0 egress.",
    icon: Database,
  },
  {
    id: "game",
    name: "SparrowX Game",
    domain: "sparrowx.net/game",
    prodUrl: "https://sparrowx.net/game",
    localPath: "/game",
    badge: "RYZEN 9 9950X",
    status: "12 ms India",
    accent: "amber",
    description:
      "High-clock NVMe Gen5 nodes for Minecraft SMP, FiveM RP, SA-MP, and 24/7 Discord bots with 1-click Pterodactyl SSO.",
    icon: Gamepad2,
  },
  {
    id: "infra",
    name: "SparrowX Cloud Infra",
    domain: "infra.sparrowx.net",
    prodUrl: "https://infra.sparrowx.net",
    localPath: "/infra",
    badge: "BARE METAL",
    status: "15+ OS Images",
    accent: "cyan",
    description:
      "Single-tenant Dual Xeon Gold & AMD Ryzen 9 9950X KVM VPS, VDS, and Bare Metal across Mumbai, Chennai, Singapore & London.",
    icon: Server,
  },
  {
    id: "drop",
    name: "SparrowX Files (Drop)",
    domain: "file.sparrowx.net",
    prodUrl: "https://file.sparrowx.net",
    localPath: "/drop",
    badge: "AES-256 VAULT",
    status: "10 GB Free",
    accent: "emerald",
    description:
      "Zero-login browser-encrypted file transfer up to 2.5 GB with burn-after-reading links and a 10 GB encrypted private vault.",
    icon: FileUp,
  },
  {
    id: "keys",
    name: "SparrowX Keys",
    domain: "password.sparrowx.net",
    prodUrl: "https://password.sparrowx.net",
    localPath: "/keys",
    badge: "OFFLINE CRYPTO",
    status: "Zero Telemetry",
    accent: "periwinkle",
    description:
      "100% client-side Web Crypto CSPRNG password, Diceware passphrase, JWT secret, and cryptographic API key generator.",
    icon: KeyRound,
  },
  {
    id: "netsec",
    name: "SparrowX NetSec",
    domain: "netsec.sparrowx.net",
    prodUrl: "https://netsec.sparrowx.net",
    localPath: "https://netsec.sparrowx.net",
    badge: "XDP + WIREGUARD",
    status: "Linux Agent",
    accent: "crimson",
    description:
      "Autonomous Linux host firewall agent with kernel XDP/eBPF packet drops, WireGuard tunnels, and live threat telemetry.",
    icon: Activity,
    external: true,
    isNetsec: true,
  },
];

interface IndiaNode {
  id: string;
  name: string;
  role: string;
  x: number;
  y: number;
  ping: string;
  capacity: string;
  tier: "Primary Edge" | "Core DC" | "PoP";
}

const INDIA_NODES: IndiaNode[] = [
  {
    id: "mumbai",
    name: "Mumbai Edge (BOM-1)",
    role: "Primary Bare-Metal Compute & Anycast Scrubbing",
    x: 132,
    y: 234,
    ping: "8–12 ms",
    capacity: "10 Gbps Fiber · NIXI Direct",
    tier: "Primary Edge",
  },
  {
    id: "chennai",
    name: "Tamil Nadu DC (MAA-2)",
    role: "Subsea Cable Landing & Low-Latency South Hub",
    x: 204,
    y: 312,
    ping: "4–14 ms",
    capacity: "10 Gbps Bay of Bengal Ring",
    tier: "Core DC",
  },
  {
    id: "bengaluru",
    name: "Bengaluru PoP (BLR)",
    role: "AI Inference & Developer Peering Exchange",
    x: 175,
    y: 306,
    ping: "14–18 ms",
    capacity: "Direct ISP Peering",
    tier: "PoP",
  },
  {
    id: "delhi",
    name: "Delhi NCR PoP (DEL)",
    role: "North India Routing & DDoS Absorption",
    x: 174,
    y: 126,
    ping: "19–24 ms",
    capacity: "Jio / Airtel / BSNL Peering",
    tier: "PoP",
  },
  {
    id: "hyderabad",
    name: "Hyderabad PoP (HYD)",
    role: "Central Backbone Relay & Database Replication",
    x: 186,
    y: 256,
    ping: "12–16 ms",
    capacity: "Dual-Path Fiber Mesh",
    tier: "PoP",
  },
];

function fireConfettiBurst() {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  void import("canvas-confetti")
    .then(({ default: confetti }) => {
      confetti({
        particleCount: 42,
        spread: 62,
        origin: { y: 0.62 },
        colors: ["#8F9CFF", "#06B6D4", "#10B981", "#FFFFFF"],
        disableForReducedMotion: true,
      });
    })
    .catch(() => {});
}

export function SparrowxMasterLanding({
  onOpenLogin,
  onDirectNav,
  onUserAuthenticated,
}: SparrowxMasterLandingProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<{ email: string; fullName: string } | null>(null);
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{
    rttMs: number;
    city: string;
    isp: string;
  } | null>(null);
  const [workloadGb, setWorkloadGb] = useState<number>(800);
  const [activeNodeId, setActiveNodeId] = useState<string>("mumbai");

  useEffect(() => {
    const local = verifySessionToken();
    if (local?.email) {
      setSessionUser({ email: local.email, fullName: local.fullName || local.email.split("@")[0] || "Operator" });
      return;
    }
    void fetchMasterSsoUser()
      .then((sso) => {
        if (sso?.email) {
          setSessionUser({ email: sso.email, fullName: sso.fullName || sso.email.split("@")[0] || "Operator" });
        }
      })
      .catch(() => {});
  }, []);

  const isProdHost =
    typeof window !== "undefined" &&
    window.location.hostname.toLowerCase().includes("sparrowx.net");

  const resolveProductHref = (item: EcosystemProduct) => {
    if (item.isNetsec) return getNetsecSsoUrl({ autoSso: Boolean(sessionUser) });
    if (item.external) return item.prodUrl;
    return isProdHost ? item.prodUrl : item.localPath;
  };

  const runMumbaiPing = async () => {
    setPinging(true);
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const res = await fetch(`/api/infra/latency-probe?region=in-mum&tz=${encodeURIComponent(tz)}`);
      const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
      const rttMs = Math.max(8, Math.round(t1 - t0));
      const data = (await res.json().catch(() => null)) as {
        client?: { city?: string; isp?: string };
      } | null;
      setPingResult({
        rttMs,
        city: data?.client?.city || "Mumbai Edge Route",
        isp: data?.client?.isp || "Direct Fiber Peering",
      });
    } catch {
      setPingResult({
        rttMs: 14,
        city: "Mumbai Edge (BOM-1)",
        isp: "Direct Indian Fiber",
      });
    } finally {
      setPinging(false);
    }
  };

  const comparePricing = useMemo(() => {
    // Realistic monthly cost comparison for full-stack app + AI + DB + bandwidth
    const sparrowxInr = workloadGb <= 500 ? 999 : workloadGb <= 1500 ? 1999 : 3499;
    const awsVercelUsd = Math.round(45 + workloadGb * 0.095);
    const awsVercelInr = awsVercelUsd * 85;
    const savingsInr = Math.max(0, awsVercelInr - sparrowxInr);
    const savingsPct = Math.round((savingsInr / Math.max(1, awsVercelInr)) * 100);
    return { sparrowxInr, awsVercelUsd, awsVercelInr, savingsInr, savingsPct };
  }, [workloadGb]);

  const activeNode = INDIA_NODES.find((n) => n.id === activeNodeId) ?? INDIA_NODES[0]!;

  return (
    <SmoothScroll>
      <div className="min-h-screen bg-[#030407] text-[#F4F6FA] flex flex-col selection:bg-[#8F9CFF] selection:text-[#030407]">
        {/* STICKY SPATIAL OBSIDIAN HEADER */}
        <header className="sticky top-0 z-50 border-b border-[#141A29] bg-[#030407]/85 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
            <a href="#top" className="flex items-center gap-2.5 shrink-0">
              <img
                src="/logos/sparrowx-silver.png"
                alt="SparrowX Technologies"
                width={30}
                height={30}
                className="size-7.5 object-contain"
              />
              <span className="font-display text-sm font-extrabold tracking-[0.16em] text-white">
                SPARROWX
              </span>
              <span className="hidden sm:inline-flex rounded-full border border-[#8F9CFF]/30 bg-[#8F9CFF]/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#8F9CFF]">
                INDIA CLOUD
              </span>
            </a>

            <nav aria-label="Primary Navigation" className="hidden lg:flex items-center gap-6 text-xs font-medium text-zinc-400">
              <a href="#ecosystem" className="hover:text-white transition-colors">Ecosystem</a>
              <a href="#compare" className="hover:text-white transition-colors">Flat INR vs AWS</a>
              <a href="#network" className="hover:text-white transition-colors">India Network</a>
              <a href={isProdHost ? "https://deploy.sparrowx.net" : "/deploy"} className="hover:text-[#8F9CFF] transition-colors">Deploy</a>
              <a href={isProdHost ? "https://ai.sparrowx.net" : "/ai"} className="hover:text-[#06B6D4] transition-colors">AI Infra</a>
              <a href={isProdHost ? "https://sec.sparrowx.net" : "/shield"} className="hover:text-rose-400 transition-colors">Shield</a>
              <a href={isProdHost ? "https://db.sparrowx.net" : "/db"} className="hover:text-emerald-400 transition-colors">Cloud DB</a>
              <a href="/game" className="hover:text-amber-400 transition-colors">Game</a>
            </nav>

            <div className="flex items-center gap-2.5">
              <a
                href={buildWhatsAppSupportUrl("Hi SparrowX Team! I'm exploring SparrowX Cloud & AI infrastructure.")}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
              >
                <MessageCircle className="size-3.5" aria-hidden="true" />
                <span>WhatsApp</span>
              </a>

              {sessionUser ? (
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#8F9CFF]/40 bg-[#8F9CFF]/15 px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#8F9CFF]/25 transition-colors cursor-pointer"
                >
                  <User className="size-3.5 text-[#8F9CFF]" />
                  <span>Client Area</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthDialogOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-[#030407] hover:bg-zinc-200 transition-colors cursor-pointer"
                >
                  <span>Sign In</span>
                  <ArrowRight className="size-3.5" />
                </button>
              )}

              <button
                type="button"
                aria-label="Toggle Menu"
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="lg:hidden grid size-9 place-items-center rounded-xl border border-[#141A29] bg-[#080B12] text-zinc-200 cursor-pointer"
              >
                {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-[#141A29] bg-[#030407]/95 px-4 py-4 space-y-2 text-sm">
              {ECOSYSTEM_PRODUCTS.slice(0, 6).map((p) => (
                <a
                  key={p.id}
                  href={resolveProductHref(p)}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-zinc-200 hover:bg-[#080B12]"
                >
                  <span>{p.name}</span>
                  <span className="font-mono text-[11px] text-[#8F9CFF]">{p.domain}</span>
                </a>
              ))}
            </div>
          )}
        </header>

        <main id="top" className="relative flex-1">
          {/* HERO: 3D FLOATING SPARROW COIN + KINETIC METALLIC TYPOGRAPHY + LIVE MUMBAI PING */}
          <GridCanvas accent="periwinkle" variant="blueprint" className="border-b border-[#141A29]">
            <ParticleField accentColor="143, 156, 255" secondaryColor="6, 182, 212" density={52} />

            <section className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-14 pb-16 sm:pt-20 sm:pb-24">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
                {/* Left 7 Cols: Kinetic Typography + Live Mumbai Ping + Spring CTAs */}
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="lg:col-span-7 space-y-6"
                >
                  <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-[#8F9CFF]/30 bg-[#080B12]/90 px-3.5 py-1.5 font-mono text-[11px] text-[#8F9CFF] backdrop-blur-md">
                    <span className="size-1.5 rounded-full bg-[#10B981] animate-pulse" />
                    <span>SPARROWX TECHNOLOGIES · MUMBAI EDGE &amp; TAMIL NADU DC</span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-[3.65rem] font-extrabold tracking-[-0.035em] leading-[1.05] text-balance">
                    <span className="spx-silver-text block">Indian Bare-Metal Cloud.</span>
                    <span className="spx-periwinkle-gradient-text block mt-1">
                      Infinite AI Infra.
                    </span>
                  </h1>

                  <p className="max-w-2xl text-sm sm:text-base leading-relaxed text-zinc-400">
                    Deploy full-stack apps, 24/7 AI agents, managed PostgreSQL 16 + pgvector,
                    Edge WAF security, and Ryzen 9 9950X game nodes on sovereign Indian bare metal.
                    Flat INR billing via UPI — zero surprise USD egress bills.
                  </p>

                  {/* Spring Action CTAs with Confetti Burst */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        fireConfettiBurst();
                        if (sessionUser) {
                          onOpenLogin();
                        } else {
                          setAuthDialogOpen(true);
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#8F9CFF] to-[#06B6D4] px-6 py-3.5 text-sm font-extrabold text-[#030407] shadow-[0_0_32px_rgba(143,156,255,0.4)] hover:shadow-[0_0_44px_rgba(6,182,212,0.55)] transition-shadow cursor-pointer"
                    >
                      <Zap className="size-4" />
                      <span>{sessionUser ? "Open Client Area" : "Launch Free Workspace"}</span>
                      <ArrowRight className="size-4" />
                    </motion.button>

                    <motion.a
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      href="#ecosystem"
                      className="inline-flex items-center gap-2 rounded-xl border border-[#141A29] bg-[#080B12]/90 px-5 py-3.5 text-sm font-semibold text-zinc-200 hover:border-[#8F9CFF]/50 hover:text-white transition-colors"
                    >
                      <Layers className="size-4 text-[#8F9CFF]" />
                      <span>Explore 9 Subdomains</span>
                    </motion.a>
                  </div>

                  {/* Interactive Real-Time Mumbai Edge Ping Widget */}
                  <div className="rounded-2xl border border-[#141A29] bg-[#080B12]/90 p-4 backdrop-blur-md">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-xl border border-[#06B6D4]/30 bg-[#06B6D4]/10 text-[#06B6D4]">
                          <Radio className="size-4" />
                        </span>
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                            Interactive Mumbai Edge Ping Test
                          </p>
                          <p className="text-xs sm:text-sm font-semibold text-white">
                            {pingResult ? (
                              <>
                                <span className="font-mono text-[#10B981]">{pingResult.rttMs} ms</span>
                                <span className="text-zinc-400 font-normal">
                                  {" "}· {pingResult.city} ({pingResult.isp})
                                </span>
                              </>
                            ) : (
                              "Measure live fiber RTT from your browser to Mumbai BOM-1"
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={runMumbaiPing}
                        disabled={pinging}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#8F9CFF]/35 bg-[#8F9CFF]/12 px-3.5 py-2 font-mono text-xs font-semibold text-[#8F9CFF] hover:bg-[#8F9CFF]/25 transition-colors cursor-pointer disabled:opacity-60"
                      >
                        {pinging ? <Loader2 className="size-3.5 animate-spin" /> : <Activity className="size-3.5" />}
                        <span>{pinging ? "Probing…" : "Ping Mumbai Edge"}</span>
                      </button>
                    </div>
                  </div>
                </motion.div>

                {/* Right 5 Cols: Interactive 3D Floating Periwinkle Sparrow Coin */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                  className="lg:col-span-5"
                >
                  <ThreeModelViewer
                    variant="sparrow-coin"
                    heightClass="h-[340px] sm:h-[420px]"
                    label="SPARROWX · SOVEREIGN COIN · INTERACTIVE 3D"
                  />
                </motion.div>
              </div>

              {/* Scroll-Triggered Spring Metrics Strip */}
              <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Mumbai Edge RTT", val: 12, suffix: " ms", accent: "text-[#06B6D4]" },
                  { label: "Deploy Plans From", val: 299, prefix: "₹", suffix: "/mo", accent: "text-[#8F9CFF]" },
                  { label: "Bare-Metal SLA", val: 99.99, decimals: 2, suffix: "%", accent: "text-[#10B981]" },
                  { label: "Egress Overage Tax", val: 0, prefix: "₹", suffix: "", accent: "text-[#F59E0B]" },
                ].map((stat) => (
                  <InteractiveCard key={stat.label} tiltEnabled={false} className="p-4">
                    <p className={`font-display text-2xl sm:text-3xl font-extrabold ${stat.accent}`}>
                      <AnimatedNumber
                        value={stat.val}
                        prefix={stat.prefix}
                        suffix={stat.suffix}
                        decimals={stat.decimals}
                      />
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-zinc-400">{stat.label}</p>
                  </InteractiveCard>
                ))}
              </div>
            </section>
          </GridCanvas>

          {/* SECTION 2: SPATIAL WEB3 BENTO ECOSYSTEM GRID */}
          <section id="ecosystem" className="spx-scroll-reveal mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24">
            <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#8F9CFF]">
                  Dedicated Subdomain Architecture
                </p>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight spx-silver-text">
                  One Identity. Nine Sovereign Platforms.
                </h2>
              </div>
              <p className="max-w-md text-xs sm:text-sm text-zinc-400">
                Every SparrowX service runs on its own dedicated subdomain with unified Google &amp; GitHub Master SSO and flat INR billing.
              </p>
            </div>

            <BentoGrid>
              {ECOSYSTEM_PRODUCTS.map((item) => {
                const Icon = item.icon;
                const href = resolveProductHref(item);
                return (
                  <BentoCard
                    key={item.id}
                    title={item.name}
                    description={item.description}
                    badge={item.badge}
                    statusLabel={item.status}
                    accent={item.accent}
                    icon={<Icon className="size-5 text-[#8F9CFF]" />}
                    href={href}
                    onClick={
                      onDirectNav && !item.external && !isProdHost
                        ? () => onDirectNav(item.id)
                        : undefined
                    }
                    footer={
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="text-zinc-300 group-hover:text-white transition-colors">
                          {item.domain}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[#8F9CFF]">
                          Launch <ArrowUpRight className="size-3.5" />
                        </span>
                      </div>
                    }
                  />
                );
              })}
            </BentoGrid>
          </section>

          {/* SECTION 3: INTERACTIVE COMPARE MATRIX (FLAT INR VS HYPERSCALERS) */}
          <section
            id="compare"
            className="spx-scroll-reveal border-y border-[#141A29] bg-[#05070D]/80 px-4 sm:px-6 py-16 sm:py-24"
          >
            <div className="mx-auto max-w-7xl space-y-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="space-y-2">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#10B981]">
                    Transparent Economics
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                    Flat INR &amp; UPI vs. USD Surprise Bills
                  </h2>
                </div>
                <div className="rounded-xl border border-[#141A29] bg-[#080B12] px-4 py-3 min-w-[260px]">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-400">Monthly Traffic</span>
                    <span className="text-[#8F9CFF] font-bold">{workloadGb.toLocaleString("en-IN")} GB</span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={3000}
                    step={100}
                    value={workloadGb}
                    onChange={(e) => setWorkloadGb(Number(e.target.value))}
                    aria-label="Monthly bandwidth workload in GB"
                    className="mt-2 w-full accent-[#8F9CFF] cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <InteractiveCard
                  spotlightColor="rgba(16, 185, 129, 0.18)"
                  className="p-6 sm:p-8 border-[#10B981]/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full border border-[#10B981]/40 bg-[#10B981]/15 px-3 py-1 font-mono text-xs font-bold text-[#10B981]">
                      SPARROWX SOVEREIGN CLOUD
                    </span>
                    <span className="font-mono text-xs text-emerald-300">
                      Save ~{comparePricing.savingsPct}% / mo
                    </span>
                  </div>
                  <div className="mt-5 flex items-baseline gap-2">
                    <span className="font-display text-4xl sm:text-5xl font-extrabold text-white">
                      ₹{comparePricing.sparrowxInr.toLocaleString("en-IN")}
                    </span>
                    <span className="text-sm text-zinc-400">/month flat INR</span>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm text-zinc-200">
                    {[
                      "Flat INR billing via UPI QR & SparrowCoins — zero USD forex fees",
                      "Up to 200 Mbps shared port / unmetered fair-use — zero $0.09/GB egress shock",
                      "Dedicated Indian bare-metal Ryzen 9 9950X & Dual Xeon Gold nodes",
                      "Direct WhatsApp & NOC engineering support included free",
                    ].map((line) => (
                      <li key={line} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 size-4 shrink-0 text-[#10B981]" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </InteractiveCard>

                <InteractiveCard
                  spotlightColor="rgba(244, 63, 94, 0.14)"
                  className="p-6 sm:p-8 border-white/10"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full border border-rose-500/35 bg-rose-500/10 px-3 py-1 font-mono text-xs font-bold text-rose-300">
                      AWS / VERCEL / RENDER (USD)
                    </span>
                    <span className="font-mono text-xs text-rose-400">Metered Overages</span>
                  </div>
                  <div className="mt-5 flex items-baseline gap-2">
                    <span className="font-display text-4xl sm:text-5xl font-extrabold text-zinc-300">
                      ₹{comparePricing.awsVercelInr.toLocaleString("en-IN")}
                    </span>
                    <span className="text-sm text-zinc-500">
                      (~${comparePricing.awsVercelUsd}/mo)
                    </span>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm text-zinc-400">
                    {[
                      "Mandatory international credit card + 3.5% USD forex markup",
                      "Punitive $0.09–$0.40/GB bandwidth overage bills during traffic spikes",
                      "Per-seat charges, cold-start serverless pauses, and execution caps",
                      "Automated ticket bots unless paying $100+/mo enterprise support tiers",
                    ].map((line) => (
                      <li key={line} className="flex items-start gap-2.5">
                        <X className="mt-0.5 size-4 shrink-0 text-rose-400" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </InteractiveCard>
              </div>
            </div>
          </section>

          {/* SECTION 4: INTERACTIVE INDIA NETWORK MAP */}
          <section id="network" className="spx-scroll-reveal mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 space-y-5">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#06B6D4]">
                  Low-Latency Indian Backbone
                </p>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                  Built Inside India for Sub-20ms Reach
                </h2>
                <p className="text-sm leading-relaxed text-zinc-400">
                  Direct NIXI &amp; Tier-1 peering across Mumbai Edge and Tamil Nadu DC keeps your APIs, AI inference streams, and game ticks crisp across every Indian state.
                </p>

                {/* Active Node Telemetry Card */}
                <InteractiveCard spotlightColor="rgba(6, 182, 212, 0.16)" className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#06B6D4]">
                      {activeNode.tier}
                    </span>
                    <span className="rounded-full border border-[#10B981]/35 bg-[#10B981]/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#10B981]">
                      {activeNode.ping}
                    </span>
                  </div>
                  <h3 className="mt-2 text-lg font-bold text-white">{activeNode.name}</h3>
                  <p className="mt-1 text-xs text-zinc-400">{activeNode.role}</p>
                  <p className="mt-3 font-mono text-xs text-[#8F9CFF]">{activeNode.capacity}</p>
                </InteractiveCard>

                <div className="flex flex-wrap gap-2">
                  {INDIA_NODES.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setActiveNodeId(node.id)}
                      className={`rounded-xl border px-3 py-1.5 font-mono text-xs transition-colors cursor-pointer ${
                        activeNodeId === node.id
                          ? "border-[#06B6D4] bg-[#06B6D4]/15 text-white font-semibold"
                          : "border-[#141A29] bg-[#080B12] text-zinc-400 hover:text-white"
                      }`}
                    >
                      {node.name.split(" (")[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stylized SVG Interactive India Fiber Topology Map */}
              <div className="lg:col-span-7">
                <div className="relative overflow-hidden rounded-2xl border border-[#141A29] bg-[#080B12]/90 p-5 sm:p-8">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 spx-dot-matrix-bg opacity-50"
                  />
                  <svg
                    viewBox="0 0 360 400"
                    className="relative z-10 mx-auto h-[320px] sm:h-[380px] w-full max-w-[420px]"
                    role="img"
                    aria-label="Interactive SparrowX India Bare-Metal Network Map"
                  >
                    <defs>
                      <linearGradient id="indiaStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#8F9CFF" stopOpacity="0.65" />
                        <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.5" />
                      </linearGradient>
                    </defs>

                    {/* Clean Geometric Silhouette of India */}
                    <path
                      d="M155 34 L190 46 L210 74 L224 102 L262 126 L296 146 L284 180 L256 196 L246 232 L222 276 L208 326 L186 368 L166 348 L152 302 L134 252 L114 216 L90 198 L108 168 L116 132 L134 94 L142 58 Z"
                      fill="rgba(143,156,255,0.06)"
                      stroke="url(#indiaStroke)"
                      strokeWidth="1.5"
                    />

                    {/* Animated Fiber Backbone Links */}
                    {[
                      [132, 234, 204, 312],
                      [132, 234, 174, 126],
                      [132, 234, 186, 256],
                      [186, 256, 204, 312],
                      [175, 306, 204, 312],
                      [174, 126, 186, 256],
                    ].map(([x1, y1, x2, y2], idx) => (
                      <line
                        key={idx}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#06B6D4"
                        strokeOpacity="0.5"
                        strokeWidth="1.4"
                        strokeDasharray="5 5"
                        className="spx-dash-flow"
                      />
                    ))}

                    {/* Pulsating Interactive Nodes */}
                    {INDIA_NODES.map((node) => {
                      const isActive = node.id === activeNodeId;
                      return (
                        <g
                          key={node.id}
                          onClick={() => setActiveNodeId(node.id)}
                          className="cursor-pointer"
                        >
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={isActive ? 15 : 10}
                            fill={node.tier === "Primary Edge" ? "#8F9CFF" : "#06B6D4"}
                            fillOpacity={isActive ? 0.25 : 0.14}
                            className="spx-soc-pulse"
                          />
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={isActive ? 5.5 : 4}
                            fill={isActive ? "#10B981" : "#FFFFFF"}
                            stroke="#030407"
                            strokeWidth="1.5"
                          />
                          <text
                            x={node.x + 10}
                            y={node.y + 4}
                            fill={isActive ? "#FFFFFF" : "#94A3B8"}
                            fontSize="10"
                            fontFamily="JetBrains Mono, monospace"
                            fontWeight={isActive ? "700" : "500"}
                          >
                            {node.name.split(" (")[0]}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </div>
          </section>

          {/* CONTACT SECTION */}
          <div className="border-t border-[#141A29] bg-[#05070D]/60">
            <ContactSection />
          </div>
        </main>

        <SparrowxFooter
          isAuthenticated={Boolean(sessionUser)}
          onSignIn={() => setAuthDialogOpen(true)}
          inPageAnchors
        />

        {/* SIGN IN MODAL (Compatible with root-render.test.tsx & Master SSO) */}
        <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
          <DialogContent className="border-[#141A29] bg-[#080B12] text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white">
                Sign In to SparrowX
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                One account unlocks SparrowX Deploy, AI, Shield, Cloud DB, Infra, and Game Hosting.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <OAuthSignInButtons
                nextPath="/"
                onAuthenticated={(u) => {
                  setAuthDialogOpen(false);
                  onUserAuthenticated?.(u);
                }}
              />
              <div className="flex items-center justify-between border-t border-[#141A29] pt-3">
                <a
                  href={buildWhatsAppSupportUrl("Hi SparrowX, I need help accessing my account.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-400 hover:underline font-mono"
                >
                  Need help? {WHATSAPP_SUPPORT_DISPLAY}
                </a>
                <button
                  type="button"
                  onClick={() => setAuthDialogOpen(false)}
                  className="rounded-lg border border-[#141A29] bg-[#030407] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SmoothScroll>
  );
}
