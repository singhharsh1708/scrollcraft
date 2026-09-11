import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { DISPLAY_STYLES, displayStyle } from "@/lib/displayStyles";
import { TYPE_SCALES } from "@/lib/themeCss";

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
const BUILD_SITE = readFileSync("plugins/scrollcraft/skills/scrollcraft/scripts/build-site.mjs", "utf8");
const ENGINE_CSS = readFileSync("plugins/scrollcraft/skills/scrollcraft/engine/scrollcraft.css", "utf8");

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

  it("bounds every heading by the viewport's height as well as its width", () => {
    // Sized by width alone, poster and statement headings grew taller than their 100vh
    // sticky frame on a 1366x768 laptop, which clipped 29 sections across 13 templates.
    const sizes = [...Object.values(TYPE_SCALES).map((s) => s.heading), DISPLAY_STYLES.heading.fontSize, DISPLAY_STYLES.statement.fontSize];
    for (const size of sizes) expect(size).toMatch(/min\(\d+(\.\d+)?vw,\d+(\.\d+)?vh\)/);
    // The plugin engine keeps its own copy of the scales and the statement size.
    for (const [name, s] of Object.entries(TYPE_SCALES)) expect(BUILD_SITE).toContain(`${name}: { heading: "${s.heading}"`);
    expect(ENGINE_CSS).toMatch(/\.sc-statement \{\s*font-size: calc\(clamp\(2\.75rem, min\(\d+(\.\d+)?vw, \d+(\.\d+)?vh\), 9rem\) \* var\(--sc-fit, 1\)\);/);
  });

  it("gives the copy a column as wide as the layout's max width in every renderer", () => {
    // Under border-box the left layout's 8rem side padding came out of its 620px, so at
    // 1920 wide the copy had 364px and 39 headings across 16 templates ran past their box.
    expect(PREVIEW).toContain('maxWidth: L.maxWidth, boxSizing: "content-box"');
    for (const src of [ROUTE, BUILD_SITE]) expect(src).toContain("max-width:${L.maxWidth}px; box-sizing:content-box;");
  });

  it("lets every renderer shrink a heading to its column", () => {
    for (const size of [DISPLAY_STYLES.heading.fontSize, DISPLAY_STYLES.statement.fontSize]) expect(size).toContain("* var(--sc-fit, 1))");
    expect(BUILD_SITE).toContain("* var(--sc-fit, 1));");
    expect(PREVIEW).toContain('h.style.setProperty("--sc-fit", Math.max(0.5, 0.98 / over).toFixed(3))');
  });
});
