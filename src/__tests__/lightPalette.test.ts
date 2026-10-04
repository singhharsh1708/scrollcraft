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

  it("changes nothing for any template in the catalogue", () => {
    // Every template ships dark today, so none of them may move.
    for (const template of TEMPLATES) {
      for (const dark of DARK_BASES) {
        expect(baseFill(optsFor(template.colors), dark), `${template.slug} moved`).toBe(dark);
      }
    }
  });

  it("leaves the catalogue dark until a light template is designed to look it", () => {
    // Pare was reverted: a light palette with this geometry paints a page whose mean
    // brightness is 237 and whose background barely moves, which reads as an unstyled
    // page rather than a quiet one. The engine can do light; the design has to earn it.
    const light = TEMPLATES.filter((t) => baseFill(optsFor(t.colors), "#030308") !== "#030308");
    expect(light.map((t) => t.slug)).toEqual([]);
  });
});
