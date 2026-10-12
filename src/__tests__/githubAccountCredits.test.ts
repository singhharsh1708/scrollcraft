import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import type { Brief } from "@/lib/siteBrief";
import { peek, peekHash, putHash, resetFakeRedis } from "./stubs/fakeRedis";

/**
 * Credits that belong to a GitHub account rather than to a browser.
 *
 * The thing being bought is five generations, and before this they were reachable only
 * from the browser that pasted the licence key: a buyer on their phone had paid for
 * nothing. So what matters here is which identity the money is counted against, and the
 * three ways that can go wrong — the cookie being preferred to the account, a pack
 * redeemed before signing in being left where nobody can reach it, and the free site
 * quietly becoming one per account per browser instead of one per browser.
 */

const accountIdentityMock = vi.hoisted(() => vi.fn<() => Promise<string | null>>());
vi.mock("@/auth", async () => {
  const actual = await vi.importActual<typeof import("../auth")>("../auth");
  return { ...actual, accountIdentity: accountIdentityMock };
});

const rateLimitMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => IP }));
vi.mock("@upstash/redis", async () => {
  const { FakeRedis } = await import("./stubs/fakeRedis");
  return { Redis: FakeRedis };
});

const sdk = vi.hoisted(() => {
  class APIError extends Error {}
  return { parse: vi.fn(), APIError, RateLimitError: class extends Error {}, AuthenticationError: class extends Error {}, PermissionDeniedError: class extends Error {} };
});

vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    messages = { parse: sdk.parse };
    static APIError = sdk.APIError;
    static RateLimitError = sdk.RateLimitError;
    static AuthenticationError = sdk.AuthenticationError;
    static PermissionDeniedError = sdk.PermissionDeniedError;
  }
  return { default: Anthropic };
});

const IP = "1.2.3.4";
const KEY = "SCRL-7F2A-1C9D-4E88";
const HASH = createHash("sha256").update(KEY).digest("hex");
/** A real GitHub account id is a number, and this one is Octocat's. */
const GITHUB_ID = "583231";
const ACCOUNT = `gh:${GITHUB_ID}`;
const onKey = `sc_ent:${HASH}`;
const onAccount = `sc_ent:${ACCOUNT}`;

const DESCRIPTION = "Nadeem Cycle Works on Hazratganj road, repairs and second hand cycles since 1998.";

const section = (over: Partial<Brief["sections"][number]> = {}): Brief["sections"][number] => ({
  kind: "text",
  layout: "left",
  reveal: "fade",
  eyebrow: "The work",
  heading: "Punctures, gears, wheel truing",
  body: "Two mechanics, both here since the shop opened.",
  ctaLabel: "",
  ...over,
});

const BRIEF: Brief = {
  siteName: "Nadeem Cycle Works",
  tagline: "Cycle repairs on Hazratganj road since 1998",
  style: "geometric",
  colors: ["#1b4332", "#95d5b2", "#0a0a0a"],
  fontPair: "Archivo with Inter",
  ink: "#f2f2f2",
  accent: "#1b4332",
  accentText: "#95d5b2",
  sections: [
    section({ kind: "statement", layout: "center", reveal: "mask", eyebrow: "Since 1998", heading: "Your cycle back by evening", body: "", ctaLabel: "Find the shop" }),
    section(),
    section({ layout: "right", reveal: "stagger" }),
    section({ heading: "We do not touch electric cycles" }),
    section({ layout: "right", heading: "Open seven days from eight", ctaLabel: "Get directions" }),
  ],
};

type Credits = typeof import("../lib/credits");
type CreditsRoute = typeof import("../app/api/credits/route");
type GenerateRoute = typeof import("../app/api/generate-site/route");

let credits: Credits;
let creditsRoute: CreditsRoute;
let generate: GenerateRoute;

const fetchMock = vi.fn();

/** What Lemon Squeezy answers for a key that is real. */
function answeringAValidKey() {
  fetchMock.mockResolvedValue({
    json: async () => ({
      valid: true,
      error: null,
      license_key: { status: "active" },
      meta: { order_id: 4242, customer_email: "buyer@example.com" },
    }),
  } as unknown as Response);
}

function redeem(cookie?: string) {
  return creditsRoute.POST(
    new Request("https://scrollcraft.space/api/credits", {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify({ key: KEY }),
    }) as unknown as NextRequest
  );
}

function balance(cookie?: string) {
  return creditsRoute.GET(
    new Request("https://scrollcraft.space/api/credits", {
      headers: cookie ? { cookie } : {},
    }) as unknown as NextRequest
  );
}

