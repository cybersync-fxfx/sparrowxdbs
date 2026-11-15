import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/auth/discord/login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getMode, env } = await import("@/lib/server/config.server");
        const { getAppSession } = await import("@/lib/server/session.server");
        const { randomToken } = await import("@/lib/server/crypto.server");
        const session = await getAppSession();
        const reqUrl = new URL(request.url);
        const origin = reqUrl.origin;
        const planParam = reqUrl.searchParams.get("plan");
        const plan = planParam && /^[a-z0-9-]{1,40}$/.test(planParam) ? planParam : undefined;
        const dest = `${origin}/game/dashboard${plan ? `?deploy=${plan}` : ""}`;

        if (getMode() === "demo") {
          // Preview / pre-launch: sign in as a demo pilot with realistic mock data.
          const { buildDemoSession } = await import("@/lib/server/portal.server");
          if (session.data.mode !== "demo" || !session.data.demo) await session.update(await buildDemoSession());
          return Response.redirect(dest, 302);
        }

        const state = randomToken(16);
        await session.update({ ...session.data, oauthState: state, nextPlan: plan });
        const redirectUri = env("DISCORD_REDIRECT_URI") ?? `${origin}/api/public/auth/discord/callback`;
        const url = new URL("https://discord.com/oauth2/authorize");
        url.searchParams.set("client_id", env("DISCORD_CLIENT_ID")!);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("redirect_uri", redirectUri);
        url.searchParams.set("scope", "identify email");
        url.searchParams.set("state", state);
        url.searchParams.set("prompt", "none");
        return Response.redirect(url.toString(), 302);
      },
    },
  },
});
