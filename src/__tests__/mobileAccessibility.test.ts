import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createElement, type ComponentType, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Pins the phone and keyboard fixes measured with axe-core and a Tab walk at 390x844:
 * no nested controls, labelled or hidden file inputs, a heading and landmarks in the
 * editor, controls that do not trigger iOS zoom, visible focus, and 44px tap targets.
 */

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("template=orbitcrm"),
  useRouter: () => ({ push() {}, replace() {}, prefetch() {} }),
  usePathname: () => "/",
}));

type Tag = { name: string; attrs: string; selfClosing: boolean; closing: boolean };

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

function tags(html: string): Tag[] {
  const out: Tag[] = [];
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g)) {
    out.push({ closing: m[1] === "/", name: m[2].toLowerCase(), attrs: m[3], selfClosing: m[4] === "/" || VOID.has(m[2].toLowerCase()) });
  }
  return out;
}

function attr(t: Tag, name: string): string | null {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(t.attrs);
  return m ? m[1] : null;
}

function isInteractive(t: Tag): boolean {
  if (attr(t, "tabindex") === "-1") return false;
  if (t.name === "a") return attr(t, "href") !== null;
  if (["button", "select", "textarea"].includes(t.name)) return true;
  if (t.name === "input") return attr(t, "type") !== "hidden";
  return ["button", "link", "checkbox", "switch", "tab", "menuitem"].includes(attr(t, "role") ?? "");
}

/** Interactive elements opened while another interactive element is still open. */
function nestedInteractive(html: string): string[] {
  const stack: { name: string; interactive: boolean }[] = [];
  const found: string[] = [];
  for (const t of tags(html)) {
    if (t.closing) {
      const at = stack.map((s) => s.name).lastIndexOf(t.name);
      if (at >= 0) stack.length = at;
      continue;
    }
    const interactive = isInteractive(t);
    if (interactive && stack.some((s) => s.interactive)) found.push(`<${t.name}${t.attrs.slice(0, 80)}>`);
    if (!t.selfClosing) stack.push({ name: t.name, interactive });
  }
  return found;
}

function classes(t: Tag): string[] {
  return (attr(t, "class") ?? "").split(/\s+/).filter(Boolean);
}

const TAP = /^(max-md:|max-sm:)?(min-h-11|h-11)$/;
const hasTapHeight = (t: Tag) => classes(t).some((c) => TAP.test(c));

async function renderEditor(): Promise<string> {
  const { default: EditorPage } = await import("@/app/editor/page");
  return renderToStaticMarkup(createElement(EditorPage));
}

describe("the editor", () => {
  it("has one h1 naming the site, a header and a main", async () => {
    const html = await renderEditor();
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toMatch(/<h1 class="sr-only">Editing OrbitCRM<\/h1>/);
    expect(html).toContain("<header");
    expect(html.match(/<main[\s>]/g)).toHaveLength(1);
  });

  it("nests no control inside another, section rows included", async () => {
    const html = await renderEditor();
    expect(html.match(/data-section-row/g)?.length ?? 0).toBeGreaterThan(3);
    expect(nestedInteractive(html)).toEqual([]);
  });

  it("selects a section with a real button, so Enter and Space work natively", async () => {
    const html = await renderEditor();
    const selects = tags(html).filter((t) => t.name === "button" && t.attrs.includes("data-row-select"));
    expect(selects.length).toBe(html.match(/data-section-row/g)!.length);
    for (const b of selects) {
      expect(attr(b, "aria-pressed")).toMatch(/^(true|false)$/);
      expect(classes(b)).toContain("focus-visible:ring-2");
    }
  });

  it("hides every file input from the tab order and screen readers, or labels it", () => {
    const src = readFileSync("src/app/editor/page.tsx", "utf8");
    const inputs = [...src.matchAll(/<input\b[\s\S]*?\/>/g)].map((m) => m[0]).filter((s) => s.includes('type="file"'));
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    for (const input of inputs) {
      const hidden = input.includes('aria-hidden="true"') && input.includes("tabIndex={-1}");
      expect(hidden || input.includes("aria-label="), input.slice(0, 120)).toBe(true);
    }
  });

  it("sets no helper text below 12px", () => {
    for (const f of ["src/app/editor/page.tsx", "src/components/AssistantBar.tsx"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/text-\[(9|10|11)px\]/);
    }
  });
});

