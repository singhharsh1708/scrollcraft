import type { EditorSection, Section, Theme } from "@/lib/siteSchema";
import { layoutStyle } from "@/lib/layoutStyles";

/**
 * The shape the editor works in.
 *
 * Sections arrive from three places: the editor itself, a template, and a document saved
 * by something else, which now includes the site writer and every older version of the
 * editor. Only the first is ever complete, and the properties panel reads these fields
 * directly, so a section is filled in here before anything is allowed to read it.
 */
export const defaultSection = (i: number): EditorSection => ({
  id: `section-${Date.now()}-${i}`,
  eyebrow: "",
  heading: `Section ${i + 1}`,
  body: "",
  ctaLabel: "",
  ctaHref: "#",
  accentColor: "#a78bfa",
  headingColor: "#ffffff",
  bodyColor: "rgba(255,255,255,0.7)",
  textAlign: "center",
  align: "center",
  justify: "center",
  scrollHeight: 1000,
  visible: true,
});

/**
 * Give every section the fields the editor itself relies on.
 *
 * A document can be written by something other than the editor: the site writer saves one
 * straight from a description, and documents saved by older versions predate fields added
 * since. Both are valid sites with holes where a colour or an alignment would be, and the
 * properties panel reads those directly, so filling them here is what keeps opening one
 * from being a crash.
 */
export function fillSections(secs: (Section | Partial<EditorSection>)[], theme: Theme, slug: string): EditorSection[] {
  return secs.map((s, i) => {
    // A template places its copy with `layout` and sets none of the three directly.
    // defaultSection's "center" is right for a blank section but would outrank the
    // layout here, since both renderers read `s.align ?? L.align`.
    const L = layoutStyle(s.layout);
    return {
      ...defaultSection(i),
      ...s,
      textAlign: s.textAlign ?? L.textAlign,
      align: s.align ?? L.align,
      justify: s.justify ?? L.justify,
      id: s.id || `section-${i}-${slug}`,
      heading: s.heading ?? "",
      eyebrow: s.eyebrow ?? "",
      body: s.body ?? "",
      ctaLabel: s.ctaLabel ?? "",
      ctaHref: s.ctaHref ?? "#",
      accentColor: s.accentColor ?? theme.accentText ?? "#ede9fe",
      headingColor: s.headingColor ?? theme.ink ?? "#ffffff",
      bodyColor: s.bodyColor ?? theme.muted ?? "rgba(255,255,255,0.7)",
      scrollHeight: s.scrollHeight ?? 1000,
      visible: true,
    };
  });
}
