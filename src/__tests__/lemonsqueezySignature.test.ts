import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import crypto from "crypto";

// `verifyLSWebhookSignature` is the only gate on the endpoint that grants export
// entitlements, so it has to reject every malformed shape rather than throwing
// (an exception would surface as a 500 and make Lemon Squeezy retry forever) and
// rather than truncating (Buffer.from silently drops invalid hex).

const SECRET = "ls_whsec_test";

type Verify = typeof import("../lib/lemonsqueezy").verifyLSWebhookSignature;
let verifyLSWebhookSignature: Verify;

const BODY = JSON.stringify({ meta: { event_name: "order_created" }, data: { id: "1" } });

function sign(body: string, secret = SECRET): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

beforeAll(async () => {
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = SECRET;
  verifyLSWebhookSignature = (await import("../lib/lemonsqueezy")).verifyLSWebhookSignature;
});

afterAll(() => {
  delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
});

describe("verifyLSWebhookSignature", () => {
  it("accepts a signature produced with the configured secret", () => {
    expect(verifyLSWebhookSignature(BODY, sign(BODY))).toBe(true);
  });

  it("accepts an upper-case hex digest", () => {
    expect(verifyLSWebhookSignature(BODY, sign(BODY).toUpperCase())).toBe(true);
  });

  it("rejects a signature made with a different secret", () => {
    expect(verifyLSWebhookSignature(BODY, sign(BODY, "not_the_secret"))).toBe(false);
  });

  it("rejects a valid signature for a different body", () => {
    const otherBody = JSON.stringify({ meta: { event_name: "order_created" }, data: { id: "2" } });

    expect(verifyLSWebhookSignature(BODY, sign(otherBody))).toBe(false);
  });

  it("rejects a digest with a single flipped character", () => {
    const valid = sign(BODY);
    const forged = valid.slice(0, -1) + (valid.endsWith("a") ? "b" : "a");

    expect(forged).not.toBe(valid);
    expect(verifyLSWebhookSignature(BODY, forged)).toBe(false);
  });

  it("rejects a truncated digest rather than comparing a prefix", () => {
    // Buffer.from("<63 hex chars>", "hex") silently drops the odd nibble, so a
    // length check has to happen before the bytes are compared.
    expect(verifyLSWebhookSignature(BODY, sign(BODY).slice(0, 63))).toBe(false);
    expect(verifyLSWebhookSignature(BODY, sign(BODY).slice(0, 32))).toBe(false);
  });

  it("rejects an over-long digest", () => {
    expect(verifyLSWebhookSignature(BODY, sign(BODY) + "00")).toBe(false);
  });

  it("rejects non-hex characters even at the right length", () => {
    // "zz…" is 64 characters but decodes to an empty buffer.
    expect(verifyLSWebhookSignature(BODY, "z".repeat(64))).toBe(false);
    expect(verifyLSWebhookSignature(BODY, sign(BODY).slice(0, 62) + "zz")).toBe(false);
  });

  it("rejects a base64 rendering of the correct digest", () => {
    const b64 = crypto.createHmac("sha256", SECRET).update(BODY).digest("base64");

    expect(verifyLSWebhookSignature(BODY, b64)).toBe(false);
  });

  it("rejects an empty or whitespace signature", () => {
    expect(verifyLSWebhookSignature(BODY, "")).toBe(false);
    expect(verifyLSWebhookSignature(BODY, "   ")).toBe(false);
  });

  it("rejects a signature with surrounding whitespace", () => {
    expect(verifyLSWebhookSignature(BODY, ` ${sign(BODY)} `)).toBe(false);
  });

  it("does not throw on hostile input", () => {
    for (const bad of ["\0", "0x" + sign(BODY), "%s", "../../etc/passwd", "null"]) {
      expect(() => verifyLSWebhookSignature(BODY, bad)).not.toThrow();
      expect(verifyLSWebhookSignature(BODY, bad)).toBe(false);
    }
  });

  it("fails closed when no webhook secret is configured", async () => {
    delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    vi.resetModules();
    const { verifyLSWebhookSignature: unconfigured } = await import("../lib/lemonsqueezy");

    // Even a structurally perfect digest must not pass without a configured secret,
    // and an empty HMAC key must never be treated as "any signature is fine".
    expect(unconfigured(BODY, "a".repeat(64))).toBe(false);
    expect(unconfigured(BODY, crypto.createHmac("sha256", "").update(BODY).digest("hex"))).toBe(false);

    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = SECRET;
    vi.resetModules();
  });
});
