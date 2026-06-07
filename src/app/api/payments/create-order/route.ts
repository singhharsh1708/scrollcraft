import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

const PLAN_PRICES: Record<string, { monthly: number; annual: number }> = {
  Basic:      { monthly: 25,  annual: 20  },
  "Basic Plus": { monthly: 40,  annual: 32  },
  Pro:        { monthly: 60,  annual: 48  },
  Premium:    { monthly: 200, annual: 160 },
};

export async function POST(req: NextRequest) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return NextResponse.json({ error: "Payment gateway not configured" }, { status: 503 });
  }

  try {
    const { plan, billing } = await req.json();

    const prices = PLAN_PRICES[plan as string];
    if (!prices) {
      return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
    }

    const priceUsd = billing === "annual" ? prices.annual : prices.monthly;
    // Razorpay expects amount in smallest currency unit (paise for INR)
    // We store price in USD but charge in INR — use a fixed exchange rate placeholder
    // Production should fetch live rates or store INR prices directly
    const INR_RATE = 84; // approximate USD → INR
    const amountPaise = priceUsd * INR_RATE * 100;

    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

    const order = await rzp.orders.create({
      amount: Math.round(amountPaise),
      currency: "INR",
      notes: { plan, billing: billing ?? "monthly" },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
    });
  } catch (err) {
    console.error("create-order error:", err);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
