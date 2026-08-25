/**
 * Single source of truth for plan pricing and the saved-website allowance.
 *
 * These lived in three places that had already drifted apart: the pricing page
 * rendered dollar amounts while the order endpoint charged rupees, and the
 * dashboard's credit denominator for Basic Plus did not match the number the
 * pricing page advertised. Anything that shows a price or a credit allowance
 * reads it from here.
 */

export type PlanKey = "FREE" | "BASIC" | "BASIC_PLUS" | "PRO" | "PREMIUM";

export interface Plan {
  key: PlanKey;
  /** Display name, and the value the checkout API expects as `plan`. */
  name: string;
  label: string;
  /** Charged amounts in INR paise — what Razorpay actually bills. */
  monthlyPaise: number;
  /** Per-month rate when billed annually; the annual charge is 12x this. */
  annualPaise: number;
  /** Credits granted for the billing period. */
  credits: number;
  /** Saved websites the plan allows. Enforced by POST /api/sites. */
  sites: number;
  color: string;
}

export const PLANS: Record<PlanKey, Plan> = {
  FREE: {
    key: "FREE", name: "Free Trial", label: "Free Trial",
    monthlyPaise: 0, annualPaise: 0, credits: 100, sites: 1,
    color: "text-muted-foreground",
  },
  BASIC: {
    key: "BASIC", name: "Basic", label: "Basic",
    monthlyPaise: 199900, annualPaise: 159900, credits: 1500, sites: 2,
    color: "text-blue-400",
  },
  BASIC_PLUS: {
    key: "BASIC_PLUS", name: "Basic Plus", label: "Basic Plus",
    monthlyPaise: 299900, annualPaise: 239900, credits: 2500, sites: 4,
    color: "text-cyan-400",
  },
  PRO: {
    key: "PRO", name: "Pro", label: "Pro",
    monthlyPaise: 499900, annualPaise: 399900, credits: 6000, sites: 7,
    color: "text-primary",
  },
  PREMIUM: {
    key: "PREMIUM", name: "Premium", label: "Premium",
    monthlyPaise: 1499900, annualPaise: 1199900, credits: 25000, sites: 30,
    color: "text-amber-400",
  },
};

/** Maps the display name used by the checkout API back to a plan. */
export function planByName(name: string): Plan | undefined {
  return Object.values(PLANS).find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
}

export function planByKey(key: string | null | undefined): Plan {
  return PLANS[(key ?? "FREE") as PlanKey] ?? PLANS.FREE;
}

/** Formats paise as the rupee amount a customer is actually charged. */
export function formatINR(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}
