import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  GitBranch,
  Globe,
  Lock,
  MessageCircle,
  Pause,
  Play,
  QrCode,
  Rocket,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react";
import {
  SiDocker,
  SiFastapi,
  SiGo,
  SiNextdotjs,
  SiNodedotjs,
  SiPython,
  SiReact,
  SiVite,
} from "react-icons/si";
import { SmoothScroll } from "@/components/shared/SmoothScroll";
import { ParticleField } from "@/components/shared/ParticleField";
import { GridCanvas } from "@/components/shared/GridCanvas";
import { ThreeModelViewer } from "@/components/shared/ThreeModelViewer";
import { InteractiveCard } from "@/components/shared/InteractiveCard";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { SparrowxFooter } from "@/components/SparrowxFooter";
import { buildWhatsAppSupportUrl, WHATSAPP_SUPPORT_DISPLAY } from "@/lib/whatsapp-support";

const PIPELINE_STEPS = [
  {
    id: "push",
    label: "1. Git Push",
    cmd: "$ git push origin main",
    log: "Enumerating objects: 18, done. Triggering SparrowX Mumbai Edge builder...",
    latency: "0.4s",
  },
  {
    id: "build",
    label: "2. Railpack / Docker",
    cmd: "▶ Building image with zero-config cache",
    log: "Detected Next.js / TanStack / Node runtime • Layers cached • 0 warnings",
    latency: "14.2s",
  },
  {
    id: "ssl",
    label: "3. Let's Encrypt TLS",
    cmd: "▶ Issuing TLS 1.3 certificate",
    log: "DNS verified • HTTP/2 + WebSocket Upgrade + Edge WAF attached",
    latency: "3.1s",
  },
  {
    id: "live",
    label: "4. Live on Edge",
    cmd: "✓ https://your-app.deploy.sparrowx.net",
    log: "200 OK · 12 ms Mumbai Edge · Up to 200 Mbps shared port active",
    latency: "LIVE",
  },
] as const;

const FRAMEWORKS = [
  { name: "Next.js", icon: SiNextdotjs, color: "#FFFFFF" },
  { name: "TanStack Start", icon: Zap, color: "#06B6D4" },
  { name: "React", icon: SiReact, color: "#61DAFB" },
  { name: "Vite", icon: SiVite, color: "#8F9CFF" },
  { name: "Node.js", icon: SiNodedotjs, color: "#10B981" },
  { name: "Python", icon: SiPython, color: "#F59E0B" },
  { name: "FastAPI", icon: SiFastapi, color: "#06B6D4" },
  { name: "Docker", icon: SiDocker, color: "#2496ED" },
  { name: "Go", icon: SiGo, color: "#38BDF8" },
] as const;

const DEPLOY_PRICING = [
  {
    id: "hobby",
    name: "Starter PaaS",
    priceInr: 299,
    tagline: "Indie apps, portfolios, APIs & Discord bots",
    specs: [
      "1 vCPU · 1 GB RAM · 15 GB NVMe",
      "Up to 200 Mbps Shared Port",
      "Instant *.deploy.sparrowx.net + Custom Domains",
      "Automated Let's Encrypt SSL & GitHub auto-deploy",
    ],
    featured: false,
  },
  {
    id: "pro",
    name: "Pro Production",
    priceInr: 999,
    tagline: "Production SaaS, SSR storefronts & realtime APIs",
    specs: [
      "2 vCPU · 4 GB DDR5 RAM · 50 GB NVMe",
      "Up to 200 Mbps Shared Port · ₹0 Egress Tax",
      "Zero-downtime rollouts & live SSE build logs",
      "Native private link to db.sparrowx.net PostgreSQL",
    ],
    featured: true,
  },
  {
    id: "scale",
    name: "Scale Cluster",
    priceInr: 1999,
    tagline: "High-concurrency microservices & container stacks",
    specs: [
      "4 vCPU · 8 GB DDR5 RAM · 100 GB NVMe",
      "Up to 200 Mbps Shared Port · Always-on Edge WAF",
      "Unlimited team projects & preview deployments",
      "Priority WhatsApp & NOC engineering support",
    ],
    featured: false,
  },
] as const;

export interface DeployLandingViewProps {
  onSignIn?: () => void;
}

