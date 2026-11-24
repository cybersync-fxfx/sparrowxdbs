import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { provisionServerFromPaidOrder, type ManagedInfraServer } from "./proxmox.server";

export type PayMethod = "upi" | "binance_usdt_trc20" | "binance_usdt_bep20";
export type PayOrderStatus = "PENDING" | "PAID" | "EXPIRED";
export type PayService =
  | "wallet"
  | "infra"
  | "game"
  | "db"
  | "shield"
  | "netsec"
  | "drop"
  | "deploy";

export interface SparrowxPayOrder {
  orderId: string;
  method: PayMethod;
  service: PayService;
  planId: string;
  planName: string;
  customerEmail: string;
  /** Base amount in INR */
  amountInr: number;
  /** Exact unique payable string (e.g. "999.14" for UPI, or "12.0047" for Binance USDT) */
  exactAmount: string;
  currency: "INR" | "USDT";
  /** UPI payment fields */
  upiId?: string;
  upiUri?: string;
  merchantName?: string;
  /** Binance USDT payment fields */
  network?: "TRC20" | "BEP20";
  depositAddress?: string;
  status: PayOrderStatus;
  /** Verified 12-digit UPI UTR or Binance on-chain txId */
  verifiedRef?: string;
  confirmedVia?: "upi_bank_bridge" | "binance_spot_api";
  createdAt: string;
  expiresAt: string;
  paidAt?: string;
  metadata?: {
    category?: "bare-metal" | "dedicated" | "vps";
    hostname?: string;
    region?: string;
    os?: string;
    coinsToCredit?: number;
  };
  provisionedServer?: ManagedInfraServer;
}

export interface IngestedUpiReceipt {
  utr: string;
  amountInr: number;
  exactAmountStr: string;
  orderId?: string;
  senderText?: string;
  receivedAt: string;
  matchedOrderId?: string;
}

interface PayLedgerDisk {
  orders: SparrowxPayOrder[];
  usedRefs: string[];
  receipts: IngestedUpiReceipt[];
}

const INR_PER_USDT = Number(process.env.SPARROWX_INR_PER_USDT || 86);

function getLedgerPath(): string {
  const dir = process.env.SPARROWX_DATA_DIR?.trim() || path.join(process.cwd(), "data");
  return path.join(dir, "sparrowx-pay-ledger.json");
}

function readLedger(): PayLedgerDisk {
  const fp = getLedgerPath();
  try {
    if (!fs.existsSync(fp)) return { orders: [], usedRefs: [], receipts: [] };
    const raw = JSON.parse(fs.readFileSync(fp, "utf8")) as Partial<PayLedgerDisk>;
    return {
      orders: Array.isArray(raw.orders) ? raw.orders : [],
      usedRefs: Array.isArray(raw.usedRefs) ? raw.usedRefs : [],
      receipts: Array.isArray(raw.receipts) ? raw.receipts : [],
    };
  } catch {
    return { orders: [], usedRefs: [], receipts: [] };
  }
}

function writeLedger(ledger: PayLedgerDisk): void {
  const fp = getLedgerPath();
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(ledger, null, 2), "utf8");
  fs.renameSync(tmp, fp);
}

const DEFAULT_SPARROWX_UPI_ID = "bm.atchuthakrishna@okhdfcbank";

