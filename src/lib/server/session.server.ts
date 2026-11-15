import {
  useSession as getH3Session,
  getRequestHost,
  getRequestProtocol,
} from "@tanstack/react-start/server";
import { sessionSecret } from "./config.server";
import type { Subscription, Transaction } from "../portal-types";

export type DemoState = {
  coins: number;
  pteroUserId: number;
  pteroUsername: string;
  pteroPasswordEnc: string;
  email: string;
  subs: Subscription[];
  txs: Transaction[];
  usedPromos: string[];
};

export type SessionData = {
  mode?: "live" | "demo";
  discordId?: string;
  username?: string;
  globalName?: string | null;
  avatar?: string | null;
  clientId?: string;
  oauthState?: string;
  nextPlan?: string;
  oauthOrigin?: string;
  demo?: DemoState;
};

function resolveCookieDomain(host: string | undefined): string | undefined {
  if (!host) return undefined;
  const cleanHost = host.split(":")[0]?.toLowerCase() ?? "";
  if (cleanHost === "sparrowx.net" || cleanHost.endsWith(".sparrowx.net")) {
    return ".sparrowx.net";
  }
  return undefined;
}

function sessionConfig() {
  let isHttps = process.env.NODE_ENV === "production";
  let host: string | undefined;
  try {
    const proto = getRequestProtocol({ xForwardedProto: true });
    isHttps = proto === "https";
    host = getRequestHost({ xForwardedHost: true });
  } catch {
    // Fallback outside request context (e.g. direct unit tests)
  }
  const domain = resolveCookieDomain(host);
  return {
    password: sessionSecret(),
    name: "sx_session",
    maxAge: 60 * 60 * 24 * 14,
    cookie: {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax" as const,
      path: "/",
      ...(domain ? { domain } : {}),
    },
  };
}

export async function getAppSession() {
  return getH3Session<SessionData>(sessionConfig());
}

export function avatarUrl(discordId: string, avatar: string | null | undefined): string {
  if (avatar) return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=128`;
  const idx = Number((BigInt(discordId) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}
