import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SparrowxAgentsPlatform } from "@/components/SparrowxAgentsPlatform";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/agents")({
  head: () => ({
    meta: [
      { title: "SparrowX Agents — Autonomous AI Agent Runtime, Tools & Live Traces" },
      {
        name: "description",
        content:
          "Deploy autonomous AI agents with pgvector memory, authorized security & database tools, Sentinel guardrails, live execution traces, and webhook triggers.",
      },
    ],
    links: [
      { rel: "icon", href: "/logos/sparrowx-main.png", type: "image/png" },
      { rel: "shortcut icon", href: "/logos/sparrowx-main.png" },
    ],
  }),
  component: SparrowxAgentsRoute,
});

function SparrowxAgentsRoute() {
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (host === "sparrowx.net" || host === "www.sparrowx.net") {
      window.location.replace(`https://agents.sparrowx.net${window.location.search}${window.location.hash}`);
    }
  }, []);

  return (
    <>
      <SparrowxAgentsPlatform />
      <BackgroundEngineToaster />
    </>
  );
}
