import React, { useEffect, useState } from "react";
import { requestGlobalEmailVerification } from "@/components/EmailVerificationModal";
import {
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  RefreshCw,
  Shield,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  authenticateAppUserFromBackend,
  fetchAllWorkspaceData,
  fetchAppUserByEmailFromBackend,
  persistAppUserToBackend,
  persistAssetToBackend,
  persistIncidentToBackend,
  type AppUser,
  type Asset,
  type ClientTenant,
  type Incident,
  type ProtectedService,
} from "@/lib/supabase";
import {
  clearSessionToken,
  issueSignedSessionToken,
  verifySessionToken,
} from "@/lib/advanced-features";
import {
  clearMasterSsoSession,
  ensureDeveloperConnection,
  syncMasterSsoSession,
} from "@/lib/developer-connection";
import { ShieldLandingView } from "./shield/ShieldLandingView";
import { ShieldClientAreaView } from "./shield/ShieldClientAreaView";
import { ShieldSocDashboardView } from "./shield/ShieldSocDashboardView";

export interface SparrowxShieldEngineProps {
  currentUser?: AppUser | null;
  onUserAuthenticated?: (user: AppUser) => void;
  onOpenClientArea?: () => void;
  onSignOut?: () => void;
  initialStage?: ShieldStage;
}

export type ShieldStage = "landing" | "client-area" | "dashboard";

function readInitialShieldUser(propUser?: AppUser | null): AppUser | null {
  if (propUser) return propUser;
  if (typeof window === "undefined") return null;
  const verified = verifySessionToken();
  if (verified) {
    return {
      id: verified.sub,
      email: verified.email,
      fullName: verified.fullName || verified.email.split("@")[0] || "Operator",
      password: "",
      admin: verified.role === "admin" ? "yes" : "no",
      tenantId: verified.tenantId,
    };
  }
  const rawAuthUser = localStorage.getItem("sparrowx_auth_user");
  if (rawAuthUser) {
    try {
      const parsed = JSON.parse(rawAuthUser) as Partial<AppUser>;
      if (parsed && typeof parsed.email === "string" && parsed.email.includes("@")) {
        return {
          id: String(parsed.id || "USR-SHIELD"),
          email: parsed.email,
          fullName: String(parsed.fullName || parsed.email.split("@")[0]),
          password: "",
          admin: parsed.admin === "yes" ? "yes" : "no",
          tenantId: parsed.tenantId ?? null,
        };
      }
    } catch {
      // Ignore malformed sparrowx_auth_user
    }
  }
  return null;
}

