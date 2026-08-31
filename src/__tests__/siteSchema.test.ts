import { describe, it, expect } from "vitest";
import {
  SECTION_LAYOUTS,
  SECTION_KINDS,
  REVEALS,
  MAX_SECTIONS,
  parseSectionsJson,
  exportSectionSchema,
  exportSectionsSchema,
  sectionSchema,
  sectionsSchema,
  visibleSections,
  type Section,
} from "@/lib/siteSchema";

const ok = (o: unknown) => sectionSchema.safeParse(o).success;

describe("sectionSchema", () => {
  it("accepts a minimal section", () => {
    expect(ok({ heading: "A" })).toBe(true);
  });

  it("accepts every documented layout and rejects anything else", () => {
    for (const l of SECTION_LAYOUTS) expect(ok({ layout: l })).toBe(true);
    expect(ok({ layout: "diagonal" })).toBe(false);
  });

  it("rejects a scrollHeight that would break the scroll track", () => {
    expect(ok({ scrollHeight: 0 })).toBe(false);
    expect(ok({ scrollHeight: -1000 })).toBe(false);
    expect(ok({ scrollHeight: 1.5 })).toBe(false);
    expect(ok({ scrollHeight: 999_999 })).toBe(false);
    expect(ok({ scrollHeight: 1200 })).toBe(true);
  });

  it("caps text fields", () => {
    expect(ok({ heading: "x".repeat(500) })).toBe(true);
    expect(ok({ heading: "x".repeat(501) })).toBe(false);
    expect(ok({ body: "x".repeat(5001) })).toBe(false);
  });

  it("rejects a colour that is not a colour", () => {
    expect(ok({ accentColor: "#fff" })).toBe(true);
    expect(ok({ accentColor: "rgba(255,255,255,0.7)" })).toBe(true);
    expect(ok({ accentColor: "#fff;background:url(https://tracker/x)" })).toBe(false);
    expect(ok({ headingColor: "</style><script>" })).toBe(false);
  });

  it("rejects a javascript: CTA href", () => {
    expect(ok({ ctaHref: "https://example.com" })).toBe(true);
    expect(ok({ ctaHref: "#anchor" })).toBe(true);
    expect(ok({ ctaHref: "" })).toBe(true);
    expect(ok({ ctaHref: "javascript:alert(1)" })).toBe(false);
    expect(ok({ ctaHref: "data:text/html,<script>" })).toBe(false);
  });

  it("rejects an image source that is neither a URL nor a relative path", () => {
    expect(ok({ image: "https://cdn.example.com/logo.png" })).toBe(true);
    expect(ok({ image: "assets/img_00.png" })).toBe(true);
    expect(ok({ image: "javascript:alert(1)" })).toBe(false);
    expect(ok({ image: "data:image/svg+xml;base64,PHN2Zz4=" })).toBe(false);
  });

  it("bounds the scrim to 0-1", () => {
    expect(ok({ scrim: 0 })).toBe(true);
    expect(ok({ scrim: 1 })).toBe(true);
    expect(ok({ scrim: 1.5 })).toBe(false);
    expect(ok({ scrim: -0.2 })).toBe(false);
  });

  it("accepts every kind and reveal, and rejects invented ones", () => {
    for (const k of SECTION_KINDS) expect(ok({ kind: k })).toBe(true);
    for (const r of REVEALS) expect(ok({ reveal: r })).toBe(true);
    expect(ok({ kind: "carousel" })).toBe(false);
    expect(ok({ reveal: "explode" })).toBe(false);
  });

  it("bounds imageWidth", () => {
    expect(ok({ imageWidth: 480 })).toBe(true);
    expect(ok({ imageWidth: 99999 })).toBe(false);
    expect(ok({ imageWidth: 0 })).toBe(false);
  });

  it("strips unknown keys instead of persisting them", () => {
    const parsed = sectionSchema.parse({ heading: "A", sneaky: "<script>", __proto__: {} });
    expect(parsed).not.toHaveProperty("sneaky");
    expect(parsed.heading).toBe("A");
  });
});

describe("parseSectionsJson", () => {
  it("accepts a valid array", () => {
    const r = parseSectionsJson(JSON.stringify([{ heading: "A" }, { heading: "B", layout: "left" }]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sections).toHaveLength(2);
  });

  it("rejects a non-string input", () => {
    const r = parseSectionsJson({ heading: "A" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("must be a string");
  });

  it("rejects malformed JSON", () => {
    const r = parseSectionsJson("{not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("not valid JSON");
  });

  it("rejects a JSON object that is not an array", () => {
    const r = parseSectionsJson(JSON.stringify({ heading: "A" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("must decode to an array");
  });

  it("names the offending field so a 400 can be actionable", () => {
    const r = parseSectionsJson(JSON.stringify([{ heading: "A" }, { scrollHeight: -5 }]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("1.scrollHeight");
  });

  it("rejects more sections than the cap", () => {
    const many = Array.from({ length: MAX_SECTIONS + 1 }, () => ({ heading: "A" }));
    expect(parseSectionsJson(JSON.stringify(many)).ok).toBe(false);
    const atCap = Array.from({ length: MAX_SECTIONS }, () => ({ heading: "A" }));
    expect(parseSectionsJson(JSON.stringify(atCap)).ok).toBe(true);
  });

  it("still accepts a legacy section that predates layout and images", () => {
    const legacy = [{
      id: "section-1",
      eyebrow: "", heading: "Old", body: "", ctaLabel: "", ctaHref: "#",
      accentColor: "#7c3aed", headingColor: "#ffffff", bodyColor: "rgba(255,255,255,0.7)",
      textAlign: "center", align: "center", justify: "center",
      scrollHeight: 1000, visible: true,
    }];
    expect(parseSectionsJson(JSON.stringify(legacy)).ok).toBe(true);
  });
});

describe("visibleSections", () => {
  it("drops only sections explicitly hidden", () => {
    const s: Section[] = [{ heading: "A" }, { heading: "B", visible: false }, { heading: "C", visible: true }];
    expect(visibleSections(s).map((x) => x.heading)).toEqual(["A", "C"]);
  });
});

describe("the export route's lenient schema stays in step with the strict one", () => {
  it("covers exactly the same fields", () => {
    // Two schemas exist on purpose: the route clamps ranges rather than rejecting them,
    // so its input schema checks types only. They must still describe the same section,
    // or a field added to one is silently stripped by the other.
    const strict = Object.keys(sectionSchema.shape).sort();
    const lenient = Object.keys(exportSectionSchema.shape).sort();
    expect(strict.length).toBeGreaterThan(10);
    expect(lenient).toEqual(strict);
  });

  it("still rejects the shapes that broke the generator", () => {
    expect(exportSectionsSchema.safeParse([null]).success).toBe(false);
    expect(exportSectionsSchema.safeParse(["oops"]).success).toBe(false);
    expect(exportSectionsSchema.safeParse([{ heading: { a: 1 } }]).success).toBe(false);
    expect(exportSectionsSchema.safeParse([{ heading: 12345 }]).success).toBe(false);
  });

  it("leaves out-of-range values for the route to clamp", () => {
    // Rejecting these would break the export over something the route already fixes.
    for (const section of [{ scrim: 5 }, { imageWidth: 99999 }, { reveal: "explode" }, { scrollHeight: -99999 }]) {
      expect(exportSectionsSchema.safeParse([section]).success, JSON.stringify(section)).toBe(true);
      expect(sectionsSchema.safeParse([section]).success, `${JSON.stringify(section)} should fail the strict schema`).toBe(false);
    }
  });
});
