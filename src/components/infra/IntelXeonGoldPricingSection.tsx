import React, { useState } from "react";
import {
  ArrowRight,
  Cpu,
  Database,
  Globe,
  HardDrive,
  Headphones,
  MessageCircle,
  Network,
  Server,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import type { InfraServerPlan } from "@/lib/infra-plans";
import { buildWhatsAppSupportUrl } from "@/lib/whatsapp-support";
import { Real3DProcessorChip } from "@/components/ui/Real3DProcessorChip";
import { PurchasePolicyNotice } from "@/components/PurchasePolicyNotice";
import {
  IntelXeonChipPinIcon,
  HardwarePinGridWatermark,
} from "@/components/ui/ProcessorChipPinIcons";

export interface XeonPlanItem {
  id: string;
  tier: "vps" | "vds";
  name: string;
  cpuSpec: string;
  ramSpec: string;
  storageSpec: string;
  bandwidthSpec: string;
  priceInr: number;
  priceUsd: number;
  highlight?: string;
}

export const XEON_GOLD_PLANS: XeonPlanItem[] = [
  // KVM VPS (Shared vCPU) — Dual Intel Xeon Gold
  {
    id: "xeon-sx-vps-4",
    tier: "vps",
    name: "SX-VPS 4",
    cpuSpec: "2 vCPU",
    ramSpec: "4 GB DDR4 ECC",
    storageSpec: "50 GB SSD",
    bandwidthSpec: "2 TB BW",
    priceInr: 999,
    priceUsd: 12,
  },
  {
    id: "xeon-sx-vps-8",
    tier: "vps",
    name: "SX-VPS 8",
    cpuSpec: "4 vCPU",
    ramSpec: "8 GB DDR4 ECC",
    storageSpec: "100 GB SSD",
    bandwidthSpec: "4 TB BW",
    priceInr: 1799,
    priceUsd: 22,
    highlight: "Popular",
  },
  {
    id: "xeon-sx-vps-16",
    tier: "vps",
    name: "SX-VPS 16",
    cpuSpec: "6 vCPU",
    ramSpec: "16 GB DDR4 ECC",
    storageSpec: "200 GB SSD",
    bandwidthSpec: "6 TB BW",
    priceInr: 3299,
    priceUsd: 39,
  },
  {
    id: "xeon-sx-vps-32",
    tier: "vps",
    name: "SX-VPS 32",
    cpuSpec: "8 vCPU",
    ramSpec: "32 GB DDR4 ECC",
    storageSpec: "350 GB SSD",
    bandwidthSpec: "8 TB BW",
    priceInr: 5999,
    priceUsd: 72,
  },
  // VDS (Dedicated Physical Cores) — Dual Intel Xeon Gold
  {
    id: "xeon-sx-vds-16",
    tier: "vds",
    name: "SX-VDS 16",
    cpuSpec: "4 Dedicated Cores",
    ramSpec: "16 GB DDR4 ECC",
    storageSpec: "200 GB SSD",
    bandwidthSpec: "5 TB BW",
    priceInr: 4999,
    priceUsd: 60,
  },
  {
    id: "xeon-sx-vds-32",
    tier: "vds",
    name: "SX-VDS 32",
    cpuSpec: "8 Dedicated Cores",
    ramSpec: "32 GB DDR4 ECC",
    storageSpec: "400 GB SSD",
    bandwidthSpec: "10 TB BW",
    priceInr: 8999,
    priceUsd: 108,
    highlight: "Best for FiveM / RP",
  },
  {
    id: "xeon-sx-vds-64",
    tier: "vds",
    name: "SX-VDS 64",
    cpuSpec: "12 Dedicated Cores",
    ramSpec: "64 GB DDR4 ECC",
    storageSpec: "750 GB SSD",
    bandwidthSpec: "15 TB BW",
    priceInr: 15999,
    priceUsd: 192,
  },
  {
    id: "xeon-sx-vds-128",
    tier: "vds",
    name: "SX-VDS 128",
    cpuSpec: "20 Dedicated Cores",
    ramSpec: "128 GB DDR4 ECC",
    storageSpec: "1.2 TB SSD",
    bandwidthSpec: "Unmetered (Fair Use)",
    priceInr: 28999,
    priceUsd: 348,
  },
];

const INCLUDED_FEATURES = [
  {
    id: "backup",
    title: "1 Free Backup Included",
    subtitle: "Automated encrypted snapshot slot",
    icon: Database,
    slotLabel: "3D Icon · Backup",
  },
  {
    id: "ipv4",
    title: "1 Dedicated Static IPv4",
    subtitle: "Clean routed static address + rDNS",
    icon: Globe,
    slotLabel: "3D Icon · Static IPv4",
  },
  {
    id: "ddos",
    title: "Enterprise DDoS Protection",
    subtitle: "Always-on XDP/eBPF + L3/L4 scrubbing",
    icon: ShieldCheck,
    slotLabel: "3D Icon · DDoS Shield",
  },
  {
    id: "support",
    title: "24/7 Technical Support",
    subtitle: "Direct NOC engineers & WhatsApp help",
    icon: Headphones,
    slotLabel: "3D Icon · 24/7 NOC",
  },
  {
    id: "sla",
    title: "99.99% Uptime SLA",
    subtitle: "Dual-PSU redundant enterprise nodes",
    icon: Zap,
    slotLabel: "3D Icon · Uptime SLA",
  },
] as const;

function toInfraServerPlan(item: XeonPlanItem): InfraServerPlan {
  return {
    id: item.id,
    category: item.tier === "vds" ? "vds" : "vps",
    name: `${item.name} · Dual Intel Xeon Gold`,
    tagline:
      item.tier === "vds"
        ? `Dedicated physical cores on Dual Intel Xeon Gold processors with ${item.ramSpec}, ${item.storageSpec}, and ${item.bandwidthSpec}.`
        : `Enterprise KVM VPS powered by Dual Intel Xeon Gold processors with ${item.ramSpec}, ${item.storageSpec}, and ${item.bandwidthSpec}.`,
    cpuModel: "Dual Intel Xeon Gold",
    coresThreads: item.cpuSpec,
    clockGhz: "Dual-Socket Xeon Gold",
    ram: item.ramSpec,
    storage: item.storageSpec,
    network: `${item.bandwidthSpec} · 1 Dedicated Static IPv4`,
    ddosProtection: "Enterprise DDoS Protection",
    deployTime: item.tier === "vds" ? "2 mins" : "60 secs",
    priceMonthlyUsd: item.priceUsd,
    priceMonthlyInr: item.priceInr,
    featured: Boolean(item.highlight),
    regions: ["in-mum", "sg-sin", "de-fra", "fr-gra"],
    visual3d: item.tier === "vds" ? "/3d/game-server-node.svg" : "/3d/vps-kvm-cubes.svg",
    nodeLocation: "Dual Xeon Gold Node",
    inStock: true,
    isVds: item.tier === "vds",
    ...(item.highlight ? { badge: item.highlight } : {}),
    specsHighlights: [
      "Dual Intel Xeon Gold enterprise processors",
      "1 Free Backup + 1 Dedicated Static IPv4 included",
      "Enterprise DDoS Protection & 99.99% Uptime SLA",
      "24/7 Technical Support via NOC & WhatsApp",
    ],
  };
}

export interface IntelXeonGoldPricingSectionProps {
  currency?: "INR" | "USD";
  forcedTier?: "vps" | "vds";
  onConfigurePlan?: (plan: InfraServerPlan) => void;
}

export function IntelXeonGoldPricingSection({
  currency = "INR",
  forcedTier,
  onConfigurePlan,
}: IntelXeonGoldPricingSectionProps) {
  const [internalTab, setInternalTab] = useState<"vps" | "vds">("vps");
  const activeTab = forcedTier ?? internalTab;

  const visiblePlans = XEON_GOLD_PLANS.filter((p) => p.tier === activeTab);

  return (
    <section
      id="xeon-gold-plans"
      aria-labelledby="xeon-gold-heading"
      className="relative scroll-mt-20 border-t border-[#0071C5]/30 bg-[#050811] px-4 py-16 text-[#F4F6FA] sm:px-6 sm:py-24"
    >
      {/* Subtle Intel Blue ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(0,113,197,0.18),transparent_65%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-24 size-96 rounded-full bg-[#0284C7]/[0.10] blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl">
        {/* Header & Tab Toggle with 3D Floating Intel Xeon Processor */}
        <div className="mb-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-[#0071C5]/40 bg-[#0071C5]/10 px-3.5 py-1 text-xs font-semibold text-[#38BDF8]">
              <Cpu className="size-3.5 text-[#38BDF8]" aria-hidden="true" />
              <span>Dual Intel® Xeon® Gold Enterprise Silicon</span>
              <span className="text-white/30">·</span>
              <span className="text-sky-300">Intel Blue Architecture</span>
            </div>

            <h2
              id="xeon-gold-heading"
              className="text-3xl font-extrabold tracking-tight text-[#F4F6FA] sm:text-4xl lg:text-5xl"
            >
              Intel Xeon Gold <span className="text-[#38BDF8]">Enterprise Servers</span>
            </h2>

            <p className="text-sm leading-relaxed text-[#F4F6FA]/80 sm:text-base max-w-2xl">
              Enterprise dual-socket compute powered by <strong className="font-semibold text-white">Dual Intel Xeon Gold processors</strong> with DDR4/DDR5 ECC registered memory, ultra-fast NVMe/SSD arrays, dedicated static IPv4 with custom rDNS, and always-on L3/L4/L7 DDoS mitigation.
            </p>

            {/* Clean Tab Toggle in pure Intel Blue theme */}
            {!forcedTier && (
              <div
                role="tablist"
                aria-label="Intel Xeon Gold server type"
                className="inline-flex flex-wrap rounded-2xl border border-[#0071C5]/40 bg-[#06101E]/90 p-1.5 backdrop-blur-md"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "vps"}
                  onClick={() => setInternalTab("vps")}
                  className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 ${
                    activeTab === "vps"
                      ? "bg-[#0071C5] text-white shadow-[0_0_24px_rgba(0,113,197,0.5)] font-bold"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Server className="size-4" aria-hidden="true" />
                  <span>KVM VPS (Shared vCPU)</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "vds"}
                  onClick={() => setInternalTab("vds")}
                  className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 ${
                    activeTab === "vds"
                      ? "bg-[#0284C7] text-white shadow-[0_0_24px_rgba(2,132,199,0.5)] font-bold"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Cpu className="size-4" aria-hidden="true" />
                  <span>VDS (Dedicated Cores)</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Column: 3D Floating Intel Xeon Processor */}
          <div className="lg:col-span-4 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[280px] sm:max-w-[320px]">
              <div className="pointer-events-none absolute -inset-4 bg-gradient-to-r from-blue-600/20 via-sky-500/15 to-transparent blur-2xl rounded-3xl" />
              <Real3DProcessorChip
                variant="xeon"
                alt="3D floating Dual Intel Xeon Gold Enterprise Processor"
                size="md"
              />
            </div>
          </div>
        </div>

        {/* Spacious 4-Column Pricing Grid */}
        <div className="grid grid-cols-1 gap-6 pt-3 sm:grid-cols-2 lg:grid-cols-4">
          {visiblePlans.map((plan) => {
            const isHighlighted = Boolean(plan.highlight);
            const priceLabel =
              currency === "INR"
                ? `₹${plan.priceInr.toLocaleString("en-IN")}`
                : `$${plan.priceUsd}`;
            const whatsappHref = buildWhatsAppSupportUrl(
              `Hi SparrowX, I want to start a subscription for ${plan.name} (Dual Intel Xeon Gold · ${plan.cpuSpec} · ${plan.ramSpec} · ${plan.storageSpec} · ${plan.bandwidthSpec} · ₹${plan.priceInr.toLocaleString("en-IN")}/mo).`,
            );

            return (
              <article
                key={plan.id}
                className={`group relative flex flex-col justify-between rounded-2xl border bg-[#08101C]/90 p-6 backdrop-blur-xl transition-all duration-200 overflow-visible ${
                  isHighlighted
                    ? "border-[#0284C7]/70 shadow-[0_0_40px_rgba(2,132,199,0.22)]"
                    : "border-white/10 hover:border-[#38BDF8]/45 hover:shadow-[0_12px_36px_rgba(56,189,248,0.14)]"
                }`}
              >
                {/* Background LGA Circuit & Pin Matrix Watermark */}
                <HardwarePinGridWatermark accent="blue" />

                {/* Pinned Upper-Edge "In Stock" Sticker (outside card body) */}
                <div className="absolute -top-3 left-4 z-20 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-[#050C12] px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 shadow-md">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>In Stock</span>
                </div>

                {/* Highlight Ribbon */}
                {plan.highlight && (
                  <div className="absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full bg-[#0071C5] px-3 py-0.5 text-[11px] font-bold tracking-wide text-white shadow-lg shadow-sky-600/30 z-20">
                    <Sparkles className="size-3" aria-hidden="true" />
                    <span>{plan.highlight}</span>
                  </div>
                )}

                <div className="relative z-10 pt-1">
                  {/* Plan Header */}
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-[#38BDF8]/25 bg-[#38BDF8]/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#38BDF8]">
                      Dual Xeon Gold
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                      <Database className="size-3" aria-hidden="true" />
                      1 Free Backup
                    </span>
                  </div>

                  {/* Intel Chip Pin Icon & Title */}
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="relative size-12 rounded-xl bg-gradient-to-br from-sky-950/70 via-[#071324] to-[#08101C] border border-[#38BDF8]/35 flex items-center justify-center text-sky-400 shrink-0 shadow-[0_0_18px_rgba(56,189,248,0.2)] group-hover:border-[#38BDF8]/70 group-hover:shadow-[0_0_24px_rgba(56,189,248,0.4)] transition-all">
                      <IntelXeonChipPinIcon className="size-10" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-bold tracking-tight text-[#F4F6FA]">
                        {plan.name}
                      </h3>
                      <p className="mt-0.5 text-xs text-[#38BDF8]/80 font-mono">
                        {plan.tier === "vds"
                          ? "Dedicated Cores · Dual Socket"
                          : "KVM Shared vCPU · Dual Socket"}
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mt-5 flex items-baseline gap-1 border-b border-white/10 pb-5 tabular-nums">
                    <span className="text-3xl font-extrabold tracking-tight text-[#F4F6FA]">
                      {priceLabel}
                    </span>
                    <span className="text-xs font-medium text-[#F4F6FA]/55">
                      /mo
                    </span>
                  </div>

                  {/* Specs List */}
                  <ul className="mt-5 space-y-3 text-sm">
                    <li className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-xs text-[#F4F6FA]/60">
                        <Cpu className="size-3.5 text-[#38BDF8]" aria-hidden="true" />
                        <span>CPU</span>
                      </span>
                      <span className="font-mono text-xs font-semibold text-[#F4F6FA]">
                        {plan.cpuSpec}
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-xs text-[#F4F6FA]/60">
                        <Server className="size-3.5 text-[#38BDF8]" aria-hidden="true" />
                        <span>RAM</span>
                      </span>
                      <span className="font-mono text-xs font-semibold text-[#F4F6FA]">
                        {plan.ramSpec}
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-xs text-[#F4F6FA]/60">
                        <HardDrive className="size-3.5 text-[#38BDF8]" aria-hidden="true" />
                        <span>Storage</span>
                      </span>
                      <span className="font-mono text-xs font-semibold text-[#F4F6FA]">
                        {plan.storageSpec}
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-xs text-[#F4F6FA]/60">
                        <Network className="size-3.5 text-[#38BDF8]" aria-hidden="true" />
                        <span>Bandwidth</span>
                      </span>
                      <span className="font-mono text-xs font-semibold text-[#F4F6FA]">
                        {plan.bandwidthSpec}
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Actions */}
                <div className="mt-6 space-y-2">
                  <button
                    type="button"
                    onClick={() => onConfigurePlan?.(toInfraServerPlan(plan))}
                    className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-150 ${
                      isHighlighted
                        ? "bg-[#0071C5] text-white hover:bg-[#0284C7] shadow-[0_6px_22px_rgba(0,113,197,0.4)]"
                        : "border border-[#38BDF8]/40 bg-[#38BDF8]/10 text-[#F4F6FA] hover:bg-[#38BDF8] hover:text-[#05060A]"
                    }`}
                  >
                    <span>Deploy {plan.name}</span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-[#F4F6FA]/75 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300"
                  >
                    <MessageCircle className="size-3.5" aria-hidden="true" />
                    <span>Order on WhatsApp</span>
                  </a>
                </div>
              </article>
            );
          })}
        </div>

        <PurchasePolicyNotice className="mt-6 max-w-2xl mx-auto" />

        {/* 5-Column Included Features Bar with 3D Icon Placeholders */}
        <div className="mt-12 rounded-2xl border border-[#0071C5]/30 bg-[#08101C]/90 p-6 backdrop-blur-xl">
          <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#38BDF8]">
                Dual Intel Xeon Gold Standard
              </p>
              <h3 className="mt-1 text-lg font-bold text-[#F4F6FA]">
                Included With Every Intel Xeon Server
              </h3>
            </div>
            <span className="font-mono text-xs text-[#F4F6FA]/60">
              Zero extra add-on fees · Provisioned automatically
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {INCLUDED_FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.id}
                  className="flex flex-col items-start gap-3 rounded-xl border border-white/[0.08] bg-[#050811]/90 p-4 transition-colors hover:border-[#38BDF8]/45"
                >
                  {/* 3D Icon Placeholder Slot in Blue Theme */}
                  <div
                    data-icon-slot={feat.id}
                    className="relative flex size-12 items-center justify-center rounded-xl border border-dashed border-[#38BDF8]/40 bg-gradient-to-br from-[#38BDF8]/20 via-[#08101C] to-[#0071C5]/20 shadow-inner"
                    title={feat.slotLabel}
                  >
                    <Icon className="size-5 text-[#38BDF8]" aria-hidden="true" />
                    <span className="absolute -bottom-1.5 right-0 rounded bg-[#050811] px-1 font-mono text-[8px] font-bold uppercase tracking-wider text-[#38BDF8] border border-[#38BDF8]/40">
                      3D
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#F4F6FA]">
                      {feat.title}
                    </h4>
                    <p className="mt-0.5 text-xs leading-snug text-[#F4F6FA]/65">
                      {feat.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
