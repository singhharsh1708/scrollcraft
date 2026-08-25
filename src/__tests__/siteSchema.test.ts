import { describe, it, expect } from "vitest";
import {
  SECTION_LAYOUTS,
  MAX_SECTIONS,
  parseSectionsJson,
  sectionSchema,
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
