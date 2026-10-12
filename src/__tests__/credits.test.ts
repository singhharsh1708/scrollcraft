import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { peek, peekHash, peekTtl, putHash, resetFakeRedis } from "./stubs/fakeRedis";

/**
 * Entitlements, which is the one part of this app where a mistake costs somebody money.
 *
 * So the tests here are not about coverage. They are the four ways a credit ledger leaks:
 * two tabs spending the same last credit, a failed generation that was still charged for,
 * a webhook delivered twice being worth two packs, and a refund taking back more than it
 * sold. Each of those has a test below that fails if the guard is removed.
 */

vi.mock("@upstash/redis", async () => {
  const { FakeRedis } = await import("./stubs/fakeRedis");
  return { Redis: FakeRedis };
});

type Credits = typeof import("../lib/credits");
let credits: Credits;

const KEY = "SCRL-7F2A-1C9D-4E88";
const HASH = createHash("sha256").update(KEY).digest("hex");
const IP = "203.0.113.7";
const MONTH = new Date().toISOString().slice(0, 7);
const entitlement = `sc_ent:${HASH}`;
const free = `sc_free:${IP}:${MONTH}`;

async function load(): Promise<Credits> {
  vi.resetModules();
  credits = await import("../lib/credits");
  return credits;
}

beforeEach(async () => {
  vi.clearAllMocks();
  resetFakeRedis();
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
  vi.stubEnv("KV_REST_API_URL", "");
  vi.stubEnv("KV_REST_API_TOKEN", "");
  await load();
});

function withoutAStore() {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.stubEnv("KV_REST_API_URL", "");
  vi.stubEnv("KV_REST_API_TOKEN", "");
  return load();
}

function request(cookie?: string): Request {
  return new Request("https://scrollcraft.space/api/credits", {
    headers: cookie === undefined ? {} : { cookie },
  });
}

