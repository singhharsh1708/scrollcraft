import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { breakFakeRedis, peek, peekHash, putHash, resetFakeRedis } from "./stubs/fakeRedis";

/**
 * Redeeming a licence key. The route decides, from a string somebody pasted, whether a
 * browser may spend credits, and it has to do that without ever storing the key and
 * without letting a Lemon Squeezy outage lock out somebody who has already paid.
 *
 * The cases that matter: a key this deployment already knows must not need the network at
 * all, a key whose webhook was lost must still produce the pack it paid for, and the
 * cookie that comes back must be one the page's own JavaScript cannot read.
 */

const rateLimitMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));
vi.mock("@upstash/redis", async () => {
  const { FakeRedis } = await import("./stubs/fakeRedis");
  return { Redis: FakeRedis };
});

const KEY = "SCRL-7F2A-1C9D-4E88";
const HASH = createHash("sha256").update(KEY).digest("hex");
const COOKIE = "sc_key";
const entitlement = `sc_ent:${HASH}`;

type Route = typeof import("../app/api/credits/route");
let route: Route;
const fetchMock = vi.fn();

function post(body: unknown, headers: Record<string, string> = {}) {
  return route.POST(
    new Request("https://scrollcraft.space/api/credits", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }) as unknown as NextRequest
  );
}

function get(cookie?: string) {
  return route.GET(
    new Request("https://scrollcraft.space/api/credits", {
      headers: cookie ? { cookie } : {},
    }) as unknown as NextRequest
  );
}

/** What Lemon Squeezy answers for a key that is real. */
const validKey = (over: Record<string, unknown> = {}) => ({
  valid: true,
  error: null,
  license_key: { status: "active" },
  meta: { order_id: 4242, customer_email: "buyer@example.com" },
  ...over,
});

function answering(body: unknown) {
  fetchMock.mockResolvedValue({ json: async () => body } as unknown as Response);
}

async function load() {
  vi.resetModules();
  route = await import("../app/api/credits/route");
}

beforeEach(async () => {
  vi.clearAllMocks();
  resetFakeRedis();
  rateLimitMock.mockResolvedValue({ allowed: true });
  answering(validKey());
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
  vi.stubEnv("KV_REST_API_URL", "");
  vi.stubEnv("KV_REST_API_TOKEN", "");
  await load();
});

describe("the balance says what this browser may write", () => {
  it("reports the free site and the pack price to a browser with no key", async () => {
    const body = await (await get()).json();
    expect(body).toEqual({ free: 2, pack: 5, hasKey: false, remaining: 0, total: 0, signedIn: false, canSignIn: false, canBuy: false });
  });

  it("reads the balance of the key the cookie carries", async () => {
    putHash(entitlement, { total: 10, used: 3 });
    expect(await (await get(`${COOKIE}=${HASH}`)).json()).toEqual({
      free: 2,
      pack: 5,
      hasKey: true,
      remaining: 7,
      total: 10,
      signedIn: false,
      canSignIn: false,
      canBuy: false,
    });
  });

  it("treats a cookie that is not a key hash as no key, rather than looking it up", async () => {
    putHash(entitlement, { total: 10, used: 0 });
    const body = await (await get(`${COOKIE}=${HASH.toUpperCase()}`)).json();
    expect(body).toMatchObject({ hasKey: false, remaining: 0, total: 0 });
  });

  it("says a key is held even when its pack has been spent", async () => {
    putHash(entitlement, { total: 5, used: 5 });
    expect(await (await get(`${COOKIE}=${HASH}`)).json()).toMatchObject({ hasKey: true, remaining: 0, total: 5 });
  });
});

