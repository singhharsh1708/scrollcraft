import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    mode: isDemoMode() ? "demo" : "production",
  });
}
