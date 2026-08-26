import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { TEMPLATES } from "@/lib/templates";
import { withheldSectionsFor } from "@/lib/premiumTemplateSections";

// This route is the paywall. If it hands the withheld sections to anyone who has not
// bought the template, the premium tier is decoration.

const dbMock = vi.hoisted(() => ({
  templatePurchase: { findFirst: vi.fn(), create: vi.fn() },
  user: { findUnique: vi.fn() },
}));
const authMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));

type Handler = typeof import("../app/api/templates/[slug]/route").GET;
let GET: Handler;

const PREMIUM = TEMPLATES.find((t) => t.premium)!;
const FREE = TEMPLATES.find((t) => !t.premium)!;

function req(): NextRequest {
  return new Request("https://scrollcraft.app/api/templates/x") as unknown as NextRequest;
}
const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });

/** A distinctive paragraph that exists only in the withheld half. */
function withheldCopy(slug: string): string {
  const secs = withheldSectionsFor(slug) ?? [];
  const body = secs.map((s) => s.body).find((b): b is string => !!b && b.length > 30);
  expect(body, `${slug} has no withheld body copy to test with`).toBeTruthy();
  return body!;
}

beforeEach(async () => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ allowed: true });
  authMock.mockResolvedValue({ user: { id: "u1", email: "a@b.c" } });
  dbMock.templatePurchase.findFirst.mockResolvedValue(null);
  ({ GET } = await import("../app/api/templates/[slug]/route"));
});

describe("GET /api/templates/[slug] — free templates", () => {
  it("serves a free template with no session and no lookup", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(req(), ctx(FREE.slug));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.premium).toBe(false);
    expect(body.sections.length).toBe(FREE.sections.length);
    expect(dbMock.templatePurchase.findFirst).not.toHaveBeenCalled();
  });

  it("404s an unknown slug", async () => {
    expect((await GET(req(), ctx("no-such-template"))).status).toBe(404);
  });
});

describe("GET /api/templates/[slug] — premium templates", () => {
  it("401s an anonymous visitor without leaking a single withheld paragraph", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(req(), ctx(PREMIUM.slug));
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain(withheldCopy(PREMIUM.slug));
  });

  it("402s a signed-in visitor who has not bought it, and leaks nothing", async () => {
    const res = await GET(req(), ctx(PREMIUM.slug));
    expect(res.status).toBe(402);
    const text = await res.text();
    expect(text).not.toContain(withheldCopy(PREMIUM.slug));
    expect(JSON.parse(text).code).toBe("PURCHASE_REQUIRED");
  });

  it("serves the complete template once a PAID purchase exists", async () => {
    dbMock.templatePurchase.findFirst.mockResolvedValue({ id: "tp1" });
    const res = await GET(req(), ctx(PREMIUM.slug));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.premium).toBe(true);
    expect(body.sections.length).toBeGreaterThan(PREMIUM.sections.length);
    expect(JSON.stringify(body.sections)).toContain(withheldCopy(PREMIUM.slug));
  });

  it("only accepts a PAID purchase, scoped to the caller and the slug", async () => {
    dbMock.templatePurchase.findFirst.mockResolvedValue({ id: "tp1" });
    await GET(req(), ctx(PREMIUM.slug));
    expect(dbMock.templatePurchase.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1", templateSlug: PREMIUM.slug, status: "PAID" },
      })
    );
  });

  it("does not accept a PENDING purchase as entitlement", async () => {
    // findFirst is filtered on status PAID, so a pending row must not resolve it.
    dbMock.templatePurchase.findFirst.mockImplementation(
      async ({ where }: { where: { status: string } }) => (where.status === "PAID" ? null : { id: "pending" })
    );
    expect((await GET(req(), ctx(PREMIUM.slug))).status).toBe(402);
  });

  it("rate limits before checking entitlement", async () => {
    rateLimitMock.mockResolvedValue({ allowed: false });
    const res = await GET(req(), ctx(PREMIUM.slug));
    expect(res.status).toBe(429);
    expect(dbMock.templatePurchase.findFirst).not.toHaveBeenCalled();
  });

  it("withholds content for every premium template, not just the first", async () => {
    for (const t of TEMPLATES.filter((x) => x.premium)) {
      dbMock.templatePurchase.findFirst.mockResolvedValue(null);
      const res = await GET(req(), ctx(t.slug));
      expect(res.status, t.slug).toBe(402);
      expect(await res.text(), t.slug).not.toContain(withheldCopy(t.slug));
    }
  });
});
