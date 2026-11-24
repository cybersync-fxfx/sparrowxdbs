#!/usr/bin/env node
/**
 * ============================================================================
 * SPARROWX SELF-HOSTED UPI AUTO-VERIFIER WORKER (HDFC Bank / GPay IMAP)
 * ============================================================================
 * Zero external npm dependencies — uses Node.js built-in TLS + crypto + fetch.
 * Polls your alert email inbox over IMAPS (port 993) every 10 seconds for
 * official HDFC Bank UPI credit alerts, parses exact amount + 12-digit UTR,
 * signs with HMAC-SHA256(SPARROWX_UPI_BRIDGE_SECRET), and posts directly to
 * your local SparrowX Pay ingest endpoint (/api/pay/upi-ingest).
 *
 * Required .env variables on OVH server:
 *   UPI_IMAP_HOST=imap.gmail.com
 *   UPI_IMAP_PORT=993
 *   UPI_IMAP_USER=your-alert-email@gmail.com
 *   UPI_IMAP_PASS=your-16-char-gmail-app-password
 *   SPARROWX_UPI_BRIDGE_SECRET=your-32-char-bridge-secret
 *   SPARROWX_PAY_INGEST_URL=http://127.0.0.1:3000/api/pay/upi-ingest
 * ============================================================================
 */
import tls from "node:tls";
import crypto from "node:crypto";

const IMAP_HOST = (process.env.UPI_IMAP_HOST || "imap.gmail.com").trim();
const IMAP_PORT = Number(process.env.UPI_IMAP_PORT || 993);
const IMAP_USER = (process.env.UPI_IMAP_USER || "").trim();
const IMAP_PASS = (process.env.UPI_IMAP_PASS || "").trim();
const BRIDGE_SECRET = (process.env.SPARROWX_UPI_BRIDGE_SECRET || "").trim();
const INGEST_URL = (
  process.env.SPARROWX_PAY_INGEST_URL || "http://127.0.0.1:3000/api/pay/upi-ingest"
).trim();
const POLL_INTERVAL_MS = Math.max(5000, Number(process.env.UPI_IMAP_POLL_MS || 10000));

const processedUids = new Set();

/**
 * Parses HDFC Bank / Indian bank UPI credit alert email text.
 * Matches patterns like:
 *   "Rs. 999.14 has been credited to account ... UPI ... reference number is 432198765432"
 *   "INR 1,499.27 credited ... UTR 432198765432"
 */
