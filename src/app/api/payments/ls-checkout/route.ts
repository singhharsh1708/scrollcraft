import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createExportCheckout } from "@/lib/lemonsqueezy";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { env } from "@/lib/env";

const schema = z.object({ siteId: z.string().min(1).max(128) });

export async function POST(req: NextRequest) {
  const rl = await rateLimit(getClientIp(req), { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!env.LEMONSQUEEZY_API_KEY || !env.LEMONSQUEEZY_STORE_ID || !env.LEMONSQUEEZY_VARIANT_ID) {
    return NextResponse.json({ error: "Export purchases not configured" }, { status: 503 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { siteId } = parsed.data;

  const site = await db.site.findUnique({
    where: { id: siteId, userId: session.user.id },
    select: { id: true, name: true },
  });

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  // Check if already purchased (idempotency)
  const existing = await db.exportPurchase.findFirst({
    where: { siteId, userId: session.user.id, status: "PAID" },
  });
  if (existing) {
    return NextResponse.json({ alreadyPurchased: true });
  }

  try {
    const { checkoutUrl } = await createExportCheckout({
      siteId: site.id,
      userId: session.user.id,
      userEmail: session.user.email ?? "",
      siteName: site.name,
    });
    // The PAID record is created by the webhook (keyed on the real LS order ID,
    // carrying site_id/user_id in custom_data) — no placeholder row needed here.
    return NextResponse.json({ checkoutUrl });
  } catch (err) {
    console.error("LS checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
