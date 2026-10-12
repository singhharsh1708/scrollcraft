import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";
import type { NextRequest } from "next/server";
import { breakFakeRedis, peek, peekHash, putHash, putKey, resetFakeRedis } from "./stubs/fakeRedis";

/**
 * The webhook is the only unauthenticated route in the app that hands out something worth
 * money, so the signature is the whole of its security. The tests below are the four ways
 * that goes wrong: a signature that is not checked properly, a body that is read before it
 * is checked, a delivery counted twice, and a purchase quietly dropped because the store
 * was down when it arrived.
 */

vi.mock("@upstash/redis", async () => {
  const { FakeRedis } = await import("./stubs/fakeRedis");
  return { Redis: FakeRedis };
});

const SECRET = "whsec_a7f3b1c9";
const KEY = "SCRL-7F2A-1C9D-4E88";
const HASH = createHash("sha256").update(KEY).digest("hex");
const entitlement = `sc_ent:${HASH}`;

type Handler = typeof import("../app/api/lemon/webhook/route").POST;
let POST: Handler;

function sign(raw: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(raw).digest("hex");
}

/** Signs whatever is sent, unless the test says otherwise with an explicit signature. */
function deliver(payload: unknown, signature?: string | null) {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  const headers: Record<string, string> = { "content-type": "application/json" };
  const value = signature === undefined ? sign(raw) : signature;
  if (value !== null) headers["x-signature"] = value;
  return POST(
    new Request("https://scrollcraft.space/api/lemon/webhook", {
      method: "POST",
      headers,
      body: raw,
    }) as unknown as NextRequest
  );
}

const licenceCreated = (over: Record<string, unknown> = {}) => ({
  meta: { event_name: "license_key_created" },
  data: {
    id: "lk_77",
    attributes: { key: KEY, order_id: 4242, user_email: "buyer@example.com", test_mode: false, ...over },
  },
});

const refunded = (orderId: string | number = 4242, over: Record<string, unknown> = {}) => ({
  meta: { event_name: "order_refunded" },
  data: { id: String(orderId), attributes: { test_mode: false, ...over } },
});

async function load() {
  vi.resetModules();
  ({ POST } = await import("../app/api/lemon/webhook/route"));
}

beforeEach(async () => {
  vi.clearAllMocks();
  resetFakeRedis();
  vi.stubEnv("LEMONSQUEEZY_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("LEMONSQUEEZY_ACCEPT_TEST_MODE", "");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
  vi.stubEnv("KV_REST_API_URL", "");
  vi.stubEnv("KV_REST_API_TOKEN", "");
  await load();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("nothing happens without the right signature", () => {
  const PAYLOAD = licenceCreated();
  const RAW = JSON.stringify(PAYLOAD);

  const bad: [string, string | null][] = [
    ["no header at all", null],
    ["an empty header", ""],
    ["a signature over a different body", sign(JSON.stringify(refunded()))],
    ["a signature made with another secret", sign(RAW, "whsec_someone_else")],
    ["a signature a few characters short", sign(RAW).slice(0, 62)],
    ["a signature one byte long", "ab"],
    ["something that is not hex at all", "not-a-signature"],
    ["hex with rubbish on the end", `${sign(RAW).slice(0, 62)}zz`],
    ["the word used as a bearer token", SECRET],
  ];

  it.each(bad)("answers 400 to %s", async (_name, signature) => {
    const res = await deliver(PAYLOAD, signature);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Bad signature.");
    // And, more to the point, nobody was given anything.
    expect(peek(entitlement)).toBeUndefined();
    expect(peek("sc_ord:4242")).toBeUndefined();
  });

  it("does not look at the body before the signature has been checked", async () => {
    const parse = vi.spyOn(JSON, "parse");
    const marker = "eyJtYXJrZXIiOiJ1bnBhcnNlZCJ9";
    const res = await deliver({ ...PAYLOAD, marker }, "deadbeef");
    expect(res.status).toBe(400);
    const parsed = parse.mock.calls.map(([text]) => String(text));
    expect(parsed.some((text) => text.includes(marker))).toBe(false);
  });

  it("accepts the signature it was given, so a real delivery is not turned away", async () => {
    const res = await deliver(PAYLOAD);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, result: "granted" });
  });
});

describe("a purchase is worth one pack, however many times it is delivered", () => {
  it("grants five sites on the first delivery and nothing on the second", async () => {
    expect(await (await deliver(licenceCreated())).json()).toEqual({ ok: true, result: "granted" });
    const second = await deliver(licenceCreated());
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true, result: "already" });
    expect(peekHash(entitlement).total).toBe(5);
  });

  it("keeps the key out of the store, and keeps only the hash of it", async () => {
    await deliver(licenceCreated());
    expect(JSON.stringify([...Object.entries(peekHash(entitlement))])).not.toContain(KEY);
    expect(peek("sc_ord:4242")).toBe(HASH);
    expect(peek("sc_ordkey:4242")).toBe(HASH);
  });

  it("ignores order_created, because the licence key is the identity and arrives separately", async () => {
    const res = await deliver({ meta: { event_name: "order_created" }, data: { id: "4242", attributes: { test_mode: false } } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ignored: "order_created" });
    expect(peek(entitlement)).toBeUndefined();
  });

  it("answers 422 to a licence event with no key or no order to tie it to", async () => {
    for (const attributes of [{ key: "" }, { key: KEY, order_id: undefined, id: undefined }]) {
      const payload = licenceCreated(attributes);
      if ("order_id" in attributes) payload.data.id = "";
      const res = await deliver(payload);
      expect(res.status, JSON.stringify(attributes)).toBe(422);
    }
    expect(peek(entitlement)).toBeUndefined();
  });

  it("answers 500 when there is no store, so Lemon Squeezy delivers it again", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    await load();
    const res = await deliver(licenceCreated());
    expect(res.status).toBe(500);
  });

  it("answers 503 with no secret configured, and reads no payload", async () => {
    vi.stubEnv("LEMONSQUEEZY_WEBHOOK_SECRET", "");
    await load();
    const res = await deliver(licenceCreated());
    expect(res.status).toBe(503);
    expect(peek(entitlement)).toBeUndefined();
  });

  it("refuses a body far larger than any real event", async () => {
    const raw = JSON.stringify({ meta: { event_name: "license_key_created" }, pad: "x".repeat(200_001) });
    const res = await deliver(raw);
    expect(res.status).toBe(413);
  });
});

