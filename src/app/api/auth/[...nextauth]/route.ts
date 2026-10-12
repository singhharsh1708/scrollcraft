import { NextResponse, type NextRequest } from "next/server";
import { authConfigured, authInstance } from "@/auth";

/**
 * Auth.js, mounted only where it is configured.
 *
 * Without the GitHub variables this answers 404 rather than 500, which is what tells the
 * nav there is nothing to offer, and keeps a fresh clone's routes all working.
 */

const notConfigured = () =>
  NextResponse.json({ error: "Sign-in is not configured on this deployment." }, { status: 404 });

export async function GET(req: NextRequest) {
  return authConfigured() ? (await authInstance()).handlers.GET(req) : notConfigured();
}

export async function POST(req: NextRequest) {
  return authConfigured() ? (await authInstance()).handlers.POST(req) : notConfigured();
}
