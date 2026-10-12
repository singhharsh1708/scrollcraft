import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import type { Brief } from "@/lib/siteBrief";
import { breakFakeRedis, peek, peekHash, putHash, resetFakeRedis } from "./stubs/fakeRedis";

/**
 * The route that spends money, seen from the credit side.
 *
 * One rule decides whether this is a product or a way to lose money: a credit is taken
 * before the model is called and given back on every path that does not end in a site.
 * There are eight such paths, and a release missing from any one of them charges somebody
 * four dollars for an error page, so each is checked separately rather than in a loop over
 * the happy case.
 */

const rateLimitMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));
vi.mock("@upstash/redis", async () => {
  const { FakeRedis } = await import("./stubs/fakeRedis");
  return { Redis: FakeRedis };
});

const sdk = vi.hoisted(() => {
  class APIError extends Error {
    status: number;
    constructor(status = 500, message = "upstream said no") {
      super(message);
      this.status = status;
    }
  }
  class RateLimitError extends Error {}
  class AuthenticationError extends Error {}
  class PermissionDeniedError extends Error {}
  return { parse: vi.fn(), APIError, RateLimitError, AuthenticationError, PermissionDeniedError };
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

const KEY = "SCRL-7F2A-1C9D-4E88";
const HASH = createHash("sha256").update(KEY).digest("hex");
const IP = "1.2.3.4";
const entitlement = `sc_ent:${HASH}`;
const freeKey = `sc_free:${IP}:${new Date().toISOString().slice(0, 7)}`;

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

function okResponse(overrides: Record<string, unknown> = {}) {
  return {
    stop_reason: "end_turn",
    parsed_output: BRIEF,
    usage: { input_tokens: 1200, cache_read_input_tokens: 900, output_tokens: 700 },
    ...overrides,
  };
}

type Handler = typeof import("../app/api/generate-site/route").POST;
let POST: Handler;

/**
 * A browser keeps the cookie it is given, so these requests carry one. A caller that
 * keeps no cookies is a different case, covered by its own test below.
 */
const BROWSER = "sc_fid=browser-under-test";

function post(body: unknown, cookie?: string) {
  const headers: Record<string, string> = { "content-type": "application/json", cookie: cookie ? `${cookie}; ${BROWSER}` : BROWSER };
  return POST(
    new Request("https://scrollcraft.space/api/generate-site", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }) as unknown as NextRequest
  );
}

const asBuyer = (body: unknown) => post(body, `sc_key=${HASH}`);

/** Somebody who throws away every cookie they are given. */
function postWithoutCookies(body: unknown) {
  return POST(
    new Request("https://scrollcraft.space/api/generate-site", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }) as unknown as NextRequest
  );
}

async function load() {
  vi.resetModules();
  ({ POST } = await import("../app/api/generate-site/route"));
}

beforeEach(async () => {
  vi.clearAllMocks();
  resetFakeRedis();
  rateLimitMock.mockResolvedValue({ allowed: true });
  sdk.parse.mockResolvedValue(okResponse());
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-0000");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("GENERATE_DAILY_LIMIT", "");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
  vi.stubEnv("KV_REST_API_URL", "");
  vi.stubEnv("KV_REST_API_TOKEN", "");
  await load();
});

describe("the allowance is taken before the model is called", () => {
  it("has already spent the credit by the time the call goes out", async () => {
    putHash(entitlement, { total: 5, used: 0 });
    let usedDuringTheCall = -1;
    sdk.parse.mockImplementation(async () => {
      usedDuringTheCall = peekHash(entitlement).used;
      return okResponse();
    });
    await asBuyer({ description: DESCRIPTION });
    expect(usedDuringTheCall).toBe(1);
  });

  it("names this browser on the way out, so its free site stays its own", async () => {
    const res = await postWithoutCookies({ description: DESCRIPTION });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/sc_fid=[^;]{8,};/);
    expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/i);
  });

  it("keeps the name a browser already has rather than handing out another free site", async () => {
    await post({ description: DESCRIPTION });
    const res = await post({ description: DESCRIPTION });
    expect(res.status).toBe(402);
    expect(res.headers.get("set-cookie")).toContain("browser-under-test");
  });

  it("bounds somebody who keeps no cookies by the address instead", async () => {
    // Each of these looks like a new browser. The address is what stops it.
    for (let i = 0; i < 5; i++) {
      expect((await postWithoutCookies({ description: DESCRIPTION })).status, `call ${i}`).toBe(200);
    }
    const res = await postWithoutCookies({ description: DESCRIPTION });
    expect(res.status).toBe(402);
    expect((await res.json()).error).toMatch(/as many free sites as this connection/);
  });

  it("answers 402 and calls nobody when the free site is gone and there is no key", async () => {
    await post({ description: DESCRIPTION });
    const res = await post({ description: DESCRIPTION });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.needsCredits).toBe(true);
    expect(body.error).toMatch(/free site has been used/);
    expect(sdk.parse).toHaveBeenCalledTimes(1);
  });

  it("tells a buyer whose pack is spent what another pack costs", async () => {
    putHash(entitlement, { total: 5, used: 5 });
    // The free site is still theirs; it is the one after that which is refused.
    expect((await asBuyer({ description: DESCRIPTION })).status).toBe(200);
    const res = await asBuyer({ description: DESCRIPTION });
    expect(res.status).toBe(402);
    expect((await res.json()).error).toBe("Those credits are spent. Another 5 sites cost $20.");
  });

  it("answers 503 rather than generating for free when there is no store in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    await load();
    const res = await post({ description: DESCRIPTION });
    expect(res.status).toBe(503);
    expect(sdk.parse).not.toHaveBeenCalled();
  });

  it("does not touch the allowance for a request the cheap checks refuse", async () => {
    expect((await asBuyer({ description: "cycles" })).status).toBe(400);
    expect(peek(entitlement)).toBeUndefined();
    expect(peek(freeKey)).toBeUndefined();
  });

  it("does not touch the allowance when the day's ceiling has been reached", async () => {
    vi.stubEnv("GENERATE_DAILY_LIMIT", "1");
    await load();
    putHash(entitlement, { total: 5, used: 0 });
    await asBuyer({ description: DESCRIPTION });
    const res = await asBuyer({ description: DESCRIPTION });
    expect(res.status).toBe(503);
    expect(peekHash(entitlement).used).toBe(1);
  });
});

