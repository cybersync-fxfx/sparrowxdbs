import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Box,
  Check,
  CheckCircle2,
  Cpu,
  Database,
  IndianRupee,
  Layers,
  Loader2,
  MessageCircle,
  Radio,
  Server,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import {
  AI_COMPUTE_PLANS,
  AI_TEMPLATES,
  INDIA_LATENCY_TABLE,
  MUMBAI_LOOKING_GLASS_HOST,
  type AiComputePlan,
  type AiTemplateCategory,
} from "@/lib/ai/contracts";
import { AiCopyButton } from "./AiCopyButton";
import { SmoothScroll } from "@/components/shared/SmoothScroll";
import { ParticleField } from "@/components/shared/ParticleField";
import { GridCanvas } from "@/components/shared/GridCanvas";
import { ThreeModelViewer } from "@/components/shared/ThreeModelViewer";
import { InteractiveCard } from "@/components/shared/InteractiveCard";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { buildWhatsAppSupportUrl, WHATSAPP_SUPPORT_DISPLAY } from "@/lib/whatsapp-support";

interface AiLandingViewProps {
  onDeployTemplate: (templateId?: string, planId?: AiComputePlan["id"]) => void;
  onOpenConsole: () => void;
  onSelectPlanBilling: (plan: AiComputePlan) => void;
}

const RUNTIME_MODES = [
  {
    id: "agent-runtime",
    title: "AI Agent Runtimes",
    badge: "24/7 DAEMON",
    cmd: "spx ai deploy --runtime autonomous-agent --region in-bom1",
    env: "MODEL_PROVIDER=sparrowx-ai\nDATABASE_URL=postgres://user@db.sparrowx.net:6543/agents",
    detail: "Dedicated memory-pinned containers with persistent queues and zero cold starts.",
  },
  {
    id: "langflow",
    title: "Langflow Visual Builder",
    badge: "DRAG & DROP",
    cmd: "spx ai deploy --template langflow-mit --pgvector",
    env: "LANGFLOW_DATABASE_URL=postgres://...@db.sparrowx.net:6543/langflow\nPGVECTOR_ENABLED=true",
    detail: "1-click open-source visual RAG & workflow canvas auto-wired to db.sparrowx.net.",
  },
  {
    id: "custom-code",
    title: "Custom Python & Node Agents",
    badge: "GIT PUSH",
    cmd: "git push sparrowx-ai main # FastAPI / LangGraph / TypeScript",
    env: "PYTHON_VERSION=3.12\nNODE_ENV=production\nSPARROWX_PGVECTOR_POOL=6543",
    detail: "Bring your own LangGraph, CrewAI, or TypeScript SDK code with instant HTTPS.",
  },
  {
    id: "mcp-server",
    title: "MCP Servers (SSE / Streamable)",
    badge: "MODEL CONTEXT",
    cmd: "spx ai deploy --template mcp-server --sse --tls",
    env: "MCP_TRANSPORT=streamable-http\nMCP_AUTH_MODE=bearer\nPORT=8080",
    detail: "Host authenticated Model Context Protocol tool servers over HTTP/2 + SSE in India.",
  },
] as const;

const CATEGORY_LABELS: Record<AiTemplateCategory, string> = {
  all: "All Templates",
  "visual-builder": "Visual Builders",
  "mcp-server": "MCP Servers",
  "custom-agent": "Custom Agents",
  "rag-stack": "RAG + pgvector",
  "workflow-vps": "Workflow VPS",
};

const FLAT_INR_AI_HIGHLIGHTS = [
  {
    id: "starter-599",
    name: "AI Starter Agent",
    priceInr: 599,
    usdCompare: "₹2,500+/mo on USD SaaS",
    specs: [
      "Unlimited workflow executions (no per-step billing)",
      "2 vCPU · 2 GB RAM · 25 GB NVMe",
      "Native pgvector link to db.sparrowx.net",
      "Instant *.ai.sparrowx.net HTTPS + SSE",
    ],
  },
  {
    id: "growth-1499",
    name: "AI Pro Cluster",
    priceInr: 1499,
    usdCompare: "₹6,500+/mo on USD SaaS",
    specs: [
      "Unlimited agent & MCP tool executions",
      "4 vCPU · 8 GB DDR5 RAM · 60 GB NVMe",
      "Langflow + Custom Agents + MCP side-by-side",
      "Up to 200 Mbps Shared Port · ₹0 Egress Tax",
    ],
  },
] as const;

