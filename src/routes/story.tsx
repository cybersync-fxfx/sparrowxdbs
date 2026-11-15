import { createFileRoute } from "@tanstack/react-router";
import { SparrowxStoryPage } from "@/components/SparrowxStoryPage";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/story")({
  head: () => ({
    meta: [
      { title: "Our Story & Mission — Why We Built SparrowX Sovereign Cloud" },
      {
        name: "description",
        content:
          "Discover why independent builders founded SparrowX: honest DDoS defense, zero-login encrypted file sharing, offline password generation, and low-cost NVMe PostgreSQL databases with zero bandwidth egress taxes.",
      },
      {
        name: "keywords",
        content:
          "sparrowx story, indie cloud infrastructure, low cost postgresql hosting, zero login file sharing, honest ddos protection, no egress fee cloud, sovereign developer tools, transparent cloud pricing",
      },
      { property: "og:title", content: "Our Story & Mission — Why We Built SparrowX" },
      {
        property: "og:description",
        content:
          "Why we built an independent cloud without surprise bandwidth taxes, enterprise security ransoms, or forced sign-ups.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://sparrowx.net/story" },
      { property: "og:image", content: "https://sparrowx.net/logos/sparrowx-network.jpg" },
      { property: "og:image:alt", content: "SparrowX Sovereign Cloud Mission & Story" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Why We Built SparrowX Sovereign Cloud" },
      {
        name: "twitter:description",
        content:
          "An independent cloud for builders without surprise bandwidth taxes, enterprise security ransoms, or forced sign-ups.",
      },
      { name: "twitter:image", content: "https://sparrowx.net/logos/sparrowx-network.jpg" },
      { name: "twitter:image:alt", content: "SparrowX Sovereign Cloud Mission & Story" },
    ],
    links: [
      { rel: "canonical", href: "https://sparrowx.net/story" },
      { rel: "icon", href: "/logos/sparrowx-network.jpg", type: "image/jpeg" },
      { rel: "shortcut icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          "name": "About SparrowX and Our Mission",
          "url": "https://sparrowx.net/story",
          "description":
            "The mission and core principles behind SparrowX: independent, transparent, and sovereign developer infrastructure with zero egress traps.",
          "publisher": {
            "@type": "Organization",
            "name": "SparrowX Technologies",
            "url": "https://sparrowx.net",
            "logo": "https://sparrowx.net/logos/sparrowx-main.jpg",
          },
        }),
      },
    ],
  }),
  component: SparrowxStoryRoute,
});

function SparrowxStoryRoute() {
  return (
    <>
      <SparrowxStoryPage />
      <BackgroundEngineToaster />
    </>
  );
}
