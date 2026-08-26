import "server-only"; // hard build error if accidentally imported in a client component
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logger } from "@/lib/logger";

// Lazy-init Redis + per-config Ratelimit instances
let redis: Redis | null = null;
const limiters = new Map<string, Ratelimit>();

// Upstash is a network hop, so cap how long a request may wait on it, and stop
// calling it for a cooldown after a failure: an outage then costs one timeout
// overall instead of one on every request.
const UPSTASH_TIMEOUT_MS = 2_000;
const UPSTASH_COOLDOWN_MS = 30_000;
let upstashDownUntil = 0;

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

function getLimiter(bucket: string, limit: number, windowMs: number): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  const cacheKey = `${bucket}:${limit}:${windowMs}`;
  if (!limiters.has(cacheKey)) {
    // Convert ms to nearest whole seconds for Upstash duration string
    const windowSec = Math.ceil(windowMs / 1000);
    limiters.set(cacheKey, new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      // The Redis key is `<prefix>:<ip>:<window index>`, so the bucket and config both
      // have to be part of the prefix for the same reason they are part of the in-memory
      // key — otherwise a 5/hour bucket and a 10/hour bucket, or two unrelated endpoints
      // that happen to share a limit and window, collapse into one counter.
      prefix: `sc_rl:${bucket}:${limit}:${windowMs}`,
      timeout: UPSTASH_TIMEOUT_MS,
    }));
  }
  return limiters.get(cacheKey)!;
}

function markUpstashDown(reason: string) {
  upstashDownUntil = Date.now() + UPSTASH_COOLDOWN_MS;
  logger.error("Rate limit backend unavailable, using in-memory fallback", {
    reason,
    cooldownMs: UPSTASH_COOLDOWN_MS,
  });
}

// In-memory fallback (single-instance only)
const store = new Map<string, { count: number; resetAt: number }>();
// Hard ceiling on the store: a flood of distinct keys must not grow it without
// bound, and the O(n) sweep must not run on every request once it is full.
const MAX_ENTRIES = 10_000;
const PRUNE_INTERVAL_MS = 10_000;
let lastPrunedAt = 0;

function pruneExpired(now: number) {
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
  lastPrunedAt = now;
}

function evictOldest(count: number) {
  // Map iterates in insertion order, so the head holds the least recently added keys.
  let evicted = 0;
  for (const key of store.keys()) {
    store.delete(key);
    if (++evicted >= count) return;
  }
}

function rateLimitMemory(
  ip: string,
  bucket: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  if (store.size >= MAX_ENTRIES) {
    if (now - lastPrunedAt >= PRUNE_INTERVAL_MS) pruneExpired(now);
    // Still full means the entries are all live: drop the oldest to make room.
    if (store.size >= MAX_ENTRIES) evictOldest(store.size - MAX_ENTRIES + 1);
  }
  // The bucket and config are part of the key: distinct endpoints must not share a
  // counter, and neither may a 5/hour bucket and a 10/minute one on the same endpoint.
  const key = `${bucket}:${limit}:${windowMs}:${ip}`;
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

export interface RateLimitOptions {
  // Namespace for the counter, one per protected action. Two endpoints that share a
  // limit and window still get separate buckets, so traffic to one never spends the
  // other's allowance.
  bucket: string;
  limit: number;
  windowMs: number;
}

export async function rateLimit(
  ip: string,
  { bucket, limit, windowMs }: RateLimitOptions
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  if (Date.now() >= upstashDownUntil) {
    try {
      const limiter = getLimiter(bucket, limit, windowMs);
      if (limiter) {
        const result = await limiter.limit(ip);
        // A timed-out call resolves as allowed without ever reaching Redis, so
        // count the request locally rather than waving it through.
        if (result.reason !== "timeout") {
          return {
            allowed: result.success,
            remaining: result.remaining,
            resetAt: result.reset,
          };
        }
        markUpstashDown(`no response within ${UPSTASH_TIMEOUT_MS}ms`);
      }
    } catch (err) {
      markUpstashDown(err instanceof Error ? err.message : String(err));
    }
  }
  return rateLimitMemory(ip, bucket, limit, windowMs);
}

// Vercel rewrites these at its edge on every request, so a client cannot forge them.
const TRUSTED_IP_HEADERS = ["x-vercel-forwarded-for", "x-real-ip"];

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
// Structural check only — hex groups and colons, plus an optional trailing IPv4
// for the ::ffff:1.2.3.4 form. Enough to reject junk and bound the key length
// without shipping a full RFC 4291 parser.
const IPV6 = /^[0-9a-f:]{2,45}(?:\.\d{1,3}){0,3}$/;

function normalizeIp(raw: string): string | null {
  let value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith("[")) {
    // "[2001:db8::1]:443"
    const end = value.indexOf("]");
    if (end < 0) return null;
    value = value.slice(1, end);
  } else {
    // "1.2.3.4:5678" — a lone colon alongside dots is an IPv4 address with a port
    const colon = value.indexOf(":");
    if (colon > 0 && value.includes(".") && value.indexOf(":", colon + 1) === -1) {
      value = value.slice(0, colon);
    }
  }
  if (IPV4.test(value)) return value;
  if (value.includes(":") && IPV6.test(value)) return value;
  return null;
}

export function getClientIp(req: Request): string {
  for (const header of TRUSTED_IP_HEADERS) {
    const ip = normalizeIp(req.headers.get(header) ?? "");
    if (ip) return ip;
  }
  // x-forwarded-for is append-only: every entry left of the last hop is
  // caller-supplied and spoofable, so read it right to left.
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",");
    for (let i = hops.length - 1; i >= 0; i--) {
      const ip = normalizeIp(hops[i]);
      if (ip) return ip;
    }
  }
  // Nothing attributable, which cannot happen behind Vercel. Share a single
  // bucket so such requests stay capped in aggregate instead of each one
  // getting a fresh allowance.
  return "unknown";
}