describe("the licence key is only ever kept as a hash", () => {
  it("hashes to 64 lowercase hex characters, which is what the cookie carries", () => {
    expect(credits.hashKey(KEY)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("ignores the whitespace somebody pastes with the key, so one key is one identity", () => {
    expect(credits.hashKey(`  ${KEY}\n`)).toBe(credits.hashKey(KEY));
  });

  it("gives two keys two different hashes", () => {
    expect(credits.hashKey(KEY)).not.toBe(credits.hashKey(`${KEY}X`));
  });

  it("never contains the key it was made from", () => {
    expect(credits.hashKey(KEY)).not.toContain("SCRL");
  });
});

describe("the cookie is read strictly, because it names who gets to spend", () => {
  it("reads the hash out of a cookie header that carries other cookies too", () => {
    expect(credits.keyHashFrom(request(`other=1; ${credits.KEY_COOKIE}=${HASH}; last=x`))).toBe(HASH);
  });

  it("refuses anything that is not a 64 character lowercase hex string", () => {
    const refused = [
      "",
      HASH.slice(0, 63),
      `${HASH}0`,
      HASH.toUpperCase(),
      HASH.replace(/^./, "g"),
      `${HASH.slice(0, 62)}$%`,
      "sc_ent:" + HASH,
      "../../etc/passwd",
    ];
    for (const value of refused) {
      expect(
        credits.keyHashFrom(request(`${credits.KEY_COOKIE}=${encodeURIComponent(value)}`)),
        value
      ).toBeNull();
    }
  });

  it("answers null when there is no cookie header at all", () => {
    expect(credits.keyHashFrom(request())).toBeNull();
    expect(credits.keyHashFrom(request("other=1"))).toBeNull();
  });

  it("does not mistake a cookie whose name merely ends with the same letters", () => {
    expect(credits.keyHashFrom(request(`not_sc_key=${HASH}`))).toBeNull();
  });

  it("keeps the cookie off the page's own hands and off plain http in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(credits.cookieOptions()).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
    vi.stubEnv("NODE_ENV", "development");
    expect(credits.cookieOptions().secure).toBe(false);
    expect(credits.cookieOptions().httpOnly).toBe(true);
  });
});

describe("the free site is one site per address per month", () => {
  it("is given once and then refused, under the month's own key", async () => {
    const first = await credits.takeAllowance(IP, null);
    expect(first).toMatchObject({ ok: true, kind: "free" });
    expect(peek(free)).toBe("1");

    const second = await credits.takeAllowance(IP, null);
    expect(second).toEqual({ ok: false, reason: "free-used" });
    // The refusal must not leave the count inflated, or next month arrives early.
    expect(peek(free)).toBe("1");
  });

  it("counts the address, not the browser, so another address still gets its site", async () => {
    await credits.takeAllowance(IP, null);
    expect(await credits.takeAllowance("198.51.100.4", null)).toMatchObject({ ok: true, kind: "free" });
  });

  it("gives the count an expiry on the first take, so a month's keys do not pile up", async () => {
    await credits.takeAllowance(IP, null);
    expect(peekTtl(free)).toBe(70 * 24 * 60 * 60);
  });

  it("gives the free site back when the generation failed, and not below zero", async () => {
    const allowance = await credits.takeAllowance(IP, null);
    expect(allowance.ok).toBe(true);
    if (allowance.ok) await allowance.release();
    expect(Number(peek(free))).toBe(0);

    // Released, so the site is available again, and still only once.
    expect(await credits.takeAllowance(IP, null)).toMatchObject({ ok: true, kind: "free" });
    expect(await credits.takeAllowance(IP, null)).toEqual({ ok: false, reason: "free-used" });
    expect(Number(peek(free))).toBeGreaterThanOrEqual(0);
  });

  it("does not spend the free site when the generation worked", async () => {
    const allowance = await credits.takeAllowance(IP, null);
    expect(allowance.ok).toBe(true);
    expect(Number(peek(free))).toBe(1);
  });
});

describe("paid credits are spent one at a time and nobody spends the same one twice", () => {
  beforeEach(async () => {
    await credits.grantPack(HASH, "order-1");
  });

  it("spends a paid credit before the free site, so a buyer keeps the free one", async () => {
    const allowance = await credits.takeAllowance(IP, HASH);
    expect(allowance).toMatchObject({ ok: true, kind: "paid" });
    expect(peekHash(entitlement)).toMatchObject({ total: credits.PACK_SITES, used: 1 });
    expect(peek(free)).toBeUndefined();
  });

  it("lets exactly one of two tabs through the last credit", async () => {
    putHash(entitlement, { total: 1, used: 0 });
    const [a, b] = await Promise.all([credits.takeAllowance(IP, HASH), credits.takeAllowance(IP, HASH)]);
    const paid = [a, b].filter((result) => result.ok && result.kind === "paid");
    expect(paid).toHaveLength(1);
    expect(peekHash(entitlement).used).toBe(1);
    // The one that missed falls through to the free site, which is the designed behaviour.
    expect([a, b].some((result) => result.ok && result.kind === "free")).toBe(true);
  });

  it("lets exactly five through a pack, however many ask at once", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => credits.takeAllowance(IP, HASH))
    );
    const paid = results.filter((result) => result.ok && result.kind === "paid");
    expect(paid).toHaveLength(credits.PACK_SITES);
    expect(peekHash(entitlement).used).toBe(credits.PACK_SITES);
  });

  it("gives a credit back when the generation failed, and charges for one that worked", async () => {
    const failed = await credits.takeAllowance(IP, HASH);
    expect(peekHash(entitlement).used).toBe(1);
    if (failed.ok) await failed.release();
    expect(peekHash(entitlement).used).toBe(0);
    expect((await credits.balanceOf(HASH))?.remaining).toBe(credits.PACK_SITES);

    await credits.takeAllowance(IP, HASH);
    expect((await credits.balanceOf(HASH))?.remaining).toBe(credits.PACK_SITES - 1);
  });

  it("never pushes the used count below zero when a credit is given back", async () => {
    const allowance = await credits.takeAllowance(IP, HASH);
    expect(allowance.ok).toBe(true);
    if (allowance.ok) {
      await allowance.release();
      await allowance.release();
    }
    expect(peekHash(entitlement).used).toBe(0);
    expect((await credits.balanceOf(HASH))?.remaining).toBe(credits.PACK_SITES);
  });

  it("falls back to the free site once the pack is spent, then says there are no credits", async () => {
    putHash(entitlement, { total: credits.PACK_SITES, used: credits.PACK_SITES });
    expect(await credits.takeAllowance(IP, HASH)).toMatchObject({ ok: true, kind: "free" });
    expect(await credits.takeAllowance(IP, HASH)).toEqual({ ok: false, reason: "no-credits" });
  });
});

