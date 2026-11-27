import React from "react";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SparrowxCoinIconProps {
  className?: string;
  size?: number;
  decorative?: boolean;
  alt?: string;
  /** Use on modals/dropdowns that start hidden above the fold */
  lowPriority?: boolean;
}

/**
 * Official 3D metallic embossed SparrowX Coin icon.
 * Multi-density WebP (`64px` / `128px` / `256px`) with transparent PNG fallback.
 */
export function SparrowxCoinIcon({
  className,
  size = 20,
  decorative = true,
  alt = "SparrowX Coin",
  lowPriority = false,
}: SparrowxCoinIconProps) {
  return (
    <picture className="inline-flex shrink-0 items-center justify-center leading-none">
      <source
        type="image/webp"
        srcSet="/logos/sparrowx-coin-64.webp 1x, /logos/sparrowx-coin-128.webp 2x, /logos/sparrowx-coin.webp 3x"
      />
      <img
        src="/logos/sparrowx-coin.png"
        alt={decorative ? "" : alt}
        aria-hidden={decorative ? "true" : undefined}
        width={size}
        height={size}
        decoding="async"
        {...(lowPriority ? { fetchPriority: "low" as const } : {})}
        className={cn(
          "inline-block shrink-0 rounded-full object-contain select-none drop-shadow-[0_1px_4px_rgba(147,168,255,0.45)]",
          className ?? "size-5",
        )}
      />
    </picture>
  );
}

const ECOSYSTEM_DEPARTMENTS = [
  "Cloud Infra (VPS / VDS)",
  "Game Hosting",
  "AI Agents & Models",
  "Sovereign PostgreSQL",
  "Shield WAF & DDoS",
  "Deploy PaaS",
] as const;

const BONUS_TIERS = [
  { pack: "1,500 Coins", bonus: "+100 Bonus" },
  { pack: "3,000 Coins", bonus: "+300 Bonus" },
  { pack: "10,000 Coins", bonus: "+1,500 Bonus" },
] as const;

export interface SparrowxCoinsMarketingBannerProps {
  variant?: "hero" | "compact";
  ctaLabel?: string;
  onCtaClick?: () => void;
  ctaHref?: string;
  balanceCoins?: number | undefined;
  className?: string;
}

/**
 * Ecosystem-wide SparrowX Coins marketing spotlight card featuring
 * the official 3D stacked metallic SparrowX Coins studio render.
 */
