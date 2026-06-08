// Uses Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set,
// falls back to in-memory sliding window (resets on deploy — sufficient for single-region).
// To enable Redis: add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to env vars.

// In-memory fallback store
const store = new Map<string, { count: number; resetAt: number }>();

function pruneExpired() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

function rateLimitMemory(
  ip: string,
  { limit, windowMs }: RateLimitOptions
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

export function rateLimit(
  ip: string,
  options: RateLimitOptions
): { allowed: boolean; remaining: number; resetAt: number } {
  return rateLimitMemory(ip, options);
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}
