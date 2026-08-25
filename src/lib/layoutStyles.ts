import { SECTION_LAYOUTS, type SectionLayout } from "@/lib/siteSchema";

export interface LayoutStyle {
  align: string;
  justify: string;
  textAlign: "left" | "center" | "right";
  maxWidth: number;
  pad: string;
}

export const LAYOUT_STYLES: Record<SectionLayout, LayoutStyle> = {
  center: { align: "center", justify: "center", textAlign: "center", maxWidth: 800, pad: "2rem" },
  left: { align: "center", justify: "flex-start", textAlign: "left", maxWidth: 620, pad: "2rem clamp(2rem, 8vw, 8rem)" },
  right: { align: "center", justify: "flex-end", textAlign: "left", maxWidth: 620, pad: "2rem clamp(2rem, 8vw, 8rem)" },
  "lower-third": { align: "flex-end", justify: "flex-start", textAlign: "left", maxWidth: 900, pad: "0 clamp(2rem, 8vw, 8rem) clamp(3rem, 10vh, 7rem)" },
  "upper-third": { align: "flex-start", justify: "center", textAlign: "center", maxWidth: 800, pad: "clamp(3rem, 12vh, 8rem) 2rem 0" },
};

export function layoutStyle(layout: string | undefined): LayoutStyle {
  return LAYOUT_STYLES[(layout ?? "center") as SectionLayout] ?? LAYOUT_STYLES.center;
}

export { SECTION_LAYOUTS };
