import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { SECTION_LAYOUTS } from "@/lib/siteSchema";

const dbMock = vi.hoisted(() => ({
  exportPurchase: { findFirst: vi.fn() },
  site: { findFirst: vi.fn() },
}));
const authMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));

type Handler = typeof import("../app/api/export-site/route").POST;
let POST: Handler;

function exportRequest(body: Record<string, unknown>): NextRequest {
  return new Request("https://scrollcraft.app/api/export-site", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

async function exportHtml(sections: unknown[]): Promise<string> {
  const res = await POST(exportRequest({ sections, siteName: "Parity", frameCount: 10, fps: 24 }));
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(typeof json.html).toBe("string");
  return json.html as string;
}

beforeEach(async () => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ allowed: true });
  authMock.mockResolvedValue({ user: { id: "u1", email: "a@b.c", plan: "PRO" } });
  ({ POST } = await import("../app/api/export-site/route"));
});

describe("exported sections keep every field the schema allows", () => {
  it("renders each layout with its own alignment rather than centring everything", async () => {
    const html = await exportHtml(
      SECTION_LAYOUTS.map((layout, i) => ({ heading: `H${i}`, layout, scrollHeight: 1000 }))
    );
    expect(html).toContain("justify-content:flex-start");
    expect(html).toContain("justify-content:flex-end");
    expect(html).toContain("align-items:flex-end");
    expect(html).toContain("align-items:flex-start");
    expect(html).toContain("text-align:left");
  });

  it("renders a section image with its alt text", async () => {
    const html = await exportHtml([{
      heading: "With art",
      image: "https://cdn.example.com/logo.png",
      imageAlt: "Orrery logo",
      scrollHeight: 1000,
    }]);
    expect(html).toContain('src="https://cdn.example.com/logo.png"');
    expect(html).toContain('alt="Orrery logo"');
  });

  it("caps an oversized imageWidth", async () => {
    const html = await exportHtml([{
      heading: "Big", image: "https://cdn.example.com/a.png", imageAlt: "a", imageWidth: 99999, scrollHeight: 1000,
    }]);
    expect(html).toContain("max-width:min(100%, 1600px)");
  });

  it("drops a relative image, which would 404 inside the exported zip", async () => {
    const html = await exportHtml([{
      heading: "Local", image: "assets/img_00.png", imageAlt: "a", scrollHeight: 1000,
    }]);
    expect(html).not.toContain("assets/img_00.png");
    expect(html).toContain("Local");
  });

  it("escapes hostile alt text", async () => {
    const html = await exportHtml([{
      heading: "X",
      image: "https://cdn.example.com/a.png",
      imageAlt: '"><script>alert(1)</script>',
      scrollHeight: 1000,
    }]);
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("still centres a legacy section that names no layout", async () => {
    const html = await exportHtml([{ heading: "Legacy", scrollHeight: 1000 }]);
    expect(html).toContain("justify-content:center");
    expect(html).toContain("text-align:center");
  });

  it("keeps honouring an explicit align that overrides the layout", async () => {
    const html = await exportHtml([{ heading: "X", layout: "center", align: "flex-end", scrollHeight: 1000 }]);
    expect(html).toContain("align-items:flex-end");
  });
});

describe("exported sections honour kinds and reveals", () => {
  it("carries the reveal and defaults to rise", async () => {
    const html = await exportHtml([
      { heading: "A", reveal: "mask", scrollHeight: 1000 },
      { heading: "B", scrollHeight: 1000 },
    ]);
    expect(html).toContain('class="section-content" data-reveal="mask"');
    expect(html).toContain('class="section-content" data-reveal="rise"');
  });

  it("falls back to rise for a reveal the schema would not allow", async () => {
    const html = await exportHtml([{ heading: "A", reveal: "explode", scrollHeight: 1000 }]);
    expect(html).toContain('class="section-content" data-reveal="rise"');
    expect(html).not.toContain("explode");
  });

  it("renders a statement heading with its own class", async () => {
    const html = await exportHtml([{ heading: "Loud", kind: "statement", scrollHeight: 1000 }]);
    expect(html).toContain("sc-display sc-statement");
  });

  it("renders a spacer as empty track and keeps it in the scroll total", async () => {
    const html = await exportHtml([
      { heading: "A", scrollHeight: 1000 },
      { kind: "spacer", scrollHeight: 800 },
    ]);
    expect(html).toContain('aria-hidden="true" style="height:800px');
    expect(html).toContain("const totalScrollHeight = 2800;");
  });

  it("ships the reveal stylesheet so the data attributes mean something", async () => {
    const html = await exportHtml([{ heading: "A", reveal: "stagger", scrollHeight: 1000 }]);
    expect(html).toContain('.section-content[data-reveal="stagger"] > *');
    expect(html).toContain('.section-content[data-reveal="mask"]');
    expect(html).toContain("prefers-reduced-motion");
  });

  it("reads its palette from theme custom properties so a themed site keeps its colours", async () => {
    const html = await exportHtml([{ heading: "A", body: "b", ctaLabel: "Go", ctaHref: "https://x.com", eyebrow: "e", scrollHeight: 1000 }]);
    expect(html).toContain("var(--sc-ink, #ffffff)");
    expect(html).toContain("var(--sc-muted, rgba(255,255,255,0.72))");
    expect(html).toContain("var(--sc-accent, #7c3aed)");
    expect(html).toContain("var(--sc-accent-text, #ede9fe)");
  });
});

describe("exported sections honour the scrim", () => {
  it("emits none by default", async () => {
    const html = await exportHtml([{ heading: "A", scrollHeight: 1000 }]);
    expect(html).not.toContain("radial-gradient(ellipse 120%");
  });

  it("renders one when the section asks", async () => {
    const html = await exportHtml([{ heading: "A", scrim: 0.4, scrollHeight: 1000 }]);
    expect(html).toContain("rgba(0,0,0,0.4) 0%");
  });

  it("clamps a scrim outside 0-1", async () => {
    const html = await exportHtml([{ heading: "A", scrim: 5, scrollHeight: 1000 }]);
    expect(html).toContain("rgba(0,0,0,1) 0%");
  });
});

describe("exported scroll hint", () => {
  it("does not capture clicks over the copy beneath it", async () => {
    const html = await exportHtml([{ heading: "A", ctaLabel: "Buy", ctaHref: "https://x.com", scrollHeight: 1000 }]);
    const hint = /#scroll-hint\s*\{([^}]*)\}/.exec(html);
    expect(hint).not.toBeNull();
    expect(hint![1]).toContain("pointer-events: none");
  });
});

describe("exported head and resilience", () => {
  it("emits a meta description and social tags", async () => {
    const html = await exportHtml([{ heading: "A", scrollHeight: 1000 }]);
    expect(html).toContain('<meta name="description"');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:card"');
  });

  it("carries a noscript fallback so a no-JS visitor sees content", async () => {
    const html = await exportHtml([{ heading: "A", scrollHeight: 1000 }]);
    expect(html).toContain("<noscript>");
    expect(html).toMatch(/<noscript>[\s\S]*data-reveal\][\s\S]*opacity: 1 !important/);
  });

  it("decodes frames off the scroll path", async () => {
    const html = await exportHtml([{ heading: "A", scrollHeight: 1000 }]);
    expect(html).toContain("img.decode");
    expect(html).toContain("decoding = 'async'");
  });

  it("excludes a hidden section from the HTML and the total scroll height", async () => {
    const html = await exportHtml([
      { heading: "Shown", scrollHeight: 1000 },
      { heading: "Draft", visible: false, scrollHeight: 5000 },
    ]);
    expect(html).toContain("Shown");
    expect(html).not.toContain("Draft");
    // 1000 (the one visible section) + the 1000px trailing viewport; the hidden 5000 is
    // never counted.
    expect(html).toContain("height: 2000px");
  });

  it("refuses an export with no visible section", async () => {
    const res = await POST(exportRequest({
      sections: [{ heading: "Hidden", visible: false, scrollHeight: 1000 }],
      siteName: "Parity", frameCount: 10, fps: 24,
    }));
    expect(res.status).toBe(400);
  });

  it("rejects a sections payload past the count cap", async () => {
    const many = Array.from({ length: 201 }, (_, i) => ({ heading: `S${i}`, scrollHeight: 1000 }));
    const res = await POST(exportRequest({ sections: many, siteName: "Big", frameCount: 10, fps: 24 }));
    expect(res.status).toBe(400);
  });
});

describe("exported page accessibility and audio", () => {
  it("gives the background canvas an accessible name, like the in-app engine does", async () => {
    const html = await exportHtml([{ heading: "A", scrollHeight: 1000 }]);
    expect(html).toMatch(/<canvas id="scroll-canvas"[^>]*role="img"/);
    expect(html).toMatch(/<canvas id="scroll-canvas"[^>]*aria-label="[^"]+"/);
  });

  it("names the canvas after the site when there is a site name", async () => {
    const res = await POST(exportRequest({
      sections: [{ heading: "A", scrollHeight: 1000 }],
      siteName: "Orrery", frameCount: 10, fps: 24,
    }));
    const html = (await res.json()).html as string;
    expect(html).toContain('aria-label="Orrery animated scroll background"');
  });

  it("escapes a hostile site name in the canvas label", async () => {
    const res = await POST(exportRequest({
      sections: [{ heading: "A", scrollHeight: 1000 }],
      siteName: '"><script>alert(1)</script>', frameCount: 10, fps: 24,
    }));
    const html = (await res.json()).html as string;
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("routes audio gain through WebAudio so the ramp is not a no-op on iOS", async () => {
    const res = await POST(exportRequest({
      sections: [{ heading: "A", scrollHeight: 1000 }],
      siteName: "A", frameCount: 10, fps: 24, hasAudio: true,
    }));
    const html = (await res.json()).html as string;
    expect(html).toContain("createMediaElementSource");
    expect(html).toContain("createGain");
    // Every volume change must go through the helper, not the ignored element property.
    expect(html).not.toMatch(/audio\.volume\s*=\s*targetVol/);
    expect(html).toContain("setVol(targetVol)");
  });

  it("resumes a suspended AudioContext on the first scroll gesture", async () => {
    const res = await POST(exportRequest({
      sections: [{ heading: "A", scrollHeight: 1000 }],
      siteName: "A", frameCount: 10, fps: 24, hasAudio: true,
    }));
    const html = (await res.json()).html as string;
    expect(html).toContain("ctx.resume()");
  });
});
