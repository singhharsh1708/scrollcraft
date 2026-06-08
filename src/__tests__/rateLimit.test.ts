import { describe, it, expect, beforeEach, vi } from "vitest";

// Reset module between tests to get a fresh store
let rateLimit: typeof import("../lib/rateLimit").rateLimit;

beforeEach(async () => {
  vi.resetModules();
  ({ rateLimit } = await import("../lib/rateLimit"));
});

describe("rateLimit", () => {
  it("allows requests within the limit", () => {
    const result = rateLimit("1.2.3.4", { limit: 3, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("tracks count across calls", () => {
    rateLimit("1.2.3.4", { limit: 3, windowMs: 60_000 });
    rateLimit("1.2.3.4", { limit: 3, windowMs: 60_000 });
    const third = rateLimit("1.2.3.4", { limit: 3, windowMs: 60_000 });
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("blocks requests over the limit", () => {
    rateLimit("1.2.3.4", { limit: 2, windowMs: 60_000 });
    rateLimit("1.2.3.4", { limit: 2, windowMs: 60_000 });
    const over = rateLimit("1.2.3.4", { limit: 2, windowMs: 60_000 });
    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);
  });

  it("resets after window expires", () => {
    vi.useFakeTimers();
    rateLimit("1.2.3.4", { limit: 1, windowMs: 1_000 });
    const blocked = rateLimit("1.2.3.4", { limit: 1, windowMs: 1_000 });
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(1_001);
    const after = rateLimit("1.2.3.4", { limit: 1, windowMs: 1_000 });
    expect(after.allowed).toBe(true);
    vi.useRealTimers();
  });

  it("isolates counts per IP", () => {
    rateLimit("1.1.1.1", { limit: 1, windowMs: 60_000 });
    const other = rateLimit("2.2.2.2", { limit: 1, windowMs: 60_000 });
    expect(other.allowed).toBe(true);
  });
});
