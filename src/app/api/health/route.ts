import { NextResponse } from "next/server";
import { env, getEnvIssues, isDemoMode } from "@/lib/env";

export async function GET() {
  const { errors, warnings } = getEnvIssues();

  let database: "up" | "down" = "down";
  try {
    // Imported lazily so that a failure while constructing the Prisma client is
    // reported as a degraded check rather than crashing the handler.
    const { db } = await import("@/lib/db");
    await db.$queryRaw`SELECT 1`;
    database = "up";
  } catch {
    database = "down";
  }

  const healthy = database === "up" && errors.length === 0;

  const body: Record<string, unknown> = {
    status: healthy ? "ok" : "degraded",
    mode: isDemoMode() ? "demo" : "production",
    checks: {
      database,
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
