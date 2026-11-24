export type InfraCategory = "bare-metal" | "dedicated" | "vds" | "vps";

export type InfraRegionId = "in-mum" | "in-maa" | "sg-sin" | "uk-lon" | "de-fra" | "fr-gra";

export interface InfraRegion {
  id: InfraRegionId;
  name: string;
  country: string;
  city: string;
  code: string;
  flag: string;
  hub: "India" | "Singapore" | "United Kingdom" | "Europe";
  latencyHint: string;
  uplink: string;
  coordinates: { lat: number; lon: number };
}

export const INFRA_REGIONS: InfraRegion[] = [
  {
    id: "in-mum",
    name: "Mumbai IN-1",
    country: "India",
    city: "Mumbai, Maharashtra",
    code: "BOM",
    flag: "🇮🇳",
    hub: "India",
    latencyHint: "8 ms Asia-IN (West/North)",
    uplink: "10 Gbps + Anycast / NIXI",
    coordinates: { lat: 19.076, lon: 72.8777 },
  },
  {
    id: "in-maa",
    name: "Tamil Nadu IN-2",
    country: "India",
    city: "Chennai, Tamil Nadu",
    code: "MAA",
    flag: "🇮🇳",
    hub: "India",
    latencyHint: "4 ms Asia-IN (South / Cable Landing)",
    uplink: "10 Gbps Subsea Direct / NIXI",
    coordinates: { lat: 13.0827, lon: 80.2707 },
  },
  {
    id: "sg-sin",
    name: "Singapore SG-1",
    country: "Singapore",
    city: "Singapore",
    code: "SIN",
    flag: "🇸🇬",
    hub: "Singapore",
    latencyHint: "18 ms APAC Gateway",
    uplink: "25 Gbps Equinix Redundant",
    coordinates: { lat: 1.3521, lon: 103.8198 },
  },
  {
    id: "uk-lon",
    name: "London UK-1",
    country: "United Kingdom",
    city: "London",
    code: "LON",
    flag: "🇬🇧",
    hub: "United Kingdom",
    latencyHint: "14 ms UK & Transatlantic",
    uplink: "25 Gbps LINX / Telehouse",
    coordinates: { lat: 51.5074, lon: -0.1278 },
  },
];

export type InfraOsIconKey =
  | "ubuntu"
  | "debian"
  | "almalinux"
  | "rockylinux"
  | "fedora"
  | "centos"
  | "archlinux"
  | "alpinelinux"
  | "kalilinux"
  | "freebsd"
  | "windows"
  | "proxmox"
  | "docker";

export interface InfraOsImage {
  id: string;
  label: string;
  version: string;
  family: "Linux" | "Hypervisor" | "Windows" | "Apps";
  iconKey: InfraOsIconKey;
  brandColor: string;
  tagline: string;
  monthlyAddonUsd: number;
}

