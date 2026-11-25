import React, { useEffect, useState } from "react";
import { requestGlobalEmailVerification } from "@/components/EmailVerificationModal";
import { OAuthSignInButtons } from "@/components/GoogleSignInButton";
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
  fetchMasterSsoUser,
  syncMasterSsoSession,
} from "@/lib/developer-connection";
import { ShieldLandingView } from "./shield/ShieldLandingView";
import { ShieldClientAreaView } from "./shield/ShieldClientAreaView";
import { ShieldSocDashboardView } from "./shield/ShieldSocDashboardView";
import { ShieldWafOnboardingView } from "./shield/ShieldWafOnboardingView";

export interface SparrowxShieldEngineProps {
  currentUser?: AppUser | null;
  onUserAuthenticated?: (user: AppUser) => void;
  onOpenClientArea?: () => void;
  onSignOut?: () => void;
  initialStage?: ShieldStage;
}

export type ShieldStage = "landing" | "client-area" | "onboarding" | "dashboard";

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
  onOpenClientArea,
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
  const [bypassedWafOnboarding, setBypassedWafOnboarding] = useState(false);

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
      return undefined;
    }
    const next = readInitialShieldUser(null);
    if (next) {
      setSessionUser(next);
      setViewStage((prev) => (prev === "landing" ? "client-area" : prev));
      return undefined;
    }
    let active = true;
    void fetchMasterSsoUser().then((ssoUser) => {
      if (!active) return;
      if (ssoUser) {
        issueSignedSessionToken({
          id: ssoUser.id,
          email: ssoUser.email,
          fullName: ssoUser.fullName,
          role: ssoUser.role,
          tenantId: ssoUser.tenantId,
        });
        const hydrated: AppUser = {
          id: ssoUser.id,
          email: ssoUser.email,
          fullName: ssoUser.fullName,
          password: "",
          admin: ssoUser.role === "admin" ? "yes" : "no",
          tenantId: ssoUser.tenantId,
        };
        try {
          localStorage.setItem("sparrowx_auth_user", JSON.stringify(hydrated));
        } catch {
          // ignore
        }
        setSessionUser(hydrated);
        setViewStage((prev) => (prev === "landing" ? "client-area" : prev));
        if (onUserAuthenticated) onUserAuthenticated(hydrated);
      } else {
        setViewStage("landing");
      }
    });
    return () => {
      active = false;
    };
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

  const openWorkbenchOrOnboarding = () => {
    const hasConnectedDomain = tenants.length > 0 || assets.length > 0;
    if (!hasConnectedDomain && !bypassedWafOnboarding) {
      setViewStage("onboarding");
      return;
    }
    setViewStage("dashboard");
  };

  const handleEnterDashboard = () => {
    if (!activeUser) {
      openAuthModal("signin");
      return;
    }
    openWorkbenchOrOnboarding();
  };

  const shouldShowWafOnboarding =
    Boolean(activeUser) &&
    (viewStage === "onboarding" ||
      (viewStage === "dashboard" &&
        tenants.length === 0 &&
        assets.length === 0 &&
        !bypassedWafOnboarding));

  return (
    <>
      {shouldShowWafOnboarding && activeUser ? (
        <ShieldWafOnboardingView
          activeUser={activeUser}
          onDomainConnected={({ tenant, service, asset }) => {
            setTenants((prev) => [tenant, ...prev]);
            setServices((prev) => [service, ...prev]);
            setAssets((prev) => [asset, ...prev]);
          }}
          onLaunchWorkbench={() => {
            setBypassedWafOnboarding(true);
            setViewStage("dashboard");
          }}
          onBackToClientArea={() => {
            if (onOpenClientArea) {
              onOpenClientArea();
            } else {
              setViewStage("client-area");
            }
          }}
          onSignOut={handleShieldSignOut}
        />
      ) : viewStage === "dashboard" && activeUser ? (
        <ShieldSocDashboardView
          activeUser={activeUser}
          tenants={tenants}
          incidents={incidents}
          assets={assets}
          onIncidentsUpdated={setIncidents}
          onResolveIncident={handleResolveIncident}
          onToggleAssetIsolation={handleToggleAssetIsolation}
          onConnectDomain={() => setViewStage("onboarding")}
          onBackToClientArea={() => {
            if (onOpenClientArea) {
              onOpenClientArea();
            } else {
              setViewStage("client-area");
            }
          }}
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
          onOpenDashboard={openWorkbenchOrOnboarding}
          onBackToLanding={() => {
            if (onOpenClientArea) {
              onOpenClientArea();
            } else {
              setViewStage("landing");
            }
          }}
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
                Sign In to Shield Client Area
              </DialogTitle>
              <DialogDescription className="text-[13px] text-[#CBD5E1] leading-relaxed">
                Continue with Google or GitHub to access your Client Area, manage domain keys, and launch the Security + SOC Dashboard.
              </DialogDescription>
            </div>
          </DialogHeader>

          {selectedPlanForAuth && (
            <div className="mx-6 mb-3 flex items-center justify-between rounded-xl border border-[#F9103A]/35 bg-[#F9103A]/10 px-3.5 py-2 text-xs">
              <span className="text-[#F4F6FA]/85">Selected Plan</span>
              <span className="font-mono font-semibold text-[#FFEBB9]">{selectedPlanForAuth}</span>
            </div>
          )}

          {authError && (
            <div className="mx-6 mb-4 rounded-xl bg-[#F9103A]/10 border border-[#F9103A]/30 px-3.5 py-2.5 text-[#FFEBB9] text-xs flex items-start gap-2.5">
              <AlertTriangle className="size-4 shrink-0 text-[#F9103A] mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <div className="px-6 pb-6 space-y-4">
            <OAuthSignInButtons nextPath="/shield" />
            <p className="text-[11px] text-center text-[#94A3B8] leading-relaxed">
              Passwordless Google &amp; GitHub OAuth SSO — your operator workspace provisions automatically.
            </p>
          </div>

          <div className="bg-[#06080E]/90 border-t border-[#F4F6FA]/[0.08] px-6 py-3.5 flex items-center justify-between text-xs text-[#94A3B8]">
            <span className="inline-flex items-center gap-2 text-[#CBD5E1]">
              <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
              Google &amp; GitHub SSO Only
            </span>
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
