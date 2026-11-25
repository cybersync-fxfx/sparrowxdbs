import { describe, expect, it } from "vitest";
import {
  buildHostRobotsTxt,
  buildHostSitemapXml,
  buildRouteHeadFromProfile,
  resolveCanonicalSubdomainRedirect,
  resolveSeoProfileForHost,
  SEO_PROFILES,
} from "@/lib/seo-profiles";

describe("Zero-Collision Multi-Subdomain SEO Architecture", () => {
  it("maps every production subdomain to its dedicated isolated SEO profile", () => {
    expect(resolveSeoProfileForHost("sparrowx.net").key).toBe("master");
    expect(resolveSeoProfileForHost("www.sparrowx.net").key).toBe("master");
    expect(resolveSeoProfileForHost("sec.sparrowx.net").key).toBe("shield");
    expect(resolveSeoProfileForHost("db.sparrowx.net").key).toBe("db");
    expect(resolveSeoProfileForHost("file.sparrowx.net").key).toBe("drop");
    expect(resolveSeoProfileForHost("password.sparrowx.net").key).toBe("keys");
    expect(resolveSeoProfileForHost("infra.sparrowx.net").key).toBe("infra");
  });

  it("ensures every profile has a unique canonical URL and unique title", () => {
    const profiles = Object.values(SEO_PROFILES);
    const canonicals = new Set(profiles.map((p) => p.canonicalUrl));
    const titles = new Set(profiles.map((p) => p.title));
    expect(canonicals.size).toBe(profiles.length);
    expect(titles.size).toBe(profiles.length);
  });

  it("keeps sparrowx.net master brand-focused without colliding with product keywords", () => {
    const masterKeywords = SEO_PROFILES.master.keywords.toLowerCase();
    expect(masterKeywords).toContain("sparrowx");
    expect(masterKeywords).not.toContain("website security scanner");
    expect(masterKeywords).not.toContain("fivem");
    expect(masterKeywords).not.toContain("managed postgresql");
    expect(masterKeywords).not.toContain("offline password generator");
    expect(masterKeywords).not.toContain("encrypted file transfer");

    expect(SEO_PROFILES.shield.canonicalUrl).toBe("https://sec.sparrowx.net/");
    expect(SEO_PROFILES.shield.keywords.toLowerCase()).toContain("website security");
    expect(SEO_PROFILES.game.canonicalUrl).toBe("https://sparrowx.net/game");
    expect(SEO_PROFILES.game.keywords.toLowerCase()).toContain("game hosting");
  });

  it("generates single-host sitemaps with zero cross-subdomain or duplicate-path pollution", () => {
    const masterSitemap = buildHostSitemapXml("sparrowx.net");
    expect(masterSitemap).toContain("https://sparrowx.net/");
    expect(masterSitemap).toContain("https://sparrowx.net/game");
    expect(masterSitemap).not.toContain("https://sec.sparrowx.net/");
    expect(masterSitemap).not.toContain("https://db.sparrowx.net/");
    expect(masterSitemap).not.toContain("https://sparrowx.net/shield");
    expect(masterSitemap).not.toContain("https://sparrowx.net/db");
    expect(masterSitemap).not.toContain("https://game.sparrowx.net/");

    const shieldSitemap = buildHostSitemapXml("sec.sparrowx.net");
    expect(shieldSitemap).toContain("https://sec.sparrowx.net/");
    expect(shieldSitemap).not.toContain("https://sparrowx.net/");

    const dbSitemap = buildHostSitemapXml("db.sparrowx.net");
    expect(dbSitemap).toContain("https://db.sparrowx.net/");
    expect(dbSitemap).not.toContain("https://sparrowx.net/");
  });

  it("generates host-specific robots.txt blocking duplicate subdomain paths on sparrowx.net", () => {
    const masterRobots = buildHostRobotsTxt("sparrowx.net");
    expect(masterRobots).toContain("Disallow: /shield");
    expect(masterRobots).toContain("Disallow: /db");
    expect(masterRobots).toContain("Disallow: /drop");
    expect(masterRobots).toContain("Disallow: /keys");
    expect(masterRobots).toContain("Disallow: /infra");
    expect(masterRobots).toContain("Sitemap: https://sparrowx.net/sitemap.xml");

    const shieldRobots = buildHostRobotsTxt("sec.sparrowx.net");
    expect(shieldRobots).toContain("Sitemap: https://sec.sparrowx.net/sitemap.xml");
  });

  it("resolves HTTP 301 redirects for legacy path mirrors on sparrowx.net and www canonicalization", () => {
    expect(resolveCanonicalSubdomainRedirect("sparrowx.net", "/shield", "")).toBe(
      "https://sec.sparrowx.net/",
    );
    expect(resolveCanonicalSubdomainRedirect("sparrowx.net", "/db", "?tab=sql")).toBe(
      "https://db.sparrowx.net/?tab=sql",
    );
    expect(resolveCanonicalSubdomainRedirect("sparrowx.net", "/drop", "")).toBe(
      "https://file.sparrowx.net/",
    );
    expect(resolveCanonicalSubdomainRedirect("sparrowx.net", "/keys", "")).toBe(
      "https://password.sparrowx.net/",
    );
    expect(resolveCanonicalSubdomainRedirect("sparrowx.net", "/infra", "")).toBe(
      "https://infra.sparrowx.net/",
    );
    expect(resolveCanonicalSubdomainRedirect("sparrowx.net", "/infra/configure", "?plan=vps-1")).toBe(
      "https://infra.sparrowx.net/infra/configure?plan=vps-1",
    );
    expect(resolveCanonicalSubdomainRedirect("sparrowx.net", "/deploy", "")).toBe(
      "https://deploy.sparrowx.net/",
    );
    expect(resolveCanonicalSubdomainRedirect("sparrowx.net", "/ai", "")).toBe(
      "https://ai.sparrowx.net/",
    );
    expect(resolveCanonicalSubdomainRedirect("sparrowx.net", "/agents", "")).toBe(
      "https://agents.sparrowx.net/",
    );
    expect(resolveCanonicalSubdomainRedirect("sparrowx.net", "/dpdp", "")).toBe(
      "https://dpdp.sparrowx.net/",
    );
    expect(resolveCanonicalSubdomainRedirect("sparrowx.net", "/gateway", "")).toBe(
      "https://api.sparrowx.net/",
    );
    // Strict cross-subdomain leak protection
    expect(resolveCanonicalSubdomainRedirect("db.sparrowx.net", "/infra", "")).toBe(
      "https://infra.sparrowx.net/",
    );
    expect(resolveCanonicalSubdomainRedirect("sec.sparrowx.net", "/story", "")).toBe(
      "https://sparrowx.net/story",
    );
    expect(resolveCanonicalSubdomainRedirect("api.sparrowx.net", "/db", "")).toBe(
      "https://db.sparrowx.net/",
    );
    expect(resolveCanonicalSubdomainRedirect("infra.sparrowx.net", "/infra/configure", "")).toBeNull();
    expect(resolveCanonicalSubdomainRedirect("www.sparrowx.net", "/game", "")).toBe(
      "https://sparrowx.net/game",
    );
    expect(resolveCanonicalSubdomainRedirect("sec.sparrowx.net", "/", "")).toBeNull();
    expect(resolveCanonicalSubdomainRedirect("localhost", "/db", "")).toBeNull();
  });

  it("builds valid TanStack Router head objects with canonical and JSON-LD", () => {
    const head = buildRouteHeadFromProfile(SEO_PROFILES.shield);
    expect(head.links.find((l) => l.rel === "canonical")?.href).toBe("https://sec.sparrowx.net/");
    expect(head.scripts[0]?.type).toBe("application/ld+json");
    expect(head.scripts[0]?.children).toContain("SparrowX Shield");
  });
});
