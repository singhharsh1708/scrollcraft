import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { TEMPLATES } from "@/lib/templates";

// This endpoint stands between a user and a second charge for a template they already
// own. The guards that matter: an existing PAID purchase short-circuits, an in-flight
// PENDING checkout is reused rather than duplicated, and anything that is not a premium
// template is never chargeable.

const dbMock = vi.hoisted(() => ({
  templatePurchase: { findFirst: vi.fn(), create: vi.fn() },
}));
const authMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());
const createTemplateCheckout = vi.hoisted(() => vi.fn());
const getExportCheckoutUrl = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/lemonsqueezy", () => ({ createTemplateCheckout, getExportCheckoutUrl }));
vi.mock("@/lib/env", () => ({
  env: {
    LEMONSQUEEZY_API_KEY: "key",
    LEMONSQUEEZY_STORE_ID: "1",
    LEMONSQUEEZY_TEMPLATE_VARIANT_ID: "3",
  },
}));

const PREMIUM = TEMPLATES.find((t) => t.premium)!.slug;
const FREE = TEMPLATES.find((t) => !t.premium)!.slug;

type Handler = typeof import("../app/api/payments/template-checkout/route").POST;
let POST: Handler;

function req(body: unknown): NextRequest {
  return new Request("https://scrollcraft.app/api/payments/template-checkout", {
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
  dbMock.templatePurchase.findFirst.mockResolvedValue(null);
  dbMock.templatePurchase.create.mockResolvedValue({ id: "tp1" });
  createTemplateCheckout.mockResolvedValue({
    checkoutUrl: "https://ls.example/co/abc",
    checkoutId: "co_abc",
  });
  getExportCheckoutUrl.mockResolvedValue("https://ls.example/co/existing");
  ({ POST } = await import("../app/api/payments/template-checkout/route"));
});

describe("POST /api/payments/template-checkout — access control", () => {
  it("429s when rate limited, before authenticating", async () => {
    rateLimitMock.mockResolvedValue({ allowed: false });
    expect((await POST(req({ slug: PREMIUM }))).status).toBe(429);
    expect(createTemplateCheckout).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    authMock.mockResolvedValue(null);
    expect((await POST(req({ slug: PREMIUM }))).status).toBe(401);
    expect(createTemplateCheckout).not.toHaveBeenCalled();
  });

  it("400s a malformed body", async () => {
    expect((await POST(req("{ not json"))).status).toBe(400);
  });

  it("400s a missing slug", async () => {
    expect((await POST(req({}))).status).toBe(400);
    expect(createTemplateCheckout).not.toHaveBeenCalled();
  });
});

describe("POST /api/payments/template-checkout — only premium templates are for sale", () => {
  it("404s an unknown slug", async () => {
    expect((await POST(req({ slug: "not-a-template" }))).status).toBe(404);
    expect(createTemplateCheckout).not.toHaveBeenCalled();
  });

  it("404s a free template rather than charging for something already free", async () => {
    const res = await POST(req({ slug: FREE }));
    expect(res.status).toBe(404);
    expect(createTemplateCheckout).not.toHaveBeenCalled();
  });

  it("opens a checkout for a genuinely premium template", async () => {
    const res = await POST(req({ slug: PREMIUM }));
    expect(res.status).toBe(200);
    expect((await res.json()).checkoutUrl).toBe("https://ls.example/co/abc");
    expect(createTemplateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ templateSlug: PREMIUM, userId: "u1" })
    );
  });
});

describe("POST /api/payments/template-checkout — never charge twice", () => {
  it("short-circuits when the template is already owned", async () => {
    dbMock.templatePurchase.findFirst.mockResolvedValueOnce({ id: "tp_paid" });

    const res = await POST(req({ slug: PREMIUM }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ alreadyPurchased: true });
    expect(createTemplateCheckout).not.toHaveBeenCalled();
  });

  it("looks for ownership scoped to the caller, the slug and PAID only", async () => {
    dbMock.templatePurchase.findFirst.mockResolvedValueOnce({ id: "tp_paid" });
    await POST(req({ slug: PREMIUM }));
    expect(dbMock.templatePurchase.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1", templateSlug: PREMIUM, status: "PAID" },
      })
    );
  });

  it("reuses an in-flight checkout instead of opening a second one", async () => {
    dbMock.templatePurchase.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ lsCheckoutId: "co_existing" });

    const res = await POST(req({ slug: PREMIUM }));

    expect(await res.json()).toEqual({
      checkoutUrl: "https://ls.example/co/existing",
      pending: true,
    });
    expect(createTemplateCheckout).not.toHaveBeenCalled();
  });

  it("opens a fresh checkout when the pending one can no longer be resolved", async () => {
    dbMock.templatePurchase.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ lsCheckoutId: "co_stale" });
    getExportCheckoutUrl.mockRejectedValue(new Error("gone"));

    const res = await POST(req({ slug: PREMIUM }));

    expect((await res.json()).checkoutUrl).toBe("https://ls.example/co/abc");
    expect(createTemplateCheckout).toHaveBeenCalledTimes(1);
  });

  it("only counts a PENDING checkout still inside its TTL", async () => {
    await POST(req({ slug: PREMIUM }));
    const pendingQuery = dbMock.templatePurchase.findFirst.mock.calls[1][0];
    expect(pendingQuery.where.status).toBe("PENDING");
    expect(pendingQuery.where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("records the in-flight checkout so a repeat request is guarded", async () => {
    await POST(req({ slug: PREMIUM }));
    expect(dbMock.templatePurchase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "u1", templateSlug: PREMIUM, status: "PENDING", lsCheckoutId: "co_abc",
        }),
      })
    );
  });

  it("prefixes the placeholder order id so it cannot collide with a real one", async () => {
    await POST(req({ slug: PREMIUM }));
    const { lsOrderId } = dbMock.templatePurchase.create.mock.calls[0][0].data;
    expect(lsOrderId).toBe("pending:co_abc");
    expect(lsOrderId).not.toMatch(/^\d+$/);
  });

  it("still returns the checkout when recording the guard row fails", async () => {
    dbMock.templatePurchase.create.mockRejectedValue(new Error("db down"));
    const res = await POST(req({ slug: PREMIUM }));
    expect(res.status).toBe(200);
    expect((await res.json()).checkoutUrl).toBe("https://ls.example/co/abc");
  });

  it("500s when the checkout cannot be created", async () => {
    createTemplateCheckout.mockRejectedValue(new Error("LS down"));
    expect((await POST(req({ slug: PREMIUM }))).status).toBe(500);
  });
});
