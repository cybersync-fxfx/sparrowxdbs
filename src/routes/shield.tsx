import { createFileRoute } from "@tanstack/react-router";
import { SparrowxShieldEngine } from "@/components/SparrowxShieldEngine";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/shield")({
  head: () => ({
    meta: [
      { title: "SparrowX Shield — Edge WAF, Live Threat Radar & Autonomous DDoS Defense" },
      {
        name: "description",
        content:
          "Real-time edge web application firewall with origin cloaking, sub-millisecond layer-7 DDoS deflection, AI prompt injection defense, and tactical live attack visualizer.",
      },
      {
        name: "keywords",
        content:
          "sparrowx shield, edge waf, website ddos protection, live threat map, origin ip cloaking, bot protection, web application firewall, layer 7 ddos mitigation, ai prompt firewall, security middleware",
      },
      { property: "og:title", content: "SparrowX Shield — Edge WAF & Autonomous DDoS Interception" },
      {
        property: "og:description",
        content:
          "Autonomous edge security with live tactical threat tracking, origin server cloaking, and sub-second packet deflection.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://sec.sparrowx.net" },
      { property: "og:image", content: "https://sparrowx.net/logos/sparrowx-shield.jpg" },
      { property: "og:image:alt", content: "SparrowX Shield — Edge WAF and DDoS Threat Interception" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "SparrowX Shield — Edge WAF & DDoS Defense" },
      {
        name: "twitter:description",
        content:
          "Autonomous edge security with live tactical threat tracking, origin server cloaking, and sub-second packet deflection.",
      },
      { name: "twitter:image", content: "https://sparrowx.net/logos/sparrowx-shield.jpg" },
      { name: "twitter:image:alt", content: "SparrowX Shield — Edge WAF and DDoS Threat Interception" },
    ],
    links: [
      { rel: "canonical", href: "https://sec.sparrowx.net" },
      { rel: "icon", href: "/logos/sparrowx-shield.jpg", type: "image/jpeg" },
      { rel: "shortcut icon", href: "/logos/sparrowx-shield.jpg" },
      { rel: "apple-touch-icon", href: "/logos/sparrowx-shield.jpg" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SoftwareApplication",
              "name": "SparrowX Shield",
              "applicationCategory": "SecurityApplication",
              "operatingSystem": "All",
              "url": "https://sec.sparrowx.net",
              "description":
                "Edge WAF, Layer-7 DDoS deflection, live threat radar, origin cloaking, and AI prompt injection guardrails.",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD",
              },
            },
            {
              "@type": "FAQPage",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": "How does SparrowX Shield stop DDoS attacks?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text":
                      "SparrowX Shield intercepts incoming HTTP/HTTPS traffic at the global edge network, stripping malicious bot signatures, challenge-verifying suspicious clients, and dropping flood packets before they reach your origin server.",
                  },
                },
                {
                  "@type": "Question",
                  "name": "Does SparrowX Shield protect AI APIs and LLM apps?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text":
                      "Yes, SparrowX Shield includes an inline AI tool execution firewall that detects adversarial prompt injections, jailbreak attempts, and sensitive PII exfiltration in real time.",
                  },
                },
                {
                  "@type": "Question",
                  "name": "How is SparrowX Shield installed?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text":
                      "You can integrate SparrowX Shield via a lightweight script tag for frontend assets, an Nginx reverse proxy connector on your VPS, or directly in Express, Node.js, and Python middleware.",
                  },
                },
              ],
            },
          ],
        }),
      },
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
