import { env } from "./config.server";

export type DiscordTelemetryCategory =
  | "emergency"
  | "security"
  | "error"
  | "auth"
  | "form"
  | "deploy"
  | "audit";

export type DiscordTelemetrySeverity = "critical" | "high" | "medium" | "info";

export interface DiscordTelemetryPayload {
  category: DiscordTelemetryCategory;
  severity?: DiscordTelemetrySeverity | undefined;
  title: string;
  description?: string | undefined;
  service?: string | undefined;
  fields?: Record<string, unknown> | undefined;
  ip?: string | undefined;
  userAgent?: string | undefined;
  url?: string | undefined;
}

const REDACT_KEY_RE = /(pass|secret|token|apikey|api_key|authorization|cookie|cvv|card)/i;

function neutralizeMentions(input: string): string {
  return input.replace(/@(everyone|here)/gi, "@\u200b$1").replace(/<@!?\d+>|<@&\d+>/g, "[mention]");
}

const CATEGORY_META: Record<
  DiscordTelemetryCategory,
  { color: number; prefix: string }
> = {
  emergency: { color: 0xef4444, prefix: "🚨 EMERGENCY · UNDER ATTACK" },
  security: { color: 0xf97316, prefix: "🛡️ SECURITY ALERT" },
  error: { color: 0xdc2626, prefix: "💥 RUNTIME ERROR" },
  auth: { color: 0x3b82f6, prefix: "🔐 AUTH EVENT" },
  form: { color: 0x10b981, prefix: "📩 FORM SUBMISSION" },
  deploy: { color: 0x06b6d4, prefix: "🚀 SERVICE DEPLOYMENT" },
  audit: { color: 0xa855f7, prefix: "📋 AUDIT LOG" },
};

export function sanitizeTelemetryFields(
  fields?: Record<string, unknown>,
): Array<{ name: string; value: string; inline: boolean }> {
  if (!fields) return [];
  const result: Array<{ name: string; value: string; inline: boolean }> = [];
  for (const [key, rawVal] of Object.entries(fields)) {
    if (result.length >= 20) break;
    if (rawVal === undefined || rawVal === null || rawVal === "") continue;
    const safeKey = String(key).slice(0, 64);
    const safeVal = REDACT_KEY_RE.test(safeKey)
      ? "[REDACTED]"
      : (typeof rawVal === "string" ? rawVal : JSON.stringify(rawVal)).slice(0, 900);
    result.push({
      name: safeKey,
      value: safeVal || "—",
      inline: safeVal.length <= 64,
    });
  }
  return result;
}

export async function sendDiscordTelemetry(
  payload: DiscordTelemetryPayload,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return { ok: true, status: 204 };
  }

  const webhookUrl = env("SPARROWX_DISCORD_WEBHOOK_URL") || "";
  if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
    return { ok: false, error: "Discord webhook URL not configured" };
  }

  const meta = CATEGORY_META[payload.category] ?? CATEGORY_META.audit;
  const embedFields = sanitizeTelemetryFields({
    ...(payload.service ? { Service: payload.service } : {}),
    ...(payload.severity ? { Severity: payload.severity.toUpperCase() } : {}),
    ...(payload.ip ? { "Client IP": payload.ip } : {}),
    ...(payload.url ? { Page: payload.url } : {}),
    ...(payload.fields ?? {}),
    ...(payload.userAgent ? { "User-Agent": payload.userAgent.slice(0, 140) } : {}),
  }).map((f) => ({
    ...f,
    name: neutralizeMentions(f.name),
    value: neutralizeMentions(f.value),
  }));

  const body = {
    username: "SparrowX SOC & Telemetry",
    allowed_mentions: { parse: [] as string[] },
    content:
      payload.category === "emergency"
        ? "**URGENT: UNDER ATTACK EMERGENCY REPORT**"
        : undefined,
    embeds: [
      {
        title: `${meta.prefix} — ${neutralizeMentions(String(payload.title || "Event")).slice(0, 180)}`,
        description: payload.description
          ? neutralizeMentions(String(payload.description)).slice(0, 2000)
          : undefined,
        color: meta.color,
        fields: embedFields,
        footer: {
          text: "SparrowX Technologies · Live Telemetry & Security Audit",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return {
      ok: false,
      error: "Discord webhook dispatch failed",
    };
  }
}
