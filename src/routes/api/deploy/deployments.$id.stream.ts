import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/deploy/deployments/$id/stream")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { requireDeployActor } = await import("@/lib/server/deploy-auth.server");
        const auth = await requireDeployActor(request);
        if (!auth.authorized) {
          return Response.json({ ok: false, error: "Authentication required." }, { status: 401 });
        }

        const { getDeploymentHistoryLogs } = await import("@/lib/server/deploy-store.server");
        const history = await getDeploymentHistoryLogs(params.id, auth.actor);
        if (!history) {
          return Response.json({ ok: false, error: "Deployment not found." }, { status: 404 });
        }

        const { subscribeDeployLogs } = await import("@/lib/server/deploy-queue.server");
        const encoder = new TextEncoder();

        let cleanupSub: (() => Promise<void>) | null = null;
        let heartbeat: ReturnType<typeof setInterval> | null = null;

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const sendEvent = (event: string, data: unknown) => {
              try {
                controller.enqueue(
                  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
                );
              } catch {
                // stream closed
              }
            };

            sendEvent("meta", {
              deploymentId: history.deployment.id,
              status: history.deployment.status,
              branch: history.deployment.branch,
              commitSha: history.deployment.commitSha,
            });

            for (const entry of history.logs) {
              sendEvent("log", entry);
            }

            cleanupSub = await subscribeDeployLogs(params.id, (entry) => {
              sendEvent("log", entry);
            });

            heartbeat = setInterval(() => {
              try {
                controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
              } catch {
                // stream closed
              }
            }, 15_000);

            request.signal.addEventListener("abort", () => {
              if (heartbeat) clearInterval(heartbeat);
              if (cleanupSub) void cleanupSub();
              try {
                controller.close();
              } catch {
                // ignore
              }
            });
          },
          cancel() {
            if (heartbeat) clearInterval(heartbeat);
            if (cleanupSub) void cleanupSub();
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
