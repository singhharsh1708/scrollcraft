import "server-only";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Consume one use of a promo code, at payment capture rather than checkout so an
 * abandoned order never burns a use.
 *
 * The limit is re-checked inside the UPDATE so concurrent captures cannot push
 * `uses` past `maxUses` — a read-then-write would let both callers see room and
 * both increment.
 *
 * Pass the transaction client when fulfilment runs inside one, so the consumption
 * rolls back with the rest of it rather than standing alone.
 */
type RawClient = Pick<typeof db, "$executeRaw">;

export async function consumePromoCode(
  code: string | null,
  client: RawClient = db
): Promise<boolean> {
  if (!code) return false;
  const consumed = await client.$executeRaw`
    UPDATE "PromoCode"
    SET uses = uses + 1
    WHERE code = ${code} AND ("maxUses" IS NULL OR uses < "maxUses")
  `;
  if (consumed === 0) {
    // The order was already priced with the discount at checkout, so the customer has
    // been charged the reduced amount while the counter stays put — the cap held on
    // `uses` but not on money. Reachable when a hold expires, or when a FAILED payment
    // is captured later. Logged at error level so it surfaces rather than accumulating.
    logger.error("Promo code discount honored past its cap", { code });
    return false;
  }
  return true;
}
