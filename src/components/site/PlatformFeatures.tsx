import { useState } from "react";
import { ArrowRight, CheckCircle2, Cpu, Layers, Lock, ShieldCheck, Sliders, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EGG_RESOURCE_PROFILES } from "@/lib/egg-smart-plans";
import { formatRam } from "@/lib/services";
import { useSessionSummary } from "./Navbar";

type FeatureKey = "sizing" | "wizard" | "panel-sync" | "edge-shield";

const FEATURE_ITEMS: Array<{
  id: FeatureKey;
  title: string;
  summary: string;
  icon: typeof Sliders;
}> = [
  {
    id: "sizing",
    title: "Automatic five-tier hardware sizing",
    summary:
      "Every game, bot, database, and runtime builds its own realistic RAM and CPU ladder so you never under-provision Minecraft or overpay for SA-MP.",
    icon: Sliders,
  },
  {
    id: "wizard",
    title: "Guided setup with zero unsafe defaults",
    summary:
      "Before a server ever boots, we clear weak defaults like changeme RCON passwords, ask for required tokens or licenses, and generate secure credentials.",
    icon: Lock,
  },
  {
    id: "panel-sync",
    title: "Direct client area and panel sync",
    summary:
      "Edit startup variables, switch Docker images, swap among 321 eggs, and jump straight into Console, Files, Databases, or Backups with single sign-on.",
    icon: Layers,
  },
  {
    id: "edge-shield",
    title: "Indian NVMe Gen4 edge and DDoS defense",
    summary:
      "High-clock cores, NVMe Gen4 chunk storage, and sub-second L7 and UDP DDoS mitigation tuned for Asia and India players.",
    icon: ShieldCheck,
  },
];

const SIZING_PREVIEWS = [
  {
    key: "samp",
    label: "SA-MP",
    range: "1GB to 8GB RAM",
    names: ["Grove Street", "Idlewood Turf", "Los Santos RP", "San Fierro City", "Las Venturas Max"],
    profile: EGG_RESOURCE_PROFILES.samp,
  },
  {
    key: "mc-java",
    label: "Minecraft Java",
    range: "3GB to 16GB RAM",
    names: ["Oak SMP", "Iron Realm", "Diamond Core", "Netherite Pro", "Ender Titan"],
    profile: EGG_RESOURCE_PROFILES["mc-java"],
  },
  {
    key: "heavy",
    label: "Rust / Palworld",
    range: "6GB to 24GB RAM",
    names: ["Beach Naked", "Wood Base", "Stone Compound", "HQM Citadel", "Zerg Wipe"],
    profile: EGG_RESOURCE_PROFILES.heavy,
  },
  {
    key: "bot",
    label: "Bots & Python",
    range: "512MB to 4GB RAM",
    names: ["PyScript", "FastAPI Core", "Async Worker", "Data Engine", "Compute Pro"],
    profile: EGG_RESOURCE_PROFILES.bot,
  },
] as const;

