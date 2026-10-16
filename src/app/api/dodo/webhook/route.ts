import { NextResponse, type NextRequest } from "next/server";
import { grantPack, revokePack } from "@/lib/credits";
import { signedByDodo } from "@/lib/dodo";
import { logger } from "@/lib/logger";

/**
 * What Dodo tells us after somebody pays. Only the account in the metadata and whether the
 * money arrived are read; the payment id makes redeliveries and refunds idempotent.
 */

const MAX_BODY_BYTES = 300_000;
const ACCOUNT = /^gh:[0-9]{1,20}$/;

type DodoEvent = {
  type?: string;
  data?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  const secret = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Payments are not configured on this deployment." }, { status: 503 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }
  const signed = signedByDodo(
    raw,
    {
      id: req.headers.get("webhook-id"),
      timestamp: req.headers.get("webhook-timestamp"),
      signature: req.headers.get("webhook-signature"),
    },
    secret
  );
  if (!signed) {
    logger.warn("dodo webhook rejected: signature did not match");
    return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  }

  let event: DodoEvent;
  try {
    event = JSON.parse(raw) as DodoEvent;
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const data = event.data ?? {};

  if (event.type === "payment.succeeded") {
    if (data.status !== undefined && data.status !== "succeeded") {
      return NextResponse.json({ ok: true, ignored: "unpaid" });
    }
    const identity = (data.metadata as { identity?: unknown } | undefined)?.identity;
    const order = data.payment_id;
    if (typeof identity !== "string" || !ACCOUNT.test(identity) || typeof order !== "string" || !order) {
      logger.error("dodo webhook: a payment with no account to credit", { type: event.type });
      return NextResponse.json({ error: "Unusable payload." }, { status: 422 });
    }
    const result = await grantPack(identity, `dodo:${order}`);
    if (result === "unavailable") {
      // 500 makes Dodo retry: paid, and not yet credited.
      logger.error("dodo webhook: no store to record the purchase in", { order });
      return NextResponse.json({ error: "Could not record that yet." }, { status: 500 });
    }
    logger.info("dodo webhook granted a pack", { order, result });
    return NextResponse.json({ ok: true, result });
  }

  if (event.type === "refund.succeeded") {
    // Only a full refund takes the pack back; a partial one is for what is left unused.
    if (data.is_partial !== false || typeof data.payment_id !== "string") {
      return NextResponse.json({ ok: true, ignored: "partial-refund" });
    }
    const result = await revokePack(`dodo:${data.payment_id}`);
    if (result === "unavailable") return NextResponse.json({ error: "Could not record that yet." }, { status: 500 });
    logger.info("dodo webhook took a refunded pack back", { result });
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ ok: true, ignored: event.type ?? "unnamed" });
}
