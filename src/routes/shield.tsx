import { createFileRoute } from "@tanstack/react-router";
import { SparrowxShieldEngine } from "@/components/SparrowxShieldEngine";
import { BackgroundEngineToaster } from "@/components/BackgroundEngineToaster";

export const Route = createFileRoute("/shield")({
  head: () => ({
    meta: [
      { title: "SparrowX Shield | Autonomous Edge Security & WAF" },
      {
        name: "description",
        content:
          "Origin IP cloaking, automated threat caching in Redis, and interactive TLS / DNS inspection before exploits reach your database.",
      },
    ],
  }),
  component: SparrowxShieldRoute,
});

function SparrowxShieldRoute() {
  return (
    <>
      <SparrowxShieldEngine />
      <BackgroundEngineToaster />
    </>
  );
}
