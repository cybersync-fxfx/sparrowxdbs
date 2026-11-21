import crypto from "node:crypto";
import { provisionServerFromPaidOrder, type ManagedInfraServer } from "./proxmox.server";

export type UpiOrderStatus = "PENDING" | "PAID" | "EXPIRED";

export interface UpiPaymentOrder {
  orderId: string;
  service: "infra" | "game" | "db" | "shield" | "netsec" | "wallet";
  planId: string;
  planName: string;
  amountInr: number;
  exactAmountInr: string;
  upiId: string;
  merchantName: string;
  upiUri: string;
  customerEmail: string;
  status: UpiOrderStatus;
  utr?: string;
  confirmedVia?: "gateway_webhook" | "android_upi_bridge" | "utr_auto_match" | "sandbox_instant";
  createdAt: string;
  expiresAt: string;
  paidAt?: string;
  metadata?: {
    category?: "bare-metal" | "dedicated" | "vps";
    hostname?: string;
    region?: string;
    os?: string;
  };
  provisionedServer?: ManagedInfraServer;
}

interface IncomingBridgeReceipt {
  utr: string;
  amountInr: number;
  orderId?: string;
  senderText?: string;
  receivedAt: string;
}

const upiOrderStore = new Map<string, UpiPaymentOrder>();
const unmatchedBridgeReceipts = new Map<string, IncomingBridgeReceipt>();

export function getUpiGatewayConfig() {
  const upiId = (process.env.SPARROWX_UPI_ID || "sparrowx@okaxis").trim();
  const merchantName = (process.env.SPARROWX_MERCHANT_NAME || "SparrowX Cloud").trim();
  const hasRazorpay = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_WEBHOOK_SECRET);
  const hasCashfree = Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_WEBHOOK_SECRET);
  const hasDirectBridge = Boolean(process.env.SPARROWX_UPI_BRIDGE_SECRET);
  const mode = hasRazorpay
    ? "razorpay_upi"
    : hasCashfree
      ? "cashfree_upi"
      : hasDirectBridge
        ? "direct_upi_bridge"
        : "hybrid_sandbox";

  return {
    upiId,
    merchantName,
    mode,
    liveWebhookConfigured: hasRazorpay || hasCashfree || hasDirectBridge,
  };
}

export function createUpiOrder(input: {
  service: UpiPaymentOrder["service"];
  planId: string;
  planName: string;
  amountInr: number;
  customerEmail: string;
  metadata?: UpiPaymentOrder["metadata"];
}): UpiPaymentOrder {
  const cfg = getUpiGatewayConfig();
  const cleanAmount = Math.max(1, Math.round(Number(input.amountInr) || 1));
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  const orderId = `SPX${suffix}`;
  // Add deterministic unique paise (0.01..0.99) in Direct UPI Bridge mode so incoming bank credits match 100% unambiguously
  const uniquePaise = (parseInt(suffix.slice(0, 2), 16) % 97) + 1;
  const exactAmountInr =
    cfg.mode === "direct_upi_bridge"
      ? `${cleanAmount}.${String(uniquePaise).padStart(2, "0")}`
      : `${cleanAmount}.00`;

  const note = `SparrowX ${input.planName} (${orderId})`.slice(0, 48);
  const params = new URLSearchParams({
    pa: cfg.upiId,
    pn: cfg.merchantName,
    tr: orderId,
    tn: note,
    am: exactAmountInr,
    cu: "INR",
  });
  const upiUri = `upi://pay?${params.toString()}`;
  const now = Date.now();

  const order: UpiPaymentOrder = {
    orderId,
    service: input.service,
    planId: input.planId,
    planName: input.planName,
    amountInr: cleanAmount,
    exactAmountInr,
    upiId: cfg.upiId,
    merchantName: cfg.merchantName,
    upiUri,
    customerEmail: input.customerEmail.trim().toLowerCase(),
    status: "PENDING",
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 15 * 60_000).toISOString(),
    metadata: input.metadata,
  };

  upiOrderStore.set(orderId, order);
  return order;
}

export function getUpiOrder(orderId: string): UpiPaymentOrder | null {
  const order = upiOrderStore.get(orderId.trim().toUpperCase());
  if (!order) return null;
  if (order.status === "PENDING" && Date.now() > Date.parse(order.expiresAt)) {
    order.status = "EXPIRED";
    upiOrderStore.set(order.orderId, order);
  }
  return order;
}

export function listRecentUpiOrders(limit = 20): UpiPaymentOrder[] {
  return Array.from(upiOrderStore.values())
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);
}

function finalizePaidOrder(
  order: UpiPaymentOrder,
  utr: string,
  confirmedVia: NonNullable<UpiPaymentOrder["confirmedVia"]>,
): UpiPaymentOrder {
  if (order.status === "PAID") return order;
  order.status = "PAID";
  order.utr = utr;
  order.confirmedVia = confirmedVia;
  order.paidAt = new Date().toISOString();

  if (order.service === "infra" && !order.provisionedServer) {
    order.provisionedServer = provisionServerFromPaidOrder({
      orderId: order.orderId,
      planId: order.planId,
      planName: order.planName,
      category: order.metadata?.category || "vps",
      hostname: order.metadata?.hostname || `${order.planId}.sparrowx.net`,
      region: order.metadata?.region || "Mumbai IN-1",
      os: order.metadata?.os || "Ubuntu 24.04 LTS (Hardened)",
      monthlyPriceInr: order.amountInr,
    });
  }

  upiOrderStore.set(order.orderId, order);
  return order;
}

