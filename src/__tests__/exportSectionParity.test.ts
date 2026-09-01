import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { SECTION_LAYOUTS } from "@/lib/siteSchema";
import { layoutStyle } from "@/lib/layoutStyles";
import { TEMPLATES } from "@/lib/templates";

const rateLimitMock = vi.hoisted(() => vi.fn());

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

async function exportHtml(sections: unknown[], over: Record<string, unknown> = {}): Promise<string> {
  const res = await POST(exportRequest({ sections, siteName: "Parity", frameCount: 10, fps: 24, ...over }));
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(typeof json.html).toBe("string");
  return json.html as string;
}

const EDITOR_SRC = readFileSync("src/app/editor/page.tsx", "utf8");

beforeEach(async () => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ allowed: true });
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

describe("exported site description", () => {
  async function exportWith(body: Record<string, unknown>): Promise<string> {
    const res = await POST(exportRequest({
      sections: [{ heading: "A", scrollHeight: 1000 }],
      siteName: "Orrery", frameCount: 10, fps: 24, ...body,
    }));
    expect(res.status).toBe(200);
    return (await res.json()).html as string;
  }

  it("uses the supplied description for both description tags", async () => {
    const html = await exportWith({ siteDescription: "A scroll-driven product tour." });
    expect(html).toContain('<meta name="description" content="A scroll-driven product tour." />');
    expect(html).toContain('<meta property="og:description" content="A scroll-driven product tour." />');
  });

  it("falls back to the site name when no description is set", async () => {
    const html = await exportWith({});
    expect(html).toContain('<meta name="description" content="Orrery" />');
  });

  it("escapes a hostile description", async () => {
    const html = await exportWith({ siteDescription: '"><script>alert(1)</script>' });
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("caps an overlong description", async () => {
    const html = await exportWith({ siteDescription: "x".repeat(500) });
    const match = html.match(/<meta name="description" content="(x+)"/);
    expect(match?.[1].length).toBe(300);
  });
});

describe("the editor hands the exporter what the template asked for", () => {
  const TEMPLATE = TEMPLATES.find((t) => t.sections.some((s) => s.layout && s.layout !== "center"))!;

  it("sends the theme, without which the page ships as the untouched default", async () => {
    // handleExport never included themeJson, so the route fell back to "" on every
    // export: no Google Fonts link and none of the --sc- custom properties. Measured
    // against a production build, an OrbitCRM export carried 0 font links and 3 vars
    // where the template's own theme gives 3 and 11.
    expect(EDITOR_SRC).toContain("themeJson: siteTheme ? JSON.stringify(siteTheme) : undefined,");

    const withTheme = await exportHtml(TEMPLATE.sections, { themeJson: JSON.stringify(TEMPLATE.theme) });
    for (const token of ["fonts.googleapis.com", "--sc-ink:", "--sc-muted:", "--sc-accent:", "--sc-font-display:"]) {
      expect(withTheme, `${token} is missing`).toContain(token);
    }
    const without = await exportHtml(TEMPLATE.sections);
    expect(without).not.toContain("fonts.googleapis.com");
  });

  it("does not stamp its blank-section defaults over a template's layout", () => {
    // defaultSection supplies centre for textAlign, align and justify, which is right
    // for a new empty section. toEditorSections spread it over template sections that
    // carry none of the three, and both the renderer and the exporter read
    // `s.align ?? L.align` — so the stamp won and every left, right and lower-third
    // composition in the catalogue exported dead centre.
    const fn = EDITOR_SRC.slice(EDITOR_SRC.indexOf("function toEditorSections"), EDITOR_SRC.indexOf("function EditorInner"));
    expect(fn).toContain("const L = layoutStyle(s.layout);");
    for (const line of ["textAlign: s.textAlign ?? L.textAlign,", "align: s.align ?? L.align,", "justify: s.justify ?? L.justify,"]) {
      expect(fn, `${line} is missing`).toContain(line);
    }
    // From the exporter's own table, not a second copy of the placement rules.
    expect(layoutStyle("lower-third")).toMatchObject({ align: "flex-end", justify: "flex-start", textAlign: "left" });
  });

  it("keeps a template's mix of placements once those defaults are resolved", async () => {
    const resolved = TEMPLATE.sections.map((sec) => {
      const L = layoutStyle(sec.layout);
      return { ...sec, textAlign: sec.textAlign ?? L.textAlign, align: sec.align ?? L.align, justify: sec.justify ?? L.justify };
    });
    const html = await exportHtml(resolved);
    const placements = new Set(
      [...html.matchAll(/align-items:([a-z-]+); justify-content:([a-z-]+)/g)].map((m) => `${m[1]}/${m[2]}`)
    );
    expect(placements.size, "every section exported to the same placement").toBeGreaterThan(1);
  });
});

describe("exported CTA links go where they say", () => {
  const cta = async (href: string) => {
    const html = await exportHtml([{ heading: "H", ctaLabel: "Go", ctaHref: href, scrollHeight: 1000 }]);
    return /<a href="([^"]*)"[^>]*>Go<\/a>/.exec(html)?.[1];
  };

  it("keeps every form the CTA field accepts", async () => {
    // ctaHrefSchema allows all of these and the editor's link field takes them, but the
    // exporter allowed only http(s), so each shipped as a dead href="#" — an in-page
    // anchor included.
    for (const href of ["https://example.com", "mailto:a@b.com", "tel:+123456", "#pricing", "/pricing", "./docs", "../up"]) {
      expect(await cta(href), `${href} was rewritten`).toBe(href);
    }
  });

  it("still refuses anything that executes or leaves the origin unasked", async () => {
    // The allowlist exists because of the XSS escaping pass; loosening it must not
    // reopen it. // is excluded as well: it satisfies the schema's leading slash but
    // jumps to another origin.
    for (const href of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "  javascript:alert(1)", "data:text/html,x", "vbscript:x", "//evil.com"]) {
      expect(await cta(href), `${href} survived`).toBe("#");
    }
  });
});

describe("exported reveals behave like the preview's", () => {
  it("reveals a section once instead of replaying it on every pass", async () => {
    // SiteRenderer only ever adds its visible class. The exported observer also removed
    // it on exit, so each section faded back to nothing and re-animated every time the
    // visitor scrolled past — a different page from the one they approved.
    const html = await exportHtml([{ heading: "A", reveal: "rise", scrollHeight: 1000 }]);
    expect(html).not.toContain("classList.remove('visible')");
    expect(html).toContain("rootMargin: '0px 0px -8% 0px'");
  });
});

describe("the exported CTA uses the theme's corner radius", () => {
  it("takes the radius from the theme, as the preview already does", async () => {
    // The preview renders borderRadius: var(--sc-radius, 8px); the export hardcoded
    // 0.5rem, which is 8px, so only the two templates that ask for 8 were right.
    // Nineteen of twenty-one ask for something else, three of them for square corners.
    const html = await exportHtml(
      [{ heading: "H", ctaLabel: "Go", ctaHref: "https://x.com", scrollHeight: 1000 }],
      { themeJson: JSON.stringify({ radius: 20 }) }
    );
    const cta = /<a href="https:\/\/x\.com"[^>]*style="([^"]*)"/.exec(html);
    expect(cta, "no CTA anchor was emitted").toBeTruthy();
    expect(cta![1]).toContain("border-radius:var(--sc-radius, 8px)");
    expect(cta![1]).not.toContain("border-radius:0.5rem");
    expect(html).toContain("--sc-radius:20px");
  });
});
