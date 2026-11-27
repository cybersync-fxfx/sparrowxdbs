import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, lazy, useEffect } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "@/components/site/Navbar";
import { Hero } from "@/components/site/Hero";
import { GameHostingShowcase } from "@/components/site/GameHostingShowcase";
import { GameSpatialExperience } from "@/components/site/GameSpatialExperience";
import { PlatformFeatures } from "@/components/site/PlatformFeatures";
import { SmoothScroll } from "@/components/shared/SmoothScroll";
import { SparrowxCoinsMarketingBanner } from "@/components/SparrowxCoinVisuals";
import { Footer } from "@/components/site/Footer";
import { SERVICE_IDS, SERVICES, type ServiceId } from "@/lib/services";
import { buildRouteHeadFromProfile, SEO_PROFILES } from "@/lib/seo-profiles";

const Performance = lazy(() =>
  import("@/components/site/Performance").then((m) => ({ default: m.Performance })),
);

const GAME_FONT_LINK = {
  rel: "stylesheet",
  href: "https://fonts.googleapis.com/css2?family=Unbounded:wght@500;600;700;800&family=Manrope:wght@400;500;600;700&display=swap",
};

type Search = { service?: ServiceId | undefined; auth_error?: string | undefined };

export const Route = createFileRoute("/game/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    service: SERVICE_IDS.includes(s.service as ServiceId) ? (s.service as ServiceId) : undefined,
    auth_error: typeof s.auth_error === "string" ? s.auth_error.slice(0, 120) : undefined,
  }),
  head: () => {
    const base = buildRouteHeadFromProfile(SEO_PROFILES.game);
    return {
      ...base,
      links: [...(base.links ?? []), GAME_FONT_LINK],
    };
  },
  component: GameIndex,
});

function GameIndex() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/game/" });
  const service = SERVICES[search.service ?? "minecraft"];
  const setService = (id: ServiceId) =>
    navigate({ search: (prev) => ({ ...prev, service: id }), replace: true, resetScroll: false });

  useEffect(() => {
    if (search.auth_error) {
      toast.error(search.auth_error);
      navigate({
        search: (prev) => {
          const next = { ...prev };
          delete next.auth_error;
          return next;
        },
        replace: true,
        resetScroll: false,
      });
    }
  }, [search.auth_error, navigate]);

  return (
    <SmoothScroll>
      <div data-service={service.id} className="theme-game min-h-screen bg-[#030407] text-foreground">
        <Navbar service={service.id} onService={setService} />
        <main>
          <Hero service={service} onService={setService} />
          <GameSpatialExperience />
          <GameHostingShowcase />
          <div className="mx-auto max-w-7xl px-5 py-12">
            <SparrowxCoinsMarketingBanner
              variant="hero"
              ctaLabel="Top Up & Deploy with SparrowX Coins"
              ctaHref="/game/dashboard"
            />
          </div>
          <PlatformFeatures />
          <div className="spx-defer-section border-t border-white/[0.06]">
            <Suspense fallback={<div id="performance" className="mx-auto max-w-7xl px-5 py-24 min-h-[540px]" />}>
              <Performance service={service} />
            </Suspense>
          </div>
        </main>
        <Footer />
        <Toaster theme="dark" position="bottom-right" />
      </div>
    </SmoothScroll>
  );
}
