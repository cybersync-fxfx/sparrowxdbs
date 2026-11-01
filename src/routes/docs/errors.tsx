import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ErrorDocumentationCenter } from "@/components/ErrorDocumentationCenter";
import { BackgroundEngineToaster, emitEngineToast } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/docs/errors")({
  head: () => ({
    meta: [
      { title: "Troubleshooting & Error Center | SparrowX" },
      {
        name: "description",
        content: "Find out what went wrong, why it happened, and how to fix it in SparrowX.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { code?: string; ref?: string } => {
    return {
      code: typeof search.code === "string" ? search.code : undefined,
      ref: typeof search.ref === "string" ? search.ref : undefined,
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
            <img src="/sparrowx-logo.png" alt="SparrowX Logo" className="size-6 object-contain" />
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
