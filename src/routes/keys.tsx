import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SparrowxKeysEngine } from "@/components/SparrowxKeysEngine";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/keys")({
  head: () => ({
    meta: [
      { title: "SparrowX Keys — 100% Offline Cryptographic Password & Secret Generator" },
      {
        name: "description",
        content:
          "Generate military-grade passwords, Diceware passphrases, UUIDs, and developer secret keys 100% client-side with W3C WebCrypto CSPRNG. Zero network transmission, zero tracking.",
      },
      {
        name: "keywords",
        content:
          "offline password generator, client-side password tool, diceware passphrase generator, secure token generator, free password creator no login, developer secret generator, webcrypto password, high entropy passphrase, sparrowx keys",
      },
      { property: "og:title", content: "SparrowX Keys — 100% Offline Cryptographic Password Generator" },
      {
        property: "og:description",
        content:
          "High-entropy passwords and passphrases generated locally in your browser memory. Never sent to any server.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://password.sparrowx.net" },
      { property: "og:image", content: "https://sparrowx.net/logos/sparrowx-keys.jpg" },
      { property: "og:image:alt", content: "SparrowX Keys — Offline Cryptographic Password Generator" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "SparrowX Keys — Offline Password & Secret Generator" },
      {
        name: "twitter:description",
        content:
          "High-entropy passwords and passphrases generated locally in your browser memory. Zero network calls.",
      },
      { name: "twitter:image", content: "https://sparrowx.net/logos/sparrowx-keys.jpg" },
      { name: "twitter:image:alt", content: "SparrowX Keys — Offline Cryptographic Password Generator" },
    ],
    links: [
      { rel: "canonical", href: "https://password.sparrowx.net" },
      { rel: "icon", href: "/logos/sparrowx-keys.png", type: "image/png" },
      { rel: "shortcut icon", href: "/logos/sparrowx-keys.png" },
      { rel: "apple-touch-icon", href: "/logos/sparrowx-keys.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SoftwareApplication",
              "name": "SparrowX Keys",
              "applicationCategory": "SecurityApplication, CryptographyTool",
              "operatingSystem": "All",
              "url": "https://password.sparrowx.net",
              "description":
                "100% offline client-side password and secret generator powered by W3C WebCrypto API with zero server requests.",
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
                  "name": "Why is an offline password generator safer?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text":
                      "Online password generators transmit your keys across the internet, exposing them to server access logs and man-in-the-middle attacks. SparrowX Keys runs 100% in your browser memory without making any network calls.",
                  },
                },
                {
                  "@type": "Question",
                  "name": "What is a Diceware passphrase?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text":
                      "A Diceware passphrase combines cryptographically randomized words from EFF wordlists to create passphrases that are easy for humans to remember but computationally impossible for computers to brute-force.",
                  },
                },
                {
                  "@type": "Question",
                  "name": "Can I use SparrowX Keys offline without internet?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text":
                      "Yes. Once loaded, you can disconnect your internet or airplane mode and SparrowX Keys will continue generating hardware-grade random passwords and secrets.",
                  },
                },
              ],
            },
          ],
        }),
      },
    ],
  }),
  component: SparrowxKeysRoute,
});

function SparrowxKeysRoute() {
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (host === "sparrowx.net" || host === "www.sparrowx.net") {
      window.location.replace(`https://password.sparrowx.net${window.location.search}${window.location.hash}`);
    }
  }, []);

  return (
    <>
      <SparrowxKeysEngine />
      <BackgroundEngineToaster />
    </>
  );
}
