import fivemImg from "@/assets/hero-fivem.jpg";
import sampImg from "@/assets/hero-samp.jpg";
import minecraftImg from "@/assets/hero-minecraft.jpg";
import discordImg from "@/assets/hero-discord.jpg";
import { findSmartPlan } from "./egg-smart-plans";

function resolveAssetUrl(asset: unknown): string {
  if (typeof asset === "string") return asset;
  if (asset && typeof asset === "object" && "url" in asset && typeof (asset as { url: unknown }).url === "string") {
    return (asset as { url: string }).url;
  }
  return "";
}

export const SERVICE_IDS = ["fivem", "samp", "minecraft", "discord"] as const;
export type ServiceId = (typeof SERVICE_IDS)[number];

export type Plan = {
  id: string;
  name: string;
  ramMb: number;
  vcpu: number;
  diskGb: number;
  slots?: number;
  priceInr: number;
  popular?: boolean;
};

export type Service = {
  id: ServiceId;
  name: string;
  short: string;
  headline: string;
  sub: string;
  badge: string;
  image: string;
  telemetry: { tick: number; tickLabel: string; latencyMs: number; uptime: number };
  plans: Plan[];
};

export const SERVICES: Record<ServiceId, Service> = {
  fivem: {
    id: "fivem",
    name: "FiveM",
    short: "FiveM",
    headline: "Build Your Dream RP City Without Texture Loss.",
    sub: "Ryzen-class cores, NVMe Gen4 streaming and txAdmin pre-installed — your MLOs, vehicles and EUP load like they were meant to.",
    badge: "txAdmin Ready • OneSync Infinity",
    image: resolveAssetUrl(fivemImg),
    telemetry: { tick: 99.4, tickLabel: "Tick Stability", latencyMs: 12, uptime: 99.99 },
    plans: [
      { id: "fivem-vinewood", name: "Vinewood Dev", ramMb: 4096, vcpu: 1.5, diskGb: 35, slots: 32, priceInr: 399 },
      { id: "fivem-midnight", name: "Midnight RP", ramMb: 8192, vcpu: 2.5, diskGb: 70, slots: 64, priceInr: 749, popular: true },
      { id: "fivem-syndicate", name: "Syndicate City", ramMb: 12288, vcpu: 3.5, diskGb: 120, slots: 128, priceInr: 1199 },
    ],
  },
  samp: {
    id: "samp",
    name: "SA-MP",
    short: "SA-MP",
    headline: "Zero-Lag Pawn & open.mp Server Infrastructure.",
    sub: "Classic San Andreas multiplayer on modern silicon. Run 0.3.7 or open.mp with plugins, MySQL and instant restarts.",
    badge: "open.mp & 0.3.7",
    image: resolveAssetUrl(sampImg),
    telemetry: { tick: 98.8, tickLabel: "Tick Stability", latencyMs: 13, uptime: 99.98 },
    plans: [
      { id: "samp-street", name: "Street Starter", ramMb: 1024, vcpu: 0.5, diskGb: 10, slots: 50, priceInr: 79 },
      { id: "samp-grove", name: "Grove Gang", ramMb: 2048, vcpu: 1.0, diskGb: 20, slots: 150, priceInr: 149, popular: true },
      { id: "samp-lspro", name: "Los Santos Pro", ramMb: 4096, vcpu: 1.5, diskGb: 40, slots: 500, priceInr: 279 },
    ],
  },
  minecraft: {
    id: "minecraft",
    name: "Minecraft",
    short: "Minecraft",
    headline: "20.0 Locked TPS Even During Massive World Gen.",
    sub: "High-clock cores and NVMe Gen4 chunk I/O keep SMPs, networks and heavy modpacks at a flat 20 TPS.",
    badge: "PaperMC • Purpur • Fabric",
    image: resolveAssetUrl(minecraftImg),
    telemetry: { tick: 100, tickLabel: "TPS Lock (20.0)", latencyMs: 14, uptime: 99.99 },
    plans: [
      { id: "mc-coal", name: "Coal SMP", ramMb: 2048, vcpu: 1.0, diskGb: 15, priceInr: 179 },
      { id: "mc-diamond", name: "Diamond Network", ramMb: 4096, vcpu: 2.0, diskGb: 30, priceInr: 349, popular: true },
      { id: "mc-netherite", name: "Netherite Modded", ramMb: 8192, vcpu: 3.0, diskGb: 60, priceInr: 649 },
    ],
  },
  discord: {
    id: "discord",
    name: "Discord Bots",
    short: "Bots",
    headline: "Always-Online Bot Nodes With Sub-10ms Gateway Ping.",
    sub: "Host discord.js, discord.py and Lavalink music nodes 24/7 with auto-restart, Git deploys and zero sleep.",
    badge: "Node.js • Python • Lavalink",
    image: resolveAssetUrl(discordImg),
    telemetry: { tick: 99.9, tickLabel: "Process Uptime", latencyMs: 8, uptime: 99.99 },
    plans: [
      { id: "bot-spark", name: "Spark Bot", ramMb: 512, vcpu: 0.25, diskGb: 5, priceInr: 49 },
      { id: "bot-guild", name: "Guild Manager", ramMb: 1024, vcpu: 0.5, diskGb: 10, priceInr: 99, popular: true },
      { id: "bot-cluster", name: "Cluster Node", ramMb: 2048, vcpu: 1.0, diskGb: 20, priceInr: 189 },
    ],
  },
};

export const SERVICE_LIST = SERVICE_IDS.map((id) => SERVICES[id]);

export function findPlan(planId: string): { service: Service; plan: Plan } | null {
  for (const service of SERVICE_LIST) {
    const plan = service.plans.find((p) => p.id === planId);
    if (plan) return { service, plan };
  }
  const smart = findSmartPlan(planId);
  if (smart) {
    return { service: SERVICES[smart.profile.serviceId], plan: smart.plan };
  }
  return null;
}

/** 1 SparrowCoin = ₹1, so a plan's coin cost equals its monthly INR price. */
export function planCostCoins(plan: Plan): number {
  return plan.priceInr;
}

export function formatRam(mb: number): string {
  return mb >= 1024 ? `${mb / 1024}GB` : `${mb}MB`;
}

export function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export const RENEWAL_DAYS = 30;
