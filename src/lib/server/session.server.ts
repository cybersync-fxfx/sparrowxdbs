import { useSession as getH3Session } from "@tanstack/react-start/server";
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
  demo?: DemoState;
};

function sessionConfig() {
  const password =
    process.env["SESSION_SECRET"] && process.env["SESSION_SECRET"].length >= 32
      ? process.env["SESSION_SECRET"]
      : "sparrowx-game-portal-preview-session-secret-key-2026";
  return {
    password,
    name: "sx_session",
    maxAge: 60 * 60 * 24 * 14,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
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
