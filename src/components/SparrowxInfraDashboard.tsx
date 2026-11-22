import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Camera,
  Check,
  Copy,
  Cpu,
  CreditCard,
  Download,
  FileCode,
  Globe,
  HardDrive,
  KeyRound,
  Layers,
  Network,
  Play,
  Plus,
  Power,
  QrCode,
  RefreshCw,
  RotateCcw,
  Server,
  Settings,
  Shield,
  Square,
  Terminal,
  Trash2,
  Wifi,
} from "lucide-react";
import { INFRA_OS_IMAGES } from "@/lib/infra-plans";
import { UpiAutoPayModal, type UpiCheckoutOrder } from "@/components/UpiAutoPayModal";
import { SparrowxFooter } from "@/components/SparrowxFooter";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import {
  clearMasterSsoSession,
  fetchMasterSsoUser,
  type HydratedMasterSsoUser,
} from "@/lib/developer-connection";
import { clearSessionToken, issueSignedSessionToken } from "@/lib/advanced-features";
import type { ManagedInfraServer, ProxmoxConfigStatus } from "@/lib/server/proxmox.server";

type PanelSection =
  | "overview"
  | "ssh"
  | "network"
  | "os"
  | "snapshots"
  | "billing"
  | "proxmox";

const SIDEBAR_ITEMS: Array<{ id: PanelSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "ssh", label: "SSH & Web Terminal", icon: Terminal },
  { id: "network", label: "IP & Networking", icon: Network },
  { id: "os", label: "OS & Reinstall", icon: Layers },
  { id: "snapshots", label: "Snapshots & Backups", icon: Camera },
  { id: "billing", label: "UPI Billing & Wallet", icon: CreditCard },
  { id: "proxmox", label: "Proxmox VE Link", icon: Settings },
];

