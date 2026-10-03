import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { redisCredentials } from "@/lib/redisCredentials";

/**
 * The store was replaced and nothing said so.
 *
 * A database created by hand in Upstash sets UPSTASH_REDIS_REST_*; one provisioned
 * through Vercel's marketplace sets KV_REST_API_* for the same store. Production had
 * stale UPSTASH_* values pointing at a database that had been deleted, so rate limiting
 * ran on its in-memory fallback for months and the funnel counts went nowhere, while
 * every request still answered normally.
 */

beforeEach(() => {
  vi.unstubAllEnvs();
  for (const key of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"]) {
    vi.stubEnv(key, "");
  }
});

describe("either name for the one store", () => {
  it("takes the pair a hand-made Upstash database gives", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://hand.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "hand-token");
    expect(redisCredentials()).toEqual({ url: "https://hand.upstash.io", token: "hand-token" });
  });

  it("takes the pair Vercel's marketplace gives", () => {
    vi.stubEnv("KV_REST_API_URL", "https://kv.upstash.io");
    vi.stubEnv("KV_REST_API_TOKEN", "kv-token");
    expect(redisCredentials()).toEqual({ url: "https://kv.upstash.io", token: "kv-token" });
  });

  it("prefers the explicit pair when both are present", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://hand.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "hand-token");
    vi.stubEnv("KV_REST_API_URL", "https://kv.upstash.io");
    vi.stubEnv("KV_REST_API_TOKEN", "kv-token");
    expect(redisCredentials()?.url).toBe("https://hand.upstash.io");
  });

  it("reports nothing rather than half a pair", () => {
    vi.stubEnv("KV_REST_API_URL", "https://kv.upstash.io");
    expect(redisCredentials()).toBeNull();
  });
});

describe("both consumers read the credentials the same way", () => {
  it("leaves no direct environment read behind, so one store cannot be seen by one and missed by the other", () => {
    for (const file of ["src/lib/rateLimit.ts", "src/app/api/count/route.ts"]) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} reads the environment itself`).not.toMatch(/process\.env\.(UPSTASH_REDIS_REST|KV_REST_API)/);
      expect(source).toContain("redisCredentials()");
    }
  });

  it("says which names it looked for when it finds none", () => {
    // "UPSTASH_* unset" sent the owner looking at a variable that was set the whole time.
    const source = readFileSync("src/lib/rateLimit.ts", "utf8");
    expect(source).toContain("UPSTASH_REDIS_REST_* or KV_REST_API_*");
  });
});
