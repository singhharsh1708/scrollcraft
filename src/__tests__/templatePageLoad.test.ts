import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { TEMPLATES, templateBySlug } from "@/lib/templates";
import { compileTheme } from "@/lib/themeCss";

describe("template previews are built ahead of time", () => {
  it("prerenders every template and 404s any other slug", async () => {
    const page = await import("../app/templates/[slug]/page");
    expect(page.dynamicParams).toBe(false);
    expect(page.generateStaticParams().map((p) => p.slug).sort()).toEqual(TEMPLATES.map((t) => t.slug).sort());
  });

  it("hands the browser the one template it shows", async () => {
    const { default: TemplatePage } = await import("../app/templates/[slug]/page");
    const { default: TemplatePreview } = await import("../app/templates/[slug]/TemplatePreview");
    const el = await TemplatePage({ params: Promise.resolve({ slug: "kept" }) });
    const preview = (el.props as { children: React.ReactElement[] }).children[0];
    expect(preview.type).toBe(TemplatePreview);
    expect(preview.props).toEqual({ template: templateBySlug("kept") });
  });

  it("renders the not found page for a slug that is not a template", async () => {
    const { default: TemplatePage } = await import("../app/templates/[slug]/page");
    await expect(TemplatePage({ params: Promise.resolve({ slug: "nope" }) })).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });

  it("keeps the catalogue out of the browser bundle", () => {
    expect(readFileSync("src/app/templates/[slug]/page.tsx", "utf8")).not.toContain('"use client"');
    const preview = readFileSync("src/app/templates/[slug]/TemplatePreview.tsx", "utf8");
    expect(preview.startsWith('"use client";')).toBe(true);
    expect(preview.match(/^import .*"@\/lib\/templates";$/gm), "a value import ships every template's copy").toEqual([
      'import type { Template } from "@/lib/templates";',
    ]);
  });
});

describe("a template's webfont does not hold up the first paint", () => {
  const renderer = readFileSync("src/components/SiteRenderer.tsx", "utf8");

  it("renders only the preconnects, not the stylesheet", () => {
    expect(renderer).not.toMatch(/<link[^>]*rel="stylesheet"/);
    expect(renderer).toContain('<link rel="preconnect" href="https://fonts.googleapis.com" />');
    expect(renderer).toContain('<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />');
  });

  it("adds the stylesheet to the head after mount, once per font URL", () => {
    expect(renderer).toContain('l.getAttribute("href") === href');
    expect(renderer).toContain("document.head.appendChild(link);");
    expect(renderer).toContain("}, [compiled.fontHref]);");
  });

  it("asks Google Fonts to swap, so text shows in a fallback font while it loads", () => {
    const hrefs = TEMPLATES.map((t) => compileTheme(t.theme).fontHref).filter((h): h is string => Boolean(h));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(href).toMatch(/&display=swap$/);
  });

  it("fits headings again once the webfont has loaded", () => {
    expect(renderer).toContain('document.fonts?.addEventListener("loadingdone", schedule);');
    expect(renderer).toContain('document.fonts?.removeEventListener("loadingdone", schedule);');
  });
});
