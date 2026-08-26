import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";

const authMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());
const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));
// The route promisifies execFile from node:child_process; make the ffmpeg probe fail.
vi.mock("util", async (orig) => {
  const actual = await orig<typeof import("util")>();
  return { ...actual, promisify: () => execFileMock };
});
vi.mock("fs/promises", async (orig) => {
  const actual = await orig<typeof import("fs/promises")>();
  return {
    ...actual,
    mkdir: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
});

type Handler = typeof import("../app/api/extract-frames/route").POST;
let POST: Handler;

function jsonReq(body: unknown): NextRequest {
  return new Request("https://scrollcraft.app/api/extract-frames", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function uploadReq(fd: FormData): NextRequest {
  return new Request("https://scrollcraft.app/api/extract-frames", {
    method: "POST",
    body: fd,
  }) as unknown as NextRequest;
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "u1", email: "a@b.c" } });
  rateLimitMock.mockResolvedValue({ allowed: true });
  vi.spyOn(console, "error").mockImplementation(() => {});
  ({ POST } = await import("../app/api/extract-frames/route"));
});

describe("POST /api/extract-frames", () => {
  it("rejects an unauthenticated caller", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(jsonReq({ videoUrl: "https://example.com/a.mp4" }));
    expect(res.status).toBe(401);
  });

  it("429s when rate limited", async () => {
    rateLimitMock.mockResolvedValue({ allowed: false });
    const res = await POST(jsonReq({ videoUrl: "https://example.com/a.mp4" }));
    expect(res.status).toBe(429);
  });

  it("400s a request with no videoUrl", async () => {
    const res = await POST(jsonReq({}));
    expect(res.status).toBe(400);
  });

  it("400s an unparseable videoUrl", async () => {
    const res = await POST(jsonReq({ videoUrl: "not a url" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid/i);
  });

  it("400s an upload with no video file", async () => {
    const fd = new FormData();
    const res = await POST(uploadReq(fd));
    expect(res.status).toBe(400);
  });

  // Regression: with ffmpeg missing this used to return 200 with synthetic
  // /api/demo-frame URLs, so the uploaded video was silently swapped for a generic
  // gradient and the user only found out at export time.
  it("fails loudly instead of substituting placeholder demo frames when ffmpeg is missing", async () => {
    execFileMock.mockRejectedValue(new Error("ffmpeg: not found"));
    const fd = new FormData();
    fd.append("video", new File([new Uint8Array([1, 2, 3, 4])], "clip.mp4", { type: "video/mp4" }));

    const res = await POST(uploadReq(fd));
    const body = await res.text();

    expect(res.status).toBe(503);
    expect(body).toContain("FFMPEG_UNAVAILABLE");
    expect(body).not.toContain("/api/demo-frame");
    expect(body).not.toContain('"demo":true');
  });
});
