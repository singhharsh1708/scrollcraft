import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";
import { breakFakeRedis, peek, peekHash, putHash, resetFakeRedis } from "./stubs/fakeRedis";

/**
 * Stripe is where a stranger's card becomes credits on somebody's account, so there are
 * exactly three things that must never happen: credits for a payment that was not made,
 * credits on the wrong account, and two packs for one payment. Each has tests below, and
 * each was checked to fail when its guard is taken out.
 */

vi.mock("server-only", () => ({}));
vi.mock("@upstash/redis", async () => {
  const { FakeRedis } = await import("./stubs/fakeRedis");
  return { Redis: FakeRedis };
});

const accountIdentityMock = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ accountIdentity: accountIdentityMock, authConfigured: () => true }));

const rateLimitMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "203.0.113.7" }));

const SECRET = "whsec_test_a7f3b1c9";
const ACCOUNT = "gh:583231";
const entitlement = `sc_ent:${ACCOUNT}`;
const NOW = 1_800_000_000_000;

function header(raw: string, { secret = SECRET, at = NOW, extra = "" } = {}): string {
  const t = Math.floor(at / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return `t=${t},v1=${v1}${extra}`;
}

type Webhook = typeof import("../app/api/stripe/webhook/route").POST;
type Checkout = typeof import("../app/api/checkout/route").POST;
let webhook: Webhook;
let checkout: Checkout;
let stripe: typeof import("../lib/stripe");

function deliver(event: unknown, signature?: string | null) {
  const raw = typeof event === "string" ? event : JSON.stringify(event);
  const headers: Record<string, string> = { "content-type": "application/json" };
  const value = signature === undefined ? header(raw) : signature;
  if (value !== null) headers["stripe-signature"] = value;
  return webhook(
    new Request("https://scrollcraft.space/api/stripe/webhook", { method: "POST", headers, body: raw }) as unknown as NextRequest
  );
}

const paid = (over: Record<string, unknown> = {}, livemode = false) => ({
  type: "checkout.session.completed",
  livemode,
  data: {
    object: {
      id: "cs_test_1",
      payment_status: "paid",
      payment_intent: "pi_1",
      metadata: { identity: ACCOUNT },
      ...over,
    },
  },
});

const refund = (over: Record<string, unknown> = {}) => ({
  type: "charge.refunded",
  livemode: false,
  data: { object: { id: "ch_1", payment_intent: "pi_1", refunded: true, ...over } },
});

async function load() {
  vi.resetModules();
  stripe = await import("../lib/stripe");
  ({ POST: webhook } = await import("../app/api/stripe/webhook/route"));
  ({ POST: checkout } = await import("../app/api/checkout/route"));
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  resetFakeRedis();
  rateLimitMock.mockResolvedValue({ allowed: true });
  accountIdentityMock.mockResolvedValue(ACCOUNT);
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_abc");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("STRIPE_PRICE_ID", "");
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

describe("a delivery is only believed if Stripe signed it, recently", () => {
  const raw = JSON.stringify(paid());

  it("accepts the signature Stripe would send", () => {
    expect(stripe.signedByStripe(raw, header(raw), SECRET, NOW)).toBe(true);
  });

  it.each([
    ["no header at all", null],
    ["an empty header", ""],
    ["a signature made with another secret", header(raw, { secret: "whsec_somebody_else" })],
    ["a signature of a different body", header(JSON.stringify(paid({ payment_intent: "pi_2" })))],
    ["a timestamp with no signature", `t=${Math.floor(NOW / 1000)}`],
    ["a signature with no timestamp", "v1=" + "a".repeat(64)],
    ["a timestamp that is not a number", `t=soon,v1=${"a".repeat(64)}`],
    ["a short signature", `t=${Math.floor(NOW / 1000)},v1=ab12`],
    ["a signature that is not hex", `t=${Math.floor(NOW / 1000)},v1=${"z".repeat(64)}`],
  ])("refuses %s", (_name, value) => {
    expect(stripe.signedByStripe(raw, value, SECRET, NOW)).toBe(false);
  });

  it("refuses a real delivery replayed after the window has closed", () => {
    // Correctly signed, and six minutes old. Without the timestamp check a captured
    // delivery could be sent again tomorrow.
    const old = header(raw, { at: NOW - 6 * 60_000 });
    expect(stripe.signedByStripe(raw, old, SECRET, NOW)).toBe(false);
    expect(stripe.signedByStripe(raw, header(raw, { at: NOW - 4 * 60_000 }), SECRET, NOW)).toBe(true);
  });

  it("refuses one dated in the future by more than the window", () => {
    expect(stripe.signedByStripe(raw, header(raw, { at: NOW + 6 * 60_000 }), SECRET, NOW)).toBe(false);
  });

  it("accepts when any one of several signatures matches, which is how a secret is rotated", () => {
    const rotated = header(raw, { extra: `,v1=${"0".repeat(64)}` });
    expect(stripe.signedByStripe(raw, rotated, SECRET, NOW)).toBe(true);
  });
});

describe("the webhook refuses before it reads", () => {
  it("answers 503 when no secret is configured, rather than trusting everything", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    await load();
    expect((await deliver(paid())).status).toBe(503);
    expect(peekHash(entitlement)).toEqual({});
  });

  it("answers 400 to a bad signature and never parses the body", async () => {
    const parse = vi.spyOn(JSON, "parse");
    const res = await deliver(paid(), "t=1,v1=" + "a".repeat(64));
    expect(res.status).toBe(400);
    expect(parse).not.toHaveBeenCalled();
    expect(peekHash(entitlement)).toEqual({});
    parse.mockRestore();
  });

  it("answers 400 to something signed that is not JSON", async () => {
    expect((await deliver("not json at all")).status).toBe(400);
  });
});

describe("a payment becomes five sites on the account that paid", () => {
  it("grants a pack to the account in the session's metadata", async () => {
    const res = await deliver(paid());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, result: "granted" });
    expect(peekHash(entitlement)).toMatchObject({ total: 5 });
  });

  it("grants five, not ten, when Stripe delivers the same payment twice", async () => {
    await deliver(paid());
    const again = await deliver(paid());
    expect(await again.json()).toEqual({ ok: true, result: "already" });
    expect(peekHash(entitlement)).toMatchObject({ total: 5 });
  });

  it("grants five, not ten, when both completion events arrive for one payment", async () => {
    // A delayed method sends completed and then async_payment_succeeded for the same
    // payment intent. They are one purchase.
    await deliver(paid());
    await deliver({ ...paid(), type: "checkout.session.async_payment_succeeded" });
    expect(peekHash(entitlement)).toMatchObject({ total: 5 });
  });

  it("adds a second pack for a second payment", async () => {
    await deliver(paid());
    await deliver(paid({ id: "cs_test_2", payment_intent: "pi_2" }));
    expect(peekHash(entitlement)).toMatchObject({ total: 10 });
  });

  it("keeps no email, name or address from the payload", async () => {
    await deliver(paid({ customer_details: { email: "buyer@example.com", name: "A Buyer" }, customer_email: "buyer@example.com" }));
    const kept = JSON.stringify(peek(entitlement));
    expect(kept).not.toContain("buyer@example.com");
    expect(kept).not.toContain("A Buyer");
  });
});

