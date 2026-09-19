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

// The surfaces accent text actually sits on: the page ground and a card.
const DARKEST_SURFACE: [number, number, number] = [0x03 / 255, 0x07 / 255, 0x10 / 255];
const CARD_SURFACE: [number, number, number] = [0x0a / 255, 0x11 / 255, 0x22 / 255];

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
  it("renders no ornamental numeral as low-opacity text", () => {
    // The pipeline and feature cards once drew faint step numbers as text, which no
    // contrast floor can pass. Those sections went with the redesign, and the
    // generated-content class with them; this keeps the pattern from coming back as text.
    const offenders = sourceFiles([".tsx"]).filter((f) =>
      /text-white\/4[^"]*">\{(p\.step|i \+ 1)\}/.test(readFileSync(f, "utf8"))
    );
    expect(offenders, "an ornamental numeral is rendered as text").toEqual([]);
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
    // Asserted on the element, not its classes, so a layout change cannot fail it.
    expect(editor).toMatch(/<main className=/);
  });

  it("names its icon-only controls", () => {
    expect(editor).toContain('aria-label="Add section"');
    expect(editor).toContain('aria-label="Site name"');
  });

  it("advertises its shortcuts in the key the visitor actually has", () => {
    // The handler accepts metaKey and ctrlKey alike, but the titles promised ⌘ to
    // everyone. Verified in Chrome: a Mac sees ⌘+Z, a spoofed Win32 platform sees
    // Ctrl+Z, with no hydration mismatch (useSyncExternalStore with a "Ctrl" server
    // snapshot). Save and Export carry titles too — they had shortcuts nobody could
    // discover.
    expect(editor).not.toMatch(/title="[^"]*⌘/);
    for (const title of [
      "title={`Undo (${modKey}+Z)`}",
      "title={`Redo (${modKey}+Shift+Z)`}",
      "title={`Save (${modKey}+S)`}",
      "title={exportStage ?? `Export (${modKey}+E)`}",
    ]) {
      expect(editor).toContain(title);
    }
    expect(editor).toContain('() => "Ctrl"');
  });

  it("gives every icon-only control a target WCAG 2.5.8 accepts", () => {
    // A 14px icon needs p-1.5 to clear 24px; p-1 gives 22 and p-0.5 gives 18. Measured
    // in Chrome at 390x844 against a production build: twelve controls under 24px
    // before, none after. Each string below appears in the previous revision.
    for (const tooTight of [
      'className="p-1 rounded',
      'className="p-0.5 ',
      "className={`p-1 rounded",
    ]) {
      expect(editor, `${tooTight} is a target under 24px`).not.toContain(tooTight);
    }
  });
});

