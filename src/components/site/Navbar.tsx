import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSessionSummary } from "@/lib/portal.functions";
import type { ServiceId } from "@/lib/services";
import { DiscordIcon } from "./DiscordIcon";
import { ServiceSwitcher } from "./ServiceSwitcher";

export const LOGIN_HREF = "/api/public/auth/discord/login";

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
  return useQuery({ queryKey: ["session-summary"], queryFn: () => getSessionSummary(), staleTime: 60_000 });
}

export function Navbar({ service, onService }: { service: ServiceId; onService: (s: ServiceId) => void }) {
  const { data: me } = useSessionSummary();
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto mt-3 flex max-w-7xl items-center justify-between gap-3 rounded-2xl px-3 py-2.5 glass sm:px-5">
        <Link to="/game" search={{ service: undefined }} aria-label="SparrowX home">
          <Brand />
        </Link>
        <div className="hidden md:block">
          <ServiceSwitcher value={service} onChange={onService} layoutId="nav-pill" />
        </div>
        {me ? (
          <Button asChild variant="discord" size="sm" className="rounded-xl">
            <Link to="/game/dashboard" search={{ deploy: undefined }}>
              <img src={me.avatarUrl} alt={`${me.username} player avatar`} width={20} height={20} className="size-5 rounded-full" />
              <span className="hidden sm:inline">Dashboard</span>
              <LayoutDashboard className="sm:hidden" />
            </Link>
          </Button>
        ) : (
          <Button asChild variant="discord" size="sm" className="rounded-xl">
            <a href={LOGIN_HREF}>
              <DiscordIcon className="size-4" />
              <span className="hidden sm:inline">Login with Discord</span>
              <span className="sm:hidden">Login</span>
            </a>
          </Button>
        )}
      </div>
      <div className="mt-2 flex justify-center md:hidden">
        <ServiceSwitcher value={service} onChange={onService} layoutId="nav-pill-mobile" />
      </div>
    </header>
  );
}
