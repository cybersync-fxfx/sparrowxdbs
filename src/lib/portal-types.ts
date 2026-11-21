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
  mode: "live";
  user: {
    id: string;
    email: string;
    username: string;
    globalName: string | null;
    avatarUrl: string | null;
  };
  coins: number;
  panel: {
    url: string;
    username: string | null;
    hasPassword: boolean;
    email: string | null;
  };
  integrations: {
    database: boolean;
    google: boolean;
    pterodactyl: boolean;
    pteroLiveUsage: boolean;
    razorpay: boolean;
  };
};
