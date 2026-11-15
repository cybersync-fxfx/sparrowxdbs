import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/auth/discord/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { env, getMode } = await import("@/lib/server/config.server");
        const { getAppSession } = await import("@/lib/server/session.server");
        const { timingSafeEqual } = await import("@/lib/server/crypto.server");
        const { redirect302, resolveRequestOrigin } = await import("@/lib/server/http.server");
        const url = new URL(request.url);
        const origin = resolveRequestOrigin(request);
        const fail = (reason: string) => redirect302(`${origin}/game?auth_error=${encodeURIComponent(reason)}`);
        if (getMode() !== "live") return redirect302(`${origin}/api/public/auth/discord/login`);

        const session = await getAppSession();
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state") ?? "";
        const expected = session.data.oauthState ?? "";
        if (url.searchParams.get("error")) return fail("Discord sign-in was cancelled");
        if (!code || !expected || !timingSafeEqual(state, expected)) return fail("Sign-in expired, please try again");

        try {
          const clientId = env("DISCORD_CLIENT_ID");
          const clientSecret = env("DISCORD_CLIENT_SECRET");
          if (!clientId || !clientSecret) return fail("Discord OAuth is not configured on this server");

          const redirectUri = env("DISCORD_REDIRECT_URI") ?? `${origin}/api/public/auth/discord/callback`;
          const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              grant_type: "authorization_code",
              code,
              redirect_uri: redirectUri,
            }),
          });
          if (!tokenRes.ok) {
            console.error(`Discord token exchange [${tokenRes.status}]: ${await tokenRes.text()}`);
            return fail("Discord sign-in failed");
          }
          const token = (await tokenRes.json()) as { access_token: string };
          const meRes = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${token.access_token}` } });
          if (!meRes.ok) return fail("Could not read your Discord profile");
          const me = (await meRes.json()) as { id: string; username: string; global_name: string | null; avatar: string | null; email?: string | null; verified?: boolean };

          const { provisionLiveClient } = await import("@/lib/server/portal.server");
          const client = await provisionLiveClient({
            id: me.id,
            username: me.username,
            global_name: me.global_name,
            avatar: me.avatar,
            email: me.verified ? (me.email ?? null) : null,
          });
          const nextPlan = session.data.nextPlan;
          const savedOrigin = session.data.oauthOrigin;
          const safeOrigin =
            savedOrigin && /^https?:\/\/([a-z0-9-]+\.)*sparrowx\.net(:\d+)?$/i.test(savedOrigin)
              ? savedOrigin
              : origin;
          await session.clear();
          await session.update({
            mode: "live",
            clientId: client.id,
            discordId: me.id,
            username: me.username,
            globalName: me.global_name,
            avatar: me.avatar,
          });
          return redirect302(`${safeOrigin}/game/dashboard${nextPlan ? `?deploy=${nextPlan}` : ""}`);
        } catch (e) {
          console.error("Discord callback failed", e);
          return fail("We couldn't set up your account, please try again");
        }
      },
    },
  },
});