export function SparrowxCoinsMarketingBanner({
  variant = "hero",
  ctaLabel = "Top Up SparrowX Coins",
  onCtaClick,
  ctaHref,
  balanceCoins,
  className,
}: SparrowxCoinsMarketingBannerProps) {
  const isCompact = variant === "compact";

  const actionButton = ctaHref ? (
    <a
      href={ctaHref}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 bg-gradient-to-b from-[#F3F6FA] to-[#CFD6E2] px-5 py-2.5 text-xs sm:text-sm font-semibold text-[#05060A] shadow-[0_8px_28px_rgba(147,168,255,0.22)] transition-all hover:from-white hover:to-[#E2E8F0] active:scale-[0.99]"
    >
      <SparrowxCoinIcon className="size-4" />
      <span>{ctaLabel}</span>
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </a>
  ) : onCtaClick ? (
    <button
      type="button"
      onClick={onCtaClick}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 bg-gradient-to-b from-[#F3F6FA] to-[#CFD6E2] px-5 py-2.5 text-xs sm:text-sm font-semibold text-[#05060A] shadow-[0_8px_28px_rgba(147,168,255,0.22)] transition-all hover:from-white hover:to-[#E2E8F0] active:scale-[0.99] cursor-pointer"
    >
      <SparrowxCoinIcon className="size-4" />
      <span>{ctaLabel}</span>
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </button>
  ) : null;

  return (
    <section
      aria-label="SparrowX Coins Universal Ecosystem Currency"
      className={cn(
        "relative overflow-hidden rounded-3xl border border-[#8FA4FF]/25 bg-gradient-to-br from-[#080B16] via-[#0B1022] to-[#060811] shadow-[0_24px_70px_rgba(0,0,0,0.65)]",
        isCompact ? "p-5 sm:p-6" : "p-6 sm:p-8 lg:p-10",
        className,
      )}
    >
      {/* Subtle metallic periwinkle-silver specular glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-[#8B9CFF]/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 left-10 size-64 rounded-full bg-[#60A5FA]/10 blur-3xl"
      />

      <div
        className={cn(
          "relative grid items-center gap-6 lg:gap-10",
          isCompact ? "grid-cols-1 md:grid-cols-12" : "grid-cols-1 lg:grid-cols-12",
        )}
      >
        {/* Left Copy & Value Proposition */}
        <div className={cn("space-y-4", isCompact ? "md:col-span-7" : "lg:col-span-7")}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#9EB2FF]/35 bg-[#8B9CFF]/12 px-3 py-1 text-[11px] font-mono font-semibold uppercase tracking-wider text-[#C7D2FE]">
              <SparrowxCoinIcon className="size-4" />
              <span>SparrowX Coins</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-mono font-semibold text-emerald-300">
              <Sparkles className="size-3" aria-hidden="true" />
              1 Coin = ₹1.00 INR · Never Expires
            </span>
            {typeof balanceCoins === "number" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-1 text-[11px] font-mono font-semibold text-white tabular-nums">
                Balance: {balanceCoins.toLocaleString("en-IN")} Coins
              </span>
            )}
          </div>

          <div className="space-y-2">
            <h2
              className={cn(
                "font-display font-bold tracking-tight text-white",
                isCompact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl lg:text-4xl",
              )}
            >
              One Sovereign Balance for the Entire{" "}
              <span className="bg-gradient-to-r from-[#E0E7FF] via-[#A5B4FC] to-[#93C5FD] bg-clip-text text-transparent">
                SparrowX Ecosystem
              </span>
            </h2>
            <p className="max-w-2xl text-xs sm:text-sm leading-relaxed text-zinc-300">
              Fund your central SparrowX Wallet once via <strong>0%-fee UPI QR</strong> or{" "}
              <strong>Binance USDT</strong> and seamlessly deploy across Game Hosting, Ryzen NVMe VPS,
              Managed PostgreSQL, AI Agents, Shield WAF, and Deploy PaaS — with zero subscription lock-in.
            </p>
          </div>

          {/* Bonus Packs Row */}
          <div className="flex flex-wrap items-center gap-2">
            {BONUS_TIERS.map((tier) => (
              <div
                key={tier.pack}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.09] bg-[#060812]/80 px-3 py-1.5 text-[11px] font-mono"
              >
                <SparrowxCoinIcon className="size-3.5" />
                <span className="text-zinc-200 font-semibold">{tier.pack}</span>
                <span className="text-emerald-400 font-bold">{tier.bonus}</span>
              </div>
            ))}
          </div>

          {/* Ecosystem Department Pills */}
          {!isCompact && (
            <div className="flex flex-wrap gap-2 pt-1">
              {ECOSYSTEM_DEPARTMENTS.map((dept) => (
                <span
                  key={dept}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-300"
                >
                  <CheckCircle2 className="size-3 text-[#A5B4FC]" aria-hidden="true" />
                  <span>{dept}</span>
                </span>
              ))}
            </div>
          )}

          {actionButton && (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {actionButton}
              <span className="text-[11px] font-mono text-zinc-400">
                Instant auto-credit · Full GST invoices
              </span>
            </div>
          )}
        </div>

        {/* Right 3D Coin Stack Showcase */}
        <div
          className={cn(
            "relative flex items-center justify-center",
            isCompact ? "md:col-span-5" : "lg:col-span-5",
          )}
        >
          <div className="group relative w-full max-w-[440px] overflow-hidden rounded-2xl border border-[#A5B4FC]/25 bg-[#060914] shadow-[0_20px_60px_rgba(8,12,28,0.85)]">
            <picture>
              <source type="image/webp" srcSet="/images/sparrowx-coins-stack.webp" />
              <img
                src="/images/sparrowx-coins-stack.jpg"
                alt="Stacks of 3D metallic embossed SparrowX Coins"
                width={960}
                height={746}
                loading="lazy"
                decoding="async"
                className="block w-full h-auto object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              />
            </picture>
            {/* Bottom gradient overlay with subtle spec badge */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#060914] via-[#060914]/65 to-transparent px-4 pb-3 pt-8">
              <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-zinc-300">
                <span className="inline-flex items-center gap-1.5 text-[#C7D2FE] font-semibold">
                  <SparrowxCoinIcon className="size-3.5" />
                  SPARROWX TREASURY COIN
                </span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-white">1:1 INR</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
