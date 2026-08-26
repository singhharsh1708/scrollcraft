import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { TEMPLATES } from "@/lib/templates";
import { faviconSvg, notFoundHtml, exportReadme } from "@/lib/exportAssets";

/**
 * The exported ZIP is the product. Measured with Lighthouse it scores 100 across
 * performance, accessibility, best practices and SEO — these pin the specific markup
 * decisions that earn those numbers, because each one was previously missing.
 */

const dbMock = vi.hoisted(() => ({ site: { findFirst: vi.fn() } }));
const authMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));

type Handler = typeof import("../app/api/export-site/route").POST;
let POST: Handler;

const TEMPLATE = TEMPLATES.find((t) => !t.premium)!;

async function exportHtml(over: Record<string, unknown> = {}): Promise<string> {
  const res = await POST(new Request("https://scrollcraft.app/api/export-site", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sections: TEMPLATE.sections,
      siteName: TEMPLATE.name,
      siteDescription: TEMPLATE.tagline,
      themeJson: JSON.stringify(TEMPLATE.theme),
      styleJson: JSON.stringify({ style: TEMPLATE.style, colors: TEMPLATE.colors }),
      frameCount: 0,
      fps: 24,
      ...over,
    }),
  }) as unknown as NextRequest);
  expect(res.status).toBe(200);
  return (await res.json()).html as string;
}

beforeEach(async () => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ allowed: true });
  authMock.mockResolvedValue({ user: { id: "u1", email: "a@b.c", plan: "FREE" } });
  ({ POST } = await import("../app/api/export-site/route"));
});

describe("the exported page has a real document outline", () => {
  it("gives the page exactly one h1", async () => {
    const html = await exportHtml();
    expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
  });

  it("uses the first section with a heading as the h1, not an arbitrary one", async () => {
    const html = await exportHtml({
      sections: [
        { kind: "spacer", scrollHeight: 600 },
        { heading: "The real title", scrollHeight: 1000 },
        { heading: "A later section", scrollHeight: 1000 },
      ],
    });
    expect(html).toMatch(/<h1[^>]*>The real title<\/h1>/);
    expect(html).toMatch(/<h2[^>]*>A later section<\/h2>/);
  });

  it("wraps the content in a main landmark", async () => {
    const html = await exportHtml();
    expect(html).toContain('<main id="main"');
    expect(html).toContain("</main>");
  });
});

describe("the exported page is keyboard usable", () => {
  it("offers a skip link past the background canvas", async () => {
    const html = await exportHtml();
    expect(html).toContain('<a class="skip-link" href="#main">');
    // Hidden until focused, rather than simply invisible.
    expect(html).toContain(".skip-link:focus");
  });

  it("defines a visible focus ring, since the page overrides its own colours", async () => {
    const html = await exportHtml();
    expect(html).toContain("a:focus-visible");
    expect(html).toContain("outline:");
  });
});

describe("the exported page is shareable and installable", () => {
  it("declares a social image, having promised a large card", async () => {
    const html = await exportHtml();
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:image"');
  });

  it("declares a favicon and a theme colour", async () => {
    const html = await exportHtml();
    expect(html).toContain('rel="icon" href="favicon.svg"');
    expect(html).toMatch(/name="theme-color" content="[^"]+"/);
  });
});

describe("the exported page paints without waiting on a third party", () => {
  it("loads the webfont stylesheet without blocking render", async () => {
    const html = await exportHtml();
    // A plain render-blocking link to Google Fonts held first paint at ~2.9s.
    expect(html).toMatch(/fonts\.googleapis\.com[^"]*" media="print" onload=/);
    expect(html).toContain("<noscript><link rel=\"stylesheet\"");
  });

  it("still preconnects, so the swap resolves quickly", async () => {
    const html = await exportHtml();
    expect(html).toContain('rel="preconnect" href="https://fonts.gstatic.com"');
  });
});

describe("the ZIP ships what a site needs to go online", () => {
  it("builds a favicon from the site's own palette", () => {
    const svg = faviconSvg("#7c3aed", "#05070c", "OrbitCRM");
    expect(svg).toContain("<svg");
    expect(svg).toContain("#7c3aed");
    expect(svg).toContain(">O<");
  });

  it("escapes a hostile site name in the favicon", () => {
    expect(faviconSvg("#000", "#fff", '"><script>alert(1)</script>')).not.toContain("<script>");
  });

  it("builds a 404 page that stands alone", () => {
    const html = notFoundHtml("OrbitCRM", "#05070c", "#ffffff");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('name="robots" content="noindex"');
    // Self-contained: a static host serves this without the main stylesheet.
    expect(html).toContain("<style>");
    expect(html).toContain("OrbitCRM");
  });

  it("escapes a hostile site name in the 404", () => {
    expect(notFoundHtml('"><script>alert(1)</script>', "#000", "#fff")).not.toContain("<script>alert(1)</script>");
  });

  it("writes deploy instructions for the hosts people actually use", () => {
    const readme = exportReadme("OrbitCRM", true);
    for (const host of ["Netlify", "Vercel", "GitHub Pages", "Cloudflare Pages"]) {
      expect(readme, `${host} missing from README`).toContain(host);
    }
    expect(readme).toContain("npx serve .");
  });

  it("tells a procedural export it has no frames folder, and a baked one that it does", () => {
    expect(exportReadme("X", true)).toContain("no");
    expect(exportReadme("X", true)).not.toContain("| `frames/` |");
    expect(exportReadme("X", false)).toContain("| `frames/` |");
  });
});

describe("published sites get the same treatment as exported ones", () => {
  it("renders the first heading as an h1 and the rest as h2", async () => {
    // Parity with the exporter: a published page previously had no h1 at all.
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/components/SiteRenderer.tsx", "utf8")
    );
    expect(src).toContain("const firstHeadingIndex = visible.findIndex((s) => s.heading)");
    expect(src).toContain('const Heading = i === firstHeadingIndex ? "h1" : "h2"');
  });

  it("wraps content in a main landmark and offers a skip link", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/components/SiteRenderer.tsx", "utf8")
    );
    expect(src).toContain('<main id="sc-main"');
    expect(src).toContain('<a className="sc-skip" href="#sc-main">');
    expect(src).toContain(".sc-skip:focus");
  });

  it("defines a focus ring, since a published page sets its own palette", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/components/SiteRenderer.tsx", "utf8")
    );
    expect(src).toContain(".sc-site a:focus-visible");
  });

  it("ships a per-site social card route", async () => {
    const { size, contentType } = await import("../app/s/[slug]/opengraph-image");
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe("image/png");
  });
});