export const INFRA_OS_IMAGES: InfraOsImage[] = [
  {
    id: "ubuntu-24-04",
    label: "Ubuntu",
    version: "24.04 LTS",
    family: "Linux",
    iconKey: "ubuntu",
    brandColor: "#E95420",
    tagline: "Hardened LTS · Cloud-init ready",
    monthlyAddonUsd: 0,
  },
  {
    id: "ubuntu-22-04",
    label: "Ubuntu",
    version: "22.04 LTS",
    family: "Linux",
    iconKey: "ubuntu",
    brandColor: "#E95420",
    tagline: "Battle-tested LTS for production",
    monthlyAddonUsd: 0,
  },
  {
    id: "debian-12",
    label: "Debian",
    version: "12 Bookworm",
    family: "Linux",
    iconKey: "debian",
    brandColor: "#D70A53",
    tagline: "Minimal, rock-solid server base",
    monthlyAddonUsd: 0,
  },
  {
    id: "almalinux-9",
    label: "AlmaLinux",
    version: "9.4 Enterprise",
    family: "Linux",
    iconKey: "almalinux",
    brandColor: "#38BDF8",
    tagline: "RHEL-compatible · cPanel/Plesk ready",
    monthlyAddonUsd: 0,
  },
  {
    id: "rocky-9",
    label: "Rocky Linux",
    version: "9 Enterprise",
    family: "Linux",
    iconKey: "rockylinux",
    brandColor: "#10B981",
    tagline: "1:1 Enterprise Linux binary compatible",
    monthlyAddonUsd: 0,
  },
  {
    id: "fedora-41",
    label: "Fedora Server",
    version: "41 Latest",
    family: "Linux",
    iconKey: "fedora",
    brandColor: "#51A2DA",
    tagline: "Modern kernel & Cockpit web UI",
    monthlyAddonUsd: 0,
  },
  {
    id: "centos-9",
    label: "CentOS Stream",
    version: "9 Rolling",
    family: "Linux",
    iconKey: "centos",
    brandColor: "#A855F7",
    tagline: "Upstream Enterprise Linux stream",
    monthlyAddonUsd: 0,
  },
  {
    id: "arch-latest",
    label: "Arch Linux",
    version: "Rolling",
    family: "Linux",
    iconKey: "archlinux",
    brandColor: "#1793D1",
    tagline: "Lightweight rolling release for power users",
    monthlyAddonUsd: 0,
  },
  {
    id: "alpine-3-21",
    label: "Alpine Linux",
    version: "3.21 Minimal",
    family: "Linux",
    iconKey: "alpinelinux",
    brandColor: "#0EA5E9",
    tagline: "Ultra-lean musl security-focused OS",
    monthlyAddonUsd: 0,
  },
  {
    id: "kali-latest",
    label: "Kali Linux",
    version: "2026 Rolling",
    family: "Linux",
    iconKey: "kalilinux",
    brandColor: "#60A5FA",
    tagline: "Security auditing & pentest toolkit",
    monthlyAddonUsd: 0,
  },
  {
    id: "freebsd-14",
    label: "FreeBSD",
    version: "14.2 Release",
    family: "Linux",
    iconKey: "freebsd",
    brandColor: "#EF4444",
    tagline: "ZFS & high-throughput networking",
    monthlyAddonUsd: 0,
  },
  {
    id: "windows-2022",
    label: "Windows Server",
    version: "2022 Standard",
    family: "Windows",
    iconKey: "windows",
    brandColor: "#00A4EF",
    tagline: "Full RDP access · Licensed image",
    monthlyAddonUsd: 24,
  },
  {
    id: "windows-2025",
    label: "Windows Server",
    version: "2025 Datacenter",
    family: "Windows",
    iconKey: "windows",
    brandColor: "#38BDF8",
    tagline: "Latest Windows Server + RDP",
    monthlyAddonUsd: 28,
  },
  {
    id: "proxmox-8",
    label: "Proxmox VE",
    version: "8.2 Hypervisor",
    family: "Hypervisor",
    iconKey: "proxmox",
    brandColor: "#F97316",
    tagline: "Bare-metal KVM & LXC virtualization",
    monthlyAddonUsd: 0,
  },
  {
    id: "docker-ubuntu",
    label: "Docker + Ubuntu",
    version: "24.04 + Compose",
    family: "Apps",
    iconKey: "docker",
    brandColor: "#2496ED",
    tagline: "Pre-installed Docker Engine & Compose",
    monthlyAddonUsd: 0,
  },
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
  nodeLocation?: string;
  inStock?: boolean;
  isVds?: boolean;
  badge?: string;
}

