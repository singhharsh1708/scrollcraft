import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The landing page mounts seven canvases. Measured on production at 4x CPU throttle the
 * page holds a steady 60fps, so the animation is cheap — but the hero kept drawing while
 * scrolled 8,388px out of view, which spends a phone's battery on pixels nobody sees.
 */
describe("StylePreview stops drawing off-screen", () => {
  const SRC = readFileSync("src/components/StylePreview.tsx", "utf8");

  it("watches whether the canvas is near the viewport", () => {
    expect(SRC).toContain("IntersectionObserver");
    expect(SRC, "the observer is never disconnected").toContain("observer.disconnect()");
  });

  it("gates the animation loop on visibility as well as the paused prop", () => {
    expect(SRC).toMatch(/if \(paused \|\| !inView\) return;/);
  });

  it("re-runs the loop when visibility changes", () => {
    const deps = /\}, \[paused, inView, durationSec, maxProgress\]\);/.exec(SRC);
    expect(deps, "inView is missing from the loop's dependencies").toBeTruthy();
  });

  it("assumes visible until told otherwise, so a browser without the observer still animates", () => {
    expect(SRC).toMatch(/useState\(true\)/);
    expect(SRC).toContain('typeof IntersectionObserver === "undefined"');
  });

  it("still paints a static frame while the loop is stopped", () => {
    // Otherwise a preview scrolled away and back would come back blank.
    expect(SRC).toMatch(/if \(!paused && inView\) return;/);
    expect(SRC).toMatch(/\}, \[paused, inView, style, colors\]\);/);
  });
});
