import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";

const dbMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  site: { findFirst: vi.fn(), delete: vi.fn() },
  exportPurchase: { count: vi.fn(), deleteMany: vi.fn() },
}));
const authMock = vi.hoisted(() => vi.fn());
const delMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@vercel/blob", () => ({ del: delMock }));

type Handler = typeof import("../app/api/sites/[id]/route").DELETE;
let DELETE: Handler;

const ctx = { params: Promise.resolve({ id: "s1" }) };
function req(): NextRequest {
  return new Request("https://scrollcraft.app/api/sites/s1", { method: "DELETE" }) as unknown as NextRequest;
}

const FRAMES = JSON.stringify(["https://blob.example/a.jpg", "https://blob.example/b.jpg"]);

beforeEach(async () => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { email: "a@b.c" } });
  dbMock.user.findUnique.mockResolvedValue({ id: "u1" });
  dbMock.site.findFirst.mockResolvedValue({ id: "s1", userId: "u1", framesJson: FRAMES });
  dbMock.exportPurchase.count.mockResolvedValue(0);
  dbMock.exportPurchase.deleteMany.mockResolvedValue({ count: 0 });
  dbMock.site.delete.mockResolvedValue({ id: "s1" });
  delMock.mockResolvedValue(undefined);
  ({ DELETE } = await import("../app/api/sites/[id]/route"));
});

describe("DELETE /api/sites/[id]", () => {
  it("blocks the delete only for PAID or REFUNDED purchases", async () => {
    dbMock.exportPurchase.count.mockResolvedValue(1);
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("HAS_PURCHASE");
    // The blocking count must be scoped to money-movement statuses, not every row.
    expect(dbMock.exportPurchase.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { siteId: "s1", status: { in: ["PAID", "REFUNDED"] } } })
    );
    expect(dbMock.site.delete).not.toHaveBeenCalled();
  });

  it("clears abandoned PENDING/FAILED checkouts so they can't wedge the delete", async () => {
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(200);
    expect(dbMock.exportPurchase.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { siteId: "s1", status: { in: ["PENDING", "FAILED"] } } })
    );
    expect(dbMock.site.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
  });

  it("reclaims the site's hosted frame blobs after deletion", async () => {
    await DELETE(req(), ctx);
    expect(delMock).toHaveBeenCalledWith([
      "https://blob.example/a.jpg",
      "https://blob.example/b.jpg",
    ]);
  });

  it("does not call blob delete when the site has no hosted frames", async () => {
    dbMock.site.findFirst.mockResolvedValue({ id: "s1", userId: "u1", framesJson: null });
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(200);
    expect(delMock).not.toHaveBeenCalled();
  });

  it("still succeeds when blob reclamation fails", async () => {
    delMock.mockRejectedValue(new Error("blob down"));
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(200);
  });
});
