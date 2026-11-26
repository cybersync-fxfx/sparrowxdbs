import { createFileRoute } from "@tanstack/react-router";
import { ZodError } from "zod";
import { attachDomainSchema } from "@/lib/server/deploy-crypto.server";

export const Route = createFileRoute("/api/deploy/domains")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireDeployActor } = await import("@/lib/server/deploy-auth.server");
        const auth = await requireDeployActor(request);
        if (!auth.authorized) {
          return Response.json({ ok: false, error: "Authentication required." }, { status: 401 });
        }
        const { listDomainsForActor, getDeployHostDomain } =
          await import("@/lib/server/deploy-store.server");
        const domains = await listDomainsForActor(auth.actor);
        return Response.json(
          {
            ok: true,
            domains,
            cnameTarget: `deploy.${getDeployHostDomain()}`,
            edgeIp: process.env.SPARROWX_PUBLIC_IP?.trim() || "139.99.131.135",
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },

      POST: async ({ request }) => {
        try {
          const { requireDeployActor } = await import("@/lib/server/deploy-auth.server");
          const auth = await requireDeployActor(request);
          if (!auth.authorized) {
            return Response.json({ ok: false, error: "Authentication required." }, { status: 401 });
          }
          const body = await request.json();
          const parsed = attachDomainSchema.parse(body);
          const { attachDomainForActor } = await import("@/lib/server/deploy-store.server");
          const domain = await attachDomainForActor(parsed.projectId, parsed.domain, auth.actor);
          return Response.json({ ok: true, domain }, { status: 201 });
        } catch (err) {
          if (err instanceof ZodError) {
            return Response.json(
              { ok: false, error: err.issues[0]?.message || "Invalid domain." },
              { status: 400 },
            );
          }
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Failed to add domain." },
            { status: 400 },
          );
        }
      },

      PATCH: async ({ request }) => {
        try {
          const { requireDeployActor } = await import("@/lib/server/deploy-auth.server");
          const auth = await requireDeployActor(request);
          if (!auth.authorized) {
            return Response.json({ ok: false, error: "Authentication required." }, { status: 401 });
          }
          const body = (await request.json()) as { domainId?: string };
          if (!body.domainId) {
            return Response.json({ ok: false, error: "domainId is required." }, { status: 400 });
          }
          const { verifyDomainDnsForActor } = await import("@/lib/server/deploy-store.server");
          const res = await verifyDomainDnsForActor(body.domainId, auth.actor);
          return Response.json({ ok: true, ...res }, { headers: { "Cache-Control": "no-store" } });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "DNS check failed." },
            { status: 400 },
          );
        }
      },

      DELETE: async ({ request }) => {
        const { requireDeployActor } = await import("@/lib/server/deploy-auth.server");
        const auth = await requireDeployActor(request);
        if (!auth.authorized) {
          return Response.json({ ok: false, error: "Authentication required." }, { status: 401 });
        }
        const url = new URL(request.url);
        const id = url.searchParams.get("id") || "";
        if (!id) {
          return Response.json({ ok: false, error: "Domain id is required." }, { status: 400 });
        }
        const { removeDomainForActor } = await import("@/lib/server/deploy-store.server");
        const deleted = await removeDomainForActor(id, auth.actor);
        return Response.json({ ok: true, deleted });
      },
    },
  },
});
