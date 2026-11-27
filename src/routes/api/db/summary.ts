import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/db/summary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const queryEmail = url.searchParams.get("email")?.trim().toLowerCase() || undefined;
        const queryTenant = url.searchParams.get("tenantId")?.trim() || undefined;

        const { authorizeDbRequest } = await import("@/lib/server/db-auth.server");
        const auth = await authorizeDbRequest(request, {
          ...(queryEmail ? { targetEmail: queryEmail } : {}),
          ...(queryTenant ? { targetTenantId: queryTenant } : {}),
        });

        if (!auth.authorized) {
          return Response.json(
            {
              ok: false,
              error: auth.reason || "Unauthorized",
              totalUsers: 0,
              totalProvisionedDbs: 0,
              totalStorageBytes: 0,
              databases: [],
            },
            { status: 401 },
          );
        }

        // Strict tenant & account scoping: non-admin callers are pinned to verified identity
        const verifiedEmail = auth.actorEmail?.trim().toLowerCase() || "";
        const verifiedTenant = auth.tenantId?.trim() || "";

        if (!auth.isAdmin) {
          if (queryEmail && verifiedEmail && queryEmail.toLowerCase() !== verifiedEmail) {
            return Response.json(
              {
                ok: false,
                error: "Forbidden: cannot inspect databases belonging to another account.",
              },
              { status: 403 },
            );
          }
          if (queryTenant && verifiedTenant && queryTenant !== verifiedTenant) {
            return Response.json(
              {
                ok: false,
                error: "Forbidden: cannot inspect databases belonging to another tenant.",
              },
              { status: 403 },
            );
          }
          if (!verifiedEmail && !verifiedTenant && !queryEmail && !queryTenant) {
            return Response.json(
              {
                ok: false,
                error: "Unauthorized: authenticated session or tenant scope required.",
              },
              { status: 401 },
            );
          }
        }

        const effectiveEmail = auth.isAdmin
          ? queryEmail
          : verifiedEmail || (!verifiedTenant ? queryEmail : "");
        const effectiveTenant = auth.isAdmin
          ? queryTenant
          : verifiedTenant || (!verifiedEmail ? queryTenant : "");

        try {
          const { listProvisionedDatabases } = await import(
            "@/lib/server/pg-provisioner.server"
          );
          const summary = await listProvisionedDatabases({
            isAdmin: Boolean(auth.isAdmin),
            ...(effectiveEmail ? { userEmail: effectiveEmail } : {}),
            ...(effectiveTenant ? { tenantId: effectiveTenant } : {}),
          });
          return Response.json({ ok: true, ...summary });
        } catch {
          return Response.json(
            {
              ok: false,
              error: "Unable to inspect databases right now.",
              totalUsers: 0,
              totalProvisionedDbs: 0,
              totalStorageBytes: 0,
              databases: [],
            },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
