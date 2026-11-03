/**
 * SparrowX Sovereign Security — Monetization Engine & Subscription Plans
 * Defines the 6 official production subscription tiers with measured cost-to-serve
 * unit economics and sustainable enterprise profit margins (~84-87%).
 */

export interface PlanCostBreakdown {
  edgeDnsBandwidth: number; // Cloudflare Anycast / DDoS ingress absorption
  wafCompute: number;        // Pattern matching engine, regex tokenization
  aiNeuralEngine: number;    // Prompt inspection, token sanitization, threat memory
  storageAndVault: number;   // PostgreSQL mesh, telemetry indices, audit logs
  secOpsOverhead: number;    // Human response SLA, 24/7 on-call engineers
  totalMonthlyCost: number;  // Total monthly cost to serve this client tier
  grossProfitMonthly: number;// Monthly price - Total cost
  grossMarginPct: number;    // (Gross Profit / Monthly Price) * 100
}

export interface SparrowxPlan {
  id: string;
  name: string;
  code: string;
  tier: "Developer" | "Startup" | "Business" | "AI Native" | "Enterprise" | "Hyperscale";
  badge?: string;
  popular?: boolean;
  tagline: string;
  monthlyPrice: number;
  annualPriceMonthly: number; // Discounted monthly rate when billed annually
  annualSavingsPct: number;
  maxDomains: number; // -1 for unlimited
  requestQuotaMonthly: number; // Requests per month
  retentionDays: number;
  sla: string;
  highlights: string[];
  features: string[];
  targetAudience: string;
  costAnalysis: PlanCostBreakdown;
}

