import React, { useEffect, useState } from "react";

export type SubdomainId = "hub" | "db" | "sec" | "file" | "password" | "api";

interface GlobalEcosystemBarProps {
  activeDomain?: SubdomainId;
  onNavigate?: (id: SubdomainId) => void;
}

export function GlobalEcosystemBar({
  activeDomain: forcedActive,
  onNavigate,
}: GlobalEcosystemBarProps) {
  const [currentId, setCurrentId] = useState<SubdomainId>(forcedActive || "hub");

  useEffect(() => {
    if (forcedActive) {
      setCurrentId(forcedActive);
      return;
    }
    if (typeof window === "undefined") return;

    const host = window.location.hostname;
    const search = new URLSearchParams(window.location.search);
    const path = window.location.pathname;

    if (host.startsWith("password.") || host.startsWith("passwd.") || host.startsWith("pass.") || host.startsWith("keys.") || search.get("password") === "1" || search.get("keys") === "1" || path.startsWith("/keys")) {
      setCurrentId("password");
    } else if (host.startsWith("file.") || host.startsWith("drop.") || host.startsWith("share.") || search.get("file") === "1" || search.get("drop") === "1" || path.startsWith("/drop") || path.startsWith("/f")) {
      setCurrentId("file");
    } else if (host.startsWith("db.") || search.get("db") === "1" || path.startsWith("/db")) {
      setCurrentId("db");
    } else if (host.startsWith("sec.") || host.startsWith("shield.") || search.get("shield") === "1" || search.get("sec") === "1" || path.startsWith("/shield")) {
      setCurrentId("sec");
    } else if (host.startsWith("api.") || host.startsWith("rest.") || search.get("api") === "1") {
      setCurrentId("api");
    } else {
      setCurrentId("hub");
    }
  }, [forcedActive]);

  const subdomains: {
    id: SubdomainId;
    label: string;
    sub: string;
    badge?: string;
    url: string;
    localParam: string;
    localPath: string;
  }[] = [
    {
      id: "hub",
      label: "Company Hub",
      sub: "sparrowx.net",
      url: "https://sparrowx.net",
      localParam: "",
      localPath: "/",
    },
    {
      id: "db",
      label: "Postgres Studio",
      sub: "db.sparrowx.net",
      url: "https://db.sparrowx.net",
      localParam: "db",
      localPath: "/db",
    },
    {
      id: "sec",
      label: "Shield WAF & DDoS",
      sub: "sec.sparrowx.net",
      url: "https://sec.sparrowx.net",
      localParam: "shield",
      localPath: "/shield",
    },
    {
      id: "file",
      label: "Drop & 10GB Vault",
      sub: "file.sparrowx.net",
      url: "https://file.sparrowx.net",
      localParam: "file",
      localPath: "/drop",
    },
    {
      id: "password",
      label: "Offline Keys",
      sub: "password.sparrowx.net",
      badge: "NO LOGIN",
      url: "https://password.sparrowx.net",
      localParam: "password",
      localPath: "/keys",
    },
    {
      id: "api",
      label: "PostgREST Gateway",
      sub: "api.sparrowx.net",
      url: "https://api.sparrowx.net",
      localParam: "api",
      localPath: "/?api=1",
    },
  ];

  const handleSwitch = (item: (typeof subdomains)[number]) => {
    if (onNavigate) {
      onNavigate(item.id);
      return;
    }
    if (typeof window === "undefined") return;

    const host = window.location.hostname;
    const isProdDomain = host === "sparrowx.net" || host === "www.sparrowx.net";

    // If already on the production domain or subdomains
    if (isProdDomain) {
      window.location.href = item.url;
      return;
    }

    // Local / staging / preview environment: use search params to navigate reliably
    if (item.id === "hub") {
      window.location.href = "/";
    } else if (item.localParam) {
      const u = new URL(window.location.href);
      ["db", "file", "drop", "password", "keys", "shield", "sec", "api"].forEach((k) =>
        u.searchParams.delete(k)
      );
      u.pathname = "/";
      u.searchParams.set(item.localParam, "1");
      window.location.href = u.toString();
    } else {
      window.location.href = item.localPath;
    }
  };

  return (
    <div className="h-8 sm:h-7 w-full bg-[#050608] border-b border-white/[0.08] px-2.5 sm:px-4 flex items-center justify-between text-[11px] sm:text-[10px] font-mono select-none z-50 sticky top-0 backdrop-blur-sm">
      {/* Left Telemetry Cluster */}
      <div className="flex items-center gap-1.5 sm:gap-2 text-[#9CA3AF] shrink-0">
        <span className="font-semibold tracking-wider text-[#F3F4F6] text-[10px] sm:text-[10px]">
          SPARROWX <span className="hidden xs:inline text-[#64748B]">//</span> <span className="hidden xs:inline">CLOUD</span>
        </span>
        <span className="hidden md:inline-flex items-center gap-1.5 text-[#64748B] border-l border-white/[0.08] pl-2">
          <span className="relative flex size-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500" />
          </span>
          <span className="tracking-tight">AP-SOUTHEAST • HIGH SPEED CLOUD</span>
        </span>
      </div>

      {/* Right Subdomain Nav Bar (Hairline segmented with touch scroll) */}
      <nav className="flex items-center gap-1 sm:gap-1 overflow-x-auto no-scrollbar py-1 touch-pan-x min-w-0 ml-2">
        {subdomains.map((sub) => {
          const isActive = currentId === sub.id;
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => handleSwitch(sub)}
              className={`px-2 sm:px-2 py-1 sm:py-0.5 min-h-[28px] sm:min-h-0 rounded-[3px] transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                isActive
                  ? "bg-white/[0.12] text-white border border-white/[0.2] font-semibold"
                  : "text-[#64748B] hover:text-[#9CA3AF] hover:bg-white/[0.04]"
              }`}
            >
              <span className={isActive ? "text-emerald-400" : "text-[#475569]"}>
                {isActive ? "●" : "○"}
              </span>
              <span className="hidden lg:inline">{sub.label}</span>
              <span className="font-mono text-[10px] sm:text-[9px] text-[#CBD5E1] lg:hidden">
                {sub.sub.replace(".sparrowx.net", "")}
              </span>
              {sub.badge && (
                <span className="hidden xl:inline text-[8px] tracking-tight bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1 py-0.1 rounded-[2px] font-sans">
                  {sub.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
