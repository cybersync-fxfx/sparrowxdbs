import { createFileRoute } from "@tanstack/react-router";
import { SovereignDatabaseStudio } from "@/components/SovereignDatabaseStudio";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/db")({
  head: () => ({
    meta: [
      { title: "SparrowX DB | Sovereign Database & BaaS Console" },
      {
        name: "description",
        content:
          "Managed PostgreSQL 16 + pgvector BaaS. Instant auto-generated REST APIs, PgBouncer transaction pooling (:6543), and zero-telemetry NVMe storage.",
      },
    ],
  }),
  component: SparrowxDbRoute,
});

function SparrowxDbRoute() {
  return (
    <>
      <SovereignDatabaseStudio isStandaloneDomain={true} />
      <BackgroundEngineToaster />
    </>
  );
}
