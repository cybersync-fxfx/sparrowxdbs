import { motion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Service, ServiceId } from "@/lib/services";

type Metric = { title: string; unit: string; sx: number; budget: number; sxLabel: string; budgetLabel: string; max: number; note: string };

const TICK: Record<ServiceId, { unit: string; sx: number; budget: number; max: number; title: string }> = {
  fivem: { title: "Server Tick Rate", unit: "FPS", sx: 60, budget: 34, max: 64 },
  samp: { title: "Server Tick Rate", unit: "FPS", sx: 250, budget: 140, max: 260 },
  minecraft: { title: "Server Tick Rate", unit: "TPS", sx: 20, budget: 13.6, max: 20 },
  discord: { title: "Event Loop Throughput", unit: "ev/s", sx: 4800, budget: 2100, max: 5000 },
};

function metricsFor(id: ServiceId): Metric[] {
  const t = TICK[id];
  return [
    { title: t.title, unit: t.unit, sx: t.sx, budget: t.budget, sxLabel: `${t.sx} ${t.unit}`, budgetLabel: `${t.budget} ${t.unit}`, max: t.max, note: "Higher is better" },
    { title: "DDoS Mitigation Speed", unit: "s", sx: 0.8, budget: 45, sxLabel: "< 1s", budgetLabel: "~45s", max: 45, note: "Lower is better" },
    { title: "Asia / India Ping", unit: "ms", sx: 13, budget: 62, sxLabel: "12–15ms", budgetLabel: "48–70ms", max: 70, note: "Lower is better" },
  ];
}

function series(id: ServiceId) {
  const t = TICK[id];
  let seed = id.length * 97;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: 30 }, (_, i) => ({
    min: `${i * 2}m`,
    sparrowx: +(t.sx * (0.985 + rnd() * 0.015)).toFixed(1),
    budget: +(t.budget * (0.75 + rnd() * 0.45) - (i % 9 === 4 ? t.budget * 0.35 : 0)).toFixed(1),
  }));
}

function CompareBars({ m, i }: { m: Metric; i: number }) {
  const pct = (v: number) => Math.max(4, (v / m.max) * 100);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay: i * 0.1 }}
      className="glass rounded-2xl p-5"
    >
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-sm font-semibold">{m.title}</h3>
        <span className="text-[11px] text-muted-foreground">{m.note}</span>
      </div>
      {[
        { label: "SparrowX NVMe Gen4", v: m.sx, text: m.sxLabel, cls: "bg-svc glow-svc", txt: "text-svc" },
        { label: "Budget host average", v: m.budget, text: m.budgetLabel, cls: "bg-muted-foreground/40", txt: "text-muted-foreground" },
      ].map((row, j) => (
        <div key={row.label} className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="text-muted-foreground">{row.label}</span>
            <span className={`font-mono font-semibold ${row.txt}`}>{row.text}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className={`h-full rounded-full ${row.cls}`}
              initial={{ width: 0 }}
              whileInView={{ width: `${pct(row.v)}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.2 + j * 0.15, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      ))}
    </motion.div>
  );
}

export function Performance({ service }: { service: Service }) {
  const metrics = metricsFor(service.id);
  const data = series(service.id);
  const t = TICK[service.id];
  return (
    <section id="performance" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 py-24">
      <div className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-svc">Benchmarks</p>
        <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Measured, not marketed.</h2>
        <p className="mt-4 text-muted-foreground">
          {service.name} on SparrowX NVMe Gen4 nodes versus the average budget host, under a sustained player-load test from Mumbai.
        </p>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {metrics.map((m, i) => (
          <CompareBars key={`${service.id}-${m.title}`} m={m} i={i} />
        ))}
      </div>

      <div className="glass mt-4 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-sm font-semibold">{t.title} over a 60-minute stress test</h3>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-svc" /> SparrowX</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted-foreground/50" /> Budget host</span>
          </div>
        </div>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: -18, right: 6, top: 6 }}>
              <defs>
                <linearGradient id="sxFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--svc)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--svc)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="min" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, t.max]} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }}
                formatter={(v: number, n: string) => [`${v} ${t.unit}`, n === "sparrowx" ? "SparrowX" : "Budget host"]}
              />
              <Area type="monotone" dataKey="budget" stroke="var(--muted-foreground)" strokeOpacity={0.6} fill="transparent" strokeWidth={1.5} />
              <Area type="monotone" dataKey="sparrowx" stroke="var(--svc)" fill="url(#sxFill)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
