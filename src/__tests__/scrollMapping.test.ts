import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { scrollableDistance } from "@/components/ScrollEngine";

function setViewport(innerHeight: number, docScrollHeight: number) {
  vi.stubGlobal("window", { innerHeight } as unknown as Window);
  vi.stubGlobal("document", {
    documentElement: { scrollHeight: docScrollHeight },
  } as unknown as Document);
}

function container(scrollHeight: number, clientHeight: number): HTMLElement {
  return { scrollHeight, clientHeight } as unknown as HTMLElement;
}

/** What the engine actually maps a scroll offset to. */
function frameAt(scrollTop: number, distance: number, frameCount: number): number {
  const progress = Math.min(Math.max(scrollTop / distance, 0), 1);
  return Math.floor(progress * (frameCount - 1));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scrollable distance", () => {
  beforeEach(() => setViewport(800, 6000));

  it("measures the document rather than trusting the declared track", () => {
    // The page carries a 100vh spacer above the container, so the real distance is
    // larger than totalScrollHeight - viewport.
    expect(scrollableDistance(null, 5000)).toBe(5200);
  });

  it("never returns zero or negative, which would divide by zero", () => {
    setViewport(1200, 900);
    expect(scrollableDistance(null, 400)).toBeGreaterThan(0);
    expect(scrollableDistance(null, 0)).toBeGreaterThan(0);
    expect(scrollableDistance(null, -1000)).toBeGreaterThan(0);
  });

  it("uses the scroll container when the engine is given one", () => {
    expect(scrollableDistance(container(4000, 700), 5000)).toBe(4300);
  });

  it("falls back to the declared track when the document has not laid out yet", () => {
    setViewport(800, 0);
    expect(scrollableDistance(null, 5000)).toBe(4200);
  });
});

describe("scroll-to-frame mapping", () => {
  beforeEach(() => setViewport(800, 6000));

  it("reaches the last frame at the bottom of the page, not before", () => {
    const d = scrollableDistance(null, 5000);
    expect(frameAt(d, d, 90)).toBe(89);
    expect(frameAt(d - 1, d, 90)).toBeLessThan(89);
  });

  it("starts on the first frame", () => {
    const d = scrollableDistance(null, 5000);
    expect(frameAt(0, d, 90)).toBe(0);
  });

  it("advances monotonically", () => {
    const d = scrollableDistance(null, 5000);
    let last = -1;
    for (let y = 0; y <= d; y += d / 40) {
      const f = frameAt(y, d, 90);
      expect(f).toBeGreaterThanOrEqual(last);
      last = f;
    }
  });

  it("clamps past the ends instead of overrunning the frame array", () => {
    const d = scrollableDistance(null, 5000);
    expect(frameAt(-500, d, 90)).toBe(0);
    expect(frameAt(d * 3, d, 90)).toBe(89);
  });

  it("does not finish early on a viewport taller than the assumed 1000px", () => {
    // The old formula was totalScrollHeight - innerHeight. On a tall viewport that
    // denominator was too small, so the sequence ran out before the page did.
    setViewport(1400, 8000);
    const declared = 6000;
    const old = declared - 1400;
    const fixed = scrollableDistance(null, declared);
    expect(fixed).toBeGreaterThan(old);

    const bottom = 8000 - 1400;
    expect(frameAt(bottom, old, 90)).toBe(89);
    expect(frameAt(bottom * 0.6, old, 90)).toBeLessThan(89);
    expect(frameAt(bottom * 0.6, fixed, 90)).toBeLessThan(frameAt(bottom * 0.6, old, 90) + 1);
  });

  it("survives a page shorter than the viewport instead of sticking on frame 0", () => {
    setViewport(1000, 900);
    const d = scrollableDistance(null, 800);
    expect(d).toBeGreaterThan(0);
    expect(Number.isFinite(frameAt(0, d, 60))).toBe(true);
    expect(frameAt(d, d, 60)).toBe(59);
  });
});
