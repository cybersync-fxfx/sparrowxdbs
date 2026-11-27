import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SparrowxAiPlatform } from "@/components/SparrowxAiPlatform";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";
import { buildRouteHeadFromProfile, SEO_PROFILES } from "@/lib/seo-profiles";

export const Route = createFileRoute("/ai")({
  head: () => buildRouteHeadFromProfile(SEO_PROFILES.ai),
  component: SparrowxAiRoute,
});

function SparrowxAiRoute() {
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (host === "sparrowx.net" || host === "www.sparrowx.net") {
      window.location.replace(`https://ai.sparrowx.net${window.location.search}${window.location.hash}`);
    }
  }, []);

  return (
    <>
      <SparrowxAiPlatform />
      <BackgroundEngineToaster />
    </>
  );
}