export function getSparrowxPayPublicConfig() {
  const upiId = (process.env.SPARROWX_UPI_ID || DEFAULT_SPARROWX_UPI_ID).trim();
  const merchantName = (process.env.SPARROWX_MERCHANT_NAME || "SparrowX Technologies").trim();
  const upiBridgeReady = Boolean(upiId && process.env.SPARROWX_UPI_BRIDGE_SECRET?.trim());

  const trc20Address = (process.env.SPARROWX_BINANCE_USDT_TRC20 || "").trim();
  const bep20Address = (process.env.SPARROWX_BINANCE_USDT_BEP20 || "").trim();
  const binanceApiReady = Boolean(
    process.env.SPARROWX_BINANCE_API_KEY?.trim() &&
      process.env.SPARROWX_BINANCE_API_SECRET?.trim() &&
      (trc20Address || bep20Address),
  );

  return {
    upi: {
      configured: Boolean(upiId),
      autoVerifyReady: upiBridgeReady,
      upiId: upiId || null,
      merchantName,
    },
    binance: {
      configured: Boolean(trc20Address || bep20Address),
      autoVerifyReady: binanceApiReady,
      trc20Ready: Boolean(trc20Address),
      bep20Ready: Boolean(bep20Address),
      inrPerUsdt: INR_PER_USDT,
    },
  };
}

function expireStaleOrders(ledger: PayLedgerDisk): boolean {
  const now = Date.now();
  let changed = false;
  for (const order of ledger.orders) {
    if (order.status === "PENDING" && new Date(order.expiresAt).getTime() < now) {
      order.status = "EXPIRED";
      changed = true;
    }
  }
  return changed;
}

/**
 * Allocates a collision-free exact paise amount (e.g. "999.14") among all active PENDING UPI orders.
 */
function allocateUniqueUpiAmount(baseInr: number, activeOrders: SparrowxPayOrder[]): string {
  const usedAmounts = new Set(
    activeOrders
      .filter((o) => o.status === "PENDING" && o.method === "upi")
      .map((o) => o.exactAmount),
  );
  for (let attempt = 0; attempt < 95; attempt++) {
    const paise = ((crypto.randomInt(1, 98) + attempt) % 97) + 1;
    const candidate = `${baseInr}.${String(paise).padStart(2, "0")}`;
    if (!usedAmounts.has(candidate)) return candidate;
  }
  return `${baseInr}.${String(crypto.randomInt(1, 99)).padStart(2, "0")}`;
}

/**
 * Allocates a collision-free exact 4-decimal USDT amount (e.g. "12.0047") among all active PENDING Binance orders.
 */
function allocateUniqueUsdtAmount(baseInr: number, activeOrders: SparrowxPayOrder[]): string {
  const baseUsdt = Math.max(1, Number((baseInr / INR_PER_USDT).toFixed(2)));
  const usedAmounts = new Set(
    activeOrders
      .filter((o) => o.status === "PENDING" && o.currency === "USDT")
      .map((o) => o.exactAmount),
  );
  for (let attempt = 0; attempt < 200; attempt++) {
    const micro = crypto.randomInt(11, 989);
    const candidate = (baseUsdt + micro / 10000).toFixed(4);
    if (!usedAmounts.has(candidate)) return candidate;
  }
  return (baseUsdt + crypto.randomInt(11, 989) / 10000).toFixed(4);
}

