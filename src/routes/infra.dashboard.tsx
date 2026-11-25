import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SparrowxInfraDashboard } from "@/components/SparrowxInfraDashboard";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/infra/dashboard")({
  head: () => ({
    meta: [
      {
        title:
          "SparrowX Cloud Panel (hPanel) — Proxmox VE Server, IP & SSH Management",
      },
      { name: "robots", content: "noindex, nofollow" },
      {
        name: "description",
        content:
          "Manage your SparrowX bare metal, dedicated servers, and KVM VPS with Proxmox VE power controls, browser SSH terminal, IPv4/IPv6 & WireGuard networking, snapshots, and unified UPI billing.",
      },
    ],
  }),
  component: SparrowxInfraDashboardRoute,
});

function SparrowxInfraDashboardRoute() {
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (host === "sparrowx.net" || host === "www.sparrowx.net") {
      window.location.replace(
        `https://infra.sparrowx.net/infra/dashboard${window.location.search}${window.location.hash}`,
      );
    }
  }, []);
  return (
    <>
      <SparrowxInfraDashboard />
      <BackgroundEngineToaster />
    </>
  );
}