describe("the /create stepper fits a 360px screen", () => {
  it("shortens connectors and hides the other steps' labels below sm", () => {
    const src = readFileSync("src/app/create/page.tsx", "utf8");
    expect(src).toContain('<ol aria-label="Steps" data-stepper');
    expect(src).toContain('aria-current={i === step ? "step" : undefined}');
    expect(src).toContain('<span className={i === step ? undefined : "max-sm:sr-only"}>{s}</span>');
    expect(src).toMatch(/className=\{`w-4 sm:w-8 h-px/);
    expect(src).not.toMatch(/className=\{`w-8 h-px/);
  });
});

describe("the home hero", () => {
  async function hero(): Promise<Tag[]> {
    const { default: PromptHero } = await import("@/components/PromptHero");
    return tags(renderToStaticMarkup(createElement(PromptHero, { reducedMotion: true })));
  }

  it("keeps the quality select at 16px and 44px tall on phones, with a focus ring", async () => {
    const select = (await hero()).find((t) => t.name === "select" && attr(t, "id") === "hero-quality")!;
    const c = classes(select);
    expect(c).toEqual(expect.arrayContaining(["text-base", "sm:text-xs", "h-11", "sm:h-9"]));
    expect(c).not.toContain("text-xs");
    expect(c).toEqual(expect.arrayContaining(["focus-visible:outline-solid", "focus-visible:outline-2", "focus-visible:outline-ring"]));
  });

  it("outlines the description box itself when it has focus", async () => {
    const textarea = (await hero()).find((t) => t.name === "textarea")!;
    expect(classes(textarea)).toEqual(expect.arrayContaining(["focus-visible:outline-solid", "focus-visible:outline-2", "focus-visible:outline-ring"]));
  });

  it("makes the example chips 44px tall on phones", async () => {
    const all = await hero();
    const chips = all.filter((t) => t.name === "button" && classes(t).includes("rounded-full"));
    expect(chips.length).toBeGreaterThanOrEqual(3);
    for (const chip of chips) expect(classes(chip)).toContain("min-h-11");
  });
});

describe("guide code blocks", () => {
  const PAGES: Record<string, () => Promise<{ default: ComponentType }>> = {
    "/scroll-animation": () => import("@/app/scroll-animation/page"),
    "/video-scroll-animation": () => import("@/app/video-scroll-animation/page"),
  };

  it.each(Object.keys(PAGES))("can be reached and scrolled from the keyboard on %s", async (path) => {
    const { default: Page } = await PAGES[path]();
    const pres = tags(renderToStaticMarkup(createElement(Page))).filter((t) => t.name === "pre" && !t.closing);
    expect(pres.length).toBeGreaterThan(0);
    for (const pre of pres) {
      expect(attr(pre, "tabindex")).toBe("0");
      expect(attr(pre, "role")).toBe("region");
      expect(attr(pre, "aria-label")).toMatch(/^Code example/);
      expect(classes(pre)).toContain("focus-visible:outline-2");
    }
  });
});

describe("site-wide tap targets on phones", () => {
  it("gives every footer link a 44px tap height below md", async () => {
    const { default: SiteFooter } = await import("@/components/SiteFooter");
    for (const compact of [false, true]) {
      const links = tags(renderToStaticMarkup(createElement(SiteFooter, { compact }))).filter((t) => t.name === "a" && !t.closing);
      expect(links.length).toBeGreaterThan(0);
      for (const a of links) expect(hasTapHeight(a), `${attr(a, "href")} in compact=${compact}`).toBe(true);
    }
  });

  it("gives the nav's logo and mobile menu links a 44px tap height", async () => {
    const { default: Navbar } = await import("@/components/Navbar");
    const logo = tags(renderToStaticMarkup(createElement(Navbar))).find((t) => t.name === "a" && attr(t, "aria-label") === "ScrollCraft home")!;
    expect(hasTapHeight(logo)).toBe(true);
    const menu = readFileSync("src/components/Navbar.tsx", "utf8");
    const mobile = menu.slice(menu.indexOf('id="mobile-menu"'));
    for (const m of mobile.matchAll(/className=\{?[`"]lc-mono ([^`"]*)/g)) expect(m[1]).toContain("min-h-11");
  });

  it("makes standalone lc-link anchors 44px tall below md", () => {
    expect(readFileSync("src/app/globals.css", "utf8")).toMatch(/@media not \(min-width: 48rem\) \{\s*a\.lc-link \{\s*min-height: 2\.75rem;/);
  });

  it("gives /describe's example button a tap height", () => {
    const src = readFileSync("src/app/describe/DescribeClient.tsx", "utf8");
    const at = src.indexOf("Use an example");
    expect(src.slice(at - 300, at)).toContain("min-h-11 md:min-h-0");
  });
});

describe("the template gallery on a phone", () => {
  async function gallery(): Promise<string> {
    const { default: TemplatesPage } = await import("@/app/templates/page");
    return renderToStaticMarkup((await TemplatesPage({ searchParams: Promise.resolve({}) })) as ReactElement);
  }

  it("keeps the sort select at 16px below sm", async () => {
    const select = tags(await gallery()).find((t) => t.name === "select" && attr(t, "id") === "template-sort")!;
    expect(classes(select)).toEqual(expect.arrayContaining(["text-base", "sm:text-xs", "h-11"]));
  });

  it("gives card names a tap height and nests no button inside a link", async () => {
    const html = await gallery();
    expect(nestedInteractive(html)).toEqual([]);
    const all = tags(html);
    const names = all.filter((t, i) => t.name === "a" && all[i - 1]?.name === "h2");
    expect(names.length).toBeGreaterThan(10);
    for (const a of names) expect(hasTapHeight(a), attr(a, "href") ?? "").toBe(true);
  });

  it("sets no chip or meta text below 12px", () => {
    expect(readFileSync("src/app/templates/TemplatesClient.tsx", "utf8")).not.toMatch(/text-\[(9|10|11)px\]/);
  });
});

describe("template and category pages on a phone", () => {
  it("gives breadcrumb and related links a tap height, inside a landmark", async () => {
    const { default: TemplatePage } = await import("../app/templates/[slug]/page");
    const html = renderToStaticMarkup((await TemplatePage({ params: Promise.resolve({ slug: "cinder-restaurant" }) })) as ReactElement);
    const all = tags(html);
    const crumbsAt = all.findIndex((t) => t.name === "nav" && attr(t, "aria-label") === "Breadcrumb");
    const crumbLinks = all.slice(crumbsAt).filter((t) => t.name === "a" && !t.closing).slice(0, 2);
    for (const a of crumbLinks) expect(hasTapHeight(a), attr(a, "href") ?? "").toBe(true);
    const related = all.filter((t) => t.name === "a" && /^\/templates\/[a-z-]+$/.test(attr(t, "href") ?? "") && classes(t).includes("font-medium"));
    expect(related.length).toBeGreaterThan(0);
    for (const a of related) expect(hasTapHeight(a)).toBe(true);
    expect(html).toContain('<section id="about" aria-labelledby="about-template"');
    expect(html).toContain('<nav aria-label="Template"');
    expect(nestedInteractive(html)).toEqual([]);
  });

  it("sets the category page's meta line at 12px or more", () => {
    expect(readFileSync("src/app/templates/category/[category]/page.tsx", "utf8")).not.toMatch(/text-\[(9|10|11)px\]/);
  });
});