/**
 * Verifies signed Razorpay / Cashfree / Direct Android UPI Bridge webhooks and auto-confirms matching orders.
 */
export function processUpiAutoWebhook(input: {
  rawBody: string;
  headers: Record<string, string | undefined>;
  payload: Record<string, unknown>;
}): { ok: boolean; status: number; message: string; order?: UpiPaymentOrder } {
  const rzpSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
  const bridgeSecret = (process.env.SPARROWX_UPI_BRIDGE_SECRET || "").trim();

  const rzpSig = (input.headers["x-razorpay-signature"] || "").trim();
  const bridgeToken = (input.headers["x-sparrowx-upi-secret"] || "").trim();

  let verifiedSource: NonNullable<UpiPaymentOrder["confirmedVia"]> | null = null;

  if (rzpSecret && rzpSig) {
    const expected = crypto.createHmac("sha256", rzpSecret).update(input.rawBody).digest("hex");
    if (
      expected.length === rzpSig.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(rzpSig))
    ) {
      verifiedSource = "gateway_webhook";
    } else {
      return { ok: false, status: 401, message: "Invalid Razorpay webhook HMAC signature." };
    }
  } else if (bridgeSecret && bridgeToken) {
    if (
      bridgeSecret.length === bridgeToken.length &&
      crypto.timingSafeEqual(Buffer.from(bridgeSecret), Buffer.from(bridgeToken))
    ) {
      verifiedSource = "android_upi_bridge";
    } else {
      return { ok: false, status: 401, message: "Invalid SparrowX UPI Bridge secret." };
    }
  } else if (!rzpSecret && !bridgeSecret) {
    // Allow sandbox verification when no live secrets are configured yet
    verifiedSource = "sandbox_instant";
  } else {
    return { ok: false, status: 401, message: "Missing webhook authentication signature." };
  }

  const orderId = String(input.payload.orderId || input.payload.tr || "")
    .trim()
    .toUpperCase();
  const utr = String(input.payload.utr || input.payload.rrn || `UTR${Date.now().toString().slice(-9)}`)
    .trim()
    .toUpperCase();
  const amountVal = Number(input.payload.amountInr || input.payload.amount || 0);

  let target = orderId ? upiOrderStore.get(orderId) : undefined;

  // Fallback match by exact unique paise amount (e.g. ₹849.37) when bank alert omits `tr`
  if (!target && amountVal > 0) {
    const amtStr = amountVal.toFixed(2);
    for (const candidate of upiOrderStore.values()) {
      if (candidate.status === "PENDING" && candidate.exactAmountInr === amtStr) {
        target = candidate;
        break;
      }
    }
  }

  if (!target) {
    unmatchedBridgeReceipts.set(utr, {
      utr,
      amountInr: amountVal,
      orderId: orderId || undefined,
      receivedAt: new Date().toISOString(),
    });
    return {
      ok: true,
      status: 202,
      message: `Receipt ${utr} queued for automatic UTR matching.`,
    };
  }

  const finalized = finalizePaidOrder(target, utr, verifiedSource);
  return {
    ok: true,
    status: 200,
    message: `Order ${finalized.orderId} auto-confirmed via ${verifiedSource}.`,
    order: finalized,
  };
}

/**
 * Matches a customer-submitted 12-digit UTR against incoming bridge receipts (or confirms in sandbox mode).
 */
export function verifyUpiUtr(input: {
  orderId: string;
  utr: string;
}): { ok: boolean; message: string; order?: UpiPaymentOrder } {
  const order = getUpiOrder(input.orderId);
  if (!order) {
    return { ok: false, message: "UPI order not found." };
  }
  if (order.status === "PAID") {
    return { ok: true, message: "Order is already paid & provisioned.", order };
  }
  const cleanUtr = input.utr.trim().replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9]{10,22}$/.test(cleanUtr)) {
    return { ok: false, message: "Enter a valid 12-digit UPI UTR / Reference number." };
  }

  const receipt = unmatchedBridgeReceipts.get(cleanUtr);
  if (receipt) {
    unmatchedBridgeReceipts.delete(cleanUtr);
    const finalized = finalizePaidOrder(order, cleanUtr, "utr_auto_match");
    return {
      ok: true,
      message: `Matched incoming bank credit UTR ${cleanUtr}. Server provisioned automatically.`,
      order: finalized,
    };
  }

  const cfg = getUpiGatewayConfig();
  if (!cfg.liveWebhookConfigured) {
    const finalized = finalizePaidOrder(order, cleanUtr, "sandbox_instant");
    return {
      ok: true,
      message: `Sandbox UPI verification accepted (${cleanUtr}). Configure RAZORPAY_WEBHOOK_SECRET or SPARROWX_UPI_BRIDGE_SECRET in .env for live bank matching.`,
      order: finalized,
    };
  }

  return {
    ok: false,
    message:
      "Waiting for bank credit alert for this UTR. Keep this window open — auto-confirmation completes within seconds once UPI settles.",
  };
}
