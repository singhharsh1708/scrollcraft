import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import type { NextRequest } from "next/server";

// A promo use is money. Two invariants:
//   1. It is only consumed when a payment is actually captured — an issued-but-
//      abandoned checkout must release its hold rather than burn a use.
//   2. It can never be pushed past maxUses, including by concurrent checkouts.

const dbMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  promoCode: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  payment: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));

const ordersCreate = vi.hoisted(() => vi.fn());
const authMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: rateLimitMock,
  getClientIp: () => "1.2.3.4",
}));
vi.mock("razorpay", () => ({
  default: class {
    orders = { create: ordersCreate, fetch: vi.fn() };
    constructor() {}
  },
}));

const KEY_SECRET = "rzp_secret";
const BASIC_MONTHLY = 199900;

type CreateOrder = typeof import("../app/api/payments/create-order/route").POST;
type Verify = typeof import("../app/api/payments/verify/route").POST;
let createOrder: CreateOrder;
let verify: Verify;

function jsonRequest(body: unknown): NextRequest {
  return new Request("https://scrollcraft.app/api/payments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function verifyRequest(orderId: string, paymentId: string, secret = KEY_SECRET): NextRequest {
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return jsonRequest({ orderId, paymentId, signature });
}

beforeEach(async () => {
  vi.resetModules();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.RAZORPAY_KEY_ID = "rzp_key";
  process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;

  authMock.mockReset().mockResolvedValue({ user: { id: "user_1", email: "a@b.com", plan: "FREE" } });
  rateLimitMock.mockReset().mockResolvedValue({ allowed: true, remaining: 4, resetAt: 0 });
  dbMock.user.findUnique.mockReset().mockResolvedValue({ id: "user_1" });
  dbMock.user.update.mockReset().mockResolvedValue({ id: "user_1" });
  dbMock.promoCode.findUnique.mockReset().mockResolvedValue(null);
  dbMock.promoCode.update.mockReset().mockResolvedValue({});
  dbMock.promoCode.updateMany.mockReset().mockResolvedValue({ count: 0 });
  dbMock.payment.count.mockReset().mockResolvedValue(0);
  dbMock.payment.create.mockReset().mockResolvedValue({ id: "p1" });
  dbMock.payment.findUnique.mockReset().mockResolvedValue(null);
  dbMock.payment.updateMany.mockReset().mockResolvedValue({ count: 0 });
  dbMock.$executeRaw.mockReset().mockResolvedValue(1);
  // Fulfilment is one transaction now: run the callback against a tx that delegates to
  // the same mocks, so these assertions keep describing the writes fulfilment makes.
  dbMock.$transaction.mockReset().mockImplementation((fn: (tx: unknown) => unknown) =>
    Promise.resolve(fn({
      payment: dbMock.payment,
      user: dbMock.user,
      promoCode: dbMock.promoCode,
      $executeRaw: dbMock.$executeRaw,
    }))
  );
  ordersCreate.mockReset().mockImplementation(async (args: { amount: number; currency: string }) => ({
    id: "order_1",
    amount: args.amount,
    currency: args.currency,
  }));

  ({ POST: createOrder } = await import("../app/api/payments/create-order/route"));
  ({ POST: verify } = await import("../app/api/payments/verify/route"));
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
});

function activePromo(overrides: Record<string, unknown> = {}) {
  return {
    code: "LAUNCH50",
    discountPct: 50,
    maxUses: 100,
    uses: 0,
    expiresAt: null,
    active: true,
    ...overrides,
  };
}

describe("create-order — a promo use is held, not consumed", () => {
  it("discounts the order without incrementing the promo's use count", async () => {
    dbMock.promoCode.findUnique.mockResolvedValue(activePromo());

    const res = await createOrder(jsonRequest({ plan: "Basic", promoCode: "launch50" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.discountPct).toBe(50);
    expect(ordersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: BASIC_MONTHLY / 2 })
    );
    // Nothing may consume a use at order time — the checkout may never be paid.
    expect(dbMock.$executeRaw).not.toHaveBeenCalled();
    expect(dbMock.promoCode.update).not.toHaveBeenCalled();
    expect(dbMock.promoCode.updateMany).not.toHaveBeenCalled();
  });

  it("persists a PENDING payment matching the amount the gateway was told to charge", async () => {
    dbMock.promoCode.findUnique.mockResolvedValue(activePromo());

    await createOrder(jsonRequest({ plan: "Basic", promoCode: "LAUNCH50" }));

    const charged = ordersCreate.mock.calls[0][0].amount;
    expect(dbMock.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user_1",
        razorpayOrderId: "order_1",
        plan: "Basic",
        amount: charged,
        promoCode: "LAUNCH50",
        discountPct: 50,
        status: "PENDING",
      }),
    });
  });

  it("rejects a checkout whose promo is already fully held by in-flight orders", async () => {
    dbMock.promoCode.findUnique.mockResolvedValue(activePromo({ maxUses: 1, uses: 0 }));
    dbMock.payment.count.mockResolvedValue(1); // one checkout already issued

    const res = await createOrder(jsonRequest({ plan: "Basic", promoCode: "LAUNCH50" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("PROMO_INVALID");
    expect(dbMock.payment.create).not.toHaveBeenCalled();
  });

  it("only counts recent PENDING orders as holds, so an abandoned checkout releases its use", async () => {
    dbMock.promoCode.findUnique.mockResolvedValue(activePromo({ maxUses: 5, uses: 0 }));

    await createOrder(jsonRequest({ plan: "Basic", promoCode: "LAUNCH50" }));

    const where = dbMock.payment.count.mock.calls[0][0].where;
    expect(where.promoCode).toBe("LAUNCH50");
    expect(where.status).toBe("PENDING");
    const cutoff = (where.createdAt.gte as Date).getTime();
    const expected = Date.now() - 30 * 60_000;
    // A 30 minute hold window: older PENDING orders are treated as abandoned.
    expect(Math.abs(cutoff - expected)).toBeLessThan(5_000);
  });

  it("rejects the checkout once uses have reached maxUses", async () => {
    dbMock.promoCode.findUnique.mockResolvedValue(activePromo({ maxUses: 5, uses: 5 }));

    const res = await createOrder(jsonRequest({ plan: "Basic", promoCode: "LAUNCH50" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("PROMO_INVALID");
  });

  it("allows an unlimited promo regardless of how many orders are in flight", async () => {
    dbMock.promoCode.findUnique.mockResolvedValue(activePromo({ maxUses: null }));
    dbMock.payment.count.mockResolvedValue(9999);

    const body = await (await createOrder(jsonRequest({ plan: "Basic", promoCode: "LAUNCH50" }))).json();

    expect(body.discountPct).toBe(50);
    expect(dbMock.payment.count).not.toHaveBeenCalled();
  });

  it("rejects an inactive promo", async () => {
    dbMock.promoCode.findUnique.mockResolvedValue(activePromo({ active: false }));

    const res = await createOrder(jsonRequest({ plan: "Basic", promoCode: "LAUNCH50" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("PROMO_INVALID");
  });

  it("rejects an expired promo", async () => {
    dbMock.promoCode.findUnique.mockResolvedValue(
      activePromo({ expiresAt: new Date(Date.now() - 1_000) })
    );

    const res = await createOrder(jsonRequest({ plan: "Basic", promoCode: "LAUNCH50" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("PROMO_INVALID");
  });

  it("rejects an unknown promo code", async () => {
    dbMock.promoCode.findUnique.mockResolvedValue(null);

    const res = await createOrder(jsonRequest({ plan: "Basic", promoCode: "NOPE" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("PROMO_INVALID");
    expect(dbMock.payment.create).not.toHaveBeenCalled();
  });

  it("charges twelve months up front for annual billing", async () => {
    await createOrder(jsonRequest({ plan: "Basic", billing: "annual" }));

    expect(ordersCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 159900 * 12 }));
  });

  it("rejects a plan that is not on the price list", async () => {
    const res = await createOrder(jsonRequest({ plan: "Enterprise" }));

    expect(res.status).toBe(400);
    expect(ordersCreate).not.toHaveBeenCalled();
    expect(dbMock.payment.create).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    authMock.mockResolvedValue(null);

    const res = await createOrder(jsonRequest({ plan: "Basic" }));

    expect(res.status).toBe(401);
    expect(ordersCreate).not.toHaveBeenCalled();
  });

  it("stops at the rate limit before creating an order", async () => {
    rateLimitMock.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 0 });

    const res = await createOrder(jsonRequest({ plan: "Basic" }));

    expect(res.status).toBe(429);
    expect(ordersCreate).not.toHaveBeenCalled();
    expect(dbMock.payment.create).not.toHaveBeenCalled();
  });
});

describe("verify — the promo use is consumed exactly once, at capture", () => {
  const pendingPayment = {
    id: "p1",
    userId: "user_1",
    plan: "Pro",
    promoCode: "LAUNCH50",
    status: "PENDING",
  };

  it("consumes the use only when it wins the PENDING -> CAPTURED claim", async () => {
    dbMock.payment.findUnique.mockResolvedValue(pendingPayment);
    dbMock.payment.updateMany.mockResolvedValue({ count: 1 });

    const res = await verify(verifyRequest("order_1", "pay_1"));

    expect(res.status).toBe(200);
    expect(dbMock.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", status: { in: ["PENDING", "FAILED"] } },
      data: { razorpayPaymentId: "pay_1", status: "CAPTURED" },
    });
    expect(dbMock.$executeRaw).toHaveBeenCalledTimes(1);
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: expect.objectContaining({ plan: "PRO", planExpiresAt: expect.any(Date) }),
    });
  });

  it("does not consume a second use when the webhook already claimed the capture", async () => {
    dbMock.payment.findUnique.mockResolvedValue({ ...pendingPayment, status: "PENDING" });
    dbMock.payment.updateMany.mockResolvedValue({ count: 0 });

    const res = await verify(verifyRequest("order_1", "pay_1"));

    expect(res.status).toBe(200);
    expect(dbMock.$executeRaw).not.toHaveBeenCalled();
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("short-circuits an already CAPTURED payment without re-consuming", async () => {
    dbMock.payment.findUnique.mockResolvedValue({ ...pendingPayment, status: "CAPTURED" });

    const res = await verify(verifyRequest("order_1", "pay_1"));

    expect(res.status).toBe(200);
    expect(dbMock.payment.updateMany).not.toHaveBeenCalled();
    expect(dbMock.$executeRaw).not.toHaveBeenCalled();
  });

  it("cannot re-capture a REFUNDED payment", async () => {
    dbMock.payment.findUnique.mockResolvedValue({ ...pendingPayment, status: "REFUNDED" });
    dbMock.payment.updateMany.mockResolvedValue({ count: 0 });

    await verify(verifyRequest("order_1", "pay_1"));

    expect(dbMock.user.update).not.toHaveBeenCalled();
    expect(dbMock.$executeRaw).not.toHaveBeenCalled();
  });

  it("bounds the consumption with a conditional UPDATE guarded on maxUses", async () => {
    dbMock.payment.findUnique.mockResolvedValue(pendingPayment);
    dbMock.payment.updateMany.mockResolvedValue({ count: 1 });

    await verify(verifyRequest("order_1", "pay_1"));

    const [strings, ...values] = dbMock.$executeRaw.mock.calls[0] as [string[], ...unknown[]];
    const sql = strings.join("?");
    expect(sql).toMatch(/uses\s*=\s*uses\s*\+\s*1/i);
    expect(sql).toMatch(/uses\s*<\s*"maxUses"/i);
    expect(values).toEqual(["LAUNCH50"]);
  });

  it("rejects a forged payment signature before touching any payment row", async () => {
    dbMock.payment.findUnique.mockResolvedValue(pendingPayment);

    const res = await verify(verifyRequest("order_1", "pay_1", "attacker_secret"));

    expect(res.status).toBe(400);
    expect(dbMock.payment.findUnique).not.toHaveBeenCalled();
    expect(dbMock.payment.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to capture an order belonging to another user", async () => {
    dbMock.payment.findUnique.mockResolvedValue({ ...pendingPayment, userId: "someone_else" });

    const res = await verify(verifyRequest("order_1", "pay_1"));

    expect(res.status).toBe(403);
    expect(dbMock.payment.updateMany).not.toHaveBeenCalled();
    expect(dbMock.$executeRaw).not.toHaveBeenCalled();
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("404s an order with no local payment row instead of granting", async () => {
    dbMock.payment.findUnique.mockResolvedValue(null);

    const res = await verify(verifyRequest("order_1", "pay_1"));

    expect(res.status).toBe(404);
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });
  it("fulfils the capture, the plan grant and the promo use in one transaction", async () => {
    dbMock.payment.findUnique.mockResolvedValue({ ...pendingPayment, plan: "Pro" });
    dbMock.payment.updateMany.mockResolvedValue({ count: 1 });

    const res = await verify(verifyRequest("order_1", "pay_1"));

    expect(res.status).toBe(200);
    // All three writes must go through the transaction, not stand alone beside it.
    expect(dbMock.$transaction).toHaveBeenCalledTimes(1);
    expect(dbMock.payment.updateMany).toHaveBeenCalled();
    expect(dbMock.user.update).toHaveBeenCalled();
  });

  it("does not leave a payment CAPTURED when the plan grant fails", async () => {
    // The rollback itself belongs to the database; what this pins is that the grant runs
    // inside the transaction, so its failure aborts the claim rather than escaping it.
    // Before the fix the CAPTURED flip had already committed, and the idempotent
    // early-return then treated that half-fulfilled row as complete forever.
    dbMock.payment.findUnique.mockResolvedValue({ ...pendingPayment, plan: "Pro" });
    dbMock.payment.updateMany.mockResolvedValue({ count: 1 });
    dbMock.user.update.mockRejectedValue(new Error("grant failed"));

    const res = await verify(verifyRequest("order_1", "pay_1"));

    expect(res.status).toBe(500);
    const txCall = dbMock.$transaction.mock.calls[0];
    expect(txCall).toBeDefined();
    await expect((txCall[0] as (tx: unknown) => Promise<unknown>)({
      payment: dbMock.payment, user: dbMock.user,
      promoCode: dbMock.promoCode, $executeRaw: dbMock.$executeRaw,
    })).rejects.toThrow("grant failed");
  });
});
