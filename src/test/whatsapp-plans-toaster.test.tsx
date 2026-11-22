import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WhatsAppPlansToaster } from "@/components/WhatsAppPlansToaster";
import { WHATSAPP_SUPPORT_DISPLAY } from "@/lib/whatsapp-support";

describe("WhatsAppPlansToaster", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("stays hidden until the visitor clicks a plans/pricing CTA, then displays WhatsApp contact with mobile number", () => {
    render(
      <div>
        <button type="button">View FiveM Plans</button>
        <WhatsAppPlansToaster />
      </div>,
    );

    expect(screen.queryByText(/waiting to help you/i)).toBeNull();

    fireEvent.click(screen.getByText("View FiveM Plans"));

    expect(screen.getByText(/waiting to help you/i)).toBeTruthy();
    expect(screen.getByText(WHATSAPP_SUPPORT_DISPLAY)).toBeTruthy();
    const link = screen.getByRole("link", { name: /Chat on WhatsApp Now/i });
    expect(link.getAttribute("href")).toContain("https://wa.me/919025056678");
  });

  it("collapses into a compact WhatsApp launcher pill when dismissed", () => {
    render(
      <div>
        <a href="#plans">Pricing</a>
        <WhatsAppPlansToaster />
      </div>,
    );

    fireEvent.click(screen.getByText("Pricing"));
    expect(screen.getByText(/waiting to help you/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Close WhatsApp support prompt/i }));
    expect(screen.queryByText(/waiting to help you/i)).toBeNull();
    expect(screen.getByRole("link", { name: new RegExp(WHATSAPP_SUPPORT_DISPLAY.replace(/\+/g, "\\+")) })).toBeTruthy();
  });
});
