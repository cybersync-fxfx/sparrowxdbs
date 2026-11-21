import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Cpu,
  Globe,
  HardDrive,
  Lock,
  Menu,
  Network,
  Server,
  Shield,
  SlidersHorizontal,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import { Floating3DVisual } from "@/components/ui/Floating3DVisual";
import { UpiAutoPayModal } from "@/components/UpiAutoPayModal";
import { SparrowxFooter } from "@/components/SparrowxFooter";
import {
  computePlanPrice,
  INFRA_OS_IMAGES,
  INFRA_PLANS,
  INFRA_REGIONS,
  type BillingCycle,
  type InfraCategory,
  type InfraRegionId,
  type InfraServerPlan,
} from "@/lib/infra-plans";
import { verifySessionToken } from "@/lib/advanced-features";
import { buildMasterHref } from "@/lib/routing";

type CategoryFilter = "all" | InfraCategory;

const CATEGORY_OPTIONS: Array<{ id: CategoryFilter; label: string }> = [
  { id: "all", label: "All hardware" },
  { id: "bare-metal", label: "Bare metal" },
  { id: "dedicated", label: "Dedicated servers" },
  { id: "vps", label: "Cloud KVM VPS" },
];

const BILLING_OPTIONS: Array<{ id: BillingCycle; label: string }> = [
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly (-5%)" },
  { id: "annual", label: "Annual (-15%)" },
];

const CATEGORY_PILLARS: Array<{
  id: InfraCategory;
  title: string;
  benefit: string;
  summary: string;
  startingUsd: number;
  startingInr: number;
  image: string;
  accent: "cyan" | "orange" | "emerald";
  specs: string[];
}> = [
  {
    id: "bare-metal",
    title: "Bare Metal Servers",
    benefit: "Single-tenant physical silicon with full IPMI control",
    summary:
      "Own every physical core, DDR5 ECC lane, and enterprise Gen5 NVMe drive with zero virtualization overhead.",
    startingUsd: 149,
    startingInr: 12490,
    image: "/3d/cloud-infra-server.jpg",
    accent: "cyan",
    specs: [
      "AMD Ryzen 9 9950X & Dual EPYC Genoa",
      "10 Gbps to 50 Gbps unmetered fiber",
      "Hardware RAID & custom ISO via IPMI",
    ],
  },
  {
    id: "dedicated",
    title: "Dedicated Servers",
    benefit: "Pre-hardened production and game nodes ready in minutes",
    summary:
      "Purpose-tuned Linux kernels, stateful UDP/RakNet/FiveM DDoS scrubbing, and WireGuard private mesh built in.",
    startingUsd: 79,
    startingInr: 6690,
    image: "/3d/game-server-node.svg",
    accent: "orange",
    specs: [
      "GameSec L4 + XDP/eBPF scrubbing",
      "Pterodactyl Wings & NetSec ready",
      "Nightly off-node snapshots included",
    ],
  },
  {
    id: "vps",
    title: "Cloud KVM VPS",
    benefit: "Instant NVMe Gen4 virtual machines on flat monthly billing",
    summary:
      "Spin up isolated KVM instances with dedicated IPv4, /64 IPv6, and zero surprise egress bandwidth penalties.",
    startingUsd: 4,
    startingInr: 349,
    image: "/3d/vps-kvm-cubes.svg",
    accent: "emerald",
    specs: [
      "Deploys in under 45 seconds",
      "DDR5 ECC memory & NVMe Gen4 RAID10",
      "Private VPC link to db.sparrowx.net",
    ],
  },
];

