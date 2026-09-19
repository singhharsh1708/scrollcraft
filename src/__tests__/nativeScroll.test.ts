import { describe, it, expect, beforeEach, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import type { NextRequest } from "next/server";

const rateLimitMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));

type Handler = typeof import("../app/api/export-site/route").POST;
let POST: Handler;

beforeEach(async () => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ allowed: true });
  ({ POST } = await import("../app/api/export-site/route"));
});

async function exportTemplate(t: { name: string; tagline: string; sections: unknown[]; theme: unknown; style: string; colors: string[] }) {
  const res = await POST(
    new Request("https://scrollcraft.space/api/export-site", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        siteName: t.name, siteDescription: t.tagline, fps: 24, frameCount: 0, sections: t.sections,
        themeJson: JSON.stringify(t.theme), styleJson: JSON.stringify({ style: t.style, colors: t.colors }),
      }),
    }) as unknown as NextRequest
  );
  expect(res.status).toBe(200);
  return (await res.json()).html as string;
}

/**
 * Scrolling belongs to the visitor.
 *
 * The site and every export shipped a smooth-scroll library that took over the wheel and
 * eased each movement. Measured in Chrome with three wheel notches (360px of input): an
 * export as shipped had moved 46px after 100ms and caught up after 1,580ms, and the same
 * export scrolling natively had moved 120px after 100ms and 360px after 300ms. Taking
 * over the scroll is the complaint that comes up first about scroll-animated sites.
 */
describe("the scroll is the visitor's own", () => {
  it("does not take over scrolling on the site itself", () => {
    expect(readFileSync("src/app/layout.tsx", "utf8")).not.toMatch(/SmoothScroll|lenis/i);
    expect(existsSync("src/components/SmoothScroll.tsx")).toBe(false);
    expect(readFileSync("package.json", "utf8")).not.toContain("lenis");
  });

  it("does not ship a smooth-scroll library in an export", async () => {
    const { TEMPLATES } = await import("@/lib/templates");
    const html = await exportTemplate(TEMPLATES[0]);
    expect(html.toLowerCase()).not.toContain("lenis");
    expect(html).toContain("window.addEventListener('scroll', onScroll, { passive: true });");
    expect(existsSync("public/lenis.min.js")).toBe(false);
    expect(readFileSync("src/app/editor/page.tsx", "utf8")).not.toMatch(/lenis/i);
  });

  it("only claims it on the landing page because it is true", () => {
    // The FAQ says nothing slows, smooths or snaps the scroll; the tests above hold that.
    expect(readFileSync("src/app/HomeClient.tsx", "utf8")).toContain("Nothing slows, smooths or snaps the scroll");
  });
});

describe("the README's page size is the size of a real export", () => {
  it("stays about 30 KB across every template", async () => {
    // Measured before writing the sentence: 28.2 to 30.5 KB across all 21 templates.
    const { TEMPLATES } = await import("@/lib/templates");
    const sizes: number[] = [];
    for (const t of TEMPLATES) sizes.push(Buffer.byteLength(await exportTemplate(t)));
    expect(Math.max(...sizes) / 1024, "an export outgrew the README's figure").toBeLessThan(34);
    expect(Math.min(...sizes) / 1024).toBeGreaterThan(26);
  });
});
