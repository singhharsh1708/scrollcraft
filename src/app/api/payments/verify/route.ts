import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { consumePromoCode } from "@/lib/promo";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { PLANS } from "@/lib/plans";

// Conditional UPDATE so concurrent captures can never push uses past maxUses.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(getClientIp(req), { bucket: "payments-verify", limit: 10, windowMs: 3_600_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return NextResponse.json({ error: "Payment gateway not configured" }, { status: 503 });
  }

  try {
    const { orderId, paymentId, signature } = await req.json();

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json({ error: "Missing payment details" }, { status: 400 });
    }

    // Verify HMAC signature
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const expectedBuf = Buffer.from(expectedSignature, "hex");
    const actualBuf = Buffer.from(typeof signature === "string" ? signature : "", "hex");
    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    // Verify the order belongs to the current user
    const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const payment = await db.payment.findUnique({ where: { razorpayOrderId: orderId } });
    if (!payment) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (payment.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Idempotency: if already captured (e.g. webhook arrived first), return success
    if (payment.status === "CAPTURED") {
      return NextResponse.json({ success: true, paymentId });
    }

    // Mark payment captured and upgrade plan
    const planMap: Record<string, "BASIC" | "BASIC_PLUS" | "PRO" | "PREMIUM"> = {
      Basic: "BASIC", "Basic Plus": "BASIC_PLUS", Pro: "PRO", Premium: "PREMIUM",
    };
    const newPlan = planMap[payment.plan];

    // Claim the capture atomically — the webhook may be processing the same payment,
    // and only the winner grants the plan and consumes the promo use. A refunded
    // payment is never re-captured.
    const claimed = await db.payment.updateMany({
      where: { id: payment.id, status: { in: ["PENDING", "FAILED"] } },
      data: { razorpayPaymentId: paymentId, status: "CAPTURED" },
    });
    if (claimed.count > 0) {
      if (newPlan) {
        // Grant the plan's credit allowance. Nothing wrote `credits` anywhere, so it sat
        // at the schema default of 100 forever — the dashboard computes used = max
        // remaining, and a customer who had just paid for Pro was shown "5,900 / 6,000
        // used" with 100 left.
        await db.user.update({
          where: { id: user.id },
          data: { plan: newPlan, credits: PLANS[newPlan].credits },
        });
      }
      await consumePromoCode(payment.promoCode);
    }

    return NextResponse.json({ success: true, paymentId });
  } catch (err) {
    console.error("verify error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