export function PlatformFeatures() {
  const { data: me } = useSessionSummary();
  const [activeFeature, setActiveFeature] = useState<FeatureKey>("sizing");
  const [sizingSample, setSizingSample] = useState<number>(0);

  const ctaHref = me ? "/game/dashboard" : "/login?next=%2Fgame%2Fdashboard";
  const currentSizing = SIZING_PREVIEWS[sizingSample] ?? SIZING_PREVIEWS[0];

  return (
    <section id="features" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-24 border-t border-white/[0.06]">
      <div className="max-w-2xl">
        <h2 className="font-display text-3xl font-bold tracking-[-0.025em] text-white sm:text-4xl">
          Built to Configure Every Server Properly
        </h2>
        <p className="mt-4 text-base leading-relaxed text-slate-300">
          Instead of generic one-size-fits-all plans, the Client Area and Pterodactyl Panel work as one synchronized control plane.
        </p>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.15fr] items-start">
        {/* Left: Interactive Feature List */}
        <div role="tablist" aria-label="Platform capabilities" className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {FEATURE_ITEMS.map((item) => {
            const Icon = item.icon;
            const selected = activeFeature === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveFeature(item.id)}
                className={`w-full py-5 px-4 text-left transition-colors duration-200 flex items-start gap-4 ${
                  selected ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                }`}
              >
                <Icon
                  className={`mt-0.5 size-5 shrink-0 ${selected ? "text-emerald-400" : "text-slate-400"}`}
                  aria-hidden="true"
                />
                <div>
                  <h3 className={`text-base font-semibold ${selected ? "text-white" : "text-slate-300"}`}>
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                    {item.summary}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Live Interactive Preview Stage */}
        <div className="rounded-3xl border border-white/10 bg-[#0b0e17] p-6 sm:p-8">
          {activeFeature === "sizing" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold text-white">
                    Smart Tier Preview
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Switch an egg below to see how hardware tiers adapt automatically.
                  </p>
                </div>
                <span className="tabular-nums text-sm font-semibold text-emerald-300">
                  {currentSizing.range}
                </span>
              </div>

              <div role="radiogroup" aria-label="Sample game profile" className="flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-[#05060a] p-1">
                {SIZING_PREVIEWS.map((sample, idx) => (
                  <label
                    key={sample.key}
                    className={`flex-1 min-w-[110px] cursor-pointer rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
                      sizingSample === idx
                        ? "bg-emerald-500 text-zinc-950 font-semibold"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sizing-preview"
                      checked={sizingSample === idx}
                      onChange={() => setSizingSample(idx)}
                      className="sr-only"
                    />
                    <span>{sample.label}</span>
                  </label>
                ))}
              </div>

              <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-[#05060a] px-4">
                {currentSizing.profile.plans.map((tier, idx) => (
                  <div key={tier.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className={`font-medium ${tier.popular ? "text-emerald-300 font-semibold" : "text-white"}`}>
                      {currentSizing.names[idx]}
                    </span>
                    <span className="tabular-nums text-slate-300">
                      {formatRam(tier.ramMb)} RAM · {tier.vcpu} vCPU · {tier.diskGb} GB NVMe
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeFeature === "wizard" && (
            <div className="space-y-5">
              <div>
                <h3 className="font-display text-lg font-semibold text-white">
                  Pre-Launch Security &amp; Setup Gate
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Unsafe egg defaults are stripped before creation and replaced with real user settings.
                </p>
              </div>
              <ul className="space-y-3 text-sm text-slate-200">
                <li className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-[#05060a] p-4">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  <span>SA-MP and open.mp clear default &ldquo;changeme&rdquo; RCON passwords and provide one-click strong password generation.</span>
                </li>
                <li className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-[#05060a] p-4">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  <span>FiveM and RedM prompt for your Cfx.re registration key with a direct link before container allocation.</span>
                </li>
                <li className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-[#05060a] p-4">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  <span>Databases and bots require real root credentials and bot tokens so every service boots ready for traffic.</span>
                </li>
              </ul>
            </div>
          )}

          {activeFeature === "panel-sync" && (
            <div className="space-y-5">
              <div>
                <h3 className="font-display text-lg font-semibold text-white">
                  One Login Across Client Area &amp; Panel
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Manage high-level configuration in the Client Area and jump straight to deep server tools without signing in twice.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                {[
                  { title: "Live Startup Variables", detail: "Read and write Pterodactyl env vars and Docker runtimes live." },
                  { title: "321-Egg Switcher", detail: "Swap Paper to Purpur, Node to Python, or switch games anytime." },
                  { title: "Direct SSO Deep Links", detail: "Open Console, Files, Databases, Backups, and Schedules in one click." },
                  { title: "Automatic Repo Sync", detail: "All three official Pterodactyl egg repositories stay updated via CLI." },
                ].map((row) => (
                  <div key={row.title} className="rounded-2xl border border-white/[0.08] bg-[#05060a] p-4">
                    <p className="font-semibold text-white flex items-center gap-2">
                      <Terminal className="size-4 text-emerald-400 shrink-0" aria-hidden="true" />
                      <span>{row.title}</span>
                    </p>
                    <p className="mt-1.5 text-sm text-slate-400">{row.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeFeature === "edge-shield" && (
            <div className="space-y-5">
              <div>
                <h3 className="font-display text-lg font-semibold text-white">
                  High-Clock Silicon Built for Low Ping
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Engineered for consistent tick rates under peak player counts and automated DDoS bursts.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                {[
                  { metric: "12 to 15 ms", label: "Typical Mumbai and South Asia latency" },
                  { metric: "NVMe Gen4", label: "Fast world saves, chunk loading, and MLO streaming" },
                  { metric: "Under 1 sec", label: "Automated L7 and UDP packet scrubbing response" },
                  { metric: "99.99%", label: "Target node availability with automated backups" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/[0.08] bg-[#05060a] p-4">
                    <p className="font-display text-xl font-bold tabular-nums text-emerald-300 flex items-center gap-2">
                      <Cpu className="size-4 shrink-0" aria-hidden="true" />
                      <span>{stat.metric}</span>
                    </p>
                    <p className="mt-1.5 text-sm text-slate-400">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 border-t border-white/[0.08] pt-6 flex items-center justify-between gap-4">
            <p className="text-sm text-slate-400">
              View tailored plans inside the Client Area.
            </p>
            <Button asChild variant="ivory" size="sm" className="rounded-xl px-4 text-sm font-semibold shrink-0">
              <a href={ctaHref}>
                <span>{me ? "Open Client Area" : "Sign In"}</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
