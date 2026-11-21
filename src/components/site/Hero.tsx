import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Service, ServiceId } from "@/lib/services";
import { ServiceSwitcher } from "./ServiceSwitcher";
import { TelemetryCard } from "./TelemetryCard";
import { Floating3DVisual } from "@/components/ui/Floating3DVisual";

export function Hero({ service, onService }: { service: Service; onService: (s: ServiceId) => void }) {
  return (
    <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden pb-16 pt-36 md:pt-32">
      <AnimatePresence>
        <motion.img
          key={service.id}
          src={service.image}
          alt=""
          aria-hidden
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
      </AnimatePresence>
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/85 to-background/30" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-transparent to-background/60" />
      <div className="pointer-events-none absolute -left-40 top-1/3 -z-10 size-[520px] rounded-full bg-svc/25 blur-[140px]" />
      <div className="absolute inset-0 -z-10 grid-fade" />

      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <AnimatePresence mode="wait">
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-svc/40 bg-svc/10 px-3.5 py-1.5 font-mono text-xs font-medium text-svc">
                <span className="size-1.5 rounded-full bg-svc animate-pulse-dot" />
                {service.badge}
              </span>
              <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
                <span className="text-svc-gradient">{service.headline}</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">{service.sub}</p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button asChild variant="ivory" size="xl">
              <a href="#pricing">
                View {service.name} plans <ArrowRight />
              </a>
            </Button>
            <Button asChild variant="glass" size="xl">
              <a href="#performance">Compare performance</a>
            </Button>
          </div>

          <div className="mt-10 hidden sm:block">
            <ServiceSwitcher value={service.id} onChange={onService} layoutId="hero-pill" size="lg" />
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Zap className="size-4 text-svc" /> Instant deploy</span>
            <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-svc" /> L7 DDoS shield</span>
            <span className="flex items-center gap-2"><span className="font-mono text-svc">₹</span> Pay in INR or SparrowCoins</span>
          </div>
        </div>

        <div className="flex flex-col items-center lg:items-end gap-5" style={{ perspective: 1200 }}>
          <Floating3DVisual
            src="/3d/game-server-node.svg"
            alt={`3D floating high-frequency ${service.name} Ryzen NVMe game server blade`}
            accent="orange"
            size="md"
            priority="lcp"
            showMotionControl={true}
            caption={`${service.name} · High-Frequency NVMe Node`}
            className="w-full max-w-[380px] border border-white/12 bg-[#07090F]/80 backdrop-blur-md"
            width={480}
            height={480}
          />
          <TelemetryCard service={service} />
        </div>
      </div>
    </section>
  );
}
