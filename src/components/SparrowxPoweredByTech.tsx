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
  title = "Powered by",
  className = "",
}: SparrowxPoweredByTechProps) {
  const marqueeItems = [...POWERING_TECHNOLOGIES, ...POWERING_TECHNOLOGIES];

  return (
    <section
      aria-label="Technologies Powering SparrowX"
      className={`relative py-6 ${className}`}
    >
      <style>{`
        @keyframes spx-logo-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes spx-logo-bob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        .spx-marquee-track {
          display: flex;
          width: max-content;
          animation: spx-logo-marquee 32s linear infinite;
        }
        .spx-marquee-wrap:hover .spx-marquee-track {
          animation-play-state: paused;
        }
        .spx-float-logo {
          animation: spx-logo-bob 4.2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .spx-marquee-track, .spx-float-logo {
            animation: none;
          }
        }
      `}</style>

      <p className="mb-4 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.26em] text-zinc-500">
        {title}
      </p>

      <div className="spx-marquee-wrap relative overflow-hidden">
        {/* Soft left/right fade edges */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#05060A] to-transparent sm:w-28"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#05060A] to-transparent sm:w-28"
        />

        <div className="spx-marquee-track items-center gap-10 py-2 sm:gap-14">
          {marqueeItems.map((tech, idx) => (
            <a
              key={`${tech.id}-${idx}`}
              href={tech.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={tech.name}
              style={{ animationDelay: `${(idx % 5) * 0.45}s` }}
              className="spx-float-logo group inline-flex shrink-0 items-center gap-2.5 opacity-75 transition-all duration-200 hover:opacity-100 hover:scale-105"
            >
              <img
                src={tech.logoSrc}
                alt={tech.name}
                width={30}
                height={30}
                loading="lazy"
                className="size-7 sm:size-8 object-contain drop-shadow-[0_4px_14px_rgba(255,255,255,0.12)]"
              />
              <span className="font-mono text-xs font-medium tracking-tight text-zinc-300 group-hover:text-white whitespace-nowrap">
                {tech.name}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
