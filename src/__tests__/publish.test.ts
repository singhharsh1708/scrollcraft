import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { PLANS } from "@/lib/plans";

const dbMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  site: { findFirst: vi.fn(), count: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));
const authMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));

type Handler = typeof import("../app/api/sites/[id]/publish/route").POST;
let POST: Handler;

const SECTIONS = JSON.stringify([{ heading: "A", scrollHeight: 1000 }]);
const STYLE = JSON.stringify({ style: "gradient", colors: ["#111111", "#222222", "#333333"] });

function req(action: string): NextRequest {
  return new Request("https://scrollcraft.app/api/sites/s1/publish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  }) as unknown as NextRequest;
}

const ctx = { params: Promise.resolve({ id: "s1" }) };

function site(over: Record<string, unknown> = {}) {
  return {
    id: "s1", name: "My Launch", published: false, publishSlug: null,
    sectionsJson: SECTIONS, styleJson: STYLE, framesJson: null,
    ...over,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ allowed: true });
  authMock.mockResolvedValue({ user: { email: "a@b.c" } });
  dbMock.user.findUnique.mockResolvedValue({ id: "u1", plan: "FREE" });
  dbMock.site.count.mockResolvedValue(0);
  dbMock.site.update.mockResolvedValue({ id: "s1" });
  // Run the transaction callback against a tx that advisory-locks (a no-op here), counts,
  // and updates — the count is what the allowance tests drive.
  dbMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    Promise.resolve(fn({
      $executeRaw: vi.fn().mockResolvedValue(1),
      site: { count: dbMock.site.count, update: dbMock.site.update },
    }))
  );
  dbMock.site.count.mockResolvedValue(0);
  ({ POST } = await import("../app/api/sites/[id]/publish/route"));
});

describe("publish", () => {
  it("rejects an unauthenticated request", async () => {
    authMock.mockResolvedValue(null);
    expect((await POST(req("publish"), ctx)).status).toBe(401);
  });

  it("404s a site the caller does not own", async () => {
    dbMock.site.findFirst.mockResolvedValue(null);
    expect((await POST(req("publish"), ctx)).status).toBe(404);
    expect(dbMock.site.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "u1" }) })
    );
  });

  it("publishes a site with a background recipe and returns a slug from its name", async () => {
    dbMock.site.findFirst.mockResolvedValue(site());
    const res = await POST(req("publish"), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.published).toBe(true);
    expect(body.slug).toMatch(/^my-launch-[a-z0-9]{6}$/);
    expect(dbMock.$transaction).toHaveBeenCalled();
  });

  it("refuses a site whose background cannot be rebuilt", async () => {
    dbMock.site.findFirst.mockResolvedValue(site({ styleJson: null, framesJson: null }));
    const res = await POST(req("publish"), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("NO_BACKGROUND");
  });

  it("accepts hosted frame URLs in place of a recipe", async () => {
    dbMock.site.findFirst.mockResolvedValue(site({
      styleJson: null,
      framesJson: JSON.stringify(["https://blob.example/f0.jpg", "https://blob.example/f1.jpg"]),
    }));
    expect((await POST(req("publish"), ctx)).status).toBe(200);
  });

  it("rejects data-URI frames as a background source", async () => {
    dbMock.site.findFirst.mockResolvedValue(site({
      styleJson: null,
      framesJson: JSON.stringify(["data:image/jpeg;base64,xxxx"]),
    }));
    expect((await POST(req("publish"), ctx)).status).toBe(400);
  });

  it("refuses a site with no visible sections", async () => {
    dbMock.site.findFirst.mockResolvedValue(site({
      sectionsJson: JSON.stringify([{ heading: "A", visible: false }]),
    }));
    expect((await POST(req("publish"), ctx)).status).toBe(400);
  });

  it("enforces the plan's publish allowance inside the locked transaction", async () => {
    dbMock.site.findFirst.mockResolvedValue(site());
    dbMock.site.count.mockResolvedValue(PLANS.FREE.sites);
    const res = await POST(req("publish"), ctx);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("PUBLISH_LIMIT");
    expect(body.allowance).toBe(PLANS.FREE.sites);
    expect(dbMock.site.update).not.toHaveBeenCalled();
  });

  it("republishing an already-published site does not spend allowance and keeps its slug", async () => {
    dbMock.site.findFirst.mockResolvedValue(site({ published: true, publishSlug: "my-launch-abc123" }));
    const res = await POST(req("publish"), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).slug).toBe("my-launch-abc123");
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("retries on a slug collision instead of failing", async () => {
    dbMock.site.findFirst.mockResolvedValue(site());
    dbMock.$transaction
      .mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }))
      .mockImplementationOnce((fn: (tx: unknown) => unknown) =>
        Promise.resolve(fn({
          $executeRaw: vi.fn().mockResolvedValue(1),
          site: { count: vi.fn().mockResolvedValue(0), update: vi.fn().mockResolvedValue({ id: "s1" }) },
        }))
      );
    const res = await POST(req("publish"), ctx);
    expect(res.status).toBe(200);
    expect(dbMock.$transaction).toHaveBeenCalledTimes(2);
  });

  it("unpublishes without touching the slug, so republishing restores the same URL", async () => {
    dbMock.site.findFirst.mockResolvedValue(site({ published: true, publishSlug: "my-launch-abc123" }));
    const res = await POST(req("unpublish"), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).slug).toBe("my-launch-abc123");
    expect(dbMock.site.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { published: false } })
    );
  });

  it("rejects an unknown action", async () => {
    dbMock.site.findFirst.mockResolvedValue(site());
    expect((await POST(req("republish"), ctx)).status).toBe(400);
  });
});
