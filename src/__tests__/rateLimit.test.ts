import { describe, it, expect, beforeEach, vi } from "vitest";

let rateLimit: typeof import("../lib/rateLimit").rateLimit;

beforeEach(async () => {
  vi.resetModules();
  ({ rateLimit } = await import("../lib/rateLimit"));
});

describe("rateLimit (in-memory fallback)", () => {
  it("allows requests within the limit", async () => {
    const result = await rateLimit("1.2.3.4", { limit: 3, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("tracks count across calls", async () => {
    await rateLimit("1.2.3.4", { limit: 3, windowMs: 60_000 });
    await rateLimit("1.2.3.4", { limit: 3, windowMs: 60_000 });
    const third = await rateLimit("1.2.3.4", { limit: 3, windowMs: 60_000 });
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("blocks requests over the limit", async () => {
    await rateLimit("1.2.3.4", { limit: 2, windowMs: 60_000 });
    await rateLimit("1.2.3.4", { limit: 2, windowMs: 60_000 });
    const over = await rateLimit("1.2.3.4", { limit: 2, windowMs: 60_000 });
    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);
  });

  it("resets after window expires", async () => {
    vi.useFakeTimers();
    await rateLimit("1.2.3.4", { limit: 1, windowMs: 1_000 });
    const blocked = await rateLimit("1.2.3.4", { limit: 1, windowMs: 1_000 });
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(1_001);
    const after = await rateLimit("1.2.3.4", { limit: 1, windowMs: 1_000 });
    expect(after.allowed).toBe(true);
    vi.useRealTimers();
  });

  it("isolates counts per IP", async () => {
    await rateLimit("1.1.1.1", { limit: 1, windowMs: 60_000 });
    const other = await rateLimit("2.2.2.2", { limit: 1, windowMs: 60_000 });
    expect(other.allowed).toBe(true);
  });
});
