import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Lazy-init Redis + per-config Ratelimit instances
let redis: Redis | null = null;
const limiters = new Map<string, Ratelimit>();

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

function getLimiter(limit: number, windowMs: number): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  const cacheKey = `${limit}:${windowMs}`;
  if (!limiters.has(cacheKey)) {
    // Convert ms to nearest whole seconds for Upstash duration string
    const windowSec = Math.ceil(windowMs / 1000);
    limiters.set(cacheKey, new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: "sc_rl",
    }));
  }
  return limiters.get(cacheKey)!;
}

// In-memory fallback (single-instance only)
const store = new Map<string, { count: number; resetAt: number }>();

function pruneExpired() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

function rateLimitMemory(
  ip: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  if (store.size > 10_000) pruneExpired();
  const now = Date.now();
  const entry = store.get(ip);
  if (!entry || entry.resetAt <= now) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export async function rateLimit(
  ip: string,
  { limit, windowMs }: RateLimitOptions
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const limiter = getLimiter(limit, windowMs);
  if (limiter) {
    const result = await limiter.limit(ip);
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
    };
  }
  return rateLimitMemory(ip, limit, windowMs);
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}
