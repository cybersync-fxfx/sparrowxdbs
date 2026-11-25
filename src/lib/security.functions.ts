import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ContainmentRequest, ContainmentResult, FirewallRule, ImmutableAuditLogEntry } from "./server/security-soc.server";

async function buildServerFnRequest(): Promise<Request> {
  const { getRequestHeader, getRequestHost, getRequestProtocol } = await import(
    "@tanstack/react-start/server"
  );
  let proto = "https";
  let host = "sparrowx.net";
  try {
    proto = getRequestProtocol({ xForwardedProto: true }) || "https";
    host = getRequestHost({ xForwardedHost: true }) || "sparrowx.net";
  } catch {
    // fallback in unit tests
  }
  const headers = new Headers();
  for (const name of [
    "cookie",
    "authorization",
    "x-sparrowx-admin-key",
    "x-sparrowx-master-sso",
    "cf-connecting-ip",
    "x-real-ip",
    "x-forwarded-for",
    "host",
  ]) {
    const val = getRequestHeader(name);
    if (val) headers.set(name, val);
  }
  return new Request(`${proto}://${host}/_serverFn`, { headers });
}

async function requireSocAuth(targetTenantId?: string) {
  const { authorizeDbRequest } = await import("./server/db-auth.server");
  const req = await buildServerFnRequest();
  const auth = await authorizeDbRequest(
    req,
    targetTenantId ? { targetTenantId } : {},
  );
  if (!auth.authorized) {
    throw new Error("Unauthorized: sign in to access SparrowX SOC controls.");
  }
  return auth;
}

async function enforcePublicToolRateLimit(bucketPrefix: string, maxReq: number) {
  const { checkDbRateLimit, extractClientIp } = await import("./server/db-auth.server");
  const req = await buildServerFnRequest();
  const ip = extractClientIp(req);
  const rate = checkDbRateLimit(`${bucketPrefix}:${ip}`, maxReq, 60_000);
  if (!rate.allowed) {
    throw new Error(`Rate limit exceeded. Retry in ${rate.retryAfterSec}s.`);
  }
}

export const getSecurityAuditChain = createServerFn({ method: "GET" })
  .validator((tenantId?: string) => tenantId)
  .handler(async ({ data: tenantId }): Promise<ImmutableAuditLogEntry[]> => {
    const auth = await requireSocAuth(tenantId);
    const { getTenantAuditLogs } = await import("./server/security-soc.server");
    const scopedTenant = auth.isAdmin ? tenantId : auth.tenantId || tenantId;
    return getTenantAuditLogs(scopedTenant);
  });

export const verifyAuditChainIntegrity = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ valid: boolean; totalEntries: number; brokenIndex?: number }> => {
    await requireSocAuth();
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
    const auth = await requireSocAuth(data.tenantId);
    const { executeSocContainment } = await import("./server/security-soc.server");
    return executeSocContainment({
      ...data,
      actor: auth.actorEmail || data.actor,
      tenantId: auth.isAdmin ? data.tenantId : auth.tenantId || data.tenantId,
    });
  });

export const getFirewallRules = createServerFn({ method: "GET" })
  .validator((tenantId: string) => tenantId)
  .handler(async ({ data: tenantId }): Promise<FirewallRule[]> => {
    const auth = await requireSocAuth(tenantId);
    const { getTenantFirewallRules } = await import("./server/security-soc.server");
    return getTenantFirewallRules(auth.isAdmin ? tenantId : auth.tenantId || tenantId);
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
    const auth = await requireSocAuth(data.tenantId);
    const { addFirewallRule } = await import("./server/security-soc.server");
    return addFirewallRule({
      ...data,
      tenantId: auth.isAdmin ? data.tenantId : auth.tenantId || data.tenantId,
    });
  });

export const removeTenantFirewallRule = createServerFn({ method: "POST" })
  .validator((d: { tenantId: string; ruleId: string }) =>
    z.object({ tenantId: z.string().min(1), ruleId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    const auth = await requireSocAuth(data.tenantId);
    const { removeFirewallRule } = await import("./server/security-soc.server");
    return {
      success: removeFirewallRule(
        auth.isAdmin ? data.tenantId : auth.tenantId || data.tenantId,
        data.ruleId,
      ),
    };
  });

export const executeDeepSecurityScan = createServerFn({ method: "POST" })
  .validator((d: { domain: string }) =>
    z.object({ domain: z.string().min(1).max(255) }).parse(d),
  )
  .handler(async ({ data }) => {
    await enforcePublicToolRateLimit("deep-scan", 10);
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
    await enforcePublicToolRateLimit("server-ai", 20);
    const { querySparrowxCrossSystemAi } = await import("./sparrowx-ai-brain");
    return querySparrowxCrossSystemAi(data);
  });
