import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SparrowxAiPlatform } from "@/components/SparrowxAiPlatform";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "SparrowX AI — Unified LLM Gateway, Model Playground & Prompt Guardrails" },
      {
        name: "description",
        content:
          "OpenAI-compatible AI Gateway with live Model Playground, inline prompt-injection & PII guardrails, scoped API keys, and autonomous threat intelligence.",
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
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (host === "sparrowx.net" || host === "www.sparrowx.net") {
      window.location.replace(`https://ai.sparrowx.net${window.location.search}${window.location.hash}`);
    }
  }, []);

  return (
    <>
      <SparrowxAiPlatform />
      <BackgroundEngineToaster />
    </>
  );
}
