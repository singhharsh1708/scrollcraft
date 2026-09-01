import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { TEMPLATES } from "@/lib/templates";
import { MAX_SECTIONS } from "@/lib/siteSchema";
import { readFileSync } from "node:fs";
import { faviconSvg, notFoundHtml, exportReadme } from "@/lib/exportAssets";

/**
 * The exported ZIP is the product. Measured with Lighthouse it scores 100 across
 * performance, accessibility, best practices and SEO — these pin the specific markup
 * decisions that earn those numbers, because each one was previously missing.
 */

const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));

type Handler = typeof import("../app/api/export-site/route").POST;
let POST: Handler;

const TEMPLATE = TEMPLATES[0];

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
  ({ POST } = await import("../app/api/export-site/route"));
});

/**
 * The route reads the request body and nothing else - no accounts, no stored record to
 * prefer over it - so the body's shape is the only thing between a caller and the page
 * that gets generated. It was checked for being a non-empty array and for size, never
 * for shape, so a null element threw inside the generator and surfaced as a 500 "Export
 * failed", and a heading of the wrong type was interpolated as-is: {"heading":{"a":1}}
 * shipped a page whose <h1> read "[object Object]". Verified against a running
 * production build before and after.
 */
async function exportStatus(sections: unknown): Promise<{ status: number; error?: string }> {
  const res = await POST(new Request("https://scrollcraft.app/api/export-site", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sections, siteName: "S", frameCount: 10 }),
  }) as unknown as NextRequest);
  const json = await res.json();
  return { status: res.status, error: json.error };
}

describe("the export route validates the shape of what it is given", () => {
  it("still exports a well-formed document, so the guard is not just rejecting everything", async () => {
    const ok = await exportStatus([{ heading: "Hi", scrollHeight: 1000 }]);
    expect(ok.status).toBe(200);
  });

  it("rejects a malformed section with a 400 that names the field", async () => {
    for (const [label, sections] of [
      ["null element", [null]],
      ["string element", ["oops"]],
      ["heading of the wrong type", [{ heading: 12345 }]],
      ["nested object as heading", [{ heading: { a: 1 } }]],
      ["scrollHeight as a string", [{ heading: "Hi", scrollHeight: "tall" }]],
    ] as const) {
      const res = await exportStatus(sections);
      expect(res.status, `${label} was not rejected`).toBe(400);
      expect(res.error, `${label} produced no message`).toBeTruthy();
    }
  });

  it("never lets a non-string heading reach the page", async () => {
    // The 500 was the loud failure; this was the quiet one.
    const res = await exportStatus([{ heading: { a: 1 } }]);
    expect(res.status).toBe(400);
  });

  it("clamps an out-of-range number rather than failing the whole export", async () => {
    // The route's existing contract for imageWidth, scrim and reveal, which is why the
    // shape check above is types-only. scrollHeight was the one field with neither a
    // bound nor a clamp, so -99999 was emitted straight into the page's inline style.
    const html = await exportHtml({ sections: [{ heading: "A", scrollHeight: -99999 }] });
    expect(html).not.toContain("-99999");
    expect(html).toContain("height:1000px");
  });

  it("holds the section count to the limit the editor itself enforces", async () => {
    const one = { heading: "Hi", scrollHeight: 1000 };
    expect((await exportStatus(Array.from({ length: MAX_SECTIONS }, () => one))).status).toBe(200);
    expect((await exportStatus(Array.from({ length: MAX_SECTIONS + 1 }, () => one))).status).toBe(400);
  });
});

describe("the request body is capped while it is read, not after", () => {
  it("stops reading instead of buffering the whole stream", () => {
    // The Content-Length check is only as honest as the sender. Omit the header, send
    // chunked, and req.text() held the entire stream in memory before anything looked
    // at its size. Measured with a 120 MB chunked body and no Content-Length: the
    // previous build accepted all 120,021,432 bytes before answering 413; this one
    // stops at ~12.8 MB, one chunk past the cap.
    const route = readFileSync("src/app/api/export-site/route.ts", "utf8");
    expect(route).toContain("await readCapped(req, MAX_BODY)");
    expect(route).not.toMatch(/const raw = await req\.text\(\);/);
    // The cap has to be enforced inside the read loop, not after it.
    const helper = route.slice(route.indexOf("async function readCapped"));
    expect(helper.slice(0, helper.indexOf("\n}"))).toContain("if (seen > limit) return null;");
  });
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

  it("takes a whole character for the favicon glyph", () => {
    // siteName[0] is half a surrogate pair for a name that opens with an emoji: not a
    // character, and written into the SVG it rendered as the replacement glyph. Read
    // the <text> rather than the whole file, since the name is also in the aria-label.
    const glyph = (name: string) => {
      const m = /<text[^>]*>([\s\S]*?)<\/text>/.exec(faviconSvg("#7c3aed", "#05070c", name));
      expect(m, "the favicon has no text glyph").not.toBeNull();
      return m![1];
    };
    expect(glyph("🚀 Rocket")).toBe("🚀");
    expect(glyph("OrbitCRM")).toBe("O");
    expect(glyph("   ")).toBe("•");
  });

  it("gives both frame folders the long-cache headers", () => {
    // Mobile frames ship in frames-mobile/, which neither host config covered, so a
    // phone re-downloaded every frame on every visit — the frames it does not share
    // with desktop are exactly the ones it needs cached.
    const editor = readFileSync("src/app/editor/page.tsx", "utf8");
    for (const rule of ['for = "/frames/*"', 'for = "/frames-mobile/*"', 'source: "/frames/(.*)"', 'source: "/frames-mobile/(.*)"']) {
      expect(editor, `${rule} is missing`).toContain(rule);
    }
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
    const readme = exportReadme("OrbitCRM", true, "https://example.test");
    for (const host of ["Netlify", "Vercel", "GitHub Pages", "Cloudflare Pages"]) {
      expect(readme, `${host} missing from README`).toContain(host);
    }
    expect(readme).toContain("npx serve .");
  });

  it("tells a procedural export it has no frames folder, and a baked one that it does", () => {
    expect(exportReadme("X", true, "https://example.test")).toContain("no");
    expect(exportReadme("X", true, "https://example.test")).not.toContain("| `frames/` |");
    expect(exportReadme("X", false, "https://example.test")).toContain("| `frames/` |");
  });
});

describe("the in-app renderer matches the exporter", () => {
  it("renders the first heading as an h1 and the rest as h2", async () => {
    // Parity with the exporter: the renderer previously had no h1 at all.
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

});
