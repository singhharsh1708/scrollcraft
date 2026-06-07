import { z } from "zod";

const envSchema = z.object({
  // AI video providers — at least one should be set for real generation
  LUMAAI_API_KEY: z.string().optional(),
  RUNWAYML_API_KEY: z.string().optional(),

  // AI chat editing
  ANTHROPIC_API_KEY: z.string().optional(),

  // Database
  DATABASE_URL: z.string().url().optional(),

  // Auth
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required"),
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

  // Observability
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:\n", _env.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables. Check server logs for details.");
}

export const env = _env.data;

export function isDemoMode(): boolean {
  return !env.LUMAAI_API_KEY && !env.RUNWAYML_API_KEY;
}
