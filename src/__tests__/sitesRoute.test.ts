import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";

// The plan allowance is covered in siteAllowance.test.ts. This covers the rest of the
// endpoint: listing, ownership on update, the payload caps, and the validation that
// stands between a request body and the database.

const dbMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  site: { count: vi.fn(), create: vi.fn(), update: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
}));
const authMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));

type Routes = typeof import("../app/api/sites/route");
let POST: Routes["POST"];
let GET: Routes["GET"];

function post(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new Request("https://scrollcraft.app/api/sites", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as NextRequest;
}

const SECTIONS = JSON.stringify([{ heading: "A", scrollHeight: 1000 }]);

beforeEach(async () => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ allowed: true });
  authMock.mockResolvedValue({ user: { id: "u1", email: "a@b.c" } });
  dbMock.user.findUnique.mockResolvedValue({ id: "u1", plan: "PRO" });
  dbMock.site.count.mockResolvedValue(0);
  dbMock.site.create.mockResolvedValue({ id: "new-site" });
  dbMock.site.update.mockResolvedValue({ id: "s1" });
  dbMock.site.findFirst.mockResolvedValue({ id: "s1", userId: "u1" });
  dbMock.site.findMany.mockResolvedValue([]);
  ({ POST, GET } = await import("../app/api/sites/route"));
});

describe("GET /api/sites", () => {
  it("rejects an unauthenticated caller", async () => {
    authMock.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("404s when the session has no matching user", async () => {
    dbMock.user.findUnique.mockResolvedValue(null);
    expect((await GET()).status).toBe(404);
  });

  it("lists only the caller's own sites", async () => {
    await GET();
    expect(dbMock.site.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } })
    );
  });

  it("does not leak site content in the listing", async () => {
    await GET();
    const select = dbMock.site.findMany.mock.calls[0][0].select;
    for (const heavy of ["sectionsJson", "framesJson", "customHead", "customCss"]) {
      expect(select[heavy]).toBeUndefined();
    }
  });
});

describe("POST /api/sites — guards before the database", () => {
  it("rejects an unauthenticated caller", async () => {
    authMock.mockResolvedValue(null);
    expect((await POST(post({ name: "x" }))).status).toBe(401);
  });

  it("429s when rate limited, without creating anything", async () => {
    rateLimitMock.mockResolvedValue({ allowed: false });
    expect((await POST(post({ name: "x" }))).status).toBe(429);
    expect(dbMock.site.create).not.toHaveBeenCalled();
  });

  it("413s on a declared content-length over the cap, before reading the body", async () => {
    const res = await POST(post({ name: "x" }, { "content-length": String(20_000_000) }));
    expect(res.status).toBe(413);
    expect(dbMock.site.create).not.toHaveBeenCalled();
  });

  it("400s a malformed JSON body instead of throwing a bare 500", async () => {
    const res = await POST(post("{ not json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid JSON body");
  });

  it("400s a body that fails schema validation", async () => {
    const res = await POST(post({ fps: 9999 }));
    expect(res.status).toBe(400);
    expect(dbMock.site.create).not.toHaveBeenCalled();
  });

  it("400s sectionsJson that is not a valid section array", async () => {
    const res = await POST(post({ name: "x", sectionsJson: JSON.stringify([{ heading: 42 }]) }));
    expect(res.status).toBe(400);
    expect(dbMock.site.create).not.toHaveBeenCalled();
  });

  it("400s an audioUrl that is not a URL", async () => {
    const res = await POST(post({ name: "x", audioUrl: "javascript:alert(1)" }));
    expect(res.status).toBe(400);
  });

  it("accepts a valid create", async () => {
    const res = await POST(post({ name: "Launch", sectionsJson: SECTIONS, fps: 24 }));
    expect(res.status).toBe(200);
    expect(dbMock.site.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "u1", name: "Launch" }) })
    );
  });
});

describe("POST /api/sites — updating someone else's site", () => {
  it("404s rather than updating a site the caller does not own", async () => {
    dbMock.site.findFirst.mockResolvedValue(null);
    const res = await POST(post({ id: "not-mine", name: "hijacked" }));
    expect(res.status).toBe(404);
    expect(dbMock.site.update).not.toHaveBeenCalled();
  });

  it("scopes the ownership lookup by the caller's user id", async () => {
    await POST(post({ id: "s1", name: "Renamed" }));
    expect(dbMock.site.findFirst).toHaveBeenCalledWith({ where: { id: "s1", userId: "u1" } });
  });

  it("does not spend allowance on an update", async () => {
    await POST(post({ id: "s1", name: "Renamed" }));
    expect(dbMock.site.count).not.toHaveBeenCalled();
    expect(dbMock.site.update).toHaveBeenCalled();
  });
});
