import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(getClientIp(req), { limit: 10, windowMs: 3_600_000 });
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

    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))) {
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

    await db.payment.update({ where: { id: payment.id }, data: { razorpayPaymentId: paymentId, status: "CAPTURED" } });
    if (newPlan) await db.user.update({ where: { id: user.id }, data: { plan: newPlan } });

    return NextResponse.json({ success: true, paymentId });
  } catch (err) {
    console.error("verify error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
