import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { PLANS, siteAllowance } from "@/lib/plans";

const dbMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  site: { count: vi.fn(), create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
}));
const authMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));

type Handler = typeof import("../app/api/sites/route").POST;
let POST: Handler;

function req(body: Record<string, unknown>): NextRequest {
  return new Request("https://scrollcraft.app/api/sites", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(async () => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ allowed: true });
  authMock.mockResolvedValue({ user: { id: "u1", email: "a@b.c" } });
  dbMock.site.create.mockResolvedValue({ id: "new-site" });
  ({ POST } = await import("../app/api/sites/route"));
});

describe("saved-website allowance", () => {
  it("lets a FREE user create their first site", async () => {
    dbMock.user.findUnique.mockResolvedValue({ id: "u1", plan: "FREE" });
    dbMock.site.count.mockResolvedValue(0);

    const res = await POST(req({ name: "First" }));
    expect(res.status).toBe(200);
    expect(dbMock.site.create).toHaveBeenCalled();
  });

  it("refuses a FREE user's second site, because the plan sells one", async () => {
    dbMock.user.findUnique.mockResolvedValue({ id: "u1", plan: "FREE" });
    dbMock.site.count.mockResolvedValue(PLANS.FREE.sites);

    const res = await POST(req({ name: "Second" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("SITE_LIMIT");
    expect(body.allowance).toBe(PLANS.FREE.sites);
    expect(dbMock.site.create).not.toHaveBeenCalled();
  });

  it("honours each plan's effective allowance", async () => {
    for (const plan of Object.values(PLANS)) {
      const allowance = siteAllowance(plan.key);
      dbMock.site.create.mockClear();
      dbMock.user.findUnique.mockResolvedValue({ id: "u1", plan: plan.key });

      dbMock.site.count.mockResolvedValue(allowance - 1);
      expect((await POST(req({ name: "under" }))).status).toBe(200);

      dbMock.site.create.mockClear();
      dbMock.site.count.mockResolvedValue(allowance);
      const res = await POST(req({ name: "at limit" }));
      expect(res.status).toBe(409);
      expect((await res.json()).allowance).toBe(allowance);
      expect(dbMock.site.create).not.toHaveBeenCalled();
    }
  });

  it("never gives a legacy subscriber less than a new free account", () => {
    // The free allowance grew when the paid tiers were retired, and BASIC's stored value
    // is now below it. Nobody who paid may end up worse off than someone who did not.
    for (const plan of Object.values(PLANS)) {
      expect(siteAllowance(plan.key)).toBeGreaterThanOrEqual(PLANS.FREE.sites);
    }
    expect(PLANS.BASIC.sites).toBeLessThan(PLANS.FREE.sites);
    expect(siteAllowance("BASIC")).toBe(PLANS.FREE.sites);
  });

  it("treats an unknown plan as free rather than as no allowance", () => {
    expect(siteAllowance("NOT_A_PLAN")).toBe(PLANS.FREE.sites);
    expect(siteAllowance(null)).toBe(PLANS.FREE.sites);
  });

  it("updating an existing site is not blocked by the allowance", async () => {
    dbMock.user.findUnique.mockResolvedValue({ id: "u1", plan: "FREE" });
    dbMock.site.count.mockResolvedValue(99);
    dbMock.site.findFirst.mockResolvedValue({ id: "s1", userId: "u1" });
    dbMock.site.update.mockResolvedValue({ id: "s1" });

    const res = await POST(req({ id: "s1", name: "Renamed" }));
    expect(res.status).toBe(200);
    expect(dbMock.site.update).toHaveBeenCalled();
  });

  it("rejects an unauthenticated request before counting anything", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(req({ name: "x" }));
    expect(res.status).toBe(401);
    expect(dbMock.site.count).not.toHaveBeenCalled();
  });
});
