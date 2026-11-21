export type InfraCategory = "bare-metal" | "dedicated" | "vps";

export type InfraRegionId = "in-mum" | "sg-sin" | "de-fra" | "fr-gra";

export interface InfraRegion {
  id: InfraRegionId;
  name: string;
  country: string;
  code: string;
  latencyHint: string;
  uplink: string;
}

export const INFRA_REGIONS: InfraRegion[] = [
  {
    id: "in-mum",
    name: "Mumbai IN-1",
    country: "India",
    code: "BOM",
    latencyHint: "8 ms Asia-IN",
    uplink: "10 Gbps + Anycast",
  },
  {
    id: "sg-sin",
    name: "Singapore SG-1",
    country: "Singapore",
    code: "SIN",
    latencyHint: "18 ms APAC",
    uplink: "25 Gbps Redundant",
  },
  {
    id: "de-fra",
    name: "Frankfurt DE-1",
    country: "Germany",
    code: "FRA",
    latencyHint: "14 ms EU-Central",
    uplink: "25 Gbps DE-CIX",
  },
  {
    id: "fr-gra",
    name: "Gravelines FR-OVH",
    country: "France",
    code: "GRA",
    latencyHint: "11 ms EU-West",
    uplink: "25 Gbps L3/L4 XDP",
  },
];

export interface InfraOsImage {
  id: string;
  label: string;
  family: "Linux" | "Hypervisor" | "Windows";
  monthlyAddonUsd: number;
}

export const INFRA_OS_IMAGES: InfraOsImage[] = [
  { id: "ubuntu-24-04", label: "Ubuntu 24.04 LTS (Hardened)", family: "Linux", monthlyAddonUsd: 0 },
  { id: "debian-12", label: "Debian 12 Bookworm", family: "Linux", monthlyAddonUsd: 0 },
  { id: "rocky-9", label: "Rocky Linux 9 Enterprise", family: "Linux", monthlyAddonUsd: 0 },
  { id: "proxmox-8", label: "Proxmox VE 8.2 Hypervisor", family: "Hypervisor", monthlyAddonUsd: 0 },
  { id: "windows-2022", label: "Windows Server 2022 Standard", family: "Windows", monthlyAddonUsd: 24 },
];

export interface InfraServerPlan {
  id: string;
  category: InfraCategory;
  name: string;
  tagline: string;
  cpuModel: string;
  coresThreads: string;
  clockGhz: string;
  ram: string;
  storage: string;
  network: string;
  ddosProtection: string;
  deployTime: string;
  priceMonthlyUsd: number;
  priceMonthlyInr: number;
  featured?: boolean;
  regions: InfraRegionId[];
  visual3d: string;
  specsHighlights: string[];
}