export function parseHdfcUpiCreditEmail(rawText) {
  const clean = rawText
    .replace(/=\r?\n/g, "") // quoted-printable soft line breaks
    .replace(/=3D/gi, "=")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Must be a credit alert (never match debit alerts!)
  if (!/\b(credited|received|deposited)\b/i.test(clean) || /\bdebited\b/i.test(clean)) {
    return null;
  }

  // Extract amount: Rs. 999.14 / INR 1,499.27 / ₹999.14
  const amtMatch = clean.match(/(?:Rs\.?|INR|₹)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  if (!amtMatch || !amtMatch[1]) return null;
  const amountInr = Number(amtMatch[1].replace(/,/g, ""));
  if (!Number.isFinite(amountInr) || amountInr <= 0) return null;

  // Extract 12-digit UPI UTR / Reference number
  const utrMatch =
    clean.match(/(?:reference\s*(?:no\.?|number)\s*(?:is)?|utr(?:\s*no\.?)?|upi\/|rrn)\s*[:#-]?\s*([0-9]{12})\b/i) ||
    clean.match(/\b([0-9]{12})\b/);
  if (!utrMatch || !utrMatch[1]) return null;

  const orderMatch = clean.match(/\b(SPX[A-F0-9]{6})\b/i);

  return {
    amountInr: Number(amountInr.toFixed(2)),
    utr: utrMatch[1],
    ...(orderMatch && orderMatch[1] ? { orderId: orderMatch[1].toUpperCase() } : {}),
    senderText: clean.slice(0, 200),
  };
}

class SimpleImapClient {
  constructor(host, port) {
    this.host = host;
    this.port = port;
    this.tag = 0;
    this.socket = null;
    this.buffer = "";
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = tls.connect(
        { host: this.host, port: this.port, servername: this.host },
        () => resolve(),
      );
      this.socket.setEncoding("utf8");
      this.socket.setTimeout(15000);
      this.socket.once("error", reject);
    });
  }

  command(cmd) {
    return new Promise((resolve, reject) => {
      const id = `A${++this.tag}`;
      let response = "";
      const onData = (chunk) => {
        response += chunk;
        const doneRe = new RegExp(`^${id} (OK|NO|BAD)`, "m");
        if (doneRe.test(response)) {
          this.socket.off("data", onData);
          this.socket.off("error", onErr);
          resolve(response);
        }
      };
      const onErr = (err) => {
        this.socket.off("data", onData);
        reject(err);
      };
      this.socket.on("data", onData);
      this.socket.once("error", onErr);
      this.socket.write(`${id} ${cmd}\r\n`);
    });
  }

  close() {
    try {
      this.socket?.end();
    } catch {
      // ignore
    }
  }
}

async function postSignedCredit(credit) {
  const rawBody = JSON.stringify(credit);
  const sig = crypto.createHmac("sha256", BRIDGE_SECRET).update(rawBody, "utf8").digest("hex");
  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SparrowX-Signature": sig,
    },
    body: rawBody,
    signal: AbortSignal.timeout(8000),
  });
  const json = await res.json().catch(() => ({}));
  console.log(
    `[SparrowX UPI Verifier] Ingested UTR=${credit.utr} INR=${credit.amountInr} -> HTTP ${res.status}`,
    json.matched ? `MATCHED ORDER ${json.order?.orderId}` : "(stored in ledger)",
  );
}

async function pollOnce() {
  const client = new SimpleImapClient(IMAP_HOST, IMAP_PORT);
  try {
    await client.connect();
    await client.command(`LOGIN "${IMAP_USER.replace(/"/g, '\\"')}" "${IMAP_PASS.replace(/"/g, '\\"')}"`);
    await client.command("SELECT INBOX");
    const searchRes = await client.command('UID SEARCH UNSEEN FROM "hdfcbank"');
    const match = searchRes.match(/\* SEARCH\s+([0-9 ]+)/);
    const uids = match ? match[1].trim().split(/\s+/).filter(Boolean) : [];

    for (const uid of uids.slice(-15)) {
      if (processedUids.has(uid)) continue;
      const bodyRes = await client.command(`UID FETCH ${uid} (BODY.PEEK[TEXT])`);
      const parsed = parseHdfcUpiCreditEmail(bodyRes);
      if (parsed) {
        await postSignedCredit(parsed);
        // Mark seen only after successful ingest
        await client.command(`UID STORE ${uid} +FLAGS (\\Seen)`);
      }
      processedUids.add(uid);
    }
    await client.command("LOGOUT");
  } catch (err) {
    console.error("[SparrowX UPI Verifier] Poll error:", err instanceof Error ? err.message : err);
  } finally {
    client.close();
  }
}

// Run only when executed directly as a CLI worker
if (import.meta.url === `file://${process.argv[1]}`) {
  if (!IMAP_USER || !IMAP_PASS || !BRIDGE_SECRET) {
    console.error(
      "[SparrowX UPI Verifier] Missing UPI_IMAP_USER, UPI_IMAP_PASS, or SPARROWX_UPI_BRIDGE_SECRET in environment.",
    );
    process.exit(1);
  }
  console.log(
    `[SparrowX UPI Verifier] Watching ${IMAP_USER} (${IMAP_HOST}) every ${POLL_INTERVAL_MS / 1000}s -> ${INGEST_URL}`,
  );
  void pollOnce();
  setInterval(() => void pollOnce(), POLL_INTERVAL_MS);
}
