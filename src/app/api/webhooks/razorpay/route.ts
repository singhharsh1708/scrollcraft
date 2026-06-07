import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

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

  if (expectedSignature !== signature) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  let event: { event: string; payload?: { payment?: { entity?: { id?: string; notes?: Record<string, string> } } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  switch (event.event) {
    case "payment.captured": {
      const payment = event.payload?.payment?.entity;
      if (payment) {
        const { plan, billing } = payment.notes ?? {};
        // TODO: update user subscription in database using payment.id, plan, billing
        console.log("Payment captured:", { paymentId: payment.id, plan, billing });
      }
      break;
    }
    case "payment.failed":
      console.log("Payment failed:", event.payload?.payment?.entity?.id);
      break;
    default:
      // Unhandled event type — acknowledge receipt
      break;
  }

  return NextResponse.json({ received: true });
}
