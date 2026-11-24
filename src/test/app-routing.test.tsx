import React from "react";
import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { SparrowxFooter } from "@/components/SparrowxFooter";
import {
  buildMasterHref,
  isProductSubdomain,
  matchProductSubdomain,
  resolveRootRedirectTarget,
} from "@/lib/routing";

afterEach(() => {
  cleanup();
});

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches every public website and dashboard route instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const expectedPaths = [
      "/",
      "/db",
      "/drop",
      "/keys",
      "/shield",
      "/gateway",
      "/story",
      "/docs/errors",
      "/errors",
      "/f",
      "/f/sample-file-123",
      "/game",
      "/game/dashboard",
      "/game/panel-launch",
    ];

    for (const path of expectedPaths) {
      const matches = router.matchRoutes(path);
      const leaf = matches.at(-1);
      expect(leaf, `expected match for ${path}`).toBeDefined();
      expect(leaf?.routeId, `route ${path} fell back to root`).not.toBe(rootRouteId);
      expect(leaf?.status).not.toBe("notFound");
    }

    // Verify unknown path does not spuriously match a valid leaf route
    const unknownMatches = router.matchRoutes("/nonexistent-sparrowx-route-xyz");
    const lastUnknown = unknownMatches.at(-1);
    expect(
      unknownMatches.length <= 1 || lastUnknown?.routeId === rootRouteId,
    ).toBe(true);
  });

  it("maps product subdomains accurately without shadowing multi-label game hosts", () => {
    expect(matchProductSubdomain("db.sparrowx.net")?.route).toBe("/db");
    expect(matchProductSubdomain("studio.sparrowx.net")?.route).toBe("/db");
    expect(matchProductSubdomain("supabase.sparrowx.net")?.route).toBe("/db");
    expect(matchProductSubdomain("sparrowbase.sparrowx.net")?.route).toBe("/db");
    expect(matchProductSubdomain("sec.sparrowx.net")?.route).toBe("/shield");
    expect(matchProductSubdomain("shield.sparrowx.net")?.route).toBe("/shield");
    expect(matchProductSubdomain("file.sparrowx.net")?.route).toBe("/drop");
    expect(matchProductSubdomain("drop.sparrowx.net")?.route).toBe("/drop");
    expect(matchProductSubdomain("share.sparrowx.net")?.route).toBe("/drop");
    expect(matchProductSubdomain("password.sparrowx.net")?.route).toBe("/keys");
    expect(matchProductSubdomain("passwd.sparrowx.net")?.route).toBe("/keys");
    expect(matchProductSubdomain("pass.sparrowx.net")?.route).toBe("/keys");
    expect(matchProductSubdomain("keys.sparrowx.net")?.route).toBe("/keys");
    expect(matchProductSubdomain("api.sparrowx.net")?.route).toBe("/gateway");
    expect(matchProductSubdomain("rest.sparrowx.net")?.route).toBe("/gateway");
    expect(matchProductSubdomain("game.sparrowx.net")?.route).toBe("/game");
    expect(matchProductSubdomain("game-web.sparrowx.net")?.route).toBe("/game");
    expect(matchProductSubdomain("game.dash.sparrowx.net")?.route).toBe("/game/dashboard");
    expect(matchProductSubdomain("game-dash.sparrowx.net")?.route).toBe("/game/dashboard");
    expect(matchProductSubdomain("infra.sparrowx.net")?.route).toBe("/infra");
    expect(matchProductSubdomain("deploy.sparrowx.net")?.route).toBe("/deploy");
    expect(matchProductSubdomain("ai.sparrowx.net")?.route).toBe("/ai");
    expect(matchProductSubdomain("agents.sparrowx.net")?.route).toBe("/agents");
    expect(matchProductSubdomain("dpdp.sparrowx.net")?.route).toBe("/dpdp");
    expect(matchProductSubdomain("game.panel.sparrowx.net")?.route).toBeNull();
    expect(matchProductSubdomain("gamesec.sparrowx.net")).toBeNull();

    expect(isProductSubdomain("sparrowx.net")).toBe(false);
    expect(isProductSubdomain("www.sparrowx.net")).toBe(false);
    expect(isProductSubdomain("localhost")).toBe(false);
  });

  it("preserves ephemeral drop IDs, file IDs, game params, and fragments on root redirects", () => {
    expect(
      resolveRootRedirectTarget({
        hostname: "file.sparrowx.net",
        search: { drop: "spx_drop_abc123" },
        hash: "#key=deadbeef&name=report.pdf",
      }),
    ).toEqual({
      to: "/drop",
      search: { drop: "spx_drop_abc123" },
      hash: "key=deadbeef&name=report.pdf",
    });

    // Pure shortcut flag ?drop=1 must not be treated as an incoming dropId
    expect(
      resolveRootRedirectTarget({
        hostname: "sparrowx.net",
        search: { drop: "1" },
        hash: "",
      }),
    ).toEqual({
      to: "/drop",
      search: {},
    });

    // Direct persistent file query param (?f=...)
    expect(
      resolveRootRedirectTarget({
        hostname: "sparrowx.net",
        search: { f: "file_987" },
        hash: "",
      }),
    ).toEqual({
      to: "/drop",
      search: { f: "file_987" },
    });

    // Hash-only key link on root domain
    expect(
      resolveRootRedirectTarget({
        hostname: "sparrowx.net",
        search: {},
        hash: "#key=cafe1234",
      }),
    ).toEqual({
      to: "/drop",
      search: {},
      hash: "key=cafe1234",
    });

    // Game subdomain preserves ?service= and ?auth_error=
    expect(
      resolveRootRedirectTarget({
        hostname: "game.sparrowx.net",
        search: { service: "fivem", auth_error: "Please log in" },
      }),
    ).toEqual({
      to: "/game",
      search: { service: "fivem", auth_error: "Please log in" },
    });

    // API query shortcut routes to /gateway
    expect(
      resolveRootRedirectTarget({
        hostname: "sparrowx.net",
        search: { api: "1" },
      }),
    ).toEqual({
      to: "/gateway",
      search: {},
    });

    // Root domain with no shortcuts stays on /
    expect(
      resolveRootRedirectTarget({
        hostname: "sparrowx.net",
        search: {},
        hash: "",
      }),
    ).toBeNull();
  });

  it("resolves master-domain links out of product subdomains cleanly", () => {
    expect(
      buildMasterHref("/#vps", { hostname: "sec.sparrowx.net", protocol: "https:", port: "" }),
    ).toBe("https://sparrowx.net/#vps");
    expect(
      buildMasterHref("/", { hostname: "game.dash.sparrowx.net", protocol: "https:", port: "" }),
    ).toBe("https://sparrowx.net/");
    expect(
      buildMasterHref("/#vps", { hostname: "sparrowx.net", protocol: "https:", port: "" }),
    ).toBe("/#vps");
    expect(
      buildMasterHref("/#vps", { hostname: "localhost", protocol: "http:", port: "3000" }),
    ).toBe("/#vps");
  });

  it("renders valid routes in SparrowxFooter without broken /errors or /db-for-api links", () => {
    render(<SparrowxFooter />);

    const errorRefLink = screen.getByRole("link", { name: /Error Reference/i });
    expect(errorRefLink.getAttribute("href")).toBe("/docs/errors");

    const dbLink = screen.getByRole("link", { name: /Cloud Database/i });
    expect(dbLink.getAttribute("href")).toBe("https://db.sparrowx.net");

    const gameLink = screen.getByRole("link", { name: /Game Hosting/i });
    expect(gameLink.getAttribute("href")).toBe("https://game.sparrowx.net");

    const aiLink = screen.getByRole("link", { name: /AI & Agentics/i });
    expect(aiLink.getAttribute("href")).toBe("https://ai.sparrowx.net");

    const deployLink = screen.getByRole("link", { name: /Deploy PaaS/i });
    expect(deployLink.getAttribute("href")).toBe("https://deploy.sparrowx.net");

    const allHrefs = screen
      .getAllByRole("link")
      .map((el) => el.getAttribute("href"))
      .filter(Boolean);
    expect(allHrefs).not.toContain("/errors");
    expect(allHrefs).not.toContain("/game/dashboard");
    expect(allHrefs).not.toContain("https://game.panel.sparrowx.net");
    expect(allHrefs).not.toContain("https://gamesec.sparrowx.net");
    expect(allHrefs).not.toContain("https://php.sparrowx.net");
  });
});