describe("a balance reads back what was bought and what is left", () => {
  it("is null for a hash the store has never seen", async () => {
    expect(await credits.balanceOf(HASH)).toBeNull();
  });

  it("never reports a negative remaining, whatever the row says", async () => {
    putHash(entitlement, { total: 5, used: 9 });
    expect(await credits.balanceOf(HASH)).toEqual({ total: 5, used: 9, remaining: 0 });
  });

  it("treats a row with no used field as nothing spent", async () => {
    putHash(entitlement, { total: 5 });
    expect(await credits.balanceOf(HASH)).toEqual({ total: 5, used: 0, remaining: 5 });
  });
});

describe("a pack is granted once per order, however often the webhook arrives", () => {
  it("adds five sites the first time and nothing the second", async () => {
    expect(await credits.grantPack(HASH, "order-9", "buyer@example.com")).toBe("granted");
    expect(await credits.grantPack(HASH, "order-9", "buyer@example.com")).toBe("already");
    expect(peekHash(entitlement).total).toBe(credits.PACK_SITES);
  });

  it("stacks two different orders, because a second purchase is a second pack", async () => {
    await credits.grantPack(HASH, "order-9");
    await credits.grantPack(HASH, "order-10");
    expect(peekHash(entitlement).total).toBe(credits.PACK_SITES * 2);
  });

  it("remembers who the order belongs to, which is what a refund needs", async () => {
    await credits.grantPack(HASH, "order-9");
    expect(peek("sc_ordkey:order-9")).toBe(HASH);
    expect(peek("sc_ord:order-9")).toBe(HASH);
  });

  it("records the email only when there is one, and never the key itself", async () => {
    await credits.grantPack(HASH, "order-9", "buyer@example.com");
    expect(peek(entitlement)).toMatchObject({ email: "buyer@example.com", lastOrder: "order-9" });
    await credits.grantPack(HASH, "order-11");
    expect(JSON.stringify(peek(entitlement))).not.toContain(KEY);
  });
});

describe("a refund takes back the unused part of the pack and no more", () => {
  it("removes the pack when none of it has been spent", async () => {
    await credits.grantPack(HASH, "order-9");
    expect(await credits.revokePack("order-9")).toBe("revoked");
    expect((await credits.balanceOf(HASH))?.remaining).toBe(0);
  });

  it("leaves the sites already written paid for, rather than owing credits", async () => {
    await credits.grantPack(HASH, "order-9");
    putHash(entitlement, { used: 3 });
    expect(await credits.revokePack("order-9")).toBe("revoked");
    const balance = await credits.balanceOf(HASH);
    expect(balance).toEqual({ total: 3, used: 3, remaining: 0 });
    expect(balance!.total).toBeGreaterThanOrEqual(balance!.used);
  });

  it("never takes a buyer below what they have already spent, at any usage", async () => {
    for (const used of [0, 1, 4, 5, 7, 9]) {
      resetFakeRedis();
      await credits.grantPack(HASH, "order-9");
      await credits.grantPack(HASH, "order-10");
      putHash(entitlement, { used });
      await credits.revokePack("order-9");
      const balance = await credits.balanceOf(HASH);
      expect(balance!.total, `used ${used}`).toBeGreaterThanOrEqual(used);
      expect(balance!.remaining, `used ${used}`).toBeGreaterThanOrEqual(0);
    }
  });

  it("says so when the order was never recorded, rather than touching anybody's balance", async () => {
    expect(await credits.revokePack("order-nobody-bought")).toBe("unknown");
    expect(peek(entitlement)).toBeUndefined();
  });
});

describe("with no store configured nothing is handed out in production", () => {
  it("refuses to generate rather than giving away an unbounded number of sites", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await withoutAStore();
    expect(await credits.takeAllowance(IP, HASH)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("lets a local run generate, since there is nothing to count against there", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await withoutAStore();
    const allowance = await credits.takeAllowance(IP, null);
    expect(allowance).toMatchObject({ ok: true, kind: "free" });
    if (allowance.ok) await expect(allowance.release()).resolves.toBeUndefined();
  });

  it("says a purchase could not be recorded instead of pretending it was", async () => {
    await withoutAStore();
    expect(await credits.grantPack(HASH, "order-9")).toBe("unavailable");
    expect(await credits.revokePack("order-9")).toBe("unavailable");
    expect(await credits.balanceOf(HASH)).toBeNull();
  });
});
