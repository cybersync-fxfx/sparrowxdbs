import { createFileRoute } from "@tanstack/react-router";
import { SparrowxDropEngine } from "@/components/SparrowxDropEngine";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/f/$id")({
  head: () => ({
    meta: [
      { title: "SparrowX Files | Sovereign File Download" },
      {
        name: "description",
        content:
          "Download file hosted on SparrowX Sovereign Storage. Fast, private, unthrottled bare-metal download.",
      },
    ],
  }),
  component: SparrowxFileDownloadRoute,
});

function SparrowxFileDownloadRoute() {
  return (
    <>
      <SparrowxDropEngine />
      <BackgroundEngineToaster />
    </>
  );
}
