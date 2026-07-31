import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createExportCheckout, getExportCheckoutUrl } from "@/lib/lemonsqueezy";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { env } from "@/lib/env";

const schema = z.object({ siteId: z.string().min(1).max(128) });

// How long an unresolved checkout is treated as still in flight.
const PENDING_CHECKOUT_TTL_MS = 30 * 60_000;

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

  // A payment already in flight (webhook not landed yet) must not start a second
  // checkout — send the user back to the one they already opened.
  const pending = await db.exportPurchase.findFirst({
    where: {
      siteId,
      userId: session.user.id,
      status: "PENDING",
      createdAt: { gte: new Date(Date.now() - PENDING_CHECKOUT_TTL_MS) },
    },
    orderBy: { createdAt: "desc" },
    select: { lsCheckoutId: true },
  });

  if (pending?.lsCheckoutId) {
    const pendingUrl = await getExportCheckoutUrl(pending.lsCheckoutId).catch(() => null);
    if (pendingUrl) {
      return NextResponse.json({ checkoutUrl: pendingUrl, pending: true });
    }
  }

  try {
    const { checkoutUrl, checkoutId } = await createExportCheckout({
      siteId: site.id,
      userId: session.user.id,
      userEmail: session.user.email ?? "",
      siteName: site.name,
    });

    // Placeholder row recording the in-flight checkout. The PAID record is still
    // created by the webhook, keyed on the real LS order ID; `lsOrderId` is
    // prefixed here so it can never collide with a numeric LS order id.
    try {
      await db.exportPurchase.create({
        data: {
          userId: session.user.id,
          siteId: site.id,
          lsOrderId: `pending:${checkoutId}`,
          lsCheckoutId: checkoutId,
          amount: 0,
          status: "PENDING",
        },
      });
    } catch (err) {
      // Losing the guard is better than losing the checkout the user is waiting on.
      console.error("LS pending purchase record failed:", err);
    }

    return NextResponse.json({ checkoutUrl });
  } catch (err) {
    console.error("LS checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
