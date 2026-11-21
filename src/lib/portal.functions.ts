import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function run<T>(fn: () => Promise<T>): Promise<T> {
  const { PortalError } = await import("./server/portal.server");
  try {
    return await fn();
  } catch (e) {
    if (e instanceof PortalError) throw new Error(`${e.code}: ${e.message}`, { cause: e });
    console.error(e);
    throw new Error(e instanceof Error ? e.message : "Something went wrong");
  }
}

export const getSessionSummary = createServerFn({ method: "GET" }).handler(async () => {
  const { sessionSummary } = await import("./server/portal.server");
  return sessionSummary();
});

export const getDashboard = createServerFn({ method: "GET" }).handler(async () =>
  run(async () => (await import("./server/portal.server")).dashboard()),
);

export const getServers = createServerFn({ method: "GET" }).handler(async () =>
  run(async () => (await import("./server/portal.server")).servers()),
);

export const getTransactions = createServerFn({ method: "GET" }).handler(async () =>
  run(async () => (await import("./server/portal.server")).transactions()),
);

export const revealPanelPassword = createServerFn({ method: "POST" }).handler(async () =>
  run(async () => (await import("./server/portal.server")).revealPassword()),
);

export const resetPanelPassword = createServerFn({ method: "POST" }).handler(async () =>
  run(async () => (await import("./server/portal.server")).resetPassword()),
);

export const deployPlan = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({ planId: z.string().min(1).max(40), serverName: z.string().max(60).regex(/^[\w .\-']*$/, "Letters, numbers, spaces, - . ' only") }).parse(d),
  )
  .handler(async ({ data }) => run(async () => (await import("./server/portal.server")).deploy(data.planId, data.serverName)));

export const redeemPromo = createServerFn({ method: "POST" })
  .validator((d) => z.object({ code: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9_-]+$/) }).parse(d))
  .handler(async ({ data }) => run(async () => (await import("./server/portal.server")).redeemPromo(data.code)));

const amountSchema = z.object({ amount: z.number().int().min(10).max(50000) });

/** Starts a top-up: Razorpay order in live mode, instant simulated credit in demo mode. */
export const startTopup = createServerFn({ method: "POST" })
  .validator((d) => amountSchema.parse(d))
  .handler(async ({ data }) =>
    run(async () => {
      const { getMode, integrations } = await import("./server/config.server");
      const portal = await import("./server/portal.server");
      if (getMode() === "demo") {
        const r = await portal.demoTopup(data.amount);
        return { kind: "credited" as const, coins: r.coins };
      }
      if (!integrations().razorpay) throw new Error("UNAVAILABLE: Online payments aren't enabled yet — use a promo code");
      const clientId = await portal.liveClientId();
      const { createOrder } = await import("./server/razorpay.server");
      const o = await createOrder(clientId, data.amount);
      return { kind: "checkout" as const, ...o };
    }),
  );

export const confirmTopup = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({ orderId: z.string().min(5).max(64), paymentId: z.string().min(5).max(64), signature: z.string().min(10).max(256) }).parse(d),
  )
  .handler(async ({ data }) =>
    run(async () => {
      const portal = await import("./server/portal.server");
      const rz = await import("./server/razorpay.server");
      const clientId = await portal.liveClientId();
      if (!(await rz.verifyCheckoutSignature(data.orderId, data.paymentId, data.signature))) throw new Error("BAD_REQUEST: Payment signature mismatch");
      const order = await rz.fetchOrder(data.orderId);
      if (order.notes.client_id !== clientId) throw new Error("BAD_REQUEST: Order does not belong to this account");
      const coins = Math.floor(order.amount_paid / 100);
      if (coins <= 0) throw new Error("BAD_REQUEST: Payment not captured yet — coins will arrive shortly");
      const r = await portal.creditTopup(clientId, coins, data.paymentId);
      return { coins: r.balance };
    }),
  );

export const serverPowerAction = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({
      identifier: z.string().min(4).max(20).regex(/^[a-zA-Z0-9]+$/),
      signal: z.enum(["start", "stop", "restart"]),
    }).parse(d),
  )
  .handler(async ({ data }) =>
    run(async () => (await import("./server/portal.server")).powerAction(data.identifier, data.signal)),
  );

export const getPanelLaunchContext = createServerFn({ method: "GET" }).handler(async () =>
  run(async () => (await import("./server/portal.server")).getPanelLaunchInfo()),
);

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { getAppSession } = await import("./server/session.server");
  const s = await getAppSession();
  await s.clear();
  return { ok: true };
});