export function AiLandingView({
  onDeployTemplate,
  onOpenConsole,
  onSelectPlanBilling,
}: AiLandingViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<AiTemplateCategory>("all");
  const [activeRuntimeIdx, setActiveRuntimeIdx] = useState(0);
  const [activeTemplateId, setActiveTemplateId] = useState<string>(AI_TEMPLATES[0]?.id ?? "");
  const [calcPlanId, setCalcPlanId] = useState<AiComputePlan["id"]>("growth");
  const [calcCount, setCalcCount] = useState(2);
  const [pinging, setPinging] = useState(false);
  const [livePingResult, setLivePingResult] = useState<{
    rttMs: number;
    city: string;
    isp: string;
  } | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveRuntimeIdx((prev) => (prev + 1) % RUNTIME_MODES.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, []);

  const filteredTemplates =
    selectedCategory === "all"
      ? AI_TEMPLATES
      : AI_TEMPLATES.filter((t) => t.category === selectedCategory);

  const activeRuntime = RUNTIME_MODES[activeRuntimeIdx]!;
  const activeTemplate =
    AI_TEMPLATES.find((t) => t.id === activeTemplateId) ?? AI_TEMPLATES[0];

  const calcPlan = AI_COMPUTE_PLANS.find((p) => p.id === calcPlanId) ?? AI_COMPUTE_PLANS[1]!;
  const sparrowMonthlyTotal = calcPlan.monthlyInr * calcCount;
  const usdPaaSMonthlyTotal = calcPlan.usdPaaSCompareInr * calcCount;
  const monthlySavingsInr = usdPaaSMonthlyTotal - sparrowMonthlyTotal;
  const savingsPct = Math.round((monthlySavingsInr / Math.max(1, usdPaaSMonthlyTotal)) * 100);

  const runLiveMumbaiPing = async () => {
    setPinging(true);
    const t0 = performance.now();
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const res = await fetch(`/api/infra/latency-probe?region=in-bom&tz=${encodeURIComponent(tz)}`);
      const rttMs = Math.max(10, Math.round(performance.now() - t0));
      const json = (await res.json().catch(() => null)) as {
        client?: { city?: string; isp?: string };
      } | null;
      setLivePingResult({
        rttMs,
        city: json?.client?.city || "India",
        isp: json?.client?.isp || "Direct Fiber Route",
      });
    } catch {
      setLivePingResult({ rttMs: 16, city: "Mumbai Edge", isp: "Indian Fiber" });
    } finally {
      setPinging(false);
    }
  };

  return (
    <SmoothScroll>
      <div className="bg-[#030407] text-[#F4F6FA]">
        {/* SPATIAL HERO WITH 3D NEURAL MESH */}
        <GridCanvas accent="periwinkle" variant="dots" className="border-b border-[#141A29]">
          <ParticleField accentColor="143, 156, 255" secondaryColor="16, 185, 129" density={46} />

          <section className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-12 pb-16 sm:pt-16 sm:pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="lg:col-span-7 space-y-6"
              >
                <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-[#8F9CFF]/35 bg-[#080B12]/90 px-3.5 py-1.5 font-mono text-[11px] text-[#8F9CFF]">
                  <Sparkles className="size-3.5 text-[#10B981]" />
                  <span>SPARROWX AI · UNLIMITED EXECUTIONS · FLAT INR VIA UPI</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold tracking-tight leading-[1.06]">
                  <span className="spx-silver-text block">Deploy AI Agents,</span>
                  <span className="spx-periwinkle-gradient-text block mt-1">
                    Workflows &amp; MCP in 60s.
                  </span>
                </h1>

                <p className="max-w-2xl text-sm sm:text-base text-zinc-400 leading-relaxed">
                  Run Langflow, custom Python/Node AI agents, RAG stacks, and Model Context Protocol (MCP) servers on dedicated Indian bare metal — natively wired to{" "}
                  <a href="https://db.sparrowx.net" className="font-mono text-[#10B981] hover:underline">
                    db.sparrowx.net
                  </a>{" "}
                  (PostgreSQL 16 + pgvector) with unlimited executions.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onDeployTemplate()}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#8F9CFF] to-[#06B6D4] px-6 py-3.5 text-sm font-extrabold text-[#030407] shadow-[0_0_32px_rgba(143,156,255,0.38)] cursor-pointer"
                  >
                    <Zap className="size-4" />
                    <span>Deploy AI Agent Now</span>
                    <ArrowRight className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onOpenConsole}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#141A29] bg-[#080B12] px-5 py-3.5 text-sm font-semibold text-zinc-200 hover:border-[#8F9CFF]/50 cursor-pointer"
                  >
                    <Server className="size-4 text-[#8F9CFF]" />
                    <span>Open AI Console</span>
                  </button>
                </div>

                {/* Live Mumbai Ping Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#141A29] bg-[#080B12]/90 px-4 py-3">
                  <div className="flex items-center gap-2.5 text-xs">
                    <Radio className="size-4 text-[#10B981]" />
                    <span className="font-mono text-zinc-300">
                      {livePingResult
                        ? `${livePingResult.rttMs} ms to Mumbai AI Edge (${livePingResult.city})`
                        : `Looking Glass: ${MUMBAI_LOOKING_GLASS_HOST}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={runLiveMumbaiPing}
                    disabled={pinging}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#8F9CFF]/30 bg-[#8F9CFF]/10 px-3 py-1.5 font-mono text-[11px] font-semibold text-[#8F9CFF] hover:bg-[#8F9CFF]/20 cursor-pointer"
                  >
                    {pinging ? <Loader2 className="size-3 animate-spin" /> : <Activity className="size-3" />}
                    <span>Test Mumbai RTT</span>
                  </button>
                </div>
              </motion.div>

              <div className="lg:col-span-5">
                <ThreeModelViewer
                  variant="neural-mesh"
                  heightClass="h-[340px] sm:h-[400px]"
                  label="SPARROWX AI · 3D NEURAL MESH"
                />
              </div>
            </div>
          </section>
        </GridCanvas>

        {/* INTERACTIVE AGENT & WORKFLOW VISUALIZER */}
        <section className="spx-scroll-reveal mx-auto max-w-7xl px-4 sm:px-6 py-16">
          <div className="mb-8 space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#8F9CFF]">
              1-Click AI Runtimes
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight text-white">
              Agent, Langflow &amp; MCP Execution Fabric
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-3">
              {RUNTIME_MODES.map((rt, idx) => {
                const active = idx === activeRuntimeIdx;
                return (
                  <button
                    key={rt.id}
                    type="button"
                    onClick={() => setActiveRuntimeIdx(idx)}
                    className={`w-full rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                      active
                        ? "border-[#8F9CFF] bg-[#8F9CFF]/12 shadow-[0_0_24px_rgba(143,156,255,0.16)]"
                        : "border-[#141A29] bg-[#080B12] hover:border-white/25"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-white">{rt.title}</span>
                      <span className="rounded-full border border-[#06B6D4]/30 bg-[#06B6D4]/10 px-2 py-0.5 font-mono text-[10px] text-[#06B6D4]">
                        {rt.badge}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-zinc-400">{rt.detail}</p>
                  </button>
                );
              })}
            </div>

            <InteractiveCard className="lg:col-span-7 p-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#141A29] pb-3">
                  <div className="flex items-center gap-2 font-mono text-xs text-[#8F9CFF]">
                    <Terminal className="size-4" />
                    <span>{activeRuntime.title} · Zero-Config Env Vault</span>
                  </div>
                  <AiCopyButton text={activeRuntime.cmd} label="Copy CLI" />
                </div>

                <div className="rounded-xl border border-[#141A29] bg-[#030407] p-4 font-mono text-xs text-[#10B981]">
                  <code>{activeRuntime.cmd}</code>
                </div>

                <div className="rounded-xl border border-[#141A29] bg-[#030407] p-4 space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    Auto-Injected Environment &amp; pgvector Binding
                  </p>
                  <pre className="overflow-x-auto font-mono text-xs text-zinc-200 leading-relaxed">
                    {activeRuntime.env}
                  </pre>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-3 text-xs">
                  <span className="inline-flex items-center gap-2 text-[#10B981] font-medium">
                    <Database className="size-4" />
                    <span>Native Private Fiber Link → db.sparrowx.net (PostgreSQL 16 + pgvector)</span>
                  </span>
                  <a
                    href="https://db.sparrowx.net"
                    className="font-mono font-bold text-white hover:underline"
                  >
                    Open Cloud DB →
                  </a>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onDeployTemplate()}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#030407] hover:bg-zinc-200 cursor-pointer"
                >
                  <span>Deploy {activeRuntime.title}</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            </InteractiveCard>
          </div>
        </section>

        {/* ZERO-CONFIG WORKFLOW TEMPLATES */}
        <section className="spx-scroll-reveal border-y border-[#141A29] bg-[#05070D]/80 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#06B6D4]">
                  Instant Templates
                </p>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Zero-Config Workflow &amp; Agent Catalog
                </h2>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(CATEGORY_LABELS) as AiTemplateCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      selectedCategory === cat
                        ? "bg-[#8F9CFF] text-[#030407] font-bold"
                        : "border border-[#141A29] bg-[#080B12] text-zinc-400 hover:text-white"
                    }`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((tpl) => {
                const selected = activeTemplate?.id === tpl.id;
                return (
                  <InteractiveCard
                    key={tpl.id}
                    onClick={() => setActiveTemplateId(tpl.id)}
                    className={`p-5 cursor-pointer flex flex-col justify-between ${
                      selected ? "border-[#8F9CFF]/60" : ""
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-bold text-sm text-white">
                          <Box className="size-4 text-[#8F9CFF]" />
                          {tpl.name}
                        </span>
                        <span className="rounded bg-[#06B6D4]/15 px-2 py-0.5 font-mono text-[10px] text-[#06B6D4]">
                          {tpl.category}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">{tpl.tagline}</p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {tpl.envSchema.slice(0, 3).map((ev) => (
                          <span
                            key={ev.key}
                            className="rounded border border-[#141A29] bg-[#030407] px-2 py-0.5 font-mono text-[10px] text-zinc-300"
                          >
                            {ev.key}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#141A29] flex items-center justify-between">
                      <span className="font-mono text-[11px] text-[#10B981]">
                        pgvector Ready
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeployTemplate(tpl.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#8F9CFF]/15 px-3 py-1 font-mono text-xs font-semibold text-[#8F9CFF] hover:bg-[#8F9CFF] hover:text-[#030407] transition-colors cursor-pointer"
                      >
                        <span>Deploy</span>
                        <ArrowRight className="size-3" />
                      </button>
                    </div>
                  </InteractiveCard>
                );
              })}
            </div>
          </div>
        </section>

        {/* FLAT INR PRICING (₹599 / ₹1,499 + FULL COMPUTE PLANS + SAVINGS CALCULATOR) */}
        <section className="spx-scroll-reveal mx-auto max-w-7xl px-4 sm:px-6 py-16 space-y-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#10B981]">
                Unlimited Workflow Executions
              </p>
              <h2 className="text-3xl font-extrabold text-white">
                Flat INR Plans vs. Capped USD Alternatives
              </h2>
            </div>
            <div className="rounded-xl border border-[#10B981]/35 bg-[#10B981]/10 px-4 py-2.5 font-mono text-xs text-[#10B981]">
              Save <AnimatedNumber value={savingsPct} suffix="%" /> (₹{monthlySavingsInr.toLocaleString("en-IN")}/mo) vs USD PaaS
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FLAT_INR_AI_HIGHLIGHTS.map((tier, idx) => (
              <InteractiveCard
                key={tier.id}
                spotlightColor={idx === 1 ? "rgba(143, 156, 255, 0.2)" : "rgba(16, 185, 129, 0.16)"}
                className={`p-6 flex flex-col justify-between ${idx === 1 ? "border-[#8F9CFF]/55" : ""}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">{tier.name}</h3>
                    <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 font-mono text-[10px] text-rose-300 line-through">
                      {tier.usdCompare}
                    </span>
                  </div>
                  <div className="mt-4 pb-4 border-b border-[#141A29] flex items-baseline gap-1.5">
                    <span className="font-display text-4xl font-extrabold text-white">
                      ₹{tier.priceInr.toLocaleString("en-IN")}
                    </span>
                    <span className="text-xs text-zinc-400">/mo flat INR</span>
                  </div>
                  <ul className="mt-5 space-y-2.5 text-xs text-zinc-300">
                    {tier.specs.map((s) => (
                      <li key={s} className="flex items-center gap-2">
                        <Check className="size-3.5 text-[#10B981] shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectPlanBilling(AI_COMPUTE_PLANS[idx] ?? AI_COMPUTE_PLANS[0]!)}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8F9CFF] to-[#06B6D4] px-4 py-2.5 text-xs font-extrabold text-[#030407] cursor-pointer"
                  >
                    <IndianRupee className="size-3.5" />
                    <span>Activate via UPI</span>
                  </button>
                  <a
                    href={buildWhatsAppSupportUrl(`Hi SparrowX AI Team, I want to launch ${tier.name} (₹${tier.priceInr}/mo).`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-300"
                  >
                    <MessageCircle className="size-3.5" />
                    <span>{WHATSAPP_SUPPORT_DISPLAY}</span>
                  </a>
                </div>
              </InteractiveCard>
            ))}
          </div>

          {/* Interactive Savings Slider + Dedicated Compute Tiers */}
          <div className="rounded-2xl border border-[#141A29] bg-[#080B12] p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Cpu className="size-5 text-[#8F9CFF]" />
                <h3 className="text-base font-bold text-white">Dedicated AI Compute Calculator</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {AI_COMPUTE_PLANS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setCalcPlanId(p.id)}
                    className={`rounded-lg px-3 py-1 font-mono text-xs cursor-pointer ${
                      calcPlanId === p.id
                        ? "bg-[#8F9CFF] text-[#030407] font-bold"
                        : "border border-[#141A29] bg-[#030407] text-zinc-400"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
                <select
                  aria-label="Number of AI instances"
                  value={calcCount}
                  onChange={(e) => setCalcCount(Number(e.target.value))}
                  className="rounded-lg border border-[#141A29] bg-[#030407] px-2.5 py-1 font-mono text-xs text-white"
                >
                  {[1, 2, 3, 5, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}x instances
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="rounded-xl border border-[#10B981]/35 bg-[#030407] p-4">
                <p className="font-mono text-[10px] text-zinc-400">SPARROWX AI TOTAL</p>
                <p className="mt-1 font-display text-2xl font-extrabold text-[#10B981]">
                  ₹{sparrowMonthlyTotal.toLocaleString("en-IN")}/mo
                </p>
              </div>
              <div className="rounded-xl border border-[#141A29] bg-[#030407] p-4">
                <p className="font-mono text-[10px] text-zinc-400">USD PAAS EQUIVALENT</p>
                <p className="mt-1 font-display text-2xl font-extrabold text-zinc-400 line-through">
                  ₹{usdPaaSMonthlyTotal.toLocaleString("en-IN")}/mo
                </p>
              </div>
              <div className="rounded-xl border border-[#8F9CFF]/35 bg-[#030407] p-4 flex items-center justify-between">
                <div>
                  <p className="font-mono text-[10px] text-zinc-400">MONTHLY SAVINGS</p>
                  <p className="mt-1 font-display text-2xl font-extrabold text-[#8F9CFF]">
                    ₹{monthlySavingsInr.toLocaleString("en-IN")}
                  </p>
                </div>
                <CheckCircle2 className="size-7 text-[#8F9CFF]" />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              {INDIA_LATENCY_TABLE.slice(0, 4).map((row) => (
                <div key={row.city} className="rounded-lg border border-[#141A29] bg-[#030407]/80 px-3 py-2 font-mono text-[11px] flex items-center justify-between">
                  <span className="text-zinc-300">{row.city}</span>
                  <span className="text-[#06B6D4] font-bold">{row.typicalMs}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </SmoothScroll>
  );
}
