import { createFileRoute } from "@tanstack/react-router";
import { SparrowxLegalCenter } from "@/components/SparrowxLegalCenter";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Strict Refund & Cancellation Policy — SparrowX Cloud Infrastructure" },
      {
        name: "description",
        content:
          "Official Refund & Cancellation Policy for SparrowX Technologies. Strict no-refund policy once Cloud VPS, Dedicated VDS, or database nodes are deployed to customer accounts.",
      },
      { property: "og:title", content: "Refund & Cancellation Policy — SparrowX Technologies" },
      {
        property: "og:description",
        content: "Once infrastructure is provisioned or deployed to your account, services are strictly non-refundable due to reserved hardware and carrier IP allocation.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://sparrowx.net/refund" },
    ],
    links: [
      { rel: "canonical", href: "https://sparrowx.net/refund" },
      { rel: "icon", href: "/sparrowx-logo.png", type: "image/png" },
    ],
  }),
  component: RefundRoute,
});

function RefundRoute() {
  return (
    <>
      <SparrowxLegalCenter initialTab="refund" />
      <BackgroundEngineToaster />
    </>
  );
}
