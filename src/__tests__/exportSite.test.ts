import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../auth", () => ({
  auth: vi.fn(),
}));

vi.mock("../lib/rateLimit", () => ({
  rateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));

vi.mock("../lib/db", () => ({
  db: {
    exportPurchase: {
      findFirst: vi.fn(),
    },
  },
}));

describe("export-site HTML template", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders sticky section content wrapper for scroll sections", async () => {
    const { auth } = await import("../auth");
    const { rateLimit, getClientIp } = await import("../lib/rateLimit");
    const { POST } = await import("../app/api/export-site/route");

    vi.mocked(auth).mockResolvedValue({
      user: { email: "test@example.com", id: "user-1", plan: "PRO" },
    } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(rateLimit).mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 });
    vi.mocked(getClientIp).mockReturnValue("127.0.0.1");

    const req = {
      json: async () => ({
        sections: [
          {
            scrollHeight: 2000,
            align: "center",
            justify: "center",
            textAlign: "center",
            heading: "Sticky Heading",
          },
        ],
        frameCount: 10,
        fps: 24,
      }),
    };

    const response = await POST(req as never);
    const payload = await response.json();
    const html = String(payload.html);

    expect(html).toContain(".section-content-wrapper {");
    expect(html).toContain("position: sticky;");
    expect(html).toContain('<div class="section-content-wrapper"');
    expect(html).toContain('<div class="section-content"');
  });
});
