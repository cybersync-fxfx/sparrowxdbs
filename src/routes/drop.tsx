import { createFileRoute } from "@tanstack/react-router";
import { SparrowxDropEngine } from "@/components/SparrowxDropEngine";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/drop")({
  head: () => ({
    meta: [
      { title: "SparrowX Files — Instant Private File Transfer (Free, No Login)" },
      {
        name: "description",
        content:
          "Send files securely with end-to-end encryption. 100% free with zero sign-up required, zero tracking cookies, and instant shareable download links.",
      },
      {
        name: "keywords",
        content:
          "private file transfer, encrypted file sharing, free file share no login, ephemeral file drop, secure send, anonymous file share",
      },
      { property: "og:title", content: "SparrowX Files — Instant Private File Transfer" },
      {
        property: "og:description",
        content:
          "Share files privately with zero accounts required. Drag, drop, and send with instant link generation.",
      },
      { property: "og:url", content: "https://file.sparrowx.net" },
    ],
    links: [
      { rel: "canonical", href: "https://file.sparrowx.net" },
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
