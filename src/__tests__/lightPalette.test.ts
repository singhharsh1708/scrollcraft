import { describe, it, expect } from "vitest";
import { baseFill } from "@/lib/generate2DFrames";
import { TEMPLATES } from "@/lib/templates";

/**
 * Every template was dark, and not by choice: each style began with a hardcoded
 * near-black fill, so a light palette was painted over before anybody could see it.
 */

const DARK_BASES = ["#030308", "#020208", "#020510"];

const optsFor = (colors: readonly [string, string, string]) => ({
  style: "geometric" as const,
  color1: colors[0],
  color2: colors[1],
  color3: colors[2],
  frameCount: 1,
});

describe("a light palette gets a light page", () => {
  it("uses the palette's own third colour when that colour is light", () => {
    expect(baseFill(optsFor(["#1b3a8f", "#8a5a2b", "#eff2f6"]), "#030308")).toBe("#eff2f6");
  });

  it("keeps the style's own dark base for a dark palette", () => {
    expect(baseFill(optsFor(["#28407e", "#6b2f2a", "#0a0d18"]), "#030308")).toBe("#030308");
  });

  it("changes nothing for any template that already existed", () => {
    // The whole catalogue, minus the one light template this was built for: every one of
    // them must still start from the exact fill it started from before.
    for (const template of TEMPLATES) {
      if (template.slug === "pare") continue;
      for (const dark of DARK_BASES) {
        expect(baseFill(optsFor(template.colors), dark), `${template.slug} moved`).toBe(dark);
      }
    }
  });

  it("the catalogue has a light template at all, which it did not before", () => {
    const light = TEMPLATES.filter((t) => baseFill(optsFor(t.colors), "#030308") !== "#030308");
    expect(light.map((t) => t.slug)).toContain("pare");
  });
});
