import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/env";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    return NextResponse.json({ status: "error", db: "down" }, { status: 503 });
  }

  return NextResponse.json({
    status: "ok",
    mode: isDemoMode() ? "demo" : "production",
  });
}
