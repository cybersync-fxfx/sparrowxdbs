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
import type { DashboardData, ServerView, Subscription, Transaction, TxType } from "../portal-types";

type DirectPteroCacheEntry = {
  pteroUserId: number;
  pteroUsername: string;
  email: string;
  passwordEnc: string | null;
};

// Process-level fallback cache so Pterodactyl auto-sync, reveal & password reset
// keep working seamlessly even when PostgREST is offline or unconfigured.
const directPteroCache = new Map<string, DirectPteroCacheEntry>();
const lastPteroSyncErrors = new Map<string, string>();

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

async function tryDecrypt(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  try {
    return await decryptText(stored);
  } catch {
    return null;
  }
}

/**
 * Ensures the signed-in Google user is matched to the exact live Pterodactyl user
 * (by verified ID or exact email), fixing any stale/mismatched username or ID in DB.
 */
async function syncLivePteroUser(
  claims: MasterSsoClaims,
  client: db.ClientRow | null,
): Promise<{
  client: db.ClientRow | null;
  pteroUserId: number;
  pteroUsername: string;
  email: string;
  passwordEnc: string | null;
} | null> {
  if (!integrations().pterodactyl) {
    lastPteroSyncErrors.set(
      claims.email.trim().toLowerCase(),
      "PTERO_APPLICATION_API_KEY is not configured on the server yet. Run ovh/update.sh to auto-sync the Game Panel API key.",
    );
    return null;
  }

  const email = claims.email.trim().toLowerCase();
  const displayName = claims.fullName || email.split("@")[0] || "player";
  const cached = directPteroCache.get(email);

  try {
    let liveUser: Awaited<ReturnType<typeof ptero.getUserById>> = null;
    const candidateId = client?.ptero_user_id ?? cached?.pteroUserId ?? null;

    if (candidateId) {
      const byId = await ptero.getUserById(candidateId).catch(() => null);
      if (byId && byId.email.trim().toLowerCase() === email) {
        liveUser = byId;
      }
    }

    if (!liveUser) {
      liveUser = await ptero.findUserByEmail(email);
    }

    let passwordEnc: string | null = cached?.passwordEnc ?? client?.ptero_password_enc ?? null;
    if (passwordEnc && !(await tryDecrypt(passwordEnc))) {
      passwordEnc = null;
    }

    if (!liveUser) {
      const freshPassword = generatePassword();
      liveUser = await ptero.createUser({
        email,
        username: sanitizeUsername(displayName, claims.sub),
        firstName: displayName,
        password: freshPassword,
      });
      passwordEnc = await encryptText(freshPassword);
    }

    let updatedClient = client;
    if (
      updatedClient &&
      (updatedClient.ptero_user_id !== liveUser.id ||
        updatedClient.ptero_username !== liveUser.username ||
        (passwordEnc && updatedClient.ptero_password_enc !== passwordEnc))
    ) {
      updatedClient = await db
        .updateClient(updatedClient.id, {
          ptero_user_id: liveUser.id,
          ptero_username: liveUser.username,
          ...(passwordEnc ? { ptero_password_enc: passwordEnc } : {}),
        })
        .catch(() => updatedClient);
    }

    directPteroCache.set(email, {
      pteroUserId: liveUser.id,
      pteroUsername: liveUser.username,
      email: liveUser.email,
      passwordEnc,
    });
    lastPteroSyncErrors.delete(email);

    return {
      client: updatedClient,
      pteroUserId: liveUser.id,
      pteroUsername: liveUser.username,
      email: liveUser.email,
      passwordEnc,
    };
  } catch (err) {
    const msg =
      err instanceof ptero.PteroError
        ? `Game Panel API returned HTTP ${err.status}. Verify PTERO_APPLICATION_API_KEY permissions (Users Read+Write).`
        : "Unable to reach Pterodactyl Game Panel API.";
    lastPteroSyncErrors.set(email, msg);
    return null;
  }
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

    if (ints.pterodactyl) {
      const synced = await syncLivePteroUser(claims, client);
      if (synced?.client) {
        client = synced.client;
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

/**
 * Ensures the signed-in Google user has a live Pterodactyl account under their exact
 * Google email ID even if PostgREST is offline.
 */
async function ensureDirectPteroAccount(claims: MasterSsoClaims): Promise<DirectPteroCacheEntry | null> {
  const synced = await syncLivePteroUser(claims, null);
  if (!synced) return null;
  return {
    pteroUserId: synced.pteroUserId,
    pteroUsername: synced.pteroUsername,
    email: synced.email,
    passwordEnc: synced.passwordEnc,
  };
}

export async function dashboard(): Promise<DashboardData> {
  const claims = await requireGoogleUser();
  const ints = integrations();
  const client = await resolveLiveClient(claims);
  const directPtero = !client?.ptero_user_id ? await ensureDirectPteroAccount(claims) : null;
  const cachedDirect = directPteroCache.get(claims.email.trim().toLowerCase()) ?? directPtero;
  const username = claims.email.split("@")[0] || "player";

  const hasValidPassword = Boolean(
    (await tryDecrypt(cachedDirect?.passwordEnc)) || (await tryDecrypt(client?.ptero_password_enc)),
  );

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
      username: cachedDirect?.pteroUsername ?? client?.ptero_username ?? null,
      hasPassword: hasValidPassword,
      email: cachedDirect?.email ?? client?.email ?? claims.email,
    },
    integrations: ints,
  };
}

export async function revealPassword(): Promise<string> {
  const claims = await requireGoogleUser();
  const email = claims.email.trim().toLowerCase();

  // Check freshest in-memory cache first (guaranteed up-to-date right after a password reset)
  const cached = directPteroCache.get(email);
  const fromCache = await tryDecrypt(cached?.passwordEnc);
  if (fromCache) return fromCache;

  const client = await resolveLiveClient(claims);
  const fromDb = await tryDecrypt(client?.ptero_password_enc);
  if (fromDb) return fromDb;

  const direct = await ensureDirectPteroAccount(claims);
  const fromDirect = await tryDecrypt(direct?.passwordEnc);
  if (fromDirect) return fromDirect;

  throw new PortalError(
    "NOT_FOUND",
    "No panel password saved yet for this account — click Reset Password to generate and view a synced password.",
  );
}

export async function resetPassword(
  customPassword?: string,
): Promise<{ password: string; username: string; email: string }> {
  const claims = await requireGoogleUser();
  const email = claims.email.trim().toLowerCase();
  const client = await resolveLiveClient(claims);
  const synced = await syncLivePteroUser(claims, client);

  const pteroUserId = synced?.pteroUserId ?? client?.ptero_user_id ?? null;
  if (!pteroUserId) {
    throw new PortalError(
      "NOT_FOUND",
      "Pterodactyl panel account is not linked yet (check PTERO_URL and PTERO_APPLICATION_API_KEY).",
    );
  }

  const pw = customPassword?.trim() || generatePassword();
  if (pw.length < 8 || pw.length > 64) {
    throw new PortalError("BAD_REQUEST", "Password must be between 8 and 64 characters");
  }

  const updatedUser = await ptero.setUserPassword(pteroUserId, pw);
  const enc = await encryptText(pw);

  if (client) {
    await db
      .updateClient(client.id, {
        ptero_user_id: updatedUser.id,
        ptero_username: updatedUser.username,
        ptero_password_enc: enc,
      })
      .catch((err) => {
        console.warn("[SparrowX Game Portal] Failed to persist updated panel password to DB:", err);
      });
  }

  directPteroCache.set(email, {
    pteroUserId: updatedUser.id,
    pteroUsername: updatedUser.username,
    email: updatedUser.email,
    passwordEnc: enc,
  });

  return {
    password: pw,
    username: updatedUser.username,
    email: updatedUser.email,
  };
}

export async function subscriptions(): Promise<Subscription[]> {
  const claims = await requireGoogleUser();
  const client = await resolveLiveClient(claims);
  if (!client) return [];
  return db.listSubscriptions(client.id);
}

export async function renewSubscription(subscriptionId: string, days = RENEWAL_DAYS) {
  const claims = await requireGoogleUser();
  const client = await resolveLiveClient(claims);
  if (!client) {
    throw new PortalError("UNAVAILABLE", "Database connection is required to renew subscriptions.");
  }
  const subs = await db.listSubscriptions(client.id);
  const sub = subs.find((s) => s.id === subscriptionId);
  if (!sub) {
    throw new PortalError("NOT_FOUND", "Subscription not found on your account.");
  }
  const cost = Math.max(1, Math.round((sub.priceCoins * days) / RENEWAL_DAYS));
  let balance: number;
  try {
    balance = await db.spendCoins(
      client.id,
      cost,
      `Renewed ${sub.planName} (${sub.serviceType}) for +${days} days`,
    );
  } catch (e) {
    if (e instanceof db.DbError && e.body.includes("insufficient_coins")) {
      throw new PortalError("INSUFFICIENT_COINS", `You need ${Math.max(1, cost - client.coins)} more SparrowCoins to renew`);
    }
    throw e;
  }

  const baseTime = Math.max(Date.now(), new Date(sub.expiresAt).getTime());
  const nextExpiry = new Date(baseTime + days * 86400000).toISOString();
  const updated = await db.updateSubscription(sub.id, {
    status: "active",
    expires_at: nextExpiry,
  });

  if (sub.pteroServerId && integrations().pterodactyl) {
    await ptero.unsuspendServer(sub.pteroServerId).catch(() => {});
  }

  return { coins: balance, subscription: updated };
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
  const direct = !client?.ptero_user_id ? await ensureDirectPteroAccount(claims) : null;
  const pteroUserId = client?.ptero_user_id ?? direct?.pteroUserId ?? null;
  if (!pteroUserId || !integrations().pterodactyl) return [];

  const base = panelUrl();
  const [live, subs] = await Promise.all([
    ptero.listUserServers(pteroUserId),
    client ? db.listSubscriptions(client.id).catch(() => []) : Promise.resolve([]),
  ]);
  return live.map((s) => {
    const sub = subs.find((x) => x.pteroServerId === s.id);
    return {
      id: String(s.id),
      identifier: s.identifier,
      name: s.name,
      description: s.description,
      service: sub?.serviceType ?? null,
      planName: sub?.planName ?? null,
      nestId: s.nestId,
      eggId: s.eggId,
      eggName: s.eggName,
      dockerImage: s.dockerImage,
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

async function requireOwnedServer(serverId: number): Promise<{ pteroUserId: number; server: ptero.LiveServer }> {
  const claims = await requireGoogleUser();
  const client = await resolveLiveClient(claims);
  const direct = !client?.ptero_user_id ? await ensureDirectPteroAccount(claims) : null;
  const pteroUserId = client?.ptero_user_id ?? direct?.pteroUserId ?? null;
  if (!pteroUserId || !integrations().pterodactyl) {
    throw new PortalError("NOT_FOUND", "Pterodactyl panel account is not linked yet.");
  }
  const owned = await ptero.listUserServers(pteroUserId);
  const server = owned.find((s) => s.id === serverId);
  if (!server) {
    throw new PortalError("BAD_REQUEST", "Server does not belong to your account.");
  }
  return { pteroUserId, server };
}

export async function getEggDetails(nestId?: number, eggId?: number, service?: ServiceId) {
  await requireGoogleUser();
  if (!integrations().pterodactyl) {
    throw new PortalError("UNAVAILABLE", "Game panel API is not configured on this server.");
  }
  let targetNest = nestId;
  let targetEgg = eggId;
  if ((!targetNest || !targetEgg) && service) {
    const def = ptero.resolveDefaultEggForService(service);
    if (!def) {
      throw new PortalError("NOT_FOUND", `Default panel egg for ${service} is not configured yet.`);
    }
    targetNest = def.nest;
    targetEgg = def.egg;
  }
  if (!targetNest || !targetEgg) {
    throw new PortalError("BAD_REQUEST", "Provide nestId & eggId or service.");
  }
  try {
    const details = await ptero.getEggDetails(targetNest, targetEgg);
    return {
      ...details,
      variables: details.variables.filter((v) => v.userViewable),
    };
  } catch (e) {
    throw new PortalError("UNAVAILABLE", e instanceof Error ? e.message : "Unable to load egg configuration");
  }
}

export async function getServerConfig(serverId: number) {
  await requireOwnedServer(serverId);
  try {
    return await ptero.getServerConfig(serverId);
  } catch (e) {
    throw new PortalError("UNAVAILABLE", e instanceof Error ? e.message : "Unable to load live server configuration");
  }
}

export async function updateServerConfig(input: {
  serverId: number;
  name?: string;
  description?: string;
  targetNestId?: number;
  targetEggId?: number;
  dockerImage?: string;
  environment?: Record<string, string>;
  reinstallAfter?: boolean;
  restartAfter?: boolean;
}) {
  const { server } = await requireOwnedServer(input.serverId);
  try {
    if (typeof input.name === "string" && input.name.trim().length > 0) {
      await ptero.updateServerDetails(input.serverId, {
        name: input.name.trim(),
        description: input.description,
      });
    }

    const updated = await ptero.updateServerStartupConfig(input.serverId, {
      targetNestId: input.targetNestId,
      targetEggId: input.targetEggId,
      dockerImage: input.dockerImage,
      environment: input.environment,
    });

    if (input.reinstallAfter) {
      await ptero.reinstallServer(input.serverId);
    } else if (input.restartAfter) {
      await ptero.sendServerPower(server.identifier, "restart").catch(() => {});
    }

    return updated;
  } catch (e) {
    throw new PortalError("UNAVAILABLE", e instanceof Error ? e.message : "Unable to save server configuration to Panel");
  }
}

export async function triggerServerReinstall(serverId: number) {
  await requireOwnedServer(serverId);
  try {
    await ptero.reinstallServer(serverId);
    return { ok: true, message: "Server reinstall queued in Pterodactyl Panel." };
  } catch (e) {
    throw new PortalError("UNAVAILABLE", e instanceof Error ? e.message : "Unable to reinstall server");
  }
}

export async function deploy(
  planId: string,
  serverName: string,
  eggOverride?: {
    nestId: number;
    eggId: number;
    dockerImage?: string;
    environment?: Record<string, string>;
  },
) {
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
    const srv = await ptero.createServer({
      userId: client.ptero_user_id,
      name,
      service: service.id,
      plan,
      ...(eggOverride ? { eggOverride } : {}),
    });
    await db.insertSubscription({
      client_id: client.id,
      ptero_server_id: srv.id,
      service_type: service.id,
      plan_name: plan.name,
      price_coins: cost,
      status: "active",
      expires_at: daysFromNow(RENEWAL_DAYS),
    });
    void import("./discord-webhook.server")
      .then(({ sendDiscordTelemetry }) =>
        sendDiscordTelemetry({
          category: "deploy",
          severity: "info",
          service: "SparrowX Game Hosting",
          title: `Game Server Deployed — ${name}`,
          fields: {
            Email: claims.email,
            Service: service.name,
            Plan: plan.name,
            "Cost (Coins)": `${cost} SparrowCoins`,
            "Balance After": `${balance} SparrowCoins`,
            "Pterodactyl Server ID": srv.id,
            Identifier: srv.identifier,
          },
        }),
      )
      .catch(() => {});
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

/**
 * Proactively provisions/links the Pterodactyl Game Panel user immediately upon
 * signup or sign-in (Google OAuth or Master SSO) so the account already exists
 * in game.panel.sparrowx.net before the user opens the dashboard or panel bridge.
 */
export async function syncPteroAccountOnSignIn(user: {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "client";
  tenantId: string | null;
}): Promise<void> {
  if (!integrations().pterodactyl) return;
  const nowSec = Math.floor(Date.now() / 1000);
  const claims: MasterSsoClaims = {
    sub: user.id,
    email: user.email.trim().toLowerCase(),
    fullName: user.fullName || user.email.split("@")[0] || "Player",
    role: user.role,
    tenantId: user.tenantId,
    iat: nowSec,
    exp: nowSec + 3600,
  };
  const client = await resolveLiveClient(claims).catch(() => null);
  if (!client?.ptero_user_id) {
    await ensureDirectPteroAccount(claims).catch(() => null);
  }
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
  const direct = !client?.ptero_user_id ? await ensureDirectPteroAccount(claims) : null;
  const pteroUserId = client?.ptero_user_id ?? direct?.pteroUserId ?? null;
  const pteroUsername =
    client?.ptero_username ?? direct?.pteroUsername ?? claims.email.split("@")[0] ?? "player";
  return {
    mode: "live",
    pteroUserId,
    username: pteroUsername,
    email: client?.email ?? direct?.email ?? claims.email,
  };
}

export async function getPanelLaunchInfo() {
  const claims = await requireGoogleUser();
  const { isPteroSsoReady } = await import("./ptero-sso.server");
  const base = panelUrl();
  const ints = integrations();
  const email = claims.email.trim().toLowerCase();
  const client = await resolveLiveClient(claims);
  const direct = !client?.ptero_user_id ? await ensureDirectPteroAccount(claims) : null;
  const cachedDirect = directPteroCache.get(email) ?? direct;
  const pteroUserId = client?.ptero_user_id ?? cachedDirect?.pteroUserId ?? null;
  const pteroUsername = client?.ptero_username ?? cachedDirect?.pteroUsername ?? null;
  const hasPassword = Boolean(
    (await tryDecrypt(cachedDirect?.passwordEnc)) || (await tryDecrypt(client?.ptero_password_enc)),
  );
  const ssoReady = pteroUserId ? await isPteroSsoReady(base) : false;
  return {
    mode: "live" as const,
    panelUrl: base,
    username: pteroUsername,
    email: client?.email ?? cachedDirect?.email ?? claims.email,
    pteroLinked: Boolean(pteroUserId),
    pteroConfigured: ints.pterodactyl,
    hasPassword,
    syncError: pteroUserId ? null : (lastPteroSyncErrors.get(email) ?? null),
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
