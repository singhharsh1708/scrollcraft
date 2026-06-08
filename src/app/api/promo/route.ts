import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

const schema = z.object({ code: z.string().min(1).max(50) });

export async function POST(req: NextRequest) {
  const rl = await rateLimit(getClientIp(req), { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const raw = await req.json();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const promo = await db.promoCode.findUnique({
    where: { code: parsed.data.code.toUpperCase() },
  });

  if (!promo || !promo.active) {
    return NextResponse.json({ error: "Invalid promo code" }, { status: 404 });
  }
  if (promo.expiresAt && promo.expiresAt < new Date()) {
    return NextResponse.json({ error: "Promo code has expired" }, { status: 410 });
  }
  if (promo.maxUses !== null && promo.uses >= promo.maxUses) {
    return NextResponse.json({ error: "Promo code has reached its usage limit" }, { status: 410 });
  }

  return NextResponse.json({ code: promo.code, discountPct: promo.discountPct });
}
