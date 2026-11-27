import { describe, expect, it } from "vitest";
import {
  CreateInstanceInputSchema,
  detectRuntimeFromRepo,
  parseBulkDotEnv,
} from "@/lib/ai/contracts";
import {
  buildProvisioningEnforcementSpec,
  createAiInstance,
  decryptEnvSecret,
  encryptEnvSecret,
  generateCaddyInstanceConfig,
  generateNginxInstanceConfig,
  getFounderAdminTelemetry,
  performAiInstanceAction,
  processAiBillingWebhookEvent,
} from "@/lib/server/ai-hosting.server";

describe("SparrowX AI Hosting Control Plane (ai.sparrowx.net)", () => {
  it("encrypts and decrypts tenant env secrets with AES-256-GCM and rejects tampering", () => {
    const plain = "AIzaSy-Production-Mumbai-Secret-9921";
    const blob = encryptEnvSecret(plain);

    expect(blob.ciphertextHex).not.toContain("Mumbai");
    expect(blob.ivHex).toHaveLength(24); // 12 bytes
    expect(blob.authTagHex).toHaveLength(32); // 16 bytes
    expect(decryptEnvSecret(blob)).toBe(plain);

    // Tampering with auth tag must throw
    expect(() =>
      decryptEnvSecret({
        ...blob,
        authTagHex: "00".repeat(16),
      }),
    ).toThrow();
  });

  it("parses bulk .env blocks and auto-detects runtimes from GitHub repo URLs", () => {
    const parsed = parseBulkDotEnv(`
      # comment line
      export GEMINI_API_KEY="AIza123"
      WHATSAPP_TOKEN='EAAG999'
      INVALID-KEY=nope
      EXECUTIONS_DATA_PRUNE=true
    `);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toEqual({ key: "GEMINI_API_KEY", value: "AIza123", isSecret: true });
    expect(parsed[1]).toEqual({ key: "WHATSAPP_TOKEN", value: "EAAG999", isSecret: true });

    expect(detectRuntimeFromRepo("https://github.com/org/my-langgraph-rag")).toBe("python");
    expect(detectRuntimeFromRepo("https://github.com/org/mcp-tools-server")).toBe("node");
    expect(detectRuntimeFromRepo("https://github.com/org/langflow-docker")).toBe("docker");
  });

  it("generates Nginx & Caddy configs with WebSocket Upgrade headers and WAF controls", () => {
    const nginx = generateNginxInstanceConfig({
      hostname: "rag-bot.ai.sparrowx.net",
      internalIp: "10.77.12.115",
      internalPort: 7860,
      portMbps: 200,
      webhookWafEnabled: true,
    });
    expect(nginx).toContain("listen 443 ssl http2;");
    expect(nginx).toContain("proxy_set_header Upgrade $http_upgrade;");
    expect(nginx).toContain('proxy_set_header Connection "upgrade";');
    expect(nginx).toContain('X-SparrowX-WAF "active-l7-mumbai"');
    expect(nginx).toContain("limit_rate 25000k;");

    const caddy = generateCaddyInstanceConfig({
      hostname: "rag-bot.ai.sparrowx.net",
      internalIp: "10.77.12.115",
      internalPort: 7860,
      webhookWafEnabled: true,
    });
    expect(caddy).toContain("reverse_proxy 10.77.12.115:7860");
    expect(caddy).toContain("flush_interval -1");
  });

  it("provisions an isolated instance, reveals AES-encrypted env, attaches custom domain, and enforces SMTP block", () => {
    const parsed = CreateInstanceInputSchema.parse({
      name: "kerala-mcp-agent",
      subdomain: `kerala-mcp-${Date.now().toString(36).slice(-4)}`,
      sourceType: "template",
      templateId: "tpl-mcp-runtime",
      planId: "growth",
      autoProvisionPgVector: true,
      webhookWafEnabled: true,
      kycPhoneVerified: true,
      envVars: [{ key: "MCP_AUTH_TOKEN", value: "spx_live_secret_4412", isSecret: true }],
    });

    const created = createAiInstance(parsed, "founder@startup.in");
    expect(created.status).toBe("live");
    expect(created.pgVectorProvisioned).toBe(true);
    expect(created.smtpOutboundBlocked).toBe(true);
    expect(created.envSecrets.some((e) => e.key === "DATABASE_URL")).toBe(true);

    const revealed = performAiInstanceAction(
      {
        action: "reveal_env",
        instanceId: created.id,
        key: "MCP_AUTH_TOKEN",
      },
      "founder@startup.in",
    );
    expect(revealed.revealedSecret?.value).toBe("spx_live_secret_4412");

    const term = performAiInstanceAction(
      {
        action: "terminal_exec",
        instanceId: created.id,
        command: "nc smtp.gmail.com 25",
      },
      "founder@startup.in",
    );
    expect(term.terminalOutput).toContain("TCP port 25 (SMTP) is blocked");

    const snap = performAiInstanceAction(
      {
        action: "snapshot",
        instanceId: created.id,
        label: "pre-release-v2",
      },
      "founder@startup.in",
    );
    expect(snap.instance.snapshots[0]?.label).toBe("pre-release-v2");

    const enforcement = buildProvisioningEnforcementSpec({
      containerName: "spx-test",
      image: "langflowai/langflow:latest",
      vcpu: 4,
      ramGb: 8,
      pidsLimit: 512,
      portMbps: 200,
      vmid: 3150,
    });
    expect(enforcement.dockerArgs).toContain("--security-opt=no-new-privileges:true");
    expect(enforcement.dockerArgs).toContain("EXECUTIONS_DATA_PRUNE=true");
    expect(enforcement.tcShapeCmd).toContain("200mbit");
    expect(enforcement.smtpBlockRule).toContain("tcp dport 25");
  });

  it("handles Razorpay/UPI billing webhooks idempotently and exposes Proxmox/vnstat founder telemetry", () => {
    const halt = processAiBillingWebhookEvent({
      eventId: "evt_halted_unique_1",
      eventType: "subscription.halted",
      workspaceId: "ws-sparrowx-in",
    });
    expect(halt.applied).toBe(true);
    expect(halt.action).toBe("paused_after_grace");

    // Duplicate event must be ignored idempotently
    const dup = processAiBillingWebhookEvent({
      eventId: "evt_halted_unique_1",
      eventType: "subscription.halted",
      workspaceId: "ws-sparrowx-in",
    });
    expect(dup.applied).toBe(false);

    const reactivate = processAiBillingWebhookEvent({
      eventId: "evt_charged_unique_2",
      eventType: "subscription.charged",
      workspaceId: "ws-sparrowx-in",
      amountInr: 1499,
    });
    expect(reactivate.applied).toBe(true);
    expect(reactivate.action).toBe("activated");

    const admin = getFounderAdminTelemetry();
    expect(admin.proxmox.totalCores).toBe(40);
    expect(admin.proxmox.totalRamGb).toBe(256);
    expect(admin.ovhGateway.gatewayIp).toBe("103.174.10.24");
  });
});
