import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SparrowxDeployDashboard } from "@/components/SparrowxDeployDashboard";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/deploy")({
  head: () => ({
    meta: [
      { title: "SparrowX Deploy — Cloud PaaS & Web App Deployment" },
      {
        name: "description",
        content:
          "Deploy Next.js, Vite, React, Node.js, Python, and Docker web apps with instant *.deploy.sparrowx.net HTTPS subdomains and live build logs.",
      },
    ],
  }),
  component: SparrowxDeployRoute,
});

function SparrowxDeployRoute() {
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (host === "sparrowx.net" || host === "www.sparrowx.net") {
      window.location.replace(`https://deploy.sparrowx.net${window.location.search}${window.location.hash}`);
    }
  }, []);

  return (
    <>
      <SparrowxDeployDashboard />
      <BackgroundEngineToaster />
    </>
  );
}
