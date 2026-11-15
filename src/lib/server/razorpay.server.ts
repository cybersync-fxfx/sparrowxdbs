import { env } from "./config.server";
import { hmacSha256Hex, timingSafeEqual } from "./crypto.server";

function auth() {
  const id = env("RAZORPAY_KEY_ID");
  const secret = env("RAZORPAY_KEY_SECRET");
  if (!id || !secret) throw new Error("Razorpay is not configured");
  return { id, secret, header: `Basic ${btoa(`${id}:${secret}`)}` };
}

export async function createOrder(clientId: string, amountInr: number) {
  const a = auth();
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: a.header, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: amountInr * 100, currency: "INR", receipt: `sx_${Date.now()}`, notes: { client_id: clientId, coins: String(amountInr) } }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Razorpay order failed [${res.status}]: ${text}`);
  const o = JSON.parse(text) as { id: string; amount: number };
  return { orderId: o.id, amount: o.amount, keyId: a.id };
}

export async function fetchOrder(orderId: string) {
  const a = auth();
  const res = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: a.header } });
  const text = await res.text();
  if (!res.ok) throw new Error(`Razorpay order lookup failed [${res.status}]: ${text}`);
  return JSON.parse(text) as { id: string; amount_paid: number; status: string; notes: { client_id?: string } };
}

export async function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const expected = await hmacSha256Hex(auth().secret, `${orderId}|${paymentId}`);
  return timingSafeEqual(expected, signature);
}

export async function verifyWebhook(rawBody: string, signature: string | null) {
  const secret = env("RAZORPAY_WEBHOOK_SECRET");
  if (!secret || !signature) return false;
  return timingSafeEqual(await hmacSha256Hex(secret, rawBody), signature);
}