describe("credits are never handed out for a payment that did not happen", () => {
  it("leaves a session alone until the money has actually arrived", async () => {
    const res = await deliver(paid({ payment_status: "unpaid" }));
    expect(await res.json()).toEqual({ ok: true, ignored: "unpaid" });
    expect(peekHash(entitlement)).toEqual({});
  });

  it.each([
    ["no metadata at all", { metadata: undefined }],
    ["an empty identity", { metadata: { identity: "" } }],
    ["a username instead of an account number", { metadata: { identity: "gh:octocat" } }],
    ["a licence key hash, which is not an account", { metadata: { identity: "a".repeat(64) } }],
    ["somebody else's key namespace", { metadata: { identity: "sc_ent:gh:583231" } }],
    ["an identity that is not a string", { metadata: { identity: 583231 } }],
  ])("refuses a paid session carrying %s", async (_name, over) => {
    const res = await deliver(paid(over));
    expect(res.status).toBe(422);
    expect(peekHash(entitlement)).toEqual({});
  });

  it("ignores a test payment on a shop that takes real money", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_abc");
    await load();
    const res = await deliver(paid({}, false));
    expect(await res.json()).toEqual({ ok: true, ignored: "test-mode" });
    expect(peekHash(entitlement)).toEqual({});
  });

  it("honours a live payment on a shop that takes real money", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_abc");
    await load();
    await deliver(paid({}, true));
    expect(peekHash(entitlement)).toMatchObject({ total: 5 });
  });

  it("ignores events it has no business with", async () => {
    const res = await deliver({ type: "customer.created", livemode: false, data: { object: {} } });
    expect(await res.json()).toEqual({ ok: true, ignored: "customer.created" });
  });
});

