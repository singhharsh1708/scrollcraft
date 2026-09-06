import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";

/**
 * The hero animation, and where it sits.
 *
 * It used to cycle 60 JPEGs from /api/demo-frame at 10fps. Measured in Chrome at
 * 1440x900 on a production build: 87 requests and 130.3 KiB just to animate, and the
 * demo's top edge landed at 733px of a 900px viewport, so 29% of it was in view at
 * first paint - a visitor read three paragraphs about a scroll animation before seeing
 * one. It also had to be switched off below 768px to avoid firing every request at once.
 *
 * After: 0 requests, top edge at 188px, 100% in view, and it runs on a phone too.
 */
const HOME = readFileSync("src/app/HomeClient.tsx", "utf8");
const PREVIEW = readFileSync("src/components/StylePreview.tsx", "utf8");

describe("the hero draws its animation instead of fetching it", () => {
  it("no longer builds a list of demo-frame URLs", () => {
    expect(HOME).not.toContain("/api/demo-frame");
    expect(HOME).not.toContain("DEMO_COUNT");
  });

  it("renders the same drawFrame2D the product uses", () => {
    expect(HOME).toContain("<StylePreview");
    expect(PREVIEW).toContain("drawFrame2D");
  });

  it("uses a palette from the catalogue rather than an invented one", async () => {
    const { PRESETS } = await import("@/lib/presets");
    const colors = /const HERO_COLORS: \[string, string, string\] = (\[[^\]]*\])/.exec(HOME);
    expect(colors, "the hero palette is gone").toBeTruthy();
    const hero: string[] = JSON.parse(colors![1].replace(/'/g, '"'));
    expect(PRESETS.some((p) => JSON.stringify(p.colors) === JSON.stringify(hero))).toBe(true);
  });

  it("stops short of the range where every palette goes black", () => {
    // Each style lerps toward its third colour as progress rises, and most third colours
    // are near-black, so an unbounded loop spends much of its cycle on a dark rectangle.
    expect(HOME).toMatch(/maxProgress=\{0?\.\d+\}/);
    expect(PREVIEW).toContain("maxProgress = 1");
    expect(PREVIEW).toContain("* maxProgress");
  });

  it("holds still for a visitor who asked for less motion", () => {
    expect(HOME).toContain('const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";');
    expect(HOME).toContain("paused={reducedMotion}");
  });
});

describe("the landing page shows the product before it describes it", () => {
  it("puts the copy and the demo in one row rather than stacking them", () => {
    expect(HOME).toContain("grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]");
  });

  it("no longer veils the demo behind a fade to the page background", () => {
    // The old frame sat under a from-background gradient, which is why the sliver that
    // was above the fold read as an empty box.
    const hero = HOME.slice(HOME.indexOf("{/* Hero */}"), HOME.indexOf("{/* Social proof strip */}"));
    expect(hero).not.toContain("bg-gradient-to-t from-background");
  });
});

describe("the site says the plugin exists", () => {
  it("offers the install commands the README documents", () => {
    const plugin = readFileSync("src/components/PluginInstall.tsx", "utf8");
    const readme = readFileSync("README.md", "utf8");
    for (const cmd of [
      "/plugin marketplace add singhharsh1708/scrollcraft",
      "/plugin install scrollcraft@scrollcraft",
    ]) {
      expect(plugin, `${cmd} is not offered`).toContain(cmd);
      expect(readme, `${cmd} is not what the README says`).toContain(cmd);
    }
  });

  it("is reachable from the landing page at all", () => {
    expect(HOME).toContain("<PluginInstall />");
  });
});

describe("the manifest icons are not a page-weight surprise", () => {
  /**
   * icon-192.png is fetched on a normal page load because the manifest names it, and it
   * was 32,889 bytes for a gradient with one flat shape on it - a 24-bit RGBA encode of
   * an image a palette describes exactly. Measured on production at 390x844 with a cold
   * cache: 406 KiB over 36 requests, of which 32.3 KiB was that icon.
   */
  it("keeps them small enough to sit in the initial load", () => {
    const sizes = {
      "public/icon-192.png": 12_000,
      "public/icon-512.png": 60_000,
    };
    for (const [file, cap] of Object.entries(sizes)) {
      const bytes = statSync(file).size;
      expect(bytes, `${file} is ${bytes} bytes, over the ${cap} cap`).toBeLessThan(cap);
    }
  });

  it("still declares both sizes the manifest promises", () => {
    const manifest = readFileSync("src/app/manifest.ts", "utf8");
    expect(manifest).toContain('sizes: "192x192"');
    expect(manifest).toContain('sizes: "512x512"');
  });
});

describe("the README reads like a person wrote it", () => {
  const README = readFileSync("README.md", "utf8");

  it("carries no decorative emoji", () => {
    // Box drawing in the directory tree is structure, not decoration.
    const decorative = [...README].filter((c) => {
      const cp = c.codePointAt(0)!;
      return (cp >= 0x1f300 && cp <= 0x1faff) || (cp >= 0x2600 && cp <= 0x27bf) || cp === 0x2728 || cp === 0x2726;
    });
    expect(decorative, `found ${decorative.join(" ")}`).toEqual([]);
  });

  it("does not argue with an earlier version of itself", () => {
    for (const phrase of [
      "worth stating plainly",
      "which is deliberate",
      "That is the whole list",
      "historically expensive",
    ]) {
      expect(README, `README still says "${phrase}"`).not.toContain(phrase);
    }
  });

  it("makes the no-account point once instead of four times", () => {
    const mentions = (README.match(/no account/gi) ?? []).length;
    expect(mentions, `"no account" appears ${mentions} times`).toBeLessThanOrEqual(2);
  });
});
