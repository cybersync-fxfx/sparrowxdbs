import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ContainmentRequest, ContainmentResult, FirewallRule, ImmutableAuditLogEntry } from "./server/security-soc.server";

export const getSecurityAuditChain = createServerFn({ method: "GET" })
  .validator((tenantId?: string) => tenantId)
  .handler(async ({ data: tenantId }): Promise<ImmutableAuditLogEntry[]> => {
    const { getTenantAuditLogs } = await import("./server/security-soc.server");
    return getTenantAuditLogs(tenantId);
  });

export const verifyAuditChainIntegrity = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ valid: boolean; totalEntries: number; brokenIndex?: number }> => {
    const { verifyAuditChain } = await import("./server/security-soc.server");
    return verifyAuditChain();
  },
);

const containmentSchema = z.object({
  incidentId: z.string().min(1),
  tenantId: z.string().min(1),
  actionType: z.enum([
    "quarantine_host",
    "block_ip",
    "revoke_sessions",
    "activate_ai_guardrail",
    "unquarantine_host",
    "unblock_ip",
  ]),
  target: z.string().min(1),
  actor: z.string().default("SOC Responder"),
  reason: z.string().default("Containment via SparrowX SOC"),
  durationMinutes: z.number().optional(),
});

export const executeContainmentAction = createServerFn({ method: "POST" })
  .validator((d: ContainmentRequest) => containmentSchema.parse(d))
  .handler(async ({ data }): Promise<ContainmentResult> => {
    const { executeSocContainment } = await import("./server/security-soc.server");
    return executeSocContainment(data);
  });

export const getFirewallRules = createServerFn({ method: "GET" })
  .validator((tenantId: string) => tenantId)
  .handler(async ({ data: tenantId }): Promise<FirewallRule[]> => {
    const { getTenantFirewallRules } = await import("./server/security-soc.server");
    return getTenantFirewallRules(tenantId);
  });

const addRuleSchema = z.object({
  tenantId: z.string().min(1),
  type: z.enum(["ip", "cidr", "country", "asn", "user_agent"]),
  value: z.string().min(1),
  action: z.enum(["block", "allow", "rate_limit_jail", "challenge"]),
  comment: z.string().default("Manual rule via SparrowX Sec"),
  expiresAt: z.string().nullable().default(null),
  active: z.boolean().default(true),
});

export const addTenantFirewallRule = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof addRuleSchema>) => addRuleSchema.parse(d))
  .handler(async ({ data }): Promise<FirewallRule> => {
    const { addFirewallRule } = await import("./server/security-soc.server");
    return addFirewallRule(data);
  });

export const removeTenantFirewallRule = createServerFn({ method: "POST" })
  .validator((d: { tenantId: string; ruleId: string }) =>
    z.object({ tenantId: z.string().min(1), ruleId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    const { removeFirewallRule } = await import("./server/security-soc.server");
    return { success: removeFirewallRule(data.tenantId, data.ruleId) };
  });

export const executeDeepSecurityScan = createServerFn({ method: "POST" })
  .validator((d: { domain: string }) =>
    z.object({ domain: z.string().min(1).max(255) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { runServerDeepDomainScan } = await import("./server/deep-domain-scanner.server");
    return runServerDeepDomainScan(data.domain);
  });

const aiQuerySchema = z.object({
  system: z.enum(["shield", "db", "drop", "keys", "game"]),
  prompt: z.string().min(1).max(8000),
  contextData: z.string().optional(),
  model: z.enum(["gemini-3.8-flash", "gemini-4-argon"]).optional(),
  previousInteractionId: z.string().optional(),
});

export const querySparrowxServerAi = createServerFn({ method: "POST" })
  .validator((d: z.infer<typeof aiQuerySchema>) => aiQuerySchema.parse(d))
  .handler(async ({ data }) => {
    const { querySparrowxCrossSystemAi } = await import("./sparrowx-ai-brain");
    return querySparrowxCrossSystemAi(data);
  });