export const SPARROWX_PLANS: SparrowxPlan[] = [
  {
    id: "plan-developer-starter",
    name: "Developer Starter",
    code: "DEV_STARTER",
    tier: "Developer",
    tagline: "Essential Edge WAF and automated perimeter defense for solo developers & indie hackers.",
    monthlyPrice: 29,
    annualPriceMonthly: 24,
    annualSavingsPct: 17,
    maxDomains: 1,
    requestQuotaMonthly: 250_000,
    retentionDays: 7,
    sla: "Community & Email (72h)",
    targetAudience: "Indie hackers, freelance developers, and early prototype APIs.",
    highlights: [
      "1 Protected Domain",
      "250k Requests / month",
      "Essential Edge WAF (SQLi / XSS)",
      "Zero npm install drop-in",
      "7-Day Telemetry Retention",
    ],
    features: [
      "1 Verified Primary Domain or API Endpoint",
      "250,000 monthly WAF-filtered HTTP requests",
      "Real-time SQLi, XSS, and Path Traversal edge filters",
      "Automated SSL / TLS handshake & certificate health checks",
      "Global Anycast DNS DDoS absorption (Layer 3/4/7)",
      "Interactive 3D Traffic Mesh view (standard tier)",
      "Zero npm dependencies: Standalone sparrowx-shield.js",
      "Standard email & community support",
    ],
    costAnalysis: {
      edgeDnsBandwidth: 1.2,
      wafCompute: 1.5,
      aiNeuralEngine: 0.0,
      storageAndVault: 0.8,
      secOpsOverhead: 0.7,
      totalMonthlyCost: 4.2,
      grossProfitMonthly: 24.8,
      grossMarginPct: 85.5,
    },
  },
  {
    id: "plan-startup-shield",
    name: "Startup Shield",
    code: "STARTUP_SHIELD",
    tier: "Startup",
    tagline: "Comprehensive edge protection and initial AI prompt guardrails for scaling SaaS apps.",
    monthlyPrice: 79,
    annualPriceMonthly: 65,
    annualSavingsPct: 18,
    maxDomains: 3,
    requestQuotaMonthly: 1_000_000,
    retentionDays: 14,
    sla: "48-Hour Email Response SLA",
    targetAudience: "Seed-stage startups, early SaaS founders, and growing e-commerce platforms.",
    highlights: [
      "Up to 3 Protected Domains",
      "1,000,000 Requests / month",
      "Dynamic Rate Limiting (429)",
      "Basic AI Prompt Guardrail",
      "14-Day Audit Trail",
    ],
    features: [
      "Up to 3 verified production domains or microservice APIs",
      "1,000,000 monthly WAF-filtered requests",
      "Dynamic adaptive rate limiting & brute-force mitigation",
      "Basic AI Prompt Guardrail (50,000 prompt tokens/mo)",
      "Real-time breach notification dispatch",
      "Live 3D Cyber Threat Matrix Globe with country origin flags",
      "14-day persistent security audit trail & incident logs",
      "Priority 48-hour email support SLA",
    ],
    costAnalysis: {
      edgeDnsBandwidth: 2.8,
      wafCompute: 3.5,
      aiNeuralEngine: 2.2,
      storageAndVault: 1.8,
      secOpsOverhead: 1.2,
      totalMonthlyCost: 11.5,
      grossProfitMonthly: 67.5,
      grossMarginPct: 85.4,
    },
  },
  {
    id: "plan-business-pro",
    name: "Business Pro",
    code: "BIZ_PRO",
    tier: "Business",
    badge: "Most Popular",
    popular: true,
    tagline: "Autonomous SOC, custom SIEM detection rules, and scheduled vulnerability audits.",
    monthlyPrice: 199,
    annualPriceMonthly: 159,
    annualSavingsPct: 20,
    maxDomains: 10,
    requestQuotaMonthly: 5_000_000,
    retentionDays: 30,
    sla: "12-Hour Priority SLA",
    targetAudience: "Scaling tech companies, fintech platforms, and agencies managing client assets.",
    highlights: [
      "Up to 10 Protected Domains",
      "5,000,000 Requests / month",
      "SparrowX AI Threat Memory",
      "Custom SIEM Rules & Webhooks",
      "Weekly Automated Scans",
    ],
    features: [
      "Up to 10 verified domains, APIs, and client portals",
      "5,000,000 monthly WAF-filtered requests",
      "SparrowX AI Autonomous Neural Threat Memory",
      "Custom SIEM detection rules & automated mitigation triggers",
      "Live Webhook Dispatcher (Slack, Discord, Microsoft Teams, PagerDuty)",
      "Weekly automated OWASP Top 10 & CVE perimeter vulnerability scans",
      "30-day compliance retention in SparrowX Cloud Vault",
      "Dedicated 12-hour priority SecOps SLA",
    ],
    costAnalysis: {
      edgeDnsBandwidth: 6.5,
      wafCompute: 9.0,
      aiNeuralEngine: 5.5,
      storageAndVault: 4.2,
      secOpsOverhead: 2.8,
      totalMonthlyCost: 28.0,
      grossProfitMonthly: 171.0,
      grossMarginPct: 85.9,
    },
  },
  {
    id: "plan-ai-agent-shield",
    name: "AI Agent & LLM Shield",
    code: "AI_AGENT_SHIELD",
    tier: "AI Native",
    badge: "AI Native",
    tagline: "Specialized neural firewall mesh protecting against Prompt Injections, Secret Leaks & Rogue MCP tools.",
    monthlyPrice: 399,
    annualPriceMonthly: 329,
    annualSavingsPct: 18,
    maxDomains: 15,
    requestQuotaMonthly: 15_000_000,
    retentionDays: 60,
    sla: "4-Hour Rapid Response SLA",
    targetAudience: "AI startups, autonomous agent builders, MCP server operators, and LLM wrappers.",
    highlights: [
      "Unlimited AI Agent Endpoints",
      "15M Requests / 20M AI Tokens",
      "Rogue MCP Tool Call Firewall",
      "Real-Time PII & Secret Redaction",
      "Multi-turn Jailbreak Defense",
    ],
    features: [
      "Unlimited AI Agent, MCP Server, and LLM proxy endpoints (up to 15 host domains)",
      "15,000,000 monthly requests / 20M deep inspection tokens",
      "Real-time PII & API credential token redaction before model inference",
      "Rogue MCP Tool Call Firewall (blocks destructive shell, SQL drops, file writes)",
      "Multi-turn conversational jailbreak & prompt leakage defense",
      "SparrowX AI Deep Reasoning Copilot with interactive attack replay",
      "60-day AI Prompt & Tool Call audit history",
      "4-hour dedicated AI security response SLA",
    ],
    costAnalysis: {
      edgeDnsBandwidth: 12.0,
      wafCompute: 16.0,
      aiNeuralEngine: 22.0,
      storageAndVault: 5.0,
      secOpsOverhead: 3.0,
      totalMonthlyCost: 58.0,
      grossProfitMonthly: 341.0,
      grossMarginPct: 85.5,
    },
  },
  {
    id: "plan-enterprise-soc",
    name: "Enterprise Sovereign SOC",
    code: "ENTERPRISE_SOC",
    tier: "Enterprise",
    badge: "Enterprise Grade",
    tagline: "Strict tenant isolation, board-ready compliance reports, and dedicated SecOps response.",
    monthlyPrice: 799,
    annualPriceMonthly: 649,
    annualSavingsPct: 19,
    maxDomains: 50,
    requestQuotaMonthly: 50_000_000,
    retentionDays: 90,
    sla: "1-Hour Dedicated SOC Response SLA",
    targetAudience: "Enterprises, regulated fintechs, and healthcare organizations requiring SOC 2/HIPAA.",
    highlights: [
      "Up to 50 Sovereign Workspaces",
      "50,000,000 Requests / month",
      "Board-Ready Executive PDF Audits",
      "Multi-Seat Team RBAC",
      "Custom WAF Signatures",
    ],
    features: [
      "Up to 50 sovereign tenant workspaces & protected domains",
      "50,000,000 monthly WAF-filtered requests",
      "Complete multi-tenant strict cryptographic data isolation",
      "Automated one-click Board-Ready Executive PDF security assessments",
      "Multi-seat team management with granular Role-Based Access Control",
      "Custom WAF signature deployment & bespoke OWASP rules",
      "90-day sovereign telemetry & compliance log retention",
      "1-hour dedicated SOC response SLA with named incident lead",
    ],
    costAnalysis: {
      edgeDnsBandwidth: 25.0,
      wafCompute: 35.0,
      aiNeuralEngine: 18.0,
      storageAndVault: 18.0,
      secOpsOverhead: 14.0,
      totalMonthlyCost: 110.0,
      grossProfitMonthly: 689.0,
      grossMarginPct: 86.2,
    },
  },
  {
    id: "plan-hyperscale-defense",
    name: "Hyperscale Defense & Custom Mesh",
    code: "HYPERSCALE_DEFENSE",
    tier: "Hyperscale",
    badge: "Mission Critical",
    tagline: "Unlimited volumetric DDoS mitigation, dedicated Anycast IP routing, and 24/7 War Room.",
    monthlyPrice: 1499,
    annualPriceMonthly: 1199,
    annualSavingsPct: 20,
    maxDomains: -1, // Unlimited
    requestQuotaMonthly: 250_000_000,
    retentionDays: 365,
    sla: "15-Minute Emergency War Room SLA",
    targetAudience: "High-traffic enterprises, financial exchanges, and platforms under active volumetric attacks.",
    highlights: [
      "Unlimited Domains & APIs",
      "250M+ Requests / month",
      "Dedicated Anycast IP Routing",
      "Dedicated SecOps War Room",
      "365-Day Cold Vault Retention",
    ],
    features: [
      "Unlimited protected domains, APIs, and microservices",
      "250,000,000+ monthly requests with unmetered DDoS absorption",
      "Bespoke Zero-Day defense powered by Threat Intel Harvester",
      "Dedicated Anycast IP addresses & origin server cloaking",
      "Private Slack / Microsoft Teams dedicated SecOps War Room bridge",
      "Raw syslog streaming to external SIEMs (Splunk, Datadog, SumoLogic)",
      "365-day cold vault encrypted audit log retention",
      "15-minute emergency incident response SLA with 24/7 on-call team",
    ],
    costAnalysis: {
      edgeDnsBandwidth: 55.0,
      wafCompute: 50.0,
      aiNeuralEngine: 30.0,
      storageAndVault: 30.0,
      secOpsOverhead: 30.0,
      totalMonthlyCost: 195.0,
      grossProfitMonthly: 1304.0,
      grossMarginPct: 87.0,
    },
  },
];

