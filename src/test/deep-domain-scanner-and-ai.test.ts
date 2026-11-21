import { describe, expect, it } from "vitest";
import { runServerDeepDomainScan } from "@/lib/server/deep-domain-scanner.server";
import { querySparrowxCrossSystemAi } from "@/lib/sparrowx-ai-brain";

describe("8-Tool Server Deep Domain Scanner & Cross-System SparrowX AI Engine", () => {
  it("strictly blocks SSRF private, loopback, and cloud metadata targets on the server scanner", async () => {
    await expect(runServerDeepDomainScan("127.0.0.1")).rejects.toThrow(/SSRF/i);
    await expect(runServerDeepDomainScan("http://169.254.169.254/latest/meta-data")).rejects.toThrow(/SSRF/i);
    await expect(runServerDeepDomainScan("192.168.1.10")).rejects.toThrow(/SSRF/i);
    await expect(runServerDeepDomainScan("internal.local")).rejects.toThrow(/SSRF/i);
  });

  it("synthesizes cross-system AI responses across shield, db, drop, keys, and game with 100% SparrowX AI white-labeling", async () => {
    const systems = ["shield", "db", "drop", "keys", "game"] as const;
    for (const sys of systems) {
      const res = await querySparrowxCrossSystemAi({
        system: sys,
        prompt: "Provide a hardened production security recommendation and configuration.",
      });
      expect(res.text.length).toBeGreaterThan(20);
      expect(res.modelUsed).toContain("SparrowX AI");
      expect(res.modelUsed.toLowerCase()).not.toContain("gemini");
    }
  });
});
