import React, { useEffect, useState } from "react";
import {
  Database,
  Shield,
  FileUp,
  KeyRound,
  Terminal,
  Cpu,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Lock,
  RefreshCw,
  Globe,
  Heart,
  Sparkles,
  Zap,
  Server,
  Layers,
  Check,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { GlobalEcosystemBar } from "./GlobalEcosystemBar";
import { ComparisonSection } from "./landing/ComparisonSection";
import { ContactSection } from "./landing/ContactSection";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authenticateAppUserFromBackend } from "@/lib/supabase";
import type { AppUser } from "@/lib/supabase";

interface SparrowxMasterLandingProps {
  onOpenLogin: () => void;
  onDirectNav?: (destination: string) => void;
  onUserAuthenticated?: (user: AppUser) => void;
}

// -----------------------------------------------------------------------------
// Workspace Sign In Modal
// -----------------------------------------------------------------------------
function OperatorLoginDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (user: AppUser) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await authenticateAppUserFromBackend(email.trim(), password);
      setLoading(false);

      if (res.user) {
        onOpenChange(false);
        if (onSuccess) {
          onSuccess(res.user);
        }
      } else {
        setError(res.error || "Invalid sign-in credentials.");
      }
    } catch {
      setLoading(false);
      setError("Unable to connect to authentication server. Please retry.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0D1526] border border-sky-500/20 text-white max-w-md p-6 font-sans shadow-2xl">
        <DialogHeader className="text-left space-y-1.5 mb-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-sky-400 mb-1">
            <span className="size-1.5 rounded-full bg-sky-400 animate-pulse" />
            SPARROWX CLOUD SIGN-IN
          </div>
          <DialogTitle className="text-xl font-bold text-white tracking-tight font-sans">
            Access Developer Workspace
          </DialogTitle>
          <DialogDescription className="text-xs text-[#A3B1C6] leading-relaxed">
            Enter your credentials to manage your databases, security shields, and persistent vaults.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSignIn} className="space-y-4 pt-1 font-mono text-xs">
          <div className="space-y-1.5 text-left">
            <label className="text-[11px] text-[#A3B1C6]">Account Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourdomain.com"
              className="w-full px-3.5 py-2.5 rounded bg-[#070B14] border border-sky-500/20 text-white placeholder-[#7C8BA1] focus:outline-none focus:border-sky-400"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <label className="text-[11px] text-[#A3B1C6]">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-3.5 py-2.5 rounded bg-[#070B14] border border-sky-500/20 text-white placeholder-[#7C8BA1] focus:outline-none focus:border-sky-400"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded text-xs text-[#A3B1C6] hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(56,189,248,0.3)]"
            >
              {loading && <RefreshCw className="size-3 animate-spin" />}
              <span>{loading ? "Authenticating..." : "Sign In"}</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Flagship Master Company Portal (sparrowx.net) - Warm, Blue Startup Aesthetic
// -----------------------------------------------------------------------------
export function SparrowxMasterLanding({
  onOpenLogin,
  onDirectNav,
  onUserAuthenticated,
}: SparrowxMasterLandingProps) {
  const [operatorModalOpen, setOperatorModalOpen] = useState(false);
  const [vpsCurrency, setVpsCurrency] = useState<"INR" | "USD">("INR");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  // Highlight the nav link for the section currently in view.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const ids = ["comparison", "story", "vps", "contact"];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const navLinkClass = (id: string) =>
    `transition-colors ${activeSection === id ? "text-white font-semibold underline decoration-sky-400 underline-offset-8" : "hover:text-white"}`;

  const vpsPlans = [
    {
      id: "sx-micro",
      name: "SX-Micro",
      vCpu: "1 vCPU",
      ram: "2 GB ECC",
      storage: "40 GB Fast NVMe",
      bandwidth: "1 TB Anycast Bandwidth",
      priceInr: "â‚¹340",
      priceUsd: "$4",
      period: "/mo",
      tag: "Starter",
    },
    {
      id: "sx-core",
      name: "SX-Core",
      vCpu: "1 vCPU",
      ram: "4 GB ECC",
      storage: "80 GB Fast NVMe",
      bandwidth: "2 TB Anycast Bandwidth",
      priceInr: "â‚¹670",
      priceUsd: "$8",
      period: "/mo",
      tag: "Most Popular",
    },
    {
      id: "sx-memory",
      name: "SX-Memory",
      vCpu: "2 vCPU",
      ram: "8 GB ECC",
      storage: "160 GB Fast NVMe",
      bandwidth: "4 TB Anycast Bandwidth",
      priceInr: "â‚¹1,260",
      priceUsd: "$15",
      period: "/mo",
      tag: "BEST VALUE",
      highlight: true,
    },
    {
      id: "sx-vault",
      name: "SX-Vault",
      vCpu: "4 vCPU",
      ram: "16 GB ECC",
      storage: "400 GB Fast NVMe",
      bandwidth: "8 TB Anycast Bandwidth",
      priceInr: "â‚¹2,440",
      priceUsd: "$29",
      period: "/mo",
      tag: "Heavy Workloads",
    },
  ];

  const handleLaunch = (targetId: string, url: string, param: string) => {
    if (typeof window !== "undefined" && window.location.hostname.includes("sparrowx.net")) {
      window.location.href = url;
    } else if (onDirectNav) {
      onDirectNav(targetId);
    } else if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      ["db", "file", "drop", "password", "keys", "shield", "sec", "api"].forEach((k) =>
        u.searchParams.delete(k)
      );
      u.searchParams.set(param, "1");
      window.location.href = u.toString();
    }
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-[#F3F4F6] font-sans antialiased selection:bg-sky-500 selection:text-black flex flex-col">
      {/* SECTION 0: GLOBAL ECOSYSTEM BAR */}
      <GlobalEcosystemBar activeDomain="hub" />

      {/* SECTION 1: HEADER (CLEAN BLUE ACCENTS) */}
      <header className="border-b border-sky-500/15 bg-[#0B1020]/95 px-4 sm:px-6 py-3.5 sticky top-7 z-40 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left Brand */}
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2.5">
              <div className="size-8 rounded-md bg-[#111A30] border border-sky-500/30 grid place-items-center shadow-[0_0_10px_rgba(56,189,248,0.15)]">
                <img
                  src="/sparrowx-cyber-hawk.png"
                  alt="SparrowX"
                  className="size-5 object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-white font-sans">
                  SPARROWX
                </span>
                <span className="ml-2 text-[10px] text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/30 font-mono font-semibold uppercase">
                  STARTUP CLOUD
                </span>
              </div>
            </a>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs text-[#A3B1C6] font-mono">
            {/* Products Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProductDropdownOpen(!productDropdownOpen)}
                className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-white font-semibold"
              >
                <span>Our Products</span>
                <ChevronDown className="size-3 text-sky-400" />
              </button>

              {productDropdownOpen && (
                <div
                  className="absolute left-0 mt-2 w-64 rounded-md bg-[#0D1526] border border-sky-500/25 p-2 shadow-2xl z-50 space-y-1 font-mono text-xs"
                  onMouseLeave={() => setProductDropdownOpen(false)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setProductDropdownOpen(false);
                      handleLaunch("db", "https://db.sparrowx.net", "db");
                    }}
                    className="w-full text-left p-2 rounded hover:bg-sky-500/10 flex items-center gap-2.5 text-white cursor-pointer"
                  >
                    <Database className="size-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-bold text-xs">SparrowX Cloud DB</div>
                      <div className="text-[10px] text-[#A3B1C6]">PostgreSQL &amp; AI Vector Studio</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProductDropdownOpen(false);
                      handleLaunch("file", "https://file.sparrowx.net", "file");
                    }}
                    className="w-full text-left p-2 rounded hover:bg-sky-500/10 flex items-center gap-2.5 text-white cursor-pointer"
                  >
                    <FileUp className="size-4 text-sky-400 shrink-0" />
                    <div>
                      <div className="font-bold text-xs">SparrowX Files</div>
                      <div className="text-[10px] text-[#A3B1C6]">Zero-Login File Drop &amp; 10GB Vault</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProductDropdownOpen(false);
                      handleLaunch("password", "https://password.sparrowx.net", "password");
                    }}
                    className="w-full text-left p-2 rounded hover:bg-sky-500/10 flex items-center gap-2.5 text-white cursor-pointer"
                  >
                    <KeyRound className="size-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-bold text-xs">SparrowX Keys</div>
                      <div className="text-[10px] text-[#A3B1C6]">Offline Password Instrument (No Login)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProductDropdownOpen(false);
                      handleLaunch("sec", "https://sec.sparrowx.net", "shield");
                    }}
                    className="w-full text-left p-2 rounded hover:bg-sky-500/10 flex items-center gap-2.5 text-white cursor-pointer"
                  >
                    <Shield className="size-4 text-orange-500 shrink-0" />
                    <div>
                      <div className="font-bold text-xs">SparrowX Shield</div>
                      <div className="text-[10px] text-[#A3B1C6]">Cyber Threat Map &amp; DDoS Defense</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProductDropdownOpen(false);
                      handleLaunch("api", "https://api.sparrowx.net", "api");
                    }}
                    className="w-full text-left p-2 rounded hover:bg-sky-500/10 flex items-center gap-2.5 text-white cursor-pointer"
                  >
                    <Terminal className="size-4 text-indigo-400 shrink-0" />
                    <div>
                      <div className="font-bold text-xs">SparrowX API Gateway</div>
                      <div className="text-[10px] text-[#A3B1C6]">Instant REST API with cURL &amp; SDKs</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <a href="#comparison" aria-current={activeSection === "comparison" ? "true" : undefined} className={navLinkClass("comparison")}>
              Why Us
            </a>
            <a href="#story" aria-current={activeSection === "story" ? "true" : undefined} className={navLinkClass("story")}>
              Our Story
            </a>
            <a href="#vps" aria-current={activeSection === "vps" ? "true" : undefined} className={navLinkClass("vps")}>
              VPS Cloud
            </a>
            <a href="#contact" aria-current={activeSection === "contact" ? "true" : undefined} className={navLinkClass("contact")}>
              Contact
            </a>
            <a
              href="https://password.sparrowx.net"
              onClick={(e) => {
                if (!window.location.hostname.includes("sparrowx.net")) {
                  e.preventDefault();
                  handleLaunch("password", "https://password.sparrowx.net", "password");
                }
              }}
              className="text-sky-400 hover:text-sky-300 font-semibold"
            >
              Offline Keys (Free)
            </a>
          </nav>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setOperatorModalOpen(true)}
              className="hidden sm:flex px-3.5 py-1.5 rounded bg-[#111A30] border border-sky-500/25 hover:border-sky-500/50 text-xs font-mono text-[#A3B1C6] hover:text-white transition-all items-center gap-1.5 cursor-pointer"
            >
              <Lock className="size-3 text-sky-400" />
              <span>Workspace Sign-In</span>
            </button>

            <button
              type="button"
              onClick={() => handleLaunch("db", "https://db.sparrowx.net", "db")}
              className="px-3 sm:px-4 py-1.5 rounded bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs transition-all flex items-center gap-1 cursor-pointer shadow-[0_0_15px_rgba(56,189,248,0.25)] font-mono min-h-[36px] sm:min-h-0"
            >
              <span>Launch Studio</span>
              <ArrowUpRight className="size-3.5" />
            </button>

            {/* Mobile Hamburger Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              className="md:hidden size-9 rounded-md bg-[#111A30] border border-sky-500/30 text-white flex items-center justify-center cursor-pointer min-h-[36px] min-w-[36px]"
            >
              {mobileMenuOpen ? <X className="size-5 text-sky-400" /> : <Menu className="size-5 text-white" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-sky-500/20 space-y-4 max-h-[calc(100vh-80px)] overflow-y-auto no-scrollbar pb-6 animate-in slide-in-from-top duration-200">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-sky-400 uppercase tracking-wider font-bold block px-1">
                SparrowX Cloud Products
              </span>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLaunch("db", "https://db.sparrowx.net", "db");
                }}
                className="w-full text-left p-2.5 rounded-lg bg-[#0E172A] border border-sky-500/20 hover:border-sky-500/40 flex items-center gap-3 text-white cursor-pointer min-h-[48px]"
              >
                <div className="size-8 rounded bg-emerald-500/10 border border-emerald-500/30 grid place-items-center text-emerald-400 shrink-0">
                  <Database className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-white">SparrowX Cloud DB</div>
                  <div className="text-[10px] text-[#A3B1C6] truncate">Managed PostgreSQL &amp; Vector Studio</div>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 shrink-0">db.sparrowx.net</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLaunch("file", "https://file.sparrowx.net", "file");
                }}
                className="w-full text-left p-2.5 rounded-lg bg-[#0E172A] border border-sky-500/20 hover:border-sky-500/40 flex items-center gap-3 text-white cursor-pointer min-h-[48px]"
              >
                <div className="size-8 rounded bg-sky-500/10 border border-sky-500/30 grid place-items-center text-sky-400 shrink-0">
                  <FileUp className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-white">SparrowX Files</div>
                  <div className="text-[10px] text-[#A3B1C6] truncate">Zero-Disk Drop &amp; 10GB Cloud Vault</div>
                </div>
                <span className="text-[10px] font-mono text-sky-400 shrink-0">file.sparrowx.net</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLaunch("password", "https://password.sparrowx.net", "password");
                }}
                className="w-full text-left p-2.5 rounded-lg bg-[#0E172A] border border-sky-500/20 hover:border-sky-500/40 flex items-center gap-3 text-white cursor-pointer min-h-[48px]"
              >
                <div className="size-8 rounded bg-amber-500/10 border border-amber-500/30 grid place-items-center text-amber-400 shrink-0">
                  <KeyRound className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-white">SparrowX Keys (Free)</div>
                  <div className="text-[10px] text-[#A3B1C6] truncate">Offline Cryptographic Generator (No Login)</div>
                </div>
                <span className="text-[10px] font-mono text-amber-400 shrink-0">password.sparrowx.net</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLaunch("sec", "https://sec.sparrowx.net", "shield");
                }}
                className="w-full text-left p-2.5 rounded-lg bg-[#0E172A] border border-sky-500/20 hover:border-sky-500/40 flex items-center gap-3 text-white cursor-pointer min-h-[48px]"
              >
                <div className="size-8 rounded bg-orange-500/10 border border-orange-500/30 grid place-items-center text-orange-400 shrink-0">
                  <Shield className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-white">SparrowX Shield</div>
                  <div className="text-[10px] text-[#A3B1C6] truncate">2D Dot-Matrix Threat Map &amp; DDoS Defense</div>
                </div>
                <span className="text-[10px] font-mono text-orange-400 shrink-0">sec.sparrowx.net</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLaunch("api", "https://api.sparrowx.net", "api");
                }}
                className="w-full text-left p-2.5 rounded-lg bg-[#0E172A] border border-sky-500/20 hover:border-sky-500/40 flex items-center gap-3 text-white cursor-pointer min-h-[48px]"
              >
                <div className="size-8 rounded bg-indigo-500/10 border border-indigo-500/30 grid place-items-center text-indigo-400 shrink-0">
                  <Terminal className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-white">SparrowX API Gateway</div>
                  <div className="text-[10px] text-[#A3B1C6] truncate">Instant REST API with cURL &amp; SDKs</div>
                </div>
                <span className="text-[10px] font-mono text-indigo-400 shrink-0">api.sparrowx.net</span>
              </button>
            </div>

            <div className="pt-2 border-t border-sky-500/15 flex flex-col gap-2 font-mono text-xs">
              <a
                href="#comparison"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded bg-[#111A30] text-[#A3B1C6] hover:text-white flex items-center justify-between"
              >
                <span>Why Switch (Comparison)</span>
                <ArrowRight className="size-3.5 text-sky-400" />
              </a>

              <a
                href="#story"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded bg-[#111A30] text-[#A3B1C6] hover:text-white flex items-center justify-between"
              >
                <span>Read Our Story</span>
                <ArrowRight className="size-3.5 text-sky-400" />
              </a>

              <a
                href="#vps"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded bg-[#111A30] text-[#A3B1C6] hover:text-white flex items-center justify-between"
              >
                <span>Cloud VPS Pricing</span>
                <ArrowRight className="size-3.5 text-sky-400" />
              </a>

              <a
                href="#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded bg-[#111A30] text-[#A3B1C6] hover:text-white flex items-center justify-between"
              >
                <span>Contact Engineers</span>
                <ArrowRight className="size-3.5 text-sky-400" />
              </a>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setOperatorModalOpen(true);
                }}
                className="w-full min-h-[44px] rounded bg-[#111A30] border border-sky-500/30 text-white font-mono text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="size-3.5 text-sky-400" />
                <span>Workspace Sign-In</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* SECTION 2: EMOTIONAL STARTUP HERO */}
      <section className="border-b border-sky-500/15 bg-gradient-to-b from-[#090E1D] via-[#070A12] to-[#070A12] px-4 sm:px-6 py-10 sm:py-20 relative overflow-hidden">
        {/* Soft Blue Ambient Glow */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 items-center relative z-10">
          {/* Left Column: Human, Emotional Pitch */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#0E172A] border border-sky-500/30 text-[11px] sm:text-xs font-mono text-sky-300">
              <span className="size-2 rounded-full bg-sky-400 animate-pulse shrink-0" />
              <span>PASSIONATE INDEPENDENT STARTUP • ZERO CORPORATE JARGON</span>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight font-sans text-balance">
              Simple, Honest Cloud Tools <br />
              <span className="text-sky-400">Built for Real Builders.</span>
            </h1>

            <p className="text-xs sm:text-base text-[#A3B1C6] max-w-2xl leading-relaxed">
              We&apos;re a small, independent developer team building fast cloud databases, instant encrypted file sharing, hardware-grade offline passwords, and automated DDoS defense.
              No surprise bills, no shady telemetry, and no forced logins for simple utilities.
            </p>

            {/* Core Action Buttons (Mobile-friendly stacked row) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleLaunch("file", "https://file.sparrowx.net", "file")}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(56,189,248,0.3)] font-mono"
              >
                <FileUp className="size-4" />
                <span>Instant File Drop (No Login)</span>
              </button>

              <button
                type="button"
                onClick={() => handleLaunch("password", "https://password.sparrowx.net", "password")}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded bg-[#111A30] border border-sky-500/30 hover:border-sky-500/60 text-white font-mono text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <KeyRound className="size-4 text-sky-400" />
                <span>Offline Keys (No Login)</span>
              </button>

              <button
                type="button"
                onClick={() => handleLaunch("db", "https://db.sparrowx.net", "db")}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded bg-transparent border border-white/10 hover:border-white/25 text-[#A3B1C6] hover:text-white font-mono text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Database className="size-4 text-emerald-400" />
                <span>Postgres Studio</span>
              </button>
            </div>
          </div>

          {/* Right Column: Why Developers Love Us Card */}
          <div className="lg:col-span-5 border border-sky-500/20 bg-[#0C1222] rounded-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-sky-500/15 pb-3">
              <span className="text-xs font-mono text-sky-400 font-bold uppercase tracking-wider">
                Why Builders Choose SparrowX
              </span>
              <span className="text-emerald-400 text-[10px] font-mono flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE &amp; ACTIVE
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded bg-[#070A12] border border-sky-500/15 space-y-1">
                <div className="font-bold text-white flex items-center gap-2">
                  <Zap className="size-3.5 text-amber-400" />
                  <span>Zero Forced Sign-Ups</span>
                </div>
                <p className="text-[#A3B1C6] text-[11px] leading-relaxed">
                  Need a secure 64-character password or to send a file to a client? Just open the link and do it. No account creation required.
                </p>
              </div>

              <div className="p-3 rounded bg-[#070A12] border border-sky-500/15 space-y-1">
                <div className="font-bold text-white flex items-center gap-2">
                  <Shield className="size-3.5 text-orange-400" />
                  <span>Tactical DDoS &amp; Origin Defense</span>
                </div>
                <p className="text-[#A3B1C6] text-[11px] leading-relaxed">
                  We cloak your real server IP and deflect malicious attacks in under 1 second using our live global threat map.
                </p>
              </div>

              <div className="p-3 rounded bg-[#070A12] border border-sky-500/15 space-y-1">
                <div className="font-bold text-white flex items-center gap-2">
                  <Heart className="size-3.5 text-rose-400" />
                  <span>Real Human Support</span>
                </div>
                <p className="text-[#A3B1C6] text-[11px] leading-relaxed">
                  We are a small startup. When you reach out to us, you talk directly to the engineers building the product.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: 6 DEDICATED PRODUCT TOOLS (BENTO GRID) */}
      <section id="products" className="scroll-mt-24 px-4 sm:px-6 py-16 max-w-7xl mx-auto w-full space-y-8">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-sky-400">
            <Sparkles className="size-3.5" />
            <span>STANDALONE SPECIALIZED EXPERIENCES</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
            Six Focused Tools. Zero Clutter.
          </h2>
          <p className="text-xs sm:text-sm text-[#A3B1C6]">
            Each tool has its own dedicated home with specialized features built for speed and security.
          </p>
        </div>

        {/* 6 PRODUCTS GRID */}
        <div className="border border-sky-500/20 bg-[#0C1222] rounded-lg divide-y md:divide-y-0 divide-sky-500/15 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 overflow-hidden">
          {/* 1. SparrowX Cloud DB */}
          <div className="p-6 space-y-4 flex flex-col justify-between hover:bg-sky-500/[0.04] transition-colors border-r border-sky-500/15">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="size-9 rounded-md bg-[#111A30] border border-emerald-500/30 grid place-items-center text-emerald-400">
                  <Database className="size-4" />
                </div>
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                  POSTGRES + VECTOR
                </span>
              </div>
              <h3 className="font-bold text-white text-base font-sans">SparrowX Cloud DB</h3>
              <p className="text-xs text-[#A3B1C6] leading-relaxed">
                Fast, reliable managed PostgreSQL with built-in connection pooling and pgvector search. No sudden $1,000 bandwidth bills.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleLaunch("db", "https://db.sparrowx.net", "db")}
              className="w-full py-2 rounded bg-[#111A30] hover:bg-white hover:text-black border border-sky-500/20 text-xs font-mono text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>db.sparrowx.net</span>
              <ArrowUpRight className="size-3" />
            </button>
          </div>

          {/* 2. SparrowX Files */}
          <div className="p-6 space-y-4 flex flex-col justify-between hover:bg-sky-500/[0.04] transition-colors border-r border-sky-500/15">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="size-9 rounded-md bg-[#111A30] border border-sky-500/30 grid place-items-center text-sky-400">
                  <FileUp className="size-4" />
                </div>
                <span className="text-[9px] font-mono text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded font-bold">
                  FREE • NO LOGIN
                </span>
              </div>
              <h3 className="font-bold text-white text-base font-sans">SparrowX Files</h3>
              <p className="text-xs text-[#A3B1C6] leading-relaxed">
                Drop files instantly with zero login (auto-purged from memory for privacy) or unlock your persistent 10GB cloud vault.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleLaunch("file", "https://file.sparrowx.net", "file")}
              className="w-full py-2 rounded bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-mono shadow-sm"
            >
              <span>file.sparrowx.net</span>
              <ArrowUpRight className="size-3" />
            </button>
          </div>

          {/* 3. SparrowX Keys */}
          <div className="p-6 space-y-4 flex flex-col justify-between hover:bg-sky-500/[0.04] transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="size-9 rounded-md bg-[#111A30] border border-amber-500/30 grid place-items-center text-amber-400">
                  <KeyRound className="size-4" />
                </div>
                <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded font-bold">
                  FREE • NO LOGIN
                </span>
              </div>
              <h3 className="font-bold text-white text-base font-sans">SparrowX Keys</h3>
              <p className="text-xs text-[#A3B1C6] leading-relaxed">
                100% offline cryptographic password generator. Press spacebar to regenerate. Runs directly in your browser with zero network calls.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleLaunch("password", "https://password.sparrowx.net", "password")}
              className="w-full py-2 rounded bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-mono shadow-sm"
            >
              <span>password.sparrowx.net</span>
              <ArrowUpRight className="size-3" />
            </button>
          </div>

          {/* 4. SparrowX Shield */}
          <div className="p-6 space-y-4 flex flex-col justify-between hover:bg-sky-500/[0.04] transition-colors border-r border-sky-500/15 border-t border-sky-500/15">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="size-9 rounded-md bg-[#111A30] border border-orange-500/30 grid place-items-center text-orange-500">
                  <Shield className="size-4" />
                </div>
                <span className="text-[9px] font-mono text-orange-400 bg-orange-500/10 border border-orange-500/30 px-2 py-0.5 rounded font-bold">
                  CYBER ORANGE
                </span>
              </div>
              <h3 className="font-bold text-white text-base font-sans">SparrowX Shield</h3>
              <p className="text-xs text-[#A3B1C6] leading-relaxed">
                Shadowshield defense engine with our iconic 2D Dot-Matrix Threat Map. Sub-second DDoS deflection and complete origin IP cloaking.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleLaunch("sec", "https://sec.sparrowx.net", "shield")}
              className="w-full py-2 rounded bg-[#111A30] hover:bg-white hover:text-black border border-sky-500/20 text-xs font-mono text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>sec.sparrowx.net</span>
              <ArrowUpRight className="size-3" />
            </button>
          </div>

          {/* 5. SparrowX API Gateway */}
          <div className="p-6 space-y-4 flex flex-col justify-between hover:bg-sky-500/[0.04] transition-colors border-r border-sky-500/15 border-t border-sky-500/15">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="size-9 rounded-md bg-[#111A30] border border-indigo-500/30 grid place-items-center text-indigo-400">
                  <Terminal className="size-4" />
                </div>
                <span className="text-[9px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 rounded font-bold">
                  REST &amp; SDKs
                </span>
              </div>
              <h3 className="font-bold text-white text-base font-sans">SparrowX API Gateway</h3>
              <p className="text-xs text-[#A3B1C6] leading-relaxed">
                Instant RESTful API for your database with one-click code generation in cURL, TypeScript, and Python with ultra-fast latency.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleLaunch("api", "https://api.sparrowx.net", "api")}
              className="w-full py-2 rounded bg-[#111A30] hover:bg-white hover:text-black border border-sky-500/20 text-xs font-mono text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>api.sparrowx.net</span>
              <ArrowUpRight className="size-3" />
            </button>
          </div>

          {/* 6. SparrowX Cloud VPS */}
          <div className="p-6 space-y-4 flex flex-col justify-between hover:bg-sky-500/[0.04] transition-colors border-t border-sky-500/15">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="size-9 rounded-md bg-[#111A30] border border-sky-500/30 grid place-items-center text-sky-400">
                  <Cpu className="size-4" />
                </div>
                <span className="text-[9px] font-mono text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded font-bold">
                  FAST NVME
                </span>
              </div>
              <h3 className="font-bold text-white text-base font-sans">SparrowX Compute VPS</h3>
              <p className="text-xs text-[#A3B1C6] leading-relaxed">
                Affordable virtual machines with fast ECC RAM and NVMe storage. Predictable flat monthly rates in INR and USD.
              </p>
            </div>
            <a
              href="#vps"
              className="w-full py-2 rounded bg-[#111A30] hover:bg-white hover:text-black border border-sky-500/20 text-xs font-mono text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>View VPS Pricing</span>
              <ArrowRight className="size-3" />
            </a>
          </div>
        </div>
      </section>

      <ComparisonSection />

      {/* SECTION 5: OUR STORY / FOUNDER LETTER */}
      <section id="story" className="scroll-mt-24 border-t border-sky-500/15 bg-[#090E1D] px-4 sm:px-6 py-16">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="border border-sky-500/25 bg-[#0D1526] rounded-lg p-6 sm:p-10 space-y-5 shadow-2xl relative">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-sky-400">
              <Heart className="size-4 text-rose-400" />
              <span>A NOTE FROM OUR TEAM</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
              Why We Started SparrowX
            </h2>

            <div className="space-y-4 text-xs sm:text-sm text-[#A3B1C6] leading-relaxed font-sans">
              <p>
                When we were building our first projects as independent developers, we were constantly frustrated by large cloud monopolies. Signing up required navigating through dozens of confusing menus, and at the end of the month, we were hit with unexpected bandwidth and egress charges.
              </p>
              <p>
                We asked ourselves a simple question: <span className="text-white font-semibold">Why can&apos;t cloud tools just be simple, honest, and respectful?</span>
              </p>
              <p>
                If you just need a secure password, you shouldn&apos;t have to register an account. If you want to send a file to a coworker, it should be fast, private, and painless. If you want a database, it should just give you a working connection string without hidden bandwidth taxes.
              </p>
              <p>
                SparrowX is our answer. We are small, passionate, and proudly independent. We don&apos;t answer to corporate shareholders—we answer to you. Thank you for giving us a chance to power your work.
              </p>
            </div>

            <div className="pt-4 border-t border-sky-500/15 flex items-center justify-between text-xs font-mono">
              <span className="text-white font-bold">— The SparrowX Team</span>
              <span className="text-sky-400">Built with passion for builders</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: AFFORDABLE CLOUD VPS PLANS */}
      <section id="vps" className="scroll-mt-24 border-t border-sky-500/15 bg-[#070A12] px-4 sm:px-6 py-16">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sky-500/15 pb-6">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-sky-400 uppercase tracking-wider block font-bold">
                Affordable Cloud Hosting
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
                Simple, High-Speed Cloud VPS
              </h2>
              <p className="text-xs text-[#A3B1C6]">
                Dedicated performance with fast NVMe storage and zero hidden egress bandwidth fees.
              </p>
            </div>

            {/* Currency Switcher */}
            <div className="flex items-center gap-1 p-1 bg-[#0E172A] rounded-md border border-sky-500/25 text-xs font-mono">
              <button
                type="button"
                onClick={() => setVpsCurrency("INR")}
                className={`px-3 py-1 rounded transition-colors ${
                  vpsCurrency === "INR" ? "bg-sky-500 text-black font-bold" : "text-[#A3B1C6] hover:text-white"
                }`}
              >
                INR (â‚¹)
              </button>
              <button
                type="button"
                onClick={() => setVpsCurrency("USD")}
                className={`px-3 py-1 rounded transition-colors ${
                  vpsCurrency === "USD" ? "bg-sky-500 text-black font-bold" : "text-[#A3B1C6] hover:text-white"
                }`}
              >
                USD ($)
              </button>
            </div>
          </div>

          {/* 4 Plans Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-sky-500/15 border border-sky-500/20 rounded-lg bg-[#0C1222] overflow-hidden">
            {vpsPlans.map((plan) => (
              <div
                key={plan.id}
                className={`p-6 space-y-5 flex flex-col justify-between ${
                  plan.highlight ? "bg-sky-500/[0.06] border-t-2 border-t-sky-400" : ""
                }`}
              >
                <div className="space-y-3 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{plan.name}</span>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                        plan.highlight
                          ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                          : "bg-white/10 text-[#A3B1C6]"
                      }`}
                    >
                      {plan.tag}
                    </span>
                  </div>

                  <div>
                    <span className="text-2xl font-bold text-white tabular-nums">
                      {vpsCurrency === "INR" ? plan.priceInr : plan.priceUsd}
                    </span>
                    <span className="text-xs text-[#A3B1C6]">{plan.period}</span>
                  </div>

                  <div className="space-y-2 text-xs text-[#A3B1C6] pt-2 border-t border-sky-500/15">
                    <div className="flex justify-between">
                      <span className="text-[#8795AB]">CPU:</span>
                      <span className="text-white font-semibold">{plan.vCpu}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8795AB]">RAM:</span>
                      <span className="text-white font-semibold">{plan.ram}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8795AB]">Disk:</span>
                      <span className="text-white font-semibold">{plan.storage}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8795AB]">Egress:</span>
                      <span className="text-sky-400 font-semibold">{plan.bandwidth}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOperatorModalOpen(true)}
                  className={`w-full py-2.5 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                    plan.highlight
                      ? "bg-sky-500 hover:bg-sky-400 text-black shadow-[0_0_15px_rgba(56,189,248,0.3)]"
                      : "bg-[#111A30] hover:bg-white hover:text-black border border-sky-500/25 text-white"
                  }`}
                >
                  Deploy {plan.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ContactSection />

      {/* FOOTER */}
      <footer className="border-t border-sky-500/15 bg-[#05070D] px-6 py-10 text-[#A3B1C6] text-xs font-mono mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-left space-y-1">
            <div className="font-extrabold text-white text-sm flex items-center gap-2">
              <span>SPARROWX TECHNOLOGIES</span>
              <span className="text-[9px] text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/30">
                INDEPENDENT STARTUP
              </span>
            </div>
            <p className="text-[11px] text-[#8795AB]">
              Built with care for developers, startups, and privacy-conscious builders.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-[#A3B1C6]">
            <a href="https://sparrowx.net" className="hover:text-white transition-colors">
              sparrowx.net
            </a>
            <span className="text-[#475569]">&bull;</span>
            <a href="https://db.sparrowx.net" className="hover:text-white transition-colors">
              db.sparrowx.net
            </a>
            <span className="text-[#475569]">&bull;</span>
            <a href="https://sec.sparrowx.net" className="hover:text-white transition-colors">
              sec.sparrowx.net
            </a>
            <span className="text-[#475569]">&bull;</span>
            <a href="https://file.sparrowx.net" className="hover:text-white transition-colors">
              file.sparrowx.net
            </a>
            <span className="text-[#475569]">&bull;</span>
            <a href="https://password.sparrowx.net" className="hover:text-white transition-colors">
              password.sparrowx.net
            </a>
            <span className="text-[#475569]">&bull;</span>
            <a href="https://api.sparrowx.net" className="hover:text-white transition-colors">
              api.sparrowx.net
            </a>
            <span className="text-[#475569]">&bull;</span>
            <a href="#comparison" className="text-sky-400 hover:text-sky-300 transition-colors">
              Why Us
            </a>
            <span className="text-[#475569]">&bull;</span>
            <a href="#contact" className="text-sky-400 hover:text-sky-300 transition-colors">
              Contact
            </a>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px]">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>All Systems Operational</span>
            </div>
            <span className="text-[#475569]">&bull;</span>
            <button
              type="button"
              onClick={() => setOperatorModalOpen(true)}
              className="text-[#A3B1C6] hover:text-white transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <span className="text-[#475569]">&bull;</span>
            <span className="text-[#8795AB]">
              &copy; {new Date().getFullYear()} SparrowX
            </span>
          </div>
        </div>
      </footer>

      {/* Operator Sign In Dialog */}
      <OperatorLoginDialog
        open={operatorModalOpen}
        onOpenChange={setOperatorModalOpen}
        onSuccess={(user) => {
          if (onUserAuthenticated) {
            onUserAuthenticated(user);
          } else {
            onOpenLogin();
          }
        }}
      />
    </div>
  );
}
