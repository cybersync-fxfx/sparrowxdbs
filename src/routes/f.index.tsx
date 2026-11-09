import { createFileRoute } from "@tanstack/react-router";
import { SparrowxDropEngine } from "@/components/SparrowxDropEngine";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/f/")({
  head: () => ({
    meta: [
      { title: "SparrowX Files | Sovereign Storage" },
      {
        name: "description",
        content: "Persistent file storage and zero-disk ephemeral file drops.",
      },
    ],
  }),
  component: SparrowxFilesRoute,
});

function SparrowxFilesRoute() {
  return (
    <>
      <SparrowxDropEngine />
      <BackgroundEngineToaster />
    </>
  );
}