export const INFRA_PLANS: InfraServerPlan[] = [
  // ==========================================
  // 1. CLOUD VPS (AMD RYZEN 9 9950X - MUMBAI)
  // ==========================================
  {
    id: "vps-ryzen-9950x-4gb",
    category: "vps",
    name: "Ryzen 9 9950X — 4GB",
    tagline: "High-performance Cloud VPS powered by AMD Ryzen 9 9950X @ 5.7GHz, DDR5 ECC On-Die memory, and Enterprise DDoS protection.",
    cpuModel: "AMD Ryzen 9 9950X @ 5.7GHz",
    coresThreads: "2 vCPU",
    clockGhz: "4.3 - 5.7 GHz",
    ram: "4 GB DDR5 ECC",
    storage: "60 GB NVMe Gen5",
    network: "1 Gbps Uplink · Enterprise DDoS",
    ddosProtection: "Enterprise DDoS + Anycast",
    deployTime: "45 secs",
    priceMonthlyUsd: 12,
    priceMonthlyInr: 999, // Base ₹799 + ₹200
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
    visual3d: "/3d/vps-kvm-cubes.svg",
    nodeLocation: "Ryzen 9",
    inStock: true,
    specsHighlights: [
      "Ultra-low latency across India & Singapore hubs",
      "AMD Ryzen 9 9950X Zen 5 single-thread performance",
      "DDR5 ECC On-Die memory with zero noisy neighbours",
      "1 Dedicated Static IPv4 & 99.9% Uptime SLA",
    ],
  },
  {
    id: "vps-ryzen-9950x-8gb",
    category: "vps",
    name: "Ryzen 9 9950X — 8GB",
    tagline: "High-performance Cloud VPS powered by AMD Ryzen 9 9950X @ 5.7GHz, DDR5 ECC On-Die memory, and Enterprise DDoS protection.",
    cpuModel: "AMD Ryzen 9 9950X @ 5.7GHz",
    coresThreads: "4 vCPU",
    clockGhz: "4.3 - 5.7 GHz",
    ram: "8 GB DDR5 ECC",
    storage: "120 GB NVMe Gen5",
    network: "2.5 Gbps Uplink · Enterprise DDoS",
    ddosProtection: "Enterprise DDoS + Anycast",
    deployTime: "45 secs",
    priceMonthlyUsd: 18,
    priceMonthlyInr: 1499, // Base ₹1,299 + ₹200
    featured: true,
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
    visual3d: "/3d/vps-kvm-cubes.svg",
    nodeLocation: "Ryzen 9",
    inStock: true,
    specsHighlights: [
      "Sub-8ms Asia-IN peering across India & Singapore",
      "4 Zen 5 compute threads @ up to 5.7 GHz boost",
      "120 GB high-IOPS NVMe Gen5 enterprise storage",
      "Always-on eBPF/XDP volumetric attack filtering",
    ],
  },
  {
    id: "vps-ryzen-9950x-12gb",
    category: "vps",
    name: "Ryzen 9 9950X — 12GB",
    tagline: "High-performance Cloud VPS powered by AMD Ryzen 9 9950X @ 5.7GHz, DDR5 ECC On-Die memory, and Enterprise DDoS protection.",
    cpuModel: "AMD Ryzen 9 9950X @ 5.7GHz",
    coresThreads: "6 vCPU",
    clockGhz: "4.3 - 5.7 GHz",
    ram: "12 GB DDR5 ECC",
    storage: "180 GB NVMe Gen5",
    network: "5 Gbps Uplink · Enterprise DDoS",
    ddosProtection: "Enterprise DDoS + Anycast",
    deployTime: "45 secs",
    priceMonthlyUsd: 24,
    priceMonthlyInr: 1999, // Base ₹1,799 + ₹200
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
    visual3d: "/3d/vps-kvm-cubes.svg",
    nodeLocation: "Ryzen 9",
    inStock: true,
    specsHighlights: [
      "Dedicated multi-gigabit fiber path across India & Singapore",
      "6 Zen 5 high-speed virtual execution cores",
      "DDR5 ECC On-Die memory for mission-critical apps",
      "SparrowXNet WireGuard private mesh pre-installed",
    ],
  },
  {
    id: "vps-ryzen-9950x-16gb",
    category: "vps",
    name: "Ryzen 9 9950X — 16GB",
    tagline: "High-performance Cloud VPS powered by AMD Ryzen 9 9950X @ 5.7GHz, DDR5 ECC On-Die memory, and Enterprise DDoS protection.",
    cpuModel: "AMD Ryzen 9 9950X @ 5.7GHz",
    coresThreads: "8 vCPU",
    clockGhz: "4.3 - 5.7 GHz",
    ram: "16 GB DDR5 ECC",
    storage: "250 GB NVMe Gen5",
    network: "10 Gbps Uplink · Enterprise DDoS",
    ddosProtection: "Enterprise DDoS + Anycast",
    deployTime: "45 secs",
    priceMonthlyUsd: 31,
    priceMonthlyInr: 2599, // Base ₹2,399 + ₹200
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
    visual3d: "/3d/vps-kvm-cubes.svg",
    nodeLocation: "Ryzen 9",
    inStock: true,
    specsHighlights: [
      "Redundant power & enterprise cooling across all nodes",
      "8 high-throughput Zen 5 compute threads",
      "10 Gbps burst network interface with DDoS filter",
      "Dedicated IPv4 + /64 IPv6 included",
    ],
  },
  {
    id: "vps-ryzen-9950x-24gb",
    category: "vps",
    name: "Ryzen 9 9950X — 24GB",
    tagline: "High-performance Cloud VPS powered by AMD Ryzen 9 9950X @ 5.7GHz, DDR5 ECC On-Die memory, and Enterprise DDoS protection.",
    cpuModel: "AMD Ryzen 9 9950X @ 5.7GHz",
    coresThreads: "10 vCPU",
    clockGhz: "4.3 - 5.7 GHz",
    ram: "24 GB DDR5 ECC",
    storage: "360 GB NVMe Gen5",
    network: "10 Gbps Uplink · Enterprise DDoS",
    ddosProtection: "Enterprise DDoS + Anycast",
    deployTime: "45 secs",
    priceMonthlyUsd: 38,
    priceMonthlyInr: 3199, // Base ₹2,999 + ₹200
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
    visual3d: "/3d/vps-kvm-cubes.svg",
    nodeLocation: "Ryzen 9",
    inStock: true,
    specsHighlights: [
      "Enterprise high-frequency infrastructure",
      "10 Zen 5 cores for heavy databases and multi-containers",
      "360 GB blistering Gen5 NVMe read/write speeds",
      "Flat rate billing with zero hidden egress traps",
    ],
  },

  // ====================================================
  // 2. DEDICATED VDS (100% DEDICATED BARE-METAL CORES)
  // ====================================================
  {
    id: "vds-ryzen-9950x-4gb",
    category: "vds",
    name: "Ryzen 9 VDS — 4GB (2 Cores)",
    tagline: "100% Dedicated Compute Resources powered by AMD Ryzen 9 9950X. Processor: 2 Dedicated Bare-Metal Cores (5.7GHz), DDR5 ECC, and Enterprise DDoS.",
    cpuModel: "AMD Ryzen 9 9950X (Dedicated)",
    coresThreads: "2 Dedicated Cores / 4T",
    clockGhz: "5.7 GHz Locked",
    ram: "4 GB DDR5 ECC",
    storage: "100 GB NVMe Gen5",
    network: "10 Gbps Unmetered · Enterprise DDoS",
    ddosProtection: "Enterprise DDoS + GameSec L4",
    deployTime: "2 mins",
    priceMonthlyUsd: 32,
    priceMonthlyInr: 2700, // Base ₹2,500 + ₹200
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
    visual3d: "/3d/game-server-node.svg",
    nodeLocation: "Ryzen 9",
    inStock: true,
    isVds: true,
    specsHighlights: [
      "100% Dedicated Bare-Metal physical silicon allocation",
      "Locked 5.7 GHz single-thread clocks without CPU throttling",
      "Direct IXP peering across India & Singapore",
      "GameSec UDP/RakNet/ENet & TCP flood mitigation",
    ],
  },
  {
    id: "vds-ryzen-9950x-8gb",
    category: "vds",
    name: "Ryzen 9 VDS — 8GB (4 Cores)",
    tagline: "100% Dedicated Compute Resources powered by AMD Ryzen 9 9950X. Processor: 4 Dedicated Bare-Metal Cores (5.7GHz), DDR5 ECC, and Enterprise DDoS.",
    cpuModel: "AMD Ryzen 9 9950X (Dedicated)",
    coresThreads: "4 Dedicated Cores / 8T",
    clockGhz: "5.7 GHz Locked",
    ram: "8 GB DDR5 ECC",
    storage: "200 GB NVMe Gen5",
    network: "10 Gbps Unmetered · Enterprise DDoS",
    ddosProtection: "Enterprise DDoS + GameSec L4",
    deployTime: "2 mins",
    priceMonthlyUsd: 48,
    priceMonthlyInr: 3999, // Base ₹3,799 + ₹200
    featured: true,
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
    visual3d: "/3d/game-server-node.svg",
    nodeLocation: "Ryzen 9",
    inStock: true,
    isVds: true,
    specsHighlights: [
      "4 100% dedicated physical Zen 5 cores (no hypervisor steal)",
      "Ultra-low ping across India & Singapore",
      "DDR5 ECC On-Die memory for zero memory corruption",
      "Unmetered 10 Gbps uplink with zero egress costs",
    ],
  },
  {
    id: "vds-ryzen-9950x-12gb",
    category: "vds",
    name: "Ryzen 9 VDS — 12GB (4 Cores)",
    tagline: "100% Dedicated Compute Resources powered by AMD Ryzen 9 9950X. Processor: 4 Dedicated Bare-Metal Cores (5.7GHz), DDR5 ECC, and Enterprise DDoS.",
    cpuModel: "AMD Ryzen 9 9950X (Dedicated)",
    coresThreads: "4 Dedicated Cores / 8T",
    clockGhz: "5.7 GHz Locked",
    ram: "12 GB DDR5 ECC",
    storage: "300 GB NVMe Gen5",
    network: "10 Gbps Unmetered · Enterprise DDoS",
    ddosProtection: "Enterprise DDoS + GameSec L4",
    deployTime: "2 mins",
    priceMonthlyUsd: 54,
    priceMonthlyInr: 4499, // Base ₹4,299 + ₹200
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
    visual3d: "/3d/game-server-node.svg",
    nodeLocation: "Ryzen 9",
    inStock: true,
    isVds: true,
    specsHighlights: [
      "4 Dedicated bare-metal cores with 12 GB DDR5 ECC",
      "Enterprise security infrastructure with 99.9% SLA",
      "300 GB enterprise Gen5 NVMe with high IOPS",
      "1-click Pterodactyl, Docker, and WireGuard mesh pairing",
    ],
  },
  {
    id: "vds-ryzen-9950x-16gb",
    category: "vds",
    name: "Ryzen 9 VDS — 16GB (6 Cores)",
    tagline: "100% Dedicated Compute Resources powered by AMD Ryzen 9 9950X. Processor: 6 Dedicated Bare-Metal Cores (5.7GHz), DDR5 ECC, and Enterprise DDoS.",
    cpuModel: "AMD Ryzen 9 9950X (Dedicated)",
    coresThreads: "6 Dedicated Cores / 12T",
    clockGhz: "5.7 GHz Locked",
    ram: "16 GB DDR5 ECC",
    storage: "450 GB NVMe Gen5",
    network: "10 Gbps Unmetered · Enterprise DDoS",
    ddosProtection: "Enterprise DDoS + GameSec L4",
    deployTime: "2 mins",
    priceMonthlyUsd: 61,
    priceMonthlyInr: 5099, // Base ₹4,899 + ₹200
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
    visual3d: "/3d/game-server-node.svg",
    nodeLocation: "Ryzen 9",
    inStock: true,
    isVds: true,
    specsHighlights: [
      "6 Dedicated Bare-Metal cores with 12 execution threads",
      "Redundant BGP routing & 1 Dedicated Static IPv4",
      "Pre-tuned Linux kernel for 20 TPS lock in game servers",
      "24/7 engineering support & 99.9% uptime SLA",
    ],
  },
  {
    id: "vds-ryzen-9950x-24gb",
    category: "vds",
    name: "Ryzen 9 VDS — 24GB (8 Cores)",
    tagline: "100% Dedicated Compute Resources powered by AMD Ryzen 9 9950X. Processor: 8 Dedicated Bare-Metal Cores (5.7GHz), DDR5 ECC, and Enterprise DDoS.",
    cpuModel: "AMD Ryzen 9 9950X (Dedicated)",
    coresThreads: "8 Dedicated Cores / 16T",
    clockGhz: "5.7 GHz Locked",
    ram: "24 GB DDR5 ECC",
    storage: "600 GB NVMe Gen5",
    network: "10 Gbps Unmetered · Enterprise DDoS",
    ddosProtection: "Enterprise DDoS + GameSec L4",
    deployTime: "2 mins",
    priceMonthlyUsd: 68,
    priceMonthlyInr: 5699, // Base ₹5,499 + ₹200
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
    visual3d: "/3d/game-server-node.svg",
    nodeLocation: "Ryzen 9",
    inStock: true,
    isVds: true,
    specsHighlights: [
      "8 Dedicated Bare-Metal Zen 5 cores (half of physical 9950X)",
      "Enterprise 99.9% uptime SLA guarantee",
      "600 GB enterprise Gen5 storage for heavy persistent state",
      "Priority Discord & 24/7 senior NOC engineer hotline",
    ],
  },
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
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
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
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
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
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
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
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
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
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
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
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
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
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
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
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
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
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
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
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
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
    regions: ["in-mum", "in-maa", "sg-sin", "uk-lon"],
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
