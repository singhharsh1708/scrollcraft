import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { TEMPLATES, templateCategories } from "@/lib/templates";
import { CATEGORY_INFO, TEMPLATE_USE, categoryMetaTitle, categoryPath, templateDescription, templateMetaTitle } from "@/lib/templateSeo";

vi.mock("@/components/Navbar", () => ({ default: () => null }));

const SUFFIX = " | ScrollCraft";
const CATEGORIES = templateCategories();

function jsonLdBlocks(html: string): unknown[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
}

async function templateHtml(slug: string): Promise<string> {
  const { default: TemplatePage } = await import("../app/templates/[slug]/page");
  return renderToStaticMarkup((await TemplatePage({ params: Promise.resolve({ slug }) })) as ReactElement);
}

async function categoryHtml(slug: string): Promise<string> {
  const { default: CategoryPage } = await import("../app/templates/category/[category]/page");
  return renderToStaticMarkup((await CategoryPage({ params: Promise.resolve({ category: slug }) })) as ReactElement);
}

describe("template page titles and descriptions", () => {
  it("covers every template and every category", () => {
    expect(Object.keys(TEMPLATE_USE).sort()).toEqual(TEMPLATES.map((t) => t.slug).sort());
    expect(Object.keys(CATEGORY_INFO).sort()).toEqual([...CATEGORIES].sort());
  });

  it.each(TEMPLATES.map((t) => [t.slug, t] as const))("%s fits a search result", async (slug, t) => {
    const title = templateMetaTitle(t);
    expect(title.length, title).toBeLessThanOrEqual(60);
    expect(title).toMatch(/website template/);
    const description = templateDescription(t);
    expect(description.length, description).toBeGreaterThanOrEqual(140);
    expect(description.length, description).toBeLessThanOrEqual(160);

    const { generateMetadata } = await import("../app/templates/[slug]/layout");
    const meta = await generateMetadata({ params: Promise.resolve({ slug }) });
    expect(meta.title).toBe(title);
    expect(meta.description).toBe(description);
  });

  it("gives every template a different title", () => {
    const titles = TEMPLATES.map(templateMetaTitle);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it.each(CATEGORIES)("the %s category page fits a search result", async (category) => {
    const title = categoryMetaTitle(category);
    expect((title + SUFFIX).length, title).toBeLessThanOrEqual(75);
    const description = CATEGORY_INFO[category].description;
    expect(description.length, description).toBeGreaterThanOrEqual(140);
    expect(description.length, description).toBeLessThanOrEqual(160);

    const { generateMetadata } = await import("../app/templates/category/[category]/page");
    const meta = await generateMetadata({ params: Promise.resolve({ category: CATEGORY_INFO[category].slug }) });
    expect(meta.title).toBe(title);
    expect(meta.alternates).toEqual({ canonical: categoryPath(category) });
  });

  it("keeps the copy free of em dashes", () => {
    const copy = JSON.stringify([CATEGORY_INFO, TEMPLATE_USE, TEMPLATES.map(templateDescription)]);
    expect(copy).not.toContain("—");
  });
});

describe("a template page says what the template is for", () => {
  it.each(TEMPLATES.map((t) => [t.slug, t] as const))("%s has one h1, naming its use", async (slug, t) => {
    const html = await templateHtml(slug);
    const h1s = html.match(/<h1[\s>]/g) ?? [];
    expect(h1s).toHaveLength(1);
    expect(html).toMatch(new RegExp(`<h1[^>]*>${t.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: an? `));
    expect(html).toContain('href="/describe"');
    expect(html).toContain(`href="${categoryPath(t.category)}"`);
  });

  it("still renders the preview's own opening heading, one level down", async () => {
    const t = TEMPLATES.find((x) => x.slug === "kept")!;
    const html = await templateHtml("kept");
    expect(html).toMatch(new RegExp(`<h2[^>]*>${t.sections[0].heading}</h2>`));
  });

  it("links three other templates", async () => {
    const html = await templateHtml("weft");
    const section = html.slice(html.indexOf("Related templates"));
    const links = [...section.matchAll(/href="\/templates\/([a-z0-9-]+)"/g)].map((m) => m[1]);
    expect(new Set(links).size).toBe(3);
    expect(links).not.toContain("weft");
  });

  it("carries breadcrumb and page structured data that parse", async () => {
    const blocks = jsonLdBlocks(await templateHtml("cinder-restaurant")) as Record<string, unknown>[];
    const types = blocks.map((b) => b["@type"]);
    expect(types).toEqual(["BreadcrumbList", "CreativeWork"]);
    const crumbs = (blocks[0].itemListElement as { name: string; position: number; item: string }[]);
    expect(crumbs.map((c) => c.position)).toEqual([1, 2, 3, 4]);
    expect(crumbs[2].item).toMatch(/\/templates\/category\/food-and-drink$/);
    expect(crumbs[3].name).toBe("Cinder");
    for (const key of ["aggregateRating", "review", "offers", "price"]) expect(blocks[1]).not.toHaveProperty(key);
  });
});

describe("category pages", () => {
  it("prerenders one page per category and 404s anything else", async () => {
    const page = await import("../app/templates/category/[category]/page");
    expect(page.dynamicParams).toBe(false);
    expect(page.generateStaticParams().map((p) => p.category).sort()).toEqual(CATEGORIES.map((c) => CATEGORY_INFO[c].slug).sort());
    await expect(page.default({ params: Promise.resolve({ category: "nope" }) })).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });

  it("does not collide with a template slug", () => {
    expect(TEMPLATES.map((t) => t.slug)).not.toContain("category");
  });

  it.each(CATEGORIES)("%s has one h1, its templates, guidance and structured data", async (category) => {
    const html = await categoryHtml(CATEGORY_INFO[category].slug);
    expect(html.match(/<h1[\s>]/g) ?? []).toHaveLength(1);
    for (const t of TEMPLATES.filter((x) => x.category === category)) expect(html).toContain(`href="/templates/${t.slug}"`);
    for (const p of CATEGORY_INFO[category].guidance) expect(html).toContain(p.slice(0, 40));
    expect(html).toContain('href="/describe"');
    const [crumbs] = jsonLdBlocks(html) as { "@type": string; itemListElement: unknown[] }[];
    expect(crumbs["@type"]).toBe("BreadcrumbList");
    expect(crumbs.itemListElement).toHaveLength(3);
  });

  it("is in the sitemap and linked from the gallery", async () => {
    const { default: sitemap } = await import("../app/sitemap");
    const urls = sitemap().map((e) => e.url);
    for (const c of CATEGORIES) expect(urls.some((u) => u.endsWith(categoryPath(c)))).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);

    const { default: TemplatesPage } = await import("../app/templates/page");
    const el = (await TemplatesPage({ searchParams: Promise.resolve({}) })) as ReactElement<{ categoryLinks: { href: string }[] }>;
    expect(el.props.categoryLinks.map((l) => l.href).sort()).toEqual(CATEGORIES.map(categoryPath).sort());
  });
});
