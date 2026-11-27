import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSessionSummary } from "@/lib/portal.functions";
import { verifySessionToken } from "@/lib/advanced-features";
import { fetchMasterSsoUser } from "@/lib/developer-connection";
import { buildMasterHref, buildProductHref } from "@/lib/routing";
import type { ServiceId } from "@/lib/services";

export const LOGIN_HREF = "/login?next=%2Fgame%2Fdashboard";

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
      <img
        src="/sparrowx-logo.png"
        alt="SparrowX logo"
        width={34}
        height={34}
        className="size-8.5 object-contain shrink-0"
      />
      <span className="leading-tight">
        <span className="block font-display text-sm font-bold tracking-[0.16em] text-white">
          SPARROWX
        </span>
        <span className="block text-[11px] font-medium text-slate-400">
          Game Hosting
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

export function Navbar({
  service: _service,
  onService: _onService,
}: {
  service?: ServiceId;
  onService?: (s: ServiceId) => void;
}) {
  const { data: me } = useSessionSummary();
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#05060a]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
        <Link to="/game" search={{}} aria-label="SparrowX Game Hosting home">
          <Brand />
        </Link>

        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <a href="#catalog" className="hover:text-white transition-colors">
            Games &amp; Apps
          </a>
          <a href="#features" className="hover:text-white transition-colors">
            Features
          </a>
          <a href="#performance" className="hover:text-white transition-colors">
            Benchmarks
          </a>
          <a href={buildProductHref("shield")} className="hover:text-white transition-colors">
            DDoS Shield
          </a>
          <a href={buildMasterHref("/")} className="hover:text-white transition-colors">
            SparrowX Cloud
          </a>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {me ? (
            <Button asChild variant="ivory" size="sm" className="h-9 rounded-xl px-4 text-sm font-semibold">
              <Link to="/game/dashboard" search={{}}>
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">
                  {me.username.slice(0, 1).toUpperCase()}
                </span>
                <span>Client Area</span>
                <LayoutDashboard className="size-3.5 sm:hidden" aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ivory" size="sm" className="h-9 rounded-xl px-4 text-sm font-semibold">
              <a href={LOGIN_HREF}>
                <LogIn className="size-4" aria-hidden="true" />
                <span>Sign In</span>
              </a>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
