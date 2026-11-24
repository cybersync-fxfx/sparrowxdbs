import { describe, expect, it } from "vitest";
import {
  detectSubdomainContext,
  normalizeUserDomainInput,
  resolveAutoCorrectedDocSlug,
  resolveAutoCorrectedPath,
  resolveCanonicalSubdomainRedirect,
} from "@/lib/route-autocorrect";

describe("SparrowX subdomain-aware path & domain auto-correction", () => {
  it("preserves exact valid routes, API paths, and static assets untouched", () => {
    expect(resolveAutoCorrectedPath("/db", "db.sparrowx.net")).toBeNull();
    expect(resolveAutoCorrectedPath("/infra/dashboard", "infra.sparrowx.net")).toBeNull();
    expect(resolveAutoCorrectedPath("/docs/db", "db.sparrowx.net")).toBeNull();
    expect(resolveAutoCorrectedPath("/terms", "sparrowx.net")).toBeNull();
    expect(resolveAutoCorrectedPath("/refund", "sparrowx.net")).toBeNull();
    expect(resolveAutoCorrectedPath("/security", "sparrowx.net")).toBeNull();
    expect(resolveAutoCorrectedPath("/api/auth/google/login", "sparrowx.net")).toBeNull();
    expect(resolveAutoCorrectedPath("/assets/app-123.js", "sparrowx.net")).toBeNull();
    expect(resolveAutoCorrectedPath("/f/abc123", "file.sparrowx.net")).toBeNull();
  });

  it("respects the active service subdomain when auto-correcting mistyped paths", () => {
    // Cloud DB subdomain stays inside DB or DB docs
    expect(resolveAutoCorrectedPath("/doc", "db.sparrowx.net")).toBe("/docs/db");
    expect(resolveAutoCorrectedPath("/dashbord", "db.sparrowx.net")).toBe("/db");
    expect(resolveAutoCorrectedPath("/random-wrong-path", "db.sparrowx.net")).toBe("/db");

    // Cloud Infra subdomain routes dashboard typos to /infra/dashboard and docs to /docs/infra
    expect(resolveAutoCorrectedPath("/dashbord", "infra.sparrowx.net")).toBe("/infra/dashboard");
    expect(resolveAutoCorrectedPath("/doc", "infra.sparrowx.net")).toBe("/docs/infra");
    expect(resolveAutoCorrectedPath("/unknown-xyz", "infra.sparrowx.net")).toBe("/infra");

    // Game Hosting subdomain routes dashboard/panel/docs typos accurately
    expect(resolveAutoCorrectedPath("/dashbord", "game.sparrowx.net")).toBe("/game/dashboard");
    expect(resolveAutoCorrectedPath("/ptero", "game.sparrowx.net")).toBe("/game/panel-launch");
    expect(resolveAutoCorrectedPath("/documentation", "game.sparrowx.net")).toBe("/docs/game");
    expect(resolveAutoCorrectedPath("/unknown-xyz", "game.sparrowx.net")).toBe("/game");

    // Shield, Drop, Keys, API subdomains each respect their own home & docs
    expect(resolveAutoCorrectedPath("/doc", "sec.sparrowx.net")).toBe("/docs/shield");
    expect(resolveAutoCorrectedPath("/xyz", "sec.sparrowx.net")).toBe("/shield");
    expect(resolveAutoCorrectedPath("/doc", "file.sparrowx.net")).toBe("/docs/drop");
    expect(resolveAutoCorrectedPath("/xyz", "file.sparrowx.net")).toBe("/drop");
    expect(resolveAutoCorrectedPath("/doc", "password.sparrowx.net")).toBe("/docs/keys");
    expect(resolveAutoCorrectedPath("/xyz", "password.sparrowx.net")).toBe("/keys");
    expect(resolveAutoCorrectedPath("/doc", "api.sparrowx.net")).toBe("/docs/api");
    expect(resolveAutoCorrectedPath("/xyz", "api.sparrowx.net")).toBe("/gateway");
  });

  it("fuzzy-corrects common path & compound typos on root domain or localhost", () => {
    expect(resolveAutoCorrectedPath("/infar", "sparrowx.net")).toBe("/infra");
    expect(resolveAutoCorrectedPath("/infar/dashbord", "sparrowx.net")).toBe("/infra/dashboard");
    expect(resolveAutoCorrectedPath("/gmae/dashbaord", "127.0.0.1")).toBe("/game/dashboard");
    expect(resolveAutoCorrectedPath("/sheild", "sparrowx.net")).toBe("/shield");
    expect(resolveAutoCorrectedPath("/databse", "sparrowx.net")).toBe("/db");
    expect(resolveAutoCorrectedPath("/valut", "sparrowx.net")).toBe("/drop");
    expect(resolveAutoCorrectedPath("/docs/sheild", "sparrowx.net")).toBe("/docs/shield");
    expect(resolveAutoCorrectedPath("/docs/dbs", "sparrowx.net")).toBe("/docs/db");
    expect(resolveAutoCorrectedPath("/docs/erros", "sparrowx.net")).toBe("/docs/errors");
    expect(resolveAutoCorrectedPath("/stry", "sparrowx.net")).toBe("/story");
  });

  it("auto-corrects typoed SparrowX subdomains to their canonical hosts", () => {
    expect(detectSubdomainContext("dbs.sparrowx.net").canonicalHost).toBe("db.sparrowx.net");
    expect(detectSubdomainContext("infar.sparrowx.net").canonicalHost).toBe("infra.sparrowx.net");
    expect(detectSubdomainContext("sheild.sparrowx.net").canonicalHost).toBe("sec.sparrowx.net");

    expect(resolveCanonicalSubdomainRedirect("dbs.sparrowx.net", "/doc")).toBe(
      "https://db.sparrowx.net/docs/db",
    );
    expect(resolveCanonicalSubdomainRedirect("infar.sparrowx.net", "/dashbord")).toBe(
      "https://infra.sparrowx.net/infra/dashboard",
    );
    expect(resolveCanonicalSubdomainRedirect("docs.sparrowx.net", "/db")).toBe(
      "https://sparrowx.net/docs/db",
    );
    expect(resolveCanonicalSubdomainRedirect("db.sparrowx.net", "/db")).toBeNull();
  });

  it("auto-corrects typoed doc slugs and user-entered domain inputs cleanly", () => {
    expect(resolveAutoCorrectedDocSlug("ifra", "sparrowx.net")).toBe("infra");
    expect(resolveAutoCorrectedDocSlug("gmae", "sparrowx.net")).toBe("game");
    expect(resolveAutoCorrectedDocSlug("unknown-xyz", "file.sparrowx.net")).toBe("drop");

    expect(normalizeUserDomainInput("  https://https://db.sparrowx.ne/  ")).toBe("db.sparrowx.net");
    expect(normalizeUserDomainInput("https://example.cmo/path")).toBe("example.com");
  });
});
