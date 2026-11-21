// Server-only environment helpers. Read process.env inside functions (per-request injection).
const env = (k: string) => {
  const v = process.env[k];
  return v && v.trim() ? v.trim() : undefined;
};

export function integrations() {
  return {
    database: !!(env("POSTGREST_URL") || env("POSTGREST_INTERNAL_URL") || env("SPARROWX_DB_REST_URL")),
    google: !!(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET")),
    pterodactyl: !!(env("PTERO_URL") && env("PTERO_APPLICATION_API_KEY")),
    pteroLiveUsage: !!env("PTERO_CLIENT_API_KEY"),
    razorpay: !!(env("RAZORPAY_KEY_ID") && env("RAZORPAY_KEY_SECRET")),
  };
}

export type Mode = "live";

/** Production-only mode: zero mock or simulated demo data. */
export function getMode(): Mode {
  return "live";
}

export function panelUrl(): string {
  return (env("PTERO_URL") ?? "https://game.panel.sparrowx.net").replace(/\/+$/, "");
}

export function sessionSecret(): string {
  const s = env("SESSION_SECRET");
  return s && s.length >= 32 ? s : "sparrowx-game-portal-session-secret-key-2026";
}

export { env };
