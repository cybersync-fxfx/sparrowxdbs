import { createFileRoute } from "@tanstack/react-router";
import { SparrowxShieldEngine } from "@/components/SparrowxShieldEngine";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/shield")({
  head: () => ({
    meta: [
      { title: "SparrowX Shield (Shadowshield) — Live Cyber Threat Map & Autonomous DDoS Defense" },
      {
        name: "description",
        content:
          "Protect your website and APIs from volumetric DDoS attacks, malicious bots, and prompt injection. Featuring real-time origin IP cloaking, live 2D tactical threat radar map, and 1-command server install.",
      },
      {
        name: "keywords",
        content:
          "sparrowx shield, shadowshield, live threat map, cyber threat radar, ddos protection, origin ip cloaking, web application firewall, waf, bot deflection, website security",
      },
      { property: "og:title", content: "SparrowX Shield (Shadowshield) — Live Threat Map & DDoS Defense" },
      {
        property: "og:description",
        content:
          "Autonomous edge defense with live tactical threat tracking, origin server cloaking, and sub-second packet deflection.",
      },
      { property: "og:url", content: "https://sec.sparrowx.net" },
    ],
    links: [
      { rel: "canonical", href: "https://sec.sparrowx.net" },
    ],
  }),
  component: SparrowxShieldRoute,
});

function SparrowxShieldRoute() {
  return (
    <>
      <SparrowxShieldEngine />
      <BackgroundEngineToaster />
    </>
  );
}
