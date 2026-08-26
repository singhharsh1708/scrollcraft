import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().optional(),
  DB_POOL_MAX: z.coerce.number().int().positive().optional(),

  // Auth — NextAuth v5 reads the AUTH_ prefix and still accepts the NEXTAUTH_ v4 aliases
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),

  // Storage
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Payments
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // Rate limiting (Upstash Redis — optional, falls back to in-memory)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Lemon Squeezy — one-time export purchases
  LEMONSQUEEZY_API_KEY: z.string().optional(),
  LEMONSQUEEZY_STORE_ID: z.string().optional(),
  LEMONSQUEEZY_VARIANT_ID: z.string().optional(),
  LEMONSQUEEZY_WEBHOOK_SECRET: z.string().optional(),
  LEMONSQUEEZY_EXPORT_PRICE_CENTS: z.coerce.number().int().nonnegative().optional(),
  LEMONSQUEEZY_EXPORT_CURRENCY: z.string().length(3).toUpperCase().optional(),

  // Observability
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

// An empty value means "not configured" — `.env` is usually copied from `.env.example`,
// which ships every key with an empty string.
const rawEnv: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined && value !== "") rawEnv[key] = value;
}

// Env vars are injected at runtime on Vercel, so nothing is guaranteed during the build.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

export type EnvIssue = { variable: string; message: string };

/** Variables that are set but failed validation. Their values are ignored. */
const warnings: EnvIssue[] = [];

function parseEnv(): z.infer<typeof envSchema> {
  const parsed = envSchema.safeParse(rawEnv);
  if (parsed.success) return parsed.data;

  // Drop the offending values and re-parse. Throwing here would run at import time,
  // taking down every route that transitively imports this module — including the
  // health endpoint that is supposed to report the misconfiguration.
  const cleaned = { ...rawEnv };
  for (const issue of parsed.error.issues) {
    const variable = typeof issue.path[0] === "string" ? issue.path[0] : "";
    if (!variable) continue;
    delete cleaned[variable];
    warnings.push({ variable, message: issue.message });
  }
  const retry = envSchema.safeParse(cleaned);
  return retry.success ? retry.data : envSchema.parse({});
}

export const env = parseEnv();

// NextAuth v5 prefers the AUTH_ prefix; the NEXTAUTH_ spellings remain supported aliases,
// so either one counts as configured.
export const authSecret = env.AUTH_SECRET ?? env.NEXTAUTH_SECRET;
export const authUrl = env.AUTH_URL ?? env.NEXTAUTH_URL;

const CANONICAL_FALLBACK_URL = "https://scrollcraft.app";

/**
 * Public origin for robots.txt and the sitemap. `.env.example` ships AUTH_URL pointed at
 * localhost, and that value carried into a production deploy would publish localhost URLs
 * to search engines — so it is ignored there rather than trusted.
 */
export const siteUrl = (() => {
  const candidate = authUrl?.trim();
  if (!candidate) return CANONICAL_FALLBACK_URL;
  if (env.NODE_ENV === "production" && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(candidate)) {
    return CANONICAL_FALLBACK_URL;
  }
  return candidate.replace(/\/+$/, "");
})();

/** Variables the app cannot serve requests without. */
const errors: EnvIssue[] = [];
if (!rawEnv.DATABASE_URL) {
  errors.push({ variable: "DATABASE_URL", message: "is not set" });
}
if (!authSecret) {
  errors.push({
    variable: "AUTH_SECRET",
    message: "is not set — sessions cannot be signed (NEXTAUTH_SECRET is also accepted)",
  });
}

if (isBuildPhase) {
  if (errors.length > 0) {
    console.warn("⚠️  Some environment variables are missing — this is expected during build. Set them in Vercel project settings.");
  }
} else {
  const describe = (issue: EnvIssue) => `${issue.variable} ${issue.message}`;
  if (errors.length > 0) {
    console.error("❌ Missing required environment variables:\n", errors.map(describe));
  }
  if (warnings.length > 0) {
    console.warn("⚠️  Ignoring invalid environment variables:\n", warnings.map(describe));
  }
}

/**
 * Configuration health, for reporting by /api/health. Contains variable names and
 * validation messages only — never any value.
 */
export function getEnvIssues(): { errors: EnvIssue[]; warnings: EnvIssue[] } {
  return { errors: [...errors], warnings: [...warnings] };
}