export const INFRA_PLANS: InfraServerPlan[] = [
  // ========================
  // 1. BARE METAL SERVERS
  // ========================
  {
    id: "bm-ryzen-7950x",
    category: "bare-metal",
    name: "BM-Edge 7950X",
    tagline: "Single-tenant high-clock silicon for game networks and low-latency APIs",
    cpuModel: "AMD Ryzen 9 7950X",
    coresThreads: "16C / 32T",
    clockGhz: "4.5 - 5.7 GHz",
    ram: "128 GB DDR5 ECC",
    storage: "2 x 1.92 TB NVMe Gen4 RAID1",
    network: "10 Gbps Unmetered",
    ddosProtection: "XDP/eBPF + L4 Anycast",
    deployTime: "15 mins",
    priceMonthlyUsd: 149,
    priceMonthlyInr: 12490,
    regions: ["in-mum", "sg-sin", "de-fra", "fr-gra"],
    visual3d: "/3d/cloud-infra-server.jpg",
    specsHighlights: [
      "Full IPMI / KVM-over-IP console",
      "Hardware RAID0/1/10 & custom ISO boot",
      "1x IPv4 + /64 IPv6 subnet included",
      "SparrowXNet WireGuard private VLAN",
    ],
  },
  {
    id: "bm-ryzen-9950x",
    category: "bare-metal",
    name: "BM-Forge 9950X",
    tagline: "Flagship Zen 5 single-thread speed with enterprise Gen5 NVMe throughput",
    cpuModel: "AMD Ryzen 9 9950X",
    coresThreads: "16C / 32T",
    clockGhz: "4.3 - 5.7 GHz",
    ram: "192 GB DDR5 ECC",
    storage: "2 x 3.84 TB NVMe Gen5",
    network: "10 Gbps Unmetered",
    ddosProtection: "XDP/eBPF + GameSec L4",
    deployTime: "15 mins",
    priceMonthlyUsd: 199,
    priceMonthlyInr: 16690,
    featured: true,
    regions: ["in-mum", "sg-sin", "de-fra", "fr-gra"],
    visual3d: "/3d/cloud-infra-server.jpg",
    specsHighlights: [
      "Zero hypervisor noise or CPU steal",
      "Dedicated 10 Gbps full-duplex port",
      "Automated OS reinstall & rescue mode",
      "BGP session & BYOIP ready",
    ],
  },
  {
    id: "bm-epyc-9354p",
    category: "bare-metal",
    name: "BM-Core EPYC 9354P",
    tagline: "Dense virtualization and sovereign PostgreSQL cluster workhorse",
    cpuModel: "AMD EPYC 9354P",
    coresThreads: "32C / 64T",
    clockGhz: "3.25 - 3.8 GHz",
    ram: "256 GB DDR5 ECC",
    storage: "4 x 3.84 TB Enterprise NVMe",
    network: "25 Gbps Redundant",
    ddosProtection: "XDP/eBPF + L3/L4/L7 Shield",
    deployTime: "30 mins",
    priceMonthlyUsd: 289,
    priceMonthlyInr: 24290,
    regions: ["sg-sin", "de-fra", "fr-gra"],
    visual3d: "/3d/cloud-infra-server.jpg",
    specsHighlights: [
      "Dual redundant 25 Gbps LACP uplinks",
      "Proxmox VE / Kubernetes bare-metal ready",
      "Dedicated private mesh interconnect",
      "99.99% hardware replacement SLA",
    ],
  },
  {
    id: "bm-dual-epyc-9654",
    category: "bare-metal",
    name: "BM-Titan Dual EPYC",
    tagline: "192 physical cores built for multi-tenant clouds and AI inference fleets",
    cpuModel: "2x AMD EPYC 9654",
    coresThreads: "192C / 384T",
    clockGhz: "2.4 - 3.7 GHz",
    ram: "768 GB DDR5 ECC",
    storage: "4 x 7.68 TB Enterprise NVMe",
    network: "2 x 25 Gbps Unmetered",
    ddosProtection: "Always-On 2.4 Tbps Anycast",
    deployTime: "2 hours",
    priceMonthlyUsd: 699,
    priceMonthlyInr: 58900,
    regions: ["de-fra", "fr-gra"],
    visual3d: "/3d/cloud-infra-server.jpg",
    specsHighlights: [
      "Dual-socket Genoa 96-core processors",
      "50 Gbps bonded enterprise fiber uplink",
      "Direct engineer Slack & Discord channel",
      "Custom private rack & VLAN allocation",
    ],
  },

  // ========================
  // 2. DEDICATED SERVERS
  // ========================
  {
    id: "ded-xeon-2388g",
    category: "dedicated",
    name: "DED-Sentinel E-2388G",
    tagline: "Reliable managed dedicated node for production web apps and SaaS stacks",
    cpuModel: "Intel Xeon E-2388G",
    coresThreads: "8C / 16T",
    clockGhz: "3.2 - 5.1 GHz",
    ram: "64 GB DDR4 ECC",
    storage: "2 x 960 GB NVMe RAID1",
    network: "1 Gbps Unmetered",
    ddosProtection: "L3/L4 Volumetric Shield",
    deployTime: "20 mins",
    priceMonthlyUsd: 79,
    priceMonthlyInr: 6690,
    regions: ["in-mum", "sg-sin", "de-fra", "fr-gra"],
    visual3d: "/3d/game-server-node.svg",
    specsHighlights: [
      "Pre-configured SparrowX NetSec agent",
      "Zero egress bandwidth charges",
      "Nightly off-node backup snapshots",
      "Free WireGuard private mesh tunnel",
    ],
  },
  {
    id: "ded-game-9900x",
    category: "dedicated",
    name: "DED-Arena 9900X",
    tagline: "Purpose-tuned for FiveM, Minecraft networks, and Pterodactyl Wings nodes",
    cpuModel: "AMD Ryzen 9 9900X",
    coresThreads: "12C / 24T",
    clockGhz: "4.4 - 5.6 GHz",
    ram: "128 GB DDR5",
    storage: "2 x 1.92 TB NVMe Gen4",
    network: "10 Gbps Unmetered",
    ddosProtection: "GameSec UDP/RakNet/ENet",
    deployTime: "15 mins",
    priceMonthlyUsd: 139,
    priceMonthlyInr: 11690,
    featured: true,
    regions: ["in-mum", "sg-sin", "de-fra", "fr-gra"],
    visual3d: "/3d/game-server-node.svg",
    specsHighlights: [
      "Pre-tuned Linux kernel for 20 TPS lock",
      "1-click Pterodactyl Wings pairing",
      "Stateful UDP/FiveM flood mitigation",
      "Sub-10 ms India & Singapore peering",
    ],
  },
  {
    id: "ded-storage-vault",
    category: "dedicated",
    name: "DED-Vault 32TB NVMe",
    tagline: "High-capacity dedicated storage node for backups, media, and S3 clusters",
    cpuModel: "AMD EPYC 7443P",
    coresThreads: "24C / 48T",
    clockGhz: "2.85 - 4.0 GHz",
    ram: "128 GB DDR4 ECC",
    storage: "4 x 7.68 TB NVMe + 2x 16TB HDD",
    network: "10 Gbps Unmetered",
    ddosProtection: "XDP/eBPF + Shield WAF",
    deployTime: "45 mins",
    priceMonthlyUsd: 229,
    priceMonthlyInr: 19290,
    regions: ["de-fra", "fr-gra", "sg-sin"],
    visual3d: "/3d/cloud-infra-server.jpg",
    specsHighlights: [
      "ZFS / Ceph / MinIO S3 ready out of box",
      "Zero egress bills for high-volume reads",
      "Hardware AES-NI disk encryption",
      "Automated SMART health alerting",
    ],
  },

  // ========================
  // 3. CLOUD KVM VPS
  // ========================
  {
    id: "vps-nano",
    category: "vps",
    name: "VPS-Nano NVMe",
    tagline: "Lightweight KVM instance for bots, reverse proxies, and WireGuard hubs",
    cpuModel: "AMD EPYC / Ryzen vCPU",
    coresThreads: "2 vCPU",
    clockGhz: "4.2 GHz Boost",
    ram: "2 GB DDR5 ECC",
    storage: "40 GB NVMe Gen4",
    network: "2 TB @ 2 Gbps",
    ddosProtection: "Included L3/L4 Shield",
    deployTime: "45 secs",
    priceMonthlyUsd: 4,
    priceMonthlyInr: 349,
    regions: ["in-mum", "sg-sin", "de-fra", "fr-gra"],
    visual3d: "/3d/vps-kvm-cubes.svg",
    specsHighlights: [
      "Full root SSH + browser VNC console",
      "Instant OS rebuild in under 45 seconds",
      "Dedicated IPv4 + /64 IPv6 included",
      "Zero surprise egress overage traps",
    ],
  },
  {
    id: "vps-starter",
    category: "vps",
    name: "VPS-Builder NVMe",
    tagline: "Balanced KVM compute for Docker stacks, APIs, and staging environments",
    cpuModel: "AMD Ryzen 9 vCPU",
    coresThreads: "4 vCPU",
    clockGhz: "4.8 GHz Boost",
    ram: "8 GB DDR5 ECC",
    storage: "100 GB NVMe Gen4",
    network: "5 TB @ 5 Gbps",
    ddosProtection: "Included L3/L4/L7 Shield",
    deployTime: "45 secs",
    priceMonthlyUsd: 10,
    priceMonthlyInr: 849,
    featured: true,
    regions: ["in-mum", "sg-sin", "de-fra", "fr-gra"],
    visual3d: "/3d/vps-kvm-cubes.svg",
    specsHighlights: [
      "Dedicated NVMe IOPS with zero throttling",
      "Weekly automated snapshots included",
      "1-click Docker, Postgres & NetSec install",
      "Private VPC networking across instances",
    ],
  },
  {
    id: "vps-pro",
    category: "vps",
    name: "VPS-Scale NVMe",
    tagline: "Production-grade KVM virtual server for SaaS databases and busy workloads",
    cpuModel: "AMD Ryzen 9 vCPU",
    coresThreads: "8 vCPU",
    clockGhz: "5.2 GHz Boost",
    ram: "16 GB DDR5 ECC",
    storage: "240 GB NVMe Gen4",
    network: "10 TB @ 10 Gbps",
    ddosProtection: "XDP/eBPF + WAF Included",
    deployTime: "45 secs",
    priceMonthlyUsd: 22,
    priceMonthlyInr: 1849,
    regions: ["in-mum", "sg-sin", "de-fra", "fr-gra"],
    visual3d: "/3d/vps-kvm-cubes.svg",
    specsHighlights: [
      "Pinned high-frequency compute threads",
      "Instant horizontal snapshot cloning",
      "Direct peering to db.sparrowx.net",
      "99.98% uptime guarantee",
    ],
  },
  {
    id: "vps-turbo",
    category: "vps",
    name: "VPS-Hyper NVMe",
    tagline: "Heavyweight KVM compute bridging virtual agility and dedicated raw power",
    cpuModel: "AMD Ryzen 9 9950X vCPU",
    coresThreads: "16 vCPU",
    clockGhz: "5.5 GHz Boost",
    ram: "32 GB DDR5 ECC",
    storage: "480 GB NVMe Gen4",
    network: "20 TB @ 10 Gbps",
    ddosProtection: "XDP/eBPF + GameSec L4",
    deployTime: "45 secs",
    priceMonthlyUsd: 42,
    priceMonthlyInr: 3549,
    regions: ["in-mum", "sg-sin", "de-fra", "fr-gra"],
    visual3d: "/3d/vps-kvm-cubes.svg",
    specsHighlights: [
      "Dedicated physical core reservation",
      "Up to 10 Gbps burst fiber connectivity",
      "Custom ISO & WireGuard mesh pre-wired",
      "Priority Discord & engineer support",
    ],
  },
];

