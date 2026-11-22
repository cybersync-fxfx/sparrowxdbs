import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SparrowxKeysEngine } from "@/components/SparrowxKeysEngine";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";
import { buildRouteHeadFromProfile, SEO_PROFILES } from "@/lib/seo-profiles";

export const Route = createFileRoute("/keys")({
  head: () => buildRouteHeadFromProfile(SEO_PROFILES.keys),
  component: SparrowxKeysRoute,
});

function SparrowxKeysRoute() {
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (host === "sparrowx.net" || host === "www.sparrowx.net") {
      window.location.replace(`https://password.sparrowx.net${window.location.search}${window.location.hash}`);
    }
  }, []);

  return (
    <>
      <SparrowxKeysEngine />
      <BackgroundEngineToaster />
    </>
  );
}
