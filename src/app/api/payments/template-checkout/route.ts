import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createTemplateCheckout, getExportCheckoutUrl } from "@/lib/lemonsqueezy";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { templateBySlug } from "@/lib/templates";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const schema = z.object({ slug: z.string().min(1).max(128) });

// How long an unresolved checkout is treated as still in flight, matching the export
// checkout. Past this the attempt is abandoned and a fresh one may be opened.
const PENDING_CHECKOUT_TTL_MS = 30 * 60_000;

export async function POST(req: NextRequest) {
  const rl = await rateLimit(getClientIp(req), {
    bucket: "template-checkout",
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!env.LEMONSQUEEZY_API_KEY || !env.LEMONSQUEEZY_STORE_ID || !env.LEMONSQUEEZY_TEMPLATE_VARIANT_ID) {
    return NextResponse.json({ error: "Template purchases not configured" }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { slug } = parsed.data;
  const template = templateBySlug(slug);
  if (!template?.premium) {
    // Either no such template, or one that is free and needs no purchase.
    return NextResponse.json({ error: "That template is not for sale" }, { status: 404 });
  }

  // Already owned — say so rather than charging again.
  const owned = await db.templatePurchase.findFirst({
    where: { userId: session.user.id, templateSlug: slug, status: "PAID" },
    select: { id: true },
  });
  if (owned) {
    return NextResponse.json({ alreadyPurchased: true });
  }

  // A checkout already in flight must not become a second one.
  const pending = await db.templatePurchase.findFirst({
    where: {
      userId: session.user.id,
      templateSlug: slug,
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
    const { checkoutUrl, checkoutId } = await createTemplateCheckout({
      templateSlug: slug,
      templateName: template.name,
      userId: session.user.id,
      userEmail: session.user.email ?? "",
    });

    // Placeholder recording the in-flight checkout. The PAID row is still written by the
    // webhook against the real order id; the prefix keeps this from colliding with one.
    try {
      await db.templatePurchase.create({
        data: {
          userId: session.user.id,
          templateSlug: slug,
          lsOrderId: `pending:${checkoutId}`,
          lsCheckoutId: checkoutId,
          amount: 0,
          status: "PENDING",
        },
      });
    } catch (err) {
      // Losing the guard is better than losing the checkout the user is waiting on.
      logger.error("template pending purchase record failed", { err });
    }

    return NextResponse.json({ checkoutUrl });
  } catch (err) {
    logger.error("template checkout failed", { err });
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
