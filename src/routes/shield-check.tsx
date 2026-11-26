import { createFileRoute } from "@tanstack/react-router";
import { ShieldEdgeCheckingPage } from "@/components/shield/ShieldEdgeCheckingPage";

export const Route = createFileRoute("/shield-check")({
  head: () => ({
    meta: [
      { title: "Just a moment... — SparrowX Shield Security Check" },
      {
        name: "description",
        content:
          "SparrowX Shield is verifying your browser connection before routing you to the origin server.",
      },
    ],
    links: [
      { rel: "icon", href: "/logos/sparrowx-shield.png", type: "image/png" },
    ],
  }),
  component: ShieldCheckRoute,
});

function ShieldCheckRoute() {
  const params =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const domain = params.get("domain") || "sparrowx.net";
  const redirectUrl = params.get("redirect") || null;

  return <ShieldEdgeCheckingPage domain={domain} redirectUrl={redirectUrl} />;
}
