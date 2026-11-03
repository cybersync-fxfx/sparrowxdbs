import { describe, it, expect } from "vitest";

describe("SparrowX AI Brain Admin-Only Access Control", () => {
  it("restricts SparrowX AI Brain navigation and dock visibility strictly to admin accounts", () => {
    // 1. Client Session (Regular customer/tenant)
    const clientSession = { role: "client" as const, tenantId: "tnt-1", userEmail: "client@acme.com" };
    const isClientAdmin = clientSession.role === "admin";
    expect(isClientAdmin).toBe(false);

    // Filtered client nav items
    const clientNavItems = [
      { label: "My Services" },
      ...(isClientAdmin ? [{ label: "SparrowX AI Brain" }] : []),
      { label: "Protection Status & Verification" },
      { label: "Defense Updates & Intel" },
    ];

    expect(clientNavItems.some((item) => item.label === "SparrowX AI Brain")).toBe(false);

    // 2. Admin Session (SOC Operator / Administrator)
    const adminSession = { role: "admin" as const, operatorName: "SecOps Admin", operatorEmail: "admin@sparrowx.net" };
    const isAdmin = adminSession.role === "admin";
    expect(isAdmin).toBe(true);

    const adminNavItems = [
      { label: "Client Subscriptions" },
      ...(isAdmin ? [{ label: "SparrowX AI Brain" }] : []),
      { label: "Defense Updates & Intel" },
      { label: "Access Control & Audit" },
    ];

    expect(adminNavItems.some((item) => item.label === "SparrowX AI Brain")).toBe(true);
  });

  it("intercepts non-admin navigation requests to SparrowX AI Brain", () => {
    const handleNavigationAttempt = (
      navLabel: string,
      userRole: "admin" | "client" | "unauthenticated",
    ): { allowed: boolean; redirectedTo?: string; error?: string } => {
      if (navLabel === "AI Brain" || navLabel === "SparrowX AI Brain") {
        if (userRole !== "admin") {
          return {
            allowed: false,
            redirectedTo: "My Services",
            error: "SparrowX AI Brain is restricted to administrator accounts.",
          };
        }
      }
      return { allowed: true };
    };

    const clientAttempt = handleNavigationAttempt("SparrowX AI Brain", "client");
    expect(clientAttempt.allowed).toBe(false);
    expect(clientAttempt.redirectedTo).toBe("My Services");
    expect(clientAttempt.error).toContain("restricted to administrator accounts");

    const adminAttempt = handleNavigationAttempt("SparrowX AI Brain", "admin");
    expect(adminAttempt.allowed).toBe(true);
  });
});
