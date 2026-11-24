import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SparrowxApiGatewayPortal } from "@/components/SparrowxApiGatewayPortal";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";
import { SEO_PROFILES, buildRouteHeadFromProfile } from "@/lib/seo-profiles";

export const Route = createFileRoute("/gateway")({
  head: () => buildRouteHeadFromProfile(SEO_PROFILES.gateway),
  component: ApiGatewayRoutePage,
});

function ApiGatewayRoutePage() {
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (host === "sparrowx.net" || host === "www.sparrowx.net") {
      window.location.replace(`https://api.sparrowx.net${window.location.search}${window.location.hash}`);
    }
  }, []);

  return (
    <>
      <SparrowxApiGatewayPortal />
      <BackgroundEngineToaster />
    </>
  );
}
