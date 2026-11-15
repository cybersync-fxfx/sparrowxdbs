import { describe, expect, it } from "vitest";
import { redirect302, resolveRequestOrigin, sanitizeRelativePath } from "@/lib/server/http.server";
import { createPteroSsoToken, verifyPteroSsoToken } from "@/lib/server/ptero-sso.server";

describe("game portal auth redirect & Pterodactyl SSO helpers", () => {
  it("redirect302 creates mutable headers compatible with H3 session Set-Cookie merging", () => {
    const res = redirect302("https://game.sparrowx.net/game/dashboard?deploy=mc-pro");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://game.sparrowx.net/game/dashboard?deploy=mc-pro");
    expect(res.headers.get("cache-control")).toBe("no-store");

    expect(() => {
      res.headers.append("Set-Cookie", "sparrowx_session=test123; Path=/; HttpOnly; Domain=.sparrowx.net");
    }).not.toThrow();
    expect(res.headers.get("set-cookie")).toContain("sparrowx_session=test123");
  });

  it("resolveRequestOrigin honors reverse-proxy headers and blocks malformed hosts", () => {
    const proxied = new Request("http://127.0.0.1:3000/api/public/auth/discord/login", {
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "game.sparrowx.net",
      },
    });
    expect(resolveRequestOrigin(proxied)).toBe("https://game.sparrowx.net");

    const invalidHost = new Request("https://sparrowx.net/api/public/auth/discord/login", {
      headers: {
        "x-forwarded-host": "evil.com/phish",
      },
    });
    expect(resolveRequestOrigin(invalidHost)).toBe("https://sparrowx.net");
  });

  it("sanitizeRelativePath blocks protocol-relative and external open redirects", () => {
    expect(sanitizeRelativePath("/game/dashboard?deploy=mc-starter", "/")).toBe("/game/dashboard?deploy=mc-starter");
    expect(sanitizeRelativePath("//evil.com/steal", "/game/dashboard")).toBe("/game/dashboard");
    expect(sanitizeRelativePath("https://evil.com", "/game/dashboard")).toBe("/game/dashboard");
    expect(sanitizeRelativePath("/\\evil.com", "/game/dashboard")).toBe("/game/dashboard");
  });

  it("createPteroSsoToken and verifyPteroSsoToken sign, validate, and reject tampering", () => {
    const secret = "sparrowx-test-sso-secret-key-2026";
    const token = createPteroSsoToken(
      {
        userId: 42,
        email: "player@yourdomain.com",
        username: "player42",
        nextPath: "/server/ab12cd34",
      },
      secret,
    );

    const decoded = verifyPteroSsoToken(token, secret);
    expect(decoded).not.toBeNull();
    expect(decoded?.uid).toBe(42);
    expect(decoded?.email).toBe("player@yourdomain.com");
    expect(decoded?.username).toBe("player42");
    expect(decoded?.next).toBe("/server/ab12cd34");

    // Wrong secret must fail
    expect(verifyPteroSsoToken(token, "wrong-secret-key-0000000000")).toBeNull();

    // Tampered token must fail
    const [payloadB64 = "", sigB64 = ""] = token.split(".");
    expect(payloadB64.length).toBeGreaterThan(10);
    const tamperedPayload = Buffer.from(
      JSON.stringify({ uid: 1, email: "admin@yourdomain.com", username: "admin", next: "/admin", iat: 9999999999, exp: 9999999999, nonce: "x" }),
      "utf8",
    ).toString("base64url");
    expect(verifyPteroSsoToken(`${tamperedPayload}.${sigB64}`, secret)).toBeNull();

    // Expired token signed with valid secret must still fail
    const expiredPayload = Buffer.from(
      JSON.stringify({
        uid: 42,
        email: "player@yourdomain.com",
        username: "player42",
        next: "/",
        iat: 1000,
        exp: 1060,
        nonce: "expired-nonce",
      }),
      "utf8",
    ).toString("base64url");
    expect(payloadB64.length).toBeGreaterThan(10);
    expect(verifyPteroSsoToken(`${expiredPayload}.${sigB64}`, secret)).toBeNull();

    // Unsafe redirect target inside token payload sanitizes to "/"
    const unsafeNextToken = createPteroSsoToken(
      { userId: 7, email: "u@yourdomain.com", username: "u7", nextPath: "//evil.com" },
      secret,
    );
    expect(verifyPteroSsoToken(unsafeNextToken, secret)?.next).toBe("/");
  });
});
