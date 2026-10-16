import "server-only";
import { dodoConfigured } from "@/lib/dodo";
import { stripeConfigured } from "@/lib/stripe";

/**
 * Who takes the money, so the legal pages name the right seller. Dodo is the merchant of
 * record; with Stripe the seller is us. Null means nothing is on sale.
 */
export type PaymentProcessor = "dodo" | "stripe" | null;

export function paymentProcessor(): PaymentProcessor {
  if (dodoConfigured()) return "dodo";
  if (stripeConfigured()) return "stripe";
  return null;
}
