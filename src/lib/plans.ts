/**
 * Single source of truth for the saved-website allowance and legacy plan pricing.
 *
 * ScrollCraft is free: every template, the editor, publishing and ZIP export cost
 * nothing, and revenue comes from individually purchased premium templates and from
 * enterprise work arranged by email.
 *
 * The four paid subscription tiers below are retired. They are kept because existing
 * subscribers still carry those values in the database and must keep the allowance they
 * paid for; `legacy: true` keeps them off the pricing page. Nothing new is sold on them.
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
  /** Saved websites the plan allows. Enforced by POST /api/sites. */
  sites: number;
  /** A retired tier: honoured for existing subscribers, never offered to new ones. */
  legacy?: boolean;
  color: string;
}

export const PLANS: Record<PlanKey, Plan> = {
  FREE: {
    key: "FREE", name: "Free", label: "Free",
    monthlyPaise: 0, annualPaise: 0, sites: 3,
    color: "text-muted-foreground",
  },
  BASIC: {
    key: "BASIC", name: "Basic", label: "Basic",
    monthlyPaise: 199900, annualPaise: 159900, sites: 2,
    legacy: true,
    color: "text-blue-400",
  },
  BASIC_PLUS: {
    key: "BASIC_PLUS", name: "Basic Plus", label: "Basic Plus",
    monthlyPaise: 299900, annualPaise: 239900, sites: 4,
    legacy: true,
    color: "text-cyan-400",
  },
  PRO: {
    key: "PRO", name: "Pro", label: "Pro",
    monthlyPaise: 499900, annualPaise: 399900, sites: 7,
    legacy: true,
    color: "text-primary",
  },
  PREMIUM: {
    key: "PREMIUM", name: "Premium", label: "Premium",
    monthlyPaise: 1499900, annualPaise: 1199900, sites: 30,
    legacy: true,
    color: "text-amber-400",
  },
};

/**
 * Saved websites a plan actually allows.
 *
 * Floored at the free allowance: the free tier grew when the subscription tiers were
 * retired, and a legacy subscriber must never end up with less than a new free account.
 */
export function siteAllowance(key: string | null | undefined): number {
  return Math.max(planByKey(key).sites, PLANS.FREE.sites);
}

/** The names the checkout API accepts, i.e. every plan that is actually charged for. */
export const PAID_PLAN_NAMES = Object.values(PLANS)
  .filter((p) => p.monthlyPaise > 0)
  .map((p) => p.name) as [string, ...string[]];

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

/** When a plan granted now on this billing cadence should lapse. */
export function planPeriodEnd(billing: string | null | undefined, from: Date = new Date()): Date {
  const end = new Date(from);
  if ((billing ?? "").toLowerCase() === "annual" || (billing ?? "").toLowerCase() === "yearly") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

/**
 * A paid plan lapses once `planExpiresAt` is in the past. A null expiry means no expiry:
 * grants made before expiry tracking existed stay active — access someone paid for is
 * never silently revoked — while every new grant sets an expiry going forward.
 */
export function isPlanActive(planExpiresAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!planExpiresAt) return true;
  return planExpiresAt.getTime() > now.getTime();
}
