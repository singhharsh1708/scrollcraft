import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { NextRequest } from "next/server";

// A Lemon Squeezy export purchase unlocks exactly one site. If the exported HTML
// were built from the request body, a single $19 purchase would export every site
// the buyer can name — so a FREE user's content must come from the stored site row.

const dbMock = vi.hoisted(() => ({
  exportPurchase: { findFirst: vi.fn() },
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

const ATTACKER_BODY = {
  siteId: "site_paid_for",
  frameCount: 120,
  sections: [{ heading: "SMUGGLED-FROM-BODY", scrollHeight: 1000 }],
  siteName: "SMUGGLED-NAME",
  customCss: ".smuggled{color:red}",
  customHead: "<meta name='smuggled' />",
  fps: 60,
};

const STORED_SITE = {
  name: "STORED-NAME",
  fps: 24,
  sectionsJson: JSON.stringify([{ heading: "STORED-HEADING", scrollHeight: 2000 }]),
  customHead: "<meta name='stored' />",
  customCss: ".stored{color:blue}",
};

function freeSession() {
  return { user: { id: "user_1", email: "a@b.com", plan: "FREE" } };
}

beforeEach(async () => {
  vi.resetModules();
  vi.spyOn(console, "error").mockImplementation(() => {});
  authMock.mockReset().mockResolvedValue(freeSession());
  rateLimitMock.mockReset().mockResolvedValue({ allowed: true, remaining: 9, resetAt: 0 });
  dbMock.exportPurchase.findFirst.mockReset().mockResolvedValue({ id: "ep_1", status: "PAID" });
  dbMock.site.findFirst.mockReset().mockResolvedValue(STORED_SITE);
  ({ POST } = await import("../app/api/export-site/route"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("export-site — FREE users export the site they paid for, not the request body", () => {
  it("builds the export from the stored site record and drops body-supplied content", async () => {
    const res = await POST(exportRequest(ATTACKER_BODY));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.html).toContain("STORED-HEADING");
    expect(body.html).toContain("STORED-NAME");
    expect(body.html).toContain(".stored{color:blue}");
    // None of the request-body content may reach the generated page.
    expect(body.html).not.toContain("SMUGGLED-FROM-BODY");
    expect(body.html).not.toContain("SMUGGLED-NAME");
    expect(body.html).not.toContain("smuggled");
    expect(body.siteName).toBe("STORED-NAME");
    expect(body.fps).toBe(24);
  });

  it("reads the stored site scoped to the session user", async () => {
    await POST(exportRequest(ATTACKER_BODY));

    expect(dbMock.site.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "site_paid_for", userId: "user_1" } })
    );
  });

  it("checks the purchase for the exact site and user before reading anything", async () => {
    await POST(exportRequest(ATTACKER_BODY));

    expect(dbMock.exportPurchase.findFirst).toHaveBeenCalledWith({
      where: { siteId: "site_paid_for", userId: "user_1", status: "PAID" },
    });
  });

  it("402s when the user has no PAID purchase for that site", async () => {
    dbMock.exportPurchase.findFirst.mockResolvedValue(null);

    const res = await POST(exportRequest(ATTACKER_BODY));
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body.code).toBe("PURCHASE_REQUIRED");
    expect(dbMock.site.findFirst).not.toHaveBeenCalled();
  });

  it("402s when no siteId is supplied, rather than exporting body content", async () => {
    const noSiteId: Record<string, unknown> = { ...ATTACKER_BODY };
    delete noSiteId.siteId;

    const res = await POST(exportRequest(noSiteId));
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body.code).toBe("SAVE_REQUIRED");
    expect(dbMock.exportPurchase.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a Prisma filter object smuggled in as siteId", async () => {
    // `{ not: "" }` in a `where` clause would match any owned site and defeat the
    // per-site entitlement, so anything but a plain string is refused.
    const res = await POST(exportRequest({ ...ATTACKER_BODY, siteId: { not: "" } }));
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body.code).toBe("SAVE_REQUIRED");
    expect(dbMock.exportPurchase.findFirst).not.toHaveBeenCalled();
  });

  it("rejects an empty-string siteId", async () => {
    const res = await POST(exportRequest({ ...ATTACKER_BODY, siteId: "" }));

    expect((await res.json()).code).toBe("SAVE_REQUIRED");
    expect(dbMock.exportPurchase.findFirst).not.toHaveBeenCalled();
  });

  it("rejects an over-long siteId instead of passing it to Prisma", async () => {
    const res = await POST(exportRequest({ ...ATTACKER_BODY, siteId: "x".repeat(129) }));

    expect((await res.json()).code).toBe("SAVE_REQUIRED");
    expect(dbMock.exportPurchase.findFirst).not.toHaveBeenCalled();
  });

  it("404s when the purchased site is not owned by the session user", async () => {
    dbMock.site.findFirst.mockResolvedValue(null);

    const res = await POST(exportRequest(ATTACKER_BODY));

    expect(res.status).toBe(404);
  });

  it("refuses to fall back to body sections when the stored site has none", async () => {
    dbMock.site.findFirst.mockResolvedValue({ ...STORED_SITE, sectionsJson: null });

    const res = await POST(exportRequest(ATTACKER_BODY));

    expect(res.status).toBe(400);
    expect(await res.text()).not.toContain("SMUGGLED-FROM-BODY");
  });

  it("refuses to fall back to body sections when the stored content is corrupt", async () => {
    dbMock.site.findFirst.mockResolvedValue({ ...STORED_SITE, sectionsJson: "{not json" });

    const res = await POST(exportRequest(ATTACKER_BODY));

    expect(res.status).toBe(400);
    expect(await res.text()).not.toContain("SMUGGLED-FROM-BODY");
  });

  it("requires a session", async () => {
    authMock.mockResolvedValue(null);

    const res = await POST(exportRequest(ATTACKER_BODY));

    expect(res.status).toBe(401);
    expect(dbMock.exportPurchase.findFirst).not.toHaveBeenCalled();
  });

  it("stops at the rate limit before consulting the paywall", async () => {
    rateLimitMock.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 0 });

    const res = await POST(exportRequest(ATTACKER_BODY));

    expect(res.status).toBe(429);
    expect(dbMock.exportPurchase.findFirst).not.toHaveBeenCalled();
  });
});

describe("export-site — paid plans", () => {
  it("lets a subscriber export the content in the request body without a purchase", async () => {
    authMock.mockResolvedValue({ user: { id: "user_1", email: "a@b.com", plan: "PRO" } });

    const res = await POST(exportRequest(ATTACKER_BODY));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.html).toContain("SMUGGLED-FROM-BODY");
    expect(dbMock.exportPurchase.findFirst).not.toHaveBeenCalled();
    expect(dbMock.site.findFirst).not.toHaveBeenCalled();
  });

  it("treats a session with no plan as FREE", async () => {
    authMock.mockResolvedValue({ user: { id: "user_1", email: "a@b.com" } });
    dbMock.exportPurchase.findFirst.mockResolvedValue(null);

    const res = await POST(exportRequest(ATTACKER_BODY));

    expect(res.status).toBe(402);
  });
});
