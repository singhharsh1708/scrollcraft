import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";

const PLAN_MAP: Record<string, "BASIC" | "BASIC_PLUS" | "PRO" | "PREMIUM"> = {
  Basic: "BASIC", "Basic Plus": "BASIC_PLUS", Pro: "PRO", Premium: "PREMIUM",
};

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

  let event: { event: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; notes?: Record<string, string> } } } };
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
        // Idempotency: skip if already captured (verify endpoint may have run first)
        const payment = await db.payment.findUnique({ where: { razorpayOrderId: entity.order_id } });
        if (payment && payment.status !== "CAPTURED") {
          await db.payment.update({
            where: { id: payment.id },
            data: { razorpayPaymentId: entity.id, status: "CAPTURED" },
          });
          const newPlan = PLAN_MAP[payment.plan];
          if (newPlan) {
            await db.user.update({ where: { id: payment.userId }, data: { plan: newPlan } });
          }
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
    default:
      break;
  }
  } catch (err) {
    console.error("Webhook processing failed:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
