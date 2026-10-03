import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { NextRequest } from "next/server";

const rateLimitMock = vi.hoisted(() => vi.fn());
const incrMock = vi.hoisted(() => vi.fn());
const incrbyMock = vi.hoisted(() => vi.fn());
const expireMock = vi.hoisted(() => vi.fn());
const getMock = vi.hoisted(() => vi.fn());
const pipelineMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));
vi.mock("@upstash/redis", () => ({
  Redis: class {
    incr = incrMock;
    incrby = incrbyMock;
    expire = expireMock;
    get = getMock;
    pipeline = pipelineMock;
  },
}));

type Handler = typeof import("../app/api/count/route").POST;
type Reader = typeof import("../app/api/count/route").GET;
let POST: Handler;
let GET: Reader;

async function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("https://scrollcraft.space/api/count", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }) as unknown as NextRequest
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  rateLimitMock.mockResolvedValue({ allowed: true });
  incrMock.mockResolvedValue(1);
  incrbyMock.mockResolvedValue(12);
  expireMock.mockResolvedValue(1);
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
  getMock.mockResolvedValue(0);
  ({ POST, GET } = await import("../app/api/count/route"));
});

/**
 * Vercel keeps custom events behind its Pro plan, so the four counts that say whether
 * anyone finishes a site are kept here instead, in the Redis this app already uses for
 * rate limiting. Counts only: the privacy page promises that what someone types stays on
 * their device, and this route is the one place that promise could quietly break.
 */

describe("the four counts are recorded, and nothing else is", () => {
  it("counts a step and dates it, so a week can be read back", async () => {
    const res = await post({ event: "export_finished", seconds: 12 });
    expect(res.status).toBe(204);
    const keys = incrMock.mock.calls.map((c) => String(c[0]));
    expect(keys.some((k) => /^funnel:\d{4}-\d{2}-\d{2}:export_finished$/.test(k))).toBe(true);
  });

  it("keeps which template was opened, since that decides what gets built next", async () => {
    await post({ event: "editor_opened", template: "aurabeauty" });
    const keys = incrMock.mock.calls.map((c) => String(c[0]));
    expect(keys.some((k) => k.endsWith(":editor_opened:aurabeauty"))).toBe(true);
  });

  it("refuses an event it does not know", async () => {
    const res = await post({ event: "heading_typed", text: "Dr Mehta private clinic" });
    expect(res.status).toBe(400);
    expect(incrMock).not.toHaveBeenCalled();
  });

  it("records a template it has never heard of as custom, never as typed", async () => {
    await post({ event: "editor_opened", template: "Our Clinic's Private Draft" });
    const keys = incrMock.mock.calls.map((c) => String(c[0])).join(" ");
    expect(keys).toContain(":editor_opened:custom");
    expect(keys).not.toMatch(/clinic/i);
  });

  it("writes nothing but the event, the date and a known slug", async () => {
    await post({ event: "first_edit", template: "kept", seconds: 3, note: "anything else" });
    for (const [key] of [...incrMock.mock.calls, ...incrbyMock.mock.calls]) {
      expect(String(key)).toMatch(/^funnel:\d{4}-\d{2}-\d{2}:(editor_opened|first_edit|export_started|export_finished)(:[a-z0-9-]+|_seconds_(sum|n))?$/);
    }
  });

  it("gives every key an expiry, so the store cannot grow forever", async () => {
    await post({ event: "first_edit" });
    expect(expireMock).toHaveBeenCalled();
    for (const [, ttl] of expireMock.mock.calls) {
      expect(Number(ttl)).toBeGreaterThan(0);
      expect(Number(ttl)).toBeLessThanOrEqual(400 * 24 * 60 * 60);
    }
  });
});

describe("a preview or a local run cannot touch the real numbers", () => {
  it("keeps anything that is not production under its own prefix", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.resetModules();
    const { POST: preview } = await import("../app/api/count/route");
    await preview(new Request("https://scrollcraft.space/api/count", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "first_edit" }),
    }) as unknown as NextRequest);
    expect(incrMock).toHaveBeenCalledWith(expect.stringContaining("funnel:preview:"));
  });

  it("writes production counts unprefixed, so the owner reads one set of keys", async () => {
    await post({ event: "first_edit" });
    expect(incrMock).toHaveBeenCalledWith(expect.stringMatching(/^funnel:\d{4}-\d{2}-\d{2}:first_edit$/));
  });
});

