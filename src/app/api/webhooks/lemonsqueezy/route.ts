import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyLSWebhookSignature } from "@/lib/lemonsqueezy";
import { logger } from "@/lib/logger";

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

  const eventName = event.meta && typeof event.meta === "object"
    ? (event.meta as Record<string, unknown>).event_name
    : null;

  if (eventName !== "order_created") {
    return NextResponse.json({ received: true });
  }

  try {
    const data = event.data as Record<string, unknown>;
    const attrs = (data?.attributes ?? {}) as Record<string, unknown>;
    const orderId = data?.id ? String(data.id) : "";
    const status = String(attrs.status ?? "");
    // LS `total` is an integer in the smallest currency unit (e.g. cents)
    const amount = Number.isFinite(Number(attrs.total)) ? Number(attrs.total) : 0;
    const currency = typeof attrs.currency === "string" ? attrs.currency : "USD";

    // custom_data may arrive nested under `first_order_item` meta or top-level attrs
    const meta = (event.meta ?? {}) as Record<string, unknown>;
    const customData =
      (meta.custom_data as Record<string, string> | undefined) ??
      (attrs.custom_data as Record<string, string> | undefined) ??
      null;
    const siteId = customData?.site_id;
    const userId = customData?.user_id;

    if (!orderId) {
      logger.warn("LS webhook: missing order id");
      return NextResponse.json({ received: true });
    }
    if (!siteId || !userId) {
      logger.warn("LS webhook: missing custom_data", { orderId });
      return NextResponse.json({ received: true });
    }
    if (status !== "paid") {
      logger.info("LS webhook: order not paid", { orderId, status });
      return NextResponse.json({ received: true });
    }

    // Upsert keyed on the real LS order id — idempotent against webhook retries.
    await db.exportPurchase.upsert({
      where: { lsOrderId: orderId },
      create: { userId, siteId, lsOrderId: orderId, amount, currency, status: "PAID" },
      update: { status: "PAID", amount, currency },
    });

    logger.info("LS export purchase fulfilled", { orderId, siteId, userId });
    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error("LS webhook processing error", { error: String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
