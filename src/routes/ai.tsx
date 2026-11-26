import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SparrowxAiPlatform } from "@/components/SparrowxAiPlatform";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "SparrowX AI — Deploy AI Agents, Workflows & MCP Servers in India (INR)" },
      {
        name: "description",
        content:
          "Deploy 24/7 AI agents, Langflow workflows, RAG stacks, and MCP servers in 60 seconds on dedicated Indian bare-metal infrastructure. Billed in INR via UPI.",
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