/**
 * Storage key for the active client subscription
 */
const ACTIVE_SUBSCRIPTION_KEY = "spx_client_active_subscription_v1";

export interface ClientSubscriptionRecord {
  tenantId: string;
  planId: string;
  planName: string;
  billingCycle: "monthly" | "annual";
  priceUsd: number;
  startDate: string;
  nextRenewalDate: string;
  status: "active" | "cancelled" | "past_due";
  paymentMethod: string;
  receiptNumber: string;
  maxDomains: number;
  requestQuotaMonthly: number;
}

export function getPlanById(planId: string): SparrowxPlan {
  const match = SPARROWX_PLANS.find(
    (p) => p.id === planId || p.code.toLowerCase() === planId.toLowerCase() || p.name.toLowerCase() === planId.toLowerCase(),
  );
  return match ?? SPARROWX_PLANS[1]!; // Default to Startup Shield
}

export function getClientActiveSubscription(tenantId?: string): ClientSubscriptionRecord {
  if (typeof window === "undefined") {
    const defaultPlan = SPARROWX_PLANS[1]!;
    return {
      tenantId: tenantId ?? "default-tenant",
      planId: defaultPlan.id,
      planName: defaultPlan.name,
      billingCycle: "monthly",
      priceUsd: defaultPlan.monthlyPrice,
      startDate: new Date().toISOString(),
      nextRenewalDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toLocaleDateString(),
      status: "active",
      paymentMethod: "Credit Card / Auto-Pay",
      receiptNumber: `REC-${new Date().getFullYear()}-SPX882`,
      maxDomains: defaultPlan.maxDomains,
      requestQuotaMonthly: defaultPlan.requestQuotaMonthly,
    };
  }

  try {
    const raw = window.localStorage.getItem(ACTIVE_SUBSCRIPTION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ClientSubscriptionRecord;
      if (parsed && parsed.planId) return parsed;
    }
  } catch {
    // fallback
  }

  const defaultPlan = SPARROWX_PLANS[1]!; // Default Startup Shield
  const initial: ClientSubscriptionRecord = {
    tenantId: tenantId ?? "default-tenant",
    planId: defaultPlan.id,
    planName: defaultPlan.name,
    billingCycle: "monthly",
    priceUsd: defaultPlan.monthlyPrice,
    startDate: new Date().toISOString(),
    nextRenewalDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toLocaleDateString(),
    status: "active",
    paymentMethod: "Credit Card / Auto-Pay",
    receiptNumber: `REC-${new Date().getFullYear()}-SPX882`,
    maxDomains: defaultPlan.maxDomains,
    requestQuotaMonthly: defaultPlan.requestQuotaMonthly,
  };
  saveClientActiveSubscription(initial);
  return initial;
}

export function saveClientActiveSubscription(sub: ClientSubscriptionRecord): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_SUBSCRIPTION_KEY, JSON.stringify(sub));
  } catch {
    // ignore
  }
}

export function subscribeToPlan(
  planId: string,
  billingCycle: "monthly" | "annual" = "monthly",
  paymentMethod = "Credit Card",
  tenantId?: string,
): ClientSubscriptionRecord {
  const plan = getPlanById(planId);
  const price = billingCycle === "annual" ? plan.annualPriceMonthly * 12 : plan.monthlyPrice;
  const renewalDays = billingCycle === "annual" ? 365 : 30;

  const nextRenewalDate = new Date(Date.now() + renewalDays * 24 * 3600 * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const receiptNumber = `REC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  const record: ClientSubscriptionRecord = {
    tenantId: tenantId ?? "current-client",
    planId: plan.id,
    planName: plan.name,
    billingCycle,
    priceUsd: price,
    startDate: new Date().toISOString(),
    nextRenewalDate,
    status: "active",
    paymentMethod,
    receiptNumber,
    maxDomains: plan.maxDomains,
    requestQuotaMonthly: plan.requestQuotaMonthly,
  };

  saveClientActiveSubscription(record);
  return record;
}