describe("a test purchase does not buy real sites on the live site", () => {
  it("is ignored in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await load();
    const res = await deliver(licenceCreated({ test_mode: true }));
    expect(await res.json()).toEqual({ ok: true, ignored: "test-mode" });
    expect(peek(entitlement)).toBeUndefined();
  });

  it("is granted on a deployment that asked for test mode on purpose", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LEMONSQUEEZY_ACCEPT_TEST_MODE", "1");
    await load();
    expect(await (await deliver(licenceCreated({ test_mode: true }))).json()).toEqual({ ok: true, result: "granted" });
  });

  it("is granted away from production, which is how the flow gets tested at all", async () => {
    expect(await (await deliver(licenceCreated({ test_mode: true }))).json()).toEqual({ ok: true, result: "granted" });
    expect(peekHash(entitlement).total).toBe(5);
  });

  it("ignores a refunded test order too, rather than revoking a real pack", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await load();
    // A real pack, bought and paid for, sitting under the same order number.
    putHash(entitlement, { total: 5, used: 0 });
    putKey("sc_ordkey:4242", HASH);
    const res = await deliver(refunded(4242, { test_mode: true }));
    expect(await res.json()).toEqual({ ok: true, ignored: "test-mode" });
    expect(peekHash(entitlement).total).toBe(5);
  });
});

describe("a refund takes the pack back", () => {
  it("removes the unused part of the pack the order paid for", async () => {
    await deliver(licenceCreated());
    const res = await deliver(refunded(4242));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, result: "revoked" });
    expect(peekHash(entitlement).total).toBe(0);
  });

  it("leaves the sites already written paid for", async () => {
    await deliver(licenceCreated());
    putHash(entitlement, { used: 2 });
    await deliver(refunded(4242));
    expect(peekHash(entitlement)).toMatchObject({ total: 2, used: 2 });
  });

  it("answers 200 for an order it never recorded, so Lemon Squeezy stops retrying", async () => {
    const res = await deliver(refunded(999));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, result: "unknown" });
  });

  it("answers 500 when there is no store to record it in", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    await load();
    expect((await deliver(refunded(4242))).status).toBe(500);
  });
});

describe("anything else is acknowledged and dropped", () => {
  it("names the event it ignored, and ignores an unnamed one", async () => {
    expect(await (await deliver({ meta: { event_name: "subscription_created" }, data: {} })).json()).toEqual({
      ok: true,
      ignored: "subscription_created",
    });
    expect(await (await deliver({ data: {} })).json()).toEqual({ ok: true, ignored: "unnamed" });
  });

  it("answers 400 to a correctly signed body that is not JSON", async () => {
    const res = await deliver("{not json");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Expected JSON.");
  });
});

describe("a store that cannot be reached asks for the delivery again", () => {
  it("answers 500 to a purchase, because the money is taken and the credits are not given", async () => {
    breakFakeRedis();
    const res = await deliver(licenceCreated());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/Could not record/);
  });

  it("answers 500 to a refund rather than reporting a revocation that did not happen", async () => {
    putKey("sc_ordkey:4242", HASH);
    breakFakeRedis();
    expect((await deliver(refunded(4242))).status).toBe(500);
  });

  it("still refuses a bad signature while the store is down", async () => {
    breakFakeRedis();
    expect((await deliver(licenceCreated(), "deadbeef")).status).toBe(400);
  });
});
