import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const rateLimitMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));

type Handler = typeof import("../app/api/export-site/route").POST;
let POST: Handler;

const SECTIONS = [
  { kind: "spacer", heading: "Not a heading", scrollHeight: 400 },
  { eyebrow: "Rosa's Bakery", heading: "Fresh bread, baked before sunrise", body: "Sourdough from a wood-fired oven.", ctaLabel: "Call to order", ctaHref: "tel:+441130000000", scrollHeight: 1000 },
  { heading: "Forty-eight hours of patience", body: "Every loaf proves overnight.", scrollHeight: 1000 },
  { kind: "statement", heading: "Real bread.", scrollHeight: 1000 },
];

async function exportHtml(extra: Record<string, unknown> = {}): Promise<string> {
  const res = await POST(
    new Request("https://scrollcraft.space/api/export-site", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sections: SECTIONS, siteName: "Rosa's Bakery", frameCount: 12, fps: 24, ...extra }),
    }) as unknown as NextRequest
  );
  expect(res.status).toBe(200);
  return (await res.json()).html as string;
}

/** The markup a reader sees: body up to the first script. */
function bodyMarkup(html: string): string {
  return html.slice(html.indexOf("<body>"), html.indexOf("<script>"));
}

function inside(html: string, open: string, close: string, needle: string): boolean {
  const start = html.indexOf(open);
  const end = html.indexOf(close, start);
  const at = html.indexOf(needle);
  return start > -1 && at > start && at < end;
}

/** Elements left at body level once landmarks, skip links and hidden elements are removed. */
function outsideLandmarks(body: string): string[] {
  const stripped = body
    .replace(/<main[\s\S]*<\/main>/, "")
    .replace(/<nav[\s\S]*?<\/nav>/, "")
    .replace(/<footer[\s\S]*?<\/footer>/, "")
    .replace(/<noscript>[\s\S]*?<\/noscript>/g, "")
    .replace(/<a class="skip-link"[^>]*>[^<]*<\/a>/, "")
    .replace(/<div id="scroll-hint" aria-hidden="true">[\s\S]*?<\/div>\s*<\/div>/, "")
    .replace(/<button[\s\S]*?<\/button>/g, "");
  return [...stripped.matchAll(/<([a-z][a-z0-9]*)\b[^>]*>/g)].map((m) => m[0]).filter((t) => !t.startsWith("<body"));
}

beforeEach(async () => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ allowed: true });
  ({ POST } = await import("../app/api/export-site/route"));
});

describe("web app export landmarks and phone use", () => {
  it.each([true, false])("has one h1, the first real heading, with openOnHeadline %s", async (openOnHeadline) => {
    const html = await exportHtml({ openOnHeadline });
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Fresh bread, baked before sunrise<\/h1>/);
    expect(html).not.toContain("Not a heading");
  });

  it("puts the sections and the canvas inside main and leaves nothing else outside a landmark", async () => {
    const body = bodyMarkup(await exportHtml());
    expect(inside(body, "<main", "</main>", '<div id="scroll-container">')).toBe(true);
    expect(inside(body, "<main", "</main>", '<canvas id="scroll-canvas"')).toBe(true);
    expect(inside(body, "<main", "</main>", '<section id="section-1"')).toBe(true);
    expect(outsideLandmarks(body)).toEqual([]);
  });

  it("does the same on every page of a multi-page site, nav included", async () => {
    const res = await POST(
      new Request("https://scrollcraft.space/api/export-site", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pages: [
            { slug: "index", title: "Home", sections: SECTIONS },
            { slug: "about", title: "About", sections: [{ heading: "About us", scrollHeight: 1000 }] },
          ],
          siteName: "Rosa's Bakery", frameCount: 12, fps: 24, hasAudio: true,
        }),
      }) as unknown as NextRequest
    );
    const { pages } = (await res.json()) as { pages: { html: string }[] };
    expect(pages).toHaveLength(2);
    for (const p of pages) {
      expect(p.html).toContain('<nav id="site-nav" aria-label="Pages">');
      expect(p.html.match(/<h1[\s>]/g)).toHaveLength(1);
      expect(outsideLandmarks(bodyMarkup(p.html))).toEqual([]);
    }
  });

  it("hides the decorative scroll hint from screen readers", async () => {
    expect(await exportHtml()).toContain('<div id="scroll-hint" aria-hidden="true">');
  });

  it("draws a visible focus ring on links, buttons and inputs but not on main after the skip link", async () => {
    const html = await exportHtml();
    expect(html).toMatch(/a:focus-visible, button:focus-visible, input:focus-visible, \[tabindex\]:not\(\[tabindex="-1"\]\):focus-visible \{ outline: 3px solid/);
    expect(html).toContain("main:focus { outline: none; }");
  });

  it("keeps nav links and the audio button at least 44px tall", async () => {
    const res = await POST(
      new Request("https://scrollcraft.space/api/export-site", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pages: [{ slug: "index", title: "Home", sections: SECTIONS }, { slug: "about", title: "About", sections: SECTIONS }],
          siteName: "Rosa's Bakery", frameCount: 12, fps: 24, hasAudio: true,
        }),
      }) as unknown as NextRequest
    );
    const html = ((await res.json()) as { html: string }).html;
    expect(html).toMatch(/#site-nav a \{[^}]*min-height: 44px;/);
    expect(html).toMatch(/#audio-mute \{[^}]*width: 2\.75rem; height: 2\.75rem;/);
    expect(html).toContain('<button id="audio-mute" type="button" title="Toggle audio" aria-label="Toggle audio">');
  });

  it("turns off reveal motion and the hint fade under prefers-reduced-motion", async () => {
    const html = await exportHtml();
    expect(html).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.section-content\[data-reveal\], \.section-content\[data-reveal="stagger"\] > \* \{\s*opacity: 1 !important; transform: none !important; clip-path: none !important; transition: none !important;/);
    expect(html).toContain("@media (prefers-reduced-motion: reduce) { #scroll-hint { transition: none; } }");
  });
});

