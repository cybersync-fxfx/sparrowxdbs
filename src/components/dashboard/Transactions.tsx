import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useTransactions } from "./hooks";

export function Transactions() {
  const { data, isLoading } = useTransactions();
  return (
    <section className="surface-3d rounded-3xl p-6">
      <h2 className="font-display text-lg font-semibold">Coin history</h2>
      <div className="mt-4 overflow-x-auto">
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
              {data?.length === 0 && (
                <TableRow className="border-border"><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No transactions yet</TableCell></TableRow>
              )}
              {data?.map((t) => (
                <TableRow key={t.id} className="border-border hover:bg-accent/40">
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {new Date(t.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-secondary-foreground">{t.description}</TableCell>
                  <TableCell><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t.type}</span></TableCell>
                  <TableCell className={cn("text-right font-mono font-semibold", t.amount >= 0 ? "text-success" : "text-foreground")}>
                    {t.amount >= 0 ? "+" : ""}{t.amount}
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
