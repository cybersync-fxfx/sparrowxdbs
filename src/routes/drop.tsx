import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SparrowxDropEngine } from "@/components/SparrowxDropEngine";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";
import { buildRouteHeadFromProfile, SEO_PROFILES } from "@/lib/seo-profiles";

export const Route = createFileRoute("/drop")({
  head: () => buildRouteHeadFromProfile(SEO_PROFILES.drop),
  component: SparrowxDropRoute,
});

function SparrowxDropRoute() {
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (host === "sparrowx.net" || host === "www.sparrowx.net") {
      window.location.replace(`https://file.sparrowx.net${window.location.search}${window.location.hash}`);
    }
  }, []);

  return (
    <>
      <SparrowxDropEngine />
      <BackgroundEngineToaster />
    </>
  );
}
