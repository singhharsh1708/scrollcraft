import { NextResponse, type NextRequest } from "next/server";
import { accountIdentity, authConfigured } from "@/auth";
import { paymentProcessor } from "@/lib/paymentProcessor";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";
import {
  FREE_SITES,
  KEY_COOKIE,
  PACK_SITES,
  attachToAccount,
  balanceOf,
  cookieOptions,
  grantPack,
  hashKey,
  keyHashFrom,
} from "@/lib/credits";

/**
 * What this visitor is allowed to write.
 *
 * GET says how many sites are left. POST takes a licence key, checks it with Lemon
 * Squeezy, and remembers it in a cookie the page cannot read. DELETE forgets it, which
 * is what somebody on a shared computer needs.
 *
 * The key never reaches storage: only its hash is kept, so a copy of the database is
 * not a bag of working licence keys. A signed-in visitor's credits are their account's,
 * so a key redeemed while signed in goes there instead of onto the hash, and one
 * redeemed earlier is carried over on the next redemption.
 */

const VALIDATE_URL = "https://api.lemonsqueezy.com/v1/licenses/validate";
const VALIDATE_TIMEOUT_MS = 6_000;
const MAX_KEY_LENGTH = 200;

export async function GET(req: NextRequest) {
  const hash = keyHashFrom(req);
  const identity = (await accountIdentity()) ?? hash;
  const balance = identity ? await balanceOf(identity) : null;
  return NextResponse.json({
    free: FREE_SITES,
    pack: PACK_SITES,
    // A browser holding a key has one whether or not the store can be reached to say so.
    // An account only counts once it has a pack, or somebody who signed in and has never
    // bought anything would be shown a balance instead of the box for pasting a key.
    hasKey: Boolean(hash) || (balance?.total ?? 0) > 0,
    // Where the credits live, so the page can say "on your account" or "on this browser"
    // rather than guessing and being wrong for half the people reading it.
    signedIn: Boolean(await accountIdentity()),
    // Whether this deployment can offer sign-in at all. A fork without a GitHub app
    // should not be shown a button that answers 404.
    canSignIn: authConfigured(),
    // Whether a pack can be bought here at all. Buying needs an account to land on, so
    // a shop with no sign-in is not a shop.
    canBuy: paymentProcessor() !== null && authConfigured(),
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
  const account = await accountIdentity();
  const target = account ?? hash;

  if (account) {
    // Redeemed before they signed in, so the pack sits where only that one browser can
    // find it. Carrying it over is what makes the credits follow them to the next one,
    // and it is also the answer for a key already carried: no round trip either way.
    const carried = await attachToAccount(hash, account);
    if (carried === "attached" || carried === "already") {
      const moved = await balanceOf(account);
      return remember(hash, moved?.remaining ?? 0, moved?.total ?? 0);
    }
  } else {
    // A key this deployment already knows needs no round trip, which also means a Lemon
    // Squeezy outage cannot lock a buyer out of credits they have already paid for.
    const known = await balanceOf(hash);
    if (known && known.total > 0) return remember(hash, known.remaining, known.total);
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
    const result = await grantPack(target, String(orderId), data.meta?.customer_email);
    if (result === "unavailable") {
      return NextResponse.json({ error: "Could not record that key just now." }, { status: 503 });
    }
  }

  const balance = await balanceOf(target);
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
