import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
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

// How long an issued-but-unpaid order keeps holding a promo use. Past this the
// checkout is treated as abandoned and the use is released to someone else.
const PROMO_HOLD_MS = 30 * 60_000;

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

  const rl = await rateLimit(getClientIp(req), { bucket: "create-order", limit: 5, windowMs: 3_600_000 });
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

    const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Annual price is stored as the discounted per-month rate — multiply by 12 for the actual charge.
    let baseAmount = billing === "annual" ? prices.annual * 12 : prices.monthly;
    let discountPct = 0;
    let validPromo: string | null = null;

    // Validate promo code if provided. The use is only consumed once the payment is
    // captured, so an abandoned or failed checkout does not burn one.
    if (promoCode) {
      const promo = await db.promoCode.findUnique({
        where: { code: promoCode.toUpperCase() },
      });
      const usable = promo && promo.active && (!promo.expiresAt || promo.expiresAt > new Date());
      if (usable) {
        const { maxUses } = promo;
        let withinCap = maxUses === null;
        if (maxUses !== null) {
          // `uses` only moves at capture, so orders already issued against this code
          // count as held uses here. Without them a burst of concurrent checkouts
          // would all read the same `uses` and every one would be discounted.
          const held = await db.payment.count({
            where: {
              promoCode: promo.code,
              status: "PENDING",
              createdAt: { gte: new Date(Date.now() - PROMO_HOLD_MS) },
            },
          });
          withinCap = promo.uses + held < maxUses;
        }
        if (withinCap) {
          discountPct = promo.discountPct;
          validPromo = promo.code;
          baseAmount = Math.round(baseAmount * (1 - discountPct / 100));
        }
      }
      // A code was entered but could not be applied (unknown, inactive, expired, or fully
      // used). Say so rather than silently charging full price against a shown discount.
      if (!validPromo) {
        return NextResponse.json(
          { error: "That promo code isn't valid. Remove it or try another.", code: "PROMO_INVALID" },
          { status: 400 }
        );
      }
    }

    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await rzp.orders.create({
      amount: baseAmount,
      currency: "INR",
      notes: {
        plan,
        billing,
        userId: user.id,
        ...(validPromo ? { promoCode: validPromo, discountPct: String(discountPct) } : {}),
      },
    });

    // Persist the order before returning — verify and the webhook both key off this row.
    await db.payment.create({
      data: {
        userId: user.id,
        razorpayOrderId: order.id,
        plan,
        billing,
        amount: baseAmount,
        currency: "INR",
        promoCode: validPromo,
        discountPct: validPromo ? discountPct : null,
        status: "PENDING",
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
    logger.error("create-order failed", { err });
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