export function createSparrowxPayOrder(input: {
  method: PayMethod;
  service: PayService;
  planId: string;
  planName: string;
  amountInr: number;
  customerEmail: string;
  metadata?: SparrowxPayOrder["metadata"];
}): SparrowxPayOrder {
  const ledger = readLedger();
  expireStaleOrders(ledger);

  const cleanInr = Math.max(1, Math.round(Number(input.amountInr) || 1));
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  const orderId = `SPX${suffix}`;
  const now = Date.now();
  const expiresMs = input.method === "upi" ? 15 * 60_000 : 30 * 60_000;
  const email = (input.customerEmail || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("A valid customer email is required to create a payment order.");
  }

  let order: SparrowxPayOrder;

  if (input.method === "upi") {
    const upiId = (process.env.SPARROWX_UPI_ID || DEFAULT_SPARROWX_UPI_ID).trim();
    if (!upiId) {
      throw new Error("UPI is not configured on this server yet (set SPARROWX_UPI_ID in .env).");
    }
    const merchantName = (process.env.SPARROWX_MERCHANT_NAME || "SparrowX Technologies").trim();
    const exactAmount = allocateUniqueUpiAmount(cleanInr, ledger.orders);
    const note = `SparrowX ${orderId}`;
    const params = new URLSearchParams({
      pa: upiId,
      pn: merchantName,
      tr: orderId,
      tn: note,
      am: exactAmount,
      cu: "INR",
    });
    order = {
      orderId,
      method: "upi",
      service: input.service,
      planId: input.planId,
      planName: input.planName,
      customerEmail: email,
      amountInr: cleanInr,
      exactAmount,
      currency: "INR",
      upiId,
      merchantName,
      upiUri: `upi://pay?${params.toString()}`,
      status: "PENDING",
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + expiresMs).toISOString(),
      metadata: {
        ...input.metadata,
        coinsToCredit: input.metadata?.coinsToCredit ?? cleanInr,
      },
    };
  } else {
    const network = input.method === "binance_usdt_trc20" ? "TRC20" : "BEP20";
    const depositAddress = (
      network === "TRC20"
        ? process.env.SPARROWX_BINANCE_USDT_TRC20
        : process.env.SPARROWX_BINANCE_USDT_BEP20
    )?.trim();
    if (!depositAddress) {
      throw new Error(
        `Binance USDT (${network}) deposit address is not configured on this server yet.`,
      );
    }
    const exactAmount = allocateUniqueUsdtAmount(cleanInr, ledger.orders);
    order = {
      orderId,
      method: input.method,
      service: input.service,
      planId: input.planId,
      planName: input.planName,
      customerEmail: email,
      amountInr: cleanInr,
      exactAmount,
      currency: "USDT",
      network,
      depositAddress,
      status: "PENDING",
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + expiresMs).toISOString(),
      metadata: {
        ...input.metadata,
        coinsToCredit: input.metadata?.coinsToCredit ?? cleanInr,
      },
    };
  }

  ledger.orders.unshift(order);
  writeLedger(ledger);
  return order;
}

async function finalizePaidOrder(
  ledger: PayLedgerDisk,
  order: SparrowxPayOrder,
  refId: string,
  confirmedVia: SparrowxPayOrder["confirmedVia"],
): Promise<SparrowxPayOrder> {
  const normalizedRef = refId.trim().toUpperCase();
  if (ledger.usedRefs.includes(normalizedRef)) {
    throw new Error(`Reference ${normalizedRef} was already redeemed on another order.`);
  }
  ledger.usedRefs.push(normalizedRef);
  order.status = "PAID";
  order.verifiedRef = normalizedRef;
  order.confirmedVia = confirmedVia;
  order.paidAt = new Date().toISOString();

  if (order.service === "infra" && !order.provisionedServer) {
    try {
      const server = await provisionServerFromPaidOrder({
        orderId: order.orderId,
        planId: order.planId,
        planName: order.planName,
        category: order.metadata?.category ?? "vps",
        hostname: order.metadata?.hostname ?? `${order.planId}.sparrowx.internal`,
        region: order.metadata?.region ?? "Mumbai IN-1",
        os: order.metadata?.os ?? "Ubuntu 24.04 LTS",
        customerEmail: order.customerEmail,
        utr: normalizedRef,
      });
      order.provisionedServer = server;
    } catch {
      // Payment stays PAID even if hypervisor provisioning is queued
    }
  }

  writeLedger(ledger);
  return order;
}

/**
 * Verifies HMAC-SHA256 signature from your self-hosted UPI Bank Email / Android SMS bridge.
 */
export function verifyUpiBridgeHmac(rawBody: string, signatureHex: string): boolean {
  const secret = process.env.SPARROWX_UPI_BRIDGE_SECRET?.trim();
  if (!secret || !signatureHex) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const cleanSig = signatureHex.trim().replace(/^sha256=/i, "");
  if (expected.length !== cleanSig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(cleanSig, "utf8"));
}

/**
 * Ingests a verified bank UPI credit notification and auto-confirms the matching PENDING order.
 */
