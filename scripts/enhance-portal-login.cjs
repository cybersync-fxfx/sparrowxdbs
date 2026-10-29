const fs = require("fs");

let fileContent = fs.readFileSync("src/components/portals/ClientAndAdminPortals.tsx", "utf8");

// 1. Update imports
const oldImports = `import {
  Activity,
  ArrowRight,
  Boxes,
  Check,
  Copy,
  Database,
  Eye,
  FileSearch,
  Globe2,
  KeyRound,
  LockKeyhole,
  Plus,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Terminal,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";`;

const newImports = `import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Eye,
  EyeOff,
  FileSearch,
  Globe2,
  KeyRound,
  Lock,
  LockKeyhole,
  Mail,
  Plus,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Terminal,
  Trash2,
  User,
  Users,
  Wrench,
  Zap,
} from "lucide-react";`;

if (fileContent.includes(oldImports)) {
  fileContent = fileContent.replace(oldImports, newImports);
}

// 2. Identify PortalLoginScreen start
const loginScreenMarker = "export function PortalLoginScreen({";
const markerIndex = fileContent.indexOf(loginScreenMarker);

if (markerIndex === -1) {
  console.error("Could not find PortalLoginScreen");
  process.exit(1);
}

const beforeLoginScreen = fileContent.substring(0, markerIndex);

