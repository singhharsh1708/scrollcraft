import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { grantPack, hashKey, revokePack } from "@/lib/credits";
import { logger } from "@/lib/logger";

/**
 * What Lemon Squeezy tells us after somebody pays.
 *
 * The only thing taken from the payload is a licence key, an order number and an email.
 * Nothing else is kept: the order, the card, the country and the buyer's name stay with
 * the payment processor, which is where they belong.
 *
 * Credits are added on licence_key_created rather than order_created, because the key is
 * the identity and the two events arrive separately with no promised order.
 */

const MAX_BODY_BYTES = 200_000;

function signed(raw: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const sent = Buffer.from(header, "hex");
  const expected = createHmac("sha256", secret).update(raw).digest();
  // timingSafeEqual throws on a length mismatch, so the lengths are compared first.
  return sent.length === expected.length && timingSafeEqual(sent, expected);
}

type Payload = {
  meta?: { event_name?: string; custom_data?: Record<string, unknown> };
  data?: { id?: string; attributes?: Record<string, unknown> };
};

function orderIdOf(payload: Payload): string {
  const attributes = payload.data?.attributes ?? {};
  const fromKey = attributes.order_id;
  if (typeof fromKey === "number" || typeof fromKey === "string") return String(fromKey);
  return String(payload.data?.id ?? "");
}

export async function POST(req: NextRequest) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Payments are not configured on this deployment." }, { status: 503 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }
  if (!signed(raw, req.headers.get("x-signature"), secret)) {
    logger.warn("lemon webhook rejected: signature did not match");
    return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  }

  let payload: Payload;
  try {
    payload = JSON.parse(raw) as Payload;
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const event = payload.meta?.event_name ?? "";
  const attributes = payload.data?.attributes ?? {};
  const testMode = attributes.test_mode === true;
  // A test purchase must not hand out credits that spend real money on the live site.
  if (testMode && process.env.NODE_ENV === "production" && process.env.LEMONSQUEEZY_ACCEPT_TEST_MODE !== "1") {
    logger.info("lemon webhook ignored a test mode order", { event });
    return NextResponse.json({ ok: true, ignored: "test-mode" });
  }

  if (event === "license_key_created") {
    const key = typeof attributes.key === "string" ? attributes.key : "";
    const orderId = orderIdOf(payload);
    if (!key || !orderId) {
      logger.error("lemon webhook: a licence key event without a key or an order", { event });
      return NextResponse.json({ error: "Unusable payload." }, { status: 422 });
    }
    const email = typeof attributes.user_email === "string" ? attributes.user_email : undefined;
    const result = await grantPack(hashKey(key), orderId, email);
    if (result === "unavailable") {
      // Answering 500 asks Lemon Squeezy to deliver it again, which is what should
      // happen: the money has been taken and the credits have not been given.
      logger.error("lemon webhook: no store to record the purchase in", { orderId });
      return NextResponse.json({ error: "Could not record that yet." }, { status: 500 });
    }
    logger.info("lemon webhook granted a pack", { orderId, result });
    return NextResponse.json({ ok: true, result });
  }

  if (event === "order_refunded") {
    const result = await revokePack(orderIdOf(payload));
    if (result === "unavailable") return NextResponse.json({ error: "Could not record that yet." }, { status: 500 });
    logger.info("lemon webhook took a refunded pack back", { result });
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ ok: true, ignored: event || "unnamed" });
}
