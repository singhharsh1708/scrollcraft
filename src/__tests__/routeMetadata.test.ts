import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

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
    expect(readFileSync(file, "utf8")).toContain(`canonical: "${route}"`);
  });

  it("gives each template preview its own canonical and title", () => {
    const layout = readFileSync("src/app/templates/[slug]/layout.tsx", "utf8");
    expect(layout).toContain("canonical");
    expect(layout).toContain("templateBySlug(slug)");
    expect(layout).toContain("template.name");
  });

  it("leaves the share card to the root, which is the only segment that may set it", () => {
    // A child segment's openGraph replaces the root's outright rather than merging into
    // it, so a page that sets one field silently drops siteName, type and locale.
    for (const [file] of ROUTES) {
      if (file === "src/app/page.tsx") continue;
      expect(readFileSync(file, "utf8"), `${file} redeclares openGraph`).not.toMatch(/openGraph:\s*\{/);
    }
  });
});
