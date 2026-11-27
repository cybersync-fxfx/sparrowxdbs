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
  description?: string | null;
  service: ServiceId | null;
  planName: string | null;
  nestId?: number | null;
  eggId?: number | null;
  eggName?: string | null;
  dockerImage?: string | null;
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

export type EggVariableView = {
  name: string;
  description: string;
  envVariable: string;
  defaultValue: string;
  serverValue: string;
  userViewable: boolean;
  userEditable: boolean;
  rules: string;
};

export type EggDetailsView = {
  nestId: number;
  eggId: number;
  name: string;
  description: string;
  dockerImage: string;
  dockerImages: Record<string, string>;
  startup: string;
  variables: EggVariableView[];
};

export type ServerConfigView = {
  serverId: number;
  identifier: string;
  name: string;
  description: string;
  nestId: number;
  nestName: string;
  eggId: number;
  eggName: string;
  startup: string;
  dockerImage: string;
  dockerImages: Record<string, string>;
  variables: EggVariableView[];
  limits: {
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number;
  };
  featureLimits: {
    databases: number;
    allocations: number;
    backups: number;
  };
  address: string | null;
  panelUrl: string;
};

export type DashboardData = {
  mode: "live";
  isAdmin: boolean;
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

export type AdminClientSummary = {
  id: string;
  email: string | null;
  username: string;
  pteroUserId: number | null;
  pteroUsername: string | null;
  coins: number;
  createdAt: string;
  subscriptionCount: number;
  activeSubscriptions: number;
  isAdmin?: boolean;
  isPrimaryAdmin?: boolean;
};

export type AdminSubscriptionSummary = {
  id: string;
  clientId: string;
  clientEmail: string | null;
  clientUsername: string;
  pteroServerId: number | null;
  serviceType: ServiceId;
  planName: string;
  priceCoins: number;
  status: Subscription["status"];
  expiresAt: string;
  createdAt: string;
};

export type AdminTransactionSummary = {
  id: string;
  clientId: string;
  clientEmail: string | null;
  amount: number;
  type: TxType;
  description: string;
  createdAt: string;
};

export type AdminOverviewData = {
  adminEmail: string;
  stats: {
    totalClients: number;
    totalCoins: number;
    activeSubscriptions: number;
    expiredSubscriptions: number;
    monthlyCoinVolume: number;
  };
  clients: AdminClientSummary[];
  subscriptions: AdminSubscriptionSummary[];
  recentTransactions: AdminTransactionSummary[];
};
