import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import crypto from "crypto";
import Razorpay from "razorpay";
import { db } from "@/lib/db";
import { consumePromoCode } from "@/lib/promo";
import { PLANS } from "@/lib/plans";

const PLAN_MAP: Record<string, "BASIC" | "BASIC_PLUS" | "PRO" | "PREMIUM"> = {
  Basic: "BASIC", "Basic Plus": "BASIC_PLUS", Pro: "PRO", Premium: "PREMIUM",
};

type PaymentEntity = {
  id?: string;
  order_id?: string;
  amount?: number;
  amount_refunded?: number;
  refund_status?: string | null;
  currency?: string;
  // `notes` is deliberately absent: on a payment entity they are the browser-supplied
  // Checkout.js notes, never the server-set order notes. See fetchOrderNotes.
};

// Only a full refund undoes the purchase — a partial/goodwill refund leaves the
// customer on the plan they are still paying for.
function isFullRefund(entity: PaymentEntity): boolean {
  if (typeof entity.refund_status === "string") return entity.refund_status === "full";
  const total = Number(entity.amount);
  const refunded = Number(entity.amount_refunded);
  // No amounts to compare (older payload shapes) — treat it as a full refund.
  if (!Number.isFinite(total) || !Number.isFinite(refunded) || total <= 0) return true;
  return refunded >= total;
}

// The refunded order is not necessarily the one backing the current plan (an earlier
// purchase may have been superseded by an upgrade), so re-derive the plan from what
// the user still has captured instead of dropping them to FREE outright.
async function repriceUserPlan(userId: string) {
  const latest = await db.payment.findFirst({
    where: { userId, status: "CAPTURED" },
    orderBy: { createdAt: "desc" },
    select: { plan: true },
  });
  const nextPlan = (latest ? PLAN_MAP[latest.plan] : undefined) ?? "FREE";
  // Reprice the credit allowance with the plan — otherwise a user refunded from
  // Premium down to Basic Plus keeps Premium's 25,000 credits.
  await db.user.update({
    where: { id: userId },
    data: { plan: nextPlan, credits: PLANS[nextPlan].credits },
  });
}

// Conditional UPDATE so concurrent captures can never push uses past maxUses.
async function applyPlan(userId: string, planName: string | null | undefined) {
  const newPlan = planName ? PLAN_MAP[planName] : undefined;
  if (newPlan) {
    // Grant credits alongside the plan — the webhook is the path that runs when the
    // browser never returns from checkout, so omitting them here leaves exactly the
    // same "paid but shows 100 credits left" state as the verify route did.
    await db.user.update({
      where: { id: userId },
      data: { plan: newPlan, credits: PLANS[newPlan].credits },
    });
  }
}

// The notes on a *payment* entity come from the browser's Checkout.js options, so a
// caller can put any userId or plan in them. Only the notes on the *order* were written
// server-side by create-order, so the order is fetched from Razorpay rather than trusting
// anything in the payload. Returns null when the gateway keys are missing — nothing can
// be verified then, so nothing is granted.
async function fetchOrderNotes(orderId: string): Promise<{ notes: Record<string, string>; amount: number } | null> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
  // A failed fetch throws, which surfaces as a 500 and makes Razorpay retry.
  const order = await rzp.orders.fetch(orderId);
  const notes: Record<string, string> = {};
  for (const [key, value] of Object.entries(order.notes ?? {})) {
    if (typeof value === "string" || typeof value === "number") notes[key] = String(value);
  }
  return { notes, amount: Number(order.amount) };
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  const expectedBuf = Buffer.from(expectedSignature, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  let event: { event: string; payload?: { payment?: { entity?: PaymentEntity } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
  switch (event.event) {
    case "payment.captured": {
      const entity = event.payload?.payment?.entity;
      if (entity?.order_id) {
        const payment = await db.payment.findUnique({ where: { razorpayOrderId: entity.order_id } });

        if (payment) {
          // Idempotency: only the request that flips PENDING -> CAPTURED fulfils the
          // order, so the verify endpoint racing us cannot double-consume the promo.
          // A refunded payment is never re-captured by a late redelivery.
          const claimed = await db.payment.updateMany({
            where: { id: payment.id, status: { in: ["PENDING", "FAILED"] } },
            data: { razorpayPaymentId: entity.id, status: "CAPTURED" },
          });
          if (claimed.count > 0) {
            await applyPlan(payment.userId, payment.plan);
            await consumePromoCode(payment.promoCode);
          }
        } else {
          // No local record of the order — rebuild it from the order's own notes rather
          // than leaving a paying customer on their old plan.
          const order = await fetchOrderNotes(entity.order_id);
          if (!order) {
            console.error("Payment gateway not configured — cannot verify order:", entity.order_id);
            return NextResponse.json({ error: "Payment gateway not configured" }, { status: 503 });
          }
          const notes = order.notes;
          const plan = notes.plan ?? "";
          // Only an order this app created carries a userId and a known plan in its
          // notes; anything else (a payment link, another product) is not a plan sale.
          const userId = notes.userId
            ? (await db.user.findUnique({ where: { id: notes.userId }, select: { id: true } }))?.id
            : undefined;
          // The captured amount must be the one the order was raised for.
          const paidAmount = Number(entity.amount);
          if (!userId || !PLAN_MAP[plan] || !Number.isFinite(order.amount) || paidAmount !== order.amount) {
            console.error("Captured payment is not a fulfillable plan order:", entity.order_id);
            break;
          }
          const discountPct = Number.parseInt(notes.discountPct ?? "", 10);
          await db.payment.create({
            data: {
              userId,
              razorpayOrderId: entity.order_id,
              razorpayPaymentId: entity.id,
              plan,
              billing: notes.billing ?? "monthly",
              amount: order.amount,
              currency: entity.currency ?? "INR",
              promoCode: notes.promoCode ?? null,
              discountPct: Number.isNaN(discountPct) ? null : discountPct,
              status: "CAPTURED",
            },
          });
          await applyPlan(userId, plan);
          await consumePromoCode(notes.promoCode ?? null);
        }
      }
      break;
    }
    case "payment.failed": {
      const entity = event.payload?.payment?.entity;
      if (entity?.order_id) {
        // Let errors propagate — a 5xx tells Razorpay to retry the webhook
        await db.payment.updateMany({
          where: { razorpayOrderId: entity.order_id, status: "PENDING" },
          data: { status: "FAILED" },
        });
      }
      break;
    }
    case "refund.processed":
    case "payment.refunded": {
      const entity = event.payload?.payment?.entity;
      if (entity?.order_id) {
        if (!isFullRefund(entity)) {
          console.warn("Partial refund — plan left in place:", entity.order_id);
          break;
        }
        const payment = await db.payment.findUnique({ where: { razorpayOrderId: entity.order_id } });
        if (payment) {
          const refunded = await db.payment.updateMany({
            where: { id: payment.id, status: { not: "REFUNDED" } },
            data: { status: "REFUNDED" },
          });
          if (refunded.count > 0) {
            await repriceUserPlan(payment.userId);
          }
        }
      }
      break;
    }
    default:
      break;
  }
  } catch (err) {
    logger.error("razorpay webhook processing failed", { err });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
