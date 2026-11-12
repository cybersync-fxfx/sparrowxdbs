// Contact inquiry validation, rate limiting and request handling.
// Pure and dependency-injected so it runs on both the Cloudflare/Nitro and OVH Node paths.

export const CONTACT_TOPICS = [
  "Custom PostgreSQL Cluster & High Availability",
  "Dedicated Shield Anycast IP Cloaking & DDoS Defense",
  "Cloud Compute VPS Custom Hardware Configuration",
  "Bug Bounty / Security Disclosure",
  "General Developer Feedback or Question",
] as const;

export interface ContactInquiryInput {
  name: string;
  email: string;
  topic: string;
  message: string;
}

export interface ContactInquiryRecord extends ContactInquiryInput {
  id: string;
  status: "new";
  ip_hash: string;
  created_at: string;
}

export type ValidationResult =
  { ok: true; value: ContactInquiryInput } | { ok: false; errors: Record<string, string> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateContactPayload(raw: unknown): ValidationResult {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(body.name);
  const email = str(body.email).toLowerCase();
  const topic = str(body.topic);
  const message = str(body.message);
  const errors: Record<string, string> = {};

  if (name.length < 2 || name.length > 80) errors.name = "Name must be 2-80 characters.";
  if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (!(CONTACT_TOPICS as readonly string[]).includes(topic))
    errors.topic = "Choose a valid topic.";
  if (message.length < 10 || message.length > 4000)
    errors.message = "Message must be 10-4000 characters.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, email, topic, message } };
}

export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return {
    /** Returns retry-after seconds if blocked, otherwise 0 and records the hit. */
    check(key: string): number {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((ts) => t - ts < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return Math.max(1, Math.ceil((windowMs - (t - (recent[0] ?? t))) / 1000));
      }
      recent.push(t);
      hits.set(key, recent);
      if (hits.size > 5000) {
        for (const [k, v] of hits) if (v.every((ts) => t - ts >= windowMs)) hits.delete(k);
      }
      return 0;
    },
  };
}

export async function hashIp(ip: string, salt = "sparrowx-contact"): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(status: number, body: unknown, headers: Record<string, string>, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers, ...extra },
  });
}

export interface ContactDeps {
  persist: (record: ContactInquiryRecord) => Promise<void>;
  limiter: ReturnType<typeof createRateLimiter>;
  corsHeaders: Record<string, string>;
  now?: () => Date;
}

export async function handleContactRequest(request: Request, deps: ContactDeps): Promise<Response> {
  const { persist, limiter, corsHeaders } = deps;
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed. Use POST." }, corsHeaders, { Allow: "POST" });
  }

  const ip =
    ((request.headers.get("cf-connecting-ip") ||
      (request.headers.get("x-forwarded-for") || "").split(",")[0]?.trim()) ??
      "") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const retryAfter = limiter.check(ip);
  if (retryAfter > 0) {
    return json(429, { error: "Too many requests. Please try again later." }, corsHeaders, {
      "Retry-After": String(retryAfter),
    });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json(400, { error: "Invalid JSON body." }, corsHeaders);
  }

  // Honeypot: bots fill hidden fields. Pretend success without storing.
  if (raw && typeof raw === "object" && (raw as Record<string, unknown>).website) {
    return json(201, { ok: true, ticketId: "SPX-INQ-000000" }, corsHeaders);
  }

  const result = validateContactPayload(raw);
  if (!result.ok) {
    return json(422, { error: "Validation failed.", fields: result.errors }, corsHeaders);
  }

  const createdAt = (deps.now ? deps.now() : new Date()).toISOString();
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  const record: ContactInquiryRecord = {
    id: `SPX-INQ-${suffix}`,
    ...result.value,
    status: "new",
    ip_hash: await hashIp(ip),
    created_at: createdAt,
  };

  try {
    await persist(record);
  } catch (err) {
    console.error("[contact] persist failed", err);
    return json(
      503,
      { error: "Could not save your message. Please email founder@sparrowx.net." },
      corsHeaders,
    );
  }
  return json(201, { ok: true, ticketId: record.id }, corsHeaders);
}
