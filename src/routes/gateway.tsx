import { createFileRoute } from "@tanstack/react-router";
import { SparrowxApiGatewayPortal } from "@/components/SparrowxApiGatewayPortal";
import { SEO_PROFILES, buildRouteHeadFromProfile } from "@/lib/seo-profiles";

export const Route = createFileRoute("/gateway")({
  head: () => buildRouteHeadFromProfile(SEO_PROFILES.gateway),
  component: ApiGatewayRoutePage,
});

function ApiGatewayRoutePage() {
  return <SparrowxApiGatewayPortal />;
}
