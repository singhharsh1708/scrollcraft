import { z } from "zod";

const envSchema = z.object({
  // AI video providers — at least one should be set for real generation
  LUMAAI_API_KEY: z.string().optional(),
  RUNWAYML_API_KEY: z.string().optional(),

  // AI chat editing
  ANTHROPIC_API_KEY: z.string().optional(),

  // Database
  DATABASE_URL: z.string().url().optional(),

  // Auth — required at runtime, optional only during build phase
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

  // Observability
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

// Skip hard validation during Next.js build phase — env vars are injected at runtime on Vercel
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  if (isBuildPhase) {
    console.warn("⚠️  Some environment variables are missing — this is expected during build. Set them in Vercel project settings.");
  } else {
    console.error("❌ Invalid environment variables:\n", _env.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables. Check server logs for details.");
  }
}

export const env = (_env.success ? _env.data : envSchema.parse({
  ...process.env,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "build-placeholder",
  NODE_ENV: process.env.NODE_ENV ?? "production",
}));

// At runtime (not build time), NEXTAUTH_SECRET is required for session security
if (!isBuildPhase && !env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET is required in production. Set it in your environment variables.");
}

export function isDemoMode(): boolean {
  return !env.LUMAAI_API_KEY && !env.RUNWAYML_API_KEY;
}