describe("the editor's section list survives a nine-section template", () => {
  /**
   * Templates went from four sections to nine, which turned two small annoyances into
   * an unusable list. Measured in Chrome on kiln-coffee: seven of nine labels were
   * clipped to "Roasted t..." and "Light eno...", and two rows were spacers labelled
   * "Section 4" and "Section 8" whose inspector offered an eyebrow, a heading, a body,
   * a button and an image - five fields a spacer does not have. After: zero clipped.
   */
  const editor = readFileSync("src/app/editor/page.tsx", "utf8");

  it("names a spacer instead of numbering it like content", () => {
    expect(editor).toContain('<span className="text-xs flex-1 text-muted-foreground italic">Spacer · {s.scrollHeight}px</span>');
  });

  it("gives a heading the whole row rather than one clipped line", () => {
    expect(editor).toContain('className="text-xs flex-1 line-clamp-2 leading-snug"');
    // truncate is one line and was the reason seven of nine were unreadable.
    expect(editor).not.toMatch(/<span className="text-xs flex-1 truncate">/);
  });

  it("takes the row controls out of the flow, so they reserve no width", () => {
    // opacity-0 still occupies layout: four buttons held about 100px of a 224px panel
    // even while invisible, which is what starved the label.
    expect(editor).toContain('className="absolute right-1 top-1 flex items-center gap-0.5');
    expect(editor).not.toMatch(/flex items-center gap-0\.5 flex-shrink-0 opacity-0/);
    // Absolute positioning needs a containing block on the row.
    expect(editor).toMatch(/className=\{`group relative flex items-start gap-2/);
  });

  it("offers a spacer only what a spacer has", () => {
    const content = editor.slice(editor.indexOf('<TabsContent value="content"'), editor.indexOf('<TabsContent value="style"'));
    expect(content).toContain('selectedSectionData.kind === "spacer" ?');
    expect(content).toContain("This is a spacer");
    // The height, which is the one thing it does have, stays on the Layout tab.
    expect(editor).toContain('aria-label="Section height in pixels"');
  });
});

describe("the editor fits a phone", () => {
  const editor = readFileSync("src/app/editor/page.tsx", "utf8");

  /**
   * Measured in Chrome at 390x844 against a production build, with the template loaded.
   * Before: nine controls off the right edge, including Export, the Layout/Audio/Code
   * tabs and every text input in the inspector, reachable only by scrolling the whole
   * app sideways. After: none.
   */
  it("stacks its panels rather than scrolling the app sideways", () => {
    expect(editor).toContain('<main className="flex flex-col md:flex-row flex-1');
  });

  it("gives every panel the full width before it stacks", () => {
    expect(editor).toMatch(/className="w-full max-h-52 md:w-56/);
    expect(editor).toMatch(/className="w-full md:w-72/);
  });

  it("lets the toolbar wrap, so Export does not fall off the edge", () => {
    expect(editor).toContain('<div className="flex items-center gap-2 flex-wrap justify-end">');
  });

  it("fits the inspector tabs in the panel that holds them", () => {
    // Five icon-and-label tabs overflowed a 288px panel at every width: Content was
    // clipped on the left and Code ran off the right, where it could not be clicked.
    const tabStrip = editor.slice(editor.indexOf("<TabsList"), editor.indexOf("</TabsList>"));
    expect(tabStrip).toContain("grid grid-cols-5");
    expect(tabStrip).not.toMatch(/<(Type|Sparkles|Settings|Music) /);
  });
});

describe("the app has one theme and every component agrees on it", () => {
  it("fixes the theme on the document, with no provider and no switch", () => {
    expect(readFileSync("src/app/layout.tsx", "utf8")).toMatch(/<html lang="en" className={`dark /);
    // Nothing resolves the theme at runtime, so nothing may ask the OS what it is.
    const askers = sourceFiles().filter((f) => readFileSync(f, "utf8").includes("next-themes"));
    expect(askers, "a component reads the theme from next-themes, which has no provider").toEqual([]);
  });

  it("tells the toaster the theme instead of letting it read the OS", () => {
    // useTheme() with no provider returns "system", so sonner followed
    // prefers-color-scheme. Measured in Chrome with the media feature emulated: on a
    // machine set to light the toaster rendered data-sonner-theme="light" and a
    // rgb(240,248,255) card over the black app.
    expect(readFileSync("src/components/ui/sonner.tsx", "utf8")).toContain('theme="dark"');
  });

  it("has dropped the dependency that was only there to answer that question", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect({ ...pkg.dependencies, ...pkg.devDependencies }["next-themes"]).toBeUndefined();
  });
});

describe("every form control has a name a screen reader can read", () => {
  /**
   * Measured in Chrome against production builds by walking every rendered input,
   * textarea, select and role=switch and checking for a label, aria-label,
   * aria-labelledby or title. Before: 3 on /contact, 1 on /presets, 1 on the /create
   * configure step. After: 0 on all of them.
   */
  it("associates every contact field with its label", () => {
    const contact = readFileSync("src/app/contact/page.tsx", "utf8");
    for (const id of ["contact-name", "contact-email", "contact-message"]) {
      expect(contact, `${id} has no label association`).toContain(`htmlFor="${id}"`);
      expect(contact, `${id} is not on a control`).toContain(`id="${id}"`);
    }
    // The topic pills are a group, not a field: a bare <label> named nothing.
    expect(contact).toContain('role="group" aria-labelledby="contact-topic-label"');
    expect(contact).toContain("aria-pressed={form.topic === t}");
  });

  it("names the presets search box", () => {
    const presets = readFileSync("src/app/presets/page.tsx", "utf8");
    expect(presets).toContain('<label htmlFor="preset-search" className="sr-only">Search presets</label>');
    expect(presets).toContain('id="preset-search"');
  });

  it("keeps every preset card legible and its actions reachable on a touch screen", () => {
    // The actions sat in an overlay that was hidden only where hover exists, so on a
    // phone all 57 cards carried a 60% black layer over a blurred name. Measured on the
    // live page with hover:none: 57 of 57 overlays showing, and 30 of the 57 previews
    // under 8/255 mean luma, which is why the frame now carries the name and palette.
    const presets = readFileSync("src/app/presets/page.tsx", "utf8");
    expect(presets, "the hover-only overlay is back").not.toContain("[@media(hover:hover)]:opacity-0");
    expect(presets, "text under 12px is back").not.toContain("text-[11px]");
    expect(presets, "the palette is not shown").toContain("preset.colors.map(");
    expect(presets).toContain("href={`/create?template=${encodeURIComponent(preset.name)}`}");
  });

  it("names the mobile-variant switch", () => {
    // role="switch" with aria-checked and no name announces only its state.
    const create = readFileSync("src/app/create/page.tsx", "utf8");
    const sw = create.slice(create.indexOf('role="switch"') - 400, create.indexOf('role="switch"') + 200);
    expect(sw).toMatch(/aria-label="(Generate mobile variant|Portrait frames for an uploaded video)"/);
  });
});

