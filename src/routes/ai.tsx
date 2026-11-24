import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Brain, ShieldAlert, Sparkles } from "lucide-react";
import { SparrowxAiBrainCenter } from "@/components/SparrowxAiBrainCenter";
import { AiGuardrailSandbox } from "@/components/AiGuardrailSandbox";
import { BackgroundEngineToaster, emitEngineToast } from "@/components/BackgroundEngineToaster";
import { SparrowxFooter } from "@/components/SparrowxFooter";
import { buildMasterHref } from "@/lib/routing";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "SparrowX AI & Agentics — Autonomous Security Brain & LLM Guardrails" },
      {
        name: "description",
        content:
          "SparrowX AI & Agentics platform: inline LLM prompt-injection guardrails, autonomous security copilot, threat intelligence harvesting, and pgvector agent memory.",
      },
    ],
    links: [
      { rel: "icon", href: "/logos/sparrowx-main.png", type: "image/png" },
      { rel: "shortcut icon", href: "/logos/sparrowx-main.png" },
    ],
  }),
  component: SparrowxAiRoute,
});

function SparrowxAiRoute() {
  const [section, setSection] = useState<"brain" | "guardrails">("brain");

  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (host === "sparrowx.net" || host === "www.sparrowx.net") {
      window.location.replace(`https://ai.sparrowx.net${window.location.search}${window.location.hash}`);
    }
  }, []);

  const showToast = (msg: string, type: "success" | "error" | "info" | "cooking" = "info") => {
    emitEngineToast(msg, type === "cooking" ? "info" : type);
  };

  return (
    <div className="min-h-screen bg-[#05060A] text-white font-sans antialiased flex flex-col">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05060A]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-14 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <a href={buildMasterHref("/")} className="flex items-center gap-2.5 shrink-0">
              <img
                src="/sparrowx-logo.png"
                alt="SparrowX AI & Agentics"
                width={32}
                height={32}
                className="size-8 object-contain"
              />
              <span className="font-bold text-sm tracking-wider text-white">
                SPARROWX <span className="text-emerald-400">AI</span>
              </span>
            </a>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-mono text-emerald-300">
              <Sparkles className="size-3" aria-hidden="true" />
              AGENTIC WORKBENCH
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSection("brain")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                section === "brain"
                  ? "bg-white text-black font-semibold"
                  : "border border-white/15 bg-white/5 text-zinc-300 hover:text-white"
              }`}
            >
              <Brain className="size-3.5" aria-hidden="true" />
              <span>AI Brain</span>
            </button>
            <button
              type="button"
              onClick={() => setSection("guardrails")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                section === "guardrails"
                  ? "bg-white text-black font-semibold"
                  : "border border-white/15 bg-white/5 text-zinc-300 hover:text-white"
              }`}
            >
              <ShieldAlert className="size-3.5" aria-hidden="true" />
              <span>LLM Guardrails</span>
            </button>
            <a
              href={buildMasterHref("/")}
              className="hidden md:inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-white/15 text-xs text-zinc-300 hover:text-white hover:border-white/35 transition-colors"
            >
              <span>Master Portal</span>
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="rounded-xl border border-white/15 bg-[#090B10] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">
              ai.sparrowx.net • Autonomous Defense &amp; Agentics
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              SparrowX AI Brain &amp; Prompt Guardrail Engine
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
              Test live prompt-injection &amp; PII leak filters, harvest internet threat intelligence, and run autonomous incident workflows across your SparrowX infrastructure.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href="https://db.sparrowx.net"
              className="px-3 py-1.5 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-mono text-zinc-200"
            >
              pgvector DB
            </a>
            <a
              href="https://sec.sparrowx.net"
              className="px-3 py-1.5 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-mono text-zinc-200"
            >
              Shield SOC
            </a>
          </div>
        </div>

        {section === "brain" ? (
          <SparrowxAiBrainCenter
            activeNav="SparrowX AI Brain"
            portalMode="client"
            incidents={[]}
            threatIndicators={[]}
            assets={[]}
            vulnerabilities={[]}
            protectedServices={[]}
            clientTenants={[]}
            auditLogs={[]}
            onEnforceGlobalAutoBlock={async (count) => {
              showToast(`Enforced ${count} learned AI defense pattern(s) across edge rules.`, "success");
            }}
            showToast={showToast}
          />
        ) : (
          <AiGuardrailSandbox showToast={(m) => showToast(m, "info")} />
        )}
      </main>

      <SparrowxFooter />
      <BackgroundEngineToaster />
    </div>
  );
}
