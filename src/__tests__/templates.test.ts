import { describe, it, expect } from "vitest";
import {
  TEMPLATES,
  templateBySlug,
  templateCategories,
  templateScrollHeight,
} from "@/lib/templates";
import { sectionsSchema, SECTION_LAYOUTS, SECTION_KINDS, REVEALS } from "@/lib/siteSchema";
import { LAYOUT_STYLES, layoutStyle } from "@/lib/layoutStyles";

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
      const parsed = sectionsSchema.safeParse(t.sections);
      if (!parsed.success) {
        throw new Error(`${t.slug}: ${parsed.error.issues[0].path.join(".")} ${parsed.error.issues[0].message}`);
      }
      expect(parsed.success).toBe(true);
    }
  });

  it("every template carries real copy, not placeholders", () => {
    for (const t of TEMPLATES) {
      const content = t.sections.filter((s) => s.kind !== "spacer");
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
      const last = [...t.sections].reverse().find((s) => s.kind !== "spacer");
      expect(last?.ctaLabel, `${t.slug} has no closing CTA`).toBeTruthy();
    }
  });

  it("does not open on a spacer or end on one", () => {
    for (const t of TEMPLATES) {
      expect(t.sections[0].kind, t.slug).not.toBe("spacer");
      expect(t.sections[t.sections.length - 1].kind, t.slug).not.toBe("spacer");
    }
  });

  it("varies its layouts, so no template reads as one repeated screen", () => {
    for (const t of TEMPLATES) {
      const layouts = new Set(
        t.sections.filter((s) => s.kind !== "spacer").map((s) => s.layout ?? "center")
      );
      expect(layouts.size, `${t.slug} uses one layout throughout`).toBeGreaterThan(1);
    }
  });

  it("uses at most two statement sections, or none of them land", () => {
    for (const t of TEMPLATES) {
      const statements = t.sections.filter((s) => s.kind === "statement").length;
      expect(statements, t.slug).toBeLessThanOrEqual(2);
    }
  });

  it("paces every section long enough to be read", () => {
    for (const t of TEMPLATES) {
      for (const s of t.sections) {
        expect(s.scrollHeight ?? 1000, `${t.slug} section too short`).toBeGreaterThanOrEqual(400);
      }
    }
  });

  it("only names layouts, kinds and reveals the renderer knows", () => {
    for (const t of TEMPLATES) {
      for (const s of t.sections) {
        if (s.layout) expect(SECTION_LAYOUTS).toContain(s.layout);
        if (s.kind) expect(SECTION_KINDS).toContain(s.kind);
        if (s.reveal) expect(REVEALS).toContain(s.reveal);
      }
    }
  });

  it("computes a scroll height matching the exporter's formula", () => {
    for (const t of TEMPLATES) {
      const expected = t.sections.reduce((a, s) => a + (s.scrollHeight ?? 1000), 0) + 1000;
      expect(templateScrollHeight(t)).toBe(expected);
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
