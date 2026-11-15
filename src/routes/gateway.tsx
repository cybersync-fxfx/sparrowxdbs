import { createFileRoute } from "@tanstack/react-router";
import { SparrowxApiGatewayPortal } from "@/components/SparrowxApiGatewayPortal";

export const Route = createFileRoute("/gateway")({
  head: () => ({
    meta: [
      {
        title: "SparrowX API Gateway | Hosted PostgreSQL REST API & SDKs",
      },
      {
        name: "description",
        content:
          "SparrowX API Gateway (api.sparrowx.net) — Instant RESTful PostgreSQL API with personal spx_db keys and ready-to-run cURL, TypeScript, and Python snippets.",
      },
      {
        property: "og:title",
        content: "SparrowX API Gateway — Instant Hosted PostgreSQL REST API",
      },
      {
        property: "og:description",
        content:
          "Query your sovereign PostgreSQL tables with sub-millisecond PostgREST latency, scoped API keys, and generated SDK examples.",
      },
      {
        property: "og:url",
        content: "https://api.sparrowx.net/gateway",
      },
      {
        name: "robots",
        content: "index, follow",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://api.sparrowx.net/gateway",
      },
    ],
  }),
  component: ApiGatewayRoutePage,
});

function ApiGatewayRoutePage() {
  return <SparrowxApiGatewayPortal />;
}
