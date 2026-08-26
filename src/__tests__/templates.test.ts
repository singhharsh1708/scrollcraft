import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TEMPLATES,
  templateBySlug,
  templateCategories,
  templateScrollHeight,
  templateSectionCount,
} from "@/lib/templates";
import { withheldSectionsFor, fullTemplateSections } from "@/lib/premiumTemplateSections";
import { sectionsSchema, SECTION_LAYOUTS, SECTION_KINDS, REVEALS } from "@/lib/siteSchema";
import { LAYOUT_STYLES, layoutStyle } from "@/lib/layoutStyles";

/**
 * A premium template exposes only a teaser publicly; its real content is server-side.
 * These quality gates exist to hold the authored content to a standard, so they must
 * run against the full sections either way — otherwise making a template premium would
 * quietly exempt it from every check below.
 */
const fullSections = fullTemplateSections;

describe("template catalogue", () => {
  it("ships a catalogue worth calling a library", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(12);
  });

  it("has unique slugs", () => {
    const slugs = TEMPLATES.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("uses url-safe slugs", () => {
    for (const t of TEMPLATES) {
      expect(t.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("every template validates against the shared section schema", () => {
    for (const t of TEMPLATES) {
      const parsed = sectionsSchema.safeParse(fullSections(t));
      if (!parsed.success) {
        throw new Error(`${t.slug}: ${parsed.error.issues[0].path.join(".")} ${parsed.error.issues[0].message}`);
      }
      expect(parsed.success).toBe(true);
    }
  });

  it("every template carries real copy, not placeholders", () => {
    for (const t of TEMPLATES) {
      const content = fullSections(t).filter((s) => s.kind !== "spacer");
      expect(content.length, t.slug).toBeGreaterThanOrEqual(3);
      for (const s of content) {
        expect(s.heading || s.body, `${t.slug} has an empty section`).toBeTruthy();
      }
      const text = JSON.stringify(t).toLowerCase();
      for (const banned of ["lorem", "ipsum", "replace this copy", "section 1", "your text here", "todo"]) {
        expect(text, `${t.slug} contains placeholder copy`).not.toContain(banned);
      }
    }
  });

  it("every template ends with a call to action", () => {
    for (const t of TEMPLATES) {
      const last = [...fullSections(t)].reverse().find((s) => s.kind !== "spacer");
      expect(last?.ctaLabel, `${t.slug} has no closing CTA`).toBeTruthy();
    }
  });

  it("does not open on a spacer or end on one", () => {
    for (const t of TEMPLATES) {
      const secs = fullSections(t);
      expect(secs[0].kind, t.slug).not.toBe("spacer");
      expect(secs[secs.length - 1].kind, t.slug).not.toBe("spacer");
    }
  });

  it("varies its layouts, so no template reads as one repeated screen", () => {
    for (const t of TEMPLATES) {
      const layouts = new Set(
        fullSections(t).filter((s) => s.kind !== "spacer").map((s) => s.layout ?? "center")
      );
      expect(layouts.size, `${t.slug} uses one layout throughout`).toBeGreaterThan(1);
    }
  });

  it("uses at most two statement sections, or none of them land", () => {
    for (const t of TEMPLATES) {
      const statements = fullSections(t).filter((s) => s.kind === "statement").length;
      expect(statements, t.slug).toBeLessThanOrEqual(2);
    }
  });

  it("paces every section long enough to be read", () => {
    for (const t of TEMPLATES) {
      for (const s of fullSections(t)) {
        expect(s.scrollHeight ?? 1000, `${t.slug} section too short`).toBeGreaterThanOrEqual(400);
      }
    }
  });

  it("only names layouts, kinds and reveals the renderer knows", () => {
    for (const t of TEMPLATES) {
      for (const s of fullSections(t)) {
        if (s.layout) expect(SECTION_LAYOUTS).toContain(s.layout);
        if (s.kind) expect(SECTION_KINDS).toContain(s.kind);
        if (s.reveal) expect(REVEALS).toContain(s.reveal);
      }
    }
  });

  it("computes a scroll height matching the exporter's formula", () => {
    for (const t of TEMPLATES) {
      // Against the full sections: a premium template publishes only its teaser, and the
      // gallery must still quote the real length.
      const expected = fullSections(t).reduce((a, s) => a + (s.scrollHeight ?? 1000), 0) + 1000;
      expect(templateScrollHeight(t), t.slug).toBe(expected);
    }
  });

  it("keeps the public counts on a premium template honest", () => {
    // fullSectionCount / fullScrollHeight are baked numbers describing withheld content.
    // If they drift from the real sections the gallery starts advertising a lie.
    for (const t of TEMPLATES.filter((x) => x.premium)) {
      const full = fullSections(t);
      expect(templateSectionCount(t), `${t.slug} section count`).toBe(
        full.filter((s) => s.kind !== "spacer").length
      );
      expect(t.fullScrollHeight, `${t.slug} scroll height`).toBe(
        full.reduce((a, s) => a + (s.scrollHeight ?? 1000), 0)
      );
    }
  });

  it("reports a free template's counts straight from its own sections", () => {
    for (const t of TEMPLATES.filter((x) => !x.premium)) {
      expect(t.fullSectionCount, t.slug).toBeUndefined();
      expect(templateSectionCount(t), t.slug).toBe(
        t.sections.filter((s) => s.kind !== "spacer").length
      );
    }
  });

  it("looks a template up by slug and misses cleanly", () => {
    expect(templateBySlug(TEMPLATES[0].slug)?.name).toBe(TEMPLATES[0].name);
    expect(templateBySlug("no-such-template")).toBeUndefined();
    expect(templateBySlug("")).toBeUndefined();
  });

  it("lists categories once each, sorted", () => {
    const cats = templateCategories();
    expect(new Set(cats).size).toBe(cats.length);
    expect([...cats].sort()).toEqual(cats);
    for (const t of TEMPLATES) expect(cats).toContain(t.category);
  });

  it("gives every template card art and a full palette", () => {
    for (const t of TEMPLATES) {
      expect(t.gradient, t.slug).toMatch(/^from-/);
      expect(t.colors, t.slug).toHaveLength(3);
      for (const c of t.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.tags.length, t.slug).toBeGreaterThan(0);
      expect(t.tagline.length, t.slug).toBeGreaterThan(10);
    }
  });

  it("gives every template a theme with an accent pair", () => {
    for (const t of TEMPLATES) {
      expect(t.theme.accent, t.slug).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.theme.accentText, t.slug).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.theme.accent).not.toBe(t.theme.accentText);
    }
  });
});

describe("shared layout table", () => {
  it("covers every layout the schema allows", () => {
    for (const l of SECTION_LAYOUTS) {
      expect(LAYOUT_STYLES[l]).toBeTruthy();
    }
  });

  it("falls back to center for an unknown or missing layout", () => {
    expect(layoutStyle(undefined)).toBe(LAYOUT_STYLES.center);
    expect(layoutStyle("diagonal")).toBe(LAYOUT_STYLES.center);
  });

  it("keeps each layout visually distinct", () => {
    const signatures = Object.values(LAYOUT_STYLES).map((l) => `${l.align}|${l.justify}|${l.textAlign}|${l.pad}`);
    expect(new Set(signatures).size).toBe(signatures.length);
  });
});

describe("premium templates are actually gated, not just labelled", () => {
  const premium = TEMPLATES.filter((t) => t.premium);

  it("marks a meaningful minority premium, leaving most of the library free", () => {
    expect(premium.length).toBeGreaterThanOrEqual(5);
    expect(premium.length).toBeLessThanOrEqual(10);
    expect(TEMPLATES.length - premium.length).toBeGreaterThan(premium.length);
  });

  it("publishes only a teaser section for a premium template", () => {
    // lib/templates.ts is imported by client components, so everything here is in the
    // browser bundle. One section is a preview; the rest is the product.
    for (const t of premium) {
      expect(t.sections.length, t.slug).toBe(1);
    }
  });

  it("keeps the full content out of the public module entirely", () => {
    for (const t of premium) {
      const withheld = withheldSectionsFor(t.slug) ?? [];
      expect(withheld.length, t.slug).toBeGreaterThan(0);
      // No withheld paragraph may appear in the public record.
      const publicJson = JSON.stringify(t.sections);
      for (const sec of withheld) {
        if (sec.body) expect(publicJson, `${t.slug} leaks body copy`).not.toContain(sec.body);
      }
    }
  });

  it("has server-side content for every template it marks premium", () => {
    for (const t of premium) {
      expect(withheldSectionsFor(t.slug), t.slug).toBeTruthy();
    }
  });

  it("has no orphaned premium content for a template that is not premium", () => {
    const premiumSlugs = new Set(premium.map((t) => t.slug));
    for (const t of TEMPLATES) {
      if (!premiumSlugs.has(t.slug)) {
        expect(withheldSectionsFor(t.slug), `${t.slug} is free but has gated content`).toBeNull();
      }
    }
  });

  it("leaves a free template in the categories a beginner reaches for first", () => {
    const freeCategories = new Set(TEMPLATES.filter((t) => !t.premium).map((t) => t.category));
    for (const c of ["SaaS", "Portfolio", "Agency", "Editorial", "Food & Drink"]) {
      expect(freeCategories, `${c} has no free template`).toContain(c);
    }
  });
});

describe("the gate cannot be undone by an import", () => {
  it("is never imported by a client component", () => {
    // A single `"use client"` file importing the server-only module would put every
    // withheld paragraph back into the browser bundle. `import "server-only"` turns that
    // into a build error, and this says so at test time with a clearer message.
    const files: string[] = [];
    (function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
      }
    })("src");

    const offenders = files.filter((f) => {
      if (f.includes("__tests__")) return false;
      const body = readFileSync(f, "utf8");
      return body.includes('"use client"') && body.includes("premiumTemplateSections");
    });

    expect(offenders, "client components must not import withheld template content").toEqual([]);
  });
});
