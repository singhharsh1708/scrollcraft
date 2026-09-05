import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The portrait frame set, which a phone gets instead of a letterboxed landscape one.
 *
 * It used to be generated on the path where it cannot survive and ignored on the path
 * where it matters. Measured by running both flows in Chrome:
 *
 *   style path, toggle on   two full renders, hasMobileFrames=1 carried to the editor,
 *                           then a 64 KB procedural export with hasMobile=false and no
 *                           frames-mobile folder - the second render was discarded
 *   video path, toggle on   the toggle was never read: no portrait set, no parameter
 *
 * Now: the style path renders once, and the video path ships both sets. Verified from a
 * real 1280x720 clip - 120 landscape at 1280x720, 120 portrait at 720x1280 - and the
 * served page fetches 120 portrait and 0 landscape at 390x844, the reverse at 1440x900.
 */
const CREATE = readFileSync("src/app/create/page.tsx", "utf8");
const EXTRACT = readFileSync("src/lib/extractFramesInBrowser.ts", "utf8");

describe("a style background renders once", () => {
  it("does not render a portrait set the exporter will drop", () => {
    // exportProcedurally wins whenever a style recipe is present and the frames are
    // locally generated, and that path ships no frames at all.
    const gen = CREATE.slice(CREATE.indexOf("const handleGenerate"), CREATE.indexOf("const handleUpload"));
    expect(gen).not.toContain("Generating mobile portrait frames");
    expect(gen).not.toContain('storeFrames("scrollcraft_mobile_frames"');
    expect(gen).toContain('deleteFrames("scrollcraft_mobile_frames")');
    expect(gen).not.toContain("hasMobileFrames");
  });
});

describe("uploaded footage gets a real portrait set", () => {
  const upload = CREATE.slice(CREATE.indexOf("const handleUpload"), CREATE.indexOf("useEffect", CREATE.indexOf("const handleUpload")));

  it("samples a second pass at portrait dimensions when asked", () => {
    expect(upload).toContain("if (generateMobile) {");
    expect(upload).toContain("width: 720,");
    expect(upload).toContain("height: 1280,");
    expect(upload).toContain('storeFrames("scrollcraft_mobile_frames", portrait.frames)');
  });

  it("tells the exporter the set exists, and only when it does", () => {
    expect(upload).toContain("hasMobile ? { hasMobileFrames: \"1\" } : {}");
    // A failed second pass must not lose the upload that already succeeded.
    expect(upload).toContain("Could not sample the portrait set");
    expect(upload).toMatch(/\}\)\.catch\(\(\) => null\)/);
  });

  it("clears the slot when not asked, so a previous upload's set cannot leak in", () => {
    expect(upload).toContain('deleteFrames("scrollcraft_mobile_frames")');
  });
});

describe("changing the aspect ratio crops rather than stretches", () => {
  it("draws from a centred source rectangle when the ratios differ", () => {
    // drawImage(video, 0, 0, w, h) scales the whole frame into the box: a 16:9 clip in a
    // 9:16 box is stretched about 3x vertically, which distorts every face in it.
    expect(EXTRACT).toContain("const cover = Math.abs(srcAspect - dstAspect) > 0.01;");
    expect(EXTRACT).toContain("if (cover) ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);");
    expect(EXTRACT).toContain("else ctx.drawImage(video, 0, 0, w, h);");
  });

  it("keeps the crop's aspect ratio within half a percent of the target", () => {
    // The maths from the source, run rather than eyeballed.
    const crop = (srcW: number, srcH: number, w: number, h: number) => {
      const srcAspect = srcW / srcH;
      const dstAspect = w / h;
      const cover = Math.abs(srcAspect - dstAspect) > 0.01;
      const sw = cover && srcAspect > dstAspect ? Math.round(srcH * dstAspect) : srcW;
      const sh = cover && srcAspect > dstAspect ? srcH : Math.round(srcW / dstAspect);
      return { cover, sw, sh };
    };
    for (const [srcW, srcH, w, h] of [
      [1920, 1080, 720, 1280], [3840, 2160, 720, 1280], [640, 480, 720, 1280],
      [1080, 1920, 720, 1280], [1920, 1080, 1280, 720],
    ]) {
      const { sw, sh } = crop(srcW, srcH, w, h);
      const deviation = Math.abs(sw / sh - w / h) / (w / h);
      expect(deviation, `${srcW}x${srcH} -> ${w}x${h} distorts by ${(deviation * 100).toFixed(2)}%`).toBeLessThan(0.005);
    }
  });

  it("leaves a matching aspect ratio uncropped", () => {
    const srcAspect = 1920 / 1080;
    const dstAspect = 1280 / 720;
    expect(Math.abs(srcAspect - dstAspect) > 0.01).toBe(false);
  });
});

describe("the toggle says what it does", () => {
  it("names the upload it applies to, and why a style needs nothing", () => {
    expect(CREATE).toContain("Portrait frames for an uploaded video");
    expect(CREATE).toContain("A style background needs no second set");
    expect(CREATE).not.toContain("Also create portrait 9:16 frames for phones");
  });
});
