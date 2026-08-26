import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

let rateLimit: typeof import("../lib/rateLimit").rateLimit;

const savedEnv = {
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
};

beforeEach(async () => {
  // This file covers the in-memory fallback specifically. With UPSTASH_* set in the
  // environment the limiter takes the Redis path instead: the assertions below would
  // either hit the network or quietly stop testing the fallback they name.
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.resetModules();
  ({ rateLimit } = await import("../lib/rateLimit"));
});

afterEach(() => {
  if (savedEnv.url === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = savedEnv.url;
  if (savedEnv.token === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = savedEnv.token;
  vi.restoreAllMocks();
});

describe("rateLimit (in-memory fallback)", () => {
  it("allows requests within the limit", async () => {
    const result = await rateLimit("1.2.3.4", { bucket: "test", limit: 3, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("tracks count across calls", async () => {
    await rateLimit("1.2.3.4", { bucket: "test", limit: 3, windowMs: 60_000 });
    await rateLimit("1.2.3.4", { bucket: "test", limit: 3, windowMs: 60_000 });
    const third = await rateLimit("1.2.3.4", { bucket: "test", limit: 3, windowMs: 60_000 });
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("blocks requests over the limit", async () => {
    await rateLimit("1.2.3.4", { bucket: "test", limit: 2, windowMs: 60_000 });
    await rateLimit("1.2.3.4", { bucket: "test", limit: 2, windowMs: 60_000 });
    const over = await rateLimit("1.2.3.4", { bucket: "test", limit: 2, windowMs: 60_000 });
    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);
  });

  it("resets after window expires", async () => {
    vi.useFakeTimers();
    await rateLimit("1.2.3.4", { bucket: "test", limit: 1, windowMs: 1_000 });
    const blocked = await rateLimit("1.2.3.4", { bucket: "test", limit: 1, windowMs: 1_000 });
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(1_001);
    const after = await rateLimit("1.2.3.4", { bucket: "test", limit: 1, windowMs: 1_000 });
    expect(after.allowed).toBe(true);
    vi.useRealTimers();
  });

  it("isolates counts per IP", async () => {
    await rateLimit("1.1.1.1", { bucket: "test", limit: 1, windowMs: 60_000 });
    const other = await rateLimit("2.2.2.2", { bucket: "test", limit: 1, windowMs: 60_000 });
    expect(other.allowed).toBe(true);
  });
  it("isolates counts per bucket even when IP, limit, and window match", async () => {
    await rateLimit("3.3.3.3", { bucket: "export-site", limit: 1, windowMs: 60_000 });
    const blocked = await rateLimit("3.3.3.3", { bucket: "export-site", limit: 1, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    // A different endpoint with the same identity and config must not have spent its allowance.
    const other = await rateLimit("3.3.3.3", { bucket: "extract-frames", limit: 1, windowMs: 60_000 });
    expect(other.allowed).toBe(true);
  });
});
