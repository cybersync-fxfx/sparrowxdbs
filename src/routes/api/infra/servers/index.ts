import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/infra/servers/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { readMasterSsoFromRequest } = await import("@/lib/server/master-sso.server");
          const { hasValidAdminKey } = await import("@/lib/server/db-auth.server");
          const isAdminKey = hasValidAdminKey(request);
          const claims = await readMasterSsoFromRequest(request);
          if (!isAdminKey && !claims) {
            return Response.json(
              { ok: false, error: "Authentication required." },
              { status: 401, headers: { "Cache-Control": "no-store" } },
            );
          }

          const { listManagedInfraServers } = await import(
            "@/lib/server/proxmox.server"
          );
          const data = await listManagedInfraServers();
          const isAdmin = isAdminKey || claims?.role === "admin";
          return Response.json(
            {
              ok: true,
              proxmox: isAdmin
                ? data.proxmox
                : {
                    configured: data.proxmox.configured,
                    mode: data.proxmox.mode,
                    url: "",
                    node: data.proxmox.configured ? "managed-cluster" : "unconfigured",
                    tokenIdMasked: data.proxmox.configured ? "Configured" : "Not configured",
                  },
              servers: data.servers,
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch {
          return Response.json(
            { ok: false, error: "Failed to list servers" },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
