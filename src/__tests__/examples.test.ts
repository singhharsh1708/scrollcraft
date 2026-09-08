import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sectionsSchema } from "@/lib/siteSchema";

/**
 * The example sites.
 *
 * These exist to answer "what will it look like" with the artefact rather than a mock-up:
 * each one is a committed `scrollcraft.json` that the build turns into the same
 * self-contained bundle a reader downloads. Only the specs are in the repository, so
 * these tests check the specs and the wiring, not the generated output.
 */

type Example = { slug: string; name: string; tagline: string; note: string; style: string; count: number; width: number; mobileWidth: number };

const MANIFEST: Example[] = JSON.parse(readFileSync("examples/manifest.json", "utf8"));
const spec = (slug: string) => JSON.parse(readFileSync(join("examples", slug, "scrollcraft.json"), "utf8"));
const KNOWN_STYLES = ["aurora", "nebula", "tide", "ember", "dusk", "monolith"];

describe("the example manifest", () => {
  it("ships more than one, so the page is a comparison", () => {
    expect(MANIFEST.length).toBeGreaterThanOrEqual(3);
  });

  it("has a directory and a spec for every entry", () => {
    for (const e of MANIFEST) {
      expect(existsSync(join("examples", e.slug, "scrollcraft.json")), `${e.slug} has no spec`).toBe(true);
    }
  });

  it("has no spec directory the manifest forgot", () => {
    const dirs = readdirSync("examples", { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    expect(dirs.sort()).toEqual(MANIFEST.map((e) => e.slug).sort());
  });

  it("asks for a frame count the scroll track can actually use", () => {
    for (const e of MANIFEST) {
      const track =
        spec(e.slug).sections
          .filter((s: { visible?: boolean }) => s.visible !== false)
          .reduce((n: number, s: { scrollHeight?: number }) => n + (s.scrollHeight ?? 1000), 0) + 1000;
      // Under roughly 200px of scroll per frame the scrub reads as continuous; above it
      // the background visibly steps.
      expect(track / e.count, `${e.slug} scrolls too far per frame`).toBeLessThan(200);
    }
  });

  it("explains any palette override, so it cannot become a magic value", () => {
    // caskwright overrides ember's palette because ember is the darkest of the six:
    // measured across all 16 verify positions it sat at 10.6 median composite luma
    // against 17.7 and 19.6 for the other two. A bare hex string in the manifest would
    // read as arbitrary six months from now.
    for (const e of MANIFEST as (Example & { colors?: string; colorsNote?: string })[]) {
      if (!e.colors) continue;
      expect(e.colors, `${e.slug} colors is not a hex list`).toMatch(/^#[0-9a-f]{6}(,#[0-9a-f]{6})+$/i);
      expect(e.colorsNote, `${e.slug} overrides the palette without saying why`).toBeTruthy();
      expect((e.colorsNote ?? "").length, `${e.slug} note is too thin to be a reason`).toBeGreaterThan(60);
    }
  });

  it("names only frame styles the generator knows", () => {
    for (const e of MANIFEST) expect(KNOWN_STYLES, e.slug).toContain(e.style);
  });

  it("gives each one its own frame style, so the three do not look alike", () => {
    const styles = MANIFEST.map((e) => e.style);
    expect(new Set(styles).size, "two examples share a frame style").toBe(styles.length);
  });

  it("uses url-safe slugs", () => {
    for (const e of MANIFEST) expect(e.slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("describes each one in its own words", () => {
    for (const e of MANIFEST) {
      expect(e.tagline.length, e.slug).toBeGreaterThan(10);
      expect(e.note.length, e.slug).toBeGreaterThan(20);
    }
  });
});

describe("every example spec", () => {
  it("validates against the schema the editor and exporter share", () => {
    for (const e of MANIFEST) {
      const parsed = sectionsSchema.safeParse(spec(e.slug).sections);
      expect(parsed.success, `${e.slug}: ${parsed.error?.issues[0]?.message}`).toBe(true);
    }
  });

  it("carries real copy, not the scaffold's placeholders", () => {
    for (const e of MANIFEST) {
      const text = JSON.stringify(spec(e.slug)).toLowerCase();
      for (const banned of ["lorem", "ipsum", "replace this copy", "your text here", "todo", "section 1"]) {
        expect(text, `${e.slug} contains placeholder copy`).not.toContain(banned);
      }
    }
  });

  it("claims no customer counts or review scores it could not defend", () => {
    // Same rule the exported-site check applies. An example is a sales surface, which is
    // exactly where invented numbers get written.
    for (const e of MANIFEST) {
      const text = JSON.stringify(spec(e.slug));
      expect(text, `${e.slug} invents social proof`).not.toMatch(
        /\btrusted by\b|\bjoin\s+\d[\d,.]*|\d[\d,.]*\s*(k|m|\+)?\s+(\w+\s+){0,2}(teams|customers|users|clients|companies|reviews|members)\b/i
      );
    }
  });

  it("varies its layouts, so none reads as one repeated screen", () => {
    for (const e of MANIFEST) {
      const layouts = new Set(
        spec(e.slug).sections.filter((s: { kind?: string }) => s.kind !== "spacer").map((s: { layout?: string }) => s.layout ?? "center")
      );
      expect(layouts.size, `${e.slug} uses one layout throughout`).toBeGreaterThan(2);
    }
  });

  it("uses at most two statement sections, or none of them land", () => {
    for (const e of MANIFEST) {
      const n = spec(e.slug).sections.filter((s: { kind?: string }) => s.kind === "statement").length;
      expect(n, e.slug).toBeLessThanOrEqual(2);
    }
  });

  it("does not open or close on a spacer", () => {
    for (const e of MANIFEST) {
      const secs = spec(e.slug).sections;
      expect(secs[0].kind, e.slug).not.toBe("spacer");
      expect(secs[secs.length - 1].kind, e.slug).not.toBe("spacer");
    }
  });

  it("ends on a call to action", () => {
    for (const e of MANIFEST) {
      const secs = spec(e.slug).sections;
      const last = [...secs].reverse().find((s: { kind?: string }) => s.kind !== "spacer");
      expect(last?.ctaLabel, `${e.slug} has no closing CTA`).toBeTruthy();
    }
  });

  it("paces every section long enough to be read", () => {
    for (const e of MANIFEST) {
      for (const s of spec(e.slug).sections) {
        expect(s.scrollHeight ?? 1000, `${e.slug} section too short`).toBeGreaterThanOrEqual(400);
      }
    }
  });

  it("gives the canvas a label, since the canvas is the whole visual", () => {
    for (const e of MANIFEST) expect(spec(e.slug).canvasAlt, e.slug).toBeTruthy();
  });

  it("uses a display face none of the templates use, so examples do not read as templates", () => {
    const templateFaces = new Set(
      [...readFileSync("src/lib/templates.ts", "utf8").matchAll(/fontDisplay: "([^"]+)"/g)].map((m) => m[1])
    );
    for (const e of MANIFEST) {
      const face = spec(e.slug).theme?.fontDisplay;
      expect(face, `${e.slug} has no display face`).toBeTruthy();
      expect(templateFaces, `${e.slug} reuses a template's display face (${face})`).not.toContain(face);
    }
  });
});

describe("the examples are reachable", () => {
  it("is linked from the nav and the footer", () => {
    expect(readFileSync("src/components/Navbar.tsx", "utf8")).toContain('href: "/examples"');
    expect(readFileSync("src/components/SiteFooter.tsx", "utf8")).toContain('"/examples"');
  });

  it("redirects the bare URL rather than rewriting it", () => {
    // A rewrite serves index.html under the shorter path, so the bundle's relative frame
    // paths resolve one directory too high and every frame 404s. That is a black canvas
    // with nothing in the console, which is the failure the bundle contract names.
    const config = readFileSync("next.config.ts", "utf8");
    expect(config).toContain("EXAMPLE_SLUGS");
    expect(config).toMatch(/destination: `\/examples\/\$\{slug\}\/index\.html`/);
    expect(config, "a rewrite would break the relative frame paths").not.toMatch(
      /async rewrites\(\)[\s\S]{0,200}examples/
    );
  });

  it("has card art committed for every example, since the build cannot screenshot", () => {
    for (const e of MANIFEST) {
      const art = join("public/example-previews", `${e.slug}.jpg`);
      expect(existsSync(art), `${art} is missing`).toBe(true);
      expect(readFileSync(art).length, `${art} is suspiciously small`).toBeGreaterThan(5000);
    }
  });

  it("builds the bundles before next build reads their weights", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.scripts.prebuild).toContain("build-examples");
  });

  it("keeps the assembled bundles out of git but the frame sets in it", () => {
    const ignored = readFileSync(".gitignore", "utf8");
    expect(ignored).toMatch(/^public\/examples\/$/m);
    expect(ignored, "frame sets must be committed, the deploy image has no ffmpeg").not.toMatch(
      /^examples\/\*\/frames/m
    );
  });

  // The deploy failed on exactly this: the build ran frames-from-style.mjs, which shells
  // out to ffmpeg to encode the JPEGs, and the build image has no ffmpeg. Frame
  // generation is now opt-in and the committed sets are what the build assembles.
  it("does not generate frames during a build, because the deploy image has no ffmpeg", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.scripts.prebuild).not.toContain("--frames");
    expect(pkg.scripts["examples:frames"], "no way left to regenerate them").toContain("--frames");

    // Anchored to the call site, not to any mention: the header comment names the script
    // while explaining why it no longer runs during a build.
    const script = readFileSync("scripts/build-examples.mjs", "utf8");
    const call = script.indexOf('run("frames-from-style.mjs"');
    expect(call, "the script can no longer generate frames at all").toBeGreaterThan(-1);
    const guard = script.lastIndexOf("if (regenerateFrames) {", call);
    expect(guard, "the frames-from-style call is not behind the --frames flag").toBeGreaterThan(-1);
  });

  it("still builds index.html on every build, so the page cannot outlive the exporter", () => {
    const script = readFileSync("scripts/build-examples.mjs", "utf8");
    expect(script).toContain('run("build-site.mjs"');
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.scripts.prebuild).toContain("build-examples");
  });

  it("ships a gap-free frame set for every example, desktop and mobile", () => {
    // The runtime computes a path from an index rather than listing the directory, so one
    // missing file is a black canvas and no error.
    for (const e of MANIFEST) {
      for (const dir of ["frames", "frames-mobile"]) {
        const path = join("examples", e.slug, dir);
        expect(existsSync(path), `${path} is missing`).toBe(true);
        const files = readdirSync(path).filter((f) => f.endsWith(".jpg")).sort();
        expect(files.length, `${path} has the wrong count`).toBe(e.count);
        files.forEach((f, i) => {
          expect(f, `${path} is not gap-free at ${i}`).toBe(
            `frame_${String(i).padStart(4, "0")}.jpg`
          );
        });
      }
    }
  });
});