const BUILD_SITE = path.resolve(__dirname, "../../plugins/scrollcraft/skills/scrollcraft/scripts/build-site.mjs");
const ONE_PX_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof" +
    "Hh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDU0NP/bAEMBCQkJDAsMGA0NGDIhHCEy" +
    "MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAB" +
    "AAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAA" +
    "AAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMB" +
    "AAIRAxEAPwCdABmX/9k=",
  "base64"
);

describe("plugin build-site landmarks", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scrollcraft-a11y-"));
    fs.mkdirSync(path.join(tmp, "frames"));
    for (const i of [0, 1, 2]) fs.writeFileSync(path.join(tmp, "frames", `frame_000${i}.jpg`), ONE_PX_JPEG);
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  function build(spec: unknown): string {
    fs.writeFileSync(path.join(tmp, "scrollcraft.json"), JSON.stringify(spec));
    const r = spawnSync(process.execPath, [BUILD_SITE, "--spec", path.join(tmp, "scrollcraft.json"), "--out", path.join(tmp, "dist")], { encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
    return fs.readFileSync(path.join(tmp, "dist", "index.html"), "utf8");
  }

  it("matches the exporter: one h1, sections and canvas in main, a skip link, nothing outside a landmark", () => {
    const html = build({ name: "Rosa's Bakery", sections: SECTIONS });
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toMatch(/<h1 class="sc-display"[^>]*>Fresh bread, baked before sunrise<\/h1>/);
    expect(html).toMatch(/<h2 class="sc-display sc-statement"[^>]*>Real bread\.<\/h2>/);
    const body = bodyMarkup(html);
    expect(body).toContain('<a class="skip-link" href="#main">Skip to content</a>');
    expect(inside(body, '<main id="main" tabindex="-1">', "</main>", '<div id="scroll-container"')).toBe(true);
    expect(inside(body, "<main", "</main>", '<canvas id="scroll-canvas" role="img"')).toBe(true);
    expect(outsideLandmarks(body)).toEqual([]);
    expect(html).toContain('<html lang="en">');
  });

  it("ships the focus ring, the skip link style and the reduced-motion rules", () => {
    const html = build({ name: "Rosa's Bakery", sections: SECTIONS });
    expect(html).toContain('[tabindex]:not([tabindex="-1"]):focus-visible { outline: 3px solid');
    expect(html).toContain(".skip-link:focus { left: 0; }");
    expect(html).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.section-content \{ transition: none !important; \}\s*#scroll-hint \{ display: none; \}/);
    expect(html).toContain('<div id="scroll-hint" aria-hidden="true">');
  });

  it("holds for the generated example bundles", () => {
    const built = path.resolve(__dirname, "../../public/examples/vantage/index.html");
    if (!fs.existsSync(built)) return;
    const html = fs.readFileSync(built, "utf8");
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(outsideLandmarks(bodyMarkup(html))).toEqual([]);
  });
});

describe("SiteRenderer landmarks", () => {
  async function render(props: Record<string, unknown> = {}): Promise<string> {
    const { default: SiteRenderer } = await import("@/components/SiteRenderer");
    return renderToStaticMarkup(
      createElement(SiteRenderer, { name: "Rosa's Bakery", sections: SECTIONS, styleSpec: { style: "aurora", colors: ["#111111", "#222222", "#333333"] }, ...props } as never)
    );
  }

  it("draws the background canvas inside main, named once", async () => {
    const html = await render();
    expect(inside(html, '<main id="sc-main"', "</main>", "<canvas")).toBe(true);
    expect(html.match(/Animated background for Rosa&#x27;s Bakery/g)).toHaveLength(1);
  });

  it("announces the loading overlay as a status rather than leaving it outside every landmark", async () => {
    const html = await render();
    expect(html).toMatch(/<div role="status" class="fixed inset-0 z-50/);
    expect(html).toContain("motion-reduce:animate-none");
  });

  it("keeps one h1 unless the host page has its own", async () => {
    expect((await render()).match(/<h1[\s>]/g)).toHaveLength(1);
    expect((await render({ hostHasH1: true })).match(/<h1[\s>]/g)).toBeNull();
  });
});
