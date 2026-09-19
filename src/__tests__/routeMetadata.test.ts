import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { pageMeta, SHARE_BASE, DEFAULT_SHARE_IMAGE } from "@/lib/pageMeta";

/**
 * Every public route names its own address.
 *
 * Measured on the live site before this: no page emitted a canonical link at all, and
 * /templates and /changelog carried the site's default title, so 21 template previews
 * and the changelog all announced themselves as the same page.
 */
const ROUTES: [string, string][] = [
  ["src/app/page.tsx", "/"],
  ["src/app/templates/page.tsx", "/templates"],
  ["src/app/examples/page.tsx", "/examples"],
  ["src/app/presets/layout.tsx", "/presets"],
  ["src/app/changelog/page.tsx", "/changelog"],
  ["src/app/about/layout.tsx", "/about"],
  ["src/app/contact/layout.tsx", "/contact"],
  ["src/app/privacy/page.tsx", "/privacy"],
  ["src/app/terms/page.tsx", "/terms"],
  ["src/app/cookies/page.tsx", "/cookies"],
];

describe("every public route claims its own address", () => {
  it.each(ROUTES)("%s is canonical at %s", (file, route) => {
    expect(readFileSync(file, "utf8")).toMatch(new RegExp(`(?:canonical|path): "${route.replace("/", "\\/")}"`));
  });

  it("gives each template preview its own canonical and title", () => {
    const layout = readFileSync("src/app/templates/[slug]/layout.tsx", "utf8");
    expect(layout).toContain("canonical");
    expect(layout).toContain("templateBySlug(slug)");
    expect(layout).toContain("template.name");
  });

  it("builds every share card through pageMeta, which keeps the root's fields", () => {
    // A child segment's openGraph replaces the root's outright rather than merging into
    // it, so a page that sets one field by hand silently drops siteName, type and locale.
    for (const [file] of ROUTES) {
      expect(readFileSync(file, "utf8"), `${file} redeclares openGraph`).not.toMatch(/openGraph:\s*\{/);
    }
  });
});

describe("a shared link describes the page it points at", () => {
  it("carries the root's share fields, card image, the page's own words and its address", async () => {
    const meta = pageMeta({ title: "Templates", description: "Twenty-two sites.", path: "/templates" });
    expect(meta.openGraph).toMatchObject({ ...SHARE_BASE, title: "Templates | ScrollCraft", description: "Twenty-two sites.", url: "/templates" });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", title: "Templates | ScrollCraft", description: "Twenty-two sites." });
    // Measured: with openGraph set and no images, /templates rendered no og:image at all.
    expect(meta.openGraph).toMatchObject({ images: [DEFAULT_SHARE_IMAGE] });
    expect(meta.twitter).toMatchObject({ images: [DEFAULT_SHARE_IMAGE] });
    const { size } = await import("../app/opengraph-image");
    expect([DEFAULT_SHARE_IMAGE.width, DEFAULT_SHARE_IMAGE.height]).toEqual([size.width, size.height]);
    expect(meta.alternates).toEqual({ canonical: "/templates" });
  });

  it("shows a template's own opening screen when its preview is shared", async () => {
    const { generateMetadata } = await import("../app/templates/[slug]/layout");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "kept" }) });
    const image = { url: "/template-previews/kept.jpg", width: 800, height: 500 };
    expect(meta.openGraph).toMatchObject({ title: "Kept template | ScrollCraft", url: "/templates/kept", images: [expect.objectContaining(image)] });
    expect(meta.twitter).toMatchObject({ images: [expect.objectContaining(image)] });
    const [w, h] = [image.width, image.height];
    const { width, height } = await sharp("public/template-previews/kept.jpg").metadata();
    expect([width, height]).toEqual([w, h]);
  });

  it("does not describe the product as something it is not", () => {
    const contact = readFileSync("src/app/contact/layout.tsx", "utf8");
    const about = readFileSync("src/app/about/layout.tsx", "utf8");
    expect(contact).not.toMatch(/billing/i);
    expect(about).not.toMatch(/easiest|best|#1|leading/i);
  });
});
