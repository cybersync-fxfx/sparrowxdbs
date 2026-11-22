import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SovereignDatabaseStudio } from "@/components/SovereignDatabaseStudio";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";
import { buildRouteHeadFromProfile, SEO_PROFILES } from "@/lib/seo-profiles";

export const Route = createFileRoute("/db")({
  head: () => buildRouteHeadFromProfile(SEO_PROFILES.db),
  component: SparrowxDbRoute,
});

function SparrowxDbRoute() {
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (host === "sparrowx.net" || host === "www.sparrowx.net") {
      window.location.replace(`https://db.sparrowx.net${window.location.search}${window.location.hash}`);
    }
  }, []);

  return (
    <>
      <SovereignDatabaseStudio
        isStandaloneDomain={true}
        onOpenClientArea={() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
      <BackgroundEngineToaster />
    </>
  );
}
