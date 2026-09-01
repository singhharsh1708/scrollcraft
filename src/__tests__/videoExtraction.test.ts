import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Sampling stops at MAX_DURATION_SECONDS, and used to stop silently.
 *
 * The extractor returned one number called `duration` — documented as "source duration"
 * but actually the capped value — and the caller destructured only `frames` and
 * `frameCount`, so nothing anywhere knew the clip had been cut. A user uploaded five
 * minutes of footage, got the first two, and was told nothing.
 *
 * Verified in Chrome with real clips rendered by ffmpeg: a 150s clip warns on this
 * build and did not on the previous one; an 8s clip warns on neither.
 */
const EXTRACTOR = readFileSync("src/lib/extractFramesInBrowser.ts", "utf8");
const CREATE = readFileSync("src/app/create/page.tsx", "utf8");

describe("a truncated video says so", () => {
  it("reports the clip's own length alongside what was sampled", () => {
    expect(EXTRACTOR).toContain("sourceDuration: number;");
    expect(EXTRACTOR).toContain("sourceDuration: video.duration");
    // `duration` is the capped value; the two must not be conflated again.
    expect(EXTRACTOR).toContain("const duration = Math.min(video.duration, MAX_DURATION_SECONDS);");
  });

  it("still has a cap to report against", () => {
    const cap = /const MAX_DURATION_SECONDS = (\d+);/.exec(EXTRACTOR);
    expect(cap, "the cap is gone, so this suite tests nothing").toBeTruthy();
    expect(Number(cap![1])).toBeGreaterThan(0);
  });

  it("warns the uploader, and only when something was actually cut", () => {
    expect(CREATE).toContain("const { frames, frameCount: count, duration, sourceDuration }");
    // The tolerance matters: video.duration is a float, so an exact inequality would
    // fire on clips that were not truncated at all.
    expect(CREATE).toContain("if (sourceDuration > duration + 0.5)");
    expect(CREATE).toMatch(/Used the first \$\{Math\.round\(duration\)\}s of your \$\{Math\.round\(sourceDuration\)\}s clip/);
  });
});
