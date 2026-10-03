import "server-only";

/**
 * Where the Redis credentials come from.
 *
 * Two names for one store. A database created by hand in Upstash gives
 * UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN; one provisioned through Vercel's
 * marketplace gives KV_REST_API_URL and KV_REST_API_TOKEN for the same thing. Reading
 * only the first pair left rate limiting silently on its in-memory fallback after the
 * store was replaced, so both are accepted and the explicit pair wins.
 */
export type RedisCredentials = { url: string; token: string };

export function redisCredentials(): RedisCredentials | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}
