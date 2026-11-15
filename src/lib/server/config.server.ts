// Server-only environment helpers. Read process.env inside functions (per-request injection).
const env = (k: string) => {
  const v = process.env[k];
  return v && v.trim() ? v.trim() : undefined;
};

export function integrations() {
  return {
    database: !!env("POSTGREST_URL"),
    discord: !!(env("DISCORD_CLIENT_ID") && env("DISCORD_CLIENT_SECRET")),
    pterodactyl: !!(env("PTERO_URL") && env("PTERO_APPLICATION_API_KEY")),
    pteroLiveUsage: !!env("PTERO_CLIENT_API_KEY"),
    razorpay: !!(env("RAZORPAY_KEY_ID") && env("RAZORPAY_KEY_SECRET")),
  };
}

export type Mode = "live" | "demo";

/** Live only when database, Discord and Pterodactyl are all connected; otherwise a self-contained demo. */
export function getMode(): Mode {
  const i = integrations();
  return i.database && i.discord && i.pterodactyl ? "live" : "demo";
}

export function panelUrl(): string {
  return (env("PTERO_URL") ?? "https://game.panel.sparrowx.net").replace(/\/+$/, "");
}

export { env };
