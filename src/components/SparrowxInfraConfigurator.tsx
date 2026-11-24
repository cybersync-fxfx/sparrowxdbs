import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Cpu,
  Globe2,
  HardDrive,
  KeyRound,
  MemoryStick,
  Network,
  Server,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { WhatsAppLogo } from "@/components/WhatsAppPlansToaster";
import {
  SiAlmalinux,
  SiAlpinelinux,
  SiArchlinux,
  SiCentos,
  SiDebian,
  SiDocker,
  SiFedora,
  SiFreebsd,
  SiKalilinux,
  SiProxmox,
  SiRockylinux,
  SiUbuntu,
} from "react-icons/si";
import { FaWindows } from "react-icons/fa";
import {
  computePlanPrice,
  INFRA_OS_IMAGES,
  INFRA_PLANS,
  INFRA_REGIONS,
  type BillingCycle,
  type InfraCategory,
  type InfraOsIconKey,
  type InfraOsImage,
  type InfraRegionId,
  type InfraServerPlan,
} from "@/lib/infra-plans";
import { UpiAutoPayModal } from "@/components/UpiAutoPayModal";
import { SparrowxFooter } from "@/components/SparrowxFooter";
import {
  buildWhatsAppSupportUrl,
  WHATSAPP_SUPPORT_DISPLAY,
} from "@/lib/whatsapp-support";

export interface SparrowxInfraConfiguratorProps {
  initialPlanId?: string | undefined;
  initialRegion?: InfraRegionId | undefined;
  initialCycle?: BillingCycle | undefined;
  initialCurrency?: "INR" | "USD" | undefined;
}

const OS_ICON_MAP: Record<InfraOsIconKey, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  ubuntu: SiUbuntu,
  debian: SiDebian,
  almalinux: SiAlmalinux,
  rockylinux: SiRockylinux,
  fedora: SiFedora,
  centos: SiCentos,
  archlinux: SiArchlinux,
  alpinelinux: SiAlpinelinux,
  kalilinux: SiKalilinux,
  freebsd: SiFreebsd,
  windows: FaWindows,
  proxmox: SiProxmox,
  docker: SiDocker,
};

function OsBrandIcon({
  iconKey,
  color,
  className = "size-6",
}: {
  iconKey: InfraOsIconKey;
  color: string;
  className?: string;
}) {
  const Icon = OS_ICON_MAP[iconKey] ?? SiUbuntu;
  return <Icon className={className} style={{ color }} aria-hidden="true" />;
}

