import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The production 500 this covers: when the Upstash call rejected (network error,
// bad credentials, 5xx from the REST API) the rejection escaped `rateLimit` and
// every payment route returned a 500. The limiter must degrade to the in-memory
// bucket instead — and must still *enforce* a limit while degraded, otherwise an
// Upstash outage silently removes rate limiting altogether.

const limitMock = vi.hoisted(() => vi.fn());
const redisCtor = vi.hoisted(() => vi.fn());

vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor(opts: unknown) {
      redisCtor(opts);
    }
  },
}));

vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static slidingWindow = vi.fn((limit: number, window: string) => ({ limit, window }));
    limit = limitMock;
    constructor() {}
  }
  return { Ratelimit };
});

type RateLimit = typeof import("../lib/rateLimit").rateLimit;
let rateLimit: RateLimit;

const OPTS = { bucket: "test", limit: 3, windowMs: 60_000 };

beforeEach(async () => {
  vi.resetModules();
  limitMock.mockReset();
  redisCtor.mockReset();
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  // Silence the expected "backend unavailable" error log.
  vi.spyOn(console, "error").mockImplementation(() => {});
  ({ rateLimit } = await import("../lib/rateLimit"));
});

afterEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("rateLimit — Upstash path", () => {
  it("returns the Upstash verdict when the call resolves normally", async () => {
    limitMock.mockResolvedValue({ success: true, remaining: 7, reset: 1_700_000_000, reason: undefined });

    const result = await rateLimit("9.9.9.9", OPTS);

    expect(limitMock).toHaveBeenCalledTimes(1);
    expect(limitMock).toHaveBeenCalledWith("9.9.9.9");
    // 7 remaining is only reachable from Upstash — the in-memory bucket would say 2.
    expect(result).toEqual({ allowed: true, remaining: 7, resetAt: 1_700_000_000 });
  });

  it("blocks when Upstash denies the request", async () => {
    limitMock.mockResolvedValue({ success: false, remaining: 0, reset: 42, reason: undefined });

    await expect(rateLimit("9.9.9.9", OPTS)).resolves.toEqual({
      allowed: false,
      remaining: 0,
      resetAt: 42,
    });
  });

  it("never consults Upstash when it is not configured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();
    ({ rateLimit } = await import("../lib/rateLimit"));

    const result = await rateLimit("9.9.9.9", OPTS);

    expect(limitMock).not.toHaveBeenCalled();
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(OPTS.limit - 1);
  });
});

describe("rateLimit — in-memory fallback when Upstash rejects", () => {
  it("does not propagate the rejection (this was a 500 on every payment route)", async () => {
    limitMock.mockRejectedValue(new Error("fetch failed"));

    await expect(rateLimit("5.5.5.5", OPTS)).resolves.toEqual({
      allowed: true,
      remaining: OPTS.limit - 1,
      resetAt: expect.any(Number),
    });
  });

  it("still enforces the limit while degraded", async () => {
    limitMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const opts = { bucket: "test", limit: 2, windowMs: 60_000 };

    const first = await rateLimit("5.5.5.6", opts);
    const second = await rateLimit("5.5.5.6", opts);
    const third = await rateLimit("5.5.5.6", opts);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("stops calling Upstash for the cooldown after a failure", async () => {
    limitMock.mockRejectedValue(new Error("boom"));

    await rateLimit("5.5.5.7", OPTS);
    await rateLimit("5.5.5.7", OPTS);
    await rateLimit("5.5.5.7", OPTS);

    // One timeout for the whole outage, not one per request.
    expect(limitMock).toHaveBeenCalledTimes(1);
  });

  it("resumes using Upstash once the cooldown expires", async () => {
    vi.useFakeTimers();
    limitMock.mockRejectedValueOnce(new Error("boom"));

    const degraded = await rateLimit("5.5.5.8", OPTS);
    expect(degraded.remaining).toBe(OPTS.limit - 1);

    limitMock.mockResolvedValue({ success: true, remaining: 99, reset: 7, reason: undefined });
    await vi.advanceTimersByTimeAsync(30_001);

    const recovered = await rateLimit("5.5.5.8", OPTS);
    expect(limitMock).toHaveBeenCalledTimes(2);
    expect(recovered).toEqual({ allowed: true, remaining: 99, resetAt: 7 });
  });

  it("keeps per-config buckets separate while degraded", async () => {
    limitMock.mockRejectedValue(new Error("boom"));

    await rateLimit("5.5.5.9", { bucket: "test", limit: 1, windowMs: 60_000 });
    const blocked = await rateLimit("5.5.5.9", { bucket: "test", limit: 1, windowMs: 60_000 });
    // A different limit/window is a different bucket, so it must not inherit the count.
    const otherBucket = await rateLimit("5.5.5.9", { bucket: "test", limit: 1, windowMs: 3_600_000 });

    expect(blocked.allowed).toBe(false);
    expect(otherBucket.allowed).toBe(true);
  });
});

describe("rateLimit — Upstash timeout", () => {
  it("counts a timed-out request locally instead of waving it through", async () => {
    // The Upstash SDK resolves a timed-out call as `success: true` without ever
    // reaching Redis, so trusting it would make an outage a free-for-all.
    limitMock.mockResolvedValue({ success: true, remaining: 500, reset: 1, reason: "timeout" });
    const opts = { bucket: "test", limit: 2, windowMs: 60_000 };

    const first = await rateLimit("7.7.7.7", opts);
    expect(first.remaining).toBe(1); // in-memory, not the 500 Upstash claimed

    await rateLimit("7.7.7.7", opts);
    const third = await rateLimit("7.7.7.7", opts);
    expect(third.allowed).toBe(false);
  });
});
