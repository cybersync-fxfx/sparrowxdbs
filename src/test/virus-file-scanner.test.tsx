import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SparrowXVirusFileScanner } from "@/components/SparrowXVirusFileScanner";

describe("SparrowX Shield Virus & File Malware Scanner", () => {
  it("renders with 'POWERED BY SPARROWX SECURITY' branding and simulated test samples", () => {
    render(<SparrowXVirusFileScanner />);

    // Check prominent branding (appears at top and footer)
    expect(screen.getAllByText(/POWERED BY SPARROWX SECURITY/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SPARROWX SHIELD/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/MALWARE & VIRUS SCANNER/i)).toBeDefined();

    // Check simulated test samples
    expect(screen.getByText(/EICAR Standard AV Test File/i)).toBeDefined();
    expect(screen.getByText(/Cobalt Strike C2 Beacon/i)).toBeDefined();
    expect(screen.getByText(/CryptoLocker Ransomware Script/i)).toBeDefined();
    expect(screen.getByText(/Hardened Production Bundle/i)).toBeDefined();
  });

  it("executes simulated EICAR virus scan and reports QUARANTINED verdict", async () => {
    render(<SparrowXVirusFileScanner />);

    const scanButton = screen.getByRole("button", { name: /Scan via SparrowX Shield/i });
    fireEvent.click(scanButton);

    // Wait for the scan animation to finish
    await waitFor(
      () => {
        expect(screen.getByText(/MALICIOUS VECTOR NEUTRALIZED/i)).toBeDefined();
      },
      { timeout: 6000 },
    );

    expect(screen.getAllByText(/EICAR/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Blocked at Edge · Quarantined in Sovereign Vault/i)).toBeDefined();
    expect(screen.getByText(/Download Certificate/i)).toBeDefined();
  });

  it("scans clean hardened bundle and outputs 100% CLEAN verification", async () => {
    render(<SparrowXVirusFileScanner />);

    // Select clean sample
    const cleanSampleBtn = screen.getByText(/Hardened Production Bundle/i);
    fireEvent.click(cleanSampleBtn);

    const scanButton = screen.getByRole("button", { name: /Scan via SparrowX Shield/i });
    fireEvent.click(scanButton);

    await waitFor(
      () => {
        expect(screen.getByText(/VERIFIED CLEAN BY SPARROWX SHIELD/i)).toBeDefined();
      },
      { timeout: 6000 },
    );

    expect(screen.getByText(/SPARROWX SHIELD CERTIFIED CLEAN/i)).toBeDefined();
    expect(screen.getByText(/Zero Malicious Signatures Detected/i)).toBeDefined();
  });
});
