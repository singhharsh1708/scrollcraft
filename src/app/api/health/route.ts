import { NextResponse } from "next/server";
import { env, getEnvIssues } from "@/lib/env";

/**
 * Liveness and configuration check.
 *
 * There is no database to probe any more: ScrollCraft keeps no server-side state, so
 * the only thing that can be misconfigured is the environment itself.
 */
export async function GET() {
  const { errors, warnings } = getEnvIssues();
  const healthy = errors.length === 0;

  const body: Record<string, unknown> = {
    status: healthy ? "ok" : "degraded",
    checks: {
      config: errors.length > 0 ? "invalid" : warnings.length > 0 ? "incomplete" : "ok",
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
