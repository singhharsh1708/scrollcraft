import "server-only";
import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { redisCredentials } from "@/lib/redisCredentials";
import { logger } from "@/lib/logger";

/**
 * Who may write a site, and how many they have left.
 *
 * The first site is free. After that a pack of five costs twenty dollars, bought through
 * Lemon Squeezy, which hands the buyer a licence key. The key is the only identity here:
 * no accounts, no email, no password. A browser that has pasted a key carries a cookie
 * holding the key's hash, and that is the whole of what the server knows about anybody.
 *
 * Two rules hold the rest of this file up. Credits are spent by one atomic script, so two
 * tabs cannot spend the same one; and a generation that fails gives the credit back,
 * because nobody should pay four dollars for a 502.
 */

export const FREE_SITES = 1;
export const PACK_SITES = 5;
export const PACK_PRICE_USD = 20;

/** The cookie holding the hash of the licence key this browser pasted. */
export const KEY_COOKIE = "sc_key";
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

let redis: Redis | null = null;

function store(): Redis | null {
  const credentials = redisCredentials();
  if (!credentials) return null;
  if (!redis) redis = new Redis(credentials);
  return redis;
}

export function hashKey(licenseKey: string): string {
  return createHash("sha256").update(licenseKey.trim()).digest("hex");
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

/** The key hash this browser carries, read from the request's own cookie header. */
export function keyHashFrom(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === KEY_COOKIE) {
      const value = decodeURIComponent(rest.join("="));
      return /^[a-f0-9]{64}$/.test(value) ? value : null;
    }
  }
  return null;
}

const entitlementKey = (hash: string) => `sc_ent:${hash}`;
const orderKey = (orderId: string) => `sc_ord:${orderId}`;
const orderOwnerKey = (orderId: string) => `sc_ordkey:${orderId}`;
const refundKey = (orderId: string) => `sc_ref:${orderId}`;
const freeKey = (ip: string) => `sc_free:${ip}:${new Date().toISOString().slice(0, 7)}`;

/**
 * Spend one credit, or say there was none.
 *
 * One round trip, because a read followed by a write lets two tabs through the same
 * last credit. -1 means the holder has none left.
 */
const SPEND = `
local total = tonumber(redis.call('HGET', KEYS[1], 'total') or '0')
local used = tonumber(redis.call('HGET', KEYS[1], 'used') or '0')
if total - used < 1 then return -1 end
return redis.call('HINCRBY', KEYS[1], 'used', 1)
`;

export type Balance = { total: number; used: number; remaining: number };

export async function balanceOf(hash: string): Promise<Balance | null> {
  const r = store();
  if (!r) return null;
  let row: { total?: string; used?: string } | null = null;
  try {
    row = await r.hgetall<{ total?: string; used?: string }>(entitlementKey(hash));
  } catch (err) {
    // A store that cannot be reached is not an answer about somebody's balance, so this
    // says "unknown" rather than "none" and leaves the caller to decide.
    logger.error("credits: could not read a balance", { err });
    return null;
  }
  if (!row) return null;
  const total = Number(row.total ?? 0);
  const used = Number(row.used ?? 0);
  return { total, used, remaining: Math.max(0, total - used) };
}

export type Allowance =
  | { ok: true; kind: "free" | "paid"; release: () => Promise<void> }
  | { ok: false; reason: "free-used" | "no-credits" | "unavailable" };

/**
 * Take one site's worth of allowance before the model is called.
 *
 * Paid credits first, so a buyer's free site stays unspent if they bought before using
 * it. The free allowance is counted per address per calendar month: a browser can clear
 * its storage and a phone can turn its data off and on, so the only thing worth counting
 * is the one the visitor does not hold.
 */
