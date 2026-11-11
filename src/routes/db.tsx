import { createFileRoute } from "@tanstack/react-router";
import { SovereignDatabaseStudio } from "@/components/SovereignDatabaseStudio";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/db")({
  head: () => ({
    meta: [
      { title: "SparrowX Cloud DB — Fast, Managed PostgreSQL & pgvector Database for Startups" },
      {
        name: "description",
        content:
          "Launch production-ready PostgreSQL with built-in pgvector search, high-capacity PgBouncer connection pooling, and 1-click full data exports. Flat predictable pricing with zero surprise bandwidth bills.",
      },
      {
        name: "keywords",
        content:
          "cloud postgresql, managed postgres database, pgvector cloud, vector database, postgres studio, pgbouncer pool, startup database, developer database, sparrowx db",
      },
      { property: "og:title", content: "SparrowX Cloud DB — Managed PostgreSQL & pgvector for Startups" },
      {
        property: "og:description",
        content:
          "Simple, high-performance cloud database with visual table editor, pgvector AI search, and automated nightly snapshots.",
      },
      { property: "og:url", content: "https://db.sparrowx.net" },
    ],
    links: [
      { rel: "canonical", href: "https://db.sparrowx.net" },
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
