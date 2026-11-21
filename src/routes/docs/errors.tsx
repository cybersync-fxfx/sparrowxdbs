import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ErrorDocumentationCenter } from "@/components/ErrorDocumentationCenter";
import { BackgroundEngineToaster, emitEngineToast } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/docs/errors")({
  head: () => ({
    meta: [
      { title: "SparrowX Documentation & Error Resolution Knowledgebase" },
      {
        name: "description",
        content:
          "Lookup error codes, diagnosis guides, API gateway failure codes, and step-by-step resolution steps for SparrowX databases, WAF, and autonomous agents.",
      },
      {
        name: "keywords",
        content:
          "sparrowx errors, database connection troubleshooting, waf block error, api gateway codes, cloud database error codes, ssl handshake error fix",
      },
      { property: "og:title", content: "SparrowX Documentation & Troubleshooting Knowledgebase" },
      {
        property: "og:description",
        content:
          "Find out what went wrong, why it happened, and how to resolve error codes across SparrowX services.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://sparrowx.net/docs/errors" },
      { property: "og:image", content: "https://sparrowx.net/logos/sparrowx-main.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: "https://sparrowx.net/docs/errors" },
      { rel: "icon", href: "/logos/sparrowx-silver.png", type: "image/png" },
      { rel: "shortcut icon", href: "/logos/sparrowx-silver.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "TechArticle",
          "headline": "SparrowX Troubleshooting & Error Resolution Center",
          "url": "https://sparrowx.net/docs/errors",
          "description":
            "Official diagnostic guides and remediation steps for error codes encountered across SparrowX databases, WAF, and services.",
          "author": {
            "@type": "Organization",
            "name": "SparrowX Technologies",
          },
        }),
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { code?: string; ref?: string } => {
    return {
      ...(typeof search.code === "string" ? { code: search.code } : {}),
      ...(typeof search.ref === "string" ? { ref: search.ref } : {}),
    };
  },
  component: DocsErrorsPage,
});

function DocsErrorsPage() {
  const { code, ref } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-md sm:px-8">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-2.5 font-display text-base font-bold text-white hover:opacity-90"
          >
            <img src="/logos/sparrowx-silver.png" alt="SparrowX Silver Logo Emblem" width={24} height={24} className="size-6 object-contain" />
            <span>
              sparrow<span className="text-primary">x</span>
            </span>
          </a>
          <span className="text-muted-foreground/60">/</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
            Documentation
          </span>
        </div>

        <a
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
        >
          <span>← Back to Dashboard</span>
        </a>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <ErrorDocumentationCenter
          initialCode={code}
          initialReferenceId={ref}
          onNavigateBack={() => navigate({ to: "/" })}
          showToast={(msg, type) => emitEngineToast(msg, type || "info")}
        />
      </main>

      <BackgroundEngineToaster />
    </div>
  );
}
