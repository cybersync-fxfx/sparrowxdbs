import { Check, Layers, X } from "lucide-react";

export function ComparisonSection() {
  return (
    <section
      id="comparison"
      className="border-t border-white/15 bg-black px-4 sm:px-6 py-16 scroll-mt-24"
    >
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
            Why Builders Choose SparrowX vs Legacy Monopolies
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
            We eliminated the corporate red tape, mandatory credit cards for simple utilities, and
            surprise bandwidth bills. Here is how we compare.
          </p>
        </div>

        <div className="border border-white/25 bg-[#0A0A0A] rounded-lg overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-white/25 bg-[#121212] text-zinc-300">
                  <th className="p-4 font-bold text-white uppercase tracking-wider text-[11px] w-1/3">
                    Core Capability
                  </th>
                  <th className="p-4 font-bold text-white uppercase tracking-wider text-[11px] w-1/3 bg-white/[0.08]">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-400" aria-hidden="true" />
                      <span>SparrowX Cloud</span>
                    </div>
                  </th>
                  <th className="p-4 font-bold text-zinc-400 uppercase tracking-wider text-[11px] w-1/3">
                    Legacy Cloud Providers
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/15 text-zinc-300">
                <tr className="hover:bg-white/[0.03] transition-colors">
                  <td className="p-4 font-semibold text-white">Utility Access (Keys, File Drop)</td>
                  <td className="p-4 bg-white/[0.05] text-white">
                    <div className="flex items-start gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>Zero login required. 100% instant browser execution</span>
                    </div>
                  </td>
                  <td className="p-4 text-zinc-400">
                    <div className="flex items-start gap-2">
                      <X className="size-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>Mandatory account, phone SMS verification &amp; credit card</span>
                    </div>
                  </td>
                </tr>
                <tr className="hover:bg-white/[0.03] transition-colors">
                  <td className="p-4 font-semibold text-white">Bandwidth &amp; Data Egress</td>
                  <td className="p-4 bg-white/[0.05] text-white">
                    <div className="flex items-start gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>100% Free unmetered egress. Zero surprise bills</span>
                    </div>
                  </td>
                  <td className="p-4 text-zinc-400">
                    <div className="flex items-start gap-2">
                      <X className="size-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>Punitive $0.09/GB egress tax charged every month</span>
                    </div>
                  </td>
                </tr>
                <tr className="hover:bg-white/[0.03] transition-colors">
                  <td className="p-4 font-semibold text-white">
                    Data Privacy &amp; Sovereign Keys
                  </td>
                  <td className="p-4 bg-white/[0.05] text-white">
                    <div className="flex items-start gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        Native W3C WebCrypto, ephemeral RAM wipes, zero telemetry tracking
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-zinc-400">
                    <div className="flex items-start gap-2">
                      <X className="size-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>Centralized metadata logging &amp; tracking for marketing</span>
                    </div>
                  </td>
                </tr>
                <tr className="hover:bg-white/[0.03] transition-colors">
                  <td className="p-4 font-semibold text-white">Autonomous DDoS Defense</td>
                  <td className="p-4 bg-white/[0.05] text-white">
                    <div className="flex items-start gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>Sub-second automated Anycast deflection &amp; origin cloaking</span>
                    </div>
                  </td>
                  <td className="p-4 text-zinc-400">
                    <div className="flex items-start gap-2">
                      <X className="size-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>High enterprise add-on costs ($3,000+/mo) or delayed blackholing</span>
                    </div>
                  </td>
                </tr>
                <tr className="hover:bg-white/[0.03] transition-colors">
                  <td className="p-4 font-semibold text-white">Engineering Support Access</td>
                  <td className="p-4 bg-white/[0.05] text-white">
                    <div className="flex items-start gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        Direct email &amp; Discord access to the engineers writing the code (&lt;
                        4hr SLA)
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-zinc-400">
                    <div className="flex items-start gap-2">
                      <X className="size-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>Tiered paywalled support contracts ($100+/mo) or slow bots</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
