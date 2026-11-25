import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSessionSummary } from "@/lib/portal.functions";
import { verifySessionToken } from "@/lib/advanced-features";
import { fetchMasterSsoUser } from "@/lib/developer-connection";
import {
  buildGoogleLoginHref,
  buildGithubLoginHref,
  GitHubBrandIcon,
} from "@/components/GoogleSignInButton";
import { buildMasterHref, buildProductHref } from "@/lib/routing";
import type { ServiceId } from "@/lib/services";
import { ServiceSwitcher } from "./ServiceSwitcher";

export const LOGIN_HREF = "/api/auth/google/login?next=%2Fgame%2Fdashboard";

export function GoogleGIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z" />
      <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z" />
      <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

export function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <img src="/sparrowx-logo.png" alt="SparrowX logo" width={36} height={36} className="size-9 object-contain shrink-0 drop-shadow-[0_4px_12px_rgba(255,255,255,0.22)]" />
      <span className="leading-none">
        <span className="block font-display text-sm font-bold tracking-[0.18em]">SPARROWX</span>
        <span className="block text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Game Infrastructure
        </span>
      </span>
    </span>
  );
}

export function useSessionSummary() {
  return useQuery({
    queryKey: ["session-summary"],
    queryFn: async () => {
      const serverSummary = await getSessionSummary().catch(() => null);
      if (serverSummary) return serverSummary;
      const localToken = verifySessionToken();
      if (localToken?.email) {
        return {
          id: localToken.sub,
          email: localToken.email,
          username: localToken.fullName || localToken.email.split("@")[0] || "Player",
          avatarUrl: null as string | null,
        };
      }
      const sso = await fetchMasterSsoUser().catch(() => null);
      if (sso?.email) {
        return {
          id: sso.id,
          email: sso.email,
          username: sso.fullName || sso.email.split("@")[0] || "Player",
          avatarUrl: null as string | null,
        };
      }
      return null;
    },
    staleTime: 60_000,
  });
}

export function Navbar({ service, onService }: { service: ServiceId; onService: (s: ServiceId) => void }) {
  const { data: me } = useSessionSummary();
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto mt-3 flex max-w-7xl items-center justify-between gap-3 rounded-2xl px-3 py-2.5 glass sm:px-5">
        <Link to="/game" search={{}} aria-label="SparrowX home">
          <Brand />
        </Link>
        <div className="hidden md:block">
          <ServiceSwitcher value={service} onChange={onService} layoutId="nav-pill" />
        </div>
        <div className="flex items-center gap-2">
          <a
            href={buildMasterHref("/docs/game")}
            className="hidden lg:inline-flex items-center rounded-xl border border-border/70 bg-background/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Docs
          </a>
          <a
            href={buildProductHref("shield")}
            className="hidden lg:inline-flex items-center rounded-xl border border-border/70 bg-background/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            DDoS Defense
          </a>
          <a
            href={buildMasterHref("/")}
            className="hidden xl:inline-flex items-center rounded-xl border border-border/70 bg-background/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            SparrowX Cloud
          </a>
          {me ? (
            <Button asChild variant="ivory" size="sm" className="rounded-xl">
              <Link to="/game/dashboard" search={{}}>
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
                  {me.username.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden sm:inline">Client Area</span>
                <LayoutDashboard className="sm:hidden" />
              </Link>
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button asChild variant="ivory" size="sm" className="rounded-xl">
                <a href={buildGoogleLoginHref("/game/dashboard")}>
                  <GoogleGIcon className="size-4" />
                  <span className="hidden sm:inline">Google</span>
                  <span className="sm:hidden">Sign In</span>
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex rounded-xl border-white/15 bg-[#161B22] text-white hover:bg-[#1F2630]"
              >
                <a href={buildGithubLoginHref("/game/dashboard")}>
                  <GitHubBrandIcon className="size-4" />
                  <span>GitHub</span>
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 flex justify-center md:hidden">
        <ServiceSwitcher value={service} onChange={onService} layoutId="nav-pill-mobile" />
      </div>
    </header>
  );
}
