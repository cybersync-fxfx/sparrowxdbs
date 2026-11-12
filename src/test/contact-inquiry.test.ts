import { describe, expect, it, vi } from "vitest";
import {
  CONTACT_TOPICS,
  createRateLimiter,
  handleContactRequest,
  validateContactPayload,
  type ContactInquiryRecord,
} from "@/lib/contact-inquiry";

const valid = {
  name: "Alex Rivera",
  email: "Alex@Acme.dev",
  topic: CONTACT_TOPICS[0],
  message: "We run three PostgreSQL nodes and want to migrate.",
};

function makeRequest(body: unknown, method = "POST", ip = "1.2.3.4") {
  return new Request("https://sparrowx.net/api/v1/contact", {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });
}

function deps(limit = 5) {
  const saved: ContactInquiryRecord[] = [];
  return {
    saved,
    d: {
      persist: vi.fn(async (r: ContactInquiryRecord) => void saved.push(r)),
      limiter: createRateLimiter(limit, 60_000),
      corsHeaders: {},
    },
  };
}

describe("validateContactPayload", () => {
  it("accepts and normalises valid input", () => {
    const r = validateContactPayload(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.email).toBe("alex@acme.dev");
  });

  it("reports field errors", () => {
    const r = validateContactPayload({ name: "A", email: "nope", topic: "x", message: "short" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["email", "message", "name", "topic"]);
  });
});

describe("handleContactRequest", () => {
  it("stores a valid inquiry and returns a ticket id", async () => {
    const { d, saved } = deps();
    const res = await handleContactRequest(makeRequest(valid), d);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ticketId).toMatch(/^SPX-INQ-[A-F0-9]{6}$/);
    expect(saved).toHaveLength(1);
    expect(saved[0].ip_hash).not.toContain("1.2.3.4");
  });

  it("rejects invalid input with 422", async () => {
    const { d, saved } = deps();
    const res = await handleContactRequest(makeRequest({ ...valid, email: "bad" }), d);
    expect(res.status).toBe(422);
    expect(saved).toHaveLength(0);
  });

  it("rejects malformed JSON with 400 and wrong method with 405", async () => {
    const { d } = deps();
    expect((await handleContactRequest(makeRequest("{oops"), d)).status).toBe(400);
    expect((await handleContactRequest(makeRequest(null, "GET"), d)).status).toBe(405);
  });

  it("silently drops honeypot submissions", async () => {
    const { d, saved } = deps();
    const res = await handleContactRequest(makeRequest({ ...valid, website: "http://spam" }), d);
    expect(res.status).toBe(201);
    expect(saved).toHaveLength(0);
  });

  it("rate limits per IP", async () => {
    const { d } = deps(2);
    await handleContactRequest(makeRequest(valid), d);
    await handleContactRequest(makeRequest(valid), d);
    const blocked = await handleContactRequest(makeRequest(valid), d);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    const other = await handleContactRequest(makeRequest(valid, "POST", "9.9.9.9"), d);
    expect(other.status).toBe(201);
  });

  it("returns 503 when persistence fails", async () => {
    const { d } = deps();
    d.persist.mockRejectedValueOnce(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handleContactRequest(makeRequest(valid), d);
    spy.mockRestore();
    expect(res.status).toBe(503);
  });
});
