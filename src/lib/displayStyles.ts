/**
 * The display-type treatment, shared by the editor preview and the exporter.
 *
 * A statement section is set much larger than an ordinary heading, so it wants tighter
 * tracking, a shorter line and slightly less weight. The exporter had all four of those;
 * the preview branched on size and line-height only and left a statement at the ordinary
 * heading's weight and tracking, so the preview promised looser type than the ZIP
 * delivered. Both now read these, the way both already read layoutStyles.
 *
 * Every field is a CSS value with the theme's custom property first, so a theme that sets
 * displayWeight or displayTracking still wins.
 */
export interface DisplayStyle {
  fontSize: string;
  fontWeight: string;
  lineHeight: number;
  letterSpacing: string;
}

export const DISPLAY_STYLES: Record<"heading" | "statement", DisplayStyle> = {
  heading: {
    fontSize: "var(--sc-heading-size, clamp(2rem,5vw,4rem))",
    fontWeight: "var(--sc-display-weight, 900)",
    lineHeight: 1,
    letterSpacing: "var(--sc-display-tracking, -0.03em)",
  },
  statement: {
    fontSize: "clamp(2.75rem,11vw,9rem)",
    fontWeight: "var(--sc-display-weight, 800)",
    lineHeight: 0.92,
    letterSpacing: "var(--sc-display-tracking, -0.045em)",
  },
};

export function displayStyle(kind: string | undefined): DisplayStyle {
  return kind === "statement" ? DISPLAY_STYLES.statement : DISPLAY_STYLES.heading;
}