export function SparrowxInfraConfigurator({
  initialPlanId,
  initialRegion,
  initialCycle = "monthly",
  initialCurrency = "INR",
}: SparrowxInfraConfiguratorProps) {
  const defaultPlan: InfraServerPlan =
    INFRA_PLANS.find((p) => p.id === initialPlanId) ?? INFRA_PLANS[0]!;

  const [categoryFilter, setCategoryFilter] = useState<InfraCategory | "all">("all");
  const [selectedPlanId, setSelectedPlanId] = useState<string>(defaultPlan.id);
  const [region, setRegion] = useState<InfraRegionId>(
    initialRegion && defaultPlan.regions.includes(initialRegion)
      ? initialRegion
      : (defaultPlan.regions[0] ?? "in-mum"),
  );
  const [osFamilyFilter, setOsFamilyFilter] = useState<"all" | InfraOsImage["family"]>("all");
  const [selectedOsId, setSelectedOsId] = useState<string>("ubuntu-24-04");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialCycle);
  const [currency, setCurrency] = useState<"INR" | "USD">(initialCurrency);
  const [extraIpv4, setExtraIpv4] = useState<number>(0);
  const [enableWireguardMesh, setEnableWireguardMesh] = useState<boolean>(true);
  const [enableNightlyBackup, setEnableNightlyBackup] = useState<boolean>(false);
  const [hostnameInput, setHostnameInput] = useState<string>(`${defaultPlan.id}.sparrowx.local`);
  const [sshPublicKey, setSshPublicKey] = useState<string>("");
  const [contactEmail, setContactEmail] = useState<string>("");
  const [customNotes, setCustomNotes] = useState<string>("");
  const [showUpiCheckout, setShowUpiCheckout] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string>("");

  const selectedPlan = useMemo(
    () => INFRA_PLANS.find((p) => p.id === selectedPlanId) ?? INFRA_PLANS[0]!,
    [selectedPlanId],
  );

  const selectedOs = useMemo(
    () => INFRA_OS_IMAGES.find((o) => o.id === selectedOsId) ?? INFRA_OS_IMAGES[0]!,
    [selectedOsId],
  );

  const selectedRegionObj = useMemo(
    () => INFRA_REGIONS.find((r) => r.id === region) ?? INFRA_REGIONS[0]!,
    [region],
  );

  const visiblePlans = useMemo(
    () =>
      categoryFilter === "all"
        ? INFRA_PLANS
        : INFRA_PLANS.filter((p) => p.category === categoryFilter),
    [categoryFilter],
  );

  const visibleOsImages = useMemo(
    () =>
      osFamilyFilter === "all"
        ? INFRA_OS_IMAGES
        : INFRA_OS_IMAGES.filter((o) => o.family === osFamilyFilter),
    [osFamilyFilter],
  );

  const addonMonthlyUsd =
    selectedOs.monthlyAddonUsd + extraIpv4 * 3 + (enableNightlyBackup ? 8 : 0);

  const pricing = useMemo(
    () => computePlanPrice(selectedPlan, currency, billingCycle, addonMonthlyUsd),
    [selectedPlan, currency, billingCycle, addonMonthlyUsd],
  );

  const totalInrForUpi = useMemo(() => {
    const inrPricing = computePlanPrice(selectedPlan, "INR", billingCycle, addonMonthlyUsd);
    return inrPricing.unitMonthly * inrPricing.cycleMonths;
  }, [selectedPlan, billingCycle, addonMonthlyUsd]);

  const handleSelectPlan = (plan: InfraServerPlan) => {
    setSelectedPlanId(plan.id);
    if (!plan.regions.includes(region)) {
      setRegion(plan.regions[0] ?? "in-mum");
    }
    setHostnameInput(`${plan.id}.sparrowx.local`);
  };

  const customPlanWhatsAppUrl = buildWhatsAppSupportUrl(
    [
      `Hi SparrowX Infra Team! I'd like a Custom Server Plan quote.`,
      `Base reference: ${selectedPlan.name} (${selectedPlan.cpuModel})`,
      `Preferred OS: ${selectedOs.label} ${selectedOs.version}`,
      `Region: ${selectedRegionObj.name}`,
      customNotes.trim() ? `Custom requirements: ${customNotes.trim()}` : "Custom requirements: Please help me size CPU/RAM/NVMe & bandwidth.",
    ].join("\n"),
  );

  const directOrderWhatsAppUrl = buildWhatsAppSupportUrl(
    [
      `Hi SparrowX Infra Team! I want to deploy this server:`,
      `• Plan: ${selectedPlan.name} (${selectedPlan.coresThreads}, ${selectedPlan.ram}, ${selectedPlan.storage})`,
      `• Region: ${selectedRegionObj.name}`,
      `• OS: ${selectedOs.label} ${selectedOs.version}`,
      `• Billing: ${billingCycle} (${pricing.formattedTotal})`,
      `• Hostname: ${hostnameInput || `${selectedPlan.id}.sparrowx.local`}`,
      extraIpv4 > 0 ? `• Extra IPv4: +${extraIpv4}` : "",
      enableNightlyBackup ? `• Nightly Backups: Enabled` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const handleOpenCheckout = () => {
    if (!contactEmail.trim() || !contactEmail.includes("@")) {
      setOrderError("Enter a valid email address so we can deliver your server IP & credentials.");
      return;
    }
    setOrderError("");
    setShowUpiCheckout(true);
  };

  return (
    <div className="min-h-screen bg-[#020307] text-[#F4F6FA] flex flex-col selection:bg-sky-400 selection:text-black">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#020307]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <a
              href="/infra"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:text-white transition-colors"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              <span>All Plans</span>
            </a>
            <div className="hidden sm:flex items-center gap-2 min-w-0">
              <img
                src="/sparrowx-logo.png"
                alt="SparrowX Infra"
                width={26}
                height={26}
                className="size-6.5 object-contain shrink-0"
              />
              <span className="font-bold text-sm tracking-tight text-white truncate">
                SparrowX <span className="text-sky-400">Server Configurator</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-white/15 bg-[#0B0E15] p-0.5 text-xs font-mono">
              {(["INR", "USD"] as const).map((cur) => (
                <button
                  key={cur}
                  type="button"
                  onClick={() => setCurrency(cur)}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    currency === cur
                      ? "bg-sky-400 text-black font-bold"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {cur === "INR" ? "₹ INR" : "$ USD"}
                </button>
              ))}
            </div>

            <a
              href={customPlanWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors"
            >
              <WhatsAppLogo className="size-4 text-[#25D366]" />
              <span className="hidden sm:inline">Custom Plan · WhatsApp</span>
              <span className="sm:hidden">Custom</span>
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-[11px] font-mono text-sky-300">
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>DEDICATED SERVER CONFIGURATOR · INSTANT PROVISIONING</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
            Configure Your {selectedPlan.name}
          </h1>
          <p className="text-sm text-zinc-400 max-w-2xl">
            Pick your hardware tier, datacenter region, operating system, and network options — or message our engineers on WhatsApp for a custom bare-metal or cluster build.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT 8 COLUMNS: Configuration Steps */}
          <div className="lg:col-span-8 space-y-8">
            {/* STEP 1: PLAN SELECTOR */}
            <section className="rounded-2xl border border-white/12 bg-[#080B12]/90 p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-7 place-items-center rounded-lg bg-sky-400/15 border border-sky-400/30 font-mono text-xs font-bold text-sky-300">
                    1
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    Choose Server Plan
                  </h2>
                </div>

                <div className="flex flex-wrap gap-1.5 text-xs">
                  {(
                    [
                      { id: "all", label: "All" },
                      { id: "vps", label: "KVM VPS" },
                      { id: "vds", label: "Dedicated VDS" },
                      { id: "bare-metal", label: "Bare Metal" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCategoryFilter(tab.id)}
                      className={`rounded-lg px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                        categoryFilter === tab.id
                          ? "bg-white text-black font-semibold"
                          : "border border-white/10 bg-white/[0.03] text-zinc-300 hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
                {visiblePlans.map((plan) => {
                  const active = plan.id === selectedPlan.id;
                  const p = computePlanPrice(plan, currency, billingCycle, 0);
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => handleSelectPlan(plan)}
                      className={`rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                        active
                          ? "border-sky-400 bg-sky-400/10 ring-1 ring-sky-400/40"
                          : "border-white/10 bg-[#05070D] hover:border-white/25"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-white truncate">
                          {plan.name}
                        </span>
                        <span className="font-mono text-xs font-bold text-sky-300 shrink-0">
                          {p.formattedMonthly}/mo
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-400 truncate">
                        {plan.cpuModel}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 font-mono text-[10px] text-zinc-300">
                        <span>{plan.coresThreads}</span>
                        <span>·</span>
                        <span>{plan.ram}</span>
                        <span>·</span>
                        <span>{plan.storage}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* STEP 2: DATACENTER REGION */}
            <section className="rounded-2xl border border-white/12 bg-[#080B12]/90 p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-lg bg-sky-400/15 border border-sky-400/30 font-mono text-xs font-bold text-sky-300">
                  2
                </span>
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Datacenter Region
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {INFRA_REGIONS.map((r) => {
                  const supported = selectedPlan.regions.includes(r.id);
                  const active = region === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={!supported}
                      onClick={() => setRegion(r.id)}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        !supported
                          ? "border-white/5 bg-white/[0.01] opacity-40 cursor-not-allowed"
                          : active
                            ? "border-sky-400 bg-sky-400/10 ring-1 ring-sky-400/40 cursor-pointer"
                            : "border-white/10 bg-[#05070D] hover:border-white/25 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{r.flag}</span>
                          <span className="font-bold text-sm text-white">{r.name}</span>
                        </div>
                        <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] text-zinc-200">
                          {r.code}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-zinc-400">{r.city}</p>
                      <p className="mt-1 font-mono text-[11px] text-sky-300">{r.uplink}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* STEP 3: OPERATING SYSTEM WITH REAL IMPORTED OS ICONS */}
            <section
              id="os-selection"
              className="rounded-2xl border border-white/12 bg-[#080B12]/90 p-5 sm:p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-7 place-items-center rounded-lg bg-sky-400/15 border border-sky-400/30 font-mono text-xs font-bold text-sky-300">
                    3
                  </span>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white">
                      Choose Operating System
                    </h2>
                    <p className="text-xs text-zinc-400">
                      15 pre-hardened Linux, Windows Server, Hypervisor &amp; Docker images
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 text-xs">
                  {(["all", "Linux", "Windows", "Hypervisor", "Apps"] as const).map((fam) => (
                    <button
                      key={fam}
                      type="button"
                      onClick={() => setOsFamilyFilter(fam)}
                      className={`rounded-lg px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                        osFamilyFilter === fam
                          ? "bg-white text-black font-semibold"
                          : "border border-white/10 bg-white/[0.03] text-zinc-300 hover:text-white"
                      }`}
                    >
                      {fam === "all" ? "All OS" : fam}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {visibleOsImages.map((os) => {
                  const active = os.id === selectedOsId;
                  return (
                    <button
                      key={os.id}
                      type="button"
                      onClick={() => setSelectedOsId(os.id)}
                      data-os-id={os.id}
                      className={`group relative rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                        active
                          ? "border-sky-400 bg-sky-400/10 ring-1 ring-sky-400/40"
                          : "border-white/10 bg-[#05070D] hover:border-white/25 hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
                          <OsBrandIcon
                            iconKey={os.iconKey}
                            color={os.brandColor}
                            className="size-5"
                          />
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                            os.monthlyAddonUsd > 0
                              ? "border border-amber-400/35 bg-amber-400/10 text-amber-300"
                              : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          }`}
                        >
                          {os.monthlyAddonUsd > 0
                            ? currency === "INR"
                              ? `+₹${Math.round(os.monthlyAddonUsd * 84)}/mo`
                              : `+$${os.monthlyAddonUsd}/mo`
                            : "Free"}
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-sm text-white">{os.label}</span>
                          {active && <Check className="size-4 text-sky-400 shrink-0" />}
                        </div>
                        <p className="font-mono text-[11px] text-sky-300">{os.version}</p>
                        <p className="mt-1 text-[11px] text-zinc-400 leading-snug">
                          {os.tagline}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* STEP 4: HOSTNAME, ACCESS & NETWORK ADD-ONS */}
            <section className="rounded-2xl border border-white/12 bg-[#080B12]/90 p-5 sm:p-6 space-y-5">
              <div className="flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-lg bg-sky-400/15 border border-sky-400/30 font-mono text-xs font-bold text-sky-300">
                  4
                </span>
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Hostname, Billing &amp; Add-ons
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="spx-hostname" className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Server Hostname
                  </label>
                  <input
                    id="spx-hostname"
                    type="text"
                    value={hostnameInput}
                    onChange={(e) => setHostnameInput(e.target.value)}
                    placeholder="app-prod-01.sparrowx.local"
                    className="w-full rounded-xl border border-white/15 bg-[#05070D] px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div>
                  <label htmlFor="spx-email" className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Delivery Email (IP &amp; Root Credentials)
                  </label>
                  <input
                    id="spx-email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-xl border border-white/15 bg-[#05070D] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="spx-sshkey" className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 mb-1.5">
                  <KeyRound className="size-3.5 text-sky-400" aria-hidden="true" />
                  <span>SSH Public Key (Optional — leave blank for generated root password)</span>
                </label>
                <textarea
                  id="spx-sshkey"
                  rows={2}
                  value={sshPublicKey}
                  onChange={(e) => setSshPublicKey(e.target.value)}
                  placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI..."
                  className="w-full rounded-xl border border-white/15 bg-[#05070D] px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(
                  [
                    { id: "monthly", label: "Monthly", badge: "Flexible" },
                    { id: "quarterly", label: "Quarterly", badge: "Save 5%" },
                    { id: "annual", label: "Annual", badge: "Save 15%" },
                  ] as const
                ).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setBillingCycle(c.id)}
                    className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
                      billingCycle === c.id
                        ? "border-sky-400 bg-sky-400/10"
                        : "border-white/10 bg-[#05070D] hover:border-white/25"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{c.label}</span>
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                        {c.badge}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="rounded-xl border border-white/10 bg-[#05070D] p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">Extra IPv4</span>
                    <span className="font-mono text-[11px] text-sky-300">
                      {currency === "INR" ? "+₹252/IP" : "+$3/IP"}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    {[0, 1, 2, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setExtraIpv4(n)}
                        className={`flex-1 rounded-lg py-1 font-mono text-xs cursor-pointer ${
                          extraIpv4 === n
                            ? "bg-sky-400 text-black font-bold"
                            : "bg-white/5 text-zinc-300 hover:bg-white/10"
                        }`}
                      >
                        +{n}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="rounded-xl border border-white/10 bg-[#05070D] p-3.5 flex flex-col justify-between cursor-pointer hover:border-white/25">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white">WireGuard Mesh</span>
                    <input
                      type="checkbox"
                      checked={enableWireguardMesh}
                      onChange={(e) => setEnableWireguardMesh(e.target.checked)}
                      className="accent-sky-400 size-4"
                    />
                  </div>
                  <span className="mt-2 font-mono text-[11px] text-emerald-300">Included Free</span>
                </label>

                <label className="rounded-xl border border-white/10 bg-[#05070D] p-3.5 flex flex-col justify-between cursor-pointer hover:border-white/25">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white">Nightly Backups</span>
                    <input
                      type="checkbox"
                      checked={enableNightlyBackup}
                      onChange={(e) => setEnableNightlyBackup(e.target.checked)}
                      className="accent-sky-400 size-4"
                    />
                  </div>
                  <span className="mt-2 font-mono text-[11px] text-sky-300">
                    {currency === "INR" ? "+₹672/mo" : "+$8/mo"}
                  </span>
                </label>
              </div>
            </section>

            {/* STEP 5: CUSTOM SERVER PLAN ON WHATSAPP */}
            <section
              id="custom-plan"
              className="rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-emerald-950/35 via-[#07110E] to-[#05070D] p-5 sm:p-6 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-[#25D366] text-white shadow-[0_6px_18px_rgba(37,211,102,0.4)]">
                    <WhatsAppLogo className="size-6" />
                  </span>
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      Custom Hardware · Bare Metal · Multi-Node Clusters
                    </p>
                    <h2 className="text-base sm:text-lg font-bold text-white">
                      Need a Custom Plan? Talk to Us on WhatsApp
                    </h2>
                  </div>
                </div>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs text-emerald-300">
                  {WHATSAPP_SUPPORT_DISPLAY}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                Need custom RAM, extra NVMe RAID arrays, dedicated GPU, /28 IPv4 subnets, custom ISO mounting, or enterprise DDoS rules? Type your desired specs below and message our engineers directly on WhatsApp for an instant custom quote.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="e.g., 64 GB RAM, 2 TB NVMe RAID-10, Ubuntu 24.04, 10 Gbps Mumbai..."
                  className="flex-1 rounded-xl border border-emerald-500/30 bg-black/50 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-400"
                />
                <a
                  href={customPlanWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#2ee573] px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-950 transition-colors shrink-0 shadow-[0_6px_20px_rgba(37,211,102,0.35)]"
                >
                  <WhatsAppLogo className="size-[18px]" />
                  <span>Contact on WhatsApp</span>
                </a>
              </div>
            </section>
          </div>

          {/* RIGHT 4 COLUMNS: Sticky Order Summary */}
          <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
            <div className="rounded-2xl border border-white/15 bg-[#080B12]/95 p-5 sm:p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-sky-400">
                    Configuration Summary
                  </p>
                  <h3 className="text-lg font-bold text-white mt-0.5">{selectedPlan.name}</h3>
                </div>
                <Server className="size-5 text-sky-400" aria-hidden="true" />
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Cpu className="size-3.5 text-sky-400" /> Compute
                  </span>
                  <span className="font-mono text-white text-right">{selectedPlan.coresThreads}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <MemoryStick className="size-3.5 text-sky-400" /> Memory
                  </span>
                  <span className="font-mono text-white text-right">{selectedPlan.ram}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <HardDrive className="size-3.5 text-sky-400" /> Storage
                  </span>
                  <span className="font-mono text-white text-right">{selectedPlan.storage}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Network className="size-3.5 text-sky-400" /> Network
                  </span>
                  <span className="font-mono text-white text-right">{selectedPlan.network}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Globe2 className="size-3.5 text-sky-400" /> Region
                  </span>
                  <span className="font-mono text-white text-right">
                    {selectedRegionObj.flag} {selectedRegionObj.name}
                  </span>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#05070D] p-3 flex items-center gap-3 mt-2">
                  <OsBrandIcon
                    iconKey={selectedOs.iconKey}
                    color={selectedOs.brandColor}
                    className="size-5 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {selectedOs.label} {selectedOs.version}
                    </p>
                    <p className="text-[10px] text-zinc-400 truncate">{selectedOs.tagline}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4 space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-zinc-400">Monthly equivalent</span>
                  <span className="font-mono text-sm text-zinc-200">{pricing.formattedMonthly}/mo</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-white">
                    Total ({pricing.cycleMonths} {pricing.cycleMonths === 1 ? "month" : "months"})
                  </span>
                  <span className="font-mono text-2xl font-extrabold text-sky-400">
                    {pricing.formattedTotal}
                  </span>
                </div>
              </div>

              {orderError && (
                <p className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {orderError}
                </p>
              )}

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleOpenCheckout}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-400 hover:bg-sky-300 px-4 py-3 text-sm font-bold text-black transition-colors cursor-pointer"
                >
                  <span>Deploy Server Now</span>
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>

                <a
                  href={directOrderWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-4 py-2.5 text-xs font-semibold text-emerald-300 transition-colors"
                >
                  <WhatsAppLogo className="size-4 text-[#25D366]" />
                  <span>Order or Custom Quote on WhatsApp</span>
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400 pt-1">
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <ShieldCheck className="size-3.5" /> XDP DDoS Shield
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="size-3.5 text-sky-400" /> {selectedPlan.deployTime} deploy
                </span>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <SparrowxFooter />

      <UpiAutoPayModal
        open={showUpiCheckout}
        onClose={() => setShowUpiCheckout(false)}
        service="infra"
        planId={selectedPlan.id}
        planName={`${selectedPlan.name} (${selectedOs.label} ${selectedOs.version})`}
        amountInr={totalInrForUpi}
        customerEmail={contactEmail}
        metadata={{
          category: selectedPlan.category,
          region,
          os: `${selectedOs.label} ${selectedOs.version}`,
          hostname: hostnameInput || `${selectedPlan.id}.sparrowx.local`,
        }}
      />
    </div>
  );
}
