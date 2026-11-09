import { createFileRoute } from "@tanstack/react-router";
import { SparrowxDropEngine } from "@/components/SparrowxDropEngine";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/drop")({
  head: () => ({
    meta: [
      { title: "SparrowX Drop | Ephemeral Zero-Disk File Sharing" },
      {
        name: "description",
        content:
          "End-to-end AES-GCM encrypted file sharing. Zero disk footprint, session-bound RAM lifecycle, and automatic 15-minute TTL.",
      },
    ],
  }),
  component: SparrowxDropRoute,
});

function SparrowxDropRoute() {
  return (
    <>
      <SparrowxDropEngine />
      <BackgroundEngineToaster />
    </>
  );
}
