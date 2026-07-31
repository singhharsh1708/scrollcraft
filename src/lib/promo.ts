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
 */
export async function consumePromoCode(code: string | null): Promise<boolean> {
  if (!code) return false;
  const consumed = await db.$executeRaw`
    UPDATE "PromoCode"
    SET uses = uses + 1
    WHERE code = ${code} AND ("maxUses" IS NULL OR uses < "maxUses")
  `;
  if (consumed === 0) {
    logger.warn("Promo code exhausted before capture", { code });
    return false;
  }
  return true;
}
