import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SovereignDatabaseStudio } from "@/components/SovereignDatabaseStudio";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/db")({
  head: () => ({
    meta: [
      { title: "SparrowX Cloud DB — Fast Managed PostgreSQL & pgvector Database for Builders" },
      {
        name: "description",
        content:
          "Deploy high-performance PostgreSQL 16+ with native pgvector search, visual schema editor, instant REST API, PgBouncer pooling, and nightly snapshots. Zero egress fees.",
      },
      {
        name: "keywords",
        content:
          "cloud postgresql, managed postgres database, pgvector hosting, ai vector database, postgres rest api, pgbouncer connection pool, serverless database, zero egress fee cloud, developer postgresql, sparrowx db",
      },
      { property: "og:title", content: "SparrowX Cloud DB — Managed PostgreSQL & pgvector Studio" },
      {
        property: "og:description",
        content:
          "High-performance cloud PostgreSQL with visual table editor, pgvector AI vector search, instant PostgREST API, and zero bandwidth egress penalties.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://db.sparrowx.net" },
      { property: "og:image", content: "https://sparrowx.net/logos/sparrowx-db.jpg" },
      { property: "og:image:alt", content: "SparrowX Cloud DB — Managed PostgreSQL and pgvector" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "SparrowX Cloud DB — Managed PostgreSQL & pgvector" },
      {
        name: "twitter:description",
        content:
          "High-performance cloud PostgreSQL with visual table editor, pgvector AI search, and zero egress fees.",
      },
      { name: "twitter:image", content: "https://sparrowx.net/logos/sparrowx-db.jpg" },
      { name: "twitter:image:alt", content: "SparrowX Cloud DB — Managed PostgreSQL and pgvector" },
    ],
    links: [
      { rel: "canonical", href: "https://db.sparrowx.net" },
      { rel: "icon", href: "/logos/sparrowx-db.png", type: "image/png" },
      { rel: "shortcut icon", href: "/logos/sparrowx-db.png" },
      { rel: "apple-touch-icon", href: "/logos/sparrowx-db.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SoftwareApplication",
              "name": "SparrowX Cloud DB",
              "applicationCategory": "DeveloperApplication, DatabaseManagement",
              "operatingSystem": "All",
              "url": "https://db.sparrowx.net",
              "description":
                "Enterprise PostgreSQL database with pgvector vector search, visual studio, instant REST API, and zero egress fees.",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD",
              },
            },
            {
              "@type": "FAQPage",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": "What database engine powers SparrowX Cloud DB?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text":
                      "SparrowX Cloud DB runs dedicated PostgreSQL 16+ on dedicated NVMe Gen4 storage with PgBouncer connection pooling and native pgvector extension for LLM embeddings.",
                  },
                },
                {
                  "@type": "Question",
                  "name": "Are there any hidden bandwidth or egress fees?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text":
                      "No. SparrowX Cloud DB operates on transparent flat pricing with 0 dollar egress bandwidth traps, so you are never penalized for querying or exporting your data.",
                  },
                },
                {
                  "@type": "Question",
                  "name": "How does pgvector AI embedding search work?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text":
                      "SparrowX Cloud DB pre-installs the pgvector extension with support for 768d, 1024d, and 1536d vector dimensions with IVFFlat and HNSW cosine similarity indexes.",
                  },
                },
              ],
            },
          ],
        }),
      },
    ],
  }),
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
