import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import type { NextRequest } from "next/server";

// Money invariants for the Razorpay webhook: a refund must revoke the plan, a
// redelivered capture must never resurrect a refunded payment, and an order the
// app did not raise must never be fulfilled.

const dbMock = vi.hoisted(() => ({
  payment: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  user: { findUnique: vi.fn(), update: vi.fn() },
  $executeRaw: vi.fn(),
}));

const ordersFetch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: dbMock }));

vi.mock("razorpay", () => ({
  default: class {
    orders = { fetch: ordersFetch, create: vi.fn() };
    constructor() {}
  },
}));

const WEBHOOK_SECRET = "rzp_whsec_test";

type Handler = typeof import("../app/api/webhooks/razorpay/route").POST;
let POST: Handler;

function signedRequest(payload: unknown, secret: string = WEBHOOK_SECRET): NextRequest {
  const rawBody = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return new Request("https://scrollcraft.app/api/webhooks/razorpay", {
    method: "POST",
    headers: { "x-razorpay-signature": signature },
    body: rawBody,
  }) as unknown as NextRequest;
}

type Entity = Record<string, unknown>;

function event(name: string, entity: Entity) {
  return { event: name, payload: { payment: { entity } } };
}

const CAPTURED = {
  id: "pay_1",
  order_id: "order_1",
  amount: 199900,
  currency: "INR",
};

beforeEach(async () => {
  vi.resetModules();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.RAZORPAY_KEY_ID = "rzp_key";
  process.env.RAZORPAY_KEY_SECRET = "rzp_secret";

  dbMock.payment.findUnique.mockReset().mockResolvedValue(null);
  dbMock.payment.findFirst.mockReset().mockResolvedValue(null);
  dbMock.payment.updateMany.mockReset().mockResolvedValue({ count: 0 });
  dbMock.payment.create.mockReset().mockResolvedValue({ id: "p_new" });
  dbMock.user.findUnique.mockReset().mockResolvedValue(null);
  dbMock.user.update.mockReset().mockResolvedValue({ id: "user_1" });
  dbMock.$executeRaw.mockReset().mockResolvedValue(1);
  ordersFetch.mockReset();

  ({ POST } = await import("../app/api/webhooks/razorpay/route"));
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
});

