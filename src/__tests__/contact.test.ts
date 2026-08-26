import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";

const dbMock = vi.hoisted(() => ({ contactMessage: { create: vi.fn() } }));
const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));

type Handler = typeof import("../app/api/contact/route").POST;
let POST: Handler;

function req(body: unknown): NextRequest {
  return new Request("https://scrollcraft.app/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const valid = { name: "Ada", email: "ada@example.com", topic: "Bug report", message: "Something broke." };

beforeEach(async () => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ allowed: true });
  dbMock.contactMessage.create.mockResolvedValue({ id: "c1" });
  ({ POST } = await import("../app/api/contact/route"));
});

describe("POST /api/contact", () => {
  it("persists a valid submission", async () => {
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    expect(dbMock.contactMessage.create).toHaveBeenCalledWith({ data: valid });
  });

  it("rejects a submission with a bad email without touching the database", async () => {
    const res = await POST(req({ ...valid, email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(dbMock.contactMessage.create).not.toHaveBeenCalled();
  });

  it("rejects an empty message", async () => {
    const res = await POST(req({ ...valid, message: "   " }));
    expect(res.status).toBe(400);
    expect(dbMock.contactMessage.create).not.toHaveBeenCalled();
  });

  it("429s when rate limited, without persisting", async () => {
    rateLimitMock.mockResolvedValue({ allowed: false });
    const res = await POST(req(valid));
    expect(res.status).toBe(429);
    expect(dbMock.contactMessage.create).not.toHaveBeenCalled();
  });

  it("surfaces a 500 when the write fails", async () => {
    dbMock.contactMessage.create.mockRejectedValue(new Error("db down"));
    const res = await POST(req(valid));
    expect(res.status).toBe(500);
  });
});
