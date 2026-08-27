import { z } from "zod";

/**
 * Environment.
 *
 * Every variable here is optional, and that is the point: ScrollCraft keeps no accounts
 * and no server-side state, so it runs with an empty environment. There is nothing to
 * configure before someone can fork it and start it.
 */
const envSchema = z.object({
  // Public origin, used for robots.txt, the sitemap and canonical URLs.
  SITE_URL: z.string().url().optional(),

  // Rate limiting (Upstash Redis — optional, falls back to in-memory)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

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

// scrollcraft.app belongs to an unrelated product. Falling back to it would publish
// canonical URLs and sitemap entries pointing at someone else.
const CANONICAL_FALLBACK_URL = "https://scrollcraft-gilt.vercel.app";

/**
 * Public origin for robots.txt, the sitemap and canonical URLs. A localhost value is
 * ignored in production rather than trusted, because publishing localhost URLs to
 * search engines is worse than falling back.
 */
export const siteUrl = (() => {
  const candidate = env.SITE_URL?.trim();
  if (!candidate) return CANONICAL_FALLBACK_URL;
  if (env.NODE_ENV === "production" && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(candidate)) {
    return CANONICAL_FALLBACK_URL;
  }
  return candidate.replace(/\/+$/, "");
})();

/**
 * Nothing is required. With no accounts and no database there is no variable whose
 * absence stops the app serving requests, so this stays empty by design.
 */
const errors: EnvIssue[] = [];

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