describe("a generation that failed is given back", () => {
  const failures: [string, number, () => void][] = [
    ["the model declined", 422, () => sdk.parse.mockResolvedValue(okResponse({ stop_reason: "refusal", parsed_output: null, stop_details: { category: "other" } }))],
    ["the answer ran out of room", 502, () => sdk.parse.mockResolvedValue(okResponse({ stop_reason: "max_tokens" }))],
    ["there was nothing parsed", 502, () => sdk.parse.mockResolvedValue(okResponse({ parsed_output: null }))],
    ["the editor would not accept it", 502, () => sdk.parse.mockResolvedValue(okResponse({ parsed_output: { ...BRIEF, colors: ["#1b4332", "#95d5b2", "#12"] } }))],
    ["the upstream was busy", 429, () => sdk.parse.mockRejectedValue(new sdk.RateLimitError("slow down"))],
    ["the credentials were rejected", 503, () => sdk.parse.mockRejectedValue(new sdk.AuthenticationError("bad key"))],
    ["the upstream errored", 502, () => sdk.parse.mockRejectedValue(new sdk.APIError(500, "upstream"))],
    ["something unexpected happened", 500, () => sdk.parse.mockRejectedValue(new Error("socket closed"))],
  ];

  it.each(failures)("gives the paid credit back when %s", async (_name, status, arrange) => {
    putHash(entitlement, { total: 5, used: 0 });
    arrange();
    const res = await asBuyer({ description: DESCRIPTION });
    expect(res.status).toBe(status);
    expect(peekHash(entitlement)).toMatchObject({ total: 5, used: 0 });
  });

  it.each(failures)("gives the free site back when %s", async (_name, status, arrange) => {
    arrange();
    const res = await post({ description: DESCRIPTION });
    expect(res.status).toBe(status);
    expect(Number(peek(freeKey))).toBe(0);
    // And the visitor can try again, which is the point of giving it back.
    sdk.parse.mockResolvedValue(okResponse());
    expect((await post({ description: DESCRIPTION })).status).toBe(200);
  });
});

describe("a generation that worked is charged for", () => {
  it("keeps the paid credit spent and says what is left", async () => {
    putHash(entitlement, { total: 5, used: 0 });
    const res = await asBuyer({ description: DESCRIPTION });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.remaining).toBe(4);
    expect(body.usedFreeSite).toBe(false);
    expect(peekHash(entitlement).used).toBe(1);
  });

  it("keeps the free site spent, and says that is what was used", async () => {
    const body = await (await post({ description: DESCRIPTION })).json();
    expect(body.usedFreeSite).toBe(true);
    expect(body.remaining).toBe(0);
    expect(peek(freeKey)).toBe("1");
  });

  it("spends five credits over five sites and no more", async () => {
    putHash(entitlement, { total: 5, used: 0 });
    for (let i = 0; i < 5; i += 1) {
      expect((await asBuyer({ description: DESCRIPTION })).status, `site ${i}`).toBe(200);
    }
    expect(peekHash(entitlement)).toMatchObject({ total: 5, used: 5 });
    // Six. The free site answers it, and the seventh is refused.
    expect((await asBuyer({ description: DESCRIPTION })).status).toBe(200);
    expect((await asBuyer({ description: DESCRIPTION })).status).toBe(402);
    expect(sdk.parse).toHaveBeenCalledTimes(6);
  });

  it("does not spend the free site while there are credits to spend", async () => {
    putHash(entitlement, { total: 5, used: 0 });
    await asBuyer({ description: DESCRIPTION });
    expect(peek(freeKey)).toBeUndefined();
  });
});

describe("a store that cannot be reached stops the call rather than paying for it", () => {
  it("answers 503 and calls nobody, with credits sitting in the store", async () => {
    putHash(entitlement, { total: 5, used: 0 });
    breakFakeRedis();
    const res = await asBuyer({ description: DESCRIPTION });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/unavailable for a moment/);
    expect(sdk.parse).not.toHaveBeenCalled();
  });

  it("leaves the credits alone, so they are there when the store comes back", async () => {
    putHash(entitlement, { total: 5, used: 0 });
    breakFakeRedis();
    await asBuyer({ description: DESCRIPTION });
    breakFakeRedis(false);
    expect(peekHash(entitlement)).toMatchObject({ total: 5, used: 0 });
    expect((await asBuyer({ description: DESCRIPTION })).status).toBe(200);
  });
});
