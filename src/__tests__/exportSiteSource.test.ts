import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { NextRequest } from "next/server";

// Export is free on every plan, so there is no entitlement left to protect. What still
// matters is where the exported content comes from: when a request names a siteId, the
// stored row is authoritative and the lookup is scoped to the caller. Without that, one
// user could read another's site content by naming its id — and a `siteId` that is not a
// plain string would reach a Prisma `where`, whose generated type also accepts a filter
// object, widening a lookup meant to identify a single row.

const dbMock = vi.hoisted(() => ({
  site: { findFirst: vi.fn() },
}));

const authMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: rateLimitMock,
  getClientIp: () => "1.2.3.4",
}));

type Handler = typeof import("../app/api/export-site/route").POST;
let POST: Handler;

function exportRequest(body: Record<string, unknown>): NextRequest {
  return new Request("https://scrollcraft.app/api/export-site", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const BODY_CONTENT = {
  siteId: "site_1",
  frameCount: 120,
  sections: [{ heading: "FROM-BODY", scrollHeight: 1000 }],
  siteName: "BODY-NAME",
  customCss: ".body{color:red}",
  customHead: "<meta name='frombody' />",
  fps: 60,
};

const STORED_SITE = {
  name: "STORED-NAME",
  description: null,
  styleJson: null,
  fps: 24,
  sectionsJson: JSON.stringify([{ heading: "STORED-HEADING", scrollHeight: 2000 }]),
  customHead: "<meta name='stored' />",
  customCss: ".stored{color:blue}",
  themeJson: null,
};

beforeEach(async () => {
  vi.resetModules();
  vi.spyOn(console, "error").mockImplementation(() => {});
  authMock.mockReset().mockResolvedValue({ user: { id: "user_1", email: "a@b.com", plan: "FREE" } });
  rateLimitMock.mockReset().mockResolvedValue({ allowed: true, remaining: 9, resetAt: 0 });
  dbMock.site.findFirst.mockReset().mockResolvedValue(STORED_SITE);
  ({ POST } = await import("../app/api/export-site/route"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("export-site — a named site is read from storage, not from the request body", () => {
  it("builds the export from the stored record and ignores body-supplied content", async () => {
    const res = await POST(exportRequest(BODY_CONTENT));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.html).toContain("STORED-HEADING");
    expect(body.html).toContain("STORED-NAME");
    expect(body.html).toContain(".stored{color:blue}");
    expect(body.html).not.toContain("FROM-BODY");
    expect(body.html).not.toContain("BODY-NAME");
    expect(body.html).not.toContain("frombody");
    expect(body.siteName).toBe("STORED-NAME");
    expect(body.fps).toBe(24);
  });

  it("scopes the stored-site lookup to the session user", async () => {
    await POST(exportRequest(BODY_CONTENT));

    expect(dbMock.site.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "site_1", userId: "user_1" } })
    );
  });

  it("404s a site the caller does not own rather than exporting it", async () => {
    dbMock.site.findFirst.mockResolvedValue(null);

    const res = await POST(exportRequest({ ...BODY_CONTENT, siteId: "someone_elses" }));

    expect(res.status).toBe(404);
  });
});

describe("export-site — a hostile siteId never reaches Prisma", () => {
  // Anything that is not a plain string is discarded, so the request falls back to
  // exporting its own body — which is free, and reveals nothing stored.
  const hostile: Array<[string, unknown]> = [
    ["a Prisma filter object", { not: "" }],
    ["an empty string", ""],
    ["an over-long id", "x".repeat(129)],
    ["an array", ["site_1"]],
    ["a number", 12345],
    ["null", null],
  ];

  for (const [label, siteId] of hostile) {
    it(`discards ${label} and never queries for a site`, async () => {
      const res = await POST(exportRequest({ ...BODY_CONTENT, siteId }));

      expect(res.status).toBe(200);
      expect(dbMock.site.findFirst).not.toHaveBeenCalled();
      // Falls back to the caller's own body content, which they already possess.
      expect((await res.json()).html).toContain("FROM-BODY");
    });
  }
});

describe("export-site — free on every plan", () => {
  it("exports body content for a FREE user with no saved site", async () => {
    const noSiteId: Record<string, unknown> = { ...BODY_CONTENT };
    delete noSiteId.siteId;

    const res = await POST(exportRequest(noSiteId));

    expect(res.status).toBe(200);
    expect((await res.json()).html).toContain("FROM-BODY");
    expect(dbMock.site.findFirst).not.toHaveBeenCalled();
  });

  it("treats a session with no plan the same as any other", async () => {
    authMock.mockResolvedValue({ user: { id: "user_1", email: "a@b.com" } });

    const res = await POST(exportRequest(BODY_CONTENT));

    expect(res.status).toBe(200);
  });

  it("never answers with a payment-required status", async () => {
    for (const session of [
      { user: { id: "user_1", email: "a@b.com", plan: "FREE" } },
      { user: { id: "user_1", email: "a@b.com" } },
    ]) {
      authMock.mockResolvedValue(session);
      const res = await POST(exportRequest(BODY_CONTENT));
      expect(res.status).not.toBe(402);
    }
  });

  it("still requires a session", async () => {
    authMock.mockResolvedValue(null);
    expect((await POST(exportRequest(BODY_CONTENT))).status).toBe(401);
  });

  it("stops at the rate limit before reading anything", async () => {
    rateLimitMock.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 0 });

    const res = await POST(exportRequest(BODY_CONTENT));

    expect(res.status).toBe(429);
    expect(dbMock.site.findFirst).not.toHaveBeenCalled();
  });
});

describe("export-site — stored content that cannot be used", () => {
  it("refuses to fall back to body sections when the stored site has none", async () => {
    dbMock.site.findFirst.mockResolvedValue({ ...STORED_SITE, sectionsJson: null });

    const res = await POST(exportRequest(BODY_CONTENT));

    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toContain("FROM-BODY");
  });

  it("refuses to fall back to body sections when the stored content is corrupt", async () => {
    dbMock.site.findFirst.mockResolvedValue({ ...STORED_SITE, sectionsJson: "{not json" });

    const res = await POST(exportRequest(BODY_CONTENT));

    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toContain("FROM-BODY");
  });
});