const newLoginScreen = `export function PortalLoginScreen({
  tenants,
  backendSource,
  onUserAuthenticated,
  onRegisterAndLoginUser,
}: {
  tenants: ClientTenant[];
  backendSource: "supabase" | "offline";
  onUserAuthenticated: (user: AppUser) => void;
  onRegisterAndLoginUser: (input: {
    fullName: string;
    email: string;
    password: string;
    orgName: string;
    primaryDomain: string;
    planTier: PlanTier;
    enabledModules: ServiceModuleId[];
  }) => Promise<{ error?: string }>;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  // Sign-In fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Sign-Up / Client Self-Onboarding fields
  const [fullName, setFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [primaryDomain, setPrimaryDomain] = useState("");
  const [planTier, setPlanTier] = useState<PlanTier>("Growth");
  const [selectedModules, setSelectedModules] = useState<ServiceModuleId[]>([
    "web_security",
    "ai_shield",
  ]);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signupError, setSignupError] = useState("");

  // Interactive Active Feature Highlight on Left Column
  const [activeHighlightModule, setActiveHighlightModule] = useState<ServiceModuleId>("ai_shield");

  const toggleModule = (id: ServiceModuleId) => {
    setSelectedModules((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((item) => item !== id)
          : prev
        : [...prev, id],
    );
  };

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError("");
    setIsSigningIn(true);

    const result = await authenticateAppUserFromBackend(loginEmail.trim(), loginPassword);
    setIsSigningIn(false);

    if (!result.user) {
      setLoginError(
        result.error ??
          "Invalid email or password. Please verify your credentials or use 1-Click Demo Access below.",
      );
      return;
    }

    // Check emergency lockdown
    if (result.user.admin !== "yes" && result.user.tenantId) {
      const linkedTenant = tenants.find((t) => t.id === result.user?.tenantId);
      if (linkedTenant && linkedTenant.status === "Lockdown") {
        setLoginError(
          \`Access Denied: Workspace \${linkedTenant.name} is currently under Emergency Lockdown by SparrowX Security Operations.\`,
        );
        return;
      }
    }

    onUserAuthenticated(result.user);
  };

  const handleQuickDemoAccess = () => {
    const demoUser: AppUser = {
      id: "USR-DEMO-01",
      email: "alex.rivera@acme.io",
      fullName: "Alex Rivera",
      password: "demo",
      admin: "no",
      tenantId: tenants[0]?.id ?? null,
    };
    onUserAuthenticated(demoUser);
  };

  const handleQuickAdminDemoAccess = () => {
    const adminUser: AppUser = {
      id: "USR-ADMIN-01",
      email: "security.lead@sparrowx.dev",
      fullName: "Elena Rostova (SOC Lead)",
      password: "admin",
      admin: "yes",
      tenantId: null,
    };
    onUserAuthenticated(adminUser);
  };

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    setSignupError("");
    if (!fullName.trim() || !signupEmail.trim() || !signupPassword) {
      setSignupError("Please provide your full name, work email address, and password.");
      return;
    }

    setIsSigningUp(true);
    const result = await onRegisterAndLoginUser({
      fullName: fullName.trim(),
      email: signupEmail.trim().toLowerCase(),
      password: signupPassword,
      orgName: orgName.trim(),
      primaryDomain: primaryDomain.trim(),
      planTier,
      enabledModules: selectedModules,
    });
    setIsSigningUp(false);

    if (result.error) {
      setSignupError(result.error);
    }
  };

  const modulePillars = [
    {
      id: "web_security" as ServiceModuleId,
      shortLabel: "Web & Edge WAF",
      title: "Web App & Website Defense",
      desc: "Sub-11ms Edge WAF blocking SQLi, XSS payloads, L7 bot floods, and enforcing strict TLS.",
      badge: "Sub-11ms Edge",
      icon: Globe2,
      accent: "from-orange-500/20 to-amber-500/10 text-orange-400 border-orange-500/30",
    },
    {
      id: "ai_shield" as ServiceModuleId,
      shortLabel: "AI Agent Guardrails",
      title: "LLM & MCP Tool Firewall",
      desc: "Instant system prompt jailbreak defense, rogue tool-call execution firewall & zero-leak PII redactor.",
      badge: "Prompt Shield Active",
      icon: Sparkles,
      accent: "from-purple-500/20 to-primary/10 text-purple-400 border-purple-500/30",
    },
    {
      id: "cloud_security" as ServiceModuleId,
      shortLabel: "Cloud & Endpoints",
      title: "Node & Host Isolation",
      desc: "1-click network freeze for compromised servers, Kubernetes pod validation & continuous CVE remediation.",
      badge: "1-Click Containment",
      icon: Server,
      accent: "from-blue-500/20 to-cyan-500/10 text-blue-400 border-blue-500/30",
    },
    {
      id: "compliance" as ServiceModuleId,
      shortLabel: "Continuous Audit",
      title: "Automated SOC 2 & ISO 27001",
      desc: "Automated control checks, immutable audit trails, and 1-click auditor evidence exports.",
      badge: "Audit-Ready CSVs",
      icon: FileSearch,
      accent: "from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30",
    },
  ];

  return (
    <div className="relative min-h-svh w-full bg-[#0a0a0c] text-foreground vibe-mesh-bg selection:bg-primary/20 selection:text-primary overflow-x-hidden font-sans">
      {/* Subtle Matrix / Grid Overlay */}
      <div className="pointer-events-none absolute inset-0 vibe-subtle-grid z-0 opacity-70" />

      {/* Atmospheric Ambient Light Flares */}
      <div className="pointer-events-none absolute -top-40 -left-40 size-96 rounded-full bg-primary/15 blur-[140px] z-0" />
      <div className="pointer-events-none absolute top-1/2 -right-40 size-96 rounded-full bg-emerald-500/10 blur-[150px] z-0" />

      {/* Top Floating Glass Navigation */}
      <header className="relative z-10 border-b border-white/[0.07] bg-[#0c0c0e]/80 backdrop-blur-xl px-4 sm:px-8 py-3.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-orange-600 text-white shadow-lg shadow-primary/25">
              <ShieldCheck className="size-5" />
              <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 border-2 border-[#0a0a0c]" />
            </div>
            <div>
              <div className="font-display text-base font-bold tracking-tight">
                sparrow<span className="text-primary">x</span>
              </div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                Autonomous SecOps & AI Shield
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden md:flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span>42 Global Edge Regions Live</span>
              <span className="text-white/20">·</span>
              <span className="font-mono text-emerald-400/90 font-medium">11ms Latency</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleQuickDemoAccess}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary hover:text-white shadow-sm"
                title="Instant 1-Click Access as Demo Client"
              >
                <Zap className="size-3.5" />
                <span className="hidden sm:inline">1-Click</span> Demo Drive
              </button>

              <button
                type="button"
                onClick={handleQuickAdminDemoAccess}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground hover:bg-white/[0.08]"
                title="Instant Access as Security Operator / Admin"
              >
                <LockKeyhole className="size-3.5 text-amber-400" />
                <span className="hidden md:inline">SOC Lead</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto grid max-w-7xl gap-10 px-4 sm:px-8 py-8 lg:py-14 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        {/* Left Column: Humanized, Inspiring Story */}
        <section className="space-y-6 lg:pr-4">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary shadow-[0_0_20px_rgba(240,90,40,0.2)]">
              <Sparkles className="size-3.5 animate-pulse" />
              <span>Next-Gen Threat Shield · Zero Clutter</span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl leading-[1.12]">
              Security that stays <br className="hidden sm:inline" />
              out of your way. <br />
              <span className="bg-gradient-to-r from-primary via-orange-400 to-amber-300 bg-clip-text text-transparent">
                Protect products in seconds.
              </span>
            </h1>

            <p className="text-sm sm:text-base leading-relaxed text-muted-foreground max-w-xl">
              No bloated consoles. No 60-page PDF audits. Drop in a single SDK key, pick only the modules your product actually needs—from edge WAF rules to LLM prompt shields—and let autonomous guardrails block attacks in real time.
            </p>
          </div>

          {/* Interactive Feature Pillars */}
          <div className="grid gap-3 sm:grid-cols-2 pt-2">
            {modulePillars.map((mod) => {
              const IconComp = mod.icon;
              const isSelected = activeHighlightModule === mod.id;
              return (
                <div
                  key={mod.id}
                  onClick={() => setActiveHighlightModule(mod.id)}
                  className={\`vibe-feature-card cursor-pointer rounded-xl p-4 transition-all \${
                    isSelected
                      ? "border-primary/50 bg-[#1f1e24] shadow-[0_0_25px_rgba(240,90,40,0.18)] ring-1 ring-primary/40"
                      : "hover:border-white/20"
                  }\`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={\`grid size-8 place-items-center rounded-lg border bg-gradient-to-br \${mod.accent}\`}>
                      <IconComp className="size-4" />
                    </span>
                    <span className="rounded-full bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {mod.badge}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-foreground tracking-tight">
                    {mod.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground/90 leading-relaxed">
                    {mod.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Live Trust & Human Metrics Footer */}
          <div className="pt-2 border-t border-white/[0.07] flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2 overflow-hidden">
                <span className="inline-block size-6 rounded-full bg-gradient-to-tr from-orange-500 to-amber-300 ring-2 ring-[#0a0a0c]" />
                <span className="inline-block size-6 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-400 ring-2 ring-[#0a0a0c]" />
                <span className="inline-block size-6 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-300 ring-2 ring-[#0a0a0c]" />
              </div>
              <span className="font-medium text-foreground/90">
                Shielding 400k+ API requests daily
              </span>
            </div>

            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="size-3" /> SOC 2 Ready
              </span>
              <span>·</span>
              <span className="text-muted-foreground flex items-center gap-1">
                <Shield className="size-3 text-primary" /> Zero Data Retained
              </span>
            </div>
          </div>
        </section>

        {/* Right Column: High-End Glassmorphic Workspace Gateway */}
        <section className="relative">
          {/* Subtle Outer Glow Behind Form */}
          <div className="pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-to-b from-primary/20 via-orange-500/10 to-transparent blur-xl opacity-60" />

          <div className="relative vibe-glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl">
            {/* Form Mode Header & Segmented Pill */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/[0.08] pb-5">
              <div>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  {mode === "signin" ? (
                    <>
                      <Lock className="size-5 text-primary" /> Welcome Back
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-5 text-primary" /> Create Your Workspace
                    </>
                  )}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {mode === "signin"
                    ? "Access your telemetry, live shields & incident command"
                    : "Zero-commitment setup. Launch your custom dashboard in 60s."}
                </p>
              </div>

              {/* Segmented Pill Switcher */}
              <div className="flex items-center self-start sm:self-auto rounded-xl border border-white/10 bg-black/40 p-1 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setLoginError("");
                  }}
                  className={\`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all \${
                    mode === "signin"
                      ? "bg-primary text-white shadow-md shadow-primary/30"
                      : "text-muted-foreground hover:text-foreground"
                  }\`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setSignupError("");
                  }}
                  className={\`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all \${
                    mode === "signup"
                      ? "bg-primary text-white shadow-md shadow-primary/30"
                      : "text-muted-foreground hover:text-foreground"
                  }\`}
                >
                  Create Account
                </button>
              </div>
            </div>

            {/* Quick Demo Helper Prompt */}
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.07] px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Zap className="size-4 shrink-0 text-primary" />
                <span className="truncate text-foreground/90">
                  Testing the platform? Jump in with preloaded live demo telemetry.
                </span>
              </div>
              <button
                type="button"
                onClick={handleQuickDemoAccess}
                className="shrink-0 font-semibold text-primary hover:underline hover:text-orange-400 flex items-center gap-1"
              >
                Instant Access <ArrowRight className="size-3" />
              </button>
            </div>

            {/* SIGN IN FORM */}
            {mode === "signin" ? (
              <form className="mt-5 space-y-4" onSubmit={handleSignIn}>
                <div>
                  <label className="text-xs font-medium text-foreground/90 flex items-center justify-between" htmlFor="login-email">
                    <span>Work Email Address</span>
                    <span className="text-[11px] font-mono text-muted-foreground">e.g. name@company.io</span>
                  </label>
                  <div className="relative mt-1.5">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                      <Mail className="size-4" />
                    </span>
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="alex.rivera@acme.io"
                      className="h-10 w-full rounded-xl border border-white/10 bg-black/40 pl-9 pr-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/80 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground/90" htmlFor="login-password">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setLoginEmail("alex.rivera@acme.io");
                        setLoginPassword("demo");
                      }}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Fill Demo Credentials
                    </button>
                  </div>
                  <div className="relative mt-1.5">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                      <Lock className="size-4" />
                    </span>
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="h-10 w-full rounded-xl border border-white/10 bg-black/40 pl-9 pr-10 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/80 focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                    <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSigningIn}
                  className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-500 font-semibold text-sm text-white shadow-lg shadow-primary/25 transition-all hover:opacity-95 hover:shadow-primary/40 active:scale-[0.99] disabled:opacity-50"
                >
                  <ShieldCheck className="size-4" />
                  {isSigningIn ? "Verifying Credentials..." : "Sign In to Workspace"}
                </button>

                <div className="pt-3 border-t border-white/[0.08] text-center text-xs text-muted-foreground">
                  New to SparrowX?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="font-semibold text-primary hover:underline"
                  >
                    Create an account & choose your modules
                  </button>
                </div>
              </form>
            ) : (
              /* CREATE ACCOUNT / ONBOARDING FORM */
              <form className="mt-5 space-y-4" onSubmit={handleSignUp}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-foreground/90" htmlFor="signup-name">
                      Full Name
                    </label>
                    <div className="relative mt-1">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-muted-foreground">
                        <User className="size-3.5" />
                      </span>
                      <input
                        id="signup-name"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Alex Rivera"
                        className="h-9 w-full rounded-xl border border-white/10 bg-black/40 pl-8 pr-3 text-xs text-foreground outline-none transition-all focus:border-primary/80 focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground/90" htmlFor="signup-email">
                      Work Email
                    </label>
                    <div className="relative mt-1">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-muted-foreground">
                        <Mail className="size-3.5" />
                      </span>
                      <input
                        id="signup-email"
                        type="email"
                        required
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="alex@acme.io"
                        className="h-9 w-full rounded-xl border border-white/10 bg-black/40 pl-8 pr-3 text-xs text-foreground outline-none transition-all focus:border-primary/80 focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground/90" htmlFor="signup-password">
                    Password
                  </label>
                  <div className="relative mt-1">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-muted-foreground">
                      <Lock className="size-3.5" />
                    </span>
                    <input
                      id="signup-password"
                      type={showSignupPassword ? "text" : "password"}
                      required
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="h-9 w-full rounded-xl border border-white/10 bg-black/40 pl-8 pr-9 text-xs text-foreground outline-none transition-all focus:border-primary/80 focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showSignupPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Optional Service Target */}
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      First Service Target (Optional)
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Can also add later
                    </span>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div>
                      <input
                        id="signup-org"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="Service Name (e.g. Acme Web)"
                        className="h-8 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
                      />
                    </div>
                    <div>
                      <input
                        id="signup-domain"
                        value={primaryDomain}
                        onChange={(e) => setPrimaryDomain(e.target.value)}
                        placeholder="Domain (https://app.acme.io)"
                        className="h-8 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
                      />
                    </div>
                  </div>
                </div>

                {/* Plan Tier Selection */}
                <div>
                  <label className="text-xs font-medium text-foreground/90" htmlFor="signup-plan">
                    Subscription Tier
                  </label>
                  <select
                    id="signup-plan"
                    value={planTier}
                    onChange={(e) => setPlanTier(e.target.value as PlanTier)}
                    className="mt-1 h-9 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-xs text-foreground outline-none focus:border-primary"
                  >
                    <option value="Starter">Starter — Up to 100k requests/mo</option>
                    <option value="Growth">Growth (Recommended) — Up to 2.5M requests/mo</option>
                    <option value="Enterprise">Enterprise — Unlimited + Dedicated 24/7 SOC</option>
                  </select>
                </div>

                {/* Modular Protection Selection */}
                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-foreground/90">
                    <span>Select Security Modules</span>
                    <span className="text-[10px] text-primary">Customizes your sidebar</span>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {SERVICE_MODULES.map((mod) => {
                      const checked = selectedModules.includes(mod.id);
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => toggleModule(mod.id)}
                          className={\`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all \${
                            checked
                              ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(240,90,40,0.12)] ring-1 ring-primary/30"
                              : "border-white/10 bg-black/30 hover:border-white/20"
                          }\`}
                        >
                          <span
                            className={\`mt-0.5 grid size-4 shrink-0 place-items-center rounded border text-[10px] transition-all \${
                              checked
                                ? "border-primary bg-primary text-white"
                                : "border-white/20 bg-white/5"
                            }\`}
                          >
                            {checked && <Check className="size-3" />}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-foreground truncate">
                              {mod.shortLabel}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {mod.title}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {signupError && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                    <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                    <span>{signupError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSigningUp}
                  className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-500 font-semibold text-sm text-white shadow-lg shadow-primary/25 transition-all hover:opacity-95 hover:shadow-primary/40 active:scale-[0.99] disabled:opacity-50"
                >
                  <Sparkles className="size-4" />
                  {isSigningUp
                    ? "Provisioning Your Custom Dashboard..."
                    : "Launch Custom Workspace 🚀"}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
`;

const finalContent = beforeLoginScreen + newLoginScreen;
fs.writeFileSync("src/components/portals/ClientAndAdminPortals.tsx", finalContent, "utf8");
console.log("PortalLoginScreen successfully updated with humanized, vibe-coded design!");
