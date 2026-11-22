import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { SparrowxLegalCenter } from "@/components/SparrowxLegalCenter";
import { SparrowxFooter } from "@/components/SparrowxFooter";

describe("SparrowX Legal Center, Terms of Service & Refund Policy", () => {
  it("renders Master Terms of Service with SLA and acceptable use policy", () => {
    render(<SparrowxLegalCenter initialTab="terms" />);

    expect(
      screen.getByRole("heading", { name: /Terms of Service & Refund Policy/i })
    ).toBeDefined();
    expect(
      screen.getByText(/Master Services Agreement \(MSA\)/i)
    ).toBeDefined();
    expect(
      screen.getByText(/Acceptable Use Policy \(AUP\) & Strict Prohibitions/i)
    ).toBeDefined();
    expect(
      screen.getByText(/Service Level Agreement \(SLA\) & Uptime Guarantee/i)
    ).toBeDefined();
  });

  it("renders Strict Refund Policy with explicit no-refund-once-deployed clause", () => {
    render(<SparrowxLegalCenter initialTab="refund" />);

    expect(
      screen.getByText(/Once a server or service is deployed to your account, there is strictly NO REFUND/i)
    ).toBeDefined();
    expect(
      screen.getByText(/Dedicated Silicon Allocation/i)
    ).toBeDefined();
    expect(
      screen.getByText(/Dedicated IPv4\/IPv6 Subnet Leasing/i)
    ).toBeDefined();
    expect(
      screen.getByText(/Pre-Deployment Automated Provisioning Failure/i)
    ).toBeDefined();
  });

  it("renders Data Security Guarantee assuring customer data is secured and sovereign", () => {
    render(<SparrowxLegalCenter initialTab="security" />);

    expect(
      screen.getByText(/Your data is completely sovereign, encrypted, and isolated\. Don't worry about anything\./i)
    ).toBeDefined();
    expect(
      screen.getByText(/Zero-Knowledge Client Encryption/i)
    ).toBeDefined();
    expect(
      screen.getByText(/Zero Third-Party Data Brokers/i)
    ).toBeDefined();
    expect(
      screen.getByText(/Encrypted PostgreSQL at Rest & Transit/i)
    ).toBeDefined();
  });

  it("switches tabs interactively between Terms, Refund, Security, and Services", () => {
    render(<SparrowxLegalCenter initialTab="terms" />);

    const refundBtn = screen.getByRole("button", { name: /Refund Policy \(Strict No-Refund\)/i });
    fireEvent.click(refundBtn);
    expect(
      screen.getByText(/Strict Hardware & Provisioning Refund Policy/i)
    ).toBeDefined();

    const secBtn = screen.getByRole("button", { name: /Data Security Guarantee/i });
    fireEvent.click(secBtn);
    expect(
      screen.getByText(/Enterprise Data Sovereignty & Privacy Guarantee/i)
    ).toBeDefined();

    const srvBtn = screen.getByRole("button", { name: /Service-Specific Appendices/i });
    fireEvent.click(srvBtn);
    expect(
      screen.getByText(/Cloud VPS & Dedicated VDS Appendix/i)
    ).toBeDefined();
  });

  it("renders valid Terms of Service, Refund Policy, and Data Security links in SparrowxFooter", () => {
    render(<SparrowxFooter />);

    const termsLink = screen.getByRole("link", { name: /^Terms of Service$/i });
    expect(termsLink.getAttribute("href")).toBe("/terms");

    const refundLink = screen.getByRole("link", { name: /^Refund Policy$/i });
    expect(refundLink.getAttribute("href")).toBe("/refund");

    const secLink = screen.getByRole("link", { name: /^Data Security$/i });
    expect(secLink.getAttribute("href")).toBe("/security");
  });
});
