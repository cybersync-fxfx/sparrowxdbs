import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ServiceOnboardingWizard } from "@/components/ServiceOnboardingWizard";

describe("ServiceOnboardingWizard Contextual Setup Flow", () => {
  it("renders Step 1 with four isolated asset categories", () => {
    render(
      <ServiceOnboardingWizard
        onClose={vi.fn()}
        onComplete={vi.fn()}
        showToast={vi.fn()}
      />
    );

    expect(screen.getByText("Step 1 · What kind of asset are you securing?")).toBeDefined();
    expect(screen.getByText("Public Website & Web App")).toBeDefined();
    expect(screen.getByText("REST / GraphQL API Gateway")).toBeDefined();
    expect(screen.getByText("AI Agent & LLM Application")).toBeDefined();
    expect(screen.getByText("Sovereign PostgreSQL Database")).toBeDefined();
  });

  it("strictly isolates AI Agent options without showing web WAF or DNS garbage", async () => {
    const handleComplete = vi.fn();

    render(
      <ServiceOnboardingWizard
        onClose={vi.fn()}
        onComplete={handleComplete}
        showToast={vi.fn()}
        initialAssetType="ai_agent"
      />
    );

    // Step 1: Click Continue
    const continueBtn = screen.getByText("Continue to Service Details");
    fireEvent.click(continueBtn);

    // Step 2: Fill in AI Agent details
    expect(screen.getByText("Step 2 · Enter Service Location & Metadata")).toBeDefined();
    expect(screen.getByText("Primary LLM Model / Provider")).toBeDefined();

    const nameInput = screen.getByPlaceholderText("e.g. Customer Support AI Agent");
    fireEvent.change(nameInput, { target: { value: "Support LLM Bot" } });

    const domainInput = screen.getByPlaceholderText("agent://support-bot");
    fireEvent.change(domainInput, { target: { value: "agent://support-prod" } });

    fireEvent.click(screen.getByText("Continue to Security Profile"));

    // Step 3: Strictly isolated AI Guardrails (no OWASP WAF or DNS CNAME)
    expect(screen.getByText("Step 3 · Configure Security Profile")).toBeDefined();
    expect(screen.getByText("Prompt Injection & Jailbreak Guard")).toBeDefined();
    expect(screen.getByText("In-Flight PII Redaction & Secret Scrubber")).toBeDefined();
    expect(screen.getByText("Autonomous MCP Tool Call Firewall")).toBeDefined();
    expect(screen.queryByText("OWASP Top 10 WAF Inspection")).toBeNull();

    fireEvent.click(screen.getByText("View Connection & DNS Instructions"));

    // Step 4: Shows AI Guardrail Code & Live Prompt Sandbox (No DNS CNAME table)
    expect(screen.getByText("Step 4 · Connect Your Service to SparrowX")).toBeDefined();
    expect(screen.getByText("Live Prompt Guardrail Verification Sandbox")).toBeDefined();
    expect(screen.queryByText("DNS CNAME Configuration (Zero Code Changes)")).toBeNull();

    // Complete setup
    fireEvent.click(screen.getByText("Complete Setup & Activate Service"));
    expect(handleComplete).toHaveBeenCalledTimes(1);
    expect(handleComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Support LLM Bot",
        domain: "agent://support-prod",
        assetType: "ai_agent",
        enabledModules: expect.arrayContaining(["ai_agent_shield"]),
      })
    );
  });

  it("strictly isolates Website options with DNS CNAME and without AI prompt guardrails", async () => {
    const handleComplete = vi.fn();

    render(
      <ServiceOnboardingWizard
        onClose={vi.fn()}
        onComplete={handleComplete}
        showToast={vi.fn()}
        initialAssetType="website"
      />
    );

    // Step 1 -> Step 2
    fireEvent.click(screen.getByText("Continue to Service Details"));

    const nameInput = screen.getByPlaceholderText("e.g. Production Storefront API");
    fireEvent.change(nameInput, { target: { value: "Production Store" } });

    const domainInput = screen.getByPlaceholderText("app.yourdomain.com");
    fireEvent.change(domainInput, { target: { value: "store.company.com" } });

    // Step 2 -> Step 3
    fireEvent.click(screen.getByText("Continue to Security Profile"));

    // Step 3: Web WAF only
    expect(screen.getByText("OWASP Top 10 WAF Inspection")).toBeDefined();
    expect(screen.getByText("DDoS Mitigation & Rate Limiter")).toBeDefined();
    expect(screen.queryByText("Prompt Injection & Jailbreak Guard")).toBeNull();

    // Step 3 -> Step 4
    fireEvent.click(screen.getByText("View Connection & DNS Instructions"));

    // Step 4: Shows DNS CNAME table with proxy.sparrowx.net (No AI prompt sandbox)
    expect(screen.getByText("DNS CNAME Configuration (Zero Code Changes)")).toBeDefined();
    expect(screen.getByText("proxy.sparrowx.net")).toBeDefined();
    expect(screen.getByText("Verify DNS Propagation")).toBeDefined();
    expect(screen.queryByText("Live Prompt Guardrail Verification Sandbox")).toBeNull();
  });
});
