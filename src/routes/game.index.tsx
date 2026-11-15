import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "@/components/site/Navbar";
import { Hero } from "@/components/site/Hero";
import { Performance } from "@/components/site/Performance";
import { Pricing } from "@/components/site/Pricing";
import { Footer } from "@/components/site/Footer";
import { SERVICE_IDS, SERVICES, type ServiceId } from "@/lib/services";

type Search = { service?: ServiceId; auth_error?: string };

export const Route = createFileRoute("/game/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    service: SERVICE_IDS.includes(s.service as ServiceId) ? (s.service as ServiceId) : undefined,
    auth_error: typeof s.auth_error === "string" ? s.auth_error.slice(0, 120) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "SparrowX Game Hosting — FiveM, SA-MP, Minecraft & Discord Bot Servers in India" },
      {
        name: "description",
        content: "NVMe Gen4 game servers in Asia-IN with 12–15ms ping, sub-second DDoS mitigation and INR pricing from ₹49/mo.",
      },
      { property: "og:title", content: "SparrowX Game Hosting — Premium Game Servers in India" },
      {
        property: "og:description",
        content: "FiveM, SA-MP, Minecraft and Discord bot hosting on NVMe Gen4 nodes. Login with Discord and deploy in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameIndex,
});

function GameIndex() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/game/" });
  const service = SERVICES[search.service ?? "fivem"];
  const setService = (id: ServiceId) =>
    navigate({ search: (prev) => ({ ...prev, service: id }), replace: true, resetScroll: false });

  useEffect(() => {
    if (search.auth_error) {
      toast.error(search.auth_error);
      navigate({ search: (prev) => ({ ...prev, auth_error: undefined }), replace: true, resetScroll: false });
    }
  }, [search.auth_error, navigate]);

  return (
    <div data-service={service.id} className="theme-game min-h-screen bg-background text-foreground">
      <Navbar service={service.id} onService={setService} />
      <main>
        <Hero service={service} onService={setService} />
        <Performance service={service} />
        <Pricing service={service} />
      </main>
      <Footer />
      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}
