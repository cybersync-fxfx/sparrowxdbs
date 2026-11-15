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

type Search = { service?: ServiceId | undefined; auth_error?: string | undefined };

export const Route = createFileRoute("/game/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    service: SERVICE_IDS.includes(s.service as ServiceId) ? (s.service as ServiceId) : undefined,
    auth_error: typeof s.auth_error === "string" ? s.auth_error.slice(0, 120) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "SparrowX Game Hosting — FiveM, SA-MP, Minecraft & Discord Bot Servers" },
      {
        name: "description",
        content:
          "High-performance NVMe Gen4 game server hosting in Asia-IN with 12–15ms ping, sub-second DDoS mitigation, instant Pterodactyl panel provisioning, and INR pricing from ₹49/mo.",
      },
      {
        name: "keywords",
        content:
          "fivem server hosting india, samp server hosting, minecraft server hosting india, discord bot hosting 24/7, low ping game hosting, pterodactyl game panel, nvme game server, ddos protected game hosting, sparrowx game",
      },
      { property: "og:title", content: "SparrowX Game Hosting — Premium Low-Ping Game Servers" },
      {
        property: "og:description",
        content:
          "Deploy FiveM, SA-MP, Minecraft, and Discord bot servers in seconds with dedicated NVMe Gen4 speed, sub-second DDoS filtering, and Pterodactyl panel.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://game.sparrowx.net" },
      { property: "og:image", content: "https://sparrowx.net/assets/logo-game-A5Nnak65.png" },
      { property: "og:image:alt", content: "SparrowX Game Hosting — High Performance Game Servers" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "SparrowX Game Hosting — FiveM, SA-MP, Minecraft & Discord Bots" },
      {
        name: "twitter:description",
        content:
          "Low-ping NVMe Gen4 game hosting in Asia-IN with instant Discord login and automated Pterodactyl setup.",
      },
      { name: "twitter:image", content: "https://sparrowx.net/assets/logo-game-A5Nnak65.png" },
      { name: "twitter:image:alt", content: "SparrowX Game Hosting — High Performance Game Servers" },
    ],
    links: [
      { rel: "canonical", href: "https://game.sparrowx.net" },
      { rel: "icon", href: "/logos/sparrowx-main.png", type: "image/png" },
      { rel: "shortcut icon", href: "/logos/sparrowx-main.png" },
      { rel: "apple-touch-icon", href: "/logos/sparrowx-main.png", sizes: "180x180" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SoftwareApplication",
              "name": "SparrowX Game Hosting",
              "applicationCategory": "GameServerHosting",
              "operatingSystem": "All",
              "url": "https://game.sparrowx.net",
              "description":
                "Enterprise NVMe Gen4 game server hosting for FiveM, SA-MP, Minecraft, and Discord bots with instant Pterodactyl deployment and sub-second DDoS defense.",
              "offers": {
                "@type": "Offer",
                "price": "49",
                "priceCurrency": "INR",
              },
            },
            {
              "@type": "FAQPage",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": "Which games and services are supported?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text":
                      "SparrowX Game Hosting provides specialized 1-click deployments for FiveM (GTA V Roleplay), SA-MP (San Andreas Multiplayer), Minecraft (Paper, Forge, Fabric, Bedrock), and 24/7 Discord bots.",
                  },
                },
                {
                  "@type": "Question",
                  "name": "What hardware and network latency can I expect?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text":
                      "All nodes run on Ryzen / Intel Xeon NVMe Gen4 SSD infrastructure located in Asia-IN data centers, delivering ultra-low 12–15ms latency across India and neighboring regions.",
                  },
                },
                {
                  "@type": "Question",
                  "name": "How does server control work?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text":
                      "Each server is instantly linked to your Pterodactyl Game Panel account at game.panel.sparrowx.net with 1-click auto-login, full file manager, console, restart controls, and database allocations.",
                  },
                },
              ],
            },
          ],
        }),
      },
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
