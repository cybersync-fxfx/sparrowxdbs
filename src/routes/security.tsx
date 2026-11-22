import { createFileRoute } from "@tanstack/react-router";
import { SparrowxLegalCenter } from "@/components/SparrowxLegalCenter";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Enterprise Data Security & Sovereignty Guarantee — SparrowX" },
      {
        name: "description",
        content:
          "SparrowX Data Security Guarantee: Zero-Knowledge encryption, zero 3rd-party data selling, hypervisor-level KVM isolation, and automated self-healing disaster recovery.",
      },
      { property: "og:title", content: "Data Security Guarantee — SparrowX Technologies" },
      {
        property: "og:description",
        content: "Your data is completely sovereign, encrypted, and isolated. Learn about our zero-knowledge and hardware protection standards.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://sparrowx.net/security" },
    ],
    links: [
      { rel: "canonical", href: "https://sparrowx.net/security" },
      { rel: "icon", href: "/sparrowx-logo.png", type: "image/png" },
    ],
  }),
  component: SecurityRoute,
});

function SecurityRoute() {
  return (
    <>
      <SparrowxLegalCenter initialTab="security" />
      <BackgroundEngineToaster />
    </>
  );
}