describe("Razorpay webhook — authentication", () => {
  it("rejects a payload signed with the wrong secret", async () => {
    const res = await POST(signedRequest(event("payment.captured", CAPTURED), "attacker"));

    expect(res.status).toBe(400);
    expect(dbMock.payment.findUnique).not.toHaveBeenCalled();
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("rejects an unsigned payload without throwing on the length compare", async () => {
    const req = new Request("https://scrollcraft.app/api/webhooks/razorpay", {
      method: "POST",
      body: JSON.stringify(event("payment.captured", CAPTURED)),
    }) as unknown as NextRequest;

    expect((await POST(req)).status).toBe(400);
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("returns 503 and grants nothing when no webhook secret is configured", async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    vi.resetModules();
    ({ POST } = await import("../app/api/webhooks/razorpay/route"));

    const res = await POST(signedRequest(event("payment.captured", CAPTURED)));

    expect(res.status).toBe(503);
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });
});

describe("Razorpay webhook — payment.captured", () => {
  it("upgrades the plan and consumes the promo when it wins the claim", async () => {
    dbMock.payment.findUnique.mockResolvedValue({
      id: "p1", userId: "user_1", plan: "Pro", promoCode: "LAUNCH50", status: "PENDING",
    });
    dbMock.payment.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(signedRequest(event("payment.captured", CAPTURED)));

    expect(res.status).toBe(200);
    expect(dbMock.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", status: { in: ["PENDING", "FAILED"] } },
      data: { razorpayPaymentId: "pay_1", status: "CAPTURED" },
    });
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: expect.objectContaining({ plan: "PRO", credits: 6000, planExpiresAt: expect.any(Date) }),
    });
    expect(dbMock.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("does not double-grant when the verify endpoint already claimed the capture", async () => {
    dbMock.payment.findUnique.mockResolvedValue({
      id: "p1", userId: "user_1", plan: "Pro", promoCode: "LAUNCH50", status: "CAPTURED",
    });
    dbMock.payment.updateMany.mockResolvedValue({ count: 0 });

    await POST(signedRequest(event("payment.captured", CAPTURED)));

    // Losing the claim means someone else already applied the plan and burned the
    // promo use — doing it again here would consume a second use.
    expect(dbMock.user.update).not.toHaveBeenCalled();
    expect(dbMock.$executeRaw).not.toHaveBeenCalled();
  });

  it("does not resurrect a REFUNDED payment on a redelivered capture", async () => {
    dbMock.payment.findUnique.mockResolvedValue({
      id: "p1", userId: "user_1", plan: "Pro", promoCode: null, status: "REFUNDED",
    });
    // The guarded update only matches PENDING/FAILED, so a refunded row is untouched.
    dbMock.payment.updateMany.mockResolvedValue({ count: 0 });

    const res = await POST(signedRequest(event("payment.captured", CAPTURED)));

    expect(res.status).toBe(200);
    expect(dbMock.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p1", status: { in: ["PENDING", "FAILED"] } } })
    );
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("re-captures a payment previously marked FAILED", async () => {
    dbMock.payment.findUnique.mockResolvedValue({
      id: "p1", userId: "user_1", plan: "Basic", promoCode: null, status: "FAILED",
    });
    dbMock.payment.updateMany.mockResolvedValue({ count: 1 });

    await POST(signedRequest(event("payment.captured", CAPTURED)));

    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: expect.objectContaining({ plan: "BASIC", credits: 1500, planExpiresAt: expect.any(Date) }),
    });
  });

  it("consumes the promo with a bounded, conditional UPDATE", async () => {
    dbMock.payment.findUnique.mockResolvedValue({
      id: "p1", userId: "user_1", plan: "Pro", promoCode: "LAUNCH50", status: "PENDING",
    });
    dbMock.payment.updateMany.mockResolvedValue({ count: 1 });

    await POST(signedRequest(event("payment.captured", CAPTURED)));

    const [strings, ...values] = dbMock.$executeRaw.mock.calls[0] as [string[], ...unknown[]];
    const sql = strings.join("?");
    // A plain `uses = uses + 1` would let concurrent captures push past maxUses.
    expect(sql).toMatch(/uses\s*=\s*uses\s*\+\s*1/i);
    expect(sql).toMatch(/uses\s*<\s*"maxUses"/i);
    // The code is bound as a parameter, never interpolated into the statement.
    expect(values).toEqual(["LAUNCH50"]);
  });

  it("does not consume anything when the payment carries no promo code", async () => {
    dbMock.payment.findUnique.mockResolvedValue({
      id: "p1", userId: "user_1", plan: "Pro", promoCode: null, status: "PENDING",
    });
    dbMock.payment.updateMany.mockResolvedValue({ count: 1 });

    await POST(signedRequest(event("payment.captured", CAPTURED)));

    expect(dbMock.$executeRaw).not.toHaveBeenCalled();
  });
});

describe("Razorpay webhook — payment.captured with no local order row", () => {
  const notes = {
    plan: "Pro",
    billing: "annual",
    userId: "user_1",
    promoCode: "LAUNCH50",
    discountPct: "50",
  };

  it("rebuilds the payment from the server-set order notes", async () => {
    ordersFetch.mockResolvedValue({ notes, amount: 199900 });
    dbMock.user.findUnique.mockResolvedValue({ id: "user_1" });

    const res = await POST(signedRequest(event("payment.captured", CAPTURED)));

    expect(res.status).toBe(200);
    expect(ordersFetch).toHaveBeenCalledWith("order_1");
    expect(dbMock.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user_1",
        razorpayOrderId: "order_1",
        razorpayPaymentId: "pay_1",
        plan: "Pro",
        billing: "annual",
        amount: 199900,
        status: "CAPTURED",
        promoCode: "LAUNCH50",
        discountPct: 50,
      }),
    });
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: expect.objectContaining({ plan: "PRO", credits: 6000, planExpiresAt: expect.any(Date) }),
    });
  });

  it("ignores the notes on the payment entity, which the browser controls", async () => {
    ordersFetch.mockResolvedValue({ notes, amount: 199900 });
    dbMock.user.findUnique.mockResolvedValue({ id: "user_1" });

    // Checkout.js lets the client attach arbitrary notes to the *payment*.
    await POST(
      signedRequest(
        event("payment.captured", {
          ...CAPTURED,
          notes: { plan: "Premium", userId: "attacker" },
        })
      )
    );

    expect(dbMock.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user_1", plan: "Pro" }),
    });
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: expect.objectContaining({ plan: "PRO", credits: 6000, planExpiresAt: expect.any(Date) }),
    });
  });

  it("refuses to fulfil when the captured amount is less than the order amount", async () => {
    ordersFetch.mockResolvedValue({ notes, amount: 199900 });
    dbMock.user.findUnique.mockResolvedValue({ id: "user_1" });

    await POST(signedRequest(event("payment.captured", { ...CAPTURED, amount: 100 })));

    expect(dbMock.payment.create).not.toHaveBeenCalled();
    expect(dbMock.user.update).not.toHaveBeenCalled();
    expect(dbMock.$executeRaw).not.toHaveBeenCalled();
  });

  it("refuses to fulfil when the order notes name an unknown user", async () => {
    ordersFetch.mockResolvedValue({ notes, amount: 199900 });
    dbMock.user.findUnique.mockResolvedValue(null);

    await POST(signedRequest(event("payment.captured", CAPTURED)));

    expect(dbMock.payment.create).not.toHaveBeenCalled();
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("refuses to fulfil an order whose notes carry no plan (e.g. a payment link)", async () => {
    ordersFetch.mockResolvedValue({ notes: { userId: "user_1" }, amount: 199900 });
    dbMock.user.findUnique.mockResolvedValue({ id: "user_1" });

    await POST(signedRequest(event("payment.captured", CAPTURED)));

    expect(dbMock.payment.create).not.toHaveBeenCalled();
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("refuses to fulfil an order naming a plan that does not exist", async () => {
    ordersFetch.mockResolvedValue({ notes: { ...notes, plan: "Enterprise" }, amount: 199900 });
    dbMock.user.findUnique.mockResolvedValue({ id: "user_1" });

    await POST(signedRequest(event("payment.captured", CAPTURED)));

    expect(dbMock.payment.create).not.toHaveBeenCalled();
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("returns 503 rather than granting when the gateway keys are missing", async () => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;

    const res = await POST(signedRequest(event("payment.captured", CAPTURED)));

    expect(res.status).toBe(503);
    expect(dbMock.payment.create).not.toHaveBeenCalled();
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });
});

describe("Razorpay webhook — refunds", () => {
  const refundEntity = {
    ...CAPTURED,
    refund_status: "full",
    amount_refunded: 199900,
  };

  it("marks the payment REFUNDED and downgrades to FREE when nothing else is captured", async () => {
    dbMock.payment.findUnique.mockResolvedValue({
      id: "p1", userId: "user_1", plan: "Pro", promoCode: null, status: "CAPTURED",
    });
    dbMock.payment.updateMany.mockResolvedValue({ count: 1 });
    dbMock.payment.findFirst.mockResolvedValue(null);

    const res = await POST(signedRequest(event("refund.processed", refundEntity)));

    expect(res.status).toBe(200);
    expect(dbMock.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", status: { not: "REFUNDED" } },
      data: { status: "REFUNDED" },
    });
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { plan: "FREE", credits: 100, planExpiresAt: null },
    });
  });

  it("reprices to the plan the user still has captured instead of dropping to FREE", async () => {
    dbMock.payment.findUnique.mockResolvedValue({
      id: "p2", userId: "user_1", plan: "Premium", promoCode: null, status: "CAPTURED",
    });
    dbMock.payment.updateMany.mockResolvedValue({ count: 1 });
    dbMock.payment.findFirst.mockResolvedValue({ plan: "Basic Plus" });

    await POST(signedRequest(event("payment.refunded", refundEntity)));

    expect(dbMock.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user_1", status: "CAPTURED" } })
    );
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: expect.objectContaining({ plan: "BASIC_PLUS", credits: 2500, planExpiresAt: expect.any(Date) }),
    });
  });

  it("is idempotent — a redelivered refund does not re-run the downgrade", async () => {
    dbMock.payment.findUnique.mockResolvedValue({
      id: "p1", userId: "user_1", plan: "Pro", promoCode: null, status: "REFUNDED",
    });
    dbMock.payment.updateMany.mockResolvedValue({ count: 0 });

    await POST(signedRequest(event("refund.processed", refundEntity)));

    expect(dbMock.user.update).not.toHaveBeenCalled();
    expect(dbMock.payment.findFirst).not.toHaveBeenCalled();
  });

  it("leaves the plan in place for a partial refund", async () => {
    dbMock.payment.findUnique.mockResolvedValue({
      id: "p1", userId: "user_1", plan: "Pro", promoCode: null, status: "CAPTURED",
    });

    await POST(
      signedRequest(
        event("refund.processed", { ...CAPTURED, refund_status: "partial", amount_refunded: 50000 })
      )
    );

    expect(dbMock.payment.updateMany).not.toHaveBeenCalled();
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("treats a fully refunded amount with no refund_status as a full refund", async () => {
    dbMock.payment.findUnique.mockResolvedValue({
      id: "p1", userId: "user_1", plan: "Pro", promoCode: null, status: "CAPTURED",
    });
    dbMock.payment.updateMany.mockResolvedValue({ count: 1 });
    dbMock.payment.findFirst.mockResolvedValue(null);

    await POST(
      signedRequest(
        event("refund.processed", { id: "pay_1", order_id: "order_1", amount: 199900, amount_refunded: 199900 })
      )
    );

    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { plan: "FREE", credits: 100, planExpiresAt: null },
    });
  });

  it("does nothing when the refunded order has no local payment row", async () => {
    dbMock.payment.findUnique.mockResolvedValue(null);

    const res = await POST(signedRequest(event("refund.processed", refundEntity)));

    expect(res.status).toBe(200);
    expect(dbMock.payment.updateMany).not.toHaveBeenCalled();
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });
});

describe("Razorpay webhook — payment.failed", () => {
  it("only flips PENDING rows to FAILED and never touches the plan", async () => {
    dbMock.payment.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(signedRequest(event("payment.failed", CAPTURED)));

    expect(res.status).toBe(200);
    expect(dbMock.payment.updateMany).toHaveBeenCalledWith({
      where: { razorpayOrderId: "order_1", status: "PENDING" },
      data: { status: "FAILED" },
    });
    expect(dbMock.user.update).not.toHaveBeenCalled();
    expect(dbMock.$executeRaw).not.toHaveBeenCalled();
  });
});
