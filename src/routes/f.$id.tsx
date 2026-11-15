import { createFileRoute } from "@tanstack/react-router";
import { SparrowxDropEngine } from "@/components/SparrowxDropEngine";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/f/$id")({
  head: () => ({
    meta: [
      { title: "SparrowX Files — Secure Private File Download" },
      {
        name: "description",
        content:
          "Download file shared via SparrowX Files. Private, encrypted, and direct high-speed transfer with zero tracking.",
      },
      { property: "og:title", content: "SparrowX Files — Secure Private File Download" },
      {
        property: "og:description",
        content:
          "Download your shared file privately on SparrowX Files. 100% encrypted transfer.",
      },
    ],
    links: [
      { rel: "icon", href: "/logos/sparrowx-drop.jpg", type: "image/jpeg" },
      { rel: "shortcut icon", href: "/logos/sparrowx-drop.jpg" },
      { rel: "apple-touch-icon", href: "/logos/sparrowx-drop.jpg" },
    ],
  }),
  component: SparrowxFileDownloadRoute,
});

function SparrowxFileDownloadRoute() {
  return (
    <>
      <SparrowxDropEngine />
      <BackgroundEngineToaster />
    </>
  );
}
