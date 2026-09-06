import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

const fakeEnv: { SARVAM_API_KEY?: string; SARVAM_MODEL?: string } = { SARVAM_API_KEY: "test-key" };
vi.mock("@/lib/env", () => ({ env: fakeEnv, getEnvIssues: () => [] }));

const { GET, POST } = await import("@/app/api/edit-site/route");

const SECTIONS = [
  { id: "s1", kind: "text", layout: "left", heading: "Before", body: "Old copy." },
  { id: "s2", kind: "spacer" },
];

/** A fresh IP per request, so one test's allowance is never another test's failure. */
let ipCounter = 0;
function post(body: unknown, init: RequestInit = {}): NextRequest {
  ipCounter += 1;
  return new Request("https://scrollcraft.app/api/edit-site", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${ipCounter % 250}` },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  }) as unknown as NextRequest;
}

function completion(content: string) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  fakeEnv.SARVAM_API_KEY = "test-key";
  delete fakeEnv.SARVAM_MODEL;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assistant availability", () => {
  it("reports available when a key is configured", async () => {
    expect(await (await GET()).json()).toEqual({ available: true });
  });

  it("reports unavailable when no key is configured", async () => {
    delete fakeEnv.SARVAM_API_KEY;
    expect(await (await GET()).json()).toEqual({ available: false });
  });

  it("is never cached, so a newly configured key takes effect on a reload", async () => {
    expect((await GET()).headers.get("cache-control")).toBe("no-store");
  });

  it("refuses to rewrite when no key is configured", async () => {
    delete fakeEnv.SARVAM_API_KEY;
    const res = await POST(post({ sections: SECTIONS, instruction: "warmer" }));
    expect(res.status).toBe(503);
  });

  it("does not call out when no key is configured", async () => {
    delete fakeEnv.SARVAM_API_KEY;
    const spy = completion("[]");
    vi.stubGlobal("fetch", spy);
    await POST(post({ sections: SECTIONS, instruction: "warmer" }));
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("POST /api/edit-site input handling", () => {
  it("rewrites the copy and leaves the structure alone", async () => {
    vi.stubGlobal("fetch", completion(JSON.stringify([{ heading: "After", body: "New copy." }])));
    const res = await POST(post({ sections: SECTIONS, instruction: "make it warmer" }));
    expect(res.status).toBe(200);
    const { sections } = await res.json();
    expect(sections[0].heading).toBe("After");
    expect(sections[0].layout).toBe("left");
    expect(sections[1]).toEqual(SECTIONS[1]);
  });

  it("rejects an empty instruction before spending a call", async () => {
    const spy = completion("[]");
    vi.stubGlobal("fetch", spy);
    const res = await POST(post({ sections: SECTIONS, instruction: "   " }));
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects a missing instruction", async () => {
    const res = await POST(post({ sections: SECTIONS }));
    expect(res.status).toBe(400);
  });

  it("rejects an instruction long enough to be a prompt dump", async () => {
    const spy = completion("[]");
    vi.stubGlobal("fetch", spy);
    const res = await POST(post({ sections: SECTIONS, instruction: "x".repeat(601) }));
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects sections that are not sections", async () => {
    const res = await POST(post({ sections: [{ heading: 5 }], instruction: "warmer" }));
    expect(res.status).toBe(400);
  });

  it("rejects an empty site", async () => {
    const res = await POST(post({ sections: [], instruction: "warmer" }));
    expect(res.status).toBe(400);
  });

  it("rejects more sections than one request should carry", async () => {
    const many = Array.from({ length: 41 }, (_, i) => ({ id: `s${i}`, heading: "h" }));
    const spy = completion("[]");
    vi.stubGlobal("fetch", spy);
    const res = await POST(post({ sections: many, instruction: "warmer" }));
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON", async () => {
    const res = await POST(post("not json at all"));
    expect(res.status).toBe(400);
  });

  it("rejects an oversized body on its declared length", async () => {
    const req = post({ sections: SECTIONS, instruction: "warmer" });
    req.headers.set("content-length", "9000000");
    const res = await POST(req);
    expect(res.status).toBe(413);
  });
});

describe("POST /api/edit-site upstream failures", () => {
  it("does not apply an edit the model malformed", async () => {
    vi.stubGlobal("fetch", completion("sorry, I cannot"));
    const res = await POST(post({ sections: SECTIONS, instruction: "warmer" }));
    expect(res.status).toBe(422);
    expect(await res.json()).not.toHaveProperty("sections");
  });

  it("does not apply an edit that answers with the wrong number of sections", async () => {
    // One text section and a spacer, so exactly one object is asked for and expected.
    vi.stubGlobal("fetch", completion(JSON.stringify([{ heading: "one" }, { heading: "two" }])));
    const res = await POST(post({ sections: SECTIONS, instruction: "shorter" }));
    expect(res.status).toBe(422);
  });

  it("never puts the key in a response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401 }) as Response) as unknown as typeof fetch
    );
    const res = await POST(post({ sections: SECTIONS, instruction: "warmer" }));
    expect(JSON.stringify(await res.json())).not.toContain("test-key");
  });
});

describe("POST /api/edit-site rate limiting", () => {
  it("cuts one caller off well before the export limit", async () => {
    vi.stubGlobal("fetch", completion(JSON.stringify([{ heading: "ok" }, {}])));
    const ip = "198.51.100.7";
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const req = new Request("https://scrollcraft.app/api/edit-site", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ sections: SECTIONS, instruction: "warmer" }),
      }) as unknown as NextRequest;
      statuses.push((await POST(req)).status);
    }
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    expect(statuses.filter((s) => s === 200).length).toBeLessThanOrEqual(10);
  });
});
