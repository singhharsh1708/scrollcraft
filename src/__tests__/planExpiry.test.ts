import { describe, it, expect } from "vitest";
import { planPeriodEnd, isPlanActive } from "@/lib/plans";

describe("planPeriodEnd", () => {
  const from = new Date("2026-01-15T00:00:00.000Z");

  it("adds a month for monthly billing", () => {
    expect(planPeriodEnd("monthly", from).toISOString()).toBe("2026-02-15T00:00:00.000Z");
  });

  it("adds a year for annual billing", () => {
    expect(planPeriodEnd("annual", from).toISOString()).toBe("2027-01-15T00:00:00.000Z");
  });

  it("treats an unknown or missing cadence as monthly", () => {
    expect(planPeriodEnd(undefined, from).toISOString()).toBe("2026-02-15T00:00:00.000Z");
    expect(planPeriodEnd("", from).toISOString()).toBe("2026-02-15T00:00:00.000Z");
  });
});

describe("isPlanActive", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  it("is active when the expiry is in the future", () => {
    expect(isPlanActive(new Date("2026-06-02T00:00:00.000Z"), now)).toBe(true);
  });

  it("is inactive once the expiry has passed", () => {
    expect(isPlanActive(new Date("2026-05-31T23:59:59.000Z"), now)).toBe(false);
  });

  it("treats a null expiry as active — a legacy grant is never silently revoked", () => {
    expect(isPlanActive(null, now)).toBe(true);
    expect(isPlanActive(undefined, now)).toBe(true);
  });
});
