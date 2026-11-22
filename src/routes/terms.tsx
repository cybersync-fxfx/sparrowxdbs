import { createFileRoute } from "@tanstack/react-router";
import { SparrowxLegalCenter } from "@/components/SparrowxLegalCenter";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — SparrowX Autonomous Security & Sovereign Cloud" },
      {
        name: "description",
        content:
          "SparrowX Technologies Master Services Agreement, Acceptable Use Policy, and Terms of Service across Cloud VPS, Sovereign Database, Shield WAF, and Vault services.",
      },
      { property: "og:title", content: "Terms of Service — SparrowX Technologies" },
      {
        property: "og:description",
        content: "Transparent legal terms, SLA commitments, and acceptable use guidelines for developers and enterprises.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://sparrowx.net/terms" },
    ],
    links: [
      { rel: "canonical", href: "https://sparrowx.net/terms" },
      { rel: "icon", href: "/sparrowx-logo.png", type: "image/png" },
    ],
  }),
  component: TermsRoute,
});

function TermsRoute() {
  return (
    <>
      <SparrowxLegalCenter initialTab="terms" />
      <BackgroundEngineToaster />
    </>
  );
}
