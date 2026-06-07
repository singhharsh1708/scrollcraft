import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    mode: isDemoMode() ? "demo" : "production",
    providers: {
      lumaai: !!process.env.LUMAAI_API_KEY,
      runwayml: !!process.env.RUNWAYML_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
    },
  });
}