export type BillingCycle = "monthly" | "quarterly" | "annual";

export const BILLING_DISCOUNT: Record<BillingCycle, number> = {
  monthly: 0,
  quarterly: 0.05,
  annual: 0.15,
};

export function computePlanPrice(
  plan: InfraServerPlan,
  currency: "INR" | "USD",
  cycle: BillingCycle,
  addonMonthlyUsd = 0,
): { unitMonthly: number; formattedMonthly: string; cycleMonths: number; formattedTotal: string } {
  const discount = BILLING_DISCOUNT[cycle];
  const base =
    currency === "INR"
      ? plan.priceMonthlyInr + Math.round(addonMonthlyUsd * 84)
      : plan.priceMonthlyUsd + addonMonthlyUsd;
  const discountedMonthly = Math.round(base * (1 - discount));
  const cycleMonths = cycle === "annual" ? 12 : cycle === "quarterly" ? 3 : 1;
  const total = discountedMonthly * cycleMonths;

  const fmt = (val: number) =>
    currency === "INR"
      ? `₹${val.toLocaleString("en-IN")}`
      : `$${val.toLocaleString("en-US")}`;

  return {
    unitMonthly: discountedMonthly,
    formattedMonthly: fmt(discountedMonthly),
    cycleMonths,
    formattedTotal: fmt(total),
  };
}
