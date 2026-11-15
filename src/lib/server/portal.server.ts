import { getMode, integrations, panelUrl } from "./config.server";
import { avatarUrl, getAppSession, type DemoState, type SessionData } from "./session.server";
import { decryptText, encryptText, generatePassword, sanitizeUsername } from "./crypto.server";
import * as db from "./db.server";
import * as ptero from "./ptero.server";
import { findPlan, planCostCoins, RENEWAL_DAYS, SERVICES, type ServiceId } from "../services";
import type { DashboardData, ServerView, Subscription, Transaction, TxType } from "../portal-types";
import { DEMO_PROMOS } from "../promos";

export class PortalError extends Error {
  constructor(public code: "UNAUTHENTICATED" | "INSUFFICIENT_COINS" | "NOT_FOUND" | "BAD_REQUEST" | "UNAVAILABLE", message: string) {
    super(message);
  }
}

const uid = () => crypto.randomUUID();
const daysFromNow = (d: number) => new Date(Date.now() + d * 86400000).toISOString();

// ---------------- Demo identity + seed ----------------

export async function buildDemoSession(): Promise<SessionData> {
  const discordId = "1093847562019384756";
  const pw = generatePassword();
  const now = Date.now();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const mc = SERVICES.minecraft.plans[1];
  const bot = SERVICES.discord.plans[0];
  const demo: DemoState = {
    coins: 1000 + 500 - planCostCoins(mc) - planCostCoins(bot),
    pteroUserId: 4821,
    pteroUsername: sanitizeUsername("sparrowpilot", discordId),
    pteroPasswordEnc: await encryptText(pw),
    email: "pilot@example.com",
    subs: [
      {
        id: uid(), pteroServerId: 912, serviceType: "minecraft", planName: mc.name, priceCoins: planCostCoins(mc),
        status: "active", expiresAt: daysFromNow(21), createdAt: iso(9 * 86400000),
        demo: { identifier: "a1f9c2e7", port: 25565, name: "Skyforge SMP", ramMb: mc.ramMb, vcpu: mc.vcpu, diskGb: mc.diskGb },
      },
      {
        id: uid(), pteroServerId: 913, serviceType: "discord", planName: bot.name, priceCoins: planCostCoins(bot),
        status: "active", expiresAt: daysFromNow(4), createdAt: iso(26 * 86400000),
        demo: { identifier: "7b3d0e44", port: 3012, name: "Moderation Bot", ramMb: bot.ramMb, vcpu: bot.vcpu, diskGb: bot.diskGb },
      },
    ],
    txs: [
      { id: uid(), amount: -planCostCoins(mc), type: "purchase", description: `Deployed ${mc.name} (Minecraft)`, createdAt: iso(9 * 86400000) },
      { id: uid(), amount: 500, type: "topup", description: "UPI top-up via Razorpay", createdAt: iso(10 * 86400000) },
      { id: uid(), amount: -planCostCoins(bot), type: "purchase", description: `Deployed ${bot.name} (Discord Bots)`, createdAt: iso(26 * 86400000) },
      { id: uid(), amount: 1000, type: "bonus", description: "Welcome credit (demo)", createdAt: iso(27 * 86400000) },
    ],
    usedPromos: [],
  };
  return { mode: "demo", discordId, username: "sparrowpilot", globalName: "Sparrow Pilot", avatar: null, demo };
}

// ---------------- Live provisioning (Discord login -> Pterodactyl) ----------------

export async function provisionLiveClient(discord: { id: string; username: string; global_name: string | null; avatar: string | null; email: string | null }) {
  let client = await db.findClientByDiscordId(discord.id);
  if (!client) {
    client = await db.insertClient({
      discord_id: discord.id,
      discord_username: discord.username,
      discord_avatar: discord.avatar,
      email: discord.email,
      ptero_user_id: null,
      ptero_username: null,
      ptero_password_enc: null,
    });
  } else {
    client = await db.updateClient(client.id, { discord_username: discord.username, discord_avatar: discord.avatar, email: discord.email ?? client.email });
  }
  if (!client.ptero_user_id) {
    const email = discord.email ?? `discord-${discord.id}@users.sparrowx.net`;
    const password = generatePassword();
    const existing = await ptero.findUserByEmail(email);
    const user = existing
      ? await ptero.setUserPassword(existing.id, password).then(() => existing)
      : await ptero.createUser({ email, username: sanitizeUsername(discord.username, discord.id), firstName: discord.global_name ?? discord.username, password });
    client = await db.updateClient(client.id, {
      ptero_user_id: user.id,
      ptero_username: user.username,
      ptero_password_enc: await encryptText(password),
    });
  }
  return client;
}

// ---------------- Context ----------------