export async function takeAllowance(ip: string, hash: string | null): Promise<Allowance> {
  const r = store();
  if (!r) {
    // No store means nothing can be counted. In production that is a reason to stop
    // rather than to hand out an unbounded number of paid-for generations.
    if (process.env.NODE_ENV === "production") {
      logger.error("credits: no Redis, refusing to generate");
      return { ok: false, reason: "unavailable" };
    }
    return { ok: true, kind: "free", release: async () => {} };
  }

  try {
    return await spend(r, ip, hash);
  } catch (err) {
    // Nothing could be counted, so nothing may be spent: the alternative is an
    // unbounded number of model calls billed to us during an outage.
    logger.error("credits: the store refused, refusing to generate", { err });
    return { ok: false, reason: "unavailable" };
  }
}

async function spend(r: Redis, ip: string, hash: string | null): Promise<Allowance> {
  if (hash) {
    const key = entitlementKey(hash);
    const spent = (await r.eval(SPEND, [key], [])) as number;
    if (spent >= 0) {
      return {
        ok: true,
        kind: "paid",
        release: async () => {
          try {
            const used = await r.hincrby(key, "used", -1);
            if (used < 0) await r.hset(key, { used: 0 });
          } catch (err) {
            logger.error("credits: could not give a credit back", { err });
          }
        },
      };
    }
  }

  const key = freeKey(ip);
  const taken = await r.incr(key);
  if (taken === 1) await r.expire(key, 70 * 24 * 60 * 60);
  if (taken > FREE_SITES) {
    await r.decr(key);
    return { ok: false, reason: hash ? "no-credits" : "free-used" };
  }
  return {
    ok: true,
    kind: "free",
    release: async () => {
      try {
        const left = await r.decr(key);
        if (left < 0) await r.set(key, 0);
      } catch (err) {
        logger.error("credits: could not give the free site back", { err });
      }
    },
  };
}

/**
 * Add a pack to a key, once per order.
 *
 * Lemon Squeezy resends a webhook it did not hear a 200 for, and the same order must not
 * be worth ten sites because the network was slow.
 */
export async function grantPack(hash: string, orderId: string, email?: string): Promise<"granted" | "already" | "unavailable"> {
  const r = store();
  if (!r) return "unavailable";
  try {
    const first = await r.set(orderKey(orderId), hash, { nx: true, ex: 400 * 24 * 60 * 60 });
    if (first !== "OK") return "already";
    await r.hincrby(entitlementKey(hash), "total", PACK_SITES);
    await r.hset(entitlementKey(hash), { lastOrder: orderId, ...(email ? { email } : {}) });
    await r.set(orderOwnerKey(orderId), hash, { ex: 400 * 24 * 60 * 60 });
    return "granted";
  } catch (err) {
    // The caller answers 500 so Lemon Squeezy delivers it again. The money is taken and
    // the credits are not given yet, so a retry is exactly what should happen.
    logger.error("credits: could not record a purchase", { err, orderId });
    return "unavailable";
  }
}

/**
 * Take a refunded pack back, down to what has already been spent.
 *
 * Sites already written stay written: the clamp removes the unused part of the pack and
 * nothing else, so a refund cannot leave someone owing credits.
 */
export async function revokePack(orderId: string): Promise<"revoked" | "already" | "unknown" | "unavailable"> {
  const r = store();
  if (!r) return "unavailable";
  try {
    // Marked before anything is taken away, for the same reason the grant is: a refund
    // delivered twice must not cost the buyer two packs, and the route asks for exactly
    // that redelivery whenever the store was unreachable.
    const first = await r.set(refundKey(orderId), "1", { nx: true, ex: 400 * 24 * 60 * 60 });
    if (first !== "OK") return "already";
    const hash = await r.get<string>(orderOwnerKey(orderId));
    if (!hash) return "unknown";
    const key = entitlementKey(hash);
    const row = await r.hgetall<{ total?: string; used?: string }>(key);
    const total = Number(row?.total ?? 0);
    const used = Number(row?.used ?? 0);
    await r.hset(key, { total: Math.max(used, total - PACK_SITES) });
    return "revoked";
  } catch (err) {
    logger.error("credits: could not take a refunded pack back", { err, orderId });
    return "unavailable";
  }
}