function generateSite({ browser, key }: { browser?: string; key?: string } = {}) {
  const cookie = [browser ? `sc_fid=${browser}` : "", key ? `sc_key=${key}` : ""].filter(Boolean).join("; ");
  return generate.POST(
    new Request("https://scrollcraft.space/api/generate-site", {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify({ description: DESCRIPTION }),
    }) as unknown as NextRequest
  );
}

/** Nobody is signed in unless a test says so, which is the state every other suite runs in. */
function signedIn(accountId: string | null) {
  accountIdentityMock.mockResolvedValue(accountId === null ? null : `gh:${accountId}`);
}

async function load() {
  vi.resetModules();
  credits = await import("../lib/credits");
  creditsRoute = await import("../app/api/credits/route");
  generate = await import("../app/api/generate-site/route");
}

beforeEach(async () => {
  vi.clearAllMocks();
  resetFakeRedis();
  signedIn(null);
  rateLimitMock.mockResolvedValue({ allowed: true });
  answeringAValidKey();
  vi.stubGlobal("fetch", fetchMock);
  sdk.parse.mockResolvedValue({
    stop_reason: "end_turn",
    parsed_output: BRIEF,
    usage: { input_tokens: 1200, cache_read_input_tokens: 900, output_tokens: 700 },
  });
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-0000");
  vi.stubEnv("GENERATE_DAILY_LIMIT", "");
  vi.stubEnv("AUTH_SECRET", "");
  vi.stubEnv("AUTH_GITHUB_ID", "");
  vi.stubEnv("AUTH_GITHUB_SECRET", "");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
  vi.stubEnv("KV_REST_API_URL", "");
  vi.stubEnv("KV_REST_API_TOKEN", "");
  await load();
});

describe("an account is named by its id, because a login can be given away", () => {
  it("keys on the numeric id GitHub never reissues", () => {
    expect(credits.githubIdentity(GITHUB_ID)).toBe(ACCOUNT);
  });

  it("refuses anything that is not an id, rather than keying on it", () => {
    // A username is the dangerous one: it can be changed and the freed name claimed by
    // somebody else, who would inherit the credits of whoever held it first.
    for (const value of ["", "octocat", "0x1", "58 3231", " 583231", "583231 ", "-1", "1".repeat(21), "../583231"]) {
      expect(credits.githubIdentity(value), value).toBeNull();
    }
  });

  it("cannot collide with a licence key's own identity, which is 64 hex characters", () => {
    expect(credits.githubIdentity(GITHUB_ID)).not.toMatch(/^[a-f0-9]{64}$/);
    expect(onAccount).not.toBe(onKey);
  });
});

describe("a signed-in visitor spends their account's credits, not the browser's", () => {
  it("takes the credit off the account even when the browser carries a key", async () => {
    putHash(onAccount, { total: 5, used: 0 });
    putHash(onKey, { total: 5, used: 0 });
    signedIn(GITHUB_ID);

    const res = await generateSite({ browser: "browser-one", key: HASH });
    expect(res.status).toBe(200);
    expect((await res.json()).remaining).toBe(4);
    expect(peekHash(onAccount).used).toBe(1);
    expect(peekHash(onKey).used, "the cookie's pack was spent instead").toBe(0);
  });

  it("reaches the same credits from a browser that has never seen the key", async () => {
    // This is the whole feature: a pack bought on a laptop, spent on a phone.
    putHash(onAccount, { total: 5, used: 0 });
    signedIn(GITHUB_ID);

    const res = await generateSite({ browser: "a-different-browser" });
    expect(res.status).toBe(200);
    expect((await res.json()).remaining).toBe(4);
    expect(peekHash(onAccount).used).toBe(1);
  });

  it("still spends the cookie's credits when nobody is signed in", async () => {
    putHash(onKey, { total: 5, used: 0 });
    const res = await generateSite({ browser: "browser-one", key: HASH });
    expect(res.status).toBe(200);
    expect(peekHash(onKey).used).toBe(1);
    expect(peek(onAccount)).toBeUndefined();
  });

  it("offers the box for pasting a key to somebody who signed in and never bought one", async () => {
    // hasKey drives whether /describe shows a balance or the key box, so an account with
    // no pack must not read as a key held: it would show "0 sites left" and no way in.
    signedIn(GITHUB_ID);
    expect(await (await balance()).json()).toMatchObject({ hasKey: false, remaining: 0, total: 0 });
    putHash(onAccount, { total: 5, used: 0 });
    expect(await (await balance()).json()).toMatchObject({ hasKey: true, remaining: 5, total: 5 });
  });

  it("reports the account's balance rather than the cookie's", async () => {
    putHash(onAccount, { total: 10, used: 3 });
    putHash(onKey, { total: 5, used: 5 });
    signedIn(GITHUB_ID);
    expect(await (await balance(`sc_key=${HASH}`)).json()).toEqual({
      free: 1,
      pack: 5,
      hasKey: true,
      remaining: 7,
      total: 10,
      signedIn: true,
    });
  });

  it("does not tell somebody who has never bought anything that their credits are spent", async () => {
    // A signed-in visitor has an identity but not necessarily a pack. Reading the
    // refusal straight off the identity told them credits they never had were gone.
    signedIn(GITHUB_ID);
    expect((await generateSite({ browser: "browser-one" })).status).toBe(200);
    const res = await generateSite({ browser: "browser-one" });
    expect(res.status).toBe(402);
    expect((await res.json()).error).toMatch(/free site has been used/);
  });
});

