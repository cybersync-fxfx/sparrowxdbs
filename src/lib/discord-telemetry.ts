export type ClientTelemetryCategory =
  | "emergency"
  | "security"
  | "error"
  | "auth"
  | "form"
  | "audit";

export type ClientTelemetrySeverity = "critical" | "high" | "medium" | "info";

export interface ClientDiscordEvent {
  category: ClientTelemetryCategory;
  severity?: ClientTelemetrySeverity | undefined;
  title: string;
  description?: string | undefined;
  service?: string | undefined;
  fields?: Record<string, unknown> | undefined;
}

/**
 * Dispatches structured events, forms, auth activity, errors, and security alerts
 * through SparrowX's server-side `/api/telemetry/discord` proxy so the webhook URL
 * is never exposed in client-side JavaScript.
 */
export async function emitDiscordTelemetry(
  event: ClientDiscordEvent,
): Promise<{ ok: boolean; ticketId?: string | undefined }> {
  if (typeof window === "undefined" || typeof fetch !== "function") {
    return { ok: false };
  }
  try {
    const res = await fetch("/api/telemetry/discord", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        ...event,
        url: window.location.href,
      }),
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { ok?: boolean; ticketId?: string };
    return { ok: Boolean(data.ok), ticketId: data.ticketId };
  } catch {
    return { ok: false };
  }
}
