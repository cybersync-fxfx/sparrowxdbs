import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SparrowxShieldEngine } from "@/components/SparrowxShieldEngine";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";
import { buildRouteHeadFromProfile, SEO_PROFILES } from "@/lib/seo-profiles";

export const Route = createFileRoute("/shield")({
  head: () => buildRouteHeadFromProfile(SEO_PROFILES.shield),
  component: SparrowxShieldRoute,
});

function SparrowxShieldRoute() {
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (host === "sparrowx.net" || host === "www.sparrowx.net") {
      window.location.replace(`https://sec.sparrowx.net${window.location.search}${window.location.hash}`);
    }
  }, []);

  return (
    <>
      <SparrowxShieldEngine />
      <BackgroundEngineToaster />
    </>
  );
}
