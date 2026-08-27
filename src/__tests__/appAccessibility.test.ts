import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Measured with Lighthouse, every public page scores 100 for accessibility, best
 * practices and SEO. These pin the specific decisions that earn it, because each one was
 * a real failure found by auditing the running app rather than reading the source.
 */

function sourceFiles(exts = [".ts", ".tsx"]): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "generated" || entry.name === "__tests__") continue;
        walk(full);
      } else if (exts.some((e) => entry.name.endsWith(e))) {
        out.push(full);
      }
    }
  })("src");
  return out;
}

const CSS = readFileSync("src/app/globals.css", "utf8");

/** oklch -> sRGB -> WCAG relative luminance, so the ratios below are measured not asserted. */
function oklchToRgb(L: number, C: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const [l, m, s] = [l_ ** 3, m_ ** 3, s_ ** 3];
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const enc = (x: number) => {
    const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055;
    return Math.min(1, Math.max(0, v));
  };
  return [enc(lin[0]), enc(lin[1]), enc(lin[2])];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function readOklchToken(name: string): [number, number, number] {
  const m = new RegExp(`--${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`).exec(CSS);
  expect(m, `--${name} not found as an oklch() value`).toBeTruthy();
  return [Number(m![1]), Number(m![2]), Number(m![3])];
}

// The darkest surface accent text sits on.
const DARKEST_SURFACE: [number, number, number] = [0x03 / 255, 0x03 / 255, 0x03 / 255];
const CARD_SURFACE: [number, number, number] = [0x0d / 255, 0x0d / 255, 0x0d / 255];

describe("accent colours meet WCAG AA where they are used", () => {
  it("has a separate ink token for accent text", () => {
    // --primary doubles as a button fill; it cannot also be light enough to read as text.
    expect(CSS).toContain("--primary-ink:");
    expect(CSS).toContain("--color-primary-ink: var(--primary-ink);");
  });

  it("accent text clears 4.5:1 on every dark surface it appears on", () => {
    const ink = oklchToRgb(...readOklchToken("primary-ink"));
    for (const [label, surface] of [["page", DARKEST_SURFACE], ["card", CARD_SURFACE]] as const) {
      const ratio = contrast(ink, surface);
      expect(ratio, `accent text on the ${label} surface is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps white legible on the accent fill, which is why the two are separate", () => {
    const fill = oklchToRgb(...readOklchToken("primary"));
    const ratio = contrast([1, 1, 1], fill);
    expect(ratio, `white on the accent fill is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it("uses the ink token for accent text rather than the fill token", () => {
    // `text-primary` measured 3.18:1 and failed on 31 nodes across the app.
    const offenders = sourceFiles([".tsx"]).filter((f) =>
      /className="[^"]*\btext-primary\b(?!-)/.test(readFileSync(f, "utf8"))
    );
    expect(offenders, "found accent text using the fill token").toEqual([]);
  });
});

describe("decoration is not presented as text", () => {
  it("draws the ornamental numerals as generated content", () => {
    // At the opacity the design calls for, these could never meet a contrast floor, and
    // they carry no meaning. WCAG 1.4.3 exempts pure decoration; a pseudo-element is how
    // that is expressed so a checker agrees.
    expect(CSS).toContain(".sc-ornament::before");
    const home = readFileSync("src/app/page.tsx", "utf8");
    expect(home).toContain("sc-ornament");
    expect(home).not.toMatch(/text-white\/4[^"]*">\{p\.step\}/);
  });
});

describe("the prose styling on the legal pages is real", () => {
  it("registers the typography plugin the prose classes depend on", () => {
    // The three legal pages carried `prose prose-invert prose-sm` while the plugin was
    // not installed, so every one of those classes was inert and the pages rendered as
    // unstyled markup.
    expect(CSS).toContain('@plugin "@tailwindcss/typography"');
  });

  it("has the plugin as a real dependency", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps["@tailwindcss/typography"]).toBeTruthy();
  });
});

describe("the editor is reachable without a mouse", () => {
  const editor = readFileSync("src/app/editor/page.tsx", "utf8");

  it("wraps its working area in a main landmark", () => {
    expect(editor).toMatch(/<main className="flex flex-1/);
  });

  it("names its icon-only controls", () => {
    expect(editor).toContain('aria-label="Add section"');
    expect(editor).toContain('aria-label="Site name"');
  });
});

describe("analytics does not break a self-hosted deploy", () => {
  it("only mounts the Vercel script when Vercel is serving", () => {
    // Mounted unconditionally the insights script 404s and trips strict MIME checking,
    // logging two console errors on every page of every non-Vercel deployment.
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toContain("process.env.NEXT_PUBLIC_VERCEL_ENV ? <Analytics /> : null");
  });
});