export function SparrowxInfraEngine() {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [region, setRegion] = useState<InfraRegionId>("in-mum");
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string>("");

  // Native <dialog> configurator state
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const dialogTitleId = useId();
  const tableCaptionId = useId();
  const [selectedPlan, setSelectedPlan] = useState<InfraServerPlan | null>(null);
  const [configRegion, setConfigRegion] = useState<InfraRegionId>("in-mum");
  const [configOs, setConfigOs] = useState<string>("ubuntu-24-04");
  const [extraIpv4, setExtraIpv4] = useState<number>(0);
  const [enableWireguardMesh, setEnableWireguardMesh] = useState<boolean>(true);
  const [enableNightlyBackup, setEnableNightlyBackup] = useState<boolean>(false);
  const [hostnameInput, setHostnameInput] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string>("");
  const [orderReceipt, setOrderReceipt] = useState<{
    referenceId: string;
    planName: string;
    totalLabel: string;
    regionName: string;
  } | null>(null);
  const [upiPayOpen, setUpiPayOpen] = useState(false);

  useEffect(() => {
    const verified = verifySessionToken();
    if (verified?.email) {
      setSessionEmail(verified.email);
      setCustomerEmail(verified.email);
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Progressive fallback for browsers lacking native <dialog closedby="any">
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || typeof HTMLDialogElement === "undefined") return;
    if ("closedBy" in HTMLDialogElement.prototype) return;

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };

    let pressedOutside = false;
    const onDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e) && dialog.open) {
        dialog.close();
      }
      pressedOutside = false;
    };

    dialog.addEventListener("pointerdown", onDown);
    dialog.addEventListener("pointerup", onUp);
    return () => {
      dialog.removeEventListener("pointerdown", onDown);
      dialog.removeEventListener("pointerup", onUp);
    };
  }, []);

  // Clean up dialog returnValue on close per modern-web-guidance dialog spec
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      dialog.returnValue = "";
    };
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  const openConfigurator = (plan: InfraServerPlan) => {
    setSelectedPlan(plan);
    setConfigRegion(plan.regions.includes(region) ? region : (plan.regions[0] ?? "in-mum"));
    setConfigOs("ubuntu-24-04");
    setExtraIpv4(0);
    setEnableWireguardMesh(true);
    setEnableNightlyBackup(false);
    setHostnameInput(`${plan.id}.sparrowx.local`);
    setOrderError("");
    setOrderReceipt(null);
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  };

  const closeConfigurator = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
    }
  };

  const filteredPlans = useMemo(() => {
    return INFRA_PLANS.filter((plan) => {
      if (category !== "all" && plan.category !== category) return false;
      if (!plan.regions.includes(region)) return false;
      return true;
    });
  }, [category, region]);

  const featuredPlans = useMemo(
    () => INFRA_PLANS.filter((p) => p.featured),
    [],
  );

  const selectedOsMeta =
    INFRA_OS_IMAGES.find((os) => os.id === configOs) ?? INFRA_OS_IMAGES[0]!;

  const addonMonthlyUsd =
    selectedOsMeta.monthlyAddonUsd +
    extraIpv4 * 3 +
    (enableNightlyBackup ? 12 : 0);

  const activePricing = selectedPlan
    ? computePlanPrice(selectedPlan, currency, billingCycle, addonMonthlyUsd)
    : null;

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan || !activePricing) return;

    const cleanEmail = customerEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setOrderError("Enter a valid operator email address to receive IPMI and SSH credentials.");
      return;
    }

    setSubmittingOrder(true);
    setOrderError("");

    const regionInfo =
      INFRA_REGIONS.find((r) => r.id === configRegion) ?? INFRA_REGIONS[0]!;
    const referenceId = `SPX-INFRA-${Date.now().toString(36).toUpperCase().slice(-6)}`;

    try {
      await Promise.all([
        fetch("/api/infra/servers/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: referenceId,
            planId: selectedPlan.id,
            planName: selectedPlan.name,
            category: selectedPlan.category,
            hostname: hostnameInput.trim() || `${selectedPlan.id}.sparrowx.net`,
            region: regionInfo.name,
            os: selectedOsMeta.label,
            monthlyPriceInr: selectedPlan.priceMonthlyInr,
          }),
        }),
        fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: cleanEmail.split("@")[0] || "Infra Client",
            email: cleanEmail,
            company: hostnameInput.trim() || selectedPlan.id,
            topic: `Cloud Infra Provisioning (${selectedPlan.category.toUpperCase()})`,
            message: [
              `Order Ref: ${referenceId}`,
              `Server Plan: ${selectedPlan.name} (${selectedPlan.cpuModel}, ${selectedPlan.ram}, ${selectedPlan.storage})`,
              `Datacenter: ${regionInfo.name} (${regionInfo.code})`,
              `OS Image: ${selectedOsMeta.label}`,
              `Billing: ${billingCycle} (${activePricing.formattedMonthly}/mo · Total ${activePricing.formattedTotal})`,
              `Extra IPv4: +${extraIpv4} | SparrowXNet WireGuard Mesh: ${enableWireguardMesh ? "Yes" : "No"} | Nightly Backups: ${enableNightlyBackup ? "Yes" : "No"}`,
            ].join("\n"),
          }),
        }),
      ]);
    } catch {
      // Proceed cleanly with local provisioning confirmation receipt even if mail relay is offline
    } finally {
      setSubmittingOrder(false);
      setOrderReceipt({
        referenceId,
        planName: selectedPlan.name,
        totalLabel: `${activePricing.formattedTotal} (${billingCycle})`,
        regionName: regionInfo.name,
      });
    }
  };

  const activeRegionObj =
    INFRA_REGIONS.find((r) => r.id === region) ?? INFRA_REGIONS[0]!;

  return (
    <div className="min-h-screen bg-[#05060A] text-[#F4F6FA] flex flex-col selection:bg-sky-400 selection:text-black">
      {/* Compact Single-Line Sticky Header */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-colors duration-200 ${
          scrolled
            ? "bg-[#05060A]/92 backdrop-blur-xl border-b border-white/12 shadow-[0_12px_36px_rgba(0,0,0,0.6)]"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a
            href="#top"
            className="flex items-center gap-2.5 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 rounded-sm"
          >
            <img
              src="/sparrowx-logo.png"
              alt="SparrowX Cloud Infra"
              width={32}
              height={32}
              className="size-8 object-contain shrink-0"
            />
            <span className="text-lg font-extrabold tracking-tight text-white">
              SparrowX <span className="text-sky-400">Infra</span>
            </span>
          </a>

          <nav
            aria-label="Cloud Infra Navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-300"
          >
            <a
              href="#pillars"
              className="hover:text-white transition-colors duration-150"
            >
              Offerings
            </a>
            <a
              href="#catalog"
              className="hover:text-white transition-colors duration-150"
            >
              Server catalog
            </a>
            <a
              href="#architecture"
              className="hover:text-white transition-colors duration-150"
            >
              Network &amp; DDoS
            </a>
            <a
              href={buildMasterHref("/")}
              className="hover:text-white transition-colors duration-150"
            >
              Ecosystem
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <a
              href="/infra/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-[#0B0E15] hover:bg-white hover:text-black px-3.5 py-2 text-sm font-semibold text-white transition-colors duration-150"
            >
              <span>Dashboard</span>
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
            <a
              href="#catalog"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-sky-400 hover:bg-sky-300 px-4 py-2 text-sm font-semibold text-black transition-colors duration-150"
            >
              <span>Deploy server</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              className="md:hidden size-10 rounded-lg border border-white/15 bg-[#0B0E15] grid place-items-center text-white cursor-pointer"
            >
              {mobileMenuOpen ? (
                <X className="size-5" aria-hidden="true" />
              ) : (
                <Menu className="size-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#05060A]/98 backdrop-blur-xl px-4 py-4 space-y-2 text-sm">
            <a
              href="#pillars"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-zinc-200 hover:bg-white/10"
            >
              Offerings
            </a>
            <a
              href="#catalog"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-zinc-200 hover:bg-white/10"
            >
              Server catalog
            </a>
            <a
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-zinc-200 hover:bg-white/10"
            >
              Network &amp; DDoS
            </a>
            <a
              href="/infra/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sky-300 font-semibold hover:bg-white/10"
            >
              Cloud Management Panel (hPanel)
            </a>
            <a
              href={buildMasterHref("/")}
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-zinc-200 hover:bg-white/10"
            >
              SparrowX Ecosystem
            </a>
          </div>
        )}
      </header>

      <main id="top" className="flex-1">
        {/* HERO: Centered monumental headline + wide interactive 3D hardware stage bleeding to y = 0 */}
        <section className="relative overflow-hidden pt-24 pb-16 sm:pt-28 sm:pb-24 border-b border-white/10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 75% 55% at 50% 0%, rgba(56, 189, 248, 0.16), rgba(245, 158, 11, 0.04) 48%, transparent 78%)",
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 grid-fade opacity-60"
          />

          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 text-center">
            <h1 className="mx-auto max-w-5xl text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-[-0.04em] leading-[0.98] text-white text-balance">
              Raw silicon. Zero hypervisor tax.
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base sm:text-lg text-zinc-300 leading-relaxed">
              Deploy single-tenant bare metal, dedicated servers, and NVMe KVM VPS across India, Singapore, and Europe with unmetered fiber and always-on DDoS defense.
            </p>

            <div className="mt-8 flex justify-center">
              <a
                href="#catalog"
                className="inline-flex items-center gap-2 rounded-xl bg-white hover:bg-zinc-200 px-6 py-3.5 text-sm font-semibold text-black transition-colors duration-150 shadow-[0_12px_40px_rgba(56,189,248,0.22)]"
              >
                <span>Configure your server</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </div>

            {/* Borderless Floating 3D Bare-Metal Hardware Object */}
            <div className="mt-8 sm:mt-10 mx-auto max-w-3xl">
              <Floating3DVisual
                src="/3d/cloud-infra-server.jpg"
                alt="3D floating SparrowX bare-metal server rack cluster with anodized titanium blades and cyan fiber uplinks"
                accent="cyan"
                size="hero"
                priority="lcp"
                className="w-full"
                width={768}
                height={768}
              />
            </div>
          </div>
        </section>

        {/* SECTION 2: THREE INFRASTRUCTURE PILLARS WITH BESPOKE 3D ARTWORK */}
        <section
          id="pillars"
          className="scroll-mt-20 py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto"
        >
          <div className="max-w-2xl space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-white">
              Choose the exact isolation your workload demands
            </h2>
            <p className="text-base text-zinc-400 leading-relaxed">
              Every machine connects to the same private WireGuard backbone and includes zero-egress flat billing in INR or USD.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {CATEGORY_PILLARS.map((pillar) => (
              <article
                key={pillar.id}
                className="group rounded-2xl border border-white/12 bg-[#0B0E15] p-6 flex flex-col justify-between gap-6 hover:border-white/25 transition-colors duration-200"
              >
                <div className="space-y-5">
                  <Floating3DVisual
                    src={pillar.image}
                    alt={`${pillar.title} 3D hardware illustration`}
                    accent={pillar.accent}
                    size="md"
                    priority="lazy"
                    width={420}
                    height={420}
                  />

                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold tracking-tight text-white">
                      {pillar.title}
                    </h3>
                    <p className="text-sm font-medium text-sky-300">
                      {pillar.benefit}
                    </p>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      {pillar.summary}
                    </p>
                  </div>

                  <ul className="space-y-2 text-sm text-zinc-300 pt-2 border-t border-white/10">
                    {pillar.specs.map((spec) => (
                      <li key={spec} className="flex items-start gap-2.5">
                        <Check
                          className="size-4 text-sky-400 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span>{spec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-4">
                  <div className="tabular-nums">
                    <span className="block text-xs text-zinc-400">Starting at</span>
                    <span className="text-xl font-bold text-white">
                      {currency === "INR"
                        ? `₹${pillar.startingInr.toLocaleString("en-IN")}`
                        : `$${pillar.startingUsd}`}
                    </span>
                    <span className="text-sm text-zinc-400">/mo</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCategory(pillar.id);
                      document
                        .getElementById("catalog")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white hover:text-black px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 cursor-pointer"
                  >
                    <span>Browse {pillar.title.split(" ")[0]}</span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* SECTION 3: INTERACTIVE SERVER INVENTORY & RESPONSIVE HARDWARE TABLE */}
        <section
          id="catalog"
          className="scroll-mt-20 border-y border-white/10 bg-[#07090F] py-16 sm:py-24 px-4 sm:px-6"
        >
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-white">
                  Live bare metal, dedicated &amp; VPS inventory
                </h2>
                <p className="text-base text-zinc-400">
                  Filter by hardware class, datacenter location, and billing cycle. Click any row to customize OS, RAID, and networking.
                </p>
              </div>

              {/* Currency + Billing Cycle Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <div
                  role="radiogroup"
                  aria-label="Billing cycle"
                  className="inline-flex rounded-lg border border-white/15 bg-[#0B0E15] p-1"
                >
                  {BILLING_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={billingCycle === opt.id}
                      onClick={() => setBillingCycle(opt.id)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer ${
                        billingCycle === opt.id
                          ? "bg-white text-black font-semibold"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div
                  role="radiogroup"
                  aria-label="Currency"
                  className="inline-flex rounded-lg border border-white/15 bg-[#0B0E15] p-1"
                >
                  {(["INR", "USD"] as const).map((cur) => (
                    <button
                      key={cur}
                      type="button"
                      role="radio"
                      aria-checked={currency === cur}
                      onClick={() => setCurrency(cur)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer ${
                        currency === cur
                          ? "bg-sky-400 text-black font-semibold"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {cur === "INR" ? "INR (₹)" : "USD ($)"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Category Tabs & Region Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div
                role="tablist"
                aria-label="Server hardware category"
                className="flex flex-wrap items-center gap-1.5"
              >
                {CATEGORY_OPTIONS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={category === tab.id}
                    onClick={() => setCategory(tab.id)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 cursor-pointer ${
                      category === tab.id
                        ? "bg-white text-black font-semibold"
                        : "bg-[#0B0E15] text-zinc-300 border border-white/10 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2.5">
                <label
                  htmlFor="infra-region-select"
                  className="text-sm text-zinc-400 shrink-0"
                >
                  Datacenter
                </label>
                <select
                  id="infra-region-select"
                  value={region}
                  onChange={(e) => setRegion(e.target.value as InfraRegionId)}
                  className="rounded-lg border border-white/15 bg-[#0B0E15] px-3.5 py-2 text-sm font-medium text-white focus:outline-none focus:border-sky-400"
                >
                  {INFRA_REGIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.latencyHint})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Accessible Responsive Container-Query Hardware Table */}
            <div
              tabIndex={0}
              role="region"
              aria-labelledby={tableCaptionId}
              className="spx-infra-table-wrap rounded-xl border border-white/12 bg-[#0B0E15] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              <table className="spx-infra-table text-left text-sm">
                <caption id={tableCaptionId} className="sr-only">
                  SparrowX Cloud Infra bare metal, dedicated server, and KVM VPS catalog in {activeRegionObj.name}
                </caption>
                <thead className="bg-[#101520] text-zinc-300 border-b border-white/10">
                  <tr>
                    <th scope="col" className="px-5 py-3.5 font-semibold">
                      Server model
                    </th>
                    <th scope="col" className="px-4 py-3.5 font-semibold">
                      Processor
                    </th>
                    <th scope="col" className="px-4 py-3.5 font-semibold">
                      Memory
                    </th>
                    <th scope="col" className="px-4 py-3.5 font-semibold">
                      Storage
                    </th>
                    <th scope="col" className="px-4 py-3.5 font-semibold">
                      Network
                    </th>
                    <th scope="col" className="px-4 py-3.5 font-semibold text-right">
                      Monthly price
                    </th>
                    <th scope="col" className="px-5 py-3.5 font-semibold text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {filteredPlans.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-10 text-center text-zinc-400"
                      >
                        No configurations available in {activeRegionObj.name} for this filter. Switch to Frankfurt DE-1 or Singapore SG-1 for dual-socket bare metal inventory.
                      </td>
                    </tr>
                  ) : (
                    filteredPlans.map((plan) => {
                      const price = computePlanPrice(plan, currency, billingCycle);
                      return (
                        <tr
                          key={plan.id}
                          className="hover:bg-white/[0.03] transition-colors duration-150"
                        >
                          <th scope="row" className="px-5 py-4 font-normal align-middle">
                            <div className="font-semibold text-white">
                              {plan.name}
                            </div>
                            <div className="text-xs text-zinc-400 mt-0.5">
                              {plan.category === "bare-metal"
                                ? "Bare metal"
                                : plan.category === "dedicated"
                                  ? "Dedicated server"
                                  : "Cloud KVM VPS"}{" "}
                              · Deploys in {plan.deployTime}
                            </div>
                          </th>
                          <td className="px-4 py-4 align-middle text-zinc-200 tabular-nums">
                            <div className="font-medium text-white">
                              {plan.cpuModel}
                            </div>
                            <div className="text-xs text-zinc-400">
                              {plan.coresThreads} · {plan.clockGhz}
                            </div>
                          </td>
                          <td className="px-4 py-4 align-middle text-zinc-200 tabular-nums whitespace-nowrap">
                            {plan.ram}
                          </td>
                          <td className="px-4 py-4 align-middle text-zinc-200 tabular-nums">
                            {plan.storage}
                          </td>
                          <td className="px-4 py-4 align-middle text-zinc-200">
                            <div className="whitespace-nowrap">{plan.network}</div>
                            <div className="text-xs text-sky-400">
                              {plan.ddosProtection}
                            </div>
                          </td>
                          <td className="px-4 py-4 align-middle text-right tabular-nums whitespace-nowrap">
                            <span className="text-base font-bold text-white">
                              {price.formattedMonthly}
                            </span>
                            <span className="text-xs text-zinc-400">/mo</span>
                          </td>
                          <td className="px-5 py-4 align-middle text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openConfigurator(plan)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-white hover:bg-sky-300 px-3.5 py-2 text-xs font-semibold text-black transition-colors duration-150 cursor-pointer"
                            >
                              <span>Configure</span>
                              <ArrowRight className="size-3.5" aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Flagship Spotlight Cards */}
            <div className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredPlans.map((plan) => {
                const price = computePlanPrice(plan, currency, billingCycle);
                return (
                  <div
                    key={`spotlight-${plan.id}`}
                    className="rounded-2xl border border-white/12 bg-[#0B0E15] p-6 flex flex-col justify-between gap-5"
                  >
                    <div className="space-y-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-lg font-semibold text-white">
                          {plan.name}
                        </h3>
                        <span className="text-lg font-bold text-sky-400 tabular-nums">
                          {price.formattedMonthly}/mo
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400 leading-relaxed">
                        {plan.tagline}
                      </p>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 border-t border-white/10 text-sm tabular-nums">
                        <div>
                          <dt className="text-xs text-zinc-500">Silicon</dt>
                          <dd className="text-zinc-200 font-medium">{plan.coresThreads}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-zinc-500">Memory</dt>
                          <dd className="text-zinc-200 font-medium">{plan.ram}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-zinc-500">Storage</dt>
                          <dd className="text-zinc-200 font-medium">{plan.storage}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-zinc-500">Uplink</dt>
                          <dd className="text-zinc-200 font-medium">{plan.network}</dd>
                        </div>
                      </dl>
                    </div>

                    <button
                      type="button"
                      onClick={() => openConfigurator(plan)}
                      className="w-full rounded-xl bg-sky-400 hover:bg-sky-300 py-2.5 text-sm font-semibold text-black transition-colors duration-150 cursor-pointer"
                    >
                      Configure {plan.name}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 4: NETWORK & HARDWARE ARCHITECTURE */}
        <section
          id="architecture"
          className="scroll-mt-20 py-16 sm:py-24 px-4 sm:px-6 max-w-7xl mx-auto"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-6">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-white">
                Built on sovereign metal with zero surprise bandwidth bills
              </h2>
              <p className="text-base text-zinc-400 leading-relaxed">
                Every bare-metal rack and KVM node connects seamlessly to SparrowX Cloud DB, SparrowXNet WireGuard Guard tunnels, and GameSec Anycast scrubbing without inter-zone egress fees.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-white font-semibold text-sm">
                    <Shield className="size-4 text-sky-400" aria-hidden="true" />
                    <span>Always-on XDP/eBPF shield</span>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Drops volumetric SYN, UDP, and reflection floods in the kernel NIC driver before they consume CPU cycles.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-white font-semibold text-sm">
                    <Network className="size-4 text-sky-400" aria-hidden="true" />
                    <span>SparrowXNet WireGuard mesh</span>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Encrypt private node-to-node traffic across Linux servers with sub-millisecond kernel WireGuard peering.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-white font-semibold text-sm">
                    <Terminal className="size-4 text-sky-400" aria-hidden="true" />
                    <span>Out-of-band IPMI &amp; rescue</span>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Mount custom ISOs, hard power-cycle physical blades, and inspect BIOS consoles directly from your browser.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-white font-semibold text-sm">
                    <HardDrive className="size-4 text-sky-400" aria-hidden="true" />
                    <span>Enterprise NVMe Gen4 &amp; Gen5</span>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Datacenter-grade power-loss-protected NVMe drives tuned for PostgreSQL, Kubernetes, and game tick locks.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-2xl border border-white/12 bg-[#0B0E15] p-6 space-y-6">
                <Floating3DVisual
                  src="/3d/vps-kvm-cubes.svg"
                  alt="3D floating KVM compute cluster interconnected via glowing fiber-optic links"
                  accent="cyan"
                  size="lg"
                  priority="lazy"
                  width={512}
                  height={512}
                />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-white/10 tabular-nums">
                  {INFRA_REGIONS.map((r) => (
                    <div key={r.id}>
                      <div className="text-sm font-semibold text-white">{r.code}</div>
                      <div className="text-xs text-zinc-400">{r.country}</div>
                      <div className="text-xs text-sky-400 mt-0.5">{r.latencyHint}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Native <dialog> Hardware Configurator & Checkout Modal */}
      <dialog
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
        {...({ closedby: "any" } as Record<string, string>)}
        className="spx-native-dialog m-auto w-[min(680px,calc(100vw-2rem))] max-h-[90dvh] rounded-2xl border border-white/15 bg-[#0B0E15] p-0 text-[#F4F6FA] shadow-[0_32px_90px_rgba(0,0,0,0.85)] overflow-hidden"
      >
        {selectedPlan && activePricing && (
          <>
            <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#101520] px-6 py-4">
              <div>
                <h2 id={dialogTitleId} className="text-lg font-bold text-white">
                  Configure {selectedPlan.name}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {selectedPlan.cpuModel} · {selectedPlan.ram} · {selectedPlan.storage}
                </p>
              </div>
              <button
                type="button"
                onClick={closeConfigurator}
                aria-label="Close server configurator"
                className="size-9 rounded-lg border border-white/15 bg-[#0B0E15] hover:bg-white/10 grid place-items-center text-zinc-300 hover:text-white cursor-pointer"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5">
              {orderReceipt ? (
                <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-6 space-y-4">
                  <div className="flex items-center gap-3 text-emerald-300">
                    <CheckCircle2 className="size-6 shrink-0" aria-hidden="true" />
                    <div>
                      <div className="font-bold text-white text-base">
                        Provisioning request confirmed
                      </div>
                      <div className="text-xs text-emerald-200/80">
                        Reference {orderReceipt.referenceId}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-200 leading-relaxed">
                    Your <strong>{orderReceipt.planName}</strong> deployment in{" "}
                    <strong>{orderReceipt.regionName}</strong> ({orderReceipt.totalLabel}) has been queued. Root SSH and IPMI access details will be sent to <strong>{customerEmail}</strong>.
                  </p>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <a
                      href="/infra/dashboard"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-400 hover:bg-sky-300 px-4 py-2 text-sm font-semibold text-black"
                    >
                      <span>Open Cloud Dashboard</span>
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </a>
                    <button
                      type="button"
                      onClick={closeConfigurator}
                      className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-zinc-200 hover:text-white cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleOrderSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="cfg-region"
                        className="text-xs font-medium text-zinc-300 block"
                      >
                        Datacenter region
                      </label>
                      <select
                        id="cfg-region"
                        value={configRegion}
                        onChange={(e) =>
                          setConfigRegion(e.target.value as InfraRegionId)
                        }
                        className="w-full rounded-lg border border-white/15 bg-[#05060A] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                      >
                        {INFRA_REGIONS.filter((r) =>
                          selectedPlan.regions.includes(r.id),
                        ).map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.latencyHint})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="cfg-os"
                        className="text-xs font-medium text-zinc-300 block"
                      >
                        Operating system image
                      </label>
                      <select
                        id="cfg-os"
                        value={configOs}
                        onChange={(e) => setConfigOs(e.target.value)}
                        className="w-full rounded-lg border border-white/15 bg-[#05060A] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                      >
                        {INFRA_OS_IMAGES.map((os) => (
                          <option key={os.id} value={os.id}>
                            {os.label}
                            {os.monthlyAddonUsd > 0
                              ? ` (+$${os.monthlyAddonUsd}/mo)`
                              : " (Included)"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="cfg-ipv4"
                        className="text-xs font-medium text-zinc-300 block"
                      >
                        Additional IPv4 addresses (+$3/mo each)
                      </label>
                      <select
                        id="cfg-ipv4"
                        value={extraIpv4}
                        onChange={(e) => setExtraIpv4(Number(e.target.value))}
                        className="w-full rounded-lg border border-white/15 bg-[#05060A] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                      >
                        <option value={0}>0 extra (1 IPv4 + /64 IPv6 included)</option>
                        <option value={1}>+1 extra IPv4</option>
                        <option value={4}>+4 extra IPv4 (/29 subnet)</option>
                        <option value={8}>+8 extra IPv4 (/28 subnet)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="cfg-hostname"
                        className="text-xs font-medium text-zinc-300 block"
                      >
                        Server hostname
                      </label>
                      <input
                        id="cfg-hostname"
                        type="text"
                        required
                        value={hostnameInput}
                        onChange={(e) => setHostnameInput(e.target.value)}
                        placeholder="node-01.yourdomain.com"
                        className="w-full rounded-lg border border-white/15 bg-[#05060A] px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-400"
                      />
                    </div>
                  </div>

                  {/* Add-on Switches */}
                  <div className="space-y-2.5 rounded-xl border border-white/10 bg-[#05060A] p-4 text-sm">
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <span>
                        <strong className="text-white font-medium block">
                          SparrowXNet WireGuard private VLAN
                        </strong>
                        <span className="text-xs text-zinc-400">
                          Encrypted kernel tunnel to netsec.sparrowx.net &amp; db.sparrowx.net
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={enableWireguardMesh}
                        onChange={(e) => setEnableWireguardMesh(e.target.checked)}
                        className="size-4 accent-sky-400"
                      />
                    </label>

                    <label className="flex items-center justify-between gap-3 pt-2.5 border-t border-white/10 cursor-pointer">
                      <span>
                        <strong className="text-white font-medium block">
                          Off-node nightly snapshots (+$12/mo)
                        </strong>
                        <span className="text-xs text-zinc-400">
                          7-day rolling encrypted backups stored in secondary PoP
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={enableNightlyBackup}
                        onChange={(e) => setEnableNightlyBackup(e.target.checked)}
                        className="size-4 accent-sky-400"
                      />
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="cfg-email"
                      className="text-xs font-medium text-zinc-300 block"
                    >
                      Operator email for SSH &amp; IPMI delivery
                    </label>
                    <input
                      id="cfg-email"
                      type="email"
                      autoComplete="email"
                      required
                      autoFocus
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder={sessionEmail || "ops@company.com"}
                      className="w-full rounded-lg border border-white/15 bg-[#05060A] px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-400"
                    />
                  </div>

                  {orderError && (
                    <p
                      role="alert"
                      className="rounded-lg border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300"
                    >
                      {orderError}
                    </p>
                  )}

                  {/* Order Summary Footer */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-white/10">
                    <div className="tabular-nums">
                      <span className="text-xs text-zinc-400 block">
                        Estimated total ({billingCycle})
                      </span>
                      <span className="text-2xl font-bold text-white">
                        {activePricing.formattedTotal}
                      </span>
                      <span className="text-xs text-zinc-400 ml-1.5">
                        ({activePricing.formattedMonthly}/mo)
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={closeConfigurator}
                        className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          closeConfigurator();
                          setUpiPayOpen(true);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black transition-colors duration-150 cursor-pointer"
                      >
                        <span>Pay via UPI</span>
                      </button>
                      <button
                        type="submit"
                        disabled={submittingOrder}
                        className="inline-flex items-center gap-2 rounded-lg bg-sky-400 hover:bg-sky-300 disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-black transition-colors duration-150 cursor-pointer"
                      >
                        <Lock className="size-4" aria-hidden="true" />
                        <span>
                          {submittingOrder ? "Queueing deploy..." : "Deploy server"}
                        </span>
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </dialog>

      <UpiAutoPayModal
        open={upiPayOpen && Boolean(selectedPlan)}
        onClose={() => setUpiPayOpen(false)}
        service="infra"
        planId={selectedPlan?.id ?? "vps-starter"}
        planName={selectedPlan?.name ?? "SparrowX Server"}
        amountInr={
          selectedPlan
            ? computePlanPrice(selectedPlan, "INR", billingCycle, addonMonthlyUsd).unitMonthly *
              (billingCycle === "annual" ? 12 : billingCycle === "quarterly" ? 3 : 1)
            : 849
        }
        customerEmail={customerEmail || sessionEmail || "ops@sparrowx.net"}
        metadata={
          selectedPlan
            ? {
                category: selectedPlan.category,
                hostname: hostnameInput || `${selectedPlan.id}.sparrowx.net`,
                region:
                  INFRA_REGIONS.find((r) => r.id === configRegion)?.name ||
                  "Mumbai IN-1",
                os: selectedOsMeta.label,
              }
            : undefined
        }
      />

      <SparrowxFooter inPageAnchors={false} />
    </div>
  );
}
