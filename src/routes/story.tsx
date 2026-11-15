import { createFileRoute } from "@tanstack/react-router";
import { SparrowxStoryPage } from "@/components/SparrowxStoryPage";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/story")({
  head: () => ({
    meta: [
      { title: "Our Story & Mission — Why We Built SparrowX" },
      {
        name: "description",
        content:
          "Read why independent builders started SparrowX: honest DDoS security, zero-login encrypted file sharing, offline password generation, and low-cost NVMe PostgreSQL databases with zero egress fees.",
      },
      {
        name: "keywords",
        content:
          "sparrowx story, indie cloud infrastructure, low cost postgresql hosting, zero login file sharing, honest ddos protection, no egress fee cloud",
      },
      { property: "og:title", content: "Our Story & Mission — Why We Built SparrowX" },
      {
        property: "og:description",
        content:
          "Why we built an independent cloud without surprise bandwidth taxes, enterprise security ransoms, or forced sign-ups.",
      },
      { property: "og:url", content: "https://sparrowx.net/story" },
    ],
    links: [
      { rel: "canonical", href: "https://sparrowx.net/story" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "shortcut icon", href: "/favicon.ico" },
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
