import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/game/panel-sso")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { redirect302, sanitizeRelativePath } = await import("@/lib/server/http.server");
        const { panelUrl } = await import("@/lib/server/config.server");
        const { getPanelSsoIdentity } = await import("@/lib/server/portal.server");
        const { createPteroSsoToken, isPteroSsoReady } = await import("@/lib/server/ptero-sso.server");

        const url = new URL(request.url);
        const nextPath = sanitizeRelativePath(url.searchParams.get("next"), "/");
        const base = panelUrl().replace(/\/+$/, "");
        const directPanelTarget = `${base}${nextPath === "/" ? "" : nextPath}`;

        try {
          const identity = await getPanelSsoIdentity(request);
          if (!identity || !identity.pteroUserId) {
            return redirect302(directPanelTarget);
          }

          const ssoReady = await isPteroSsoReady(base);
          if (!ssoReady) {
            return redirect302(directPanelTarget);
          }

          const token = createPteroSsoToken({
            userId: identity.pteroUserId,
            email: identity.email,
            username: identity.username,
            nextPath,
          });
          return redirect302(`${base}/sparrowx-sso.php?token=${encodeURIComponent(token)}`);
        } catch {
          return redirect302(directPanelTarget);
        }
      },
    },
  },
});
