import React, { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, Cpu, HardDrive, Network } from "lucide-react";
import { DeployAppShell } from "@/components/deploy/DeployAppShell";
import { StatusBadge, useDeploySession } from "@/components/deploy/deploy-ui";

export const Route = createFileRoute("/usage")({
  head: () => ({
    meta: [{ title: "Usage & Quotas — SparrowX Deploy" }],
  }),
  component: UsageAndQuotasPage,
});

interface UsageResponse {
  workspace: {
    name: string;
    plan: string;
    projectLimit: number;
    projectsUsed: number;
    monthlyTransferLimitGb: number;
  };
  totals: {
    activeProjects: number;
    totalProjects: number;
    avgCpuPct: number;
    memoryUsedMb: number;
    memoryLimitMb: number;
    transferUsedGb: number;
    transferLimitGb: number;
  };
  perProject: Array<{
    projectId: string;
    name: string;
    slug: string;
    tier: string;
    status: string;
    cpuPct: number;
    memoryMb: number;
    transferGb: number;
  }>;
  tiers: Array<{
    id: string;
    label: string;
    vcpu: number;
    ramMb: number;
    bandwidthMbps: number;
    monthlyTransferGb: number;
    priceInr: number;
    badge: string;
  }>;
}

function UsageAndQuotasPage() {
  const { user, checking } = useDeploySession(true);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void fetch("/api/deploy/usage", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) setUsage(d as UsageResponse);
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (checking || !user) {
    return (
      <div className="min-h-screen bg-[#05060A] flex items-center justify-center text-xs spx-mono text-zinc-400">
        Verifying session...
      </div>
    );
  }

  const transferPct = usage
    ? Math.min(
        100,
        Math.round((usage.totals.transferUsedGb / Math.max(1, usage.totals.transferLimitGb)) * 100),
      )
    : 0;

  return (
    <DeployAppShell user={user} activeNav="usage">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Usage &amp; Quotas
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time compute, memory, and APAC monthly transfer capacity across OVH Mumbai Edge.
          </p>
        </div>

        {loading || !usage ? (
          <div className="h-44 rounded-2xl spx-obsidian-card animate-pulse" />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl spx-obsidian-card p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Average CPU</span>
                  <Cpu className="size-4 text-sky-400" />
                </div>
                <div className="text-2xl font-semibold text-white spx-mono tabular-nums">
                  {usage.totals.avgCpuPct}%
                </div>
                <div className="text-[11px] text-zinc-500">
                  Across {usage.totals.totalProjects} / {usage.workspace.projectLimit} projects
                </div>
              </div>

              <div className="rounded-xl spx-obsidian-card p-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Memory Allocated</span>
                  <HardDrive className="size-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-semibold text-white spx-mono tabular-nums">
                  {usage.totals.memoryUsedMb} MB
                </div>
                <div className="text-[11px] spx-mono text-zinc-500 tabular-nums">
                  Limit: {usage.totals.memoryLimitMb} MB
                </div>
              </div>

              <div className="rounded-xl spx-obsidian-card p-5 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Monthly Transfer (APAC)</span>
                  <Network className="size-4 text-amber-400" />
                </div>
                <div className="text-2xl font-semibold text-white spx-mono tabular-nums">
                  {usage.totals.transferUsedGb} GB
                  <span className="text-xs font-normal text-zinc-500 ml-1">
                    / {usage.totals.transferLimitGb} GB
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-400 to-emerald-400"
                    style={{ width: `${Math.max(4, transferPct)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Per-Project Breakdown */}
            <div className="rounded-2xl spx-obsidian-card overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.07] flex items-center gap-2 text-sm font-semibold text-white">
                <Activity className="size-4 text-sky-400" />
                <span>Per-Project Resource Usage</span>
              </div>
              {usage.perProject.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500">No active projects yet.</div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {usage.perProject.map((p) => (
                    <div
                      key={p.projectId}
                      className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <a
                          href={`/projects/${p.projectId}`}
                          className="font-semibold text-white hover:underline"
                        >
                          {p.name}
                        </a>
                        <StatusBadge status={p.status} />
                        <span className="spx-mono text-[10px] uppercase text-zinc-500">
                          {p.tier}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 spx-mono text-[11px] text-zinc-300 tabular-nums">
                        <span>CPU {p.cpuPct}%</span>
                        <span>RAM {p.memoryMb} MB</span>
                        <span>Transfer {p.transferGb} GB</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Flat INR Compute Plans */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {usage.tiers.map((t) => (
                <div key={t.id} className="rounded-2xl spx-obsidian-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{t.label}</span>
                    <span className="spx-mono text-sm font-semibold text-emerald-400 tabular-nums">
                      ₹{t.priceInr}/mo
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400">{t.badge}</div>
                  <div className="pt-2 border-t border-white/[0.06] space-y-1 text-xs spx-mono text-zinc-300 tabular-nums">
                    <div>
                      {t.vcpu} vCPU · {(t.ramMb / 1024).toFixed(0)} GB RAM
                    </div>
                    <div>
                      {t.bandwidthMbps} Mbps Port · {t.monthlyTransferGb} GB/mo
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </DeployAppShell>
  );
}
