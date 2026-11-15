import { createFileRoute } from "@tanstack/react-router";
import { SparrowxDropEngine } from "@/components/SparrowxDropEngine";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/drop")({
  head: () => ({
    meta: [
      { title: "SparrowX Drop — Encrypted File Transfer & Private Cloud Vault (Zero Login)" },
      {
        name: "description",
        content:
          "Transfer files securely with end-to-end browser encryption. Zero sign-up required, zero tracking cookies, instant shareable download links, and 10 GB free private cloud vault.",
      },
      {
        name: "keywords",
        content:
          "private file transfer, encrypted file sharing, free file share no login, ephemeral file drop, secure send, anonymous file share, 10gb free vault, large file transfer free, end to end encrypted files, sparrowx drop",
      },
      { property: "og:title", content: "SparrowX Drop — Encrypted File Transfer & 10GB Free Vault" },
      {
        property: "og:description",
        content:
          "Share files privately with zero accounts required. Drag, drop, and send with client-side encryption and instant links.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://file.sparrowx.net" },
      { property: "og:image", content: "https://sparrowx.net/logos/sparrowx-drop.jpg" },
      { property: "og:image:alt", content: "SparrowX Drop — Encrypted File Transfer & Cloud Vault" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "SparrowX Drop — Private File Transfer (No Login)" },
      {
        name: "twitter:description",
        content:
          "Share files privately with zero accounts required. Client-side encrypted transfer with instant link generation.",
      },
      { name: "twitter:image", content: "https://sparrowx.net/logos/sparrowx-drop.jpg" },
      { name: "twitter:image:alt", content: "SparrowX Drop — Encrypted File Transfer & Cloud Vault" },
    ],
    links: [
      { rel: "canonical", href: "https://file.sparrowx.net" },
      { rel: "icon", href: "/logos/sparrowx-drop.png", type: "image/png" },
      { rel: "shortcut icon", href: "/logos/sparrowx-drop.png" },
      { rel: "apple-touch-icon", href: "/logos/sparrowx-drop.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SoftwareApplication",
              "name": "SparrowX Drop",
              "applicationCategory": "FileTransfer, CloudStorage",
              "operatingSystem": "All",
              "url": "https://file.sparrowx.net",
              "description":
                "End-to-end encrypted file transfer with ephemeral share links and 10 GB free persistent vault storage with zero sign-up required.",
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
                  "name": "How does SparrowX Drop zero-knowledge encryption work?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text":
                      "All file payloads are encrypted directly in your browser using W3C Web Cryptography AES-GCM-256 before upload. SparrowX servers cannot decrypt or read your files.",
                  },
                },
                {
                  "@type": "Question",
                  "name": "Do I need to create an account to send files?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text":
                      "No account or personal information is required. You can drag and drop files up to 2.5 GB in Ephemeral Mode instantly with customizable download limits and auto-expiration.",
                  },
                },
                {
                  "@type": "Question",
                  "name": "How much storage is included in Vault Mode?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text":
                      "Vault Mode includes 10 GB free encrypted storage, with optional upgrades to Pro Vault (500 GB for $2.99/mo) and Pro Max (1 TB for $5.99/mo).",
                  },
                },
              ],
            },
          ],
        }),
      },
    ],
  }),
  component: SparrowxDropRoute,
});

function SparrowxDropRoute() {
  return (
    <>
      <SparrowxDropEngine />
      <BackgroundEngineToaster />
    </>
  );
}
