import { NextResponse, type NextRequest } from "next/server";
import { grantPack, revokePack } from "@/lib/credits";
import { signedByStripe, stripeIsLive } from "@/lib/stripe";
import { logger } from "@/lib/logger";

/**
 * What Stripe tells us after somebody pays.
 *
 * A pack bought through Stripe belongs to an account, never to a browser: checkout can
 * only be opened by somebody signed in, and the account it was opened for rides along in
 * the session's metadata. That is the only thing read from the payload besides whether
 * the money arrived. No email, no name and no address is kept; Stripe holds those.
 *
 * The order is the payment intent, so the same pack cannot be granted twice by a
 * redelivery and a refund can find the pack it belongs to.
 */

const MAX_BODY_BYTES = 300_000;
/** Only a signed-in GitHub account can open a checkout, so only one can be credited. */
const ACCOUNT = /^gh:[0-9]{1,20}$/;

type StripeEvent = {
  type?: string;
  livemode?: boolean;
  data?: { object?: Record<string, unknown> };
};

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Payments are not configured on this deployment." }, { status: 503 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }
  if (!signedByStripe(raw, req.headers.get("stripe-signature"), secret)) {
    logger.warn("stripe webhook rejected: signature did not match");
    return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  // A shop taking real money must never credit a test payment, whatever signed it.
  if (stripeIsLive() && event.livemode !== true) {
    logger.info("stripe webhook ignored a test mode event", { type: event.type });
    return NextResponse.json({ ok: true, ignored: "test-mode" });
  }

  const object = event.data?.object ?? {};

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    // A delayed method completes the session before the money lands. The second event
    // arrives when it does, so this one is left alone rather than trusted early.
    if (object.payment_status !== "paid") {
      return NextResponse.json({ ok: true, ignored: "unpaid" });
    }
    const identity = (object.metadata as { identity?: unknown } | undefined)?.identity;
    const order = object.payment_intent ?? object.id;
    if (typeof identity !== "string" || !ACCOUNT.test(identity) || typeof order !== "string" || !order) {
      logger.error("stripe webhook: a paid session with no account to credit", { type: event.type });
      return NextResponse.json({ error: "Unusable payload." }, { status: 422 });
    }
    const result = await grantPack(identity, `stripe:${order}`);
    if (result === "unavailable") {
      // 500 asks Stripe to deliver it again, which is right: paid, and not yet credited.
      logger.error("stripe webhook: no store to record the purchase in", { order });
      return NextResponse.json({ error: "Could not record that yet." }, { status: 500 });
    }
    logger.info("stripe webhook granted a pack", { order, result });
    return NextResponse.json({ ok: true, result });
  }

  if (event.type === "charge.refunded") {
    // The event fires for a partial refund too. Only a full one takes the pack back,
    // which is what the terms promise: a partial refund is for what is left unused.
    if (object.refunded !== true || typeof object.payment_intent !== "string") {
      return NextResponse.json({ ok: true, ignored: "partial-refund" });
    }
    const result = await revokePack(`stripe:${object.payment_intent}`);
    if (result === "unavailable") return NextResponse.json({ error: "Could not record that yet." }, { status: 500 });
    logger.info("stripe webhook took a refunded pack back", { result });
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ ok: true, ignored: event.type ?? "unnamed" });
}