describe("the free site stays with the browser, and signing in does not mint another", () => {
  it("counts it under the browser rather than under the account", async () => {
    signedIn(GITHUB_ID);
    expect((await generateSite({ browser: "browser-one" })).status).toBe(200);
    expect(peek("sc_freeb:browser-one")).toBe("1");
    expect(peek(onAccount), "the free site was recorded against the account").toBeUndefined();
  });

  it("refuses a second free site to the same browser, signed in or not", async () => {
    signedIn(GITHUB_ID);
    expect((await generateSite({ browser: "browser-one" })).status).toBe(200);
    expect((await generateSite({ browser: "browser-one" })).status).toBe(402);
  });

  it("does not give a browser its free site back because somebody signed in on it", async () => {
    // The tempting mistake: hanging the free tier off the account, which would hand out
    // one free site per account per browser instead of one per browser.
    expect((await generateSite({ browser: "browser-one" })).status).toBe(200);
    signedIn(GITHUB_ID);
    expect((await generateSite({ browser: "browser-one" })).status).toBe(402);
    signedIn("1");
    expect((await generateSite({ browser: "browser-one" })).status).toBe(402);
  });

  it("leaves a second browser its own free site, which is what it had before", async () => {
    signedIn(GITHUB_ID);
    expect((await generateSite({ browser: "browser-one" })).status).toBe(200);
    expect((await generateSite({ browser: "browser-two" })).status).toBe(200);
  });
});

describe("a licence key redeemed while signed in belongs to the account", () => {
  it("grants the pack to the account and not to the key's hash", async () => {
    signedIn(GITHUB_ID);
    const res = await redeem();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, remaining: 5, total: 5 });
    expect(peekHash(onAccount).total).toBe(5);
    expect(peek(onKey), "the pack went to the browser instead of the account").toBeUndefined();
  });

  it("records the order against the account, so a late webhook adds nothing on top", async () => {
    signedIn(GITHUB_ID);
    await redeem();
    expect(peek("sc_ord:4242")).toBe(ACCOUNT);
    expect(await credits.grantPack(ACCOUNT, "4242")).toBe("already");
    expect(peekHash(onAccount).total).toBe(5);
  });

  it("carries a pack redeemed before signing in over to the account", async () => {
    // Pasted the key first, signed in afterwards. Without this the credits sit where
    // only one browser can see them, which is the problem this feature exists to fix.
    putHash(onKey, { total: 5, used: 1 });
    signedIn(GITHUB_ID);

    const res = await redeem(`sc_key=${HASH}`);
    expect(await res.json()).toEqual({ ok: true, remaining: 4, total: 4 });
    expect(fetchMock, "a key this deployment knows needs no network call").not.toHaveBeenCalled();
    expect(peekHash(onAccount)).toMatchObject({ total: 4 });
    // And nothing is left to spend on the key, so the four are not worth eight.
    expect(peekHash(onKey)).toMatchObject({ total: 1, used: 1 });
  });

  it("carries it once, however many times the key is pasted", async () => {
    putHash(onKey, { total: 5, used: 0 });
    signedIn(GITHUB_ID);
    await redeem(`sc_key=${HASH}`);
    await redeem(`sc_key=${HASH}`);
    await redeem(`sc_key=${HASH}`);
    expect(peekHash(onAccount).total).toBe(5);
    // Measured before the guard: the second paste found an emptied key row, fell through
    // to Lemon Squeezy, and granted the pack a second time.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stacks a second key onto the pack the account already has", async () => {
    putHash(onAccount, { total: 5, used: 2 });
    signedIn(GITHUB_ID);
    const res = await redeem();
    expect(await res.json()).toEqual({ ok: true, remaining: 8, total: 10 });
  });

  it("spends the carried-over credits off the account afterwards", async () => {
    putHash(onKey, { total: 5, used: 0 });
    signedIn(GITHUB_ID);
    await redeem(`sc_key=${HASH}`);
    const res = await generateSite({ browser: "browser-one", key: HASH });
    expect(res.status).toBe(200);
    expect((await res.json()).remaining).toBe(4);
    expect(peekHash(onAccount).used).toBe(1);
  });

  it("leaves a redemption by somebody not signed in exactly where it was", async () => {
    putHash(onKey, { total: 5, used: 2 });
    const res = await redeem(`sc_key=${HASH}`);
    expect(await res.json()).toEqual({ ok: true, remaining: 3, total: 5 });
    expect(peek(onAccount)).toBeUndefined();
    expect(peekHash(onKey)).toMatchObject({ total: 5, used: 2 });
  });
});