describe("a purchase is not lost because the store was down", () => {
  it("answers 500 so Stripe delivers it again", async () => {
    breakFakeRedis();
    expect((await deliver(paid())).status).toBe(500);
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
    await deliver(paid({ id: "cs_test_2", payment_intent: "pi_2" }));
    await deliver(refund());
    const again = await deliver(refund());
    expect(await again.json()).toEqual({ ok: true, result: "already" });
    expect(peekHash(entitlement)).toMatchObject({ total: 5 });
  });

  it("leaves the pack alone on a partial refund, which the terms settle by hand", async () => {
    await deliver(paid());
    const res = await deliver(refund({ refunded: false, amount_refunded: 800 }));
    expect(await res.json()).toEqual({ ok: true, ignored: "partial-refund" });
    expect(peekHash(entitlement)).toMatchObject({ total: 5 });
  });
});

describe("a checkout can only be opened by somebody it can be credited to", () => {
  const request = () => new Request("https://scrollcraft.space/api/checkout", { method: "POST" }) as unknown as NextRequest;
  const PRICE = { data: [{ id: "price_123", unit_amount: 2000, currency: "usd" }] };

  function stripeAnswers(...answers: unknown[]) {
    const fetchMock = vi.fn();
    for (const answer of answers) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(answer), { status: 200 }));
    }
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("answers 503 with no key, and calls nobody", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    await load();
    const fetchMock = stripeAnswers();
    expect((await checkout(request())).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks a visitor who is not signed in to sign in, and opens nothing", async () => {
    accountIdentityMock.mockResolvedValue(null);
    const fetchMock = stripeAnswers();
    const res = await checkout(request());
    expect(res.status).toBe(401);
    expect((await res.json()).needsSignIn).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens a checkout that carries the account, and returns Stripe's address", async () => {
    const fetchMock = stripeAnswers(PRICE, { url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    const res = await checkout(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_test_1" });

    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toBe("https://api.stripe.com/v1/checkout/sessions");
    const sent = new URLSearchParams(String(init.body));
    expect(sent.get("mode")).toBe("payment");
    expect(sent.get("line_items[0][price]")).toBe("price_123");
    expect(sent.get("line_items[0][quantity]")).toBe("1");
    expect(sent.get("metadata[identity]")).toBe(ACCOUNT);
    // Stripe allows only letters, digits, dashes and underscores here.
    expect(sent.get("client_reference_id")).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(sent.get("success_url")).toMatch(/\/pricing\?bought=1$/);
  });

  it("will not charge a price that disagrees with the one the site quotes", async () => {
    const fetchMock = stripeAnswers({ data: [{ id: "price_wrong", unit_amount: 4900, currency: "usd" }] });
    const res = await checkout(request());
    expect(res.status).toBe(502);
    // The price was looked up and no session was opened against it.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("will not charge in a currency other than the one the site quotes", async () => {
    const fetchMock = stripeAnswers({ data: [{ id: "price_inr", unit_amount: 2000, currency: "inr" }] });
    expect((await checkout(request())).status).toBe(502);
    // Refused at the price, not by a later call falling over: no session was attempted.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("answers 502 when no price carries the lookup key", async () => {
    stripeAnswers({ data: [] });
    expect((await checkout(request())).status).toBe(502);
  });

  it("answers 429 when the allowance is spent, before asking who is signed in", async () => {
    rateLimitMock.mockResolvedValue({ allowed: false });
    const fetchMock = stripeAnswers();
    expect((await checkout(request())).status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rateLimitMock).toHaveBeenCalledWith("203.0.113.7", { bucket: "checkout", limit: 10, windowMs: 60_000 });
  });

  it("does not put the secret key anywhere a buyer can read", async () => {
    stripeAnswers(PRICE, { url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    const res = await checkout(request());
    const text = JSON.stringify(await res.json()) + JSON.stringify([...res.headers.entries()]);
    expect(text).not.toContain("sk_test_abc");
  });
});
