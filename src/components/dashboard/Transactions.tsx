import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { SparrowxCoinIcon } from "@/components/SparrowxCoinVisuals";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useTransactions } from "./hooks";

type TxFilter = "all" | "topup" | "purchase" | "promo";

export function Transactions() {
  const { data, isLoading } = useTransactions();
  const [filter, setFilter] = useState<TxFilter>("all");

  const { filtered, earned, spent } = useMemo(() => {
    const items = data ?? [];
    const totalEarned = items.filter((t) => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
    const totalSpent = items.filter((t) => t.amount < 0).reduce((acc, t) => acc + Math.abs(t.amount), 0);
    const next = filter === "all" ? items : items.filter((t) => t.type === filter);
    return { filtered: next, earned: totalEarned, spent: totalSpent };
  }, [data, filter]);

  return (
    <section className="surface-3d rounded-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <SparrowxCoinIcon className="size-5" /> SparrowCoins Ledger
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 text-emerald-300">
              <ArrowDownLeft className="size-3.5" /> +{earned.toLocaleString("en-IN")} Credited
            </span>
            <span className="inline-flex items-center gap-1 text-secondary-foreground">
              <ArrowUpRight className="size-3.5" /> -{spent.toLocaleString("en-IN")} Spent
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-background/50 p-1">
          {(["all", "topup", "purchase", "promo"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                filter === tab ? "bg-primary/25 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab === "all" ? "All" : tab === "topup" ? "Top-ups" : tab === "purchase" ? "Deploys" : "Promos"}
            </button>
          ))}
        </div>
      </div>

      <div
        role="region"
        aria-label="SparrowCoins transaction history"
        tabIndex={0}
        className="mt-4 overflow-x-auto rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-sheen/60"
      >
        {isLoading ? (
          <Skeleton className="h-40 rounded-2xl bg-background/40" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-muted-foreground">Description</TableHead>
                <TableHead className="text-muted-foreground">Type</TableHead>
                <TableHead className="text-right text-muted-foreground">Coins</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow className="border-border">
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No {filter === "all" ? "" : `${filter} `}transactions yet
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((t) => (
                <TableRow key={t.id} className="border-border hover:bg-accent/40">
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {new Date(t.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-secondary-foreground">{t.description}</TableCell>
                  <TableCell>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t.type}
                    </span>
                  </TableCell>
                  <TableCell className={cn("text-right font-mono font-semibold", t.amount >= 0 ? "text-success" : "text-foreground")}>
                    {t.amount >= 0 ? "+" : ""}{t.amount.toLocaleString("en-IN")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  );
}
