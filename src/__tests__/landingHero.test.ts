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
const HERO = readFileSync("src/components/HeroSequence.tsx", "utf8");
const PAGE = readFileSync("src/app/page.tsx", "utf8");

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
    const { TEMPLATES } = await import("@/lib/templates");
    const slug = /const HERO_SLUG = "([a-z-]+)";/.exec(PAGE)?.[1];
    expect(slug, "the hero names no template").toBeTruthy();
    expect(TEMPLATES.some((t) => t.slug === slug), `${slug} is not in the catalogue`).toBe(true);
    expect(PAGE).toContain("colors: heroSource.colors,");
  });

  it("stops short of the range where every palette goes black", () => {
    // Each style lerps toward its third colour as progress rises, and most third colours
    // are near-black, so an unbounded loop spends much of its cycle on a dark rectangle.
    expect(HOME).toMatch(/maxProgress=\{0?\.\d+\}/);
    expect(PREVIEW).toContain("maxProgress = 1");
    expect(PREVIEW).toContain("* maxProgress");
    const from = Number(/const CANVAS_FROM = ([\d.]+);/.exec(HERO)?.[1]);
    const span = Number(/const CANVAS_SPAN = ([\d.]+);/.exec(HERO)?.[1]);
    expect(from + span, "the hero scrubs into the dark end of the range").toBeLessThanOrEqual(0.55);
  });

  it("holds still for a visitor who asked for less motion", () => {
    expect(HOME).toContain('const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";');
    expect(HOME).toContain("reducedMotion={reduced}");
    // No pinned track and no scroll listener: the screen sits still beside the copy.
    expect(HERO).toContain('reducedMotion ? "relative" : "sticky top-0"');
    expect(HERO).toContain('if (!reducedMotion) window.addEventListener("scroll", schedule');
  });
});

describe("the landing page shows the product before it describes it", () => {
  it("opens on the product playing itself rather than a description of it", () => {
    // It was once a box 733px down a 900px viewport, then a backdrop behind the copy, then
    // a still of a template beside it. The hero is now a template that plays as the
    // visitor scrolls, which is the product doing the one thing it does.
    const hero = HOME.slice(HOME.indexOf("{/* Hero */}"), HOME.indexOf("{/* Social proof strip */}"));
    expect(hero).toContain("<HeroSequence");
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

describe("the hero plays a real template", () => {
  it("draws it rather than downloading it", () => {
    // The first hero fetched 60 JPEGs, 87 requests and 130.3 KiB, to animate.
    expect(HERO).toContain("drawFrame2D(ctx, W, H, q, opts)");
    expect(HERO).not.toMatch(/fetch\(|<img/);
  });

  it("holds the canvas to a pixel budget", () => {
    // Capping only its width let a 3x portrait phone redraw 1170x2532 every frame, which
    // measured at 30fps while scrolling.
    const budget = Number(/const PIXEL_BUDGET = ([\d_]+);/.exec(HERO)?.[1].replace(/_/g, ""));
    expect(budget).toBeLessThanOrEqual(1_200_000);
    expect(HERO).toContain("Math.sqrt(PIXEL_BUDGET / Math.max(W * H, 1))");
  });

  it("pins a phone for at most one screen before the page moves on", () => {
    // At 280svh a 390x844 phone scrolled 1519px, 1.8 screens, through the demo before
    // reaching anything it could read. Measured after: 844px, one screen, same sequence.
    const [, phone, desktop] = /h-\[(\d+)svh\] lg:h-\[(\d+)svh\]/.exec(HERO) ?? [];
    expect(Number(phone) - 100).toBeLessThanOrEqual(100);
    expect(Number(desktop)).toBeGreaterThan(Number(phone));
  });

  it("plays the template through to its closing button", async () => {
    const { templateBySlug } = await import("@/lib/templates");
    const { heroScenes } = await import("@/lib/heroScenes");
    const slug = /const HERO_SLUG = "([a-z-]+)";/.exec(PAGE)![1];
    const sections = templateBySlug(slug)!.sections.filter((s) => s.kind !== "spacer");
    const scenes = heroScenes(templateBySlug(slug)!.sections);
    expect(scenes).toHaveLength(3);
    expect(scenes[0].heading).toBe(sections[0].heading);
    expect(scenes[2]).toMatchObject({ heading: sections.at(-1)!.heading, cta: sections.at(-1)!.ctaLabel });
    expect(scenes[2].cta).toBeTruthy();
    expect(scenes.slice(0, 2).every((s) => !s.cta)).toBe(true);
  });

  it("sets the headings in the played template's own display face", async () => {
    const { templateBySlug } = await import("@/lib/templates");
    const slug = /const HERO_SLUG = "([a-z-]+)";/.exec(PAGE)![1];
    const font = /import \{ (\w+) \} from "next\/font\/google";/.exec(HERO)![1].replace(/_/g, " ");
    expect(font).toBe(templateBySlug(slug)!.theme.fontDisplay);
  });

  it("keeps the demo out of the reading order and names it in words", () => {
    // Three headings from somebody else's site would be read out as if they were ours.
    expect(HERO).toMatch(/ref=\{screenRef\}\s*aria-hidden="true"/);
    expect(HERO).toContain("That was {template.name}, one of {templateCount} templates");
    expect(HERO).toContain("href={`/templates/${template.slug}`}");
  });
});
