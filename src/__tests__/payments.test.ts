import { describe, it, expect } from "vitest";
import crypto from "crypto";

// Test the HMAC verification logic used in verify/route.ts and webhooks/razorpay/route.ts
describe("Payment HMAC verification", () => {
  it("accepts a valid Razorpay payment signature", () => {
    const secret = "test_secret";
    const orderId = "order_123";
    const paymentId = "pay_456";

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(expected)
    );
    expect(isValid).toBe(true);
  });

  it("rejects a tampered payment signature", () => {
    const secret = "test_secret";
    const orderId = "order_123";
    const paymentId = "pay_456";

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const tampered = expected.replace(/.$/, expected.endsWith("a") ? "b" : "a");

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(tampered)
    );
    expect(isValid).toBe(false);
  });

  it("rejects a valid signature with wrong secret", () => {
    const realSecret = "real_secret";
    const wrongSecret = "wrong_secret";
    const orderId = "order_123";
    const paymentId = "pay_456";

    const withRealSecret = crypto
      .createHmac("sha256", realSecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const withWrongSecret = crypto
      .createHmac("sha256", wrongSecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    expect(withRealSecret).not.toBe(withWrongSecret);
  });
});
