import React, { useEffect, useState } from "react";
import { Command } from "cmdk";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  ChevronDown,
  Database,
  ExternalLink,
  GitBranch,
  Globe,
  LayoutGrid,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Server,
  Shield,
  Sparkles,
  Terminal,
  User,
  X,
} from "lucide-react";
import { Toaster } from "sonner";
import { buildMasterHref } from "@/lib/routing";
import type { DeploySessionUser } from "@/components/deploy/deploy-ui";

export interface CommandPaletteProject {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface DeployAppShellProps {
  user: DeploySessionUser;
  activeNav: "overview" | "deployments" | "domains" | "usage";
  breadcrumbProject?: string;
  projects?: CommandPaletteProject[];
  onQuickRedeploy?: (projectId: string) => void;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { id: "overview", label: "Overview", href: "/deploy", icon: LayoutGrid },
  { id: "deployments", label: "Deployments", href: "/deployments", icon: Rocket },
  { id: "domains", label: "Domains & SSL", href: "/domains", icon: Globe },
  { id: "usage", label: "Usage & Quotas", href: "/usage", icon: BarChart3 },
] as const;

export function DeployAppShell({
  user,
  activeNav,
  breadcrumbProject,
  projects = [],
  onQuickRedeploy,
  children,
}: DeployAppShellProps) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((open) => !open);
      } else if (e.key === "Escape") {
        setCmdOpen(false);
        setUserMenuOpen(false);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSignOut = async () => {
    await fetch("/api/auth/master-sso", { method: "DELETE", credentials: "include" }).catch(
      () => {},
    );
    try {
      window.localStorage.removeItem("spx_session_token");
    } catch {
      // ignore
    }
    window.location.replace("/login?next=/deploy");
  };

  const initials = (user.fullName || user.email)
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="min-h-screen bg-[#05060A] text-[#E2E8F0] font-sans antialiased flex flex-col">
      <Toaster theme="dark" position="bottom-right" richColors />

      {/* 56px Glassmorphic Top Bar */}
      <header className="sticky top-0 z-40 h-14 border-b border-white/[0.07] bg-[#05060A]/80 backdrop-blur-md">
        <div className="h-full px-4 lg:px-5 flex items-center justify-between gap-3">
          {/* Left: Mobile Drawer Trigger + SparrowX Mark + Workspace Breadcrumb */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden size-8 rounded-md spx-ghost-btn grid place-items-center cursor-pointer"
            >
              <Menu className="size-4" />
            </button>

            <a
              href="/deploy"
              className="flex items-center gap-2 shrink-0 hover:opacity-90 transition-opacity"
            >
              <span className="size-7 rounded-md bg-gradient-to-b from-[#F3F6FA] to-[#CFD6E2] grid place-items-center shadow-sm">
                <svg viewBox="0 0 24 24" className="size-3.5 fill-[#05060A]" aria-hidden="true">
                  <path d="M12 3L21 19H3L12 3Z" />
                </svg>
              </span>
              <span className="text-sm font-semibold tracking-tight text-white">SparrowX</span>
              <span className="hidden sm:inline-flex items-center rounded border border-white/15 bg-white/[0.05] px-1.5 py-0.5 text-[10px] spx-mono uppercase tracking-wider text-zinc-200">
                Deploy
              </span>
            </a>

            <span className="hidden md:inline text-zinc-600 select-none">/</span>
            <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-300 min-w-0">
              <span className="truncate max-w-[120px] font-medium text-zinc-300">Personal</span>
              {breadcrumbProject && (
                <>
                  <span className="text-zinc-600">/</span>
                  <span className="truncate max-w-[180px] font-semibold text-white">
                    {breadcrumbProject}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Center: Cmd + K Global Command Palette Trigger */}
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="hidden sm:flex items-center justify-between gap-4 w-full max-w-sm h-8 rounded-lg spx-obsidian-input px-3 text-xs text-zinc-400 hover:border-white/20 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="size-3.5 shrink-0 text-zinc-500" />
              <span className="truncate">Search projects, domains, commits...</span>
            </span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] spx-mono text-zinc-400">
              ⌘K
            </kbd>
          </button>

          {/* Right: Docs + User Avatar Menu */}
          <div className="flex items-center gap-2 shrink-0 relative">
            <a
              href={buildMasterHref("/docs/infra")}
              className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-lg spx-ghost-btn px-2.5 text-xs font-medium"
            >
              <BookOpen className="size-3.5 text-zinc-400" />
              <span>Docs</span>
            </a>

            {/* User Avatar Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen((v) => !v);
                }}
                className="inline-flex h-8 items-center gap-2 rounded-lg spx-ghost-btn pl-1.5 pr-2.5 text-xs cursor-pointer"
              >
                <span className="size-5 rounded-md bg-gradient-to-b from-[#E2E8F0] to-[#94A3B8] text-[#05060A] text-[10px] font-bold grid place-items-center">
                  {initials || "SX"}
                </span>
                <span className="hidden lg:inline max-w-[130px] truncate text-zinc-200">
                  {user.email}
                </span>
                <ChevronDown className="size-3 text-zinc-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-xl spx-obsidian-card p-1.5 shadow-2xl z-50">
                  <div className="px-2.5 py-2 border-b border-white/[0.07]">
                    <div className="text-xs font-semibold text-white truncate">{user.fullName}</div>
                    <div className="text-[11px] spx-mono text-zinc-400 truncate">{user.email}</div>
                  </div>
                  <div className="py-1 space-y-0.5 text-xs">
                    <a
                      href="/deploy"
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                    >
                      <User className="size-3.5 text-zinc-400" />
                      <span>Workspace Overview</span>
                    </a>
                    <a
                      href="/api/auth/github/login?scope=repo&next=%2Fdeploy%2Fnew"
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                    >
                      <GitBranch className="size-3.5 text-zinc-400" />
                      <span>Connect GitHub Account</span>
                    </a>
                    <a
                      href="/usage"
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                    >
                      <BarChart3 className="size-3.5 text-zinc-400" />
                      <span>Usage &amp; INR Plans</span>
                    </a>
                  </div>
                  <div className="pt-1 border-t border-white/[0.07]">
                    <button
                      type="button"
                      onClick={() => void handleSignOut()}
                      className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-red-400 hover:bg-red-500/10 cursor-pointer"
                    >
                      <LogOut className="size-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Shell Body: 240px Left Navigation Rail + Content Canvas */}
      <div className="flex-1 flex min-h-0">
        {/* Desktop Rail */}
        <aside className="hidden lg:flex w-60 shrink-0 border-r border-white/[0.07] bg-[#07090F] flex-col justify-between p-3">
          <div className="space-y-4">
            <a
              href="/deploy/new"
              className="w-full h-9 rounded-lg spx-silver-btn inline-flex items-center justify-center gap-1.5 text-xs font-semibold"
            >
              <Plus className="size-3.5" />
              <span>New Project</span>
            </a>

            <nav aria-label="Deploy Navigation" className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.id;
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-white/[0.08] text-white border border-white/[0.1]"
                        : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200 border border-transparent"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </nav>
          </div>

          {/* Ecosystem Footer */}
          <div className="pt-4 border-t border-white/[0.07] space-y-2">
            <div className="px-2 text-[10px] spx-mono uppercase tracking-wider text-zinc-500">
              SparrowX Ecosystem
            </div>
            <div className="space-y-1 text-xs">
              {[
                { label: "db.sparrowx.net", href: "https://db.sparrowx.net", icon: Database },
                { label: "sec.sparrowx.net", href: "https://sec.sparrowx.net", icon: Shield },
                { label: "ai.sparrowx.net", href: "https://ai.sparrowx.net", icon: Sparkles },
              ].map((eco) => {
                const Icon = eco.icon;
                return (
                  <a
                    key={eco.label}
                    href={eco.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200 transition-colors"
                  >
                    <span className="flex items-center gap-2 spx-mono text-[11px]">
                      <Icon className="size-3.5 text-zinc-500" />
                      <span>{eco.label}</span>
                    </span>
                    <ArrowUpRight className="size-3 text-zinc-600" />
                  </a>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="relative w-64 max-w-[82vw] bg-[#07090F] border-r border-white/10 p-4 flex flex-col justify-between z-10">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">SparrowX Deploy</span>
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen(false)}
                    aria-label="Close navigation"
                    className="size-8 rounded-md spx-ghost-btn grid place-items-center"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <a
                  href="/deploy/new"
                  className="w-full h-9 rounded-lg spx-silver-btn inline-flex items-center justify-center gap-1.5 text-xs font-semibold"
                >
                  <Plus className="size-3.5" />
                  <span>New Project</span>
                </a>
                <nav className="space-y-1">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNav === item.id;
                    return (
                      <a
                        key={item.id}
                        href={item.href}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium ${
                          isActive
                            ? "bg-white/[0.08] text-white border border-white/[0.1]"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </a>
                    );
                  })}
                </nav>
              </div>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400 hover:bg-red-500/10"
              >
                <LogOut className="size-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Workspace Canvas */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Cmd/Ctrl + K Command Palette */}
      {cmdOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-[14vh] px-4"
          onClick={() => setCmdOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl spx-obsidian-card shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <Command label="SparrowX Command Palette" className="bg-transparent">
              <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-4 py-3">
                <Search className="size-4 text-zinc-500" />
                <Command.Input
                  autoFocus
                  placeholder="Jump to project, trigger redeploy, open logs..."
                  className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                />
                <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] spx-mono text-zinc-400">
                  ESC
                </kbd>
              </div>
              <Command.List className="max-h-80 overflow-y-auto p-2 space-y-1 text-xs">
                <Command.Empty className="py-8 text-center text-zinc-500">
                  No matching projects or commands.
                </Command.Empty>

                <Command.Group
                  heading="Quick Actions"
                  className="text-[10px] spx-mono uppercase tracking-wider text-zinc-500 px-2 py-1"
                >
                  <Command.Item
                    onSelect={() => {
                      setCmdOpen(false);
                      window.location.href = "/deploy/new";
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-zinc-200 aria-selected:bg-white/[0.08] aria-selected:text-white cursor-pointer"
                  >
                    <Plus className="size-3.5 text-zinc-400" />
                    <span>Create New Project</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => {
                      setCmdOpen(false);
                      window.location.href = "/deployments";
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-zinc-200 aria-selected:bg-white/[0.08] aria-selected:text-white cursor-pointer"
                  >
                    <Activity className="size-3.5 text-zinc-400" />
                    <span>View Global Deployments</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => {
                      setCmdOpen(false);
                      window.location.href = "/domains";
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-zinc-200 aria-selected:bg-white/[0.08] aria-selected:text-white cursor-pointer"
                  >
                    <Globe className="size-3.5 text-zinc-400" />
                    <span>Manage Domains &amp; SSL</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => {
                      setCmdOpen(false);
                      window.location.href = "/usage";
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-zinc-200 aria-selected:bg-white/[0.08] aria-selected:text-white cursor-pointer"
                  >
                    <Server className="size-3.5 text-zinc-400" />
                    <span>Inspect Usage &amp; Bandwidth Quotas</span>
                  </Command.Item>
                </Command.Group>

                {projects.length > 0 && (
                  <Command.Group
                    heading="Projects"
                    className="text-[10px] spx-mono uppercase tracking-wider text-zinc-500 px-2 py-1"
                  >
                    {projects.map((p) => (
                      <React.Fragment key={p.id}>
                        <Command.Item
                          value={`${p.name} ${p.slug}`}
                          onSelect={() => {
                            setCmdOpen(false);
                            window.location.href = `/projects/${p.id}`;
                          }}
                          className="flex items-center justify-between rounded-lg px-2.5 py-2 text-zinc-200 aria-selected:bg-white/[0.08] aria-selected:text-white cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <Rocket className="size-3.5 text-zinc-400" />
                            <span>{p.name}</span>
                            <span className="spx-mono text-[11px] text-zinc-500">{p.slug}</span>
                          </span>
                          <ExternalLink className="size-3 text-zinc-500" />
                        </Command.Item>
                        <Command.Item
                          value={`logs ${p.name}`}
                          onSelect={() => {
                            setCmdOpen(false);
                            window.location.href = `/projects/${p.id}?tab=logs`;
                          }}
                          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-zinc-300 aria-selected:bg-white/[0.08] aria-selected:text-white cursor-pointer"
                        >
                          <Terminal className="size-3.5 text-sky-400" />
                          <span>Open Live Logs: {p.name}</span>
                        </Command.Item>
                        {onQuickRedeploy && (
                          <Command.Item
                            value={`redeploy ${p.name}`}
                            onSelect={() => {
                              setCmdOpen(false);
                              onQuickRedeploy(p.id);
                            }}
                            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-zinc-300 aria-selected:bg-white/[0.08] aria-selected:text-white cursor-pointer"
                          >
                            <RefreshCw className="size-3.5 text-emerald-400" />
                            <span>Redeploy: {p.name}</span>
                          </Command.Item>
                        )}
                      </React.Fragment>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </div>
        </div>
      )}
    </div>
  );
}
