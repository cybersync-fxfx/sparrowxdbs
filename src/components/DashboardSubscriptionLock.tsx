import React from "react";
import { ArrowRight, CreditCard, Database, FileUp, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { buildMasterHref, buildProductHref, type CanonicalProductKey } from "@/lib/routing";

export interface DashboardSubscriptionLockProps {
  serviceName: string;
  locked?: boolean | undefined;
  mode?: "overlay" | "panel" | undefined;
  onChoosePlan?: (() => void) | undefined;
  plansHref?: string | undefined;
  secondaryActionLabel?: string | undefined;
  onSecondaryAction?: (() => void) | undefined;
  children?: React.ReactNode | undefined;
}

const FREE_SERVICES: ReadonlyArray<{
  label: string;
  product: CanonicalProductKey;
  icon: typeof Database;
}> = [
  { label: "Cloud DB (Free Tier)", product: "db", icon: Database },
  { label: "SparrowX Drop", product: "drop", icon: FileUp },
  { label: "SparrowX Keys", product: "keys", icon: KeyRound },
];

function LockCard({
  serviceName,
  onChoosePlan,
  plansHref,
  secondaryActionLabel,
  onSecondaryAction,
}: Omit<DashboardSubscriptionLockProps, "locked" | "mode" | "children">) {
  return (
    <div
      data-testid="dashboard-subscription-lock"
      role="region"
      aria-label={`${serviceName} Dashboard Locked`}
      className="w-full max-w-xl mx-auto rounded-2xl border border-white/15 bg-[#090C14]/95 backdrop-blur-xl p-7 sm:p-9 text-center shadow-[0_24px_80px_-20px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.08)] space-y-6"
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/35 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-200">
        <Lock className="size-3.5" aria-hidden="true" />
        <span>Dashboard Locked &middot; Subscription Required</span>
      </div>

      <div className="mx-auto size-14 rounded-2xl border border-white/15 bg-white/[0.04] grid place-items-center text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
        <ShieldCheck className="size-7 text-amber-300" aria-hidden="true" />
      </div>

      <div className="space-y-2.5">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          Activate a Plan to Unlock Your {serviceName} Dashboard
        </h2>
        <p className="text-sm text-zinc-400 leading-relaxed max-w-md mx-auto">
          Select a subscription plan and complete payment to activate full controls, live telemetry, and deployments.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
        {onChoosePlan ? (
          <button
            type="button"
            onClick={onChoosePlan}
            className="inline-flex items-center gap-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold px-5 py-2.5 text-sm shadow-[0_8px_24px_-8px_rgba(255,255,255,0.35)] transition-all cursor-pointer"
          >
            <CreditCard className="size-4" aria-hidden="true" />
            <span>Choose Plan &amp; Activate Dashboard</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        ) : (
          <a
            href={plansHref || buildMasterHref("/#products")}
            className="inline-flex items-center gap-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold px-5 py-2.5 text-sm shadow-[0_8px_24px_-8px_rgba(255,255,255,0.35)] transition-all"
          >
            <CreditCard className="size-4" aria-hidden="true" />
            <span>Choose Plan &amp; Activate Dashboard</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </a>
        )}

        {secondaryActionLabel && onSecondaryAction && (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/30 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:text-white transition-colors cursor-pointer"
          >
            <span>{secondaryActionLabel}</span>
          </button>
        )}
      </div>

      <div className="pt-4 border-t border-white/10 space-y-2.5">
        <p className="text-xs text-zinc-400">
          Looking for our free-tier tools? These 3 services are free without a paid subscription:
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {FREE_SERVICES.map((svc) => {
            const Icon = svc.icon;
            const href = buildProductHref(svc.product);
            return (
              <a
                key={svc.product}
                href={href}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/25 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:text-white transition-colors"
              >
                <Icon className="size-3.5 text-emerald-400" aria-hidden="true" />
                <span>{svc.label}</span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DashboardSubscriptionLock({
  serviceName,
  locked = true,
  mode = "overlay",
  onChoosePlan,
  plansHref,
  secondaryActionLabel,
  onSecondaryAction,
  children,
}: DashboardSubscriptionLockProps) {
  if (!locked) {
    return <>{children}</>;
  }

  if (mode === "panel") {
    return (
      <div className="py-6 sm:py-10">
        <LockCard
          serviceName={serviceName}
          onChoosePlan={onChoosePlan}
          plansHref={plansHref}
          secondaryActionLabel={secondaryActionLabel}
          onSecondaryAction={onSecondaryAction}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-[420px]">
      <div
        aria-hidden="true"
        className="pointer-events-none select-none opacity-30 blur-[3px] saturate-50 transition-all"
      >
        {children}
      </div>
      <div className="absolute inset-0 z-20 flex items-start justify-center bg-[#04060B]/60 backdrop-blur-[2px] p-4 sm:p-8 pt-10 sm:pt-16">
        <LockCard
          serviceName={serviceName}
          onChoosePlan={onChoosePlan}
          plansHref={plansHref}
          secondaryActionLabel={secondaryActionLabel}
          onSecondaryAction={onSecondaryAction}
        />
      </div>
    </div>
  );
}
