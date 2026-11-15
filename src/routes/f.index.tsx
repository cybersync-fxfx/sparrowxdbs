import { createFileRoute } from "@tanstack/react-router";
import { SparrowxDropEngine } from "@/components/SparrowxDropEngine";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/f/")({
  head: () => ({
    meta: [
      { title: "SparrowX Files — Instant Private File Transfer (Free, No Login)" },
      {
        name: "description",
        content:
          "Private, encrypted file transfer with zero sign-up required. Share documents and media instantly with no account.",
      },
      { property: "og:title", content: "SparrowX Files — Instant Private File Transfer" },
      {
        property: "og:description",
        content:
          "Free private file sharing without sign-up. 100% encrypted transfer.",
      },
    ],
    links: [
      { rel: "canonical", href: "https://file.sparrowx.net" },
      { rel: "icon", href: "/logos/sparrowx-drop.png", type: "image/png" },
      { rel: "shortcut icon", href: "/logos/sparrowx-drop.png" },
      { rel: "apple-touch-icon", href: "/logos/sparrowx-drop.png" },
    ],
  }),
  component: SparrowxFilesRoute,
});

function SparrowxFilesRoute() {
  return (
    <>
      <SparrowxDropEngine />
      <BackgroundEngineToaster />
    </>
  );
}