describe("Enter belongs to the control that has focus", () => {
  it("does not also run the create wizard's own Enter handler", () => {
    // The browser already turns Enter on a focused button into a click. Handling it at
    // the window too meant one keypress both chose a palette and started generation.
    // Verified in Chrome: on the previous build, focusing a palette swatch and pressing
    // Enter started generation; now it does not, while Enter on a non-interactive
    // target still advances the wizard.
    const create = readFileSync("src/app/create/page.tsx", "utf8");
    expect(create).not.toMatch(/if \(tag === "INPUT" \|\| tag === "TEXTAREA"\) return;/);
    expect(create).toContain(`el.closest("input, textarea, select, button, a[href], [contenteditable], [role='switch'], [role='button']")`);
  });
});

describe("controls that open something say whether it is open", () => {
  /**
   * Both are disclosure widgets rendered as plain buttons: the state was visible only
   * as a rotating "+" or a swapped icon, so a screen reader was told a button existed
   * and nothing about what it did. Verified in Chrome on both builds - before, neither
   * carried aria-expanded at all; after, both toggle it and their aria-controls
   * resolves to the element that appears.
   */
  it("tells assistive tech whether the mobile menu is open", () => {
    const navbar = readFileSync("src/components/Navbar.tsx", "utf8");
    expect(navbar).toContain("aria-expanded={open}");
    expect(navbar).toContain('aria-controls="mobile-menu"');
    // aria-controls pointing at nothing is worse than omitting it.
    expect(navbar).toContain('id="mobile-menu"');
  });

  it("wires each FAQ row to the answer it reveals", () => {
    const home = readFileSync("src/app/HomeClient.tsx", "utf8");
    expect(home).toContain("aria-expanded={openFaq === i}");
    expect(home).toContain("aria-controls={`faq-answer-${i}`}");
    expect(home).toContain("id={`faq-question-${i}`}");
    expect(home).toContain('role="region"');
    expect(home).toContain("aria-labelledby={`faq-question-${i}`}");
    // The "+" is decoration; the state is on the button.
    expect(home).toMatch(/<span aria-hidden="true" className=\{`text-muted-foreground text-lg/);
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

describe("the sticky nav reads on both grounds", () => {
  it("turns light over a pale band instead of staying a dark slab", () => {
    const navbar = readFileSync("src/components/Navbar.tsx", "utf8");
    expect(navbar).toContain('".band-light"');
    expect(navbar).toContain('onLight ? "nav-on-light border-black/10 bg-band/95" : "border-white/[0.08] bg-background/70"');
    // Same token set as the band itself, so nothing inside the nav needs its own rule.
    expect(CSS).toMatch(/\.band-light,\s*\.nav-on-light\s*\{/);
  });

  it("is frosted glass the way Apple's is, not a box", () => {
    // Read off apple.com: saturate(1.8) blur(20px) over a translucent ground, full width.
    const navbar = readFileSync("src/components/Navbar.tsx", "utf8");
    expect(navbar).toContain("backdrop-blur-[20px] backdrop-saturate-[1.8]");
    expect(navbar).not.toMatch(/rounded-md border border-border backdrop-blur/);
  });

  it("keeps one definition of its height for everything that sits against it", () => {
    // The hero tucks under the nav and the stage tabs stick below it. Each hardcoded 76px,
    // which silently broke the moment the nav changed height.
    expect(CSS).toContain("--nav-h:");
    for (const f of ["src/components/HeroSequence.tsx", "src/components/Lifecycle.tsx", "src/components/Navbar.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src, `${f} hardcodes the nav height`).not.toMatch(/\[76px\]/);
      expect(src).toContain("var(--nav-h)");
    }
  });

  it("does not leave the cyan mark on the pale ground, where it cannot be read", () => {
    // The last occurrence: the first is inside the selector list it shares with .band-light.
    const start = CSS.lastIndexOf(".nav-on-light {");
    const block = CSS.slice(start, CSS.indexOf("}", start));
    expect(block).toContain("--primary-ink: oklch(0.55 0.19 256.4)");
  });
});