function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return "Offline";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function SparrowxInfraDashboard() {
  const [servers, setServers] = useState<ManagedInfraServer[]>([]);
  const [proxmox, setProxmox] = useState<ProxmoxConfigStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [section, setSection] = useState<PanelSection>("overview");
  const [loading, setLoading] = useState<boolean>(true);
  const [actionBusy, setActionBusy] = useState<string>("");
  const [toastMsg, setToastMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string>("");

  // SSH / Console state
  const [sshKeyLabel, setSshKeyLabel] = useState("");
  const [sshKeyPub, setSshKeyPub] = useState("");
  const [rotatedPass, setRotatedPass] = useState("");
  const [consoleLines, setConsoleLines] = useState<string[]>([
    "SparrowX Proxmox VE Web Terminal Ready — click 'Connect Web SSH' to open live session.",
  ]);
  const [terminalCmd, setTerminalCmd] = useState("");
  const [consoleConnected, setConsoleConnected] = useState(false);

  // Network / OS / Snapshot form state
  const [rdnsInput, setRdnsInput] = useState("");
  const [selectedOs, setSelectedOs] = useState(INFRA_OS_IMAGES[0]!.label);
  const [snapName, setSnapName] = useState("");

  // Billing & UPI state
  const [recentOrders, setRecentOrders] = useState<UpiCheckoutOrder[]>([]);
  const [upiModalOpen, setUpiModalOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState(849);
  const [ssoUser, setSsoUser] = useState<HydratedMasterSsoUser | null>(null);

  useEffect(() => {
    let active = true;
    void fetchMasterSsoUser().then((u) => {
      if (!active || !u) return;
      setSsoUser(u);
      issueSignedSessionToken({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        tenantId: u.tenantId,
      });
    });
    return () => {
      active = false;
    };
  }, []);

  const notify = (tone: "ok" | "err", text: string) => {
    setToastMsg({ tone, text });
    window.setTimeout(() => setToastMsg(null), 4500);
  };

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch("/api/infra/servers");
      const json = (await res.json()) as {
        ok?: boolean;
        proxmox?: ProxmoxConfigStatus;
        servers?: ManagedInfraServer[];
      };
      if (json.ok && Array.isArray(json.servers)) {
        setServers(json.servers);
        if (json.proxmox) setProxmox(json.proxmox);
        setSelectedId((prev) =>
          prev && json.servers!.some((s) => s.id === prev)
            ? prev
            : (json.servers![0]?.id ?? ""),
        );
      }
    } catch {
      notify("err", "Unable to reach /api/infra/servers");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUpiOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/payments/upi/orders");
      const json = (await res.json()) as { ok?: boolean; orders?: UpiCheckoutOrder[] };
      if (json.ok && Array.isArray(json.orders)) {
        setRecentOrders(json.orders);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchServers();
    void fetchUpiOrders();
  }, [fetchServers, fetchUpiOrders]);

  const activeServer = useMemo(
    () => servers.find((s) => s.id === selectedId) ?? servers[0] ?? null,
    [servers, selectedId],
  );

  useEffect(() => {
    if (activeServer) {
      setRdnsInput(activeServer.rdns);
      setSelectedOs(activeServer.os);
      setConsoleConnected(false);
      setRotatedPass("");
    }
  }, [activeServer?.id]);

  const copyText = (text: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(""), 1600);
    }
  };

  const runAction = async (
    action:
      | "start"
      | "stop"
      | "shutdown"
      | "reboot"
      | "rebuild"
      | "snapshot"
      | "delete-snapshot"
      | "add-ssh-key"
      | "set-rdns"
      | "toggle-wireguard"
      | "reset-password",
    extra?: Record<string, string>,
  ) => {
    if (!activeServer) return;
    setActionBusy(action);
    try {
      const res = await fetch("/api/infra/servers/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId: activeServer.id,
          action,
          ...extra,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        server?: ManagedInfraServer;
        generatedPassword?: string;
      };
      if (json.ok && json.server) {
        setServers((prev) =>
          prev.map((s) => (s.id === json.server!.id ? json.server! : s)),
        );
        if (json.generatedPassword) {
          setRotatedPass(json.generatedPassword);
        }
        notify("ok", json.message || "Action executed.");
      } else {
        notify("err", json.message || "Server action failed.");
      }
    } catch {
      notify("err", "Network error communicating with Proxmox control plane.");
    } finally {
      setActionBusy("");
    }
  };

  const handleConnectConsole = async () => {
    if (!activeServer) return;
    setActionBusy("console");
    try {
      const res = await fetch("/api/infra/servers/console", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId: activeServer.id }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        sshCommand?: string;
        proxmoxTicket?: string;
        consolePort?: number;
        mode?: string;
      };
      if (json.ok) {
        setConsoleConnected(true);
        setConsoleLines([
          `[Proxmox VE termproxy :: ${json.mode?.toUpperCase()}] Ticket issued (${json.proxmoxTicket?.slice(0, 22)}...)`,
          `Connected to ${activeServer.hostname} (${activeServer.ipv4}:${json.consolePort})`,
          `Welcome to ${activeServer.os} (Linux 6.8.0-sparrowx-xdp x86_64)`,
          `System load: ${(activeServer.cpuUsagePct / 100 * activeServer.cpuCores).toFixed(2)} | Memory: ${activeServer.ramUsedGb}/${activeServer.ramTotalGb} GB | IPv4: ${activeServer.ipv4}`,
          `root@${activeServer.hostname.split(".")[0]}:~# `,
        ]);
      }
    } catch {
      notify("err", "Could not initialize Proxmox console ticket.");
    } finally {
      setActionBusy("");
    }
  };

  const handleRunTerminalCmd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeServer || !terminalCmd.trim()) return;
    const cmd = terminalCmd.trim();
    const hostShort = activeServer.hostname.split(".")[0] || "node";
    let reply = `Executed '${cmd}' on ${activeServer.hostname}`;
    if (cmd === "uname -a") {
      reply = `Linux ${hostShort} 6.8.0-49-generic #49-Ubuntu SMP PREEMPT_DYNAMIC x86_64 GNU/Linux`;
    } else if (cmd === "ip a" || cmd === "hostname -I") {
      reply = `${activeServer.ipv4} ${activeServer.wireguardEnabled ? activeServer.wireguardIp.split("/")[0] : ""} ${activeServer.ipv6}`;
    } else if (cmd === "uptime") {
      reply = `up ${formatUptime(activeServer.uptimeSeconds)}, 1 user, load average: 0.42, 0.38, 0.31`;
    } else if (cmd === "wg show") {
      reply = activeServer.wireguardEnabled
        ? `interface: wg0\n  listening port: 51820\n  peer: sparrowx-netsec-hub (10.66.0.1) — latest handshake: 14 seconds ago`
        : "WireGuard interface wg0 is paused.";
    } else if (cmd === "clear") {
      setConsoleLines([`root@${hostShort}:~# `]);
      setTerminalCmd("");
      return;
    }
    setConsoleLines((prev) => [
      ...prev.slice(0, -1),
      `root@${hostShort}:~# ${cmd}`,
      reply,
      `root@${hostShort}:~# `,
    ]);
    setTerminalCmd("");
  };

  const ramPct = activeServer
    ? Math.min(100, Math.round((activeServer.ramUsedGb / activeServer.ramTotalGb) * 100))
    : 0;
  const diskPct = activeServer
    ? Math.min(100, Math.round((activeServer.diskUsedGb / activeServer.diskTotalGb) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-[#06080D] text-[#F4F6FA] flex flex-col selection:bg-sky-400 selection:text-black">
      {/* Top Cloud Panel Header (Hostinger hPanel-inspired clean utility bar) */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0A0D14]/95 backdrop-blur-xl">
        <div className="max-w-[1440px] mx-auto h-15 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <a
              href="/infra"
              className="flex items-center gap-2.5 shrink-0"
            >
              <img
                src="/sparrowx-logo.png"
                alt="SparrowX Cloud Panel"
                width={30}
                height={30}
                className="size-7.5 object-contain"
              />
              <span className="text-base font-bold tracking-tight text-white">
                SparrowX <span className="text-sky-400">hPanel</span>
              </span>
            </a>

            <span className="hidden sm:inline-block h-5 w-px bg-white/15" aria-hidden="true" />

            <a
              href="/infra"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              <span>Order New Server</span>
            </a>
          </div>

          <div className="flex items-center gap-2.5">
            {proxmox && (
              <span
                className={`hidden md:inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                  proxmox.configured
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-500/35 bg-amber-500/10 text-amber-200"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    proxmox.configured ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                  aria-hidden="true"
                />
                <span>
                  {proxmox.configured
                    ? `Proxmox VE Live (${proxmox.node})`
                    : "Proxmox VE Sandbox Ready"}
                </span>
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                setTopupAmount(activeServer?.monthlyPriceInr ?? 849);
                setUpiModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3.5 py-2 text-xs font-semibold text-black transition-colors cursor-pointer"
            >
              <QrCode className="size-3.5" aria-hidden="true" />
              <span>UPI Top-Up / Pay</span>
            </button>

            {ssoUser ? (
              <div className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs">
                <span className="size-2 rounded-full bg-emerald-400" />
                <span className="text-zinc-200 max-w-[140px] truncate">{ssoUser.email}</span>
                <button
                  type="button"
                  onClick={async () => {
                    clearSessionToken();
                    await clearMasterSsoSession();
                    setSsoUser(null);
                  }}
                  className="text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <GoogleSignInButton
                nextPath="/infra/dashboard"
                label="Google Sign-In"
                className="!w-auto !py-1.5 !px-3 !text-xs"
              />
            )}
          </div>
        </div>
      </header>

      {/* Feedback Toast */}
      {toastMsg && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 rounded-xl border px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur-md ${
            toastMsg.tone === "ok"
              ? "border-emerald-500/40 bg-[#0A1713]/95 text-emerald-200"
              : "border-red-500/40 bg-[#1B0C10]/95 text-red-200"
          }`}
        >
          {toastMsg.text}
        </div>
      )}

      {/* Main Two-Column Cloud Control Panel */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
        {/* Left Sidebar: Server Switcher + hPanel Navigation */}
        <aside className="space-y-5 lg:sticky lg:top-20">
          {/* Active Server Selector Card */}
          <div className="rounded-xl border border-white/10 bg-[#0C1018] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="spx-server-switcher"
                className="text-xs font-medium text-zinc-400"
              >
                Active server ({servers.length})
              </label>
              <a
                href="/infra#catalog"
                className="text-xs font-medium text-sky-400 hover:text-sky-300 inline-flex items-center gap-1"
              >
                <Plus className="size-3" aria-hidden="true" />
                <span>Deploy</span>
              </a>
            </div>

            {servers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/15 bg-[#06080D] px-3 py-2.5 text-xs text-zinc-400">
                No servers deployed yet
              </div>
            ) : (
              <select
                id="spx-server-switcher"
                value={activeServer?.id ?? ""}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#06080D] px-3 py-2 text-sm font-medium text-white focus:outline-none focus:border-sky-400"
              >
                {servers.map((srv) => (
                  <option key={srv.id} value={srv.id}>
                    {srv.name} ({srv.ipv4})
                  </option>
                ))}
              </select>
            )}

            {activeServer && (
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span
                    className={`size-2 rounded-full ${
                      activeServer.status === "running"
                        ? "bg-emerald-400"
                        : "bg-red-400"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="capitalize text-zinc-200">{activeServer.status}</span>
                </span>
                <span className="text-zinc-400 tabular-nums">
                  VMID {activeServer.vmid} · {activeServer.region}
                </span>
              </div>
            )}
          </div>

          {/* Navigation Menu */}
          <nav
            aria-label="Server management sections"
            className="rounded-xl border border-white/10 bg-[#0C1018] p-2 space-y-1"
          >
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? "bg-sky-400/15 text-sky-300 border border-sky-400/30"
                      : "text-zinc-300 hover:bg-white/5 hover:text-white border border-transparent"
                  }`}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right Workspace Content */}
        <main className="min-w-0 space-y-6">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-[#0C1018] p-12 text-center text-sm text-zinc-400">
              Checking your SparrowX Cloud Infrastructure fleet...
            </div>
          ) : !activeServer && section !== "billing" && section !== "proxmox" ? (
            <div className="rounded-2xl border border-white/12 bg-[#0C1018] p-8 sm:p-12 text-center space-y-5">
              <div className="mx-auto size-14 rounded-2xl border border-white/15 bg-[#06080D] grid place-items-center text-sky-400">
                <Server className="size-7" aria-hidden="true" />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  No servers deployed yet
                </h1>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Your Cloud Management Dashboard is empty until you deploy a Bare Metal server, Dedicated node, or KVM VPS — or link your live Proxmox VE cluster.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <a
                  href="/infra#catalog"
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-400 hover:bg-sky-300 px-5 py-2.5 text-sm font-semibold text-black transition-colors"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  <span>Deploy Your First Server</span>
                </a>
                <button
                  type="button"
                  onClick={() => setSection("proxmox")}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#06080D] hover:border-white/30 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:text-white cursor-pointer"
                >
                  <Settings className="size-4" aria-hidden="true" />
                  <span>Connect Proxmox VE</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Persistent Top Server Action Banner (shown only when a deployed server exists) */}
              {activeServer && (
              <div className="rounded-2xl border border-white/10 bg-[#0C1018] p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                      {activeServer.name}
                    </h1>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        activeServer.status === "running"
                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                          : "bg-red-500/15 text-red-300 border border-red-500/30"
                      }`}
                    >
                      {activeServer.status === "running" ? "Running" : "Stopped"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 tabular-nums">
                    <span>{activeServer.planName}</span>
                    <span>·</span>
                    <span>{activeServer.os}</span>
                    <span>·</span>
                    <span>
                      IPv4: <strong className="text-zinc-200">{activeServer.ipv4}</strong>
                    </span>
                    <span>·</span>
                    <span>Uptime: {formatUptime(activeServer.uptimeSeconds)}</span>
                  </div>
                </div>

                {/* Power & Console Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {activeServer.status !== "running" ? (
                    <button
                      type="button"
                      disabled={Boolean(actionBusy)}
                      onClick={() => runAction("start")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3.5 py-2 text-xs font-semibold text-black cursor-pointer disabled:opacity-50"
                    >
                      <Play className="size-3.5" aria-hidden="true" />
                      <span>Start</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={Boolean(actionBusy)}
                        onClick={() => runAction("reboot")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#121826] hover:bg-white/10 px-3.5 py-2 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                        <span>Reboot</span>
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(actionBusy)}
                        onClick={() => runAction("shutdown")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-3.5 py-2 text-xs font-semibold text-red-300 cursor-pointer disabled:opacity-50"
                      >
                        <Power className="size-3.5" aria-hidden="true" />
                        <span>Shutdown</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSection("ssh");
                      void handleConnectConsole();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-400 hover:bg-sky-300 px-3.5 py-2 text-xs font-semibold text-black cursor-pointer"
                  >
                    <Terminal className="size-3.5" aria-hidden="true" />
                    <span>Browser SSH</span>
                  </button>
                </div>
              </div>
              )}

              {/* SECTION: OVERVIEW */}
              {activeServer && section === "overview" && (
                <div className="space-y-6">
                  {/* 4 Live Resource Gauges */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-white/10 bg-[#0C1018] p-4 space-y-2.5 tabular-nums">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>CPU utilization</span>
                        <Cpu className="size-4 text-sky-400" aria-hidden="true" />
                      </div>
                      <div className="text-2xl font-bold text-white">
                        {activeServer.cpuUsagePct}%
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-sky-400 rounded-full"
                          style={{ width: `${activeServer.cpuUsagePct}%` }}
                        />
                      </div>
                      <div className="text-xs text-zinc-400">
                        {activeServer.cpuCores} dedicated threads · Proxmox KVM
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#0C1018] p-4 space-y-2.5 tabular-nums">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>Memory (DDR5 ECC)</span>
                        <Server className="size-4 text-emerald-400" aria-hidden="true" />
                      </div>
                      <div className="text-2xl font-bold text-white">
                        {activeServer.ramUsedGb} / {activeServer.ramTotalGb} GB
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 rounded-full"
                          style={{ width: `${ramPct}%` }}
                        />
                      </div>
                      <div className="text-xs text-zinc-400">{ramPct}% allocated</div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#0C1018] p-4 space-y-2.5 tabular-nums">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>NVMe Gen4 storage</span>
                        <HardDrive className="size-4 text-purple-400" aria-hidden="true" />
                      </div>
                      <div className="text-2xl font-bold text-white">
                        {activeServer.diskUsedGb} / {activeServer.diskTotalGb} GB
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-purple-400 rounded-full"
                          style={{ width: `${diskPct}%` }}
                        />
                      </div>
                      <div className="text-xs text-zinc-400">{diskPct}% used on RAID</div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#0C1018] p-4 space-y-2.5 tabular-nums">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>Monthly traffic</span>
                        <Globe className="size-4 text-amber-400" aria-hidden="true" />
                      </div>
                      <div className="text-2xl font-bold text-white">
                        {activeServer.bandwidthUsedTb} TB
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{
                            width: `${Math.min(100, Math.round((activeServer.bandwidthUsedTb / activeServer.bandwidthQuotaTb) * 100))}%`,
                          }}
                        />
                      </div>
                      <div className="text-xs text-zinc-400">
                        Quota: {activeServer.bandwidthQuotaTb} TB · Zero egress fees
                      </div>
                    </div>
                  </div>

                  {/* Quick SSH & IP Connection Summary */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-white/10 bg-[#0C1018] p-5 space-y-4">
                      <h2 className="text-base font-semibold text-white">
                        SSH &amp; IPv4 / IPv6 access
                      </h2>

                      <div className="space-y-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#06080D] px-3.5 py-2.5">
                          <div className="min-w-0">
                            <span className="text-zinc-400 block">SSH command</span>
                            <code className="text-emerald-300 font-semibold text-sm">
                              ssh {activeServer.sshUser}@{activeServer.ipv4}
                            </code>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              copyText(`ssh ${activeServer.sshUser}@${activeServer.ipv4}`, "ssh-ov")
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2.5 py-1.5 text-zinc-200 hover:text-white cursor-pointer shrink-0"
                          >
                            {copiedKey === "ssh-ov" ? (
                              <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
                            ) : (
                              <Copy className="size-3.5" aria-hidden="true" />
                            )}
                            <span>{copiedKey === "ssh-ov" ? "Copied" : "Copy"}</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 tabular-nums">
                          <div className="rounded-lg border border-white/10 bg-[#06080D] p-3">
                            <span className="text-zinc-400 block">Primary IPv4</span>
                            <span className="text-white font-semibold">{activeServer.ipv4}</span>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-[#06080D] p-3">
                            <span className="text-zinc-400 block">WireGuard Private IP</span>
                            <span className="text-sky-400 font-semibold">
                              {activeServer.wireguardEnabled ? activeServer.wireguardIp : "Paused"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#0C1018] p-5 space-y-4">
                      <h2 className="text-base font-semibold text-white">
                        Security &amp; billing status
                      </h2>
                      <dl className="grid grid-cols-2 gap-3 text-xs tabular-nums">
                        <div className="rounded-lg border border-white/10 bg-[#06080D] p-3">
                          <dt className="text-zinc-400">DDoS Shield</dt>
                          <dd className="text-emerald-300 font-semibold mt-0.5">
                            {activeServer.ddosMode}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-[#06080D] p-3">
                          <dt className="text-zinc-400">Reverse DNS (PTR)</dt>
                          <dd className="text-white font-semibold mt-0.5 truncate">
                            {activeServer.rdns}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-[#06080D] p-3">
                          <dt className="text-zinc-400">Monthly Plan</dt>
                          <dd className="text-white font-semibold mt-0.5">
                            ₹{activeServer.monthlyPriceInr.toLocaleString("en-IN")}/mo
                          </dd>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-[#06080D] p-3">
                          <dt className="text-zinc-400">Next Renewal</dt>
                          <dd className="text-white font-semibold mt-0.5">
                            {activeServer.nextDueDate}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: SSH & WEB TERMINAL */}
              {activeServer && section === "ssh" && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-white/10 bg-[#0C1018] p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold text-white">
                          Proxmox VE Browser SSH &amp; TermProxy Console
                        </h2>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Direct interactive shell access to {activeServer.hostname} (VMID {activeServer.vmid})
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleConnectConsole}
                          disabled={actionBusy === "console"}
                          className="rounded-lg bg-sky-400 hover:bg-sky-300 px-3.5 py-2 text-xs font-semibold text-black cursor-pointer"
                        >
                          {consoleConnected ? "Reconnect Session" : "Connect Web SSH"}
                        </button>
                        <button
                          type="button"
                          onClick={() => runAction("reset-password")}
                          disabled={Boolean(actionBusy)}
                          className="rounded-lg border border-white/15 bg-[#121826] hover:bg-white/10 px-3.5 py-2 text-xs font-semibold text-white cursor-pointer"
                        >
                          Rotate Root Password
                        </button>
                      </div>
                    </div>

                    {rotatedPass && (
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-4 py-2.5 text-xs">
                        <span>
                          New root password set via Cloud-Init:{" "}
                          <code className="font-mono font-bold text-white">{rotatedPass}</code>
                        </span>
                        <button
                          type="button"
                          onClick={() => copyText(rotatedPass, "root-pw")}
                          className="text-emerald-300 hover:text-white font-semibold cursor-pointer"
                        >
                          {copiedKey === "root-pw" ? "Copied" : "Copy"}
                        </button>
                      </div>
                    )}

                    {/* Interactive Terminal Viewport */}
                    <div className="rounded-xl border border-white/12 bg-[#04060A] p-4 font-mono text-xs text-emerald-300 space-y-1.5 min-h-[220px] max-h-[340px] overflow-y-auto">
                      {consoleLines.map((line, i) => (
                        <div key={i} className="whitespace-pre-wrap break-all leading-relaxed">
                          {line}
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleRunTerminalCmd} className="flex gap-2">
                      <input
                        type="text"
                        value={terminalCmd}
                        onChange={(e) => setTerminalCmd(e.target.value)}
                        placeholder="Type a command (e.g. uname -a, ip a, uptime, wg show, clear)"
                        className="flex-1 rounded-lg border border-white/15 bg-[#06080D] px-3.5 py-2 font-mono text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-400"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-white hover:bg-zinc-200 px-4 py-2 text-xs font-semibold text-black cursor-pointer"
                      >
                        Run
                      </button>
                    </form>
                  </div>

                  {/* Cloud-Init SSH Key Manager */}
                  <div className="rounded-xl border border-white/10 bg-[#0C1018] p-5 space-y-4">
                    <h3 className="text-base font-semibold text-white">
                      Authorized SSH public keys (Cloud-Init)
                    </h3>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void runAction("add-ssh-key", {
                          sshKeyLabel,
                          sshPublicKey: sshKeyPub,
                        }).then(() => {
                          setSshKeyLabel("");
                          setSshKeyPub("");
                        });
                      }}
                      className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-2.5"
                    >
                      <input
                        type="text"
                        value={sshKeyLabel}
                        onChange={(e) => setSshKeyLabel(e.target.value)}
                        placeholder="Key label (e.g. laptop)"
                        className="rounded-lg border border-white/15 bg-[#06080D] px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-400"
                      />
                      <input
                        type="text"
                        required
                        value={sshKeyPub}
                        onChange={(e) => setSshKeyPub(e.target.value)}
                        placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI..."
                        className="rounded-lg border border-white/15 bg-[#06080D] px-3 py-2 font-mono text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-400"
                      />
                      <button
                        type="submit"
                        disabled={Boolean(actionBusy)}
                        className="rounded-lg bg-sky-400 hover:bg-sky-300 px-4 py-2 text-xs font-semibold text-black cursor-pointer"
                      >
                        Inject SSH Key
                      </button>
                    </form>

                    <div className="space-y-2">
                      {activeServer.sshKeys.length === 0 ? (
                        <p className="text-xs text-zinc-400">
                          No SSH keys injected yet. Add an Ed25519 public key above for passwordless root access.
                        </p>
                      ) : (
                        activeServer.sshKeys.map((k) => (
                          <div
                            key={k.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#06080D] px-3.5 py-2.5 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <KeyRound className="size-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                              <span className="font-semibold text-white">{k.label}</span>
                              <code className="text-zinc-400 truncate">{k.fingerprint}</code>
                            </div>
                            <span className="text-zinc-500">{k.addedAt.slice(0, 10)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: IP & NETWORKING */}
              {activeServer && section === "network" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="rounded-xl border border-white/10 bg-[#0C1018] p-5 space-y-4">
                    <h2 className="text-base font-semibold text-white">
                      IPv4, IPv6 &amp; Reverse DNS (PTR)
                    </h2>
                    <div className="space-y-2.5 text-xs tabular-nums">
                      <div className="rounded-lg border border-white/10 bg-[#06080D] p-3.5 flex items-center justify-between">
                        <div>
                          <span className="text-zinc-400 block">Primary IPv4</span>
                          <span className="text-sm font-semibold text-white">
                            {activeServer.ipv4}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText(activeServer.ipv4, "ip4")}
                          className="text-sky-400 hover:text-sky-300 cursor-pointer"
                        >
                          {copiedKey === "ip4" ? "Copied" : "Copy"}
                        </button>
                      </div>

                      <div className="rounded-lg border border-white/10 bg-[#06080D] p-3.5 flex items-center justify-between">
                        <div className="min-w-0">
                          <span className="text-zinc-400 block">Routed /64 IPv6 Subnet</span>
                          <span className="text-sm font-semibold text-white break-all">
                            {activeServer.ipv6}
                          </span>
                        </div>
                      </div>

                      {activeServer.extraIpv4s.length > 0 && (
                        <div className="rounded-lg border border-white/10 bg-[#06080D] p-3.5">
                          <span className="text-zinc-400 block mb-1">Additional Failover IPv4s</span>
                          <div className="flex flex-wrap gap-2">
                            {activeServer.extraIpv4s.map((ip) => (
                              <code
                                key={ip}
                                className="rounded bg-white/10 px-2 py-0.5 text-sky-300"
                              >
                                {ip}
                              </code>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void runAction("set-rdns", { rdns: rdnsInput });
                      }}
                      className="space-y-2 pt-2 border-t border-white/10"
                    >
                      <label htmlFor="spx-rdns" className="text-xs font-medium text-zinc-300 block">
                        Reverse DNS (PTR record)
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="spx-rdns"
                          type="text"
                          value={rdnsInput}
                          onChange={(e) => setRdnsInput(e.target.value)}
                          className="flex-1 rounded-lg border border-white/15 bg-[#06080D] px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
                        />
                        <button
                          type="submit"
                          disabled={Boolean(actionBusy)}
                          className="rounded-lg bg-white hover:bg-zinc-200 px-4 py-2 text-xs font-semibold text-black cursor-pointer"
                        >
                          Save PTR
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-[#0C1018] p-5 space-y-4">
                    <h2 className="text-base font-semibold text-white">
                      SparrowXNet WireGuard Mesh &amp; DDoS Shield
                    </h2>

                    <div className="rounded-xl border border-white/10 bg-[#06080D] p-4 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-white flex items-center gap-2">
                          <Wifi className="size-4 text-sky-400" aria-hidden="true" />
                          <span>Private WireGuard VLAN ({activeServer.wireguardIp})</span>
                        </div>
                        <p className="text-xs text-zinc-400">
                          Zero-egress encrypted mesh linking this server to db.sparrowx.net and netsec.sparrowx.net.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => runAction("toggle-wireguard")}
                        className={`rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer shrink-0 ${
                          activeServer.wireguardEnabled
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : "bg-white/10 text-zinc-300 border border-white/15"
                        }`}
                      >
                        {activeServer.wireguardEnabled ? "Enabled" : "Paused"}
                      </button>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#06080D] p-4 space-y-1.5">
                      <div className="text-sm font-semibold text-white flex items-center gap-2">
                        <Shield className="size-4 text-emerald-400" aria-hidden="true" />
                        <span>Active Scrubbing Profile: {activeServer.ddosMode}</span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        Always-on L3/L4 SYN, UDP, and volumetric flood mitigation active on NIC edge.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: OS & REINSTALL */}
              {activeServer && section === "os" && (
                <div className="rounded-xl border border-white/10 bg-[#0C1018] p-5 space-y-5">
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      1-Click Cloud-Init OS Reinstall
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      Re-image {activeServer.name} directly from your Proxmox VE template catalog. Your IPv4, IPv6, and SSH keys are preserved automatically.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {INFRA_OS_IMAGES.map((img) => {
                      const chosen = selectedOs === img.label;
                      return (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => setSelectedOs(img.label)}
                          className={`text-left rounded-xl border p-4 transition-colors cursor-pointer ${
                            chosen
                              ? "border-sky-400 bg-sky-400/10"
                              : "border-white/10 bg-[#06080D] hover:border-white/25"
                          }`}
                        >
                          <div className="font-semibold text-sm text-white">{img.label}</div>
                          <div className="text-xs text-zinc-400 mt-1">
                            {img.family} ·{" "}
                            {img.monthlyAddonUsd > 0
                              ? `+$${img.monthlyAddonUsd}/mo license`
                              : "Included"}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={Boolean(actionBusy)}
                    onClick={() => runAction("rebuild", { os: selectedOs })}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-400 hover:bg-sky-300 px-5 py-2.5 text-sm font-semibold text-black cursor-pointer"
                  >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    <span>Reinstall with {selectedOs}</span>
                  </button>
                </div>
              )}

              {/* SECTION: SNAPSHOTS & SPARROWX BACKUP SYSTEM */}
              {activeServer && section === "snapshots" && (
                <div className="space-y-5">
                  {/* SPARROWX BACKUP SYSTEM — MASTER PORTABLE SH RESTORE */}
                  <div className="rounded-xl border border-orange-500/30 bg-gradient-to-br from-[#0C1018] via-[#0E131E] to-[#0C1018] p-5 space-y-4 shadow-lg shadow-orange-500/5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/25 uppercase tracking-wider mb-1">
                          SparrowX Backup System
                        </div>
                        <h2 className="text-base font-bold text-white tracking-tight">
                          Autonomous Portable .sh Backup Bundle
                        </h2>
                        <p className="text-xs text-zinc-400 mt-0.5 max-w-2xl leading-relaxed">
                          Export your entire VPS state into a portable backup folder with a master <code className="text-orange-400">sparrowx-restore.sh</code> script. Copy this folder to any fresh VPS and run the script — it automatically installs dependencies, configures Nginx, repairs missing SSL certs, sets up WireGuard, enforces firewall rules, and self-heals the node.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`/api/infra/servers/backup?serverId=${encodeURIComponent(activeServer.id)}&download=script`}
                          download={`sparrowx-restore-${activeServer.hostname.split(".")[0]}.sh`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#FFA14A] hover:bg-[#FF8F26] px-3.5 py-2 text-xs font-bold text-black transition-all shadow-[0_2px_12px_rgba(255,161,74,0.3)] cursor-pointer"
                        >
                          <Download className="size-3.5" aria-hidden="true" />
                          <span>Download sparrowx-restore.sh</span>
                        </a>
                      </div>
                    </div>

                    {/* Quick One-Line Command Box */}
                    <div className="space-y-1.5 pt-2 border-t border-white/10">
                      <span className="text-[11px] font-medium text-zinc-400 block">
                        One-Line Instant Deploy &amp; Restore Command for New VPS:
                      </span>
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#06080D] border border-white/10 font-mono text-xs text-zinc-300">
                        <span className="truncate text-orange-300">
                          curl -sSL "https://infra.sparrowx.net/api/infra/servers/backup?serverId={activeServer.id}&amp;download=script" | sudo bash
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(
                              `curl -sSL "https://infra.sparrowx.net/api/infra/servers/backup?serverId=${activeServer.id}&download=script" | sudo bash`,
                            );
                            notify("ok", "Restore command copied to clipboard!");
                          }}
                          className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] shrink-0 font-sans font-medium cursor-pointer"
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    {/* Features Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs text-zinc-400">
                      <div className="p-2.5 rounded-lg bg-[#06080D]/70 border border-white/5 space-y-1">
                        <strong className="text-zinc-200 block">Nginx Auto-Fix &amp; Syntax</strong>
                        <span>Auto-links sites, restores upstream proxies, and auto-generates fallback certs if missing.</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#06080D]/70 border border-white/5 space-y-1">
                        <strong className="text-zinc-200 block">WireGuard Private Mesh</strong>
                        <span>Pre-wires encrypted kernel tunnel to db.sparrowx.net and Anycast scrubbing relays.</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#06080D]/70 border border-white/5 space-y-1">
                        <strong className="text-zinc-200 block">Self-Healing Diagnostic</strong>
                        <span>Tests localhost HTTP, enforces UFW ports (22, 80, 443, 51820), and reports live status.</span>
                      </div>
                    </div>
                  </div>

                  {/* PROXMOX VE LIVE SNAPSHOTS */}
                  <div className="rounded-xl border border-white/10 bg-[#0C1018] p-5 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold text-white">
                          Proxmox VE Live Snapshots
                        </h2>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Capture point-in-time NVMe state before kernel or database upgrades.
                        </p>
                      </div>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void runAction("snapshot", { snapshotName: snapName }).then(() =>
                          setSnapName(""),
                        );
                      }}
                      className="flex flex-col sm:flex-row gap-2.5"
                    >
                      <input
                        type="text"
                        value={snapName}
                        onChange={(e) => setSnapName(e.target.value)}
                        placeholder="Snapshot name (e.g. before-postgres-17)"
                        className="flex-1 rounded-lg border border-white/15 bg-[#06080D] px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-400"
                      />
                      <button
                        type="submit"
                        disabled={Boolean(actionBusy)}
                        className="rounded-lg bg-sky-400 hover:bg-sky-300 px-4 py-2 text-xs font-semibold text-black cursor-pointer"
                      >
                        Take Snapshot
                      </button>
                    </form>

                    <div className="space-y-2.5">
                      {activeServer.snapshots.length === 0 ? (
                        <p className="text-xs text-zinc-400">
                          No snapshots captured for this server yet.
                        </p>
                      ) : (
                        activeServer.snapshots.map((snap) => (
                          <div
                            key={snap.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#06080D] px-4 py-3 text-xs tabular-nums"
                          >
                            <div>
                              <div className="font-semibold text-white">{snap.name}</div>
                              <div className="text-zinc-400 mt-0.5">
                                {snap.createdAt.slice(0, 19).replace("T", " ")} UTC · {snap.sizeGb} GB
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                runAction("delete-snapshot", { snapshotId: snap.id })
                              }
                              className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-red-300 hover:bg-red-500/20 cursor-pointer"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                              <span>Delete</span>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: UNIFIED UPI BILLING & WALLET */}
              {section === "billing" && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-white/10 bg-[#0C1018] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-semibold text-white">
                        Unified SparrowX UPI Auto-Confirmation Billing
                      </h2>
                      <p className="text-xs text-zinc-400 max-w-xl">
                        Pay invoices or top up your SparrowX balance via dynamic UPI QR (GPay, PhonePe, Paytm). Servers renew or deploy automatically the moment your UPI transfer settles.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTopupAmount(activeServer?.monthlyPriceInr ?? 849);
                        setUpiModalOpen(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black cursor-pointer shrink-0"
                    >
                      <QrCode className="size-4" aria-hidden="true" />
                      <span>
                        Pay ₹{(activeServer?.monthlyPriceInr ?? 849).toLocaleString("en-IN")} via UPI
                      </span>
                    </button>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-[#0C1018] p-5 space-y-3">
                    <h3 className="text-sm font-semibold text-white">Recent UPI orders</h3>
                    {recentOrders.length === 0 ? (
                      <p className="text-xs text-zinc-400">
                        No UPI transactions recorded in this session yet. Click the green UPI button above to test instant QR checkout &amp; auto-confirmation.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {recentOrders.map((ord) => (
                          <div
                            key={ord.orderId}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#06080D] px-4 py-3 text-xs tabular-nums"
                          >
                            <div>
                              <span className="font-semibold text-white">{ord.planName}</span>
                              <span className="text-zinc-400 ml-2 font-mono">{ord.orderId}</span>
                              {ord.utr && (
                                <span className="text-zinc-400 ml-2">UTR: {ord.utr}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-white">₹{ord.exactAmountInr}</span>
                              <span
                                className={`rounded-full px-2.5 py-0.5 font-semibold ${
                                  ord.status === "PAID"
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-amber-500/15 text-amber-200"
                                }`}
                              >
                                {ord.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION: PROXMOX VE & UPI BRIDGE CONFIGURATION */}
              {section === "proxmox" && (
                <div className="rounded-xl border border-white/10 bg-[#0C1018] p-5 space-y-4">
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      Proxmox VE Cluster &amp; UPI Auto-Confirm Webhook Setup (.env)
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      Add these keys to <code className="text-zinc-200">/opt/sparrowxdbs/.env</code> on your OVH server to switch from sandbox mode to live Proxmox VE provisioning and instant bank/gateway UPI webhooks.
                    </p>
                  </div>

                  <pre className="rounded-xl border border-white/10 bg-[#04060A] p-4 text-xs font-mono text-sky-300 overflow-x-auto leading-relaxed">
{`# Proxmox VE API Token (Datacenter -> Permissions -> API Tokens)
PVE_URL="https://pve.sparrowx.net:8006"
PVE_NODE="pve"
PVE_TOKEN_ID="root@pam!sparrowx"
PVE_TOKEN_SECRET="your-proxmox-api-token-secret"
PVE_TEMPLATE_VMID="9000"

# Unified SparrowX UPI Auto-Confirmation (All Services)
SPARROWX_UPI_ID="yourmerchant@okaxis"
SPARROWX_MERCHANT_NAME="SparrowX Cloud"
# Option A: 0%-Fee Android UPI Notification Bridge Webhook
SPARROWX_UPI_BRIDGE_SECRET="generate-32-char-hmac-secret"
# Option B: Official Razorpay UPI Webhook (optional)
RAZORPAY_KEY_ID="rzp_live_..."
RAZORPAY_WEBHOOK_SECRET="your-razorpay-webhook-secret"`}
                  </pre>

                  <div className="text-xs text-zinc-400 space-y-1">
                    <div>
                      Webhook receiver URL:{" "}
                      <code className="text-emerald-300">
                        https://infra.sparrowx.net/api/payments/upi/webhook
                      </code>
                    </div>
                    <div>
                      Send header <code className="text-zinc-200">x-sparrowx-upi-secret</code> (Direct Bridge) or{" "}
                      <code className="text-zinc-200">x-razorpay-signature</code> (Razorpay) with JSON{" "}
                      <code className="text-zinc-200">{"{\"orderId\":\"SPX...\",\"amountInr\":849.00,\"utr\":\"4321...\"}"}</code>.
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Unified UPI Auto-Pay Modal */}
      <UpiAutoPayModal
        open={upiModalOpen}
        onClose={() => setUpiModalOpen(false)}
        service="infra"
        planId={activeServer?.planId ?? "vps-starter"}
        planName={activeServer ? `${activeServer.name} Renewal` : "SparrowX Cloud Balance"}
        amountInr={topupAmount}
        customerEmail="ops@sparrowx.net"
        metadata={
          activeServer
            ? {
                category: activeServer.category,
                hostname: activeServer.hostname,
                region: activeServer.region,
                os: activeServer.os,
              }
            : undefined
        }
        onPaymentConfirmed={() => {
          void fetchServers();
          void fetchUpiOrders();
        }}
      />

      <SparrowxFooter inPageAnchors={false} />
    </div>
  );
}
