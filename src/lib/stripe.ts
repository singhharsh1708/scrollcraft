import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { siteUrl } from "@/lib/env";
import { PACK_PRICE_USD } from "@/lib/credits";

/**
 * Stripe, spoken to directly.
 *
 * No SDK. Two calls are made and one signature is checked, and a dependency that size is
 * a lot to carry for that. It also keeps the rule this codebase already holds: no payment
 * code runs in the browser. Checkout is a redirect to Stripe's own page, so there is no
 * card field of ours, no script of theirs, and nothing for the content security policy
 * to let through.
 *
 * Absent the key, everything here says so and the shop is simply not offered, the same
 * way the rest of the app behaves on an empty environment.
 */

const API = "https://api.stripe.com/v1";
const TIMEOUT_MS = 10_000;
/** How far a webhook's own timestamp may be from now. Stripe's recommended window. */
const SIGNATURE_TOLERANCE_SEC = 300;
/** Finds the price by name, so the same code runs against test and live accounts. */
export const PRICE_LOOKUP_KEY = "five_sites_usd";

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Whether the configured key takes real money. Used to refuse test events on a live shop. */
export function stripeIsLive(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_");
}

async function call(method: "GET" | "POST", path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const body = new URLSearchParams(params);
  const url = method === "GET" ? `${API}/${path}?${body}` : `${API}/${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? body : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const error = data.error as { message?: string } | undefined;
    throw new Error(error?.message ?? `Stripe answered ${response.status}`);
  }
  return data;
}

let cachedPrice: string | null = null;

async function priceId(): Promise<string> {
  if (process.env.STRIPE_PRICE_ID) return process.env.STRIPE_PRICE_ID;
  if (cachedPrice) return cachedPrice;
  const found = await call("GET", "prices", { "lookup_keys[]": PRICE_LOOKUP_KEY, active: "true", limit: "1" });
  const first = (found.data as { id: string; unit_amount: number; currency: string }[] | undefined)?.[0];
  if (!first) throw new Error(`No active Stripe price has the lookup key ${PRICE_LOOKUP_KEY}`);
  // The page quotes one price. A price in the account that disagrees with it must not be
  // charged quietly: the buyer would pay something the site never told them.
  if (first.unit_amount !== PACK_PRICE_USD * 100 || first.currency !== "usd") {
    throw new Error(`The Stripe price is ${first.unit_amount} ${first.currency}, and the site quotes $${PACK_PRICE_USD}`);
  }
  cachedPrice = first.id;
  return first.id;
}

/**
 * Open a checkout for one pack, for one account.
 *
 * The account travels in metadata rather than in client_reference_id alone, which Stripe
 * restricts to letters, digits, dashes and underscores. It is what the webhook reads back
 * to decide whose credits these are, so it is set here and nowhere a buyer can edit it.
 */
export async function createCheckout(identity: string): Promise<string> {
  const session = await call("POST", "checkout/sessions", {
    mode: "payment",
    "line_items[0][price]": await priceId(),
    "line_items[0][quantity]": "1",
    client_reference_id: identity.replace(/[^A-Za-z0-9_-]/g, "_"),
    "metadata[identity]": identity,
    "payment_intent_data[metadata][identity]": identity,
    "payment_intent_data[description]": "ScrollCraft: five sites written from a description",
    success_url: `${siteUrl}/pricing?bought=1`,
    cancel_url: `${siteUrl}/pricing`,
  });
  if (typeof session.url !== "string") throw new Error("Stripe opened a checkout with no address");
  return session.url;
}

/**
 * Whether Stripe sent this.
 *
 * The header carries a timestamp and one or more signatures of `timestamp.body`. The
 * timestamp is checked as well as the signature, so a captured delivery cannot be
 * replayed tomorrow to grant the same pack again under a new event.
 */
export function signedByStripe(raw: string, header: string | null, secret: string, now = Date.now()): boolean {
  if (!header) return false;
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value ?? "";
    if (key === "v1" && value) signatures.push(value);
  }
  if (!/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > SIGNATURE_TOLERANCE_SEC) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest();
  return signatures.some((candidate) => {
    const sent = Buffer.from(candidate, "hex");
    return sent.length === expected.length && timingSafeEqual(sent, expected);
  });
}
