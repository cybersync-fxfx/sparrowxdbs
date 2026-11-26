import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Cpu,
  CreditCard,
  Download,
  HardDrive,
  IndianRupee,
  Network,
  Play,
  QrCode,
  RefreshCw,
  Server,
  ShieldAlert,
} from "lucide-react";
import type {
  AiComputePlan,
  AiInstanceRecord,
  AiInvoiceRecord,
  FounderAdminTelemetry,
} from "@/lib/ai/contracts";
import { AI_COMPUTE_PLANS } from "@/lib/ai/contracts";

interface AiBillingCenterProps {
  walletBalanceInr: number;
  instances: AiInstanceRecord[];
  invoices: AiInvoiceRecord[];
  onTriggerUpiCheckout: (plan: AiComputePlan) => void;
}

export function AiBillingCenter({
  walletBalanceInr,
  instances,
  invoices,
  onTriggerUpiCheckout,
}: AiBillingCenterProps) {
  const totalTransferUsed = instances.reduce((s, i) => s + i.transferUsedGb, 0);
  const totalTransferQuota = Math.max(
    500,
    instances.reduce((s, i) => s + i.transferQuotaGb, 0),
  );
  const bwPct = Math.min(100, Math.round((totalTransferUsed / totalTransferQuota) * 100));
  const monthlyBurnInr = instances.reduce((s, i) => s + i.monthlyInr, 0);

  const downloadGstInvoice = (inv: AiInvoiceRecord) => {
    const receipt = [
      "SPARROWX TECHNOLOGIES — TAX INVOICE (GST COMPLIANT)",
      "====================================================",
      `Invoice Number : ${inv.invoiceNumber}`,
      `Billing Period : ${inv.period}`,
      `Supplier GSTIN : ${inv.gstin}`,
      `Issued At      : ${inv.issuedAt}`,
      `Payment Method : ${inv.method} (Status: ${inv.status})`,
      "----------------------------------------------------",
      `Managed AI Compute (ai.sparrowx.net) : INR ${inv.subtotalInr.toFixed(2)}`,
      `IGST (18%)                           : INR ${inv.gstInr.toFixed(2)}`,
      `TOTAL PAID                           : INR ${inv.totalInr.toFixed(2)}`,
      "====================================================",
      "Hosted in India (OVH BOM1 + Sovereign Bare-Metal)",
    ].join("\n");
    const blob = new Blob([receipt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${inv.invoiceNumber}-GST.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Billing &amp; UPI AutoPay Center
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Flat INR billing via Razorpay / Cashfree UPI QR &amp; UPI AutoPay with instant GST invoices.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onTriggerUpiCheckout(AI_COMPUTE_PLANS[1]!)}
          className="spx-silver-btn inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-[#05060A] cursor-pointer"
        >
          <QrCode className="size-3.5" aria-hidden="true" />
          <span>Top Up / Setup UPI AutoPay</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/[0.08] bg-[#090B11] p-5">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
            <span>INR WALLET BALANCE</span>
            <IndianRupee className="size-4 text-[#10B981]" aria-hidden="true" />
          </div>
          <div className="mt-2 text-3xl font-mono font-semibold text-white">
            ₹{walletBalanceInr.toLocaleString("en-IN")}
          </div>
          <div className="mt-2 text-xs text-zinc-400">
            3-day grace period on failed renewal before graceful container pause.
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#090B11] p-5">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
            <span>EST. MONTHLY COMMIT</span>
            <CreditCard className="size-4 text-[#38BDF8]" aria-hidden="true" />
          </div>
          <div className="mt-2 text-3xl font-mono font-semibold text-white">
            ₹{monthlyBurnInr.toLocaleString("en-IN")}
            <span className="text-xs text-zinc-500"> + 18% GST</span>
          </div>
          <div className="mt-2 text-xs text-zinc-400">
            Across {instances.length} active Indian compute instance(s).
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#090B11] p-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
            <span>MONTHLY BANDWIDTH ALERT</span>
            <span className={bwPct >= 90 ? "text-[#EF4444]" : bwPct >= 75 ? "text-[#F59E0B]" : "text-[#10B981]"}>
              {bwPct}% used
            </span>
          </div>
          <div className="text-lg font-mono font-semibold text-white">
            {totalTransferUsed.toFixed(1)} GB{" "}
            <span className="text-xs font-normal text-zinc-500">/ {totalTransferQuota} GB</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full rounded-full ${
                bwPct >= 90 ? "bg-[#EF4444]" : bwPct >= 75 ? "bg-[#F59E0B]" : "bg-[#10B981]"
              }`}
              style={{ width: `${Math.max(4, bwPct)}%` }}
            />
          </div>
          <div className="text-[11px] font-mono text-zinc-500">
            Auto-alerts fire at 75% &amp; 90% • Soft port throttle at 100% (no surprise bills).
          </div>
        </div>
      </div>

      {/* Quick UPI Subscription Checkout Cards */}
      <div className="rounded-xl border border-white/[0.08] bg-[#090B11] p-5 space-y-4">
        <div className="text-xs font-mono uppercase tracking-wider text-zinc-400">
          Instant UPI QR &amp; UPI AutoPay Plans
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {AI_COMPUTE_PLANS.map((plan) => (
            <div
              key={plan.id}
              className="rounded-lg border border-white/[0.08] bg-[#05060A] p-4 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="text-sm font-semibold text-white">{plan.name}</div>
                <div className="text-xs font-mono text-zinc-400 mt-0.5">
                  {plan.vcpu} vCPU / {plan.ramGb} GB / {plan.portMbps} Mbps
                </div>
                <div className="mt-2 text-lg font-mono font-semibold text-white">
                  ₹{plan.monthlyInr.toLocaleString("en-IN")}/mo
                </div>
              </div>
              <button
                type="button"
                onClick={() => onTriggerUpiCheckout(plan)}
                className="w-full rounded-md border border-white/15 bg-[#090B11] hover:bg-white hover:text-[#05060A] py-1.5 text-xs font-semibold text-zinc-100 transition-colors cursor-pointer"
              >
                Checkout via UPI
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* GST Invoices Table */}
      <div className="rounded-xl border border-white/[0.08] bg-[#090B11] overflow-hidden">
        <div className="border-b border-white/[0.08] px-5 py-3 text-xs font-mono text-zinc-300">
          GST-Compliant Tax Invoices (SAC 998315)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-white/[0.06] text-zinc-500">
                <th className="py-3 px-5">Invoice #</th>
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Total (incl. 18% GST)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-5 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-[#10131C]/50">
                  <td className="py-3 px-5 text-white">{inv.invoiceNumber}</td>
                  <td className="py-3 px-4 text-zinc-400">{inv.period}</td>
                  <td className="py-3 px-4 text-zinc-300">{inv.method}</td>
                  <td className="py-3 px-4 text-white">₹{inv.totalInr.toLocaleString("en-IN")}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 rounded bg-[#10B981]/10 border border-[#10B981]/25 px-2 py-0.5 text-[10px] text-[#10B981]">
                      <CheckCircle2 className="size-3" aria-hidden="true" />
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-right">
                    <button
                      type="button"
                      onClick={() => downloadGstInvoice(inv)}
                      className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-[#05060A] hover:bg-[#10131C] px-2.5 py-1 text-[11px] text-zinc-200 cursor-pointer"
                    >
                      <Download className="size-3" aria-hidden="true" />
                      <span>GST Invoice</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface AiFounderAdminViewProps {
  onInstancesMutated: () => void;
}

export function AiFounderAdminView({ onInstancesMutated }: AiFounderAdminViewProps) {
  const [telemetry, setTelemetry] = useState<FounderAdminTelemetry | null>(null);
  const [instances, setInstances] = useState<AiInstanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchAdmin = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/admin");
      const json = (await res.json()) as {
        ok?: boolean;
        telemetry?: FounderAdminTelemetry;
        instances?: AiInstanceRecord[];
      };
      if (json.ok && json.telemetry) {
        setTelemetry(json.telemetry);
        setInstances(json.instances || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAdmin();
  }, []);

  const toggleSuspend = async (inst: AiInstanceRecord) => {
    setActingId(inst.id);
    try {
      const action = inst.status === "paused" ? "resume" : "suspend";
      const res = await fetch("/api/ai/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, instanceId: inst.id }),
      });
      if (res.ok) {
        await fetchAdmin();
        onInstancesMutated();
      }
    } finally {
      setActingId(null);
    }
  };

  if (loading || !telemetry) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-xl border border-white/[0.08] bg-[#090B11] animate-pulse" />
        <div className="h-56 rounded-xl border border-white/[0.08] bg-[#090B11] animate-pulse" />
      </div>
    );
  }

  const ovhPct = Math.round(
    (telemetry.ovhGateway.monthlyUsedTb / telemetry.ovhGateway.monthlyQuotaTb) * 100,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-[#EF4444]">
            Founder Infrastructure Control • Bare-Metal Cluster
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Proxmox VE Host, OVH vnstat &amp; Abuse Monitor
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void fetchAdmin()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#090B11] hover:bg-[#10131C] px-3 py-1.5 text-xs font-mono text-zinc-200 cursor-pointer"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          <span>Refresh Host Telemetry</span>
        </button>
      </div>

      {/* Proxmox Bare-Metal Host Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/[0.08] bg-[#090B11] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
            <span>PROXMOX CPU ({telemetry.proxmox.node})</span>
            <Cpu className="size-4 text-[#38BDF8]" aria-hidden="true" />
          </div>
          <div className="text-2xl font-mono font-semibold text-white">
            {telemetry.proxmox.usedCores} / {telemetry.proxmox.totalCores} vCPU
          </div>
          <div className="text-xs font-mono text-zinc-400">
            {telemetry.proxmox.cpuModel} • {telemetry.proxmox.cpuLoadPct}% load
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#090B11] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
            <span>ECC RAM ALLOCATION POOL</span>
            <Server className="size-4 text-[#10B981]" aria-hidden="true" />
          </div>
          <div className="text-2xl font-mono font-semibold text-white">
            {telemetry.proxmox.allocatedRamGb} / {telemetry.proxmox.totalRamGb} GB
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full bg-[#10B981]"
              style={{
                width: `${Math.round(
                  (telemetry.proxmox.allocatedRamGb / telemetry.proxmox.totalRamGb) * 100,
                )}%`,
              }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#090B11] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
            <span>ZFS NVME STORAGE ({telemetry.proxmox.storagePool})</span>
            <HardDrive className="size-4 text-[#F59E0B]" aria-hidden="true" />
          </div>
          <div className="text-2xl font-mono font-semibold text-white">
            {telemetry.proxmox.storageUsedTb} / {telemetry.proxmox.storageTotalTb} TB
          </div>
          <div className="text-xs font-mono text-zinc-400">
            EXECUTIONS_DATA_PRUNE enforced across tenant containers
          </div>
        </div>
      </div>

      {/* OVH Mumbai vnstat Outbound Bandwidth Tracker */}
      <div className="rounded-xl border border-white/[0.08] bg-[#090B11] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Network className="size-4 text-[#38BDF8]" aria-hidden="true" />
            <span>OVH Mumbai Gateway Monthly Outbound Tracker (vnstat • {telemetry.ovhGateway.gatewayIp})</span>
          </div>
          <span className="text-xs font-mono text-zinc-300">
            Live: Rx {telemetry.ovhGateway.currentRxMbps} Mbps / Tx {telemetry.ovhGateway.currentTxMbps} Mbps
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full ${
              ovhPct >= telemetry.ovhGateway.warningThresholdPct ? "bg-[#EF4444]" : "bg-[#38BDF8]"
            }`}
            style={{ width: `${Math.max(5, ovhPct)}%` }}
          />
        </div>
        <div className="flex flex-wrap justify-between text-xs font-mono text-zinc-400">
          <span>
            {telemetry.ovhGateway.monthlyUsedTb} TB / {telemetry.ovhGateway.monthlyQuotaTb} TB ({ovhPct}%)
          </span>
          <span>Alert threshold: {telemetry.ovhGateway.warningThresholdPct}% • Tunnel: {telemetry.ovhGateway.tunnelType}</span>
        </div>
      </div>

      {/* Abuse Monitor */}
      <div className="rounded-xl border border-white/[0.08] bg-[#090B11] p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <ShieldAlert className="size-4 text-[#EF4444]" aria-hidden="true" />
          <span>Real-Time Abuse &amp; Egress Policy Monitor</span>
        </div>
        <div className="space-y-2.5">
          {telemetry.abuseAlerts.map((alert) => (
            <div
              key={alert.id}
              className="rounded-lg border border-white/[0.08] bg-[#05060A] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <AlertTriangle
                    className={`size-3.5 ${
                      alert.severity === "high" ? "text-[#EF4444]" : "text-[#F59E0B]"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="font-semibold text-white">{alert.type}</span>
                  <span className="text-zinc-500">• {alert.instanceName}</span>
                </div>
                <p className="text-xs text-zinc-400">{alert.detail}</p>
              </div>
              <span className="shrink-0 rounded border border-white/10 bg-[#090B11] px-2.5 py-1 text-[11px] font-mono text-[#10B981]">
                {alert.actionTaken}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* IPv4 Allocations & Tenant Suspension Controls */}
      <div className="rounded-xl border border-white/[0.08] bg-[#090B11] overflow-hidden">
        <div className="border-b border-white/[0.08] px-5 py-3 text-xs font-mono text-zinc-300">
          IPv4 Allocations &amp; Tenant Suspension Controls
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-white/[0.06] text-zinc-500">
                <th className="py-3 px-5">IPv4</th>
                <th className="py-3 px-4">Workload / Role</th>
                <th className="py-3 px-4">Port Cap</th>
                <th className="py-3 px-4">SMTP TCP/25</th>
                <th className="py-3 px-4">State</th>
                <th className="py-3 px-5 text-right">Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {telemetry.ipAllocations.map((row) => {
                const matched = instances.find((i) => i.internalIp === row.ip);
                return (
                  <tr key={row.ip} className="hover:bg-[#10131C]/50">
                    <td className="py-3 px-5 text-white">{row.ip}</td>
                    <td className="py-3 px-4 text-zinc-300">{row.role}</td>
                    <td className="py-3 px-4 text-zinc-400">{row.portCapMbps} Mbps</td>
                    <td className="py-3 px-4 text-[#10B981]">
                      {row.smtpBlocked ? "BLOCKED" : "OPEN"}
                    </td>
                    <td className="py-3 px-4 uppercase text-zinc-200">{row.status}</td>
                    <td className="py-3 px-5 text-right">
                      {matched ? (
                        <button
                          type="button"
                          disabled={actingId === matched.id}
                          onClick={() => void toggleSuspend(matched)}
                          className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-[11px] cursor-pointer ${
                            matched.status === "paused"
                              ? "border-[#10B981]/35 bg-[#10B981]/10 text-[#10B981]"
                              : "border-[#EF4444]/35 bg-[#EF4444]/10 text-[#EF4444]"
                          }`}
                        >
                          {matched.status === "paused" ? (
                            <>
                              <Play className="size-3" aria-hidden="true" />
                              <span>Resume</span>
                            </>
                          ) : (
                            <>
                              <Ban className="size-3" aria-hidden="true" />
                              <span>Suspend</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-zinc-600">Edge Ingress</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