export async function ingestVerifiedUpiCredit(input: {
  utr: string;
  amountInr: number | string;
  orderId?: string;
  senderText?: string;
}): Promise<{ matched: boolean; order?: SparrowxPayOrder; receipt: IngestedUpiReceipt }> {
  const cleanUtr = String(input.utr || "").trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!/^[A-Z0-9]{10,24}$/.test(cleanUtr)) {
    throw new Error("Invalid UTR format.");
  }
  const numAmount = Number(input.amountInr);
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    throw new Error("Invalid UPI credit amount.");
  }
  const exactAmountStr = numAmount.toFixed(2);

  const ledger = readLedger();
  expireStaleOrders(ledger);

  if (ledger.usedRefs.includes(cleanUtr)) {
    throw new Error("Duplicate UTR: this bank credit was already processed.");
  }

  const receipt: IngestedUpiReceipt = {
    utr: cleanUtr,
    amountInr: numAmount,
    exactAmountStr,
    ...(input.orderId ? { orderId: input.orderId.trim().toUpperCase() } : {}),
    ...(input.senderText ? { senderText: input.senderText.slice(0, 240) } : {}),
    receivedAt: new Date().toISOString(),
  };

  // Match by explicit orderId first, then by unique exact paise amount among active PENDING UPI orders
  let match: SparrowxPayOrder | undefined;
  if (receipt.orderId) {
    match = ledger.orders.find(
      (o) =>
        o.orderId === receipt.orderId &&
        o.status === "PENDING" &&
        o.method === "upi" &&
        o.exactAmount === exactAmountStr,
    );
  }
  if (!match) {
    match = ledger.orders.find(
      (o) => o.status === "PENDING" && o.method === "upi" && o.exactAmount === exactAmountStr,
    );
  }

  if (match) {
    receipt.matchedOrderId = match.orderId;
    ledger.receipts.unshift(receipt);
    const finalized = await finalizePaidOrder(ledger, match, cleanUtr, "upi_bank_bridge");
    return { matched: true, order: finalized, receipt };
  }

  ledger.receipts.unshift(receipt);
  writeLedger(ledger);
  return { matched: false, receipt };
}

/**
 * Checks a customer-submitted 12-digit UTR strictly against REAL ingested bank receipts.
 * Never approves fake or unverified UTRs.
 */
export async function verifySubmittedUtr(
  orderId: string,
  utr: string,
): Promise<{ verified: boolean; order: SparrowxPayOrder | null; message: string }> {
  const cleanOrderId = orderId.trim().toUpperCase();
  const cleanUtr = utr.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!/^[A-Z0-9]{10,24}$/.test(cleanUtr)) {
    return { verified: false, order: null, message: "Enter a valid 12-digit UPI UTR reference." };
  }

  const ledger = readLedger();
  expireStaleOrders(ledger);

  const order = ledger.orders.find((o) => o.orderId === cleanOrderId) ?? null;
  if (!order) return { verified: false, order: null, message: "Order not found." };
  if (order.status === "PAID") {
    return { verified: true, order, message: "Order is already confirmed." };
  }
  if (order.status === "EXPIRED") {
    return { verified: false, order, message: "Order expired. Please generate a new payment QR." };
  }
  if (ledger.usedRefs.includes(cleanUtr)) {
    return { verified: false, order, message: "This UTR has already been used for another order." };
  }

  const receipt = ledger.receipts.find(
    (r) =>
      r.utr === cleanUtr &&
      !r.matchedOrderId &&
      r.exactAmountStr === order.exactAmount,
  );
  if (!receipt) {
    return {
      verified: false,
      order,
      message:
        "UTR not matched in bank credit ledger yet. Waiting for bank alert confirmation (usually 5–15 seconds).",
    };
  }

  receipt.matchedOrderId = order.orderId;
  const finalized = await finalizePaidOrder(ledger, order, cleanUtr, "upi_bank_bridge");
  return { verified: true, order: finalized, message: "Payment verified via bank ledger." };
}

