import type { ServiceId } from "./services";

export type TxType = "topup" | "promo" | "purchase" | "refund" | "bonus";

export type Transaction = {
  id: string;
  amount: number;
  type: TxType;
  description: string;
  createdAt: string;
};

export type Subscription = {
  id: string;
  pteroServerId: number | null;
  serviceType: ServiceId;
  planName: string;
  priceCoins: number;
  status: "active" | "expired" | "cancelled";
  expiresAt: string;
  createdAt: string;
  /** Demo mode only: mock server details kept with the subscription. */
  demo?: { identifier: string; port: number; name: string; ramMb: number; vcpu: number; diskGb: number };
};

export type ServerStatus = "ONLINE" | "OFFLINE" | "INSTALLING" | "SUSPENDED";

export type ServerView = {
  id: string;
  identifier: string;
  name: string;
  service: ServiceId | null;
  planName: string | null;
  status: ServerStatus;
  address: string | null;
  ramLimitMb: number;
  ramUsedMb: number | null;
  cpuLimit: number;
  cpuUsed: number | null;
  diskLimitGb: number;
  expiresAt: string | null;
  manageUrl: string;
};

export type DashboardData = {
  mode: "live" | "demo";
  user: { discordId: string; username: string; globalName: string | null; avatarUrl: string };
  coins: number;
  panel: { url: string; username: string | null; hasPassword: boolean; email: string | null };
  integrations: {
    database: boolean;
    discord: boolean;
    pterodactyl: boolean;
    pteroLiveUsage: boolean;
    razorpay: boolean;
  };
};
