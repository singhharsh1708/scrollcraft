import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";

/**
 * The gallery shows a still of each template's first screen. Before, each card drew only
 * the background on a paused canvas, and nine of 21 measured a mean luma under 4 out of
 * 255 on the live site: black rectangles, for every template built on a dark style.
 */
const SLUGS = [...readFileSync("src/lib/templates.ts", "utf8").matchAll(/^ {4}slug: "([^"]+)"/gm)].map((m) => m[1]);

describe("template previews", () => {
  it("counted the catalogue, so the checks below are not vacuous", () => {
    expect(SLUGS.length).toBeGreaterThan(10);
  });

  it("has a committed still for every template", () => {
    for (const slug of SLUGS) {
      const file = `public/template-previews/${slug}.jpg`;
      expect(existsSync(file), `${file} is missing; run scripts/capture-template-previews.mjs`).toBe(true);
      expect(statSync(file).size, `${file} is suspiciously small`).toBeGreaterThan(5000);
    }
  });

  it("shows the still on the gallery card and no longer mounts a canvas per card", () => {
    const gallery = readFileSync("src/app/templates/TemplatesClient.tsx", "utf8");
    expect(gallery).toContain("/template-previews/${t.slug}.jpg");
    expect(gallery).not.toContain("<StylePreview");
  });

  it("defers every still, since most sit below the fold", () => {
    for (const file of ["src/app/templates/TemplatesClient.tsx", "src/app/HomeClient.tsx"]) {
      const src = readFileSync(file, "utf8");
      const at = src.indexOf("/template-previews/");
      expect(at, `${file} does not use the stills`).toBeGreaterThan(-1);
      expect(src.slice(at - 200, at + 400), `${file} loads a still eagerly`).toContain('loading="lazy"');
    }
  });

  it("keeps the capture script that makes them, so they can be regenerated", () => {
    expect(existsSync("scripts/capture-template-previews.mjs")).toBe(true);
  });
});
