import { describe, it, expect, beforeEach, vi } from "vitest";

const dbMock = vi.hoisted(() => ({ site: { findFirst: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { getPublishedSite } from "@/lib/publishedSite";
import { compileTheme, sanitizeHostedCss, varsToCss, TYPE_SCALES } from "@/lib/themeCss";

const SECTIONS = JSON.stringify([{ heading: "A", scrollHeight: 1000 }]);
const STYLE = JSON.stringify({ style: "wave", colors: ["#111111", "#222222", "#333333"] });

function row(over: Record<string, unknown> = {}) {
  return {
    name: "Launch",
    sectionsJson: SECTIONS,
    themeJson: null,
    styleJson: STYLE,
    framesJson: null,
    customCss: null,
    user: { plan: "FREE" },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPublishedSite", () => {
  it("only ever queries for published rows", async () => {
    dbMock.site.findFirst.mockResolvedValue(null);
    await getPublishedSite("some-slug");
    expect(dbMock.site.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { publishSlug: "some-slug", published: true } })
    );
  });

  it("returns the renderable site with a badge for a FREE owner", async () => {
    dbMock.site.findFirst.mockResolvedValue(row());
    const site = await getPublishedSite("launch-abc123");
    expect(site?.name).toBe("Launch");
    expect(site?.styleSpec?.style).toBe("wave");
    expect(site?.badge).toBe(true);
  });

  it("drops the badge for a paid owner", async () => {
    dbMock.site.findFirst.mockResolvedValue(row({ user: { plan: "PRO" } }));
    expect((await getPublishedSite("x"))?.badge).toBe(false);
  });

  it("returns null when there is nothing to draw the background from", async () => {
    dbMock.site.findFirst.mockResolvedValue(row({ styleJson: null, framesJson: null }));
    expect(await getPublishedSite("x")).toBeNull();
  });

  it("returns null for a row whose sections no longer parse", async () => {
    dbMock.site.findFirst.mockResolvedValue(row({ sectionsJson: "{broken" }));
    expect(await getPublishedSite("x")).toBeNull();
  });

  it("passes only http(s) frame URLs through, never data URIs", async () => {
    dbMock.site.findFirst.mockResolvedValue(row({
      styleJson: null,
      framesJson: JSON.stringify(["https://blob.example/a.jpg", "data:image/jpeg;base64,x"]),
    }));
    expect(await getPublishedSite("x")).toBeNull();
  });

  it("sanitises custom CSS and never exposes customHead at all", async () => {
    dbMock.site.findFirst.mockResolvedValue(row({
      customCss: '@import url(https://evil.example/x.css); h1 { color: red; } </style><script>alert(1)</script>',
    }));
    const site = await getPublishedSite("x");
    expect(site?.customCss).not.toContain("@import");
    expect(site?.customCss).not.toContain("<script");
    expect(site?.customCss).not.toContain("</style");
    expect(site?.customCss).toContain("h1 { color: red; }");
    expect(site).not.toHaveProperty("customHead");
  });

  it("rejects an oversized slug before touching the database", async () => {
    expect(await getPublishedSite("s".repeat(200))).toBeNull();
    expect(dbMock.site.findFirst).not.toHaveBeenCalled();
  });
});

describe("compileTheme", () => {
  it("compiles fonts, scale and palette into vars and one Google Fonts href", () => {
    const c = compileTheme({
      fontDisplay: "Archivo", fontBody: "IBM Plex Sans", scale: "poster",
      displayWeight: 800, displayCase: "upper", accent: "#a94b0d", accentText: "#f8c9aa",
    });
    expect(c.vars["--sc-heading-size"]).toBe(TYPE_SCALES.poster.heading);
    expect(c.vars["--sc-display-case"]).toBe("uppercase");
    expect(c.vars["--sc-accent"]).toBe("#a94b0d");
    expect(c.fontHref).toContain("family=Archivo");
    expect(c.fontHref).toContain("family=IBM+Plex+Sans");
  });

  it("emits no font href when the theme names no fonts", () => {
    expect(compileTheme({ accent: "#111111" }).fontHref).toBeNull();
  });

  it("defaults to the editorial scale for a null theme", () => {
    expect(compileTheme(null).vars["--sc-heading-size"]).toBe(TYPE_SCALES.editorial.heading);
  });

  it("requests a shared family once, not twice", () => {
    const c = compileTheme({ fontDisplay: "Karla", fontBody: "Karla" });
    expect(c.fontHref?.match(/family=/g)).toHaveLength(1);
  });

  it("serialises vars into a single :root block", () => {
    const css = varsToCss({ "--sc-ink": "#fff", "--sc-radius": "4px" });
    expect(css).toBe(":root{--sc-ink:#fff;--sc-radius:4px}");
  });
});

describe("sanitizeHostedCss", () => {
  it("strips the constructs that make a stylesheet a script or a request", () => {
    const out = sanitizeHostedCss(
      '@import "x"; a { width: expression(alert(1)); background: url(javascript:alert(1)); }'
    );
    expect(out).not.toContain("@import");
    expect(out).not.toContain("expression(");
    expect(out).not.toContain("javascript:");
  });

  it("keeps ordinary declarations intact", () => {
    const css = ".hero { color: #fff; background: url(https://cdn.example/bg.png); }";
    expect(sanitizeHostedCss(css)).toBe(css);
  });

  it("cannot be terminated early", () => {
    expect(sanitizeHostedCss("</style><script>alert(1)</script>")).not.toContain("</style>");
  });

  it("cannot reconstruct a close tag from a token split across a removed span", () => {
    // The bug the review found: an escape pass that ran before the removal passes let
    // `</sty@import a;le>` rejoin into a live `</style>`. No "<" may survive, ever.
    for (const attack of [
      "x{}</sty@import a;le><img src=x onerror=alert(1)>",
      "</sty<scriptle><img src=x onerror=alert(1)>",
      "a</st<scriptyle>b",
    ]) {
      const out = sanitizeHostedCss(attack);
      expect(out).not.toContain("<");
      expect(out).not.toContain("</style>");
    }
  });

  it("caps pathological input", () => {
    expect(sanitizeHostedCss("x".repeat(200_000)).length).toBeLessThanOrEqual(50_000);
  });
});
