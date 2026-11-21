import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import { integrations, panelUrl } from "./config.server";
import { decryptText, encryptText, generatePassword, sanitizeUsername } from "./crypto.server";
import * as db from "./db.server";
import * as ptero from "./ptero.server";
import {
  MASTER_SSO_COOKIE_NAME,
  UNIFIED_CLIENT_SESSION_COOKIE_NAME,
  extractCookieValue,
  verifyMasterSsoToken,
  type MasterSsoClaims,
} from "./master-sso.server";
import { findPlan, planCostCoins, RENEWAL_DAYS, type ServiceId } from "../services";
import type { DashboardData, ServerView, Transaction, TxType } from "../portal-types";

export class PortalError extends Error {
  constructor(
    public code: "UNAUTHENTICATED" | "INSUFFICIENT_COINS" | "NOT_FOUND" | "BAD_REQUEST" | "UNAVAILABLE",
    message: string,
  ) {
    super(message);
  }
}

const uid = () => crypto.randomUUID();
const daysFromNow = (d: number) => new Date(Date.now() + d * 86400000).toISOString();

// ---------------- Authenticated Google / Master SSO Context ----------------

async function readAuthenticatedGoogleUser(): Promise<MasterSsoClaims | null> {
  try {
    const cookieHeader = getRequestHeader("cookie") ?? null;
    const rawCookie =
      getCookie(MASTER_SSO_COOKIE_NAME) ||
      extractCookieValue(cookieHeader, MASTER_SSO_COOKIE_NAME);
    if (rawCookie) {
      const verified = await verifyMasterSsoToken(rawCookie);
      if (verified) return verified;
    }

    const unifiedRaw =
      getCookie(UNIFIED_CLIENT_SESSION_COOKIE_NAME) ||
      extractCookieValue(cookieHeader, UNIFIED_CLIENT_SESSION_COOKIE_NAME);
    if (unifiedRaw) {
      const parts = unifiedRaw.split(".");
      if (parts.length === 3 && parts[1]) {
        const decoded = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8")) as {
          sub?: string;
          email?: string;
          fullName?: string;
          role?: "admin" | "client";
          tenantId?: string | null;
          expiresAt?: number;
        };
        if (
          decoded.sub &&
          decoded.email &&
          typeof decoded.expiresAt === "number" &&
          decoded.expiresAt > Date.now()
        ) {
          return {
            sub: decoded.sub,
            email: decoded.email.trim().toLowerCase(),
            fullName: decoded.fullName || decoded.email.split("@")[0] || "Player",
            role: decoded.role === "admin" ? "admin" : "client",
            tenantId: decoded.tenantId ?? null,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(decoded.expiresAt / 1000),
          };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function requireGoogleUser(): Promise<MasterSsoClaims> {
  const claims = await readAuthenticatedGoogleUser();
  if (!claims) {
    throw new PortalError("UNAUTHENTICATED", "Please sign in with Google");
  }
  return claims;
}

/**
 * Ensures the signed-in Google user has a real `public.clients` record (and Pterodactyl
 * panel user when Pterodactyl API is configured). Never fabricates mock records.
 */
export async function resolveLiveClient(claims: MasterSsoClaims): Promise<db.ClientRow | null> {
  const ints = integrations();
  if (!ints.database) return null;

  const email = claims.email.trim().toLowerCase();
  const externalKey = `google:${claims.sub}`;
  const displayName = claims.fullName || email.split("@")[0] || "player";

  try {
    let client =
      (await db.findClientByEmail(email)) ??
      (await db.findClientByDiscordId(externalKey));

    if (!client) {
      client = await db.insertClient({
        discord_id: externalKey,
        discord_username: displayName,
        discord_avatar: null,
        email,
        ptero_user_id: null,
        ptero_username: null,
        ptero_password_enc: null,
      });
    } else if (client.email !== email || client.discord_username !== displayName) {
      client = await db.updateClient(client.id, {
        discord_username: displayName,
        email,
      });
    }

    if (!client.ptero_user_id && ints.pterodactyl) {
      try {
        const password = generatePassword();
        const existing = await ptero.findUserByEmail(email);
        const pteroUser = existing
          ? await ptero.setUserPassword(existing.id, password).then(() => existing)
          : await ptero.createUser({
              email,
              username: sanitizeUsername(displayName, claims.sub),
              firstName: displayName,
              password,
            });
        client = await db.updateClient(client.id, {
          ptero_user_id: pteroUser.id,
          ptero_username: pteroUser.username,
          ptero_password_enc: await encryptText(password),
        });
      } catch (err) {
        console.warn("[SparrowX Game Portal] Pterodactyl user auto-sync deferred:", err);
      }
    }

    return client;
  } catch (err) {
    console.warn("[SparrowX Game Portal] Live PostgREST client lookup unavailable:", err);
    return null;
  }
}

export async function sessionSummary() {
  const claims = await readAuthenticatedGoogleUser();
  if (!claims) return null;
  return {
    id: claims.sub,
    email: claims.email,
    username: claims.fullName || claims.email.split("@")[0] || "Player",
    avatarUrl: null as string | null,
  };
}

export async function dashboard(): Promise<DashboardData> {
  const claims = await requireGoogleUser();
  const ints = integrations();
  const client = await resolveLiveClient(claims);
  const username = claims.email.split("@")[0] || "player";

  return {
    mode: "live",
    user: {
      id: claims.sub,
      email: claims.email,
      username,
      globalName: claims.fullName || username,
      avatarUrl: null,
    },
    coins: client?.coins ?? 0,
    panel: {
      url: panelUrl(),
      username: client?.ptero_username ?? null,
      hasPassword: Boolean(client?.ptero_password_enc),
      email: client?.email ?? claims.email,
    },
    integrations: ints,
  };
}

export async function revealPassword(): Promise<string> {
  const claims = await requireGoogleUser();
  const client = await resolveLiveClient(claims);
  if (!client?.ptero_password_enc) {
    throw new PortalError("NOT_FOUND", "No panel password stored yet — connect Pterodactyl and click Sync / Reset");
  }
  return decryptText(client.ptero_password_enc);
}

export async function resetPassword(): Promise<string> {
  const claims = await requireGoogleUser();
  const client = await resolveLiveClient(claims);
  if (!client?.ptero_user_id) {
    throw new PortalError("NOT_FOUND", "Pterodactyl panel account is not linked yet");
  }
  const pw = generatePassword();
  await ptero.setUserPassword(client.ptero_user_id, pw);
  await db.updateClient(client.id, { ptero_password_enc: await encryptText(pw) });
  return pw;
}

export async function transactions(): Promise<Transaction[]> {
  const claims = await requireGoogleUser();
  const client = await resolveLiveClient(claims);
  if (!client) return [];
  return db.listTransactions(client.id);
}

export async function servers(): Promise<ServerView[]> {
  const claims = await requireGoogleUser();
  const client = await resolveLiveClient(claims);
  if (!client?.ptero_user_id || !integrations().pterodactyl) return [];

  const base = panelUrl();
  const [live, subs] = await Promise.all([
    ptero.listUserServers(client.ptero_user_id),
    db.listSubscriptions(client.id),
  ]);
  return live.map((s) => {
    const sub = subs.find((x) => x.pteroServerId === s.id);
    return {
      id: String(s.id),
      identifier: s.identifier,
      name: s.name,
      service: sub?.serviceType ?? null,
      planName: sub?.planName ?? null,
      status: s.status,
      address: s.address,
      ramLimitMb: s.ramLimitMb,
      ramUsedMb: s.ramUsedMb,
      cpuLimit: s.cpuLimit,
      cpuUsed: s.cpuUsed,
      diskLimitGb: s.diskLimitGb,
      expiresAt: sub?.expiresAt ?? null,
      manageUrl: `${base}/server/${s.identifier}`,
    };
  });
}

export async function deploy(planId: string, serverName: string) {
  const found = findPlan(planId);
  if (!found) throw new PortalError("BAD_REQUEST", "Unknown plan");
  const { service, plan } = found;
  const cost = planCostCoins(plan);
  const name = serverName.trim() || `${plan.name} Server`;

  const claims = await requireGoogleUser();
  const client = await resolveLiveClient(claims);
  if (!client?.ptero_user_id) {
    throw new PortalError(
      "UNAVAILABLE",
      "Pterodactyl game panel & sovereign database must be connected before deploying a server.",
    );
  }

  let balance: number;
  try {
    balance = await db.spendCoins(client.id, cost, `Deployed ${plan.name} (${service.name})`);
  } catch (e) {
    if (e instanceof db.DbError && e.body.includes("insufficient_coins")) {
      throw new PortalError("INSUFFICIENT_COINS", `You need ${cost - client.coins} more SparrowCoins`);
    }
    throw e;
  }

  try {
    const srv = await ptero.createServer({ userId: client.ptero_user_id, name, service: service.id, plan });
    await db.insertSubscription({
      client_id: client.id,
      ptero_server_id: srv.id,
      service_type: service.id,
      plan_name: plan.name,
      price_coins: cost,
      status: "active",
      expires_at: daysFromNow(RENEWAL_DAYS),
    });
    return { coins: balance, serverName: name };
  } catch (e) {
    const refund = await db.creditCoins(
      client.id,
      cost,
      "refund",
      `Refund: ${plan.name} deploy failed`,
      `refund:${uid()}`,
    );
    console.error("Deploy failed, refunded", e);
    throw new PortalError(
      "UNAVAILABLE",
      `Deployment failed and ${cost} coins were refunded (balance ${refund.balance}). ${e instanceof Error ? e.message : ""}`,
    );
  }
}

export async function redeemPromo(rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  const claims = await requireGoogleUser();
  const client = await resolveLiveClient(claims);
  if (!client) {
    throw new PortalError("UNAVAILABLE", "Database connection is required to redeem promo codes.");
  }
  const promo = await db.findPromo(code);
  if (!promo) throw new PortalError("NOT_FOUND", "That promo code isn't valid");
  const r = await db.creditCoins(
    client.id,
    promo.coins,
    "promo",
    `Promo code ${code}`,
    `promo:${code}:${client.id}`,
  );
  if (!r.applied) throw new PortalError("BAD_REQUEST", "You've already redeemed this code");
  return { coins: r.balance, added: promo.coins };
}

export async function liveClientId(): Promise<string> {
  const claims = await requireGoogleUser();
  const client = await resolveLiveClient(claims);
  if (!client) {
    throw new PortalError("UNAVAILABLE", "Database connection is not active on this server.");
  }
  return client.id;
}

export async function creditTopup(clientId: string, coins: number, paymentId: string) {
  return db.creditCoins(
    clientId,
    coins,
    "topup" as TxType,
    "UPI / card top-up via Razorpay",
    `razorpay:${paymentId}`,
  );
}

export async function getPanelSsoIdentity(
  request?: Request,
): Promise<null | { mode: "live"; pteroUserId: number | null; username: string; email: string }> {
  let claims: MasterSsoClaims | null = null;
  if (request) {
    const { readMasterSsoFromRequest } = await import("./master-sso.server");
    claims = await readMasterSsoFromRequest(request);
  } else {
    claims = await readAuthenticatedGoogleUser();
  }
  if (!claims) return null;

  const client = await resolveLiveClient(claims);
  return {
    mode: "live",
    pteroUserId: client?.ptero_user_id ?? null,
    username: client?.ptero_username ?? claims.email.split("@")[0] ?? "player",
    email: client?.email ?? claims.email,
  };
}

export async function getPanelLaunchInfo() {
  const claims = await requireGoogleUser();
  const { isPteroSsoReady } = await import("./ptero-sso.server");
  const base = panelUrl();
  const client = await resolveLiveClient(claims);
  const ssoReady = client?.ptero_user_id ? await isPteroSsoReady(base) : false;
  return {
    mode: "live" as const,
    panelUrl: base,
    username: client?.ptero_username ?? null,
    email: client?.email ?? claims.email,
    ssoReady,
  };
}

export async function powerAction(identifier: string, signal: "start" | "stop" | "restart") {
  const claims = await requireGoogleUser();
  const client = await resolveLiveClient(claims);
  if (!client?.ptero_user_id) {
    throw new PortalError("NOT_FOUND", "Pterodactyl panel account is not linked yet");
  }
  const owned = await ptero.listUserServers(client.ptero_user_id);
  if (!owned.some((s) => s.identifier === identifier)) {
    throw new PortalError("BAD_REQUEST", "Server does not belong to your account");
  }
  try {
    await ptero.sendServerPower(identifier, signal);
    return { ok: true, signal, identifier, message: `Power signal (${signal}) sent to ${identifier}` };
  } catch (e) {
    throw new PortalError("UNAVAILABLE", e instanceof Error ? e.message : "Unable to send power signal");
  }
}

export type { ServiceId };
