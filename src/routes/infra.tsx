import { createFileRoute } from "@tanstack/react-router";
import { SparrowxInfraEngine } from "@/components/SparrowxInfraEngine";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/infra")({
  head: () => ({
    meta: [
      {
        title:
          "SparrowX Cloud Infra — Bare Metal, Dedicated Servers & KVM NVMe VPS (infra.sparrowx.net)",
      },
      {
        name: "description",
        content:
          "Rent high-clock AMD Ryzen & EPYC bare metal servers, game-ready dedicated servers, and instant NVMe KVM VPS across India, Singapore, and Europe with zero egress fees and always-on XDP DDoS protection.",
      },
      {
        property: "og:title",
        content: "SparrowX Cloud Infra — Bare Metal, Dedicated & KVM VPS",
      },
      {
        property: "og:description",
        content:
          "Single-tenant bare metal silicon, dedicated nodes, and instant NVMe KVM VPS on flat INR/USD pricing with unmetered fiber.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://infra.sparrowx.net" },
      { property: "og:image", content: "https://infra.sparrowx.net/3d/cloud-infra-server.jpg" },
    ],
    links: [
      { rel: "canonical", href: "https://infra.sparrowx.net" },
      { rel: "icon", href: "/sparrowx-logo.png", type: "image/png" },
    ],
  }),
  component: SparrowxInfraRoute,
});

function SparrowxInfraRoute() {
  return (
    <>
      <SparrowxInfraEngine />
      <BackgroundEngineToaster />
    </>
  );
}