export function DeployLandingView({ onSignIn }: DeployLandingViewProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [marqueePaused, setMarqueePaused] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStepIdx((prev) => (prev + 1) % PIPELINE_STEPS.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, []);

  const currentStep = PIPELINE_STEPS[stepIdx]!;
  const loginHref = "/login?next=%2Fdeploy";

  return (
    <SmoothScroll>
      <div className="min-h-screen bg-[#030407] text-[#F4F6FA] flex flex-col selection:bg-[#8F9CFF] selection:text-[#030407]">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-[#141A29] bg-[#030407]/88 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-2.5">
              <img src="/logos/sparrowx-silver.png" alt="SparrowX Deploy" width={28} height={28} className="size-7 object-contain" />
              <span className="font-display text-sm font-extrabold tracking-wider text-white">
                SPARROWX <span className="text-[#8F9CFF]">DEPLOY</span>
              </span>
              <span className="hidden sm:inline-flex rounded-full border border-[#06B6D4]/30 bg-[#06B6D4]/10 px-2.5 py-0.5 font-mono text-[10px] text-[#06B6D4]">
                deploy.sparrowx.net
              </span>
            </div>

            <nav className="hidden md:flex items-center gap-6 text-xs text-zinc-400">
              <a href="#git-to-live" className="hover:text-white transition-colors">Git-to-Live</a>
              <a href="#frameworks" className="hover:text-white transition-colors">Frameworks</a>
              <a href="#deploy-pricing" className="hover:text-white transition-colors">Flat INR Pricing</a>
              <a href="https://sparrowx.net" className="hover:text-[#8F9CFF] transition-colors">Master Hub</a>
            </nav>

            <div className="flex items-center gap-2">
              {onSignIn ? (
                <button
                  type="button"
                  onClick={onSignIn}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#8F9CFF] to-[#06B6D4] px-4 py-2 text-xs font-extrabold text-[#030407] cursor-pointer"
                >
                  <Rocket className="size-3.5" />
                  <span>Open Console</span>
                </button>
              ) : (
                <a
                  href={loginHref}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#8F9CFF] to-[#06B6D4] px-4 py-2 text-xs font-extrabold text-[#030407]"
                >
                  <Rocket className="size-3.5" />
                  <span>Deploy with GitHub</span>
                </a>
              )}
            </div>
          </div>
        </header>

        <main className="relative flex-1">
          {/* HERO WITH 3D SERVER RACK CLUSTER */}
          <GridCanvas accent="cyan" variant="blueprint" className="border-b border-[#141A29]">
            <ParticleField accentColor="143, 156, 255" secondaryColor="6, 182, 212" density={42} />

            <section className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-14 pb-16 sm:pt-20 sm:pb-24">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="lg:col-span-7 space-y-6"
                >
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#8F9CFF]/30 bg-[#080B12]/90 px-3.5 py-1.5 font-mono text-[11px] text-[#8F9CFF]">
                    <GitBranch className="size-3.5 text-[#06B6D4]" />
                    <span>GIT-TO-EDGE CLOUD PAAS · MUMBAI BARE METAL</span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.06]">
                    <span className="spx-silver-text block">Push Code.</span>
                    <span className="spx-periwinkle-gradient-text block mt-1">
                      Live in India in 18 Seconds.
                    </span>
                  </h1>

                  <p className="max-w-2xl text-sm sm:text-base text-zinc-400 leading-relaxed">
                    Connect GitHub, push to <code className="font-mono text-[#06B6D4]">main</code>, and watch your Next.js, TanStack, Node, Python, or Docker container boot on Indian bare metal with instant Let&apos;s Encrypt TLS and flat INR pricing starting at ₹299/mo.
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={loginHref}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#8F9CFF] to-[#06B6D4] px-6 py-3.5 text-sm font-extrabold text-[#030407] shadow-[0_0_32px_rgba(143,156,255,0.35)]"
                    >
                      <Rocket className="size-4" />
                      <span>Deploy Your First App</span>
                      <ArrowRight className="size-4" />
                    </a>
                    <a
                      href="#deploy-pricing"
                      className="inline-flex items-center gap-2 rounded-xl border border-[#141A29] bg-[#080B12] px-5 py-3.5 text-sm font-semibold text-zinc-200 hover:border-[#8F9CFF]/50"
                    >
                      <span>View ₹299/mo Plans</span>
                    </a>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2 max-w-lg">
                    {[
                      { label: "Avg Build", val: 18, suffix: "s" },
                      { label: "Shared Port", val: 200, suffix: " Mbps" },
                      { label: "Starting Flat", val: 299, prefix: "₹", suffix: "/mo" },
                    ].map((m) => (
                      <div key={m.label} className="rounded-xl border border-[#141A29] bg-[#080B12]/90 p-3">
                        <p className="font-display text-xl font-bold text-white">
                          <AnimatedNumber value={m.val} prefix={m.prefix} suffix={m.suffix} />
                        </p>
                        <p className="font-mono text-[10px] text-zinc-400">{m.label}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <div className="lg:col-span-5">
                  <ThreeModelViewer
                    variant="server-rack"
                    heightClass="h-[340px] sm:h-[400px]"
                    label="SPARROWX DEPLOY · 3D RACK CLUSTER"
                  />
                </div>
              </div>
            </section>
          </GridCanvas>

          {/* GIT-TO-LIVE INTERACTIVE MOTION PIPELINE */}
          <section id="git-to-live" className="spx-scroll-reveal mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24">
            <div className="mb-10 space-y-2">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#06B6D4]">
                Zero-Config Pipeline
              </p>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Git-to-Live in Four Automated Stages
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left: Interactive Terminal Editor */}
              <InteractiveCard className="lg:col-span-5 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-[#141A29] pb-3">
                    <div className="flex items-center gap-2 font-mono text-xs text-zinc-300">
                      <Terminal className="size-4 text-[#8F9CFF]" />
                      <span>repo/sparrowx-app — main</span>
                    </div>
                    <span className="rounded bg-[#10B981]/15 px-2 py-0.5 font-mono text-[10px] text-[#10B981]">
                      AUTO-DEPLOY
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 font-mono text-xs">
                    {PIPELINE_STEPS.map((st, idx) => {
                      const active = idx === stepIdx;
                      const done = idx < stepIdx;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setStepIdx(idx)}
                          className={`w-full rounded-xl border p-3 text-left transition-all cursor-pointer ${
                            active
                              ? "border-[#8F9CFF] bg-[#8F9CFF]/12 text-white"
                              : done
                                ? "border-[#10B981]/30 bg-[#10B981]/5 text-zinc-300"
                                : "border-[#141A29] bg-[#030407]/70 text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold">{st.label}</span>
                            <span className="text-[10px] text-[#06B6D4]">{st.latency}</span>
                          </div>
                          <p className="mt-1 truncate text-[11px] text-zinc-300">{st.cmd}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <p className="mt-4 font-mono text-[11px] text-zinc-400">
                  {currentStep.log}
                </p>
              </InteractiveCard>

              {/* Center: Animated Morphing Pipeline Connector */}
              <div className="lg:col-span-2 flex flex-col items-center justify-center py-2">
                <div className="flex lg:flex-col items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-2xl border border-[#8F9CFF]/40 bg-[#8F9CFF]/15 text-[#8F9CFF] shadow-[0_0_24px_rgba(143,156,255,0.3)]">
                    <Zap className="size-5" />
                  </span>
                  <div className="h-1 w-16 lg:h-20 lg:w-1 rounded-full bg-gradient-to-r lg:bg-gradient-to-b from-[#8F9CFF] via-[#06B6D4] to-[#10B981]" />
                  <span className="rounded-full border border-[#10B981]/40 bg-[#10B981]/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#10B981]">
                    TLS 1.3
                  </span>
                </div>
              </div>

              {/* Right: Live Preview Browser Card */}
              <InteractiveCard
                spotlightColor="rgba(16, 185, 129, 0.16)"
                className="lg:col-span-5 p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-[#141A29] bg-[#030407] px-3 py-2 font-mono text-[11px]">
                    <span className="inline-flex items-center gap-1.5 text-[#10B981] truncate">
                      <Lock className="size-3 shrink-0" />
                      <span>https://your-app.deploy.sparrowx.net</span>
                    </span>
                    <span className="shrink-0 rounded bg-[#10B981]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#10B981]">
                      Let&apos;s Encrypt SSL
                    </span>
                  </div>

                  <motion.div
                    key={currentStep.id}
                    initial={{ opacity: 0.5, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35 }}
                    className="mt-4 rounded-xl border border-[#141A29] bg-gradient-to-br from-[#0B1020] via-[#080B12] to-[#030407] p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[#10B981]">
                        <CheckCircle2 className="size-4" />
                        <span>Deployment {stepIdx === 3 ? "Live" : currentStep.label}</span>
                      </span>
                      <span className="font-mono text-[10px] text-zinc-400">Mumbai BOM-1</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg border border-white/10 bg-[#030407]/80 p-3">
                        <p className="font-mono text-[10px] text-zinc-500">EDGE LATENCY</p>
                        <p className="mt-1 font-mono text-sm font-bold text-[#06B6D4]">12 ms</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-[#030407]/80 p-3">
                        <p className="font-mono text-[10px] text-zinc-500">PORT CAPACITY</p>
                        <p className="mt-1 font-mono text-sm font-bold text-[#8F9CFF]">200 Mbps</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border border-[#06B6D4]/25 bg-[#06B6D4]/10 px-3 py-2 text-[11px] text-[#06B6D4]">
                      <ShieldCheck className="size-4 shrink-0" />
                      <span>Protected by SparrowX Shield L7 WAF &amp; DDoS edge scrubbing</span>
                    </div>
                  </motion.div>
                </div>

                <a
                  href={loginHref}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#8F9CFF]/40 bg-[#8F9CFF]/12 px-4 py-2.5 text-xs font-bold text-white hover:bg-[#8F9CFF]/25 transition-colors"
                >
                  <Globe className="size-4 text-[#8F9CFF]" />
                  <span>Connect GitHub &amp; Launch Now</span>
                </a>
              </InteractiveCard>
            </div>
          </section>

          {/* FRAMEWORK MARQUEE WITH ACCESSIBLE PAUSE/PLAY CONTROL (WCAG 2.2.2) */}
          <section id="frameworks" className="border-y border-[#141A29] bg-[#05070D]/80 py-12 overflow-hidden">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#8F9CFF]">
                  Zero-Config Detection
                </p>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  First-Class Framework &amp; Container Support
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setMarqueePaused((p) => !p)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#141A29] bg-[#080B12] px-3 py-1.5 font-mono text-xs text-zinc-300 hover:border-[#8F9CFF]/45 hover:text-white cursor-pointer"
              >
                {marqueePaused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                <span>{marqueePaused ? "Play Carousel" : "Pause Carousel"}</span>
              </button>
            </div>

            <div className="relative overflow-hidden">
              <div
                className={`flex w-max gap-4 spx-animate-marquee ${
                  marqueePaused ? "spx-animate-marquee-paused" : ""
                }`}
              >
                {[...FRAMEWORKS, ...FRAMEWORKS].map((fw, idx) => {
                  const Icon = fw.icon;
                  return (
                    <div
                      key={`${fw.name}-${idx}`}
                      className="flex items-center gap-3 rounded-2xl border border-[#141A29] bg-[#080B12] px-5 py-3.5 min-w-[190px]"
                    >
                      <Icon className="size-5 shrink-0" style={{ color: fw.color }} aria-hidden="true" />
                      <span className="font-display text-sm font-semibold text-white">
                        {fw.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* FLAT INR PRICING CARDS */}
          <section id="deploy-pricing" className="spx-scroll-reveal mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24">
            <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#10B981]">
                  Flat INR · UPI QR Supported
                </p>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                  Predictable Indian PaaS Pricing
                </h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#10B981]/35 bg-[#10B981]/10 px-3.5 py-1.5 font-mono text-xs text-[#10B981]">
                <QrCode className="size-3.5" />
                <span>UPI QR Auto-Activation · Up to 200 Mbps Shared Port</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {DEPLOY_PRICING.map((plan) => (
                <InteractiveCard
                  key={plan.id}
                  spotlightColor={plan.featured ? "rgba(143, 156, 255, 0.22)" : "rgba(6, 182, 212, 0.14)"}
                  className={`p-6 flex flex-col justify-between ${
                    plan.featured ? "border-[#8F9CFF]/60" : ""
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                      {plan.featured && (
                        <span className="rounded-full bg-[#8F9CFF] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#030407]">
                          POPULAR
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">{plan.tagline}</p>

                    <div className="mt-5 pb-4 border-b border-[#141A29] flex items-baseline gap-1.5">
                      <span className="font-display text-4xl font-extrabold text-white">
                        ₹{plan.priceInr.toLocaleString("en-IN")}
                      </span>
                      <span className="text-xs text-zinc-400">/mo flat INR</span>
                    </div>

                    <ul className="mt-5 space-y-2.5 text-xs text-zinc-300">
                      {plan.specs.map((spec) => (
                        <li key={spec} className="flex items-start gap-2">
                          <Check className="mt-0.5 size-3.5 shrink-0 text-[#10B981]" />
                          <span>{spec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 space-y-2">
                    <a
                      href={loginHref}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors ${
                        plan.featured
                          ? "bg-gradient-to-r from-[#8F9CFF] to-[#06B6D4] text-[#030407]"
                          : "border border-[#8F9CFF]/35 bg-[#8F9CFF]/10 text-white hover:bg-[#8F9CFF]/25"
                      }`}
                    >
                      <span>Start {plan.name}</span>
                      <ArrowRight className="size-3.5" />
                    </a>
                    <a
                      href={buildWhatsAppSupportUrl(`Hi SparrowX Deploy Team, I'd like to activate ${plan.name} (₹${plan.priceInr}/mo).`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#030407]/70 px-3 py-2 text-[11px] text-emerald-300 hover:border-emerald-500/40"
                    >
                      <MessageCircle className="size-3.5" />
                      <span>WhatsApp Setup · {WHATSAPP_SUPPORT_DISPLAY}</span>
                    </a>
                  </div>
                </InteractiveCard>
              ))}
            </div>
          </section>
        </main>

        <SparrowxFooter />
      </div>
    </SmoothScroll>
  );
}
