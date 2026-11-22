import React from "react";

export interface TechLogoItem {
  id: string;
  name: string;
  category: "Compute & Virtualization" | "Game Engine" | "Edge & Networking" | "Database & Storage";
  role: string;
  badge: string;
  color: string;
  accentBg: string;
  accentBorder: string;
  docsUrl: string;
  logoSrc: string;
}

export const POWERING_TECHNOLOGIES: TechLogoItem[] = [
  {
    id: "proxmox",
    name: "Proxmox VE 8.2",
    category: "Compute & Virtualization",
    role: "Type-1 KVM Bare-Metal Hypervisor & Linux Bridge (vmbr0)",
    badge: "Cloud Virtualization",
    color: "#E57000",
    accentBg: "rgba(229, 112, 0, 0.12)",
    accentBorder: "rgba(229, 112, 0, 0.3)",
    docsUrl: "https://www.proxmox.com",
    logoSrc: "/logos/tech/proxmox.svg",
  },
  {
    id: "amd-ryzen",
    name: "AMD Ryzen 9 9950X",
    category: "Compute & Virtualization",
    role: "Zen 5 Physical Hardware Compute @ 5.7GHz Boost & DDR5 ECC",
    badge: "Hardware Silicon",
    color: "#ED1C24",
    accentBg: "rgba(237, 28, 36, 0.12)",
    accentBorder: "rgba(237, 28, 36, 0.3)",
    docsUrl: "https://www.amd.com",
    logoSrc: "/logos/tech/amd.svg",
  },
  {
    id: "pterodactyl",
    name: "Pterodactyl Panel",
    category: "Game Engine",
    role: "Open-Source Game Server Manager, Wings Daemon & Docker Nodes",
    badge: "Game Hosting",
    color: "#0C7FD9",
    accentBg: "rgba(12, 127, 217, 0.12)",
    accentBorder: "rgba(12, 127, 217, 0.3)",
    docsUrl: "https://pterodactyl.io",
    logoSrc: "/logos/tech/pterodactyl.svg",
  },
  {
    id: "nginx",
    name: "Nginx 1.26",
    category: "Edge & Networking",
    role: "High-Performance Edge Reverse Proxy, TLS 1.3 & Rate Limiting",
    badge: "Edge Reverse Proxy",
    color: "#009639",
    accentBg: "rgba(0, 150, 57, 0.12)",
    accentBorder: "rgba(0, 150, 57, 0.3)",
    docsUrl: "https://nginx.org",
    logoSrc: "/logos/tech/nginx.svg",
  },
  {
    id: "postgresql",
    name: "PostgreSQL 16",
    category: "Database & Storage",
    role: "Sovereign Relational Engine, SCRAM-SHA-256 Auth & pgvector",
    badge: "Database Studio",
    color: "#336791",
    accentBg: "rgba(51, 103, 145, 0.14)",
    accentBorder: "rgba(51, 103, 145, 0.35)",
    docsUrl: "https://www.postgresql.org",
    logoSrc: "/logos/tech/postgresql.svg",
  },
  {
    id: "wireguard",
    name: "WireGuard Mesh",
    category: "Edge & Networking",
    role: "Fast, Modern Kernel Cryptographic VPN Mesh (10.66.1.0/24)",
    badge: "Private Overlay",
    color: "#88171A",
    accentBg: "rgba(136, 23, 26, 0.14)",
    accentBorder: "rgba(136, 23, 26, 0.35)",
    docsUrl: "https://www.wireguard.com",
    logoSrc: "/logos/tech/wireguard.svg",
  },
  {
    id: "ebpf-xdp",
    name: "Linux eBPF & XDP",
    category: "Edge & Networking",
    role: "Line-Rate L3/L4 Volumetric DDoS Mitigation inside NIC Driver",
    badge: "DDoS Mitigation",
    color: "#E97B1A",
    accentBg: "rgba(233, 123, 26, 0.12)",
    accentBorder: "rgba(233, 123, 26, 0.3)",
    docsUrl: "https://ebpf.io",
    logoSrc: "/logos/tech/ebpf.svg",
  },
  {
    id: "docker",
    name: "Docker Engine",
    category: "Compute & Virtualization",
    role: "Isolated Application Sandboxing & Ephemeral Container Lifecycle",
    badge: "Containerization",
    color: "#2496ED",
    accentBg: "rgba(36, 150, 237, 0.12)",
    accentBorder: "rgba(36, 150, 237, 0.3)",
    docsUrl: "https://www.docker.com",
    logoSrc: "/logos/tech/docker.svg",
  },
  {
    id: "linux-kernel",
    name: "Enterprise Linux & KVM",
    category: "Compute & Virtualization",
    role: "Hardened Ubuntu, Debian & Rocky Linux Kernels with cgroups v2",
    badge: "Operating System",
    color: "#FCC624",
    accentBg: "rgba(252, 198, 36, 0.12)",
    accentBorder: "rgba(252, 198, 36, 0.3)",
    docsUrl: "https://kernel.org",
    logoSrc: "/logos/tech/linux.svg",
  },
  {
    id: "cloud-init",
    name: "Cloud-Init",
    category: "Compute & Virtualization",
    role: "Autonomous Static IP, Gateway, Nameserver & SSH Key Injection",
    badge: "OS Automation",
    color: "#E95420",
    accentBg: "rgba(233, 84, 32, 0.12)",
    accentBorder: "rgba(233, 84, 32, 0.3)",
    docsUrl: "https://cloud-init.io",
    logoSrc: "/logos/tech/cloud-init.svg",
  },
];

export interface SparrowxPoweredByTechProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

export function SparrowxPoweredByTech({
  title = "Powering SparrowX Sovereign Infrastructure",
  subtitle = "Built on official open source engines, enterprise hypervisors, and high-frequency silicon.",
  className = "",
}: SparrowxPoweredByTechProps) {
  return (
    <section
      aria-label="Technologies Powering SparrowX"
      className={`rounded-2xl border border-white/10 bg-[#080B11]/90 backdrop-blur-md p-6 sm:p-8 space-y-6 ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#FFA14A]">
            <span className="size-2 rounded-full bg-[#FFA14A] animate-pulse" />
            <span>Official Software &bull; Open Architecture</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
            {subtitle}
          </p>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shrink-0">
          Official Software Stacks
        </span>
      </div>

      {/* Grid of Technology Cards with Official Imported Logos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {POWERING_TECHNOLOGIES.map((tech) => (
          <a
            key={tech.id}
            href={tech.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group p-4 rounded-xl border border-white/10 bg-[#0C1019] hover:border-white/25 hover:bg-[#101522] transition-all duration-200 flex flex-col justify-between space-y-3 cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div
                  className="size-11 rounded-xl flex items-center justify-center shrink-0 p-2 transition-transform group-hover:scale-110 shadow-inner"
                  style={{
                    backgroundColor: tech.accentBg,
                    border: `1px solid ${tech.accentBorder}`,
                  }}
                >
                  <img
                    src={tech.logoSrc}
                    alt={`${tech.name} Official Brand Logo`}
                    width={28}
                    height={28}
                    loading="lazy"
                    className="size-7 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                  />
                </div>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300">
                  {tech.badge}
                </span>
              </div>

              <h3 className="text-sm font-bold text-white group-hover:text-[#FFA14A] transition-colors flex items-center gap-1.5">
                <span>{tech.name}</span>
                <span className="text-zinc-500 text-xs transition-transform group-hover:translate-x-0.5">&rarr;</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed line-clamp-2">
                {tech.role}
              </p>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-zinc-500 group-hover:text-zinc-300 transition-colors">
              <span className="truncate max-w-[120px]">{tech.category}</span>
              <span className="text-[10px] uppercase tracking-wider text-emerald-400/90 font-semibold">Official</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
