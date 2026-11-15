import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { hashSecretPassword, verifyPasswordMatch } from "../lib/password-digest";
import {
  MASTER_SSO_COOKIE_NAME,
  buildMasterSsoCookieHeader,
  createMasterSsoToken,
  readMasterSsoFromRequest,
  verifyMasterSsoToken,
} from "../lib/server/master-sso.server";
import { authorizeDbRequest } from "../lib/server/db-auth.server";

describe("SparrowX Master SSO & Developer Database Connection Bridge", () => {
  const prevSecret = process.env.SPARROWX_MASTER_SSO_SECRET;
  const prevStrict = process.env.SPARROWX_STRICT_DB_AUTH;

  beforeEach(() => {
    process.env.SPARROWX_MASTER_SSO_SECRET = "spx_test_master_sso_secret_2026_deterministic";
    process.env.SPARROWX_STRICT_DB_AUTH = "true";
  });

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.SPARROWX_MASTER_SSO_SECRET;
    else process.env.SPARROWX_MASTER_SSO_SECRET = prevSecret;

    if (prevStrict === undefined) delete process.env.SPARROWX_STRICT_DB_AUTH;
    else process.env.SPARROWX_STRICT_DB_AUTH = prevStrict;
  });

  it("hashes and verifies Master Portal password digests consistently", () => {
    const digest = hashSecretPassword("SovereignPass!2026");
    expect(digest.startsWith("spx_digest$")).toBe(true);
    expect(verifyPasswordMatch("SovereignPass!2026", digest)).toBe(true);
    expect(verifyPasswordMatch("WrongPassword!2026", digest)).toBe(false);
  });

  it("signs and verifies HMAC-SHA256 Master SSO tokens and rejects tampering or expiry", async () => {
    const token = await createMasterSsoToken(
      {
        id: "usr_dev_01",
        email: "DevOps@SparrowX.Net",
        fullName: "DevOps Lead",
        role: "admin",
        tenantId: "ten_alpha_01",
      },
      600,
    );

    const claims = await verifyMasterSsoToken(token);
    expect(claims).not.toBeNull();
    expect(claims?.sub).toBe("usr_dev_01");
    expect(claims?.email).toBe("devops@sparrowx.net");
    expect(claims?.role).toBe("admin");
    expect(claims?.tenantId).toBe("ten_alpha_01");

    const tampered = `${token.slice(0, -4)}0000`;
    expect(await verifyMasterSsoToken(tampered)).toBeNull();

    const expired = await createMasterSsoToken(
      {
        id: "usr_dev_01",
        email: "devops@sparrowx.net",
        fullName: "DevOps Lead",
        role: "client",
        tenantId: null,
      },
      -10,
    );
    expect(await verifyMasterSsoToken(expired)).toBeNull();
  });

  it("scopes sso cookies to .sparrowx.net in production and omits Domain on localhost", async () => {
    const token = await createMasterSsoToken({
      id: "usr_dev_02",
      email: "builder@sparrowx.net",
      fullName: "Builder",
      role: "client",
      tenantId: "ten_builder_02",
    });

    const prodRequest = new Request("https://sparrowx.net/api/auth/master-sso", {
      headers: {
        "x-forwarded-host": "sparrowx.net",
        "x-forwarded-proto": "https",
      },
    });
    const prodCookie = buildMasterSsoCookieHeader(prodRequest, token);
    expect(prodCookie).toContain(`${MASTER_SSO_COOKIE_NAME}=`);
    expect(prodCookie).toContain("Domain=.sparrowx.net");
    expect(prodCookie).toContain("HttpOnly");
    expect(prodCookie).toContain("SameSite=Lax");
    expect(prodCookie).toContain("Secure");

    const localRequest = new Request("http://localhost:3000/api/auth/master-sso", {
      headers: { host: "localhost:3000" },
    });
    const localCookie = buildMasterSsoCookieHeader(localRequest, token);
    expect(localCookie).not.toContain("Domain=");
    expect(localCookie).not.toContain("Secure");
  });

  it("reads Master SSO from Cookie or header and authorizes Developer Database requests even under strict auth", async () => {
    const token = await createMasterSsoToken({
      id: "usr_dev_03",
      email: "owner@sparrowx.net",
      fullName: "Owner",
      role: "client",
      tenantId: "ten_owner_03",
    });

    const unauthReq = new Request("https://sparrowx.net/api/db/summary");
    const unauthCtx = await authorizeDbRequest(unauthReq);
    expect(unauthCtx.authorized).toBe(false);

    const cookieReq = new Request("https://sparrowx.net/api/db/summary", {
      headers: {
        cookie: `${MASTER_SSO_COOKIE_NAME}=${encodeURIComponent(token)}`,
      },
    });
    const parsedFromCookie = await readMasterSsoFromRequest(cookieReq);
    expect(parsedFromCookie?.tenantId).toBe("ten_owner_03");

    const authCtx = await authorizeDbRequest(cookieReq);
    expect(authCtx.authorized).toBe(true);
    expect(authCtx.actorEmail).toBe("owner@sparrowx.net");
    expect(authCtx.tenantId).toBe("ten_owner_03");
    expect(authCtx.isAdmin).toBe(false);
  });
});
