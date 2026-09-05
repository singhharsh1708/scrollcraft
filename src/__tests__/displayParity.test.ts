import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { DISPLAY_STYLES, displayStyle } from "@/lib/displayStyles";

/**
 * The preview has to predict the ZIP.
 *
 * Measured by rendering the same template in both and diffing computed style, property
 * by property, across text-align, padding, max-width, flex alignment, heading weight /
 * tracking / case / size / colour, body colour / size / measure / margins, image width
 * and CTA radius. On the previous build orbitcrm differed on exactly one: a statement
 * heading's letter-spacing, -4.224px in the preview against -6.336px in the export,
 * because the preview branched on `kind` for size and line-height but not for weight or
 * tracking. Both now read DISPLAY_STYLES, and orbitcrm, tripvault, meridian-watch and
 * ledger-fintech all come out at zero differences.
 */
const PREVIEW = readFileSync("src/components/SiteRenderer.tsx", "utf8");
const ROUTE = readFileSync("src/app/api/export-site/route.ts", "utf8");

describe("the display treatment has one definition", () => {
  it("gives a statement tighter tracking and less weight than an ordinary heading", () => {
    // The reason the two differ at all: a statement is set far larger.
    expect(DISPLAY_STYLES.statement.letterSpacing).toContain("-0.045em");
    expect(DISPLAY_STYLES.heading.letterSpacing).toContain("-0.03em");
    expect(DISPLAY_STYLES.statement.fontWeight).toContain("800");
    expect(DISPLAY_STYLES.heading.fontWeight).toContain("900");
    expect(DISPLAY_STYLES.statement.lineHeight).toBeLessThan(DISPLAY_STYLES.heading.lineHeight);
  });

  it("lets a theme override every default", () => {
    // A theme that sets displayWeight or displayTracking must still win in both paths.
    for (const s of [DISPLAY_STYLES.heading, DISPLAY_STYLES.statement]) {
      expect(s.fontWeight).toContain("var(--sc-display-weight");
      expect(s.letterSpacing).toContain("var(--sc-display-tracking");
    }
  });

  it("routes an unknown kind to the ordinary heading", () => {
    expect(displayStyle(undefined)).toBe(DISPLAY_STYLES.heading);
    expect(displayStyle("text")).toBe(DISPLAY_STYLES.heading);
    expect(displayStyle("statement")).toBe(DISPLAY_STYLES.statement);
  });

  it("is read by the preview rather than restated", () => {
    expect(PREVIEW).toContain('from "@/lib/displayStyles"');
    expect(PREVIEW).toContain("displayStyle(s.kind).letterSpacing");
    expect(PREVIEW).toContain("displayStyle(s.kind).fontWeight");
    // The literals that used to live here are what drifted.
    expect(PREVIEW).not.toContain("-0.03em");
    expect(PREVIEW).not.toContain("clamp(2.75rem,11vw,9rem)");
  });

  it("is read by the exporter rather than restated", () => {
    expect(ROUTE).toContain('from "@/lib/displayStyles"');
    expect(ROUTE).toContain("const H = displayStyle(s.kind);");
    expect(ROUTE).toContain("${DISPLAY_STYLES.statement.letterSpacing}");
    expect(ROUTE).not.toContain("-0.045em");
  });
});