async function ctx() {
  const session = await getAppSession();
  const d = session.data;
  if (!d.discordId) throw new PortalError("UNAUTHENTICATED", "Please log in with Discord");
  const mode = getMode();
  if (d.mode === "demo" && d.demo) return { session, d, mode: "demo" as const, demo: d.demo };
  if (d.mode === "live" && d.clientId && mode === "live") return { session, d, mode: "live" as const, clientId: d.clientId };
  throw new PortalError("UNAUTHENTICATED", "Session expired, please log in again");
}

type Ctx = Awaited<ReturnType<typeof ctx>>;

async function saveDemo(c: Ctx & { mode: "demo" }, demo: DemoState) {
  demo.txs = demo.txs.slice(0, 10);
  demo.subs = demo.subs.slice(0, 6);
  await c.session.update({ ...c.d, demo });
}

export async function sessionSummary() {
  const s = await getAppSession();
  if (!s.data.discordId) return null;
  return { username: s.data.globalName ?? s.data.username ?? "Player", avatarUrl: avatarUrl(s.data.discordId, s.data.avatar) };
}

export async function dashboard(): Promise<DashboardData> {
  const c = await ctx();
  const user = { discordId: c.d.discordId!, username: c.d.username!, globalName: c.d.globalName ?? null, avatarUrl: avatarUrl(c.d.discordId!, c.d.avatar) };
  if (c.mode === "demo") {
    return { mode: "demo", user, coins: c.demo.coins, panel: { url: panelUrl(), username: c.demo.pteroUsername, hasPassword: true, email: c.demo.email }, integrations: integrations() };
  }
  const client = await db.getClient(c.clientId);
  if (!client) throw new PortalError("UNAUTHENTICATED", "Account not found");
  return {
    mode: "live",
    user,
    coins: client.coins,
    panel: { url: panelUrl(), username: client.ptero_username, hasPassword: !!client.ptero_password_enc, email: client.email },
    integrations: integrations(),
  };
}

export async function revealPassword(): Promise<string> {
  const c = await ctx();
  if (c.mode === "demo") return decryptText(c.demo.pteroPasswordEnc);
  const client = await db.getClient(c.clientId);
  if (!client?.ptero_password_enc) throw new PortalError("NOT_FOUND", "No panel password stored yet — use Sync / Reset");
  return decryptText(client.ptero_password_enc);
}

export async function resetPassword(): Promise<string> {
  const c = await ctx();
  const pw = generatePassword();
  if (c.mode === "demo") {
    await saveDemo(c, { ...c.demo, pteroPasswordEnc: await encryptText(pw) });
    return pw;
  }
  const client = await db.getClient(c.clientId);
  if (!client?.ptero_user_id) throw new PortalError("NOT_FOUND", "Panel account not linked yet");
  await ptero.setUserPassword(client.ptero_user_id, pw);
  await db.updateClient(client.id, { ptero_password_enc: await encryptText(pw) });
  return pw;
}

export async function transactions(): Promise<Transaction[]> {
  const c = await ctx();
  if (c.mode === "demo") return c.demo.txs;
  return db.listTransactions(c.clientId);
}

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export async function servers(): Promise<ServerView[]> {
  const c = await ctx();
  const base = panelUrl();
  if (c.mode === "demo") {
    const tick = Math.floor(Date.now() / 5000);
    return c.demo.subs.map((s) => {
      const m = s.demo!;
      const age = Date.now() - new Date(s.createdAt).getTime();
      const installing = age < 45_000;
      const wobble = (hash(m.identifier + tick) % 100) / 100;
      return {
        id: String(s.pteroServerId), identifier: m.identifier, name: m.name, service: s.serviceType, planName: s.planName,
        status: installing ? "INSTALLING" : "ONLINE",
        address: `103.174.${(hash(m.identifier) % 200) + 20}.${(hash(m.name) % 200) + 20}:${m.port}`,
        ramLimitMb: m.ramMb, ramUsedMb: installing ? 0 : Math.round(m.ramMb * (0.38 + wobble * 0.3)),
        cpuLimit: Math.round(m.vcpu * 100), cpuUsed: installing ? 0 : Math.round(m.vcpu * 100 * (0.12 + wobble * 0.35)),
        diskLimitGb: m.diskGb, expiresAt: s.expiresAt, manageUrl: `${base}/server/${m.identifier}`,
      };
    });
  }
  const client = await db.getClient(c.clientId);
  if (!client?.ptero_user_id) return [];
  const [live, subs] = await Promise.all([ptero.listUserServers(client.ptero_user_id), db.listSubscriptions(client.id)]);
  return live.map((s) => {
    const sub = subs.find((x) => x.pteroServerId === s.id);
    return {
      id: String(s.id), identifier: s.identifier, name: s.name, service: sub?.serviceType ?? null, planName: sub?.planName ?? null,
      status: s.status, address: s.address, ramLimitMb: s.ramLimitMb, ramUsedMb: s.ramUsedMb, cpuLimit: s.cpuLimit, cpuUsed: s.cpuUsed,
      diskLimitGb: s.diskLimitGb, expiresAt: sub?.expiresAt ?? null, manageUrl: `${base}/server/${s.identifier}`,
    };
  });
}