export function buildBinanceSignedQuery(params: Record<string, string | number>, secret: string): string {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  const signature = crypto.createHmac("sha256", secret).update(qs).digest("hex");
  return `${qs}&signature=${signature}`;
}

interface BinanceDepositRecord {
  id?: string;
  amount: string;
  coin: string;
  network?: string;
  status: number; // 1 = Success
  address?: string;
  txId: string;
  insertTime: number;
}

/**
 * Polls Binance Spot Read-Only Deposit History API (GET /sapi/v1/capital/deposit/hisrec)
 * to auto-confirm a PENDING Binance USDT order with zero third-party gateway.
 */
export async function pollBinanceDepositForOrder(
  orderId: string,
  fetcher: typeof fetch = fetch,
): Promise<{ verified: boolean; order: SparrowxPayOrder | null; message: string }> {
  const cleanOrderId = orderId.trim().toUpperCase();
  const ledger = readLedger();
  expireStaleOrders(ledger);

  const order = ledger.orders.find((o) => o.orderId === cleanOrderId) ?? null;
  if (!order) return { verified: false, order: null, message: "Order not found." };
  if (order.status === "PAID") return { verified: true, order, message: "Order already confirmed." };
  if (order.status === "EXPIRED") {
    return { verified: false, order, message: "Order expired. Create a new payment order." };
  }
  if (order.currency !== "USDT") {
    return { verified: false, order, message: "Not a Binance USDT order." };
  }

  const apiKey = process.env.SPARROWX_BINANCE_API_KEY?.trim();
  const apiSecret = process.env.SPARROWX_BINANCE_API_SECRET?.trim();
  if (!apiKey || !apiSecret) {
    return {
      verified: false,
      order,
      message: "Binance Read-Only API key not configured on server yet.",
    };
  }

  const createdMs = new Date(order.createdAt).getTime();
  const signedQs = buildBinanceSignedQuery(
    {
      coin: "USDT",
      status: 1,
      startTime: Math.max(0, createdMs - 120_000),
      timestamp: Date.now(),
      recvWindow: 15000,
    },
    apiSecret,
  );

  const res = await fetcher(`https://api.binance.com/sapi/v1/capital/deposit/hisrec?${signedQs}`, {
    headers: { "X-MBX-APIKEY": apiKey },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    return {
      verified: false,
      order,
      message: `Binance API returned HTTP ${res.status}.`,
    };
  }

  const deposits = (await res.json()) as BinanceDepositRecord[];
  if (!Array.isArray(deposits)) {
    return { verified: false, order, message: "Unexpected Binance API response." };
  }

  const expectedAmount = Number(order.exactAmount);
  const expectedNet = order.network === "TRC20" ? "TRX" : "BSC";

  const match = deposits.find((d) => {
    if (d.status !== 1 || d.coin !== "USDT" || !d.txId) return false;
    if (ledger.usedRefs.includes(d.txId.trim().toUpperCase())) return false;
    const amtDiff = Math.abs(Number(d.amount) - expectedAmount);
    if (amtDiff > 0.0001) return false;
    if (d.network && d.network !== expectedNet && d.network !== order.network) return false;
    return true;
  });

  if (!match) {
    return {
      verified: false,
      order,
      message: `Waiting for ${order.exactAmount} USDT (${order.network}) confirmation on Binance...`,
    };
  }

  const finalized = await finalizePaidOrder(ledger, order, match.txId, "binance_spot_api");
  return {
    verified: true,
    order: finalized,
    message: `Confirmed ${order.exactAmount} USDT via Binance (${match.txId.slice(0, 12)}...).`,
  };
}

export function getSparrowxPayOrder(orderId: string): SparrowxPayOrder | null {
  const ledger = readLedger();
  const changed = expireStaleOrders(ledger);
  if (changed) writeLedger(ledger);
  return ledger.orders.find((o) => o.orderId === orderId.trim().toUpperCase()) ?? null;
}

export function clearPayLedgerForTests(): void {
  const fp = getLedgerPath();
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}
