import { NextResponse, type NextRequest } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";
import {
  FREE_SITES,
  KEY_COOKIE,
  PACK_SITES,
  balanceOf,
  cookieOptions,
  grantPack,
  hashKey,
  keyHashFrom,
} from "@/lib/credits";

/**
 * What this browser is allowed to write.
 *
 * GET says how many sites are left. POST takes a licence key, checks it with Lemon
 * Squeezy, and remembers it in a cookie the page cannot read. DELETE forgets it, which
 * is what somebody on a shared computer needs.
 *
 * The key never reaches storage: only its hash is kept, so a copy of the database is
 * not a bag of working licence keys.
 */

const VALIDATE_URL = "https://api.lemonsqueezy.com/v1/licenses/validate";
const VALIDATE_TIMEOUT_MS = 6_000;
const MAX_KEY_LENGTH = 200;

export async function GET(req: NextRequest) {
  const hash = keyHashFrom(req);
  const balance = hash ? await balanceOf(hash) : null;
  return NextResponse.json({
    free: FREE_SITES,
    pack: PACK_SITES,
    hasKey: Boolean(hash),
    remaining: balance?.remaining ?? 0,
    total: balance?.total ?? 0,
  });
}

type ValidateResponse = {
  valid?: boolean;
  error?: string | null;
  license_key?: { status?: string };
  meta?: { order_id?: number | string; customer_email?: string };
};

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await rateLimit(ip, { bucket: "redeem-key", limit: 10, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many tries. Wait a minute." }, { status: 429 });
  }

  let key = "";
  try {
    const body = (await req.json()) as { key?: unknown };
    key = typeof body.key === "string" ? body.key.trim() : "";
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }
  if (!key || key.length > MAX_KEY_LENGTH) {
    return NextResponse.json({ error: "Paste the licence key from your receipt." }, { status: 400 });
  }

  const hash = hashKey(key);

  // A key this deployment already knows needs no round trip, which also means a Lemon
  // Squeezy outage cannot lock a buyer out of credits they have already paid for.
  const known = await balanceOf(hash);
  if (known && known.total > 0) {
    return remember(hash, known.remaining, known.total);
  }

  let data: ValidateResponse;
  try {
    const response = await fetch(VALIDATE_URL, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ license_key: key }),
      signal: AbortSignal.timeout(VALIDATE_TIMEOUT_MS),
    });
    data = (await response.json()) as ValidateResponse;
  } catch (err) {
    logger.error("could not reach Lemon Squeezy to check a key", { err });
    return NextResponse.json({ error: "Could not check that key just now. Try again in a minute." }, { status: 502 });
  }

  if (!data.valid) {
    return NextResponse.json({ error: data.error || "That key was not recognised." }, { status: 404 });
  }
  const status = data.license_key?.status;
  if (status === "disabled" || status === "expired") {
    return NextResponse.json({ error: `That key is ${status}.` }, { status: 403 });
  }

  // The key is real and this deployment has not recorded its pack, which happens when a
  // webhook was lost. The order id makes the grant idempotent, so recording it here and
  // a late webhook arriving later still add one pack between them.
  const orderId = data.meta?.order_id;
  if (orderId !== undefined) {
    const result = await grantPack(hash, String(orderId), data.meta?.customer_email);
    if (result === "unavailable") {
      return NextResponse.json({ error: "Could not record that key just now." }, { status: 503 });
    }
  }

  const balance = await balanceOf(hash);
  return remember(hash, balance?.remaining ?? 0, balance?.total ?? 0);
}

function remember(hash: string, remaining: number, total: number) {
  const response = NextResponse.json({ ok: true, remaining, total });
  response.cookies.set(KEY_COOKIE, hash, cookieOptions());
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(KEY_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  return response;
}
