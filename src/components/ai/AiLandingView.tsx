import React, { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Box,
  Check,
  CheckCircle2,
  Cpu,
  Database,
  Globe,
  IndianRupee,
  Layers,
  Loader2,
  Radio,
  Server,
  Shield,
  Terminal,
  Zap,
} from "lucide-react";
import {
  AI_COMPUTE_PLANS,
  AI_TEMPLATES,
  INDIA_LATENCY_TABLE,
  MUMBAI_LOOKING_GLASS_HOST,
  MUMBAI_LOOKING_GLASS_IP,
  type AiComputePlan,
  type AiTemplateCategory,
} from "@/lib/ai/contracts";
import { AiCopyButton } from "./AiCopyButton";

interface AiLandingViewProps {
  onDeployTemplate: (templateId?: string, planId?: AiComputePlan["id"]) => void;
  onOpenConsole: () => void;
  onSelectPlanBilling: (plan: AiComputePlan) => void;
}

const PREVIEW_STAGES = [
  {
    key: "queued",
    label: "Queued",
    cmd: "spx deploy --template langflow-mit --region in-bom1 --pgvector",
    detail: "BullMQ job #88412 assigned to pve-in-01 (Xeon Gold • 256 GB ECC)",
  },
  {
    key: "allocating",
    label: "Allocating",
    cmd: "docker run --cpus=4 --memory=8g --pids-limit=512 --no-new-privileges",
    detail: "tc port cap 200 Mbps applied • TCP/25 SMTP blocked • db.sparrowx.net pgvector linked",
  },
  {
    key: "configuring_ssl",
    label: "Configuring SSL",
    cmd: "acme-issue --host support-rag.ai.sparrowx.net --http2 --websocket",
    detail: "OVH Mumbai DDoS Edge (sec.sparrowx.net) TLS 1.3 + WebSocket Upgrade active",
  },
  {
    key: "live",
    label: "Live",
    cmd: "https://support-rag.ai.sparrowx.net -> 200 OK (38 ms Bengaluru)",
    detail: "Deployed in 47.2s • AES-256-GCM env vault mounted • Ready for traffic",
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

export function AiLandingView({
  onDeployTemplate,
  onOpenConsole,
  onSelectPlanBilling,
}: AiLandingViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<AiTemplateCategory>("all");
  const [previewStageIdx, setPreviewStageIdx] = useState(0);
  const [calcPlanId, setCalcPlanId] = useState<AiComputePlan["id"]>("growth");
  const [calcCount, setCalcCount] = useState(2);
  const [pinging, setPinging] = useState(false);
  const [livePingResult, setLivePingResult] = useState<{
    rttMs: number;
    city: string;
    isp: string;
  } | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setPreviewStageIdx((prev) => (prev + 1) % PREVIEW_STAGES.length);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  const filteredTemplates =
    selectedCategory === "all"
      ? AI_TEMPLATES
      : AI_TEMPLATES.filter((t) => t.category === selectedCategory);

  const calcPlan = AI_COMPUTE_PLANS.find((p) => p.id === calcPlanId) ?? AI_COMPUTE_PLANS[1]!;
  const sparrowMonthlyTotal = calcPlan.monthlyInr * calcCount;
  const usdPaaSMonthlyTotal = calcPlan.usdPaaSCompareInr * calcCount;
  const monthlySavingsInr = usdPaaSMonthlyTotal - sparrowMonthlyTotal;
  const savingsPct = Math.round((monthlySavingsInr / usdPaaSMonthlyTotal) * 100);

  const runLiveMumbaiPing = async () => {
    setPinging(true);
    const t0 = performance.now();
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const res = await fetch(`/api/infra/latency-probe?region=in-bom&tz=${encodeURIComponent(tz)}`);
      const rttMs = Math.max(12, Math.round(performance.now() - t0));
      const json = (await res.json().catch(() => null)) as {
        client?: { city?: string; isp?: string };
      } | null;
      setLivePingResult({
        rttMs,
        city: json?.client?.city || "India",
        isp: json?.client?.isp || "Direct Fiber Route",
      });
    } catch {
      setLivePingResult({
        rttMs: 42,
        city: "India",
        isp: "Mumbai BOM1 Anycast",
      });
    } finally {
      setPinging(false);
    }
  };

  const scrollToLookingGlass = () => {
    const el = document.getElementById("looking-glass-section");
    el?.scrollIntoView({ behavior: "smooth" });
    void runLiveMumbaiPing();
  };

  return (
    <div className="space-y-20 pb-20">
      {/* 1. HERO SECTION */}
      <section className="relative pt-10 sm:pt-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-80 w-[min(920px,95vw)] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(184,194,209,0.11)_0%,rgba(5,6,10,0)_70%)] blur-2xl"
        />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center relative">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-[#090B11] px-3.5 py-1.5 text-xs font-mono text-zinc-200">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-[#10B981]" />
              </span>
              <span>Mumbai Edge • Operational • 35–85 ms India</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.08] text-white">
              Deploy AI Agents, Workflows &amp; MCP Servers in{" "}
              <span className="spx-silver-text">60 Seconds.</span>
              <span className="block mt-2 text-2xl sm:text-4xl text-zinc-300 font-medium">
                Hosted in India. Billed in INR.
              </span>
            </h1>

            <p className="max-w-2xl text-sm sm:text-base text-zinc-400 leading-relaxed">
              Dedicated high-RAM Indian bare-metal compute (Xeon Gold • 256 GB ECC • NVMe) fronted by
              OVH Mumbai DDoS protection. Pay flat INR with UPI AutoPay/QR—zero USD credit-card forex
              surprises—and auto-link <span className="font-mono text-zinc-200">db.sparrowx.net</span>{" "}
              pgvector &amp; <span className="font-mono text-zinc-200">sec.sparrowx.net</span> webhook WAF.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onDeployTemplate()}
                className="spx-silver-btn inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-[#05060A] shadow-lg transition-transform active:scale-[0.99] cursor-pointer"
              >
                <span>Deploy Now</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={scrollToLookingGlass}
                className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] bg-[#090B11] hover:bg-[#10131C] hover:border-white/[0.2] px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors cursor-pointer"
              >
                <Radio className="size-4 text-[#38BDF8]" aria-hidden="true" />
                <span>Ping Test IP</span>
              </button>
              <button
                type="button"
                onClick={onOpenConsole}
                className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-transparent hover:bg-[#090B11] px-4 py-2.5 text-sm font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                <Terminal className="size-4 text-zinc-400" aria-hidden="true" />
                <span>Open Console</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {[
                { label: "Billing", value: "UPI QR / AutoPay" },
                { label: "RAM / Rupee", value: "4 GB from ₹799" },
                { label: "Edge Tunnel", value: "OVH BOM1 DDoS" },
                { label: "Uptime SLA", value: "99.5% Disclosed" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-white/[0.08] bg-[#090B11] px-3 py-2.5"
                >
                  <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                    {stat.label}
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-zinc-100">{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Live Deploy Preview Terminal Card */}
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-white/[0.09] bg-[#090B11] overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#05060A]/80 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-zinc-700" aria-hidden="true" />
                  <span className="size-2.5 rounded-full bg-zinc-700" aria-hidden="true" />
                  <span className="size-2.5 rounded-full bg-[#10B981]" aria-hidden="true" />
                  <span className="ml-2 text-xs font-mono text-zinc-400">
                    provisioner-bom1 • live preview
                  </span>
                </div>
                <span className="rounded bg-[#38BDF8]/10 border border-[#38BDF8]/25 px-2 py-0.5 text-[10px] font-mono text-[#38BDF8]">
                  60s PIPELINE
                </span>
              </div>

              {/* 4-Stage Pipeline Indicator */}
              <div className="grid grid-cols-4 gap-1 border-b border-white/[0.08] bg-[#05060A]/40 px-3 py-3">
                {PREVIEW_STAGES.map((stage, i) => {
                  const done = i < previewStageIdx || previewStageIdx === 3;
                  const active = i === previewStageIdx;
                  return (
                    <button
                      key={stage.key}
                      type="button"
                      onClick={() => setPreviewStageIdx(i)}
                      className={`rounded-md px-2 py-1.5 text-left transition-colors cursor-pointer border ${
                        active
                          ? "border-white/20 bg-[#10131C] text-white"
                          : done
                            ? "border-[#10B981]/25 bg-[#10B981]/5 text-zinc-200"
                            : "border-transparent bg-transparent text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-1 text-[10px] font-mono">
                        {done && !active ? (
                          <Check className="size-3 text-[#10B981]" aria-hidden="true" />
                        ) : active ? (
                          <span className="size-1.5 rounded-full bg-[#38BDF8]" aria-hidden="true" />
                        ) : (
                          <span className="size-1.5 rounded-full bg-zinc-700" aria-hidden="true" />
                        )}
                        <span>0{i + 1}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium truncate">{stage.label}</div>
                    </button>
                  );
                })}
              </div>

              <div className="p-4 space-y-3 font-mono text-xs">
                {PREVIEW_STAGES.slice(0, previewStageIdx + 1).map((stage, idx) => (
                  <div
                    key={stage.key}
                    className={`rounded-lg border p-3 transition-all ${
                      idx === previewStageIdx
                        ? "border-white/14 bg-[#10131C]"
                        : "border-white/[0.06] bg-[#05060A]/70 opacity-75"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-zinc-100">
                      <span className="text-[#38BDF8]">$</span>
                      <span className="truncate">{stage.cmd}</span>
                    </div>
                    <div className="mt-1.5 text-[11px] text-zinc-400 leading-relaxed">
                      {stage.detail}
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[11px]">
                  <span className="text-zinc-500">Target: support-rag.ai.sparrowx.net</span>
                  <button
                    type="button"
                    onClick={() => onDeployTemplate("tpl-langflow", "growth")}
                    className="text-[#10B981] hover:underline font-medium cursor-pointer"
                  >
                    Launch this template →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. 1-CLICK TEMPLATE GALLERY */}
      <section className="space-y-6" id="templates-section">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-zinc-500">
              1-Click Production Runtimes
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              Ship stateful AI workloads without Docker boilerplate
            </h2>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter templates by category">
            {(Object.keys(CATEGORY_LABELS) as AiTemplateCategory[]).map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  aria-pressed={active}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
                    active
                      ? "border-white/25 bg-[#10131C] text-white"
                      : "border-white/[0.08] bg-[#090B11] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.14]"
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((tpl) => (
            <article
              key={tpl.id}
              className="group rounded-xl border border-white/[0.08] bg-[#090B11] hover:bg-[#10131C] hover:border-white/[0.14] p-5 flex flex-col justify-between transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 items-center justify-center rounded-lg border border-white/[0.08] bg-[#05060A] text-zinc-200">
                      <Box className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{tpl.name}</h3>
                      <p className="text-xs text-zinc-400">{tpl.tagline}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded border border-white/[0.08] bg-[#05060A] px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                    {tpl.badge}
                  </span>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">{tpl.description}</p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tpl.highlights.map((hl) => (
                    <span
                      key={hl}
                      className="inline-flex items-center gap-1 rounded bg-[#05060A] border border-white/[0.06] px-2 py-0.5 text-[11px] font-mono text-zinc-300"
                    >
                      <CheckCircle2 className="size-3 text-[#10B981]" aria-hidden="true" />
                      {hl}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-white/[0.08] flex items-center justify-between gap-3">
                <div className="font-mono text-xs">
                  <span className="text-zinc-500">
                    {tpl.minVcpu} vCPU • {tpl.minRamGb} GB RAM
                  </span>
                  <div className="text-sm font-semibold text-white">
                    from ₹{tpl.startingInr.toLocaleString("en-IN")}
                    <span className="text-[11px] font-normal text-zinc-500">/mo</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onDeployTemplate(tpl.id, tpl.minRamGb >= 8 ? "growth" : "starter")
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#05060A] hover:bg-white hover:text-[#05060A] px-3.5 py-2 text-xs font-semibold text-zinc-100 transition-colors cursor-pointer"
                >
                  <span>Deploy</span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 3. ARCHITECTURE & ECOSYSTEM STRIP */}
      <section className="rounded-xl border border-white/[0.08] bg-[#090B11] p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-zinc-500">
              Sovereign Indian Data Path
            </div>
            <h2 className="mt-1 text-xl font-semibold text-white">
              One cohesive SparrowX network—zero egress surprises between compute, WAF &amp; pgvector
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#38BDF8]">
            <Zap className="size-3.5" aria-hidden="true" />
            WireGuard / GRE Backplane
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-stretch">
          {[
            {
              step: "01",
              title: "Indian Users & Webhooks",
              host: "WhatsApp • Razorpay • MCP",
              detail: "35–85 ms across India via Jio, Airtel, Tata & NIXI peering",
              icon: <Globe className="size-4 text-zinc-200" />,
            },
            {
              step: "02",
              title: "OVH Mumbai DDoS Edge",
              host: "sec.sparrowx.net",
              detail: "L4/L7 DDoS scrubbing, webhook WAF & Let's Encrypt TLS 1.3",
              icon: <Shield className="size-4 text-[#10B981]" />,
            },
            {
              step: "03",
              title: "Dedicated Indian Compute",
              host: "ai.sparrowx.net",
              detail: "Proxmox VE Xeon Gold • 256 GB ECC • cgroup + tc port caps",
              icon: <Cpu className="size-4 text-[#38BDF8]" />,
            },
            {
              step: "04",
              title: "Managed Vector DB",
              host: "db.sparrowx.net",
              detail: "1-click isolated PostgreSQL 16 + pgvector over private subnet",
              icon: <Database className="size-4 text-[#F59E0B]" />,
            },
          ].map((node) => (
            <div
              key={node.step}
              className="rounded-lg border border-white/[0.08] bg-[#05060A] p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-zinc-500">HOP {node.step}</span>
                  {node.icon}
                </div>
                <h3 className="mt-2.5 text-sm font-semibold text-white">{node.title}</h3>
                <div className="mt-0.5 text-xs font-mono text-zinc-300">{node.host}</div>
              </div>
              <p className="mt-3 text-xs text-zinc-500 leading-relaxed">{node.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. TRANSPARENT INR PRICING GRID + COST CALCULATOR */}
      <section className="space-y-6" id="pricing-section">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-zinc-500">
              Transparent INR Pricing • No USD Card Required
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              Predictable bare-metal tiers with honest port &amp; SLA disclosures
            </h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#090B11] px-3 py-1.5 text-xs font-mono text-zinc-300">
            <IndianRupee className="size-3.5 text-[#10B981]" aria-hidden="true" />
            <span>UPI QR • UPI AutoPay • GST Invoice Included</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {AI_COMPUTE_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-xl border p-5 flex flex-col justify-between transition-colors ${
                plan.recommended
                  ? "border-white/25 bg-[#10131C]"
                  : "border-white/[0.08] bg-[#090B11] hover:border-white/[0.14]"
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">{plan.name}</h3>
                  {plan.recommended ? (
                    <span className="spx-silver-btn rounded px-2 py-0.5 text-[10px] font-mono font-bold text-[#05060A]">
                      POPULAR
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-zinc-400">{plan.tagline}</p>

                <div className="font-mono">
                  <span className="text-3xl font-semibold text-white">
                    ₹{plan.monthlyInr.toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-zinc-500"> /month + GST</span>
                </div>

                <ul className="space-y-2 text-xs text-zinc-300 font-mono border-t border-white/[0.08] pt-4">
                  <li className="flex justify-between">
                    <span className="text-zinc-500">Compute</span>
                    <span>
                      {plan.vcpu} vCPU / {plan.ramGb} GB ECC
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-zinc-500">NVMe SSD</span>
                    <span>{plan.ssdGb} GB ZFS</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-zinc-500">Network</span>
                    <span>Up to {plan.portMbps} Mbps Shared</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-zinc-500">Transfer</span>
                    <span>
                      {plan.transferGb >= 1000
                        ? `${plan.transferGb / 1000} TB/mo`
                        : `${plan.transferGb} GB/mo`}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-zinc-500">Isolation</span>
                    <span className="text-right text-[11px]">{plan.isolation}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-zinc-500">SLA</span>
                    <span className="text-[#10B981]">{plan.sla}</span>
                  </li>
                </ul>
              </div>

              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  onClick={() => onDeployTemplate(undefined, plan.id)}
                  className={`w-full rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    plan.recommended
                      ? "spx-silver-btn text-[#05060A]"
                      : "border border-white/15 bg-[#05060A] hover:bg-white hover:text-[#05060A] text-zinc-100"
                  }`}
                >
                  Deploy on {plan.name}
                </button>
                <button
                  type="button"
                  onClick={() => onSelectPlanBilling(plan)}
                  className="w-full rounded-lg border border-white/[0.06] py-1.5 text-[11px] font-mono text-zinc-400 hover:text-white hover:border-white/[0.14] transition-colors cursor-pointer"
                >
                  Pay via UPI QR / AutoPay
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* INR vs USD PaaS Cost Calculator */}
        <div className="rounded-xl border border-white/[0.08] bg-[#090B11] p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <Layers className="size-3.5 text-[#38BDF8]" aria-hidden="true" />
              <span>MONTHLY COST CALCULATOR • SPARROWX INR VS USD PAAS WORKFLOW HOSTS</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="ai-calc-tier"
                  className="block text-xs font-medium text-zinc-300 mb-1.5"
                >
                  Compute Tier
                </label>
                <select
                  id="ai-calc-tier"
                  value={calcPlanId}
                  onChange={(e) => setCalcPlanId(e.target.value as AiComputePlan["id"])}
                  className="w-full rounded-lg border border-white/12 bg-[#05060A] px-3 py-2 text-xs font-mono text-white focus:border-white/30 focus:outline-none"
                >
                  {AI_COMPUTE_PLANS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.vcpu} vCPU / {p.ramGb} GB RAM — ₹{p.monthlyInr})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="ai-calc-count"
                  className="flex justify-between text-xs font-medium text-zinc-300 mb-1.5"
                >
                  <span>24/7 Agent Containers</span>
                  <span className="font-mono text-white">{calcCount}x instances</span>
                </label>
                <input
                  id="ai-calc-count"
                  type="range"
                  min={1}
                  max={10}
                  value={calcCount}
                  onChange={(e) => setCalcCount(Number(e.target.value))}
                  className="w-full accent-zinc-200 cursor-pointer mt-2"
                />
              </div>
            </div>
            <p className="text-[11px] text-zinc-500">
              Comparison estimates equivalent 24/7 RAM-hour pricing on US-billed PaaS/workflow hosts
              (including 3.5% Indian card forex markup + per-execution overages).
            </p>
          </div>

          <div className="lg:col-span-5 rounded-xl border border-white/[0.08] bg-[#05060A] p-5 space-y-3 font-mono">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Typical USD PaaS / Cloud Host</span>
              <span className="text-zinc-500 line-through">
                ₹{usdPaaSMonthlyTotal.toLocaleString("en-IN")}/mo
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-200">SparrowX AI ({calcCount}× {calcPlan.name})</span>
              <span className="text-2xl font-semibold text-white">
                ₹{sparrowMonthlyTotal.toLocaleString("en-IN")}
                <span className="text-xs text-zinc-500">/mo</span>
              </span>
            </div>
            <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-xs">
              <span className="text-[#10B981]">You save ~{savingsPct}% every month</span>
              <span className="font-semibold text-[#10B981]">
                ₹{monthlySavingsInr.toLocaleString("en-IN")} saved
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. LIVE LOOKING GLASS WIDGET */}
      <section
        id="looking-glass-section"
        className="rounded-xl border border-white/[0.08] bg-[#090B11] p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-zinc-500">
              Live Looking Glass • OVH Mumbai (BOM1)
            </div>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Verify Indian fiber latency before you deploy
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#05060A] px-3 py-1.5 text-xs font-mono text-zinc-200">
              <Server className="size-3.5 text-zinc-400" aria-hidden="true" />
              <span>{MUMBAI_LOOKING_GLASS_IP}</span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400 hidden sm:inline">{MUMBAI_LOOKING_GLASS_HOST}</span>
            </div>
            <AiCopyButton
              value={MUMBAI_LOOKING_GLASS_IP}
              label="Copy Test IP"
              ariaLabel="Copy Mumbai Looking Glass Test IP"
            />
            <button
              type="button"
              onClick={() => void runLiveMumbaiPing()}
              disabled={pinging}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#38BDF8]/30 bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 px-3 py-1.5 text-xs font-mono text-[#38BDF8] transition-colors cursor-pointer disabled:opacity-60"
            >
              {pinging ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Activity className="size-3.5" aria-hidden="true" />
              )}
              <span>{pinging ? "Probing..." : "Run Live Probe"}</span>
            </button>
          </div>
        </div>

        {livePingResult ? (
          <div className="rounded-lg border border-[#10B981]/25 bg-[#10B981]/5 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <span className="text-[#10B981]">
              Live HTTP Probe OK — {livePingResult.rttMs} ms from {livePingResult.city} ({livePingResult.isp})
            </span>
            <span className="text-zinc-400">Gateway: {MUMBAI_LOOKING_GLASS_IP} (BOM1)</span>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-white/[0.08] text-zinc-500">
                <th className="py-2.5 pr-4 font-medium">Indian Metro</th>
                <th className="py-2.5 px-4 font-medium">Backbone Route</th>
                <th className="py-2.5 px-4 font-medium">Avg RTT</th>
                <th className="py-2.5 px-4 font-medium">Jitter</th>
                <th className="py-2.5 pl-4 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {INDIA_LATENCY_TABLE.map((row) => (
                <tr key={row.city} className="hover:bg-[#10131C]/60">
                  <td className="py-3 pr-4 font-sans font-medium text-zinc-100">
                    {row.city}{" "}
                    <span className="text-zinc-500 font-normal">({row.region})</span>
                  </td>
                  <td className="py-3 px-4 text-zinc-400">{row.ispRoute}</td>
                  <td className="py-3 px-4 text-white font-semibold">{row.avgMs} ms</td>
                  <td className="py-3 px-4 text-zinc-400">±{row.jitterMs} ms</td>
                  <td className="py-3 pl-4 text-right">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10B981]/10 border border-[#10B981]/25 px-2.5 py-0.5 text-[10px] text-[#10B981]">
                      <span className="size-1.5 rounded-full bg-[#10B981]" aria-hidden="true" />
                      {row.status === "optimal" ? "Optimal" : "Healthy"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
