import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, Check, Copy } from "lucide-react";
import {
  isValidServiceDocId,
  SERVICE_DOC_LIST,
  SERVICE_DOCS,
  type ServiceDocSpec,
} from "@/lib/service-docs";
import { resolveAutoCorrectedDocSlug } from "@/lib/route-autocorrect";
import { buildMasterHref, buildProductHref } from "@/lib/routing";
import { SparrowxFooter } from "@/components/SparrowxFooter";

export const Route = createFileRoute("/docs/$service")({
  beforeLoad: ({ params }) => {
    const raw = String(params.service || "").trim();
    if (isValidServiceDocId(raw)) return;
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    const fixed = resolveAutoCorrectedDocSlug(raw, host);
    if (fixed === "errors") {
      throw redirect({ to: "/docs/errors" });
    }
    throw redirect({ to: "/docs/$service", params: { service: fixed } });
  },
  head: ({ params }) => {
    const doc = isValidServiceDocId(params.service) ? SERVICE_DOCS[params.service] : null;
    return {
      meta: [
        {
          title: doc
            ? `${doc.name} Documentation — SparrowX Docs`
            : "SparrowX Service Documentation",
        },
        {
          name: "description",
          content: doc
            ? doc.tagline
            : "Official documentation for SparrowX cloud, database, security, and hosting services.",
        },
      ],
    };
  },
  component: ServiceDocsPage,
});

function CodeBlock({ label, snippet }: { label: string; snippet: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#05060A] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/[0.02]">
        <span className="font-mono text-[11px] text-zinc-400">{label}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 hover:text-white cursor-pointer"
        >
          {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="p-4 text-xs font-mono text-zinc-200 overflow-x-auto leading-relaxed">
        <code>{snippet}</code>
      </pre>
    </div>
  );
}

function ServiceDocsPage() {
  const { service } = Route.useParams();
  const doc: ServiceDocSpec = isValidServiceDocId(service)
    ? SERVICE_DOCS[service]
    : SERVICE_DOCS.db;
  const launchHref = buildProductHref(doc.id);
  const docsHubHref = buildMasterHref("/docs");
  const docsErrorsHref = buildMasterHref("/docs/errors");

  return (
    <div className="min-h-screen bg-[#05060A] text-white flex flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#05060A]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <a href={launchHref} className="flex items-center gap-2.5 font-bold text-sm text-white hover:opacity-90 shrink-0">
              <img src={doc.logo} alt={doc.name} width={28} height={28} className="size-7 object-contain" />
              <span className="truncate">{doc.name}</span>
            </a>
            <span className="text-zinc-600 hidden sm:inline">/</span>
            <span className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-mono ${doc.badgeClass}`}>
              <BookOpen className="size-3" />
              Documentation
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href={docsHubHref}
              className="px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-medium text-zinc-300 transition-colors"
            >
              All Docs
            </a>
            <a
              href={launchHref}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-colors"
            >
              <span>Open {doc.name.replace("SparrowX ", "")}</span>
              <ArrowUpRight className="size-3.5" />
            </a>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8 items-start">
        {/* Left Navigation: On This Page + Switch Service Docs */}
        <aside className="space-y-6 lg:sticky lg:top-24">
          <div className="rounded-xl border border-white/10 bg-[#0A0D14] p-4 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 px-2">
              {doc.name} Sections
            </p>
            <nav className="space-y-1">
              {doc.sections.map((sec) => (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  className="block px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  {sec.title}
                </a>
              ))}
            </nav>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0A0D14] p-4 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 px-2">
              Other Service Docs
            </p>
            <nav className="space-y-1">
              {SERVICE_DOC_LIST.map((other) => {
                const active = other.id === doc.id;
                return (
                  <a
                    key={other.id}
                    href={`/docs/${other.id}`}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      active
                        ? "bg-white/10 text-white font-semibold"
                        : "text-zinc-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span>{other.name.replace("SparrowX ", "")}</span>
                    <span className="font-mono text-[10px] text-zinc-500">/docs/{other.id}</span>
                  </a>
                );
              })}
              <a
                href={docsErrorsHref}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <span>Error Reference</span>
                <span className="font-mono text-[10px] text-zinc-500">/docs/errors</span>
              </a>
            </nav>
          </div>
        </aside>

        {/* Main Service Documentation Content */}
        <main className="space-y-8 min-w-0">
          <div className="rounded-2xl border border-white/10 bg-[#0A0D14] p-6 sm:p-8 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className={`px-2.5 py-0.5 rounded-full border ${doc.badgeClass}`}>
                {doc.domain}
              </span>
              <span className="text-zinc-500">Isolated Service Documentation</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
              {doc.name} Documentation
            </h1>
            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-3xl">
              {doc.tagline}
            </p>
          </div>

          <div className="space-y-6">
            {doc.sections.map((sec) => (
              <section
                key={sec.id}
                id={sec.id}
                className="scroll-mt-24 rounded-2xl border border-white/10 bg-[#0A0D14] p-6 space-y-4"
              >
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {sec.title}
                </h2>
                <p className="text-sm text-zinc-300 leading-relaxed">{sec.summary}</p>
                {sec.bullets && sec.bullets.length > 0 && (
                  <ul className="space-y-2 text-sm text-zinc-400 list-disc pl-5">
                    {sec.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
                {sec.code && <CodeBlock label={sec.code.label} snippet={sec.code.snippet} />}
              </section>
            ))}
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-white/10">
            <a
              href={launchHref}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white"
            >
              <ArrowLeft className="size-3.5" /> Return to {doc.name}
            </a>
            <a
              href={docsErrorsHref}
              className="text-xs font-mono text-zinc-400 hover:text-white"
            >
              Looking for an error code? Open Error Reference →
            </a>
          </div>
        </main>
      </div>

      <SparrowxFooter />
    </div>
  );
}
