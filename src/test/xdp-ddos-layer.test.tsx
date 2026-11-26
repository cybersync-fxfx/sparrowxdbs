import fs from "node:fs";
import path from "node:path";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  SPARROWX_XDP_PROTECTED_PROFILES,
  generateSparrowxXdpProgram,
  sanitizeStrictIpv4List,
} from "@/lib/xdp-ddos-layer";
import { exportFirewallBlocklist } from "@/lib/advanced-features";
import { generateClientSdkSnippet } from "@/lib/client-sdk-generator";
import { FirewallRuleExporter } from "@/components/FirewallRuleExporter";
import { XdpDdosLayerCard } from "@/components/XdpDdosLayerCard";

afterEach(() => {
  cleanup();
});

describe("SparrowX Layer 3/4 XDP / eBPF Anti-DDoS Scrubber", () => {
  it("sanitizes strict IPv4 blocklist entries and rejects shell/comment injection", () => {
    const result = sanitizeStrictIpv4List([
      " 203.0.113.45 ",
      "198.51.100.7",
      "203.0.113.45",
      "999.0.0.1",
      "1.2.3.4; rm -rf /",
      "2001:db8::1",
      "evil.example.com",
    ]);

    expect(result).toEqual(["203.0.113.45", "198.51.100.7"]);
  });

  it("generates verifier-safe XDP C source without broken macros, literals, or stack overflow memcpy", () => {
    const generated = generateSparrowxXdpProgram({
      serviceName: "FiveM */ system('id')\nEdge",
      endpoint: "game.sparrowx.net",
      blockedIpv4s: ["198.51.100.88", "invalid-ip"],
    });

    expect(generated.validIpv4s).toEqual(["198.51.100.88"]);
    expect(generated.cSource).toContain('#define IP_CSUM_OFF   (ETH_HLEN + offsetof(struct iphdr, check))');
    expect(generated.cSource).toContain("180000000000ULL");
    expect(generated.cSource).toContain("5000000000ULL");
    expect(generated.cSource).toContain("blocked_ipv4");
    expect(generated.cSource).toContain("challenge_sent");
    expect(generated.cSource).toContain("whitelist");
    expect(generated.cSource).toContain("bpf_xdp_adjust_tail");
    expect(generated.cSource).toContain("return XDP_TX;");
    expect(generated.cSource).toContain("sudo bpftool map update name blocked_ipv4 key hex c6 33 64 58");
    // Prevents C comment termination injection
    expect(generated.cSource).not.toContain("FiveM */");
    // Verifier-unsafe patterns from unhardened snippet must never appear
    expect(generated.cSource).not.toContain("challenge_pkt[64]");
    expect(generated.cSource).not.toContain("bpf_redirect_map");
    expect(generated.cSource).not.toContain("bpf_strncmp");
  });

  it("keeps deploy/xdp and public/ setup & DDoS artifacts in exact sync with valid manifest links", () => {
    const root = process.cwd();
    const pairs: Array<[string, string]> = [
      ["deploy/xdp/sparrowx_xdp_ddos.c", "public/xdp/sparrowx_xdp_ddos.c"],
      ["deploy/xdp/attach-xdp.sh", "public/xdp/attach-xdp.sh"],
      ["deploy/ddos-setup.sh", "public/ddos-setup.sh"],
      ["deploy/sparrowx-noc.py", "public/sparrowx-noc.py"],
      ["fix.sh", "deploy/doctor-fix.sh"],
    ];

    for (const [srcRel, dstRel] of pairs) {
      const a = fs.readFileSync(path.resolve(root, srcRel), "utf8");
      const b = fs.readFileSync(path.resolve(root, dstRel), "utf8");
      expect(a).toBe(b);
    }

    const diskSource = fs.readFileSync(path.resolve(root, "deploy/xdp/sparrowx_xdp_ddos.c"), "utf8");
    expect(diskSource).toContain('SEC("xdp")');
    expect(diskSource).toContain("xdp_anti_ddos");
    expect(diskSource).toContain('SEC("license") = "GPL"');
    expect(diskSource).toContain("static_whitelist");
    expect(diskSource).toContain("is_internal_or_safe_ipv4");
    expect(diskSource).toContain("is_critical_dns_ipv4");
    expect(diskSource).toContain("ip_rate_map");
    expect(diskSource).toContain("blocked_ipv4");
    expect(diskSource).not.toContain("180000000000 ULL");

    const manifestRaw = fs.readFileSync(path.resolve(root, "public/setup-manifest.json"), "utf8");
    const manifest = JSON.parse(manifestRaw) as {
      scripts: Array<{ id: string; url: string; repoPath: string }>;
    };
    expect(manifest.scripts.length).toBeGreaterThanOrEqual(7);
    for (const entry of manifest.scripts) {
      expect(fs.existsSync(path.resolve(root, entry.repoPath))).toBe(true);
      const urlPath = new URL(entry.url).pathname.replace(/^\/+/, "");
      expect(fs.existsSync(path.resolve(root, "public", urlPath))).toBe(true);
    }
  });

  it("integrates xdp_ebpf cleanly into firewall exporter and SDK snippet generator", () => {
    const exported = exportFirewallBlocklist(
      [
        { indicator: "192.0.2.10", type: "IPv4", blocked: true },
        { indicator: "bad.example.net", type: "Domain", blocked: true },
        { indicator: "192.0.2.99", type: "IPv4", blocked: false },
      ],
      "xdp_ebpf",
    );

    expect(exported.filename).toBe("sparrowx_xdp_ddos.c");
    expect(exported.mimeType).toBe("text/x-c");
    expect(exported.content).toContain("c0 00 02 0a");
    expect(exported.content).not.toContain("bad.example.net");

    const sdk = generateClientSdkSnippet("xdp_ebpf", {
      id: "srv-game-01",
      name: "Edge Game Node",
      endpoint: "https://game.sparrowx.net",
      apiKey: "spx_live_test_123456",
    });
    expect(sdk.filename).toBe("sparrowx_xdp_ddos.c");
    expect(sdk.language).toBe("c");
    expect(sdk.installCmd).toContain("clang");
  });

  it("renders XdpDdosLayerCard and FirewallRuleExporter XDP mode without crashing", () => {
    render(
      <>
        <XdpDdosLayerCard
          serviceName="SparrowX Game Edge"
          endpoint="gamesec.sparrowx.net"
          blockedIpv4s={["198.51.100.42"]}
          showToast={vi.fn()}
        />
        <FirewallRuleExporter
          indicators={[{ indicator: "198.51.100.42", type: "IPv4", blocked: true }]}
          showToast={vi.fn()}
        />
      </>,
    );

    expect(screen.getByText(/Layer 3\/4 XDP \/ eBPF Kernel Anti-DDoS Scrubber/i)).toBeInTheDocument();
    expect(SPARROWX_XDP_PROTECTED_PROFILES.length).toBe(5);
    expect(screen.getByText(/FiveM \/ RedM \/ AltV/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\/ddos-setup\.sh/i })).toHaveAttribute("href", "/ddos-setup.sh");
    expect(screen.getByRole("link", { name: /\/setup\.sh/i })).toHaveAttribute("href", "/setup.sh");
    expect(screen.getByRole("link", { name: /\/xdp\/sparrowx_xdp_ddos\.c/i })).toHaveAttribute("href", "/xdp/sparrowx_xdp_ddos.c");

    const xdpEngineBtn = screen.getByRole("button", { name: /Linux XDP \/ eBPF \(L4 DDoS\)/i });
    fireEvent.click(xdpEngineBtn);
    expect(screen.getAllByText(/sparrowx_xdp_ddos\.c/i).length).toBeGreaterThanOrEqual(2);
  });
});
