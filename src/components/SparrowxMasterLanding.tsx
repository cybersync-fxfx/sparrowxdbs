import React, { useEffect, useState } from "react";
import {
  AlertCircle,
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
  Zap,
  Server,
  Layers,
  Check,
  ChevronDown,
  Menu,
  X,
  User,
  LogOut,
  Mail,
  Eye,
  EyeOff,
  Building2,
} from "lucide-react";
import { ComparisonSection } from "./landing/ComparisonSection";
import { ContactSection } from "./landing/ContactSection";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  authenticateAppUserFromBackend,
  fetchAppUserByEmailFromBackend,
  generateSecureSparrowKey,
  persistAppUserToBackend,
  persistClientTenantToBackend,
  type AppUser,
  type ClientTenant,
} from "@/lib/supabase";
import {
  clearSessionToken,
  issueSignedSessionToken,
  verifySessionToken,
} from "@/lib/advanced-features";
import { AnimatedCloudBackground } from "@/components/ui/AnimatedCloudBackground";
import { SparrowxFooter } from "@/components/SparrowxFooter";

interface SparrowxMasterLandingProps {
  onOpenLogin: () => void;
  onDirectNav?: (destination: string) => void;
  onUserAuthenticated?: (user: AppUser) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// -----------------------------------------------------------------------------
// Workspace Sign In & Account Creation Modal
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
  const [authTab, setAuthTab] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const emailClean = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(emailClean)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);

    try {
      const res = await authenticateAppUserFromBackend(emailClean, password);
      setLoading(false);

      if (res.user) {
        issueSignedSessionToken({
          id: res.user.id,
          email: res.user.email,
          fullName: res.user.fullName || res.user.email.split("@")[0] || "Operator",
          role: res.user.admin === "yes" ? "admin" : "client",
          tenantId: res.user.tenantId,
        });
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const emailClean = email.trim().toLowerCase();
    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!EMAIL_PATTERN.test(emailClean)) {
      setError("Please enter a valid developer email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const existingUser = await fetchAppUserByEmailFromBackend(emailClean);
      if (existingUser) {
        setError("An account with this email already exists. Please sign in instead.");
        setLoading(false);
        return;
      }

      const tenantId = `TNT-${Date.now().toString().slice(-4)}`;
      const cleanOrg = orgName.trim() || `${fullName.trim()} Workspace`;
      const newTenant: ClientTenant = {
        id: tenantId,
        name: cleanOrg,
        contactEmail: emailClean,
        primaryDomain: `${tenantId.toLowerCase()}.sparrowx.net`,
        planTier: "SparrowX Edge Core",
        status: "Active",
        enabledModules: ["cloud_security", "web_security", "ai_shield"],
        apiKey: generateSecureSparrowKey("spx_live"),
        sdkVerified: true,
        guardrailsActive: true,
        requestsPerMin: 0,
        blockedThreats: 0,
        avgLatencyMs: 0.8,
        quotaUsedPct: 1,
      };
      await persistClientTenantToBackend(newTenant);

      const newUser: AppUser = {
        id: `USR-${Date.now().toString().slice(-4)}`,
        email: emailClean,
        password,
        fullName: fullName.trim(),
        admin: "no",
        tenantId,
      };
      await persistAppUserToBackend(newUser);

      // Provision dedicated isolated PostgreSQL database for this unified account
      void fetch("/api/db/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          userId: newUser.id,
          email: emailClean,
          projectName: cleanOrg,
        }),
      }).catch(() => {});

      const safeUser: AppUser = { ...newUser, password: "" };
      issueSignedSessionToken({
        id: safeUser.id,
        email: safeUser.email,
        fullName: safeUser.fullName,
        role: "client",
        tenantId,
      });
      setLoading(false);
      onOpenChange(false);
      if (onSuccess) {
        onSuccess(safeUser);
      }
    } catch {
      setLoading(false);
      setError("Unable to create account in database. Please retry.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#090B10]/95 backdrop-blur-xl border border-white/25 text-white sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl sm:rounded-2xl font-sans shadow-[0_24px_80px_rgba(0,0,0,0.9),0_0_40px_rgba(255,255,255,0.06)]">
        {/* Top Accent Hairline & Ambient Glow */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/75 to-transparent" />
        <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-40 w-72 rounded-full bg-white/10 blur-3xl" />

        <DialogHeader className="relative px-6 pt-6 pb-4 pr-12 text-left space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl grid place-items-center shrink-0 border bg-white/10 border-white/30 text-white shadow-[0_0_20px_rgba(255,255,255,0.12)]">
              <Lock className="size-5" aria-hidden="true" />
            </div>
          </div>

          <div className="space-y-1">
            <DialogTitle className="text-xl font-bold text-white tracking-tight font-sans">
              {authTab === "signin" ? "Access Developer Workspace" : "Create SparrowX Account"}
            </DialogTitle>
            <DialogDescription className="text-[13px] text-zinc-400 leading-relaxed font-sans">
              {authTab === "signin"
                ? "Sign in with your verified credentials to manage your databases, shields, and vault."
                : "Provision an isolated database tenant, API key, and encrypted vault account."}
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Segmented Mode Switcher Below Header (Zero Close-Button Overlap) */}
        <div className="mx-6 mb-4 grid grid-cols-2 gap-1 rounded-xl bg-[#05060A] border border-white/20 p-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setAuthTab("signin");
              setError("");
            }}
            className={`py-2 px-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              authTab === "signin"
                ? "bg-white text-black shadow-[0_2px_12px_rgba(255,255,255,0.2)]"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Lock className="size-3.5" aria-hidden="true" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthTab("register");
              setError("");
            }}
            className={`py-2 px-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              authTab === "register"
                ? "bg-white text-black shadow-[0_2px_12px_rgba(255,255,255,0.2)]"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <User className="size-3.5" aria-hidden="true" />
            <span>Create Account</span>
          </button>
        </div>

        {error && (
          <div className="mx-6 mb-4 rounded-xl bg-white/10 border border-white/35 px-3.5 py-2.5 text-zinc-100 text-xs flex items-start gap-2.5">
            <AlertCircle className="size-4 shrink-0 text-white mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={authTab === "signin" ? handleSignIn : handleRegister} className="px-6 pb-5 space-y-4">
          {authTab === "register" && (
            <>
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-medium text-zinc-200 block">Full Name</label>
                <div className="relative group">
                  <User className="size-4 text-zinc-400 group-focus-within:text-white transition-colors pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Turner"
                    className="w-full rounded-xl border border-white/25 bg-[#05060A] hover:border-white/50 pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-2 focus:ring-white/25 transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-medium text-zinc-200 block">
                  Workspace / Organization <span className="text-zinc-400">(Optional)</span>
                </label>
                <div className="relative group">
                  <Building2 className="size-4 text-zinc-400 group-focus-within:text-white transition-colors pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Acme Cloud Lab"
                    className="w-full rounded-xl border border-white/25 bg-[#05060A] hover:border-white/50 pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-2 focus:ring-white/25 transition-all"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5 text-left">
            <label className="text-xs font-medium text-zinc-200 block">Account Email</label>
            <div className="relative group">
              <Mail className="size-4 text-zinc-400 group-focus-within:text-white transition-colors pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourdomain.com"
                className="w-full rounded-xl border border-white/25 bg-[#05060A] hover:border-white/50 pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-2 focus:ring-white/25 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            <label className="text-xs font-medium text-zinc-200 block">
              Password <span className="text-zinc-400">(min 6 chars)</span>
            </label>
            <div className="relative group">
              <Lock className="size-4 text-zinc-400 group-focus-within:text-white transition-colors pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-white/25 bg-[#05060A] hover:border-white/50 pl-10 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-2 focus:ring-white/25 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors cursor-pointer p-1"
              >
                {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl font-bold text-xs sm:text-sm tracking-tight flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer mt-1 bg-white hover:bg-zinc-200 text-black shadow-[0_4px_20px_rgba(255,255,255,0.2)]"
          >
            {loading ? <RefreshCw className="size-4 animate-spin" aria-hidden="true" /> : <Lock className="size-4" aria-hidden="true" />}
            <span>
              {loading
                ? "Verifying..."
                : authTab === "signin"
                  ? "Sign In"
                  : "Create Account"}
            </span>
            {!loading && <ArrowRight className="size-4" aria-hidden="true" />}
          </button>
        </form>

        {/* Subtle Security Footer Strip */}
        <div className="bg-[#05060A] border-t border-white/15 px-6 py-3.5 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-white" aria-hidden="true" />
            <button
              type="button"
              onClick={() => {
                setAuthTab(authTab === "signin" ? "register" : "signin");
                setError("");
              }}
              className="text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              {authTab === "signin" ? "New to SparrowX? Create account" : "Have an account? Sign in"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-zinc-300 hover:text-white font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Flagship Master Company Portal (sparrowx.net) - Pure Monochrome Black & White
// -----------------------------------------------------------------------------
export function SparrowxMasterLanding({
  onOpenLogin,
  onUserAuthenticated,
}: SparrowxMasterLandingProps) {
  const [operatorModalOpen, setOperatorModalOpen] = useState(false);
  const [vpsCurrency, setVpsCurrency] = useState<"INR" | "USD">("INR");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [sessionUser, setSessionUser] = useState<AppUser | null>(() => {
    const verified = verifySessionToken();
    if (!verified) return null;
    return {
      id: verified.sub,
      email: verified.email,
      fullName: verified.fullName || verified.email.split("@")[0] || "Operator",
      password: "",
      admin: verified.role === "admin" ? "yes" : "no",
      tenantId: verified.tenantId,
    };
  });

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
    `transition-colors ${activeSection === id ? "text-white font-semibold underline decoration-white underline-offset-8" : "hover:text-white"}`;

  const vpsPlans = [
    {
      id: "sx-micro",
      name: "SX-Micro",
      vCpu: "1 vCPU",
      ram: "2 GB ECC",
      storage: "40 GB Fast NVMe",
      bandwidth: "1 TB Anycast Bandwidth",
      priceInr: "₹340",
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
      priceInr: "₹670",
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
      priceInr: "₹1,260",
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
      priceInr: "₹2,440",
      priceUsd: "$29",
      period: "/mo",
      tag: "Heavy Workloads",
    },
  ];

  const directRoutes: Record<string, string> = {
    db: "/db",
    file: "/drop",
    drop: "/drop",
    password: "/keys",
    keys: "/keys",
    sec: "/shield",
    shield: "/shield",
    api: "/gateway",
    game: "/game",
  };

  const handleLaunch = (targetId: string, url: string, _param?: string) => {
    if (typeof window === "undefined") return;
    const directPath = directRoutes[targetId];
    if (directPath) {
      window.location.href = directPath;
      return;
    }
    window.location.href = url;
  };

  const handleLandingSignOut = () => {
    clearSessionToken();
    setSessionUser(null);
  };

  return (
    <div className="min-h-screen bg-[#05060A] text-white font-sans antialiased selection:bg-white selection:text-black flex flex-col relative overflow-x-hidden">
      <AnimatedCloudBackground variant="monochrome" intensity="full" />

      {/* SECTION 1: ELEGANT NAVBAR (MIDNIGHT BLACK & PURE WHITE) */}
      <header className="border-b border-white/10 bg-[#05060A]/90 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-14 px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Left Brand */}
          <a href="/" className="flex items-center gap-2.5 shrink-0 group">
            <img
              src="/sparrowx-logo.png"
              alt="SparrowX Autonomous Security Platform and Sovereign Developer Cloud Logo"
              width={36}
              height={36}
              className="size-9 object-contain shrink-0 drop-shadow-[0_4px_12px_rgba(255,255,255,0.22)] group-hover:scale-105 transition-transform duration-200"
            />
            <span className="font-bold text-sm tracking-wider text-white font-sans">
              SPARROWX
            </span>
          </a>

          {/* Center Navigation Links */}
          <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-7 text-xs text-zinc-400 font-sans font-medium">
            <div className="relative">
              <button
                type="button"
                onClick={() => setProductDropdownOpen(!productDropdownOpen)}
                className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-white font-medium"
              >
                <span>Products</span>
                <ChevronDown className="size-3.5 text-zinc-400" aria-hidden="true" />
              </button>

              {productDropdownOpen && (
                <div
                  className="absolute left-0 mt-3 w-64 rounded-lg bg-[#090B10] border border-white/20 p-2 shadow-2xl z-50 space-y-1 font-sans text-xs"
                  onMouseLeave={() => setProductDropdownOpen(false)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setProductDropdownOpen(false);
                      handleLaunch("db", "https://db.sparrowx.net", "db");
                    }}
                    className="w-full text-left p-2 rounded-md hover:bg-white/10 flex items-center gap-2.5 text-white cursor-pointer"
                  >
                    <img src="/logos/sparrowx-db.jpg" alt="SparrowX Cloud DB — Managed PostgreSQL and pgvector Studio" width={24} height={24} className="size-6 rounded object-cover shrink-0 border border-[#A3E635]/30" />
                    <div>
                      <div className="font-semibold text-xs">SparrowX Cloud DB</div>
                      <div className="text-[11px] text-zinc-400">PostgreSQL &amp; Vector Studio</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProductDropdownOpen(false);
                      handleLaunch("file", "https://file.sparrowx.net", "file");
                    }}
                    className="w-full text-left p-2 rounded-md hover:bg-white/10 flex items-center gap-2.5 text-white cursor-pointer"
                  >
                    <img src="/logos/sparrowx-drop.jpg" alt="SparrowX Drop — Encrypted File Transfer and 10GB Cloud Vault" width={24} height={24} className="size-6 rounded object-cover shrink-0 border border-purple-500/30" />
                    <div>
                      <div className="font-semibold text-xs">SparrowX Drop</div>
                      <div className="text-[11px] text-zinc-400">Ephemeral Drop &amp; 10GB Vault</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProductDropdownOpen(false);
                      handleLaunch("password", "https://password.sparrowx.net", "password");
                    }}
                    className="w-full text-left p-2 rounded-md hover:bg-white/10 flex items-center gap-2.5 text-white cursor-pointer"
                  >
                    <img src="/logos/sparrowx-keys.jpg" alt="SparrowX Keys — 100% Offline Cryptographic Password Generator" width={24} height={24} className="size-6 rounded object-cover shrink-0 border border-amber-500/30" />
                    <div>
                      <div className="font-semibold text-xs">SparrowX Keys</div>
                      <div className="text-[11px] text-zinc-400">Offline Key Generator</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProductDropdownOpen(false);
                      handleLaunch("sec", "https://sec.sparrowx.net", "shield");
                    }}
                    className="w-full text-left p-2 rounded-md hover:bg-white/10 flex items-center gap-2.5 text-white cursor-pointer"
                  >
                    <img src="/logos/sparrowx-shield.jpg" alt="SparrowX Shield — Edge WAF & Real-Time DDoS Threat Radar" width={24} height={24} className="size-6 rounded object-cover shrink-0 border border-[#F9103A]/30" />
                    <div>
                      <div className="font-semibold text-xs">SparrowX Shield</div>
                      <div className="text-[11px] text-zinc-400">Threat Map &amp; DDoS Defense</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProductDropdownOpen(false);
                      handleLaunch("api", "https://api.sparrowx.net", "api");
                    }}
                    className="w-full text-left p-2 rounded-md hover:bg-white/10 flex items-center gap-2.5 text-white cursor-pointer"
                  >
                    <Terminal className="size-4 text-white shrink-0" aria-hidden="true" />
                    <div>
                      <div className="font-semibold text-xs">SparrowX API Gateway</div>
                      <div className="text-[11px] text-zinc-400">REST API &amp; SDKs</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <a href="#comparison" aria-current={activeSection === "comparison" ? "true" : undefined} className={navLinkClass("comparison")}>
              Comparison
            </a>
            <a href="#story" aria-current={activeSection === "story" ? "true" : undefined} className={navLinkClass("story")}>
              Story
            </a>
            <a href="#vps" aria-current={activeSection === "vps" ? "true" : undefined} className={navLinkClass("vps")}>
              Pricing
            </a>
            <a href="#contact" aria-current={activeSection === "contact" ? "true" : undefined} className={navLinkClass("contact")}>
              Contact
            </a>
          </nav>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2.5">
            {sessionUser ? (
              <>
                <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 border border-white/20 text-white text-xs max-w-[170px] truncate">
                  <User className="size-3.5 shrink-0 text-white" aria-hidden="true" />
                  <span className="truncate">{sessionUser.fullName || sessionUser.email}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenLogin()}
                  className="hidden sm:inline-flex px-3.5 py-1.5 rounded-md bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-all items-center gap-1.5 cursor-pointer"
                >
                  <span>Console</span>
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleLandingSignOut}
                  className="hidden sm:inline-flex px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 hover:text-white transition-colors items-center gap-1.5 cursor-pointer"
                  title="Sign out of session"
                >
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setOperatorModalOpen(true)}
                  className="hidden sm:inline-flex px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
                >
                  Sign In
                </button>

                <button
                  type="button"
                  onClick={() => handleLaunch("db", "https://db.sparrowx.net", "db")}
                  className="px-3.5 py-1.5 rounded-md bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-all inline-flex items-center gap-1.5 cursor-pointer min-h-[34px] sm:min-h-0"
                >
                  <span>Get Started</span>
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </button>
              </>
            )}

            {/* Mobile Hamburger Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              className="md:hidden size-9 rounded-md bg-[#090B10] border border-white/25 text-white flex items-center justify-center cursor-pointer min-h-[36px] min-w-[36px]"
            >
              {mobileMenuOpen ? <X className="size-5 text-white" aria-hidden="true" /> : <Menu className="size-5 text-white" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#05060A] px-4 sm:px-6 pt-3 pb-6 space-y-4 max-h-[calc(100vh-56px)] overflow-y-auto no-scrollbar animate-in slide-in-from-top duration-200">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-bold block px-1">
                SparrowX Cloud Products
              </span>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLaunch("db", "https://db.sparrowx.net", "db");
                }}
                className="w-full text-left p-2.5 rounded-lg bg-[#090B10] border border-white/15 hover:border-white/40 flex items-center gap-3 text-white cursor-pointer min-h-[48px]"
              >
                <div className="size-8 rounded-md overflow-hidden border border-[#A3E635]/30 bg-[#050B07] shrink-0">
                  <img src="/logos/sparrowx-db.jpg" alt="SparrowX Cloud DB — Managed PostgreSQL" width={32} height={32} className="size-full object-cover scale-110" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-white">SparrowX Cloud DB</div>
                  <div className="text-[10px] text-zinc-400 truncate">Managed PostgreSQL &amp; Vector Studio</div>
                </div>
                <span className="text-[10px] font-mono text-zinc-300 shrink-0">db.sparrowx.net</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLaunch("file", "https://file.sparrowx.net", "file");
                }}
                className="w-full text-left p-2.5 rounded-lg bg-[#090B10] border border-white/15 hover:border-white/40 flex items-center gap-3 text-white cursor-pointer min-h-[48px]"
              >
                <div className="size-8 rounded-md overflow-hidden border border-purple-500/35 bg-[#090612] shrink-0">
                  <img src="/logos/sparrowx-drop.jpg" alt="SparrowX Drop — Encrypted File Vault" width={32} height={32} className="size-full object-cover scale-110" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-white">SparrowX Drop</div>
                  <div className="text-[10px] text-zinc-400 truncate">Zero-Disk Drop &amp; 10GB Cloud Vault</div>
                </div>
                <span className="text-[10px] font-mono text-zinc-300 shrink-0">file.sparrowx.net</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLaunch("password", "https://password.sparrowx.net", "password");
                }}
                className="w-full text-left p-2.5 rounded-lg bg-[#090B10] border border-white/15 hover:border-white/40 flex items-center gap-3 text-white cursor-pointer min-h-[48px]"
              >
                <div className="size-8 rounded-md overflow-hidden border border-amber-500/30 bg-[#0A0E17] shrink-0">
                  <img src="/logos/sparrowx-keys.jpg" alt="SparrowX Keys — Offline Password Generator" width={32} height={32} className="size-full object-cover scale-110" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-white">SparrowX Keys (Free)</div>
                  <div className="text-[10px] text-zinc-400 truncate">Offline Cryptographic Generator (No Login)</div>
                </div>
                <span className="text-[10px] font-mono text-zinc-300 shrink-0">password.sparrowx.net</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLaunch("sec", "https://sec.sparrowx.net", "shield");
                }}
                className="w-full text-left p-2.5 rounded-lg bg-[#090B10] border border-white/15 hover:border-white/40 flex items-center gap-3 text-white cursor-pointer min-h-[48px]"
              >
                <div className="size-8 rounded-md overflow-hidden border border-[#F9103A]/30 bg-[#0D0F16] shrink-0">
                  <img src="/logos/sparrowx-shield.jpg" alt="SparrowX Shield — Edge WAF & DDoS Defense" width={32} height={32} className="size-full object-cover scale-110" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-white">SparrowX Shield</div>
                  <div className="text-[10px] text-zinc-400 truncate">2D Dot-Matrix Threat Map &amp; DDoS Defense</div>
                </div>
                <span className="text-[10px] font-mono text-zinc-300 shrink-0">sec.sparrowx.net</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLaunch("api", "https://api.sparrowx.net", "api");
                }}
                className="w-full text-left p-2.5 rounded-lg bg-[#090B10] border border-white/15 hover:border-white/40 flex items-center gap-3 text-white cursor-pointer min-h-[48px]"
              >
                <div className="size-8 rounded bg-white/10 border border-white/25 grid place-items-center text-white shrink-0">
                  <Terminal className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-white">SparrowX API Gateway</div>
                  <div className="text-[10px] text-zinc-400 truncate">Instant REST API with cURL &amp; SDKs</div>
                </div>
                <span className="text-[10px] font-mono text-zinc-300 shrink-0">api.sparrowx.net</span>
              </button>
            </div>

            <div className="pt-2 border-t border-white/15 flex flex-col gap-2 font-mono text-xs">
              <a
                href="#comparison"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded bg-[#090B10] border border-white/15 text-zinc-300 hover:text-white flex items-center justify-between"
              >
                <span>Comparison</span>
                <ArrowRight className="size-3.5 text-white" aria-hidden="true" />
              </a>

              <a
                href="#story"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded bg-[#090B10] border border-white/15 text-zinc-300 hover:text-white flex items-center justify-between"
              >
                <span>Story</span>
                <ArrowRight className="size-3.5 text-white" aria-hidden="true" />
              </a>

              <a
                href="#vps"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded bg-[#090B10] border border-white/15 text-zinc-300 hover:text-white flex items-center justify-between"
              >
                <span>Pricing</span>
                <ArrowRight className="size-3.5 text-white" aria-hidden="true" />
              </a>

              <a
                href="#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded bg-[#090B10] border border-white/15 text-zinc-300 hover:text-white flex items-center justify-between"
              >
                <span>Contact</span>
                <ArrowRight className="size-3.5 text-white" aria-hidden="true" />
              </a>

              {sessionUser ? (
                <div className="space-y-2 pt-1">
                  <div className="p-2.5 rounded bg-white/10 border border-white/25 text-white font-mono text-xs flex items-center justify-between gap-2">
                    <span className="truncate">{sessionUser.fullName || sessionUser.email}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLandingSignOut();
                      }}
                      className="text-zinc-200 hover:text-white underline cursor-pointer shrink-0"
                    >
                      Sign Out
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenLogin();
                    }}
                    className="w-full min-h-[44px] rounded bg-white hover:bg-zinc-200 text-black font-bold font-mono text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Console</span>
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setOperatorModalOpen(true);
                  }}
                  className="w-full min-h-[44px] rounded bg-white hover:bg-zinc-200 text-black font-bold font-mono text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lock className="size-3.5" aria-hidden="true" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* SECTION 2: EMOTIONAL STARTUP HERO */}
      <section className="border-b border-white/15 bg-gradient-to-b from-black/80 via-black/60 to-transparent px-4 sm:px-6 py-10 sm:py-20 relative z-10 overflow-hidden">
        {/* Soft Animated Ambient Glow */}
        <div className="animate-spx-orb-1 absolute -top-10 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="animate-spx-orb-2 absolute bottom-0 right-1/5 w-72 h-72 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 items-center relative z-10">
          {/* Left Column: Human, Emotional Pitch */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight font-sans text-balance">
              Simple, Honest Cloud Tools <br />
              <span className="text-zinc-300">Built for Real Builders.</span>
            </h1>

            <p className="text-xs sm:text-base text-zinc-400 max-w-2xl leading-relaxed">
              We&apos;re a small, independent developer team building fast cloud databases, instant encrypted file sharing, hardware-grade offline passwords, and automated DDoS defense.
              No surprise bills, no shady telemetry, and no forced logins for simple utilities.
            </p>

            {/* Core Action Buttons (Mobile-friendly stacked row) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleLaunch("file", "https://file.sparrowx.net", "file")}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.2)] font-mono"
              >
                <FileUp className="size-4" aria-hidden="true" />
                <span>Instant File Drop (No Login)</span>
              </button>

              <button
                type="button"
                onClick={() => handleLaunch("password", "https://password.sparrowx.net", "password")}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded bg-[#090B10]/90 backdrop-blur-md border border-white/30 hover:border-white/60 text-white font-mono text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <KeyRound className="size-4 text-white" aria-hidden="true" />
                <span>Offline Keys (No Login)</span>
              </button>

              <button
                type="button"
                onClick={() => handleLaunch("db", "https://db.sparrowx.net", "db")}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded bg-transparent border border-white/25 hover:border-white/50 text-zinc-300 hover:text-white font-mono text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer backdrop-blur-sm"
              >
                <Database className="size-4 text-white" aria-hidden="true" />
                <span>Postgres Studio</span>
              </button>
            </div>
          </div>

          {/* Right Column: Why Developers Love Us Card */}
          <div id="status" className="scroll-mt-24 lg:col-span-5 border border-white/20 bg-[#090B10]/90 backdrop-blur-md rounded-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <span className="text-xs font-mono text-white font-bold uppercase tracking-wider">
                Why Builders Choose SparrowX
              </span>
              <span className="text-white text-[10px] font-mono flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-white animate-pulse" aria-hidden="true" />
                ONLINE &amp; ACTIVE
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded bg-[#05060A] border border-white/15 space-y-1">
                <div className="font-bold text-white flex items-center gap-2">
                  <Zap className="size-3.5 text-white" aria-hidden="true" />
                  <span>Zero Forced Sign-Ups</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Need a secure 64-character password or to send a file to a client? Just open the link and do it. No account creation required.
                </p>
              </div>

              <div className="p-3 rounded bg-[#05060A] border border-white/15 space-y-1">
                <div className="font-bold text-white flex items-center gap-2">
                  <Shield className="size-3.5 text-white" aria-hidden="true" />
                  <span>DDoS Mitigation &amp; Origin Protection</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Proxy your origin server IP behind our reverse proxy to filter DDoS floods and inspect traffic in real time.
                </p>
              </div>

              <div className="p-3 rounded bg-[#05060A] border border-white/15 space-y-1">
                <div className="font-bold text-white flex items-center gap-2">
                  <Heart className="size-3.5 text-white" aria-hidden="true" />
                  <span>Real Human Support</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  We are a small startup. When you reach out to us, you talk directly to the engineers building the product.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: 6 DEDICATED PRODUCT TOOLS (BENTO GRID) */}
      <section id="products" className="scroll-mt-24 px-4 sm:px-6 py-16 max-w-7xl mx-auto w-full space-y-8 relative z-10">
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
            Six Focused Tools. Zero Clutter.
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Each tool has its own dedicated home with specialized features built for speed and security.
          </p>
        </div>

        {/* 6 PRODUCTS GRID */}
        <div className="border border-white/20 bg-[#090B10]/90 backdrop-blur-md rounded-lg divide-y md:divide-y-0 divide-white/15 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 overflow-hidden shadow-xl">
          {/* 1. SparrowX Cloud DB */}
          <div className="p-6 space-y-4 flex flex-col justify-between hover:bg-white/[0.04] transition-colors border-r border-white/15">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-lg overflow-hidden border border-[#A3E635]/30 bg-[#050B07] shrink-0">
                  <img src="/logos/sparrowx-db.jpg" alt="SparrowX Cloud DB — Managed PostgreSQL with pgvector AI search" width={40} height={40} loading="lazy" className="size-full object-cover scale-110" />
                </div>
                <span className="text-[9px] font-mono text-white bg-white/10 border border-white/25 px-2 py-0.5 rounded font-bold">
                  POSTGRES + VECTOR
                </span>
              </div>
              <h3 className="font-bold text-white text-base font-sans">SparrowX Cloud DB</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Fast, reliable managed PostgreSQL with built-in connection pooling and pgvector search. No sudden $1,000 bandwidth bills.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleLaunch("db", "https://db.sparrowx.net", "db")}
              className="w-full py-2 rounded bg-[#0D1017] hover:bg-white hover:text-black border border-white/25 text-xs font-mono text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>db.sparrowx.net</span>
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </button>
          </div>

          {/* 2. SparrowX Drop */}
          <div className="p-6 space-y-4 flex flex-col justify-between hover:bg-white/[0.04] transition-colors border-r border-white/15">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-lg overflow-hidden border border-purple-500/35 bg-[#090612] shrink-0">
                  <img src="/logos/sparrowx-drop.jpg" alt="SparrowX Drop — Encrypted Ephemeral File Vault and Secure Sharing" width={40} height={40} loading="lazy" className="size-full object-cover scale-110" />
                </div>
                <span className="text-[9px] font-mono text-white bg-white/10 border border-white/25 px-2 py-0.5 rounded font-bold">
                  FREE • NO LOGIN
                </span>
              </div>
              <h3 className="font-bold text-white text-base font-sans">SparrowX Drop</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Drop files instantly with zero login (auto-purged from memory for privacy) or unlock your persistent 10GB cloud vault.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleLaunch("file", "https://file.sparrowx.net", "file")}
              className="w-full py-2 rounded bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-mono shadow-sm"
            >
              <span>file.sparrowx.net</span>
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </button>
          </div>

          {/* 3. SparrowX Keys */}
          <div className="p-6 space-y-4 flex flex-col justify-between hover:bg-white/[0.04] transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-lg overflow-hidden border border-amber-500/30 bg-[#0A0E17] shrink-0">
                  <img src="/logos/sparrowx-keys.jpg" alt="SparrowX Keys — 100% Offline Cryptographic Password Generator" width={40} height={40} loading="lazy" className="size-full object-cover scale-110" />
                </div>
                <span className="text-[9px] font-mono text-white bg-white/10 border border-white/25 px-2 py-0.5 rounded font-bold">
                  FREE • NO LOGIN
                </span>
              </div>
              <h3 className="font-bold text-white text-base font-sans">SparrowX Keys</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                100% offline cryptographic password generator. Press spacebar to regenerate. Runs directly in your browser with zero network calls.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleLaunch("password", "https://password.sparrowx.net", "password")}
              className="w-full py-2 rounded bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-mono shadow-sm"
            >
              <span>password.sparrowx.net</span>
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </button>
          </div>

          {/* 4. SparrowX Shield */}
          <div className="p-6 space-y-4 flex flex-col justify-between hover:bg-white/[0.04] transition-colors border-r border-white/15 border-t border-white/15">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-lg overflow-hidden border border-[#F9103A]/30 bg-[#0D0F16] shrink-0">
                  <img src="/logos/sparrowx-shield.jpg" alt="SparrowX Shield — Edge WAF and Real-Time DDoS Threat Radar" width={40} height={40} loading="lazy" className="size-full object-cover scale-110" />
                </div>
                <span className="text-[9px] font-mono text-white bg-white/10 border border-white/25 px-2 py-0.5 rounded font-bold">
                  EDGE DEFENSE
                </span>
              </div>
              <h3 className="font-bold text-white text-base font-sans">SparrowX Shield</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Shadowshield defense engine with our iconic 2D Dot-Matrix Threat Map. Sub-second DDoS deflection and complete origin IP cloaking.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleLaunch("sec", "https://sec.sparrowx.net", "shield")}
              className="w-full py-2 rounded bg-[#0D1017] hover:bg-white hover:text-black border border-white/25 text-xs font-mono text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>sec.sparrowx.net</span>
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </button>
          </div>

          {/* 5. SparrowX API Gateway */}
          <div className="p-6 space-y-4 flex flex-col justify-between hover:bg-white/[0.04] transition-colors border-r border-white/15 border-t border-white/15">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="size-9 rounded-md bg-white/10 border border-white/25 grid place-items-center text-white">
                  <Terminal className="size-4" aria-hidden="true" />
                </div>
                <span className="text-[9px] font-mono text-white bg-white/10 border border-white/25 px-2 py-0.5 rounded font-bold">
                  REST &amp; SDKs
                </span>
              </div>
              <h3 className="font-bold text-white text-base font-sans">SparrowX API Gateway</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Instant RESTful API for your database with one-click code generation in cURL, TypeScript, and Python with ultra-fast latency.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleLaunch("api", "https://api.sparrowx.net", "api")}
              className="w-full py-2 rounded bg-[#0D1017] hover:bg-white hover:text-black border border-white/25 text-xs font-mono text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>api.sparrowx.net</span>
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </button>
          </div>

          {/* 6. SparrowX Cloud VPS */}
          <div className="p-6 space-y-4 flex flex-col justify-between hover:bg-white/[0.04] transition-colors border-t border-white/15">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="size-9 rounded-md bg-white/10 border border-white/25 grid place-items-center text-white">
                  <Cpu className="size-4" aria-hidden="true" />
                </div>
                <span className="text-[9px] font-mono text-white bg-white/10 border border-white/25 px-2 py-0.5 rounded font-bold">
                  FAST NVME
                </span>
              </div>
              <h3 className="font-bold text-white text-base font-sans">SparrowX Compute VPS</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Affordable virtual machines with fast ECC RAM and NVMe storage. Predictable flat monthly rates in INR and USD.
              </p>
            </div>
            <a
              href="#vps"
              className="w-full py-2 rounded bg-[#0D1017] hover:bg-white hover:text-black border border-white/25 text-xs font-mono text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>View VPS Pricing</span>
              <ArrowRight className="size-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <div className="relative z-10">
        <ComparisonSection />
      </div>

      {/* SECTION 5: SHORT EMOTIONAL STORY TEASER -> FULL /story PAGE */}
      <section id="story" className="scroll-mt-24 border-t border-white/15 bg-[#05060A]/80 backdrop-blur-sm px-4 sm:px-6 py-14 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="border border-white/20 bg-[#090B10]/90 backdrop-blur-md rounded-lg p-6 sm:p-9 space-y-6 shadow-2xl relative">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-zinc-300">
              <Heart className="size-4 text-white" aria-hidden="true" />
              <span>A NOTE FROM OUR TEAM</span>
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
                Why We Started SparrowX
              </h2>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans">
                We started SparrowX after one too many late nights watching independent projects get punished by surprise cloud bandwidth bills, $2,000/month security paywalls, and everyday tools that demand an account just to send a file. We believe builders deserve infrastructure that feels human—fast, private, and radically affordable.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-md border border-white/15 bg-[#05060A] p-3.5 space-y-1">
                <div className="font-mono font-bold text-white flex items-center gap-1.5">
                  <Shield className="size-3.5 shrink-0 text-white" aria-hidden="true" />
                  <span>Honest Security</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  Live L7 DDoS defense &amp; offline CSPRNG keys without enterprise extortion.
                </p>
              </div>
              <div className="rounded-md border border-white/15 bg-[#05060A] p-3.5 space-y-1">
                <div className="font-mono font-bold text-white flex items-center gap-1.5">
                  <FileUp className="size-3.5 shrink-0 text-white" aria-hidden="true" />
                  <span>Zero-Login File Drop</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  Browser-sealed AES-256-GCM transfers that burn from RAM—plus a free 10 GB vault.
                </p>
              </div>
              <div className="rounded-md border border-white/15 bg-[#05060A] p-3.5 space-y-1">
                <div className="font-mono font-bold text-white flex items-center gap-1.5">
                  <Database className="size-3.5 shrink-0 text-white" aria-hidden="true" />
                  <span>Low-Cost Cloud DB</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  Bare-metal NVMe PostgreSQL &amp; $4/mo compute with zero surprise egress fees.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono">
              <div>
                <span className="text-white font-bold">— The SparrowX Team</span>
                <span className="ml-2 text-zinc-400 hidden sm:inline">&middot; Built with passion for builders</span>
              </div>
              <a
                href="/story"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-white hover:bg-zinc-200 text-black font-bold transition-colors shadow-[0_0_15px_rgba(255,255,255,0.18)]"
              >
                <span>Read Our Full Story &amp; Manifesto</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: AFFORDABLE CLOUD VPS PLANS */}
      <section id="vps" className="scroll-mt-24 border-t border-white/15 bg-[#05060A]/75 px-4 sm:px-6 py-16 relative z-10">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/15 pb-6">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-zinc-300 uppercase tracking-wider block font-bold">
                Affordable Cloud Hosting
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
                Simple, High-Speed Cloud VPS
              </h2>
              <p className="text-xs text-zinc-400">
                Dedicated performance with fast NVMe storage and zero hidden egress bandwidth fees.
              </p>
            </div>

            {/* Currency Switcher */}
            <div className="flex items-center gap-1 p-1 bg-[#090B10] rounded-md border border-white/25 text-xs font-mono">
              <button
                type="button"
                onClick={() => setVpsCurrency("INR")}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                  vpsCurrency === "INR" ? "bg-white text-black font-bold" : "text-zinc-400 hover:text-white"
                }`}
              >
                INR (₹)
              </button>
              <button
                type="button"
                onClick={() => setVpsCurrency("USD")}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                  vpsCurrency === "USD" ? "bg-white text-black font-bold" : "text-zinc-400 hover:text-white"
                }`}
              >
                USD ($)
              </button>
            </div>
          </div>

          {/* 4 Plans Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/15 border border-white/20 rounded-lg bg-[#090B10]/90 backdrop-blur-md overflow-hidden shadow-xl">
            {vpsPlans.map((plan) => (
              <div
                key={plan.id}
                className={`p-6 space-y-5 flex flex-col justify-between ${
                  plan.highlight ? "bg-white/[0.06] border-t-2 border-t-white" : ""
                }`}
              >
                <div className="space-y-3 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{plan.name}</span>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                        plan.highlight
                          ? "bg-white text-black border border-white"
                          : "bg-white/10 text-zinc-300 border border-white/20"
                      }`}
                    >
                      {plan.tag}
                    </span>
                  </div>

                  <div>
                    <span className="text-2xl font-bold text-white tabular-nums">
                      {vpsCurrency === "INR" ? plan.priceInr : plan.priceUsd}
                    </span>
                    <span className="text-xs text-zinc-400">{plan.period}</span>
                  </div>

                  <div className="space-y-2 text-xs text-zinc-300 pt-2 border-t border-white/15">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">CPU:</span>
                      <span className="text-white font-semibold">{plan.vCpu}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">RAM:</span>
                      <span className="text-white font-semibold">{plan.ram}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Disk:</span>
                      <span className="text-white font-semibold">{plan.storage}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Egress:</span>
                      <span className="text-white font-semibold">{plan.bandwidth}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOperatorModalOpen(true)}
                  className={`w-full py-2.5 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                    plan.highlight
                      ? "bg-white hover:bg-zinc-200 text-black shadow-[0_0_15px_rgba(255,255,255,0.25)]"
                      : "bg-[#0D1017] hover:bg-white hover:text-black border border-white/30 text-white"
                  }`}
                >
                  Deploy {plan.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="relative z-10">
        <ContactSection />
      </div>

      {/* FOOTER */}
      <SparrowxFooter
        onLaunchService={handleLaunch}
        isAuthenticated={Boolean(sessionUser)}
        onSignIn={() => setOperatorModalOpen(true)}
        onSignOut={handleLandingSignOut}
        inPageAnchors={true}
      />

      {/* Operator Sign In & Account Creation Dialog */}
      <OperatorLoginDialog
        open={operatorModalOpen}
        onOpenChange={setOperatorModalOpen}
        onSuccess={(user) => {
          setSessionUser(user);
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
