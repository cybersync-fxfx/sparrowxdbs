import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarPlus,
  CreditCard,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  ShieldOff,
  Sliders,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SparrowxCoinIcon } from "@/components/SparrowxCoinVisuals";
import {
  adminAdjustCoins,
  adminAssignSubscription,
  adminSetUserAdminRole,
  adminUpdateSubscription,
  getAdminOverview,
} from "@/lib/portal.functions";
import { EGG_RESOURCE_PROFILES } from "@/lib/egg-smart-plans";
import { formatRam } from "@/lib/services";
import type {
  AdminClientSummary,
  AdminOverviewData,
  AdminSubscriptionSummary,
  Subscription,
} from "@/lib/portal-types";
import { cn } from "@/lib/utils";
import { errorText, useRefreshAll } from "./hooks";

type AdminTab = "users" | "subscriptions" | "ledger";

const ALL_ADMIN_PLAN_GROUPS = Object.values(EGG_RESOURCE_PROFILES).map((profile) => ({
  groupLabel: `${profile.label} (${profile.ramRangeLabel})`,
  plans: profile.plans,
}));

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function toDateInputValue(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function AdminNativeDialog({
  open,
  titleId,
  maxWidthClass = "max-w-lg",
  onClose,
  children,
}: {
  open: boolean;
  titleId: string;
  maxWidthClass?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
    } else if (!open && el.open) {
      if (typeof el.close === "function") el.close();
      else el.removeAttribute("open");
    }
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !open) return;
    const onNativeClose = () => {
      el.returnValue = "";
      onClose();
    };
    el.addEventListener("close", onNativeClose);
    return () => el.removeEventListener("close", onNativeClose);
  }, [open, onClose]);

  if (!open) return null;

  const closedByProps = { closedby: "any" } as Record<string, string>;
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={cn("spx-native-dialog theme-dashboard", maxWidthClass)}
      {...closedByProps}
    >
      <div className="max-h-[88dvh] overflow-y-auto p-6 space-y-4">{children}</div>
    </dialog>
  );
}

