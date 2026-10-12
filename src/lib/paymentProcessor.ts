import "server-only";

/**
 * Who takes the money on this deployment.
 *
 * The legal pages have to say, and the two answers are not interchangeable. Lemon
 * Squeezy is the seller of record: the buyer's contract is with them and the sales tax
 * is theirs. Stripe is a payment processor: the seller is us. A page that names the
 * wrong one misstates who the buyer is dealing with, so the pages ask rather than assume.
 */
export type PaymentProcessor = "stripe" | "lemonsqueezy";

export function paymentProcessor(): PaymentProcessor {
  if (process.env.STRIPE_SECRET_KEY) return "stripe";
  if (process.env.LEMONSQUEEZY_WEBHOOK_SECRET || process.env.NEXT_PUBLIC_LEMON_CHECKOUT_URL) return "lemonsqueezy";
  // Neither is configured, so nothing can be bought and the wording is moot. Stripe is
  // the path the app is built around, so that is what an unconfigured copy describes.
  return "stripe";
}
