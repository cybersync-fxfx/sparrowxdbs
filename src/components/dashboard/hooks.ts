import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDashboard, getServers, getSubscriptions, getTransactions } from "@/lib/portal.functions";

export const qk = {
  dashboard: ["dashboard"] as const,
  servers: ["servers"] as const,
  subs: ["subscriptions"] as const,
  txs: ["transactions"] as const,
};

export const useDashboard = () => useQuery({ queryKey: qk.dashboard, queryFn: () => getDashboard() });
export const useServers = () =>
  useQuery({ queryKey: qk.servers, queryFn: () => getServers(), refetchInterval: 15_000 });
export const useSubscriptions = () =>
  useQuery({ queryKey: qk.subs, queryFn: () => getSubscriptions() });
export const useTransactions = () => useQuery({ queryKey: qk.txs, queryFn: () => getTransactions() });

export function useRefreshAll() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.dashboard }),
      qc.invalidateQueries({ queryKey: qk.servers }),
      qc.invalidateQueries({ queryKey: qk.subs }),
      qc.invalidateQueries({ queryKey: qk.txs }),
    ]);
}

/** Server errors arrive as "CODE: message" — show only the human part. */
export function errorText(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.replace(/^[A-Z_]+:\s*/, "");
}
