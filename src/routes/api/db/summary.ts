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
          targetEmail: queryEmail,
          targetTenantId: queryTenant,
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

        // Non-admin callers must scope by their own email or tenantId when not in local dev
        const effectiveEmail = auth.isAdmin
          ? queryEmail
          : queryEmail || auth.actorEmail;
        const effectiveTenant = auth.isAdmin
          ? queryTenant
          : queryTenant || auth.tenantId;

        try {
          const { listProvisionedDatabases } = await import(
            "@/lib/server/pg-provisioner.server"
          );
          const summary = await listProvisionedDatabases({
            isAdmin: auth.isAdmin || (!effectiveEmail && !effectiveTenant),
            userEmail: effectiveEmail,
            tenantId: effectiveTenant,
          });
          return Response.json({ ok: true, ...summary });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unable to inspect databases";
          return Response.json(
            {
              ok: false,
              error: message,
              totalUsers: 0,
              totalProvisionedDbs: 0,
              totalStorageBytes: 0,
              databases: [],
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