export function AdminControlPanel() {
  const qc = useQueryClient();
  const refreshAll = useRefreshAll();
  const baseId = useId();

  const [tab, setTab] = useState<AdminTab>("users");
  const [userSearch, setUserSearch] = useState("");
  const [subSearch, setSubSearch] = useState("");
  const [subStatusFilter, setSubStatusFilter] = useState<"all" | Subscription["status"]>("all");

  // Coin Manager Modal state
  const [coinTarget, setCoinTarget] = useState<AdminClientSummary | null>(null);
  const [coinMode, setCoinMode] = useState<"add" | "deduct" | "set">("add");
  const [coinAmount, setCoinAmount] = useState("500");
  const [coinNote, setCoinNote] = useState("");

  // Grant Subscription Modal state
  const [grantTarget, setGrantTarget] = useState<AdminClientSummary | null>(null);
  const [grantPlanId, setGrantPlanId] = useState("smart-mc-java-2");
  const [grantDays, setGrantDays] = useState("30");
  const [grantPrice, setGrantPrice] = useState("");
  const [grantCustomName, setGrantCustomName] = useState("");

  // Edit Subscription / Plan Modal state
  const [editSub, setEditSub] = useState<AdminSubscriptionSummary | null>(null);
  const [editPlanId, setEditPlanId] = useState("");
  const [editPlanName, setEditPlanName] = useState("");
  const [editPriceCoins, setEditPriceCoins] = useState("");
  const [editStatus, setEditStatus] = useState<Subscription["status"]>("active");
  const [editExpiryDate, setEditExpiryDate] = useState("");
  const [syncPanelLimits, setSyncPanelLimits] = useState(true);
  const [syncPanelStatus, setSyncPanelStatus] = useState(true);

  const { data, isLoading, isFetching, error, refetch } = useQuery<AdminOverviewData>({
    queryKey: ["admin-overview"],
    queryFn: () => getAdminOverview(),
    staleTime: 15_000,
  });

  const invalidateAdmin = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ["admin-overview"] }), refreshAll()]);
  };

  const coinsMutation = useMutation({
    mutationFn: () => {
      if (!coinTarget) throw new Error("No client selected");
      const num = Math.max(0, Math.floor(Number(coinAmount)));
      if (!Number.isFinite(num)) throw new Error("Enter a valid whole number of coins");
      return adminAdjustCoins({
        data: {
          clientId: coinTarget.id,
          mode: coinMode,
          amount: num,
          note: coinNote.trim() || undefined,
        },
      });
    },
    onSuccess: async (res) => {
      await invalidateAdmin();
      toast.success(`Updated coins for ${res.email ?? "client"}`, {
        description: `${res.previousCoins.toLocaleString("en-IN")} → ${res.newCoins.toLocaleString("en-IN")} SparrowCoins`,
      });
      setCoinTarget(null);
      setCoinNote("");
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const grantMutation = useMutation({
    mutationFn: () => {
      if (!grantTarget) throw new Error("No client selected");
      const days = Math.max(1, Math.min(730, Math.floor(Number(grantDays) || 30)));
      const customPrice = grantPrice.trim() ? Math.max(0, Math.floor(Number(grantPrice))) : undefined;
      return adminAssignSubscription({
        data: {
          clientId: grantTarget.id,
          planId: grantPlanId,
          days,
          ...(grantCustomName.trim() ? { customPlanName: grantCustomName.trim() } : {}),
          ...(customPrice !== undefined && Number.isFinite(customPrice) ? { customPriceCoins: customPrice } : {}),
        },
      });
    },
    onSuccess: async (res) => {
      await invalidateAdmin();
      toast.success(`Assigned ${res.subscription.planName}`, {
        description: `Active until ${fmtDate(res.subscription.expiresAt)}`,
      });
      setGrantTarget(null);
      setGrantCustomName("");
      setGrantPrice("");
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const updateSubMutation = useMutation({
    mutationFn: (payload: Parameters<typeof adminUpdateSubscription>[0]["data"]) =>
      adminUpdateSubscription({ data: payload }),
    onSuccess: async (res) => {
      await invalidateAdmin();
      const notes: string[] = [];
      if (res.panelSyncedLimits) notes.push("Panel RAM/CPU/Disk resized");
      if (res.panelSyncedStatus) notes.push("Panel suspend/unsuspend synced");
      if (res.panelWarning) notes.push(`Panel note: ${res.panelWarning}`);
      toast.success(`Subscription ${res.subscription.planName} saved`, {
        description: notes.join(" · ") || `Status: ${res.subscription.status} · Expires ${fmtDate(res.subscription.expiresAt)}`,
      });
      setEditSub(null);
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const adminRoleMutation = useMutation({
    mutationFn: (payload: { clientId: string; makeAdmin: boolean }) =>
      adminSetUserAdminRole({ data: payload }),
    onSuccess: async (res) => {
      await invalidateAdmin();
      toast.success(
        res.isAdmin ? `Appointed ${res.email} as Admin` : `Revoked Admin access for ${res.email}`,
        {
          description: res.isAdmin
            ? "They can now access the Admin Control Panel and manage users."
            : "Account reverted to standard client permissions.",
        },
      );
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const filteredClients = useMemo(() => {
    const list = data?.clients ?? [];
    const q = userSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        (c.email ?? "").toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q) ||
        (c.pteroUsername ?? "").toLowerCase().includes(q) ||
        String(c.pteroUserId ?? "").includes(q),
    );
  }, [data?.clients, userSearch]);

  const filteredSubs = useMemo(() => {
    const list = data?.subscriptions ?? [];
    const q = subSearch.trim().toLowerCase();
    return list.filter((s) => {
      if (subStatusFilter !== "all" && s.status !== subStatusFilter) return false;
      if (!q) return true;
      return (
        (s.clientEmail ?? "").toLowerCase().includes(q) ||
        s.clientUsername.toLowerCase().includes(q) ||
        s.planName.toLowerCase().includes(q) ||
        String(s.pteroServerId ?? "").includes(q)
      );
    });
  }, [data?.subscriptions, subSearch, subStatusFilter]);

  const openEditSubscription = (sub: AdminSubscriptionSummary) => {
    setEditSub(sub);
    setEditPlanId("");
    setEditPlanName(sub.planName);
    setEditPriceCoins(String(sub.priceCoins));
    setEditStatus(sub.status);
    setEditExpiryDate(toDateInputValue(sub.expiresAt));
    setSyncPanelLimits(true);
    setSyncPanelStatus(true);
  };

  if (isLoading) {
    return (
      <section className="surface-3d rounded-3xl p-8 flex items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin text-emerald-400" />
        <span>Loading SparrowX Admin Control Panel…</span>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="surface-3d rounded-3xl border border-rose-500/40 p-6 space-y-3">
        <p className="text-sm font-semibold text-rose-300">Unable to load Admin Console</p>
        <p className="text-xs text-muted-foreground">{error ? errorText(error) : "No data returned."}</p>
        <Button type="button" size="sm" variant="secondary" onClick={() => void refetch()}>
          <RefreshCw className="size-3.5" /> Retry
        </Button>
      </section>
    );
  }

  return (
    <section aria-label="SparrowX Game Admin Control Panel" className="surface-3d rim-sheen rounded-3xl p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/45 bg-emerald-500/15 px-3 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-200">
            <ShieldCheck className="size-3" aria-hidden="true" />
            <span>Super Admin · {data.adminEmail}</span>
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">
            Client Area Admin Control Plane
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage registered client accounts, adjust SparrowCoins wallets, edit or extend subscriptions, and resize plans live in Pterodactyl Panel.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="rounded-xl self-start sm:self-auto"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
          <span>{isFetching ? "Refreshing…" : "Refresh Live Data"}</span>
        </Button>
      </div>

      {/* Live Admin KPI Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total Clients", value: data.stats.totalClients.toLocaleString("en-IN"), icon: Users, accent: "text-sky-300" },
          { label: "Wallet Coins Supply", value: `${data.stats.totalCoins.toLocaleString("en-IN")} coins`, icon: SparrowxCoinIcon, accent: "text-[#C7D2FE]" },
          { label: "Active Subscriptions", value: `${data.stats.activeSubscriptions} active / ${data.stats.expiredSubscriptions} inactive`, icon: Server, accent: "text-amber-300" },
          { label: "Active Plan Volume", value: `₹${data.stats.monthlyCoinVolume.toLocaleString("en-IN")}/mo`, icon: CreditCard, accent: "text-white" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-2xl border border-border bg-[#05060a] p-4">
              <div className="flex items-center justify-between gap-2 text-muted-foreground">
                <span className="text-[11px] font-medium">{kpi.label}</span>
                <Icon className={`size-4 ${kpi.accent}`} aria-hidden="true" />
              </div>
              <p className={`mt-2 font-display text-lg font-bold tabular-nums ${kpi.accent}`}>{kpi.value}</p>
            </div>
          );
        })}
      </div>

      {/* Accessible Single-Row Tablist */}
      <div role="tablist" aria-label="Admin management views" className="spx-tablist gap-1 border-b border-border">
        {(
          [
            { id: "users" as const, label: `Users & Coins (${data.clients.length})`, icon: Users },
            { id: "subscriptions" as const, label: `Subscriptions & Plans (${data.subscriptions.length})`, icon: Sliders },
            { id: "ledger" as const, label: `Coin Audit Log (${data.recentTransactions.length})`, icon: History },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              id={`${baseId}-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                selected ? "text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: USERS & COINS */}
      <div role="tabpanel" aria-labelledby={`${baseId}-tab-users`} hidden={tab !== "users"} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="search" className="relative flex-1 min-w-[240px] max-w-md">
            <label htmlFor={`${baseId}-user-search`} className="sr-only">
              Search users by email or username
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
            <input
              id={`${baseId}-user-search`}
              type="search"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search user email, name, or Panel username…"
              className="h-10 w-full rounded-xl border border-border bg-[#05060a] pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            Showing {filteredClients.length} of {data.clients.length} clients
          </span>
        </div>

        <div tabIndex={0} role="region" aria-labelledby={`${baseId}-users-caption`} className="spx-admin-table-wrap">
          <table className="spx-admin-table">
            <caption id={`${baseId}-users-caption`} className="sr-only">
              Registered SparrowX Game Hosting clients and wallet balances
            </caption>
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-4 py-3">Client Account</th>
                <th scope="col" className="px-4 py-3">Panel Link</th>
                <th scope="col" className="px-4 py-3">SparrowCoins</th>
                <th scope="col" className="px-4 py-3">Subscriptions</th>
                <th scope="col" className="px-4 py-3">Joined</th>
                <th scope="col" className="px-4 py-3 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No client accounts matched your search.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-white/[0.02]">
                    <th scope="row" className="px-4 py-3 font-normal">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-foreground">{client.email ?? client.username}</span>
                        {client.isPrimaryAdmin ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/45 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-200">
                            <ShieldCheck className="size-3" aria-hidden="true" />
                            Primary Admin
                          </span>
                        ) : client.isAdmin ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/45 bg-sky-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-sky-200">
                            <ShieldCheck className="size-3" aria-hidden="true" />
                            Admin
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{client.username}</div>
                    </th>
                    <td data-label="Panel" className="px-4 py-3 font-mono text-xs text-secondary-foreground">
                      {client.pteroUsername ? `${client.pteroUsername} (#${client.pteroUserId})` : "Not linked"}
                    </td>
                    <td data-label="Coins" className="px-4 py-3 font-mono font-bold tabular-nums text-emerald-300">
                      {client.coins.toLocaleString("en-IN")}
                    </td>
                    <td data-label="Plans" className="px-4 py-3 font-mono text-xs text-secondary-foreground">
                      {client.activeSubscriptions} active / {client.subscriptionCount} total
                    </td>
                    <td data-label="Joined" className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {fmtDate(client.createdAt)}
                    </td>
                    <td data-label="Actions" className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {!client.isPrimaryAdmin && client.email ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={adminRoleMutation.isPending}
                            className={cn(
                              "h-8 rounded-lg px-2.5 text-xs border",
                              client.isAdmin
                                ? "border-rose-500/35 text-rose-200 hover:bg-rose-500/15"
                                : "border-amber-500/35 text-amber-200 hover:bg-amber-500/15",
                            )}
                            onClick={() =>
                              adminRoleMutation.mutate({
                                clientId: client.id,
                                makeAdmin: !client.isAdmin,
                              })
                            }
                          >
                            {client.isAdmin ? (
                              <>
                                <ShieldOff className="size-3.5" aria-hidden="true" />
                                <span>Revoke Admin</span>
                              </>
                            ) : (
                              <>
                                <UserPlus className="size-3.5" aria-hidden="true" />
                                <span>Make Admin</span>
                              </>
                            )}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8 rounded-lg px-2.5 text-xs border border-emerald-500/35 text-emerald-200 hover:bg-emerald-500/15"
                          onClick={() => {
                            setCoinTarget(client);
                            setCoinMode("add");
                            setCoinAmount("500");
                            setCoinNote("");
                          }}
                        >
                          <SparrowxCoinIcon className="size-4" />
                          <span>Coins</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8 rounded-lg px-2.5 text-xs border border-sky-500/35 text-sky-200 hover:bg-sky-500/15"
                          onClick={() => {
                            setGrantTarget(client);
                            setGrantPlanId("smart-mc-java-2");
                            setGrantDays("30");
                            setGrantPrice("");
                            setGrantCustomName("");
                          }}
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                          <span>Assign Plan</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TAB 2: SUBSCRIPTIONS & PLANS */}
      <div role="tabpanel" aria-labelledby={`${baseId}-tab-subscriptions`} hidden={tab !== "subscriptions"} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="search" className="relative flex-1 min-w-[240px] max-w-md">
            <label htmlFor={`${baseId}-sub-search`} className="sr-only">
              Search subscriptions by user email, plan name, or server ID
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
            <input
              id={`${baseId}-sub-search`}
              type="search"
              value={subSearch}
              onChange={(e) => setSubSearch(e.target.value)}
              placeholder="Search user email, plan name, or Server #ID…"
              className="h-10 w-full rounded-xl border border-border bg-[#05060a] pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", "active", "expired", "cancelled"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSubStatusFilter(st)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  subStatusFilter === st
                    ? "border-emerald-400 bg-emerald-500/15 text-emerald-200"
                    : "border-border bg-[#05060a] text-muted-foreground hover:text-white",
                )}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div tabIndex={0} role="region" aria-labelledby={`${baseId}-subs-caption`} className="spx-admin-table-wrap">
          <table className="spx-admin-table">
            <caption id={`${baseId}-subs-caption`} className="sr-only">
              All client server subscriptions and assigned plans
            </caption>
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-4 py-3">Client</th>
                <th scope="col" className="px-4 py-3">Plan &amp; Server</th>
                <th scope="col" className="px-4 py-3">Renewal Price</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Expires</th>
                <th scope="col" className="px-4 py-3 text-right">Plan Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {filteredSubs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No subscriptions matched your filter.
                  </td>
                </tr>
              ) : (
                filteredSubs.map((sub) => (
                  <tr key={sub.id} className="hover:bg-white/[0.02]">
                    <th scope="row" className="px-4 py-3 font-normal">
                      <div className="font-semibold text-foreground">{sub.clientEmail ?? sub.clientUsername}</div>
                      <div className="text-[11px] text-muted-foreground">{sub.clientUsername}</div>
                    </th>
                    <td data-label="Plan" className="px-4 py-3">
                      <div className="font-semibold text-white">{sub.planName}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {sub.serviceType.toUpperCase()} · {sub.pteroServerId ? `Panel Server #${sub.pteroServerId}` : "No linked container"}
                      </div>
                    </td>
                    <td data-label="Price" className="px-4 py-3 font-mono font-semibold tabular-nums text-emerald-300">
                      {sub.priceCoins} coins
                    </td>
                    <td data-label="Status" className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase",
                          sub.status === "active"
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/35"
                            : sub.status === "expired"
                              ? "bg-amber-500/15 text-amber-300 border border-amber-500/35"
                              : "bg-rose-500/15 text-rose-300 border border-rose-500/35",
                        )}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td data-label="Expires" className="px-4 py-3 font-mono text-xs text-secondary-foreground">
                      {fmtDate(sub.expiresAt)}
                    </td>
                    <td data-label="Actions" className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8 rounded-lg px-2.5 text-xs text-emerald-200 border border-emerald-500/35 hover:bg-emerald-500/15"
                          disabled={updateSubMutation.isPending}
                          onClick={() =>
                            updateSubMutation.mutate({
                              subscriptionId: sub.id,
                              extendDays: 30,
                              status: "active",
                              syncPanelStatus: true,
                            })
                          }
                        >
                          <CalendarPlus className="size-3.5" aria-hidden="true" />
                          <span>+30d</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="discord"
                          className="h-8 rounded-lg px-3 text-xs"
                          onClick={() => openEditSubscription(sub)}
                        >
                          <Sliders className="size-3.5" aria-hidden="true" />
                          <span>Edit Plan / Sub</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TAB 3: RECENT COIN AUDIT LOG */}
      <div role="tabpanel" aria-labelledby={`${baseId}-tab-ledger`} hidden={tab !== "ledger"} className="space-y-3">
        <div tabIndex={0} role="region" aria-labelledby={`${baseId}-tx-caption`} className="spx-admin-table-wrap">
          <table className="spx-admin-table">
            <caption id={`${baseId}-tx-caption`} className="sr-only">
              Recent platform coin transactions across all users
            </caption>
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-4 py-3">Client</th>
                <th scope="col" className="px-4 py-3">Type</th>
                <th scope="col" className="px-4 py-3">Amount</th>
                <th scope="col" className="px-4 py-3">Description</th>
                <th scope="col" className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {data.recentTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-white/[0.02]">
                  <th scope="row" className="px-4 py-2.5 font-mono text-xs text-foreground">
                    {tx.clientEmail ?? tx.clientId.slice(0, 8)}
                  </th>
                  <td data-label="Type" className="px-4 py-2.5 font-mono text-[11px] uppercase text-sky-300">
                    {tx.type}
                  </td>
                  <td
                    data-label="Amount"
                    className={cn(
                      "px-4 py-2.5 font-mono text-xs font-bold tabular-nums",
                      tx.amount >= 0 ? "text-emerald-300" : "text-rose-300",
                    )}
                  >
                    {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                  </td>
                  <td data-label="Description" className="px-4 py-2.5 text-xs text-secondary-foreground">
                    {tx.description}
                  </td>
                  <td data-label="Date" className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {fmtDate(tx.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADJUST USER COINS */}
      <AdminNativeDialog
        open={Boolean(coinTarget)}
        titleId={`${baseId}-coin-modal-title`}
        maxWidthClass="max-w-md"
        onClose={() => setCoinTarget(null)}
      >
        {coinTarget && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 id={`${baseId}-coin-modal-title`} className="font-display text-base font-bold text-white">
                  Manage SparrowCoins
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {coinTarget.email ?? coinTarget.username} · Current:{" "}
                  <span className="font-mono font-semibold text-emerald-300">{coinTarget.coins.toLocaleString("en-IN")} coins</span>
                </p>
              </div>
              <button
                type="button"
                aria-label="Close coin manager"
                onClick={() => setCoinTarget(null)}
                className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                coinsMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-border bg-[#05060a] p-1">
                {(
                  [
                    { id: "add" as const, label: "Add (+)" },
                    { id: "deduct" as const, label: "Deduct (−)" },
                    { id: "set" as const, label: "Set Exact (=)" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setCoinMode(m.id)}
                    className={cn(
                      "rounded-lg py-2 text-xs font-semibold transition-colors",
                      coinMode === m.id ? "bg-emerald-500 text-zinc-950" : "text-muted-foreground hover:text-white",
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <label htmlFor={`${baseId}-coin-amt`} className="text-xs font-semibold text-foreground">
                  Amount (SparrowCoins)
                </label>
                <input
                  id={`${baseId}-coin-amt`}
                  type="text"
                  inputMode="numeric"
                  required
                  value={coinAmount}
                  onChange={(e) => setCoinAmount(e.target.value.replace(/[^\d]/g, ""))}
                  className="h-11 w-full rounded-xl border border-border bg-[#05060a] px-3 font-mono text-sm text-white"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[100, 250, 500, 1000, 5000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCoinAmount(String(preset))}
                      className="rounded-lg border border-border bg-[#0b0e17] px-2.5 py-1 font-mono text-[11px] text-secondary-foreground hover:border-emerald-400/50"
                    >
                      {preset.toLocaleString("en-IN")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor={`${baseId}-coin-note`} className="text-xs font-semibold text-foreground">
                  Audit Note (shown in user transactions)
                </label>
                <input
                  id={`${baseId}-coin-note`}
                  type="text"
                  maxLength={140}
                  value={coinNote}
                  onChange={(e) => setCoinNote(e.target.value)}
                  placeholder="e.g. Manual UPI credit verified by admin"
                  className="h-10 w-full rounded-xl border border-border bg-[#05060a] px-3 text-xs text-white placeholder:text-muted-foreground"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" size="sm" variant="secondary" className="rounded-xl" onClick={() => setCoinTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" variant="ivory" className="rounded-xl" disabled={coinsMutation.isPending}>
                  {coinsMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <SparrowxCoinIcon className="size-4" />}
                  <span>Apply Coin Update</span>
                </Button>
              </div>
            </form>
          </>
        )}
      </AdminNativeDialog>

      {/* MODAL 2: ASSIGN / GRANT PLAN TO USER */}
      <AdminNativeDialog
        open={Boolean(grantTarget)}
        titleId={`${baseId}-grant-modal-title`}
        maxWidthClass="max-w-lg"
        onClose={() => setGrantTarget(null)}
      >
        {grantTarget && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 id={`${baseId}-grant-modal-title`} className="font-display text-base font-bold text-white">
                  Assign Subscription Plan
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Grant a subscription record to {grantTarget.email ?? grantTarget.username}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close grant plan dialog"
                onClick={() => setGrantTarget(null)}
                className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                grantMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label htmlFor={`${baseId}-grant-plan`} className="text-xs font-semibold text-foreground">
                  Select Plan Tier
                </label>
                <select
                  id={`${baseId}-grant-plan`}
                  value={grantPlanId}
                  onChange={(e) => setGrantPlanId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-[#05060a] px-3 font-mono text-xs text-white"
                >
                  {ALL_ADMIN_PLAN_GROUPS.map((g) => (
                    <optgroup key={g.groupLabel} label={g.groupLabel}>
                      {g.plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatRam(p.ramMb)} · {p.vcpu} vCPU · {p.diskGb}GB NVMe ({p.priceInr} coins)
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor={`${baseId}-grant-days`} className="text-xs font-semibold text-foreground">
                    Duration (Days)
                  </label>
                  <input
                    id={`${baseId}-grant-days`}
                    type="text"
                    inputMode="numeric"
                    value={grantDays}
                    onChange={(e) => setGrantDays(e.target.value.replace(/[^\d]/g, ""))}
                    className="h-10 w-full rounded-xl border border-border bg-[#05060a] px-3 font-mono text-xs text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`${baseId}-grant-price`} className="text-xs font-semibold text-foreground">
                    Renewal Price Override (optional)
                  </label>
                  <input
                    id={`${baseId}-grant-price`}
                    type="text"
                    inputMode="numeric"
                    value={grantPrice}
                    onChange={(e) => setGrantPrice(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="Use plan default"
                    className="h-10 w-full rounded-xl border border-border bg-[#05060a] px-3 font-mono text-xs text-white placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor={`${baseId}-grant-name`} className="text-xs font-semibold text-foreground">
                  Custom Plan Label (optional)
                </label>
                <input
                  id={`${baseId}-grant-name`}
                  type="text"
                  maxLength={80}
                  value={grantCustomName}
                  onChange={(e) => setGrantCustomName(e.target.value)}
                  placeholder="e.g. Diamond Core VIP"
                  className="h-10 w-full rounded-xl border border-border bg-[#05060a] px-3 text-xs text-white placeholder:text-muted-foreground"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" size="sm" variant="secondary" className="rounded-xl" onClick={() => setGrantTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" variant="ivory" className="rounded-xl" disabled={grantMutation.isPending}>
                  {grantMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  <span>Assign Subscription</span>
                </Button>
              </div>
            </form>
          </>
        )}
      </AdminNativeDialog>

      {/* MODAL 3: EDIT SUBSCRIPTION, RESIZE PLAN & SYNC PTERODACTYL */}
      <AdminNativeDialog
        open={Boolean(editSub)}
        titleId={`${baseId}-sub-modal-title`}
        maxWidthClass="max-w-lg"
        onClose={() => setEditSub(null)}
      >
        {editSub && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 id={`${baseId}-sub-modal-title`} className="font-display text-base font-bold text-white">
                  Edit Subscription &amp; Server Plan
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editSub.clientEmail ?? editSub.clientUsername} ·{" "}
                  {editSub.pteroServerId ? `Panel Server #${editSub.pteroServerId}` : "Subscription Only"}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close edit subscription dialog"
                onClick={() => setEditSub(null)}
                className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateSubMutation.mutate({
                  subscriptionId: editSub.id,
                  status: editStatus,
                  ...(editPlanId ? { planId: editPlanId } : {}),
                  ...(editPlanName.trim() ? { customPlanName: editPlanName.trim() } : {}),
                  ...(editPriceCoins.trim() ? { customPriceCoins: Math.max(0, Math.floor(Number(editPriceCoins) || 0)) } : {}),
                  ...(editExpiryDate ? { expiresAt: new Date(`${editExpiryDate}T23:59:59Z`).toISOString() } : {}),
                  syncPanelLimits,
                  syncPanelStatus,
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label htmlFor={`${baseId}-edit-plan-tier`} className="text-xs font-semibold text-foreground">
                  Upgrade / Downgrade Plan (also resizes Panel RAM/CPU/NVMe)
                </label>
                <select
                  id={`${baseId}-edit-plan-tier`}
                  value={editPlanId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setEditPlanId(nextId);
                    for (const g of ALL_ADMIN_PLAN_GROUPS) {
                      const match = g.plans.find((p) => p.id === nextId);
                      if (match) {
                        setEditPlanName(match.name);
                        setEditPriceCoins(String(match.priceInr));
                        break;
                      }
                    }
                  }}
                  className="h-10 w-full rounded-xl border border-border bg-[#05060a] px-3 font-mono text-xs text-white"
                >
                  <option value="">Keep current hardware ({editSub.planName})</option>
                  {ALL_ADMIN_PLAN_GROUPS.map((g) => (
                    <optgroup key={g.groupLabel} label={g.groupLabel}>
                      {g.plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatRam(p.ramMb)} · {p.vcpu} vCPU · {p.diskGb}GB NVMe ({p.priceInr} coins)
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor={`${baseId}-edit-plan-name`} className="text-xs font-semibold text-foreground">
                    Plan Display Name
                  </label>
                  <input
                    id={`${baseId}-edit-plan-name`}
                    type="text"
                    value={editPlanName}
                    onChange={(e) => setEditPlanName(e.target.value)}
                    className="h-10 w-full rounded-xl border border-border bg-[#05060a] px-3 text-xs text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`${baseId}-edit-price`} className="text-xs font-semibold text-foreground">
                    Monthly Renewal (Coins)
                  </label>
                  <input
                    id={`${baseId}-edit-price`}
                    type="text"
                    inputMode="numeric"
                    value={editPriceCoins}
                    onChange={(e) => setEditPriceCoins(e.target.value.replace(/[^\d]/g, ""))}
                    className="h-10 w-full rounded-xl border border-border bg-[#05060a] px-3 font-mono text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor={`${baseId}-edit-status`} className="text-xs font-semibold text-foreground">
                    Subscription Status
                  </label>
                  <select
                    id={`${baseId}-edit-status`}
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as Subscription["status"])}
                    className="h-10 w-full rounded-xl border border-border bg-[#05060a] px-3 text-xs text-white"
                  >
                    <option value="active">Active (Unsuspend Server)</option>
                    <option value="expired">Expired (Suspend Server)</option>
                    <option value="cancelled">Cancelled (Suspend Server)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`${baseId}-edit-expiry`} className="text-xs font-semibold text-foreground">
                    Expiry Date
                  </label>
                  <input
                    id={`${baseId}-edit-expiry`}
                    type="date"
                    value={editExpiryDate}
                    onChange={(e) => setEditExpiryDate(e.target.value)}
                    className="h-10 w-full rounded-xl border border-border bg-[#05060a] px-3 font-mono text-xs text-white"
                  />
                </div>
              </div>

              {editSub.pteroServerId && (
                <div className="rounded-2xl border border-border bg-[#05060a] p-3.5 space-y-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncPanelLimits}
                      onChange={(e) => setSyncPanelLimits(e.target.checked)}
                      className="size-4 accent-emerald-500"
                    />
                    <span>Resize RAM / vCPU / NVMe live on Pterodactyl Server #{editSub.pteroServerId}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncPanelStatus}
                      onChange={(e) => setSyncPanelStatus(e.target.checked)}
                      className="size-4 accent-emerald-500"
                    />
                    <span>Sync Active / Suspended status directly to Pterodactyl Panel</span>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" size="sm" variant="secondary" className="rounded-xl" onClick={() => setEditSub(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" variant="ivory" className="rounded-xl" disabled={updateSubMutation.isPending}>
                  {updateSubMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sliders className="size-3.5" />}
                  <span>Save Subscription &amp; Plan</span>
                </Button>
              </div>
            </form>
          </>
        )}
      </AdminNativeDialog>
    </section>
  );
}
