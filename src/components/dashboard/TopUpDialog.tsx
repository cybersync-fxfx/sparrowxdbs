import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift, Loader2, MessageCircle, Plus, Smartphone } from "lucide-react";
import { SparrowxCoinIcon } from "@/components/SparrowxCoinVisuals";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { confirmTopup, redeemPromo, startTopup } from "@/lib/portal.functions";
import { buildWhatsAppSupportUrl, WHATSAPP_SUPPORT_DISPLAY } from "@/lib/whatsapp-support";
import { cn } from "@/lib/utils";
import { PurchasePolicyNotice } from "@/components/PurchasePolicyNotice";
import { errorText, useRefreshAll } from "./hooks";

const PRESETS = [100, 250, 500, 1000, 2000];

type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void };

function loadRazorpay(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Checkout failed to load")));
    s.onerror = () => reject(new Error("Checkout failed to load"));
    document.body.appendChild(s);
  });
}

export function TopUpDialog({ open, onOpenChange, demo, razorpay }: { open: boolean; onOpenChange: (o: boolean) => void; demo: boolean; razorpay: boolean }) {
  const [amount, setAmount] = useState(500);
  const [code, setCode] = useState("");
  const refresh = useRefreshAll();

  const pay = useMutation({
    mutationFn: async () => {
      const r = await startTopup({ data: { amount } });
      const Razorpay = await loadRazorpay();
      return new Promise<number>((resolve, reject) => {
        const rz = new Razorpay({
          key: r.keyId,
          amount: r.amount,
          currency: "INR",
          name: "SparrowX Game Hosting",
          description: `${amount} SparrowCoins`,
          order_id: r.orderId,
          theme: { color: "#5865F2" },
          handler: (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
            confirmTopup({ data: { orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature } })
              .then((x) => resolve(x.coins))
              .catch(reject),
          modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
        });
        rz.open();
      });
    },
    onSuccess: async (coins) => {
      await refresh();
      toast.success(`${amount} coins added`, { description: `New balance: ${coins} SparrowCoins` });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const promo = useMutation({
    mutationFn: () => redeemPromo({ data: { code } }),
    onSuccess: async (r) => {
      await refresh();
      toast.success(`+${r.added} coins from promo`, { description: `New balance: ${r.coins} SparrowCoins` });
      setCode("");
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const payDisabled = !demo && !razorpay;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="theme-dashboard surface-3d max-w-md rounded-3xl border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 font-display">
            <SparrowxCoinIcon className="size-6" size={24} lowPriority /> Top Up SparrowCoins
          </DialogTitle>
          <DialogDescription>1 Coin = ₹1. Coins never expire and pay for any SparrowX plan.</DialogDescription>
        </DialogHeader>
        <div className="relative overflow-hidden rounded-2xl border border-[#A5B4FC]/25 bg-[#060914] flex items-center gap-3 p-3">
          <picture className="shrink-0">
            <source type="image/webp" srcSet="/images/sparrowx-coins-stack.webp" />
            <img
              src="/images/sparrowx-coins-stack.jpg"
              alt="SparrowX Coins bundle"
              width={112}
              height={87}
              fetchPriority="low"
              decoding="async"
              className="h-16 w-20 rounded-xl object-cover border border-white/10"
            />
          </picture>
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs font-semibold text-white">Universal SparrowX Ecosystem Wallet</p>
            <p className="text-[11px] text-zinc-400 leading-snug">
              Instant UPI / Card top-up. Spend seamlessly across Game Hosting, VPS, DB &amp; AI.
            </p>
          </div>
        </div>
        <Tabs defaultValue="upi">
          <TabsList className="grid w-full grid-cols-2 bg-background/50">
            <TabsTrigger value="upi"><Smartphone className="mr-1.5 size-4" /> UPI / Card</TabsTrigger>
            <TabsTrigger value="promo"><Gift className="mr-1.5 size-4" /> Promo code</TabsTrigger>
          </TabsList>
          <TabsContent value="upi" className="mt-4 space-y-4">
            <div className="grid grid-cols-5 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(p)}
                  className={cn(
                    "rounded-xl border py-2 font-mono text-sm transition-colors",
                    amount === p ? "border-sheen bg-primary/20 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="amount" className="text-xs text-muted-foreground">Custom amount (₹10 – ₹50,000)</label>
              <Input id="amount" type="number" min={10} max={50000} value={amount} onChange={(e) => setAmount(Math.floor(Number(e.target.value) || 0))} className="mt-1 bg-background/50 font-mono" />
            </div>
            <Button variant="discord" size="xl" className="w-full" disabled={pay.isPending || payDisabled || amount < 10 || amount > 50000} onClick={() => pay.mutate()}>
              {pay.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Pay ₹{amount.toLocaleString("en-IN")}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              {payDisabled ? "Pay directly via WhatsApp Support or redeem a promo code." : "Secured by Razorpay · UPI, cards, netbanking"}
            </p>
            <a
              href={buildWhatsAppSupportUrl(
                `Hi SparrowX, I want to add ${amount} SparrowCoins (₹${amount.toLocaleString("en-IN")}) to my account.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors"
            >
              <MessageCircle className="size-4" />
              <span>Pay / Connect on WhatsApp ({WHATSAPP_SUPPORT_DISPLAY})</span>
            </a>
          </TabsContent>
          <TabsContent value="promo" className="mt-4 space-y-4">
            <Input placeholder="Enter promo code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="bg-background/50 font-mono uppercase" />
            <Button variant="ivory" size="xl" className="w-full" disabled={promo.isPending || code.trim().length < 3} onClick={() => promo.mutate()}>
              {promo.isPending ? <Loader2 className="animate-spin" /> : <Gift />} Redeem code
            </Button>
          </TabsContent>
        </Tabs>
        <PurchasePolicyNotice compact />
      </DialogContent>
    </Dialog>
  );
}
