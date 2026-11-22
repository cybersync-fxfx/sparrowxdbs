import React from "react";
import { renderToString } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/index";
import { SovereignDatabaseStudio } from "@/components/SovereignDatabaseStudio";
import { SparrowxShieldEngine } from "@/components/SparrowxShieldEngine";
import { SparrowxDropEngine } from "@/components/SparrowxDropEngine";
import { SparrowxKeysEngine } from "@/components/SparrowxKeysEngine";
import { SparrowxApiGatewayPortal } from "@/components/SparrowxApiGatewayPortal";
import { clearSessionToken, issueSignedSessionToken } from "@/lib/advanced-features";

describe("Test Full Index Rendering", () => {
  beforeAll(() => {
    // Provide a safe getContext stub so JSDOM doesn't throw on Three.js WebGLRenderer instantiation
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    cleanup();
    clearSessionToken();
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
    vi.restoreAllMocks();
  });

  it("renders Route component without crashing", () => {
    const Component = Route.options.component;
    if (!Component) throw new Error("No component");
    const { container } = render(React.createElement(Component));
    expect(container).toBeDefined();
  });

  it("renders SSR HTML cleanly via renderToString without window/browser storage mismatch", () => {
    const Component = Route.options.component;
    if (!Component) throw new Error("No component");

    const originalWindow = globalThis.window;
    let html = "";
    try {
      // Simulate server environment for SSR render pass
      vi.stubGlobal("window", undefined);
      html = renderToString(React.createElement(Component));
    } finally {
      vi.stubGlobal("window", originalWindow);
    }

    expect(html).toContain("SparrowX");
    expect(html.length).toBeGreaterThan(200);
  });

  it("opens Sign In modal safely on click and via ?login=1 without React hook errors (#310)", () => {
    const Component = Route.options.component;
    if (!Component) throw new Error("No component");

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // 1. Click "Sign In" from unauthenticated landing view
    render(React.createElement(Component));
    const signInButtons = screen.getAllByRole("button", { name: /sign in/i });
    const firstSignIn = signInButtons[0];
    if (!firstSignIn) throw new Error("Expected Sign In button");
    fireEvent.click(firstSignIn);
    expect(screen.getByText(/Access Developer Workspace/i)).toBeDefined();

    // Cancel modal cleanly
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);
    cleanup();

    // 2. Mount with ?login=1 query param (hydrated via mount useEffect into SOC & Operator Auth Portal)
    window.history.pushState({}, "", "/?login=1");
    render(React.createElement(Component));
    expect(screen.getByText(/SparrowX SOC & Operator Authentication Portal/i)).toBeDefined();

    // Switch back to master landing from portal without hook mismatch
    const returnBtn = screen.getByRole("button", { name: /Return to SparrowX Technologies Master Landing/i });
    fireEvent.click(returnBtn);
    expect(screen.getAllByRole("button", { name: /sign in/i }).length).toBeGreaterThan(0);

    const hookOrHydrationErrors = errorSpy.mock.calls.filter((args) => {
      const msg = args.map(String).join(" ");
      return /Rendered more hooks|error #310|Hydration|did not match/i.test(msg);
    });
    expect(hookOrHydrationErrors).toEqual([]);
  });

  it("transitions cleanly from unauthenticated initial mount to restored client/admin sessions without Error #310", () => {
    const Component = Route.options.component;
    if (!Component) throw new Error("No component");

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Returning client session already stored in localStorage/cookie before mount
    issueSignedSessionToken({
      id: "USR-310-CLIENT",
      email: "client@sparrowx.net",
      fullName: "Client Operator",
      role: "client",
      tenantId: "TNT-310",
    });

    const { container: clientContainer } = render(React.createElement(Component));
    expect(clientContainer).toBeDefined();
    cleanup();

    // Returning admin session already stored in localStorage/cookie before mount
    issueSignedSessionToken({
      id: "USR-310-ADMIN",
      email: "admin@sparrowx.net",
      fullName: "Admin Operator",
      role: "admin",
      tenantId: null,
    });

    const { container: adminContainer } = render(React.createElement(Component));
    expect(adminContainer).toBeDefined();

    const hookOrHydrationErrors = errorSpy.mock.calls.filter((args) => {
      const msg = args.map(String).join(" ");
      return /Rendered more hooks|error #310|Hydration|did not match/i.test(msg);
    });
    expect(hookOrHydrationErrors).toEqual([]);
  });

  it("renders all standalone product engines cleanly on SSR and authenticated client mount", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const engines: Array<{ name: string; element: React.ReactElement }> = [
      { name: "db", element: <SovereignDatabaseStudio isStandaloneDomain={true} /> },
      { name: "shield", element: <SparrowxShieldEngine /> },
      { name: "drop", element: <SparrowxDropEngine /> },
      { name: "keys", element: <SparrowxKeysEngine /> },
      { name: "gateway", element: <SparrowxApiGatewayPortal /> },
    ];

    // 1. SSR pass (window === undefined) must succeed with non-empty HTML
    const originalWindow = globalThis.window;
    try {
      vi.stubGlobal("window", undefined);
      for (const { name, element } of engines) {
        const ssrHtml = renderToString(element);
        expect(ssrHtml.length, `${name} SSR HTML`).toBeGreaterThan(100);
        expect(ssrHtml, `${name} SSR error screen`).not.toContain("Minified React error");
      }
    } finally {
      vi.stubGlobal("window", originalWindow);
    }

    // 2. Client mount with persisted signed session token must hydrate without hook/hydration errors
    issueSignedSessionToken({
      id: "USR-PROD-ALL",
      email: "dev@sparrowx.net",
      fullName: "Dev Operator",
      role: "client",
      tenantId: "TNT-ALL",
    });

    for (const { name, element } of engines) {
      const { container } = render(element);
      expect(container.innerHTML.length, `${name} client mount`).toBeGreaterThan(100);
      cleanup();
    }

    const hookOrHydrationErrors = errorSpy.mock.calls.filter((args) => {
      const msg = args.map(String).join(" ");
      return /Rendered more hooks|error #310|Hydration|did not match/i.test(msg);
    });
    expect(hookOrHydrationErrors).toEqual([]);
  });
});
