import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { shouldExportProcedurally } from "@/lib/exportMode";

const EDITOR = readFileSync("src/app/editor/page.tsx", "utf8");
const dataFrames = (n: number) => Array.from({ length: n }, () => "data:image/jpeg;base64,/9j/4AAQ");

describe("what an export may replace with a recipe", () => {
  it("keeps an uploaded video's frames when the site still carries a style", () => {
    // extractFramesInBrowser returns canvas.toDataURL() strings, so footage looks exactly
    // like generated frames. A document saved with a style from an earlier template
    // exported the recipe and shipped no JPEGs: the clip was missing from the ZIP and
    // the page drew a background of its own instead.
    expect(shouldExportProcedurally({ hasStyle: true, framesFromRecipe: false, frames: dataFrames(120) })).toBe(false);
  });

  it("uses the recipe when the recipe drew the frames", () => {
    expect(shouldExportProcedurally({ hasStyle: true, framesFromRecipe: true, frames: dataFrames(90) })).toBe(true);
  });

  it("ships JPEGs with no recipe, or with nothing to redraw", () => {
    expect(shouldExportProcedurally({ hasStyle: false, framesFromRecipe: true, frames: dataFrames(90) })).toBe(false);
    expect(shouldExportProcedurally({ hasStyle: true, framesFromRecipe: true, frames: [] })).toBe(false);
  });

  it("ships JPEGs when a frame is not something a recipe could have drawn", () => {
    expect(
      shouldExportProcedurally({ hasStyle: true, framesFromRecipe: true, frames: ["blob:https://host/id", ...dataFrames(2)] })
    ).toBe(false);
  });

  it("is the question the editor asks, and the answer is saved with the document", () => {
    expect(EDITOR).toContain("shouldExportProcedurally({");
    expect(EDITOR).not.toMatch(/frames\.every\(\(f\) => f\.startsWith\("data:"\)\)/);
    expect(EDITOR).toContain("framesFromRecipe,");
    expect(EDITOR).toContain("setFramesFromRecipe(doc.framesFromRecipe === true)");
  });
});
