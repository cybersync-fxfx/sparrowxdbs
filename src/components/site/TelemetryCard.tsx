import { motion, AnimatePresence } from "framer-motion";
import { Activity, Cpu, HardDrive, Radio } from "lucide-react";
import type { Service } from "@/lib/services";

function Bar({ label, value, display, delay }: { label: string; value: number; display: string; delay: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold text-foreground">{display}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-svc"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

export function TelemetryCard({ service }: { service: Service }) {
  const t = service.telemetry;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={service.id}
        initial={{ opacity: 0, y: 24, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="glass w-full max-w-sm rounded-3xl p-5 glow-svc"
      >
        <div className="flex items-center gap-3">
          <img src={service.image} alt={`${service.name} server preview`} className="size-14 rounded-2xl object-cover ring-1 ring-svc/50" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold">{service.name} Node</p>
            <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-success animate-pulse-dot" />
              Asia-IN • NVMe Gen4
            </p>
          </div>
          <span className="rounded-full bg-success/15 px-2.5 py-1 font-mono text-[10px] font-semibold text-success">LIVE</span>
        </div>

        <div className="mt-5 space-y-4">
          <Bar label={t.tickLabel} value={t.tick} display={`${t.tick}%`} delay={0.1} />
          <Bar label="Network Latency" value={100 - t.latencyMs * 2} display={`${t.latencyMs}ms`} delay={0.2} />
          <Bar label="Uptime SLA" value={t.uptime} display={`${t.uptime}%`} delay={0.3} />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
          {[
            { icon: Cpu, label: "Ryzen 9" },
            { icon: HardDrive, label: "Gen4 NVMe" },
            { icon: Radio, label: "Anti-DDoS" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <Icon className="size-4 text-svc" />
              <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Activity className="size-3" /> Sampled from Mumbai edge, last 24h
        </p>
      </motion.div>
    </AnimatePresence>
  );
}
