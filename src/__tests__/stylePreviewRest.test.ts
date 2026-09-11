import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * A paused preview used to rest on frame 0, the darkest point of the loop for about half
 * the catalogue. Measured on the live templates gallery: nine of 21 cards had a mean luma
 * under 4 out of 255 until hovered. These pin the three places that used to draw frame 0.
 */
const SRC = readFileSync("src/components/StylePreview.tsx", "utf8");

describe("StylePreview rests on its brightest frame", () => {
  it("chooses the rest point by measuring candidates, and caches it", () => {
    expect(SRC).toContain("function restingProgress(");
    expect(SRC).toContain("REST_CACHE.get(key)");
    expect(SRC).toContain("REST_CACHE.set(key, best)");
  });

  it("paints the rest point while paused, not frame 0", () => {
    const paused = SRC.slice(SRC.indexOf("// While the loop is not running"));
    expect(paused).toContain("restingProgress(opts, maxRef.current)");
    expect(paused, "the paused redraw went back to frame 0").not.toMatch(/drawFrame2D\(ctx, w, h, 0,/);
  });

  it("paints the rest point on resize, so a paused canvas does not snap to black", () => {
    const resize = SRC.slice(SRC.indexOf("const resize = () =>"), SRC.indexOf("resize();"));
    expect(resize).toContain("restingProgress(optsRef.current, maxRef.current)");
  });

  it("starts the loop from the rest point, so hovering does not flash dark first", () => {
    expect(SRC).toContain("if (!start) start = ts - restPhaseMs;");
  });

  it("keeps the rest point inside the range the caller allowed", () => {
    expect(SRC).toContain("const p = f * maxProgress;");
    expect(SRC).toMatch(/REST_CANDIDATES = \[0, [^\]]*0\.9\]/);
  });
});
