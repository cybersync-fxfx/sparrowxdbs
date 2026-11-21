import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BookOpen, ShieldAlert } from "lucide-react";
import { SERVICE_DOC_LIST } from "@/lib/service-docs";
import { SparrowxFooter } from "@/components/SparrowxFooter";

export const Route = createFileRoute("/docs/")({
  head: () => ({
    meta: [
      { title: "SparrowX Documentation Hub — Dedicated Guides Per Service" },
      {
        name: "description",
        content:
          "Dedicated technical documentation for SparrowX Cloud DB, Cloud Infra, Shield DDoS, Game Hosting, Drop Vault, Offline Keys, and Private API Gateway.",
      },
    ],
  }),
  component: DocsHubPage,
});

function DocsHubPage() {
  return (
    <div className="min-h-screen bg-[#05060A] text-white flex flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#05060A]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2.5 font-bold text-sm text-white hover:opacity-90">
              <img src="/logos/sparrowx-main.png" alt="SparrowX" width={28} height={28} className="size-7 object-contain" />
              <span>SparrowX</span>
            </a>
            <span className="text-zinc-600">/</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-zinc-300">
              <BookOpen className="size-3.5 text-sky-400" />
              Documentation Hub
            </span>
          </div>
          <a
            href="/"
            className="px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-medium text-zinc-200 transition-colors"
          >
            ← Back to SparrowX
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 space-y-10">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-400">
            Dedicated Per-Service Documentation
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            SparrowX Platform Documentation
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
            Every SparrowX platform has its own isolated documentation portal — pick a service below for quickstarts, CLI guides, SDK examples, and deployment references.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {SERVICE_DOC_LIST.map((doc) => (
            <a
              key={doc.id}
              href={`/docs/${doc.id}`}
              className="group rounded-2xl border border-white/10 bg-[#0A0D14] hover:border-white/25 p-6 flex flex-col justify-between gap-5 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <img src={doc.logo} alt={doc.name} width={32} height={32} className="size-8 object-contain" />
                    <h2 className="font-semibold text-base text-white">{doc.name}</h2>
                  </div>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-mono ${doc.badgeClass}`}>
                    /docs/{doc.id}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{doc.tagline}</p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-white/10 text-xs">
                <span className="font-mono text-zinc-500">{doc.domain}</span>
                <span className={`inline-flex items-center gap-1 font-medium group-hover:translate-x-0.5 transition-transform ${doc.accentClass}`}>
                  Read Docs <ArrowRight className="size-3.5" />
                </span>
              </div>
            </a>
          ))}

          <a
            href="/docs/errors"
            className="group rounded-2xl border border-white/10 bg-[#0A0D14] hover:border-white/25 p-6 flex flex-col justify-between gap-5 transition-all"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-amber-500/15 border border-amber-400/30 grid place-items-center text-amber-300">
                    <ShieldAlert className="size-4" />
                  </div>
                  <h2 className="font-semibold text-base text-white">Error Reference</h2>
                </div>
                <span className="px-2 py-0.5 rounded border border-amber-400/30 bg-amber-500/10 text-[10px] font-mono text-amber-300">
                  /docs/errors
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Searchable error code knowledgebase, HTTP/SSL diagnostics, and step-by-step troubleshooting across all services.
              </p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-white/10 text-xs">
              <span className="font-mono text-zinc-500">Knowledgebase</span>
              <span className="inline-flex items-center gap-1 font-medium text-amber-300 group-hover:translate-x-0.5 transition-transform">
                Browse Codes <ArrowRight className="size-3.5" />
              </span>
            </div>
          </a>
        </div>
      </main>

      <SparrowxFooter />
    </div>
  );
}
