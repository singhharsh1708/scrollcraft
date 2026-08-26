import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyLSWebhookSignature } from "@/lib/lemonsqueezy";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

// Events that take a previously granted export entitlement away again.
const REVOCATION_EVENTS = new Set([
  "order_refunded",
  "order_chargeback",
  "chargeback",
]);

function asId(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature") ?? "";

  if (!verifyLSWebhookSignature(rawBody, signature)) {
    logger.warn("LS webhook: invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const meta = (event.meta ?? {}) as Record<string, unknown>;
  const eventName = typeof meta.event_name === "string" ? meta.event_name : "";

  if (eventName !== "order_created" && !REVOCATION_EVENTS.has(eventName)) {
    return NextResponse.json({ received: true });
  }

  try {
    const data = event.data as Record<string, unknown>;
    const attrs = (data?.attributes ?? {}) as Record<string, unknown>;
    const orderId = asId(data?.id);

    if (!orderId) {
      logger.warn("LS webhook: missing order id", { eventName });
      return NextResponse.json({ received: true });
    }

    // Refunds and chargebacks revoke access. Keyed on the LS order id, so this
    // can only ever touch rows this webhook granted in the first place.
    if (REVOCATION_EVENTS.has(eventName)) {
      const { count } = await db.exportPurchase.updateMany({
        where: { lsOrderId: orderId, status: { not: "REFUNDED" } },
        data: { status: "REFUNDED" },
      });
      // Record the revocation even when it matched no row. Delivery order is not
      // guaranteed, so the order_created this revokes may still be on its way, and the
      // purchase row cannot be created here — a refund payload has no user or site id.
      await db.revokedLsOrder.upsert({
        where: { lsOrderId: orderId },
        create: { lsOrderId: orderId, eventName },
        update: {},
      });
      logger.info("LS export purchase revoked", { orderId, eventName, count });
      return NextResponse.json({ received: true });
    }

    const status = String(attrs.status ?? "");
    // LS `total` is an integer in the smallest currency unit (e.g. cents)
    // Pin against the pre-tax subtotal: `total` includes tax, so a taxed order would fail
    // an exact-price check even when correct. Fall back to total when subtotal is absent.
    const amount = Number(attrs.subtotal ?? attrs.total);
    const currency = typeof attrs.currency === "string" ? attrs.currency : "USD";
    const storeId = asId(attrs.store_id);
    const firstItem = (attrs.first_order_item ?? {}) as Record<string, unknown>;
    const variantId = asId(firstItem.variant_id ?? attrs.variant_id);

    // custom_data may arrive nested under `first_order_item` meta or top-level attrs.
    // Take only string values out of it: these feed Prisma `where` clauses, whose
    // generated types also accept a filter object, so an unvalidated `{"not":""}` would
    // widen the lookup instead of identifying one row.
    const rawCustom = (meta.custom_data as unknown) ?? (attrs.custom_data as unknown) ?? null;
    const customData =
      rawCustom && typeof rawCustom === "object" && !Array.isArray(rawCustom)
        ? (rawCustom as Record<string, unknown>)
        : {};
    const siteId = typeof customData.site_id === "string" ? customData.site_id : "";
    const userId = typeof customData.user_id === "string" ? customData.user_id : "";

    if (!siteId || !userId) {
      logger.warn("LS webhook: missing custom_data", { orderId });
      return NextResponse.json({ received: true });
    }
    if (status !== "paid" || attrs.refunded === true) {
      logger.info("LS webhook: order not paid", { orderId, status });
      return NextResponse.json({ received: true });
    }

    // Without the store/variant config there is nothing to validate the order
    // against — fail closed and let LS retry once the deployment is configured.
    if (!env.LEMONSQUEEZY_STORE_ID || !env.LEMONSQUEEZY_VARIANT_ID) {
      logger.error("LS webhook: store/variant not configured, refusing to grant", { orderId });
      return NextResponse.json({ error: "Not configured" }, { status: 503 });
    }

    // The order must come from our store and be for the export variant —
    // otherwise any cheap product in the same store would unlock exports.
    if (storeId !== env.LEMONSQUEEZY_STORE_ID) {
      logger.warn("LS webhook: store_id mismatch", { orderId, storeId });
      return NextResponse.json({ received: true });
    }
    if (variantId !== env.LEMONSQUEEZY_VARIANT_ID) {
      logger.warn("LS webhook: variant mismatch", { orderId, variantId });
      return NextResponse.json({ received: true });
    }

    // Amount sanity check. An exact expected price can be pinned via
    // LEMONSQUEEZY_EXPORT_PRICE_CENTS; otherwise require a real, positive charge.
    const expectedAmount = env.LEMONSQUEEZY_EXPORT_PRICE_CENTS;
    const hasExpectedAmount = expectedAmount !== undefined && expectedAmount > 0;
    if (!Number.isInteger(amount) || amount <= 0) {
      logger.warn("LS webhook: non-positive order total", { orderId, amount });
      return NextResponse.json({ received: true });
    }
    if (hasExpectedAmount && amount !== expectedAmount) {
      logger.warn("LS webhook: order total does not match export price", {
        orderId,
        amount,
        expectedAmount,
      });
      return NextResponse.json({ received: true });
    }
    // A pinned price is a bare number, so without this the same total in a weaker
    // currency would satisfy it once the store accepts more than one currency.
    const expectedCurrency = env.LEMONSQUEEZY_EXPORT_CURRENCY;
    if (hasExpectedAmount && expectedCurrency && currency.toUpperCase() !== expectedCurrency) {
      logger.warn("LS webhook: order currency does not match export currency", {
        orderId,
        currency,
        expectedCurrency,
      });
      return NextResponse.json({ received: true });
    }

    // custom_data is attacker-supplied at checkout time — never grant against a
    // site the claimed user does not own.
    const site = await db.site.findFirst({
      where: { id: siteId, userId },
      select: { id: true },
    });
    if (!site) {
      logger.warn("LS webhook: site does not belong to claimed user", { orderId, siteId, userId });
      return NextResponse.json({ received: true });
    }

    // Keyed on the real LS order id — idempotent against webhook retries. The update
    // is guarded on the current status: a redelivered order_created still carries
    // `refunded: false`, so an unconditional write would resurrect access that a
    // later order_refunded already revoked.
    const { count: granted } = await db.exportPurchase.updateMany({
      where: { lsOrderId: orderId, status: { not: "REFUNDED" } },
      data: { status: "PAID", amount, currency },
    });
    if (granted === 0) {
      const existing = await db.exportPurchase.findUnique({
        where: { lsOrderId: orderId },
        select: { status: true },
      });
      if (existing) {
        logger.warn("LS webhook: order_created for a revoked purchase ignored", {
          orderId,
          status: existing.status,
        });
        return NextResponse.json({ received: true });
      }
      // No purchase row, but the refund may have arrived first and left a tombstone.
      const revoked = await db.revokedLsOrder.findUnique({ where: { lsOrderId: orderId } });
      if (revoked) {
        logger.warn("LS webhook: order_created for an already-revoked order ignored", {
          orderId,
          eventName: revoked.eventName,
        });
        return NextResponse.json({ received: true });
      }
      await db.exportPurchase.create({
        data: { userId, siteId, lsOrderId: orderId, amount, currency, status: "PAID" },
      });
    }

    // Clear the in-flight checkout placeholders this purchase resolved.
    await db.exportPurchase.deleteMany({
      where: { userId, siteId, status: "PENDING", lsOrderId: { not: orderId } },
    });

    logger.info("LS export purchase fulfilled", { orderId, siteId, userId });
    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error("LS webhook processing error", { error: String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
