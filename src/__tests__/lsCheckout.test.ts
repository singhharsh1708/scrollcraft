import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";

// This endpoint stands between a user and a second charge for something they already
// own. The guards that matter: an existing PAID purchase short-circuits, an in-flight
// PENDING checkout is reused rather than duplicated, and a site the caller does not own
// is never chargeable.

const dbMock = vi.hoisted(() => ({
  site: { findUnique: vi.fn() },
  exportPurchase: { findFirst: vi.fn(), create: vi.fn() },
}));
const authMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());
const createExportCheckout = vi.hoisted(() => vi.fn());
const getExportCheckoutUrl = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/lemonsqueezy", () => ({ createExportCheckout, getExportCheckoutUrl }));
vi.mock("@/lib/env", () => ({
  env: {
    LEMONSQUEEZY_API_KEY: "key",
    LEMONSQUEEZY_STORE_ID: "1",
    LEMONSQUEEZY_VARIANT_ID: "2",
  },
}));

type Handler = typeof import("../app/api/payments/ls-checkout/route").POST;
let POST: Handler;

function req(body: unknown): NextRequest {
  return new Request("https://scrollcraft.app/api/payments/ls-checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  rateLimitMock.mockResolvedValue({ allowed: true });
  authMock.mockResolvedValue({ user: { id: "u1", email: "a@b.c" } });
  dbMock.site.findUnique.mockResolvedValue({ id: "s1", name: "Launch" });
  dbMock.exportPurchase.findFirst.mockResolvedValue(null);
  dbMock.exportPurchase.create.mockResolvedValue({ id: "ep1" });
  createExportCheckout.mockResolvedValue({ checkoutUrl: "https://ls.example/co/abc", checkoutId: "co_abc" });
  getExportCheckoutUrl.mockResolvedValue("https://ls.example/co/existing");
  ({ POST } = await import("../app/api/payments/ls-checkout/route"));
});

describe("POST /api/payments/ls-checkout — access control", () => {
  it("429s when rate limited, before authenticating", async () => {
    rateLimitMock.mockResolvedValue({ allowed: false });
    expect((await POST(req({ siteId: "s1" }))).status).toBe(429);
    expect(createExportCheckout).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    authMock.mockResolvedValue(null);
    expect((await POST(req({ siteId: "s1" }))).status).toBe(401);
    expect(createExportCheckout).not.toHaveBeenCalled();
  });

  it("404s a site the caller does not own, and never opens a checkout", async () => {
    dbMock.site.findUnique.mockResolvedValue(null);
    const res = await POST(req({ siteId: "someone-elses" }));
    expect(res.status).toBe(404);
    expect(createExportCheckout).not.toHaveBeenCalled();
  });

  it("scopes the site lookup to the caller", async () => {
    await POST(req({ siteId: "s1" }));
    expect(dbMock.site.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "s1", userId: "u1" } })
    );
  });

  it("400s a malformed body", async () => {
    expect((await POST(req("{ not json"))).status).toBe(400);
  });

  it("400s a missing siteId", async () => {
    expect((await POST(req({}))).status).toBe(400);
    expect(createExportCheckout).not.toHaveBeenCalled();
  });
});

describe("POST /api/payments/ls-checkout — never charge twice", () => {
  it("short-circuits when the export is already paid for", async () => {
    dbMock.exportPurchase.findFirst.mockResolvedValueOnce({ id: "ep_paid", status: "PAID" });

    const res = await POST(req({ siteId: "s1" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ alreadyPurchased: true });
    expect(createExportCheckout).not.toHaveBeenCalled();
  });

  it("reuses an in-flight checkout instead of opening a second one", async () => {
    dbMock.exportPurchase.findFirst
      .mockResolvedValueOnce(null) // no PAID row
      .mockResolvedValueOnce({ lsCheckoutId: "co_existing" }); // a live PENDING one

    const res = await POST(req({ siteId: "s1" }));

    expect(await res.json()).toEqual({
      checkoutUrl: "https://ls.example/co/existing",
      pending: true,
    });
    expect(createExportCheckout).not.toHaveBeenCalled();
  });

  it("opens a fresh checkout when the pending one can no longer be resolved", async () => {
    dbMock.exportPurchase.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ lsCheckoutId: "co_stale" });
    getExportCheckoutUrl.mockRejectedValue(new Error("gone"));

    const res = await POST(req({ siteId: "s1" }));

    expect((await res.json()).checkoutUrl).toBe("https://ls.example/co/abc");
    expect(createExportCheckout).toHaveBeenCalledTimes(1);
  });

  it("only counts a PENDING checkout that is still inside its TTL", async () => {
    await POST(req({ siteId: "s1" }));
    const pendingQuery = dbMock.exportPurchase.findFirst.mock.calls[1][0];
    expect(pendingQuery.where.status).toBe("PENDING");
    expect(pendingQuery.where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("records the in-flight checkout so a repeat request is guarded", async () => {
    await POST(req({ siteId: "s1" }));
    expect(dbMock.exportPurchase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "u1", siteId: "s1", status: "PENDING", lsCheckoutId: "co_abc",
        }),
      })
    );
  });

  it("prefixes the placeholder order id so it cannot collide with a real one", async () => {
    await POST(req({ siteId: "s1" }));
    const { lsOrderId } = dbMock.exportPurchase.create.mock.calls[0][0].data;
    expect(lsOrderId).toBe("pending:co_abc");
    expect(lsOrderId).not.toMatch(/^\d+$/);
  });

  it("still returns the checkout when recording the guard row fails", async () => {
    dbMock.exportPurchase.create.mockRejectedValue(new Error("db down"));
    const res = await POST(req({ siteId: "s1" }));
    expect(res.status).toBe(200);
    expect((await res.json()).checkoutUrl).toBe("https://ls.example/co/abc");
  });

  it("500s when the checkout cannot be created", async () => {
    createExportCheckout.mockRejectedValue(new Error("LS down"));
    expect((await POST(req({ siteId: "s1" }))).status).toBe(500);
  });
});
