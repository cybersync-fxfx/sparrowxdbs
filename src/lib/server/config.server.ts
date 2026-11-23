import crypto from "node:crypto";

// Server-only environment helpers. Read process.env inside functions (per-request injection).
const env = (k: string) => {
  const v = process.env[k];
  return v && v.trim() ? v.trim() : undefined;
};

let ephemeralSessionSecret: string | null = null;

export function googleOAuthCredentials(): { clientId: string; clientSecret: string } {
  const clientId = env("GOOGLE_CLIENT_ID") ?? "";
  const clientSecret = env("GOOGLE_CLIENT_SECRET") ?? "";
  return { clientId, clientSecret };
}

export function resolveCanonicalGoogleRedirectUri(origin: string): string {
  const explicit = env("GOOGLE_REDIRECT_URI");
  if (explicit) return explicit;
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    if (host === "sparrowx.net" || host.endsWith(".sparrowx.net")) {
      return "https://sparrowx.net/api/auth/google/callback";
    }
  } catch {
    // ignore URL parse error
  }
  return `${origin.replace(/\/+$/, "")}/api/auth/google/callback`;
}

export function integrations() {
  const googleCreds = googleOAuthCredentials();
  return {
    database: !!(env("POSTGREST_URL") || env("POSTGREST_INTERNAL_URL") || env("SPARROWX_DB_REST_URL")),
    google: !!(googleCreds.clientId && googleCreds.clientSecret),
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
  if (s && s.length >= 32) return s;
  if (!ephemeralSessionSecret) {
    ephemeralSessionSecret = crypto.randomBytes(32).toString("hex");
  }
  return ephemeralSessionSecret;
}

export { env };
