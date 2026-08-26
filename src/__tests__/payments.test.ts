import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import type { NextRequest } from "next/server";

// The signature check in POST /api/payments/verify compares buffer lengths before it
// calls timingSafeEqual, because timingSafeEqual THROWS on a length mismatch. Without
// that guard a caller sending a short or non-hex signature gets a 500 out of the catch
// block instead of a 400, which reads as a server fault rather than a rejected payment.
// These exercise the real route; the HMAC primitive itself is Node's, not ours, to test.

const dbMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  payment: { findUnique: vi.fn(), updateMany: vi.fn() },
}));
const authMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));

const KEY_SECRET = "rzp_secret";

type Verify = typeof import("../app/api/payments/verify/route").POST;
let verify: Verify;

function req(body: unknown): NextRequest {
  return new Request("https://scrollcraft.app/api/payments/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const ORDER = "order_123";
const PAYMENT = "pay_456";

function validSignature(secret = KEY_SECRET): string {
  return crypto.createHmac("sha256", secret).update(`${ORDER}|${PAYMENT}`).digest("hex");
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
  rateLimitMock.mockResolvedValue({ allowed: true });
  authMock.mockResolvedValue({ user: { email: "a@b.c" } });
  dbMock.user.findUnique.mockResolvedValue({ id: "u1" });
  ({ POST: verify } = await import("../app/api/payments/verify/route"));
});

afterEach(() => {
  delete process.env.RAZORPAY_KEY_SECRET;
});

describe("POST /api/payments/verify — signature handling", () => {
  it("400s a signature that is too short to compare, without reaching the payment row", async () => {
    // A length mismatch is exactly the case that makes timingSafeEqual throw.
    const res = await verify(req({ orderId: ORDER, paymentId: PAYMENT, signature: "abcd" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid payment signature" });
    expect(dbMock.payment.findUnique).not.toHaveBeenCalled();
  });

  it("400s a non-hex signature rather than throwing a 500", async () => {
    const res = await verify(req({
      orderId: ORDER, paymentId: PAYMENT, signature: "zzzz not hex at all zzzz",
    }));
    expect(res.status).toBe(400);
    expect(dbMock.payment.findUnique).not.toHaveBeenCalled();
  });

  it("400s a signature of the right length signed with the wrong secret", async () => {
    const res = await verify(req({
      orderId: ORDER, paymentId: PAYMENT, signature: validSignature("wrong_secret"),
    }));
    expect(res.status).toBe(400);
    expect(dbMock.payment.findUnique).not.toHaveBeenCalled();
  });

  it("400s a signature bound to a different order", async () => {
    const otherOrder = crypto
      .createHmac("sha256", KEY_SECRET)
      .update(`order_999|${PAYMENT}`)
      .digest("hex");
    const res = await verify(req({ orderId: ORDER, paymentId: PAYMENT, signature: otherOrder }));
    expect(res.status).toBe(400);
    expect(dbMock.payment.findUnique).not.toHaveBeenCalled();
  });

  it("400s a missing signature", async () => {
    const res = await verify(req({ orderId: ORDER, paymentId: PAYMENT }));
    expect(res.status).toBe(400);
    expect(dbMock.payment.findUnique).not.toHaveBeenCalled();
  });

  it("accepts a correctly signed request and goes on to look up the order", async () => {
    dbMock.payment.findUnique.mockResolvedValue(null);
    const res = await verify(req({ orderId: ORDER, paymentId: PAYMENT, signature: validSignature() }));
    // 404 (no such order) proves the signature passed and the route moved on.
    expect(res.status).toBe(404);
    expect(dbMock.payment.findUnique).toHaveBeenCalledWith({ where: { razorpayOrderId: ORDER } });
  });

  it("503s when the gateway secret is unset, before any signature work", async () => {
    delete process.env.RAZORPAY_KEY_SECRET;
    vi.resetModules();
    ({ POST: verify } = await import("../app/api/payments/verify/route"));
    const res = await verify(req({ orderId: ORDER, paymentId: PAYMENT, signature: "x" }));
    expect(res.status).toBe(503);
  });
});
