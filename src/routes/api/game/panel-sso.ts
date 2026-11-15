import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/game/panel-sso")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { redirect302, resolveRequestOrigin, sanitizeRelativePath } = await import("@/lib/server/http.server");
        const { panelUrl } = await import("@/lib/server/config.server");
        const { getPanelSsoIdentity } = await import("@/lib/server/portal.server");
        const { createPteroSsoToken, isPteroSsoReady } = await import("@/lib/server/ptero-sso.server");

        const url = new URL(request.url);
        const origin = resolveRequestOrigin(request);
        const nextPath = sanitizeRelativePath(url.searchParams.get("next"), "/");

        const identity = await getPanelSsoIdentity();
        if (!identity) {
          return redirect302(`${origin}/api/public/auth/discord/login`);
        }

        if (identity.mode === "demo" || !identity.pteroUserId) {
          return redirect302(`${origin}/game/panel-launch?next=${encodeURIComponent(nextPath)}&mode=demo`);
        }

        const base = panelUrl();
        const ssoReady = await isPteroSsoReady(base);
        if (!ssoReady) {
          return redirect302(`${origin}/game/panel-launch?next=${encodeURIComponent(nextPath)}&mode=live`);
        }

        const token = createPteroSsoToken({
          userId: identity.pteroUserId,
          email: identity.email,
          username: identity.username,
          nextPath,
        });
        return redirect302(`${base}/sparrowx-sso.php?token=${encodeURIComponent(token)}`);
      },
    },
  },
});
