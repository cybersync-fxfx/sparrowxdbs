import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function run<T>(fn: () => Promise<T>): Promise<T> {
  const { PortalError } = await import("./server/portal.server");
  try {
    return await fn();
  } catch (e) {
    if (e instanceof PortalError) throw new Error(`${e.code}: ${e.message}`, { cause: e });
    throw new Error("Operation failed. Please try again.");
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

export const getSubscriptions = createServerFn({ method: "GET" }).handler(async () =>
  run(async () => (await import("./server/portal.server")).subscriptions()),
);

export const renewSubscription = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({
      subscriptionId: z.string().min(1).max(80),
      days: z.number().int().min(7).max(365).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) =>
    run(async () => (await import("./server/portal.server")).renewSubscription(data.subscriptionId, data.days)),
  );

export const revealPanelPassword = createServerFn({ method: "POST" }).handler(async () =>
  run(async () => (await import("./server/portal.server")).revealPassword()),
);

export const resetPanelPassword = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({ newPassword: z.string().min(8).max(64).optional() }).optional().parse(d),
  )
  .handler(async ({ data }) =>
    run(async () => (await import("./server/portal.server")).resetPassword(data?.newPassword)),
  );

export const deployPlan = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        planId: z.string().min(1).max(40),
        serverName: z.string().max(60).regex(/^[\w .\-']*$/, "Letters, numbers, spaces, - . ' only"),
        eggOverride: z
          .object({
            nestId: z.number().int().positive(),
            eggId: z.number().int().positive(),
            dockerImage: z.string().max(260).optional(),
            environment: z.record(z.string().max(80), z.string().max(1000)).optional(),
          })
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    run(async () =>
      (await import("./server/portal.server")).deploy(data.planId, data.serverName, data.eggOverride),
    ),
  );

export const getEggConfigDetails = createServerFn({ method: "GET" })
  .validator((d) =>
    z
      .object({
        nestId: z.number().int().positive().optional(),
        eggId: z.number().int().positive().optional(),
        service: z.enum(["fivem", "samp", "minecraft", "discord"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    run(async () =>
      (await import("./server/portal.server")).getEggDetails(data.nestId, data.eggId, data.service),
    ),
  );

export const getLiveServerConfig = createServerFn({ method: "GET" })
  .validator((d) => z.object({ serverId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) =>
    run(async () => (await import("./server/portal.server")).getServerConfig(data.serverId)),
  );

export const saveLiveServerConfig = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        serverId: z.number().int().positive(),
        name: z.string().trim().min(1).max(60).optional(),
        description: z.string().max(250).optional(),
        targetNestId: z.number().int().positive().optional(),
        targetEggId: z.number().int().positive().optional(),
        dockerImage: z.string().max(260).optional(),
        environment: z.record(z.string().max(80), z.string().max(2000)).optional(),
        reinstallAfter: z.boolean().optional(),
        restartAfter: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    run(async () => (await import("./server/portal.server")).updateServerConfig(data)),
  );

export const reinstallLiveServer = createServerFn({ method: "POST" })
  .validator((d) => z.object({ serverId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) =>
    run(async () => (await import("./server/portal.server")).triggerServerReinstall(data.serverId)),
  );

export const redeemPromo = createServerFn({ method: "POST" })
  .validator((d) => z.object({ code: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9_-]+$/) }).parse(d))
  .handler(async ({ data }) => run(async () => (await import("./server/portal.server")).redeemPromo(data.code)));

const amountSchema = z.object({ amount: z.number().int().min(10).max(50000) });

/** Starts a live Razorpay top-up order (zero simulated demo credits). */
export const startTopup = createServerFn({ method: "POST" })
  .validator((d) => amountSchema.parse(d))
  .handler(async ({ data }) =>
    run(async () => {
      const { integrations } = await import("./server/config.server");
      const portal = await import("./server/portal.server");
      if (!integrations().razorpay) throw new Error("UNAVAILABLE: Online payments aren't enabled yet — configure Razorpay keys or redeem a promo code");
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

// ---------------- Game Client Area Admin Functions (atchukriz@gmail.com + appointed admins) ----------------

export const getAdminOverview = createServerFn({ method: "GET" }).handler(async () =>
  run(async () => (await import("./server/portal.server")).adminGetOverview()),
);

export const adminAdjustCoins = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        clientId: z.string().min(1).max(80),
        mode: z.enum(["add", "deduct", "set"]),
        amount: z.number().int().min(0).max(1_000_000),
        note: z.string().max(140).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    run(async () => (await import("./server/portal.server")).adminAdjustClientCoins(data)),
  );

export const adminUpdateSubscription = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        subscriptionId: z.string().min(1).max(80),
        status: z.enum(["active", "expired", "cancelled"]).optional(),
        extendDays: z.number().int().min(-365).max(730).optional(),
        expiresAt: z.string().max(64).optional(),
        planId: z.string().min(1).max(40).optional(),
        customPlanName: z.string().max(80).optional(),
        customPriceCoins: z.number().int().min(0).max(500_000).optional(),
        customRamMb: z.number().int().min(256).max(131072).optional(),
        customCpuPercent: z.number().int().min(25).max(1600).optional(),
        customDiskGb: z.number().int().min(2).max(2000).optional(),
        syncPanelLimits: z.boolean().optional(),
        syncPanelStatus: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    run(async () => (await import("./server/portal.server")).adminUpdateUserSubscription(data)),
  );

export const adminAssignSubscription = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        clientId: z.string().min(1).max(80),
        planId: z.string().min(1).max(40),
        days: z.number().int().min(1).max(730),
        customPlanName: z.string().max(80).optional(),
        customPriceCoins: z.number().int().min(0).max(500_000).optional(),
        pteroServerId: z.number().int().positive().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    run(async () => (await import("./server/portal.server")).adminGrantSubscription(data)),
  );

export const adminSetUserAdminRole = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        clientId: z.string().min(1).max(80),
        makeAdmin: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    run(async () => (await import("./server/portal.server")).adminSetClientAdminRole(data)),
  );

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { deleteCookie } = await import("@tanstack/react-start/server");
  const { getAppSession } = await import("./server/session.server");
  const { MASTER_SSO_COOKIE_NAME } = await import("./server/master-sso.server");
  const s = await getAppSession();
  await s.clear();
  deleteCookie(MASTER_SSO_COOKIE_NAME, { path: "/" });
  return { ok: true };
});