describe("it cannot be used to run up someone's bill or fill the store", () => {
  it("is rate limited per address", async () => {
    rateLimitMock.mockResolvedValue({ allowed: false });
    const res = await post({ event: "first_edit" });
    expect(res.status).toBe(429);
    expect(incrMock).not.toHaveBeenCalled();
  });

  it("drops a duration that is not a plausible export", async () => {
    await post({ event: "export_finished", seconds: 99_999 });
    const keys = [...incrMock.mock.calls, ...incrbyMock.mock.calls].map((c) => String(c[0])).join(" ");
    expect(keys).toContain("export_finished");
    expect(keys).not.toContain("seconds_sum");
  });

  it("adds a real duration to the sum in one call rather than one per second", async () => {
    await post({ event: "export_finished", seconds: 12 });
    expect(incrbyMock).toHaveBeenCalledWith(expect.stringContaining("export_finished_seconds_sum"), 12);
    expect(incrbyMock).toHaveBeenCalledTimes(1);
  });

  it("does nothing at all when there is no store configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.resetModules();
    const { POST: fresh } = await import("../app/api/count/route");
    const res = await fresh(
      new Request("https://scrollcraft.space/api/count", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "first_edit" }),
      }) as unknown as NextRequest
    );
    expect(res.status).toBe(204);
    expect(incrMock).not.toHaveBeenCalled();
  });

  it("stays quiet when the store is unreachable, rather than failing the editor", async () => {
    incrMock.mockRejectedValue(new Error("upstash down"));
    const res = await post({ event: "first_edit" });
    expect(res.status).toBe(204);
  });
});

describe("the privacy page keeps up with it", () => {
  const PRIVACY = readFileSync("src/app/privacy/page.tsx", "utf8").replace(/\s+/g, " ");

  it("says the counts are kept by us, not only by an analytics vendor", () => {
    expect(PRIVACY).toMatch(/how many people open the editor/i);
    expect(PRIVACY).toMatch(/Upstash/);
  });
});

describe("reading the counts back is for the owner only", () => {
  function read(headers: Record<string, string> = {}, url = "https://scrollcraft.space/api/count?days=7") {
    const req = new Request(url, { headers }) as unknown as NextRequest;
    // next/server reads the query through nextUrl, which a plain Request has no notion of.
    Object.defineProperty(req, "nextUrl", { value: new URL(url) });
    return GET(req);
  }

  it("is invisible when no token is configured", async () => {
    vi.stubEnv("FUNNEL_TOKEN", "");
    vi.resetModules();
    ({ GET } = await import("../app/api/count/route"));
    expect((await read()).status).toBe(404);
  });

  it("answers 404, not 401, to a wrong token, so it does not announce itself", async () => {
    vi.stubEnv("FUNNEL_TOKEN", "a-long-enough-secret-value");
    vi.resetModules();
    ({ GET } = await import("../app/api/count/route"));
    expect((await read({ authorization: "Bearer wrong" })).status).toBe(404);
    expect((await read()).status).toBe(404);
  });

  it("reports the share who finish, which is the number the whole thing is for", async () => {
    vi.stubEnv("FUNNEL_TOKEN", "a-long-enough-secret-value");
    vi.resetModules();
    ({ GET } = await import("../app/api/count/route"));
    getMock.mockImplementation((key: string) => {
      if (key.endsWith(":editor_opened")) return Promise.resolve(10);
      if (key.endsWith(":export_finished")) return Promise.resolve(4);
      if (key.endsWith("_seconds_sum")) return Promise.resolve(60);
      if (key.endsWith("_seconds_n")) return Promise.resolve(4);
      return Promise.resolve(0);
    });
    const res = await read({ authorization: "Bearer a-long-enough-secret-value" }, "https://scrollcraft.space/api/count?days=1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ days: 1, editor_opened: 10, export_finished: 4, finishedPerOpened: 0.4, meanExportSeconds: 15 });
  });
});
