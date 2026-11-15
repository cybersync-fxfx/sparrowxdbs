import { createHmac, timingSafeEqual } from "node:crypto";
import { env, panelUrl, sessionSecret } from "./config.server";
import { randomToken } from "./crypto.server";
import { sanitizeRelativePath } from "./http.server";

export type PteroSsoPayload = {
  uid: number;
  email: string;
  username: string;
  next: string;
  iat: number;
  exp: number;
  nonce: string;
};

export function pteroSsoSecret(): string | null {
  const configured = env("PTERO_SSO_SECRET");
  return configured && configured.length >= 16 ? configured : null;
}

export function createPteroSsoToken(
  input: { userId: number; email: string; username: string; nextPath?: string | null },
  secretOverride?: string,
): string {
  const secret = secretOverride ?? pteroSsoSecret() ?? sessionSecret();
  const now = Math.floor(Date.now() / 1000);
  const payload: PteroSsoPayload = {
    uid: input.userId,
    email: input.email,
    username: input.username,
    next: sanitizeRelativePath(input.nextPath, "/"),
    iat: now,
    exp: now + 120,
    nonce: randomToken(16),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyPteroSsoToken(token: string, secretOverride?: string): PteroSsoPayload | null {
  const secret = secretOverride ?? pteroSsoSecret() ?? sessionSecret();
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return null;
  const encoded = token.slice(0, dotIdx);
  const providedSig = token.slice(dotIdx + 1);
  if (!encoded || !providedSig) return null;

  const expectedSig = createHmac("sha256", secret).update(encoded).digest("base64url");
  const a = Buffer.from(providedSig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<PteroSsoPayload>;
    const now = Math.floor(Date.now() / 1000);
    if (
      typeof parsed.uid !== "number" ||
      parsed.uid <= 0 ||
      typeof parsed.email !== "string" ||
      typeof parsed.username !== "string" ||
      typeof parsed.exp !== "number" ||
      typeof parsed.iat !== "number" ||
      typeof parsed.nonce !== "string" ||
      parsed.exp < now ||
      parsed.iat > now + 30
    ) {
      return null;
    }
    return {
      uid: parsed.uid,
      email: parsed.email,
      username: parsed.username,
      next: sanitizeRelativePath(parsed.next, "/"),
      iat: parsed.iat,
      exp: parsed.exp,
      nonce: parsed.nonce,
    };
  } catch {
    return null;
  }
}

type ProbeCacheEntry = { ok: boolean; checkedAt: number };
const probeCache = new Map<string, ProbeCacheEntry>();
const PROBE_TTL_MS = 45_000;

export async function isPteroSsoReady(baseOverride?: string): Promise<boolean> {
  if (!pteroSsoSecret()) return false;
  const base = (baseOverride ?? panelUrl()).replace(/\/+$/, "");
  const cached = probeCache.get(base);
  if (cached && Date.now() - cached.checkedAt < PROBE_TTL_MS) {
    return cached.ok;
  }
  try {
    const res = await fetch(`${base}/sparrowx-sso.php?health=1`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });
    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok || !ct.includes("application/json")) {
      probeCache.set(base, { ok: false, checkedAt: Date.now() });
      return false;
    }
    const json = (await res.json()) as { ok?: boolean; sso?: string; configured?: boolean };
    const ready = json?.ok === true && json?.sso === "sparrowx" && json?.configured === true;
    probeCache.set(base, { ok: ready, checkedAt: Date.now() });
    return ready;
  } catch {
    probeCache.set(base, { ok: false, checkedAt: Date.now() });
    return false;
  }
}
