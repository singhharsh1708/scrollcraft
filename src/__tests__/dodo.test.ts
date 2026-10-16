import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";
import { breakFakeRedis, peek, peekHash, putHash, resetFakeRedis } from "./stubs/fakeRedis";

vi.mock("server-only", () => ({}));
vi.mock("@upstash/redis", async () => {
  const { FakeRedis } = await import("./stubs/fakeRedis");
  return { Redis: FakeRedis };
});

const accountIdentityMock = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ accountIdentity: accountIdentityMock, authConfigured: () => true }));

const rateLimitMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "203.0.113.7" }));

const SECRET = "whsec_" + Buffer.from("dodo-test-signing-key-0123456789").toString("base64");
const ACCOUNT = "gh:583231";
const entitlement = `sc_ent:${ACCOUNT}`;
const NOW = 1_800_000_000_000;

function sign(raw: string, { secret = SECRET, at = NOW, id = "msg_1", extra = "" } = {}) {
  const timestamp = String(Math.floor(at / 1000));
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const v1 = createHmac("sha256", key).update(`${id}.${timestamp}.${raw}`).digest("base64");
  return { id, timestamp, signature: `v1,${v1}${extra}` };
}

type Webhook = typeof import("../app/api/dodo/webhook/route").POST;
type Checkout = typeof import("../app/api/checkout/route").POST;
let webhook: Webhook;
let checkout: Checkout;
let dodo: typeof import("../lib/dodo");

function deliver(event: unknown, headers?: { id: string; timestamp: string; signature: string } | null) {
  const raw = typeof event === "string" ? event : JSON.stringify(event);
  const h: Record<string, string> = { "content-type": "application/json" };
  const s = headers === undefined ? sign(raw) : headers;
  if (s) {
    h["webhook-id"] = s.id;
    h["webhook-timestamp"] = s.timestamp;
    h["webhook-signature"] = s.signature;
  }
  return webhook(
    new Request("https://scrollcraft.space/api/dodo/webhook", { method: "POST", headers: h, body: raw }) as unknown as NextRequest
  );
}

const paid = (over: Record<string, unknown> = {}) => ({
  business_id: "bus_1",
  type: "payment.succeeded",
  timestamp: "2027-01-15T08:00:00Z",
  data: {
    payload_type: "Payment",
    payment_id: "pay_1",
    status: "succeeded",
    total_amount: 2000,
    currency: "USD",
    metadata: { identity: ACCOUNT },
    customer: { email: "buyer@example.com", name: "A Buyer" },
    ...over,
  },
});

const refund = (over: Record<string, unknown> = {}) => ({
  business_id: "bus_1",
  type: "refund.succeeded",
  timestamp: "2027-01-16T08:00:00Z",
  data: { payload_type: "Refund", refund_id: "ref_1", payment_id: "pay_1", is_partial: false, status: "succeeded", ...over },
});

