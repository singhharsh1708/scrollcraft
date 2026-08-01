import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";

const schema = z.object({ code: z.string().min(1).max(50) });

// One response for every unusable code. Splitting 404 "no such code" from 410 "expired"
// told an enumerator which guesses were real codes.
const REJECTED = { error: "That promo code isn't valid." };

export async function POST(req: NextRequest) {
  // Deliberately unauthenticated: visitors apply a code on /pricing before signing in,
  // and only checkout gates on auth. Enumeration is limited by rate and by the uniform
  // response below rather than by requiring an account.
  const rl = await rateLimit(`promo:${getClientIp(req)}`, { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // A malformed body threw out of the handler as a bare 500 rather than a 400.
  let raw: unknown;
  try {
    raw = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(REJECTED, { status: 404 });
  }

  // An unreachable database threw straight out of the handler as an empty-bodied 500.
  let promo: Awaited<ReturnType<typeof db.promoCode.findUnique>>;
  try {
    promo = await db.promoCode.findUnique({
      where: { code: parsed.data.code.toUpperCase() },
    });
  } catch (err) {
    logger.error("Promo lookup failed", { error: String(err) });
    return NextResponse.json({ error: "Couldn't check that code right now." }, { status: 503 });
  }

  if (!promo) {
    return NextResponse.json(REJECTED, { status: 404 });
  }

  const unusable =
    !promo.active ||
    (promo.expiresAt !== null && promo.expiresAt < new Date()) ||
    (promo.maxUses !== null && promo.uses >= promo.maxUses);

  if (unusable) {
    return NextResponse.json(REJECTED, { status: 404 });
  }

  return NextResponse.json({ code: promo.code, discountPct: promo.discountPct });
}
