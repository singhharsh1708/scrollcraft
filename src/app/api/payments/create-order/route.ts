import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Razorpay from "razorpay";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

const orderSchema = z.object({
  plan: z.enum(["Basic", "Basic Plus", "Pro", "Premium"]),
  billing: z.enum(["monthly", "annual"]).default("monthly"),
  promoCode: z.string().max(50).optional(),
});

// Prices in INR paise (1 INR = 100 paise)
const PLAN_PRICES: Record<string, { monthly: number; annual: number }> = {
  Basic:        { monthly: 199900, annual: 159900 },
  "Basic Plus": { monthly: 299900, annual: 239900 },
  Pro:          { monthly: 499900, annual: 399900 },
  Premium:      { monthly: 1499900, annual: 1199900 },
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(getClientIp(req), { limit: 5, windowMs: 3_600_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many payment requests. Try again later." }, { status: 429 });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: "Payment gateway not configured" }, { status: 503 });
  }

  try {
    const raw = await req.json();
    const parsed = orderSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { plan, billing, promoCode } = parsed.data;

    const prices = PLAN_PRICES[plan];
    if (!prices) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });

    // Annual price is stored as the discounted per-month rate — multiply by 12 for the actual charge.
    let baseAmount = billing === "annual" ? prices.annual * 12 : prices.monthly;
    let discountPct = 0;
    let validPromo: string | null = null;

    // Validate promo code if provided
    if (promoCode) {
      const promo = await db.promoCode.findUnique({
        where: { code: promoCode.toUpperCase() },
      });
      if (
        promo &&
        promo.active &&
        (!promo.expiresAt || promo.expiresAt > new Date()) &&
        (promo.maxUses === null || promo.uses < promo.maxUses)
      ) {
        discountPct = promo.discountPct;
        validPromo = promo.code;
        baseAmount = Math.round(baseAmount * (1 - discountPct / 100));
        // Increment usage count
        await db.promoCode.update({
          where: { code: promo.code },
          data: { uses: { increment: 1 } },
        });
      }
    }

    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await rzp.orders.create({
      amount: baseAmount,
      currency: "INR",
      notes: {
        plan,
        billing: billing ?? "monthly",
        ...(validPromo ? { promoCode: validPromo, discountPct: String(discountPct) } : {}),
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      discountPct,
    });
  } catch (err) {
    console.error("create-order error:", err);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