export function SparrowxShieldEngine({
  currentUser,
  onUserAuthenticated,
  onSignOut,
  initialStage,
}: SparrowxShieldEngineProps = {}) {
  const [sessionUser, setSessionUser] = useState<AppUser | null>(() => currentUser ?? null);
  const activeUser = currentUser ?? sessionUser;

  const [viewStage, setViewStage] = useState<ShieldStage>(() => {
    if (initialStage) return initialStage;
    return currentUser ? "client-area" : "landing";
  });

  // Workspace collections loaded ONLY after authentication
  const [tenants, setTenants] = useState<ClientTenant[]>([]);
  const [services, setServices] = useState<ProtectedService[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  // Auth dialog state
  const [socModalOpen, setSocModalOpen] = useState(false);
  const [socAuthMode, setSocAuthMode] = useState<"signin" | "register">("signin");
  const [selectedPlanForAuth, setSelectedPlanForAuth] = useState<string | null>(null);
  const [socFullName, setSocFullName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (currentUser) {
      setSessionUser(currentUser);
      setViewStage((prev) => (prev === "landing" ? "client-area" : prev));
    } else {
      const next = readInitialShieldUser(null);
      setSessionUser(next);
      if (next) {
        setViewStage((prev) => (prev === "landing" ? "client-area" : prev));
      } else {
        setViewStage("landing");
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (!activeUser) return;
    let cancelled = false;
    void (async () => {
      try {
        const ws = await fetchAllWorkspaceData();
        if (cancelled) return;
        setTenants(ws.clientTenants ?? []);
        setServices(ws.protectedServices ?? []);
        setIncidents(ws.incidents ?? []);
        setAssets(ws.assets ?? []);
      } catch {
        // Offline / empty backend stays cleanly empty (zero fake data)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeUser?.id, activeUser?.email]);

  const handleShieldSignOut = () => {
    clearSessionToken();
    void clearMasterSsoSession();
    if (typeof window !== "undefined") {
      localStorage.removeItem("sparrowx_auth_user");
    }
    setSessionUser(null);
    setViewStage("landing");
    onSignOut?.();
  };

  const completeAuthTransition = (user: AppUser) => {
    issueSignedSessionToken({
      id: user.id,
      email: user.email,
      fullName: user.fullName || user.email.split("@")[0] || "Operator",
      role: user.admin === "yes" ? "admin" : "client",
      tenantId: user.tenantId,
    });
    setSessionUser(user);
    setSocModalOpen(false);
    // Strict post-login destination: Client Area BEFORE Dashboard
    setViewStage("client-area");
    onUserAuthenticated?.(user);
    if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleResolveIncident = async (id: string) => {
    const next = incidents.map((inc) =>
      inc.id === id ? { ...inc, status: "Contained" as const } : inc,
    );
    setIncidents(next);
    const updated = next.find((i) => i.id === id);
    if (updated) {
      await persistIncidentToBackend(updated);
    }
  };

  const handleToggleAssetIsolation = async (id: string) => {
    const next = assets.map((a) =>
      a.id === id
        ? { ...a, status: (a.status === "Isolated" ? "Protected" : "Isolated") as Asset["status"] }
        : a,
    );
    setAssets(next);
    const updated = next.find((a) => a.id === id);
    if (updated) {
      await persistAssetToBackend(updated);
    }
  };

  const openAuthModal = (mode: "signin" | "register" = "signin", planLabel?: string) => {
    setSocAuthMode(mode);
    setSelectedPlanForAuth(planLabel ?? null);
    setAuthError("");
    setSocModalOpen(true);
  };

  const handleEnterClientArea = () => {
    if (!activeUser) {
      openAuthModal("signin");
      return;
    }
    setViewStage("client-area");
  };

  const handleEnterDashboard = () => {
    if (!activeUser) {
      openAuthModal("signin");
      return;
    }
    setViewStage("dashboard");
  };

  return (
    <>
      {viewStage === "dashboard" && activeUser ? (
        <ShieldSocDashboardView
          activeUser={activeUser}
          tenants={tenants}
          incidents={incidents}
          assets={assets}
          onIncidentsUpdated={setIncidents}
          onResolveIncident={handleResolveIncident}
          onToggleAssetIsolation={handleToggleAssetIsolation}
          onBackToClientArea={() => setViewStage("client-area")}
          onSignOut={handleShieldSignOut}
        />
      ) : viewStage === "client-area" && activeUser ? (
        <ShieldClientAreaView
          activeUser={activeUser}
          tenants={tenants}
          services={services}
          incidents={incidents}
          onTenantsUpdated={setTenants}
          onServicesUpdated={setServices}
          onOpenDashboard={() => setViewStage("dashboard")}
          onBackToLanding={() => setViewStage("landing")}
          onSignOut={handleShieldSignOut}
        />
      ) : (
        <ShieldLandingView
          activeUser={activeUser}
          onOpenAuthModal={openAuthModal}
          onEnterClientArea={handleEnterClientArea}
          onEnterDashboard={handleEnterDashboard}
          onSignOut={handleShieldSignOut}
        />
      )}

      {/* Operator Auth Dialog (Transitions directly to Client Area upon login) */}
      <Dialog open={socModalOpen} onOpenChange={setSocModalOpen}>
        <DialogContent className="font-soc bg-[#0B0E17]/95 backdrop-blur-xl border border-[#F4F6FA]/[0.10] text-[#F4F6FA] sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.85)]">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[#F9103A]/75 to-transparent" />

          <DialogHeader className="relative px-6 pt-6 pb-4 pr-12 text-left space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#F9103A]/15 border border-[#F9103A]/35 text-[#F9103A] grid place-items-center shrink-0">
                <Shield className="size-5" />
              </div>
            </div>

            <div className="space-y-1">
              <DialogTitle className="text-xl font-medium text-[#F4F6FA] tracking-tight">
                {socAuthMode === "signin"
                  ? "Sign In to Shield Client Area"
                  : "Register Shield Operator"}
              </DialogTitle>
              <DialogDescription className="text-[13px] text-[#F4F6FA]/60 leading-relaxed">
                {socAuthMode === "signin"
                  ? "Sign in to access your Client Area, manage domain keys, and launch the Security + SOC Dashboard."
                  : "Provision your SparrowX Shield Client Area operator account."}
              </DialogDescription>
            </div>
          </DialogHeader>

          {selectedPlanForAuth && (
            <div className="mx-6 mb-3 flex items-center justify-between rounded-xl border border-[#F9103A]/35 bg-[#F9103A]/10 px-3.5 py-2 text-xs">
              <span className="text-[#F4F6FA]/75">Selected Plan</span>
              <span className="font-mono font-semibold text-[#FFEBB9]">{selectedPlanForAuth}</span>
            </div>
          )}

          <div
            role="tablist"
            aria-label="Operator authentication mode"
            className="mx-6 mb-4 grid grid-cols-2 gap-1 rounded-xl bg-[#06080E] border border-[#F4F6FA]/[0.07] p-1 text-xs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={socAuthMode === "signin"}
              onClick={() => {
                setSocAuthMode("signin");
                setAuthError("");
              }}
              className={`py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                socAuthMode === "signin"
                  ? "bg-[#F9103A] text-[#F4F6FA]"
                  : "text-[#F4F6FA]/55 hover:text-[#F4F6FA]"
              }`}
            >
              <Lock className="size-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={socAuthMode === "register"}
              onClick={() => {
                setSocAuthMode("register");
                setAuthError("");
              }}
              className={`py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                socAuthMode === "register"
                  ? "bg-[#F9103A] text-[#F4F6FA]"
                  : "text-[#F4F6FA]/55 hover:text-[#F4F6FA]"
              }`}
            >
              <User className="size-3.5" />
              <span>Register</span>
            </button>
          </div>

          {authError && (
            <div className="mx-6 mb-4 rounded-xl bg-[#F9103A]/10 border border-[#F9103A]/30 px-3.5 py-2.5 text-[#FFEBB9] text-xs flex items-start gap-2.5">
              <AlertTriangle className="size-4 shrink-0 text-[#F9103A] mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setAuthLoading(true);
              setAuthError("");
              const emailClean = authEmail.trim().toLowerCase();
              try {
                if (socAuthMode === "signin") {
                  const res = await authenticateAppUserFromBackend(
                    authEmail.trim(),
                    authPassword,
                  );
                  if (res.user) {
                    await syncMasterSsoSession({
                      email: res.user.email,
                      password: authPassword,
                      mode: "signin",
                      id: res.user.id,
                      fullName: res.user.fullName,
                      tenantId: res.user.tenantId,
                    });
                    void ensureDeveloperConnection({
                      id: res.user.id,
                      email: res.user.email,
                      fullName: res.user.fullName,
                      tenantId: res.user.tenantId,
                    });
                    completeAuthTransition(res.user);
                  } else {
                    setAuthError(res.error || "Invalid sign-in credentials.");
                  }
                } else {
                  if (!emailClean || authPassword.length < 6) {
                    setAuthError("Provide a valid email and a password of at least 6 characters.");
                    return;
                  }
                  const existing = await fetchAppUserByEmailFromBackend(emailClean);
                  if (existing) {
                    setAuthError("An account with this email already exists. Please sign in instead.");
                    return;
                  }
                  const newUser: AppUser = {
                    id: `USR-${Date.now().toString().slice(-4)}`,
                    email: emailClean,
                    password: authPassword,
                    fullName: socFullName.trim() || emailClean.split("@")[0] || "Operator",
                    admin: "no",
                    tenantId: `TENANT-SHIELD-${Date.now().toString().slice(-4)}`,
                  };
                  await persistAppUserToBackend(newUser);
                  await syncMasterSsoSession({
                    email: emailClean,
                    password: authPassword,
                    mode: "register",
                    id: newUser.id,
                    fullName: newUser.fullName,
                    tenantId: newUser.tenantId,
                  });
                  void ensureDeveloperConnection({
                    id: newUser.id,
                    email: emailClean,
                    fullName: newUser.fullName,
                    tenantId: newUser.tenantId,
                  });
                  requestGlobalEmailVerification({
                    email: newUser.email,
                    fullName: newUser.fullName,
                    serviceName: "SparrowX Shield SOC & WAF",
                  });
                  completeAuthTransition({ ...newUser, password: "" });
                }
              } catch {
                setAuthError("Auth gateway offline.");
              } finally {
                setAuthLoading(false);
              }
            }}
            className="px-6 pb-5 space-y-4"
          >
            {socAuthMode === "register" && (
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-medium text-[#F4F6FA]/75 block">Operator Name</label>
                <div className="relative">
                  <User className="size-4 text-[#F4F6FA]/40 pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={socFullName}
                    onChange={(e) => setSocFullName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full rounded-xl border border-[#F4F6FA]/[0.10] bg-[#06080E]/90 pl-10 pr-3.5 py-2.5 text-sm text-[#F4F6FA] placeholder-[#F4F6FA]/35 focus:outline-none focus:border-[#F9103A] transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-medium text-[#F4F6FA]/75 block">Operator Email</label>
              <div className="relative">
                <Mail className="size-4 text-[#F4F6FA]/40 pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="admin@yourdomain.com"
                  className="w-full rounded-xl border border-[#F4F6FA]/[0.10] bg-[#06080E]/90 pl-10 pr-3.5 py-2.5 text-sm text-[#F4F6FA] placeholder-[#F4F6FA]/35 focus:outline-none focus:border-[#F9103A] transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-medium text-[#F4F6FA]/75 block">Password</label>
              <div className="relative">
                <Lock className="size-4 text-[#F4F6FA]/40 pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showAuthPassword ? "text" : "password"}
                  required
                  minLength={socAuthMode === "register" ? 6 : undefined}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full rounded-xl border border-[#F4F6FA]/[0.10] bg-[#06080E]/90 pl-10 pr-10 py-2.5 text-sm text-[#F4F6FA] placeholder-[#F4F6FA]/35 focus:outline-none focus:border-[#F9103A] transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowAuthPassword((prev) => !prev)}
                  aria-label={showAuthPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#F4F6FA]/45 hover:text-[#F4F6FA] transition-colors cursor-pointer p-1"
                >
                  {showAuthPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full h-11 rounded-xl bg-[#F9103A] hover:bg-[#F9103A]/90 text-[#F4F6FA] font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer mt-1"
            >
              {authLoading ? <RefreshCw className="size-4 animate-spin" /> : <Shield className="size-4" />}
              <span>{socAuthMode === "signin" ? "Enter Client Area" : "Create Account & Enter Client Area"}</span>
              {!authLoading && <ArrowRight className="size-4" />}
            </button>
          </form>

          <div className="bg-[#06080E]/90 border-t border-[#F4F6FA]/[0.06] px-6 py-3.5 flex items-center justify-between text-xs text-[#F4F6FA]/55">
            <button
              type="button"
              onClick={() => {
                setSocAuthMode(socAuthMode === "signin" ? "register" : "signin");
                setAuthError("");
              }}
              className="hover:text-[#F4F6FA] transition-colors cursor-pointer"
            >
              {socAuthMode === "signin" ? "Need access? Register operator" : "Already registered? Sign in"}
            </button>
            <button
              type="button"
              onClick={() => setSocModalOpen(false)}
              className="hover:text-[#F4F6FA] font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
