import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Coins, Cpu, Globe2, HardDrive, MemoryStick, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { formatInr, formatRam, planCostCoins, type Service } from "@/lib/services";
import { cn } from "@/lib/utils";
import { PurchasePolicyNotice } from "@/components/PurchasePolicyNotice";
import { GoogleGIcon, useSessionSummary } from "./Navbar";
import { buildGoogleLoginHref } from "@/components/GoogleSignInButton";
import type { InfraRegionId } from "@/lib/infra-plans";

export function Pricing({ service }: { service: Service }) {
  const { data: me } = useSessionSummary();
  const [selectedRegion, setSelectedRegion] = useState<InfraRegionId>("sg-sin");

  const regionNames: Record<string, string> = {
    "in-mum": "Mumbai, India (BOM)",
    "in-maa": "Tamil Nadu, India (MAA)",
    "sg-sin": "Singapore APAC (SIN)",
    "uk-lon": "London, UK (LON)",
  };

  return (
    <section id="pricing" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 py-24">
      <div className="pointer-events-none absolute left-1/2 top-24 -z-10 h-72 w-[60%] -translate-x-1/2 rounded-full bg-svc/15 blur-[120px]" />
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-svc">{service.name} plans</p>
        <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Pick your node. Deploy in seconds.</h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Billed monthly in INR. Pay with SparrowCoins — <span className="font-mono text-foreground">1 Coin = ₹1</span>.
        </p>

        {/* Core Server Regions */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {(
            [
              { id: "in-mum", label: "Mumbai, IN" },
              { id: "in-maa", label: "Tamil Nadu, IN" },
              { id: "sg-sin", label: "Singapore" },
              { id: "uk-lon", label: "London, UK" },
            ] as const
          ).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedRegion(r.id)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                selectedRegion === r.id
                  ? "border-svc bg-svc/15 text-foreground"
                  : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={service.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35 }}
          className="mt-14 grid gap-5 md:grid-cols-3"
        >
          {service.plans.map((p) => (
            <div
              key={p.id}
              className={cn(
                "glass relative flex flex-col rounded-3xl p-7 transition-transform hover:-translate-y-1",
                p.popular && "glow-svc md:-mt-4 md:mb-4",
              )}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-svc px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-background">
                  Most Popular
                </span>
              )}
              <h3 className="font-display text-lg font-semibold">{p.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold">{formatInr(p.priceInr)}</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-svc">
                <Coins className="size-3.5" /> {planCostCoins(p)} SparrowCoins
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                <li className="flex items-center gap-3"><Globe2 className="size-4 text-svc" /> Deployed in {regionNames[selectedRegion]}</li>
                <li className="flex items-center gap-3"><MemoryStick className="size-4 text-svc" /> {formatRam(p.ramMb)} DDR5 RAM</li>
                <li className="flex items-center gap-3"><Cpu className="size-4 text-svc" /> {p.vcpu} vCPU</li>
                <li className="flex items-center gap-3"><HardDrive className="size-4 text-svc" /> {p.diskGb}GB NVMe Gen4</li>
                {p.slots && <li className="flex items-center gap-3"><Users className="size-4 text-svc" /> {p.slots} player slots</li>}
                <li className="flex items-center gap-3"><Check className="size-4 text-svc" /> Always-on DDoS protection</li>
              </ul>
              <div className="mt-8 flex-1" />
              {me ? (
                <Button asChild variant={p.popular ? "svc" : "ivory"} size="xl" className="w-full">
                  <Link to="/game/dashboard" search={{ deploy: p.id }}>Deploy in Client Area</Link>
                </Button>
              ) : (
                <Button asChild variant={p.popular ? "svc" : "ivory"} size="xl" className="w-full">
                  <a href={buildGoogleLoginHref(`/game/dashboard?deploy=${p.id}`)}>
                    <GoogleGIcon className="size-4" /> Continue with Google
                  </a>
                </Button>
              )}
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
      <div className="mt-8 max-w-2xl mx-auto">
        <PurchasePolicyNotice />
      </div>
    </section>
  );
}