async function load() {
  vi.resetModules();
  dodo = await import("../lib/dodo");
  ({ POST: webhook } = await import("../app/api/dodo/webhook/route"));
  ({ POST: checkout } = await import("../app/api/checkout/route"));
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  resetFakeRedis();
  rateLimitMock.mockResolvedValue({ allowed: true });
  accountIdentityMock.mockResolvedValue(ACCOUNT);
  vi.stubEnv("DODO_PAYMENTS_API_KEY", "dodo_test_key_abc");
  vi.stubEnv("DODO_PAYMENTS_WEBHOOK_KEY", SECRET);
  vi.stubEnv("DODO_PAYMENTS_ENVIRONMENT", "");
  vi.stubEnv("DODO_PRODUCT_ID", "pdt_pack");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
  vi.stubEnv("KV_REST_API_URL", "");
  vi.stubEnv("KV_REST_API_TOKEN", "");
  await load();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("a delivery is only believed if Dodo signed it, recently", () => {
  const raw = JSON.stringify(paid());

  it("accepts the signature Dodo would send", () => {
    expect(dodo.signedByDodo(raw, sign(raw), SECRET, NOW)).toBe(true);
  });

  it.each([
    ["no headers at all", { id: null, timestamp: null, signature: null }],
    ["a signature made with another secret", sign(raw, { secret: "whsec_" + Buffer.from("somebody-else").toString("base64") })],
    ["a signature of a different body", sign(JSON.stringify(paid({ payment_id: "pay_2" })))],
    ["a signature for another message id", { ...sign(raw), id: "msg_2" }],
    ["a timestamp that is not a number", { ...sign(raw), timestamp: "soon" }],
    ["a signature with no version", { ...sign(raw), signature: sign(raw).signature.slice(3) }],
    ["a short signature", { ...sign(raw), signature: "v1,YWJj" }],
  ])("refuses %s", (_name, headers) => {
    expect(dodo.signedByDodo(raw, headers, SECRET, NOW)).toBe(false);
  });

  it("refuses a real delivery replayed after the window has closed", () => {
    expect(dodo.signedByDodo(raw, sign(raw, { at: NOW - 6 * 60_000 }), SECRET, NOW)).toBe(false);
    expect(dodo.signedByDodo(raw, sign(raw, { at: NOW - 4 * 60_000 }), SECRET, NOW)).toBe(true);
  });

  it("refuses one dated in the future by more than the window", () => {
    expect(dodo.signedByDodo(raw, sign(raw, { at: NOW + 6 * 60_000 }), SECRET, NOW)).toBe(false);
  });

  it("accepts when any one of several signatures matches, which is how a secret is rotated", () => {
    const rotated = sign(raw, { extra: ` v1,${Buffer.alloc(32).toString("base64")}` });
    expect(dodo.signedByDodo(raw, rotated, SECRET, NOW)).toBe(true);
  });
});

describe("the webhook refuses before it reads", () => {
  it("answers 503 when no secret is configured", async () => {
    vi.stubEnv("DODO_PAYMENTS_WEBHOOK_KEY", "");
    await load();
    expect((await deliver(paid())).status).toBe(503);
    expect(peekHash(entitlement)).toEqual({});
  });

  it("answers 400 to a bad signature and never parses the body", async () => {
    const parse = vi.spyOn(JSON, "parse");
    const res = await deliver(paid(), { id: "msg_1", timestamp: String(NOW / 1000), signature: "v1,AAAA" });
    expect(res.status).toBe(400);
    expect(parse).not.toHaveBeenCalled();
    parse.mockRestore();
  });

  it("answers 400 to an unsigned delivery", async () => {
    expect((await deliver(paid(), null)).status).toBe(400);
  });

  it("answers 400 to something signed that is not JSON", async () => {
    expect((await deliver("not json at all")).status).toBe(400);
  });
});

describe("a payment becomes five sites on the account that paid", () => {
  it("grants a pack to the account in the metadata", async () => {
    const res = await deliver(paid());
    expect(await res.json()).toEqual({ ok: true, result: "granted" });
    expect(peekHash(entitlement)).toMatchObject({ total: 5 });
  });

  it("grants five, not ten, when Dodo delivers the same payment twice", async () => {
    await deliver(paid());
    const again = await deliver(paid());
    expect(await again.json()).toEqual({ ok: true, result: "already" });
    expect(peekHash(entitlement)).toMatchObject({ total: 5 });
  });

  it("adds a second pack for a second payment", async () => {
    await deliver(paid());
    await deliver(paid({ payment_id: "pay_2" }));
    expect(peekHash(entitlement)).toMatchObject({ total: 10 });
  });

  it("keeps no email or name from the payload", async () => {
    await deliver(paid());
    const kept = JSON.stringify(peek(entitlement));
    expect(kept).not.toContain("buyer@example.com");
    expect(kept).not.toContain("A Buyer");
  });

  it("answers 500 so Dodo retries when the store is down", async () => {
    breakFakeRedis();
    expect((await deliver(paid())).status).toBe(500);
  });
});

describe("credits are never handed out for a payment that did not happen", () => {
  it("ignores a payment whose status is not succeeded", async () => {
    const res = await deliver(paid({ status: "processing" }));
    expect(await res.json()).toEqual({ ok: true, ignored: "unpaid" });
    expect(peekHash(entitlement)).toEqual({});
  });

  it("ignores a failed payment", async () => {
    const res = await deliver({ ...paid({ status: "failed" }), type: "payment.failed" });
    expect(await res.json()).toEqual({ ok: true, ignored: "payment.failed" });
    expect(peekHash(entitlement)).toEqual({});
  });

  it.each([
    ["no metadata at all", { metadata: undefined }],
    ["an empty identity", { metadata: { identity: "" } }],
    ["a username instead of an account number", { metadata: { identity: "gh:octocat" } }],
    ["a licence key hash, which is not an account", { metadata: { identity: "a".repeat(64) } }],
    ["an identity that is not a string", { metadata: { identity: 583231 } }],
    ["no payment id", { payment_id: undefined }],
  ])("refuses a payment carrying %s", async (_name, over) => {
    const res = await deliver(paid(over));
    expect(res.status).toBe(422);
    expect(peekHash(entitlement)).toEqual({});
  });
});

describe("a refund takes the unused part of the pack back, once", () => {
  it("removes the pack on a full refund", async () => {
    await deliver(paid());
    const res = await deliver(refund());
    expect(await res.json()).toEqual({ ok: true, result: "revoked" });
    expect(peekHash(entitlement)).toMatchObject({ total: 0 });
  });

  it("leaves the sites already written paid for", async () => {
    await deliver(paid());
    putHash(entitlement, { used: 3 });
    await deliver(refund());
    expect(peekHash(entitlement)).toMatchObject({ total: 3, used: 3 });
  });

  it("costs one pack however many times the refund is delivered", async () => {
    await deliver(paid());
    await deliver(paid({ payment_id: "pay_2" }));
    await deliver(refund());
    const again = await deliver(refund());
    expect(await again.json()).toEqual({ ok: true, result: "already" });
    expect(peekHash(entitlement)).toMatchObject({ total: 5 });
  });

  it("leaves the pack alone on a partial refund", async () => {
    await deliver(paid());
    const res = await deliver(refund({ is_partial: true, amount: 800 }));
    expect(await res.json()).toEqual({ ok: true, ignored: "partial-refund" });
    expect(peekHash(entitlement)).toMatchObject({ total: 5 });
  });
});

describe("a checkout through Dodo", () => {
  const request = () => new Request("https://scrollcraft.space/api/checkout", { method: "POST" }) as unknown as NextRequest;
  const PRODUCT = { product_id: "pdt_pack", price: { type: "one_time_price", price: 2000, currency: "USD" } };
  const SESSION = { session_id: "cks_1", checkout_url: "https://test.checkout.dodopayments.com/session/cks_1" };

  function dodoAnswers(...answers: unknown[]) {
    const fetchMock = vi.fn();
    for (const answer of answers) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(answer), { status: 200 }));
    }
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("answers 503 when neither Dodo nor Stripe is configured", async () => {
    vi.stubEnv("DODO_PAYMENTS_API_KEY", "");
    await load();
    const fetchMock = dodoAnswers();
    expect((await checkout(request())).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks a visitor who is not signed in to sign in, and opens nothing", async () => {
    accountIdentityMock.mockResolvedValue(null);
    const fetchMock = dodoAnswers();
    const res = await checkout(request());
    expect(res.status).toBe(401);
    expect((await res.json()).needsSignIn).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens a test mode session that carries the account, and returns Dodo's address", async () => {
    const fetchMock = dodoAnswers(PRODUCT, SESSION);
    const res = await checkout(request());
    expect(await res.json()).toEqual({ url: SESSION.checkout_url });

    expect(String(fetchMock.mock.calls[0][0])).toBe("https://test.dodopayments.com/products/pdt_pack");
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toBe("https://test.dodopayments.com/checkouts");
    const sent = JSON.parse(String(init.body));
    expect(sent.product_cart).toEqual([{ product_id: "pdt_pack", quantity: 1 }]);
    expect(sent.metadata).toEqual({ identity: ACCOUNT });
    expect(sent.return_url).toMatch(/\/pricing\?bought=1$/);
  });

  it("talks to the live host only when told to", async () => {
    vi.stubEnv("DODO_PAYMENTS_ENVIRONMENT", "live_mode");
    await load();
    const fetchMock = dodoAnswers(PRODUCT, SESSION);
    await checkout(request());
    expect(String(fetchMock.mock.calls[1][0])).toBe("https://live.dodopayments.com/checkouts");
  });

  it("is used over Stripe when both are configured", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_abc");
    await load();
    const fetchMock = dodoAnswers(PRODUCT, SESSION);
    await checkout(request());
    expect(String(fetchMock.mock.calls[1][0])).toBe("https://test.dodopayments.com/checkouts");
  });

  it.each([
    ["a different amount", { price: { type: "one_time_price", price: 4900, currency: "USD" } }],
    ["a different currency", { price: { type: "one_time_price", price: 2000, currency: "INR" } }],
    ["a subscription", { price: { type: "recurring_price", price: 2000, currency: "USD" } }],
  ])("will not charge a product priced at %s", async (_name, product) => {
    const fetchMock = dodoAnswers(product);
    expect((await checkout(request())).status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("answers 502 when Dodo refuses the key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    expect((await checkout(request())).status).toBe(502);
  });

  it("does not put the API key anywhere a buyer can read", async () => {
    dodoAnswers(PRODUCT, SESSION);
    const res = await checkout(request());
    const text = JSON.stringify(await res.json()) + JSON.stringify([...res.headers.entries()]);
    expect(text).not.toContain("dodo_test_key_abc");
  });
});
