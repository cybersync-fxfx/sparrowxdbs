import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SparrowxInfraEngine } from "@/components/SparrowxInfraEngine";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";
import { buildRouteHeadFromProfile, SEO_PROFILES } from "@/lib/seo-profiles";

export const Route = createFileRoute("/infra/")({
  head: () => buildRouteHeadFromProfile(SEO_PROFILES.infra),
  component: SparrowxInfraRoute,
});

function SparrowxInfraRoute() {
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (host === "sparrowx.net" || host === "www.sparrowx.net") {
      window.location.replace(`https://infra.sparrowx.net${window.location.search}${window.location.hash}`);
    }
  }, []);

  return (
    <>
      <SparrowxInfraEngine />
      <BackgroundEngineToaster />
    </>
  );
}
