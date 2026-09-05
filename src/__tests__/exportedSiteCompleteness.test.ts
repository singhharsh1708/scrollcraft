import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { TEMPLATES } from "@/lib/templates";
import { sectionAnchor, visibleSections } from "@/lib/siteSchema";
import { exportReadme } from "@/lib/exportAssets";

/**
 * What a visitor gets when a template is exported and put online.
 *
 * Checked against a real ZIP, unzipped and served: the exported page carried no section
 * ids at all, so every template's call to action - #start, #signup, #book, sixteen
 * distinct anchors across twenty-one templates - was a button that did nothing when
 * clicked. There was also no footer of any kind, so a finished site ended mid-scroll
 * with no name, no year and nothing to identify its owner.
 */
const ROUTE = readFileSync("src/app/api/export-site/route.ts", "utf8");
const EDITOR = readFileSync("src/app/editor/page.tsx", "utf8");

describe("an in-page call to action has somewhere to land", () => {
  it("numbers the anchors from one, by position rather than by heading", () => {
    // A heading can be edited or emptied; an anchor that moves with the copy breaks the
    // link pointing at it.
    expect(sectionAnchor(0)).toBe("section-1");
    expect(sectionAnchor(2)).toBe("section-3");
  });

  it("emits the anchor on every content section of the exported page", () => {
    expect(ROUTE).toContain('<section id="${sectionAnchor(sectionIndex)}" class="scroll-section"');
  });

  it("has no template pointing a button at an anchor its own page lacks", () => {
    // The closing CTA is deliberately the owner's to fill in, and is reported at export
    // time rather than silently shipped. Every *other* in-page CTA must resolve.
    const offenders: string[] = [];
    for (const t of TEMPLATES) {
      const vis = visibleSections(t.sections);
      const anchors = new Set(vis.map((_, i) => sectionAnchor(i)));
      vis.forEach((s, i) => {
        const href = s.ctaHref ?? "";
        if (!s.ctaLabel || !href.startsWith("#")) return;
        const isClosing = i === vis.length - 1;
        if (!isClosing && !anchors.has(href.slice(1))) {
          offenders.push(`${t.slug} section ${i + 1} -> ${href}`);
        }
      });
    }
    expect(offenders, "a non-closing CTA points nowhere").toEqual([]);
  });

  it("gives the templates that open with a button a working one", () => {
    const withHeroCta = TEMPLATES.filter((t) => {
      const vis = visibleSections(t.sections);
      return vis.length > 1 && !!vis[0].ctaLabel;
    });
    expect(withHeroCta.length, "no template opens with a button, so this proves nothing").toBeGreaterThan(0);
    for (const t of withHeroCta) {
      const vis = visibleSections(t.sections);
      const anchors = new Set(vis.map((_, i) => sectionAnchor(i)));
      const href = vis[0].ctaHref ?? "";
      expect(anchors.has(href.slice(1)), `${t.slug}'s opening CTA points at ${href}`).toBe(true);
    }
  });

  it("names the button that still needs a real link, at export time", () => {
    expect(EDITOR).toContain("const anchors = new Set(visibleForExport.map((_, i) => sectionAnchor(i)));");
    // Singular and plural are separate branches, so the phrase is not contiguous.
    expect(EDITOR).toContain('"One button needs"');
    expect(EDITOR).toContain("buttons need`} a real link:");
    // Named, not counted: "one CTA is broken" does not tell you which.
    expect(EDITOR).toContain("unresolved.join(\", \")");
  });

  it("tells the owner in the README how to set it", () => {
    const readme = exportReadme("Site", true, "https://example.test");
    expect(readme).toContain("The one thing only you can do");
    expect(readme).toMatch(/mailto:/);
    expect(readme).toContain("#section-1");
  });
});

describe("the exported page closes like a website", () => {
  it("ends with a footer carrying the site's name and year", () => {
    expect(ROUTE).toContain('<footer id="site-footer">');
    expect(ROUTE).toContain('<p class="footer-name">${esc(siteName)}</p>');
    expect(ROUTE).toContain("All rights reserved");
    expect(ROUTE).toContain("new Date().getUTCFullYear()");
  });

  it("styles it from the theme rather than hardcoding a look", () => {
    const css = ROUTE.slice(ROUTE.indexOf("#site-footer {"), ROUTE.indexOf("#scroll-hint {"));
    expect(css).toContain("var(--sc-ground");
    expect(css).toContain("var(--sc-ink");
    expect(css).toContain("var(--sc-muted");
    expect(css).toContain("var(--sc-font-display");
  });

  it("sits above the fixed canvas so it is reachable", () => {
    const css = ROUTE.slice(ROUTE.indexOf("#site-footer {"), ROUTE.indexOf("#scroll-hint {"));
    expect(css).toMatch(/z-index: 10/);
  });

  it("omits the tagline line when there is no description", () => {
    expect(ROUTE).toContain('${siteDescription ? `<p class="footer-tagline">');
  });
});

describe("no template publishes a claim on its owner's behalf", () => {
  it("invents no customer counts, ratings or compliance certifications", () => {
    // A template's copy ships as the owner's own words. "Trusted by 4,200 teams" and
    // "SOC 2 Type II, 99.99% uptime" were statements they had not made.
    const src = readFileSync("src/lib/templates.ts", "utf8");
    const claims = [...src.matchAll(/"([^"]{4,})"/g)]
      .map((m) => m[1])
      .filter((v) =>
        /trusted by [\d,]|[\d,.]+\s*(k|m|\+)?\s*(teams|customers|users|clients|downloads|reviews)\b/i.test(v) ||
        /\bSOC ?2\b|\bISO ?27001\b|\b99\.9\d*%|\bHIPAA\b/i.test(v) ||
        /\b\d\.\d\s*stars?\b|\baward-winning\b/i.test(v)
      );
    expect(claims, "a template asserts something its owner cannot").toEqual([]);
  });
});