describe("a key this deployment already knows needs no network call", () => {
  it("answers from the store, so an outage cannot lock a buyer out", async () => {
    putHash(entitlement, { total: 5, used: 2 });
    const res = await post({ key: KEY });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, remaining: 3, total: 5 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still asks Lemon Squeezy about a key whose row exists but bought nothing", async () => {
    putHash(entitlement, { total: 0, used: 0 });
    await post({ key: KEY });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("a key whose webhook never arrived still produces the pack it paid for", () => {
  it("grants from the order id in the validation answer", async () => {
    const res = await post({ key: KEY });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, remaining: 5, total: 5 });
    expect(peekHash(entitlement).total).toBe(5);
  });

  it("records the order, so the late webhook adds nothing on top", async () => {
    await post({ key: KEY });
    expect(peek("sc_ord:4242")).toBe(HASH);
    const credits = await import("../lib/credits");
    expect(await credits.grantPack(HASH, "4242")).toBe("already");
    expect(peekHash(entitlement).total).toBe(5);
  });

  it("checks the key at the validate endpoint, sending the key and nothing else", async () => {
    await post({ key: `  ${KEY}  ` });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.lemonsqueezy.com/v1/licenses/validate");
    expect(init.method).toBe("POST");
    expect(String(init.body)).toBe(`license_key=${encodeURIComponent(KEY)}`);
    expect(init.signal).toBeDefined();
  });

  it("remembers a valid key that carries no order id, with nothing granted", async () => {
    answering(validKey({ meta: {} }));
    const res = await post({ key: KEY });
    expect(await res.json()).toEqual({ ok: true, remaining: 0, total: 0 });
    expect(res.headers.get("set-cookie")).toContain(`${COOKIE}=${HASH}`);
  });

  it("answers 503 when there is no store to record the key in", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    await load();
    expect((await post({ key: KEY })).status).toBe(503);
  });
});

describe("a key that is not good is refused with the reason", () => {
  it("answers 404 and repeats what Lemon Squeezy said", async () => {
    answering({ valid: false, error: "license_key not found" });
    const res = await post({ key: KEY });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("license_key not found");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("answers 404 with its own words when there is no message to repeat", async () => {
    answering({ valid: false });
    expect((await (await post({ key: KEY })).json()).error).toMatch(/not recognised/);
  });

  it("answers 403 for a key that was disabled or has expired", async () => {
    for (const status of ["disabled", "expired"]) {
      answering(validKey({ license_key: { status } }));
      const res = await post({ key: KEY });
      expect(res.status, status).toBe(403);
      expect((await res.json()).error).toBe(`That key is ${status}.`);
      expect(res.headers.get("set-cookie")).toBeNull();
      expect(peek(entitlement)).toBeUndefined();
    }
  });

  it("answers 502 when Lemon Squeezy could not be reached, which is not the buyer's fault", async () => {
    fetchMock.mockRejectedValue(new Error("timed out"));
    const res = await post({ key: KEY });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/Try again in a minute/);
  });

  it("answers 400 to an empty key, a missing one, or one longer than any receipt carries", async () => {
    for (const body of [{}, { key: "" }, { key: "   " }, { key: 12 }, { key: "x".repeat(201) }]) {
      const res = await post(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 400 to a body that is not JSON", async () => {
    expect((await post("not json")).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 429 before spending a call on somebody trying keys in bulk", async () => {
    rateLimitMock.mockResolvedValue({ allowed: false });
    const res = await post({ key: KEY });
    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rateLimitMock.mock.calls[0][1]).toMatchObject({ bucket: "redeem-key", limit: 10 });
  });
});

describe("the cookie is the only thing the browser is given", () => {
  it("is httpOnly, scoped to the site, and long lived", async () => {
    const cookie = (await post({ key: KEY })).headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${COOKIE}=${HASH}`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Max-Age=\d{6,}/);
  });

  it("is sent only over https in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await load();
    expect((await post({ key: KEY })).headers.get("set-cookie")).toMatch(/Secure/i);
  });

  it("carries the hash and never the key, in the body or the headers", async () => {
    const res = await post({ key: KEY });
    const text = await res.text();
    expect(text).not.toContain(KEY);
    expect(JSON.stringify([...res.headers])).not.toContain(KEY);
  });

  it("is cleared on DELETE, which is what somebody on a shared computer needs", async () => {
    const cookie = (await route.DELETE()).headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^sc_key=;/);
    expect(cookie).toMatch(/Max-Age=0/);
    expect(cookie).toMatch(/HttpOnly/i);
  });
});

describe("a store that cannot be reached does not look like an empty balance", () => {
  it("answers 503 to a redemption instead of a cookie with nothing behind it", async () => {
    breakFakeRedis();
    const res = await post({ key: KEY });
    expect(res.status).toBe(503);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("reports what it knows on GET, which is that a key is held", async () => {
    putHash(entitlement, { total: 5, used: 1 });
    breakFakeRedis();
    expect(await (await get(`${COOKIE}=${HASH}`)).json()).toMatchObject({ hasKey: true, remaining: 0 });
  });
});
