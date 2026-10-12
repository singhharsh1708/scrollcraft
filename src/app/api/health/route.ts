import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { env, getEnvIssues } from "@/lib/env";
import { redisCredentials } from "@/lib/redisCredentials";

/**
 * Liveness and configuration check.
 *
 * Two things can be wrong: the environment, and the one store this app does keep. That
 * store has now failed silently twice, once taking rate limiting down to its per-instance
 * fallback for months and once refusing every generation while answering a ping from a
 * laptop perfectly well. A store that is only reachable from somewhere else is the
 * failure this reports, so it is measured from inside a running function.
 */

const STORE_TIMEOUT_MS = 2_500;

async function storeCheck(): Promise<{ state: string; ms?: number }> {
  const credentials = redisCredentials();
  if (!credentials) return { state: "absent" };
  const started = Date.now();
  try {
    const redis = new Redis({ ...credentials, signal: AbortSignal.timeout(STORE_TIMEOUT_MS) });
    await redis.ping();
    return { state: "ok", ms: Date.now() - started };
  } catch {
    return { state: "unreachable", ms: Date.now() - started };
  }
}

export async function GET() {
  const { errors, warnings } = getEnvIssues();
  const store = await storeCheck();
  const healthy = errors.length === 0 && store.state !== "unreachable";

  const body: Record<string, unknown> = {
    status: healthy ? "ok" : "degraded",
    checks: {
      config: errors.length > 0 ? "invalid" : warnings.length > 0 ? "incomplete" : "ok",
      store: store.state,
      storeMs: store.ms,
    },
    timestamp: new Date().toISOString(),
  };

  // Which variables are misconfigured is itself a configuration detail, so it stays
  // out of the public response in production. It is logged on startup either way.
  if (!healthy && env.NODE_ENV !== "production") {
    body.issues = [...errors, ...warnings].map((issue) => `${issue.variable} ${issue.message}`);
  }

  return NextResponse.json(body, {
    status: healthy ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