describe("carrying a pack over cannot create or destroy credits", () => {
  it("moves the unspent part and nothing else", async () => {
    putHash(onKey, { total: 10, used: 7 });
    expect(await credits.attachToAccount(HASH, ACCOUNT)).toBe("attached");
    expect((await credits.balanceOf(ACCOUNT))?.remaining).toBe(3);
    expect((await credits.balanceOf(HASH))?.remaining).toBe(0);
  });

  it("adds to a pack the account already has rather than replacing it", async () => {
    putHash(onAccount, { total: 5, used: 1 });
    putHash(onKey, { total: 5, used: 0 });
    expect(await credits.attachToAccount(HASH, ACCOUNT)).toBe("attached");
    expect(await credits.balanceOf(ACCOUNT)).toEqual({ total: 10, used: 1, remaining: 9 });
  });

  it("has nothing to move for a key that is spent, or that never bought anything", async () => {
    putHash(onKey, { total: 5, used: 5 });
    expect(await credits.attachToAccount(HASH, ACCOUNT)).toBe("nothing");
    resetFakeRedis();
    expect(await credits.attachToAccount(HASH, ACCOUNT)).toBe("nothing");
    expect(peek(onAccount)).toBeUndefined();
  });

  it("never hands the same pack to two accounts", async () => {
    putHash(onKey, { total: 5, used: 0 });
    expect(await credits.attachToAccount(HASH, ACCOUNT)).toBe("attached");
    expect(await credits.attachToAccount(HASH, "gh:1")).toBe("nothing");
    expect(peek("sc_ent:gh:1")).toBeUndefined();
  });

  it("says so rather than pretending, when there is no store", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    await load();
    expect(await credits.attachToAccount(HASH, ACCOUNT)).toBe("unavailable");
  });
});

describe("with no GitHub app configured this might as well not exist", () => {
  /**
   * The rule the whole environment follows: a variable that is not set means the feature
   * is not offered, never that the app is broken. The two route suites next to this one
   * run with these variables unset and are the proof that nothing else changed.
   */
  it("is configured only when all three variables are set", async () => {
    const { authConfigured } = await vi.importActual<typeof import("../auth")>("../auth");
    const all = { AUTH_SECRET: "x".repeat(32), AUTH_GITHUB_ID: "Iv1.abc", AUTH_GITHUB_SECRET: "s".repeat(40) };
    for (const missing of Object.keys(all) as (keyof typeof all)[]) {
      for (const [name, value] of Object.entries(all)) vi.stubEnv(name, name === missing ? "" : value);
      expect(authConfigured(), `configured without ${missing}`).toBe(false);
    }
    for (const [name, value] of Object.entries(all)) vi.stubEnv(name, value);
    expect(authConfigured()).toBe(true);
  });

  it("offers no identity, so credits stay on the licence-key cookie", async () => {
    const { accountIdentity } = await vi.importActual<typeof import("../auth")>("../auth");
    expect(await accountIdentity()).toBeNull();
  });

  it("answers 404 at the sign-in endpoint instead of failing", async () => {
    const route = await import("../app/api/auth/[...nextauth]/route");
    const req = new Request("https://scrollcraft.space/api/auth/session") as unknown as NextRequest;
    for (const res of [await route.GET(req), await route.POST(req)]) {
      expect(res.status).toBe(404);
      expect((await res.json()).error).toMatch(/not configured/);
    }
  });
});
