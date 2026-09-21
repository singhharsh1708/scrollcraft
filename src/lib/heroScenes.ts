import type { Section } from "@/lib/siteSchema";

export type HeroScene = { eyebrow: string; heading: string; cta?: string };

/** The opening, one section from the middle, and the close with its button, so the demo plays a whole site. */
export function heroScenes(sections: Section[]): HeroScene[] {
  const content = sections.filter((s) => s.kind !== "spacer" && s.heading);
  const picked = content.length <= 3 ? content : [content[0], content[1], content[content.length - 1]];
  return picked.map((s, i) => ({
    eyebrow: s.eyebrow ?? "",
    heading: s.heading ?? "",
    cta: i === picked.length - 1 ? s.ctaLabel : undefined,
  }));
}
