import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { siteUrl } from "@/lib/env";
import { PACK_PRICE_USD } from "@/lib/credits";

/**
 * Dodo Payments, spoken to directly, the same way as Stripe: no SDK and nothing of theirs
 * in the browser. Dodo is the merchant of record, so they sell the pack and handle the tax.
 */

const HOSTS = { test_mode: "https://test.dodopayments.com", live_mode: "https://live.dodopayments.com" };
const TIMEOUT_MS = 10_000;
/** How far a webhook's own timestamp may be from now. The Standard Webhooks default. */
const SIGNATURE_TOLERANCE_SEC = 300;

export function dodoConfigured(): boolean {
  return Boolean(process.env.DODO_PAYMENTS_API_KEY && process.env.DODO_PRODUCT_ID);
}

function host(): string {
  return process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? HOSTS.live_mode : HOSTS.test_mode;
}

async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(`${host()}/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${process.env.DODO_PAYMENTS_API_KEY}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    // An error page rather than JSON; the status says enough.
  }
  if (!response.ok) {
    throw new Error(typeof data.message === "string" ? data.message : `Dodo answered ${response.status}`);
  }
  return data;
}

let checkedProduct: string | null = null;

async function productId(): Promise<string> {
  const id = process.env.DODO_PRODUCT_ID ?? "";
  if (checkedProduct === id) return id;
  const product = await call("GET", `products/${encodeURIComponent(id)}`);
  const price = product.price as { type?: string; price?: number; currency?: string } | undefined;
  // The buyer must never be charged something the pricing page did not quote.
  if (price?.type !== "one_time_price" || price.price !== PACK_PRICE_USD * 100 || price.currency !== "USD") {
    throw new Error(`The Dodo product is ${price?.price} ${price?.currency}, and the site quotes $${PACK_PRICE_USD}`);
  }
  checkedProduct = id;
  return id;
}

/** Open a checkout for one pack. The webhook reads the account back from the metadata. */
export async function createCheckout(identity: string): Promise<string> {
  const session = await call("POST", "checkouts", {
    product_cart: [{ product_id: await productId(), quantity: 1 }],
    metadata: { identity },
    return_url: `${siteUrl}/pricing?bought=1`,
    cancel_url: `${siteUrl}/pricing`,
  });
  if (typeof session.checkout_url !== "string") throw new Error("Dodo opened a checkout with no address");
  return session.checkout_url;
}

/**
 * Whether Dodo sent this, by the Standard Webhooks scheme: an HMAC of `id.timestamp.body`
 * keyed with the base64 part of the secret, and a timestamp so a capture cannot be replayed.
 */
export function signedByDodo(
  raw: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
  now = Date.now()
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > SIGNATURE_TOLERANCE_SEC) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  if (key.length === 0) return false;
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${raw}`).digest();
  return signature.split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const sent = Buffer.from(value, "base64");
    return sent.length === expected.length && timingSafeEqual(sent, expected);
  });
}