export async function deploy(planId: string, serverName: string) {
  const found = findPlan(planId);
  if (!found) throw new PortalError("BAD_REQUEST", "Unknown plan");
  const { service, plan } = found;
  const cost = planCostCoins(plan);
  const name = serverName.trim() || `${plan.name} Server`;
  const c = await ctx();

  if (c.mode === "demo") {
    if (c.demo.coins < cost) throw new PortalError("INSUFFICIENT_COINS", `You need ${cost - c.demo.coins} more SparrowCoins`);
    const id = 900 + c.demo.subs.length + Math.floor(Math.random() * 90);
    const sub: Subscription = {
      id: uid(), pteroServerId: id, serviceType: service.id, planName: plan.name, priceCoins: cost, status: "active",
      expiresAt: daysFromNow(RENEWAL_DAYS), createdAt: new Date().toISOString(),
      demo: { identifier: uid().slice(0, 8), port: { fivem: 30120, samp: 7777, minecraft: 25565, discord: 3000 }[service.id] + c.demo.subs.length, name, ramMb: plan.ramMb, vcpu: plan.vcpu, diskGb: plan.diskGb },
    };
    const tx: Transaction = { id: uid(), amount: -cost, type: "purchase", description: `Deployed ${plan.name} (${service.name})`, createdAt: sub.createdAt };
    const demo = { ...c.demo, coins: c.demo.coins - cost, subs: [sub, ...c.demo.subs], txs: [tx, ...c.demo.txs] };
    await saveDemo(c, demo);
    return { coins: demo.coins, serverName: name };
  }

  const client = await db.getClient(c.clientId);
  if (!client?.ptero_user_id) throw new PortalError("NOT_FOUND", "Panel account not linked yet");
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
      client_id: client.id, ptero_server_id: srv.id, service_type: service.id, plan_name: plan.name,
      price_coins: cost, status: "active", expires_at: daysFromNow(RENEWAL_DAYS),
    });
    return { coins: balance, serverName: name };
  } catch (e) {
    const refund = await db.creditCoins(client.id, cost, "refund", `Refund: ${plan.name} deploy failed`, `refund:${uid()}`);
    console.error("Deploy failed, refunded", e);
    throw new PortalError("UNAVAILABLE", `Deployment failed and ${cost} coins were refunded (balance ${refund.balance}). ${e instanceof Error ? e.message : ""}`);
  }
}

export async function redeemPromo(rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  const c = await ctx();
  if (c.mode === "demo") {
    const coins = DEMO_PROMOS[code];
    if (!coins) throw new PortalError("NOT_FOUND", "That promo code isn't valid");
    if (c.demo.usedPromos.includes(code)) throw new PortalError("BAD_REQUEST", "You've already redeemed this code");
    const tx: Transaction = { id: uid(), amount: coins, type: "promo", description: `Promo code ${code}`, createdAt: new Date().toISOString() };
    const demo = { ...c.demo, coins: c.demo.coins + coins, txs: [tx, ...c.demo.txs], usedPromos: [...c.demo.usedPromos, code] };
    await saveDemo(c, demo);
    return { coins: demo.coins, added: coins };
  }
  const promo = await db.findPromo(code);
  if (!promo) throw new PortalError("NOT_FOUND", "That promo code isn't valid");
  const r = await db.creditCoins(c.clientId, promo.coins, "promo", `Promo code ${code}`, `promo:${code}:${c.clientId}`);
  if (!r.applied) throw new PortalError("BAD_REQUEST", "You've already redeemed this code");
  return { coins: r.balance, added: promo.coins };
}

/** Demo-only instant top-up (simulated UPI). */
export async function demoTopup(amount: number) {
  const c = await ctx();
  if (c.mode !== "demo") throw new PortalError("BAD_REQUEST", "Use the payment checkout");
  const tx: Transaction = { id: uid(), amount, type: "topup", description: "UPI top-up (demo payment)", createdAt: new Date().toISOString() };
  const demo = { ...c.demo, coins: c.demo.coins + amount, txs: [tx, ...c.demo.txs] };
  await saveDemo(c, demo);
  return { coins: demo.coins };
}

export async function liveClientId(): Promise<string> {
  const c = await ctx();
  if (c.mode !== "live") throw new PortalError("BAD_REQUEST", "Not available in demo mode");
  return c.clientId;
}

export async function creditTopup(clientId: string, coins: number, paymentId: string) {
  return db.creditCoins(clientId, coins, "topup" as TxType, "UPI / card top-up via Razorpay", `razorpay:${paymentId}`);
}

export type { ServiceId };
