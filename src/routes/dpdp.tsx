import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SparrowxDpdpPlatform } from "@/components/SparrowxDpdpPlatform";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/dpdp")({
  head: () => ({
    meta: [
      { title: "SparrowX DPDP — India Digital Personal Data Protection Act 2023 Compliance Suite" },
      {
        name: "description",
        content:
          "Automate India DPDP Act 2023 compliance: Section 6 consent notice builder, DSAR Data Principal rights desk, 72-hour breach intimation console, and sovereign data inventory.",
      },
    ],
    links: [
      { rel: "icon", href: "/logos/sparrowx-shield.png", type: "image/png" },
      { rel: "shortcut icon", href: "/logos/sparrowx-shield.png" },
    ],
  }),
  component: SparrowxDpdpRoute,
});

function SparrowxDpdpRoute() {
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (host === "sparrowx.net" || host === "www.sparrowx.net") {
      window.location.replace(`https://dpdp.sparrowx.net${window.location.search}${window.location.hash}`);
    }
  }, []);

  return (
    <>
      <SparrowxDpdpPlatform />
      <BackgroundEngineToaster />
    </>
  );
}
