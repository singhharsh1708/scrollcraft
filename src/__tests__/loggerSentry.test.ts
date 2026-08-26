import { describe, it, expect, beforeEach, vi } from "vitest";

const captureException = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({ captureException }));

let logger: typeof import("../lib/logger").logger;

beforeEach(async () => {
  vi.resetModules();
  captureException.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  ({ logger } = await import("../lib/logger"));
});

describe("logger → Sentry", () => {
  it("reports the caught error to Sentry on logger.error", () => {
    const err = new Error("boom");
    logger.error("export-site failed", { err });
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][0]).toBe(err);
  });

  it("wraps a non-Error payload so Sentry still gets an exception", () => {
    logger.error("something odd", { err: "not-an-error" });
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][0]).toBeInstanceOf(Error);
    expect((captureException.mock.calls[0][0] as Error).message).toBe("something odd");
  });

  it("does not report info or warn", () => {
    logger.info("hello");
    logger.warn("careful");
    expect(captureException).not.toHaveBeenCalled();
  });
});
