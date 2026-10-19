import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createElement, type ComponentType } from "react";
import type { Metadata } from "next";
import { renderToStaticMarkup } from "react-dom/server";
import { GUIDES } from "@/lib/guides";
import sitemap from "@/app/sitemap";
import { siteUrl } from "@/lib/env";

// The navbar reads the router, which a bare render has none of. It carries no h1 (checked below).
vi.mock("@/components/Navbar", () => ({ default: () => null }));

const PAGES: Record<string, () => Promise<{ default: ComponentType; metadata: Metadata }>> = {
  "/scroll-animation": () => import("@/app/scroll-animation/page"),
  "/video-scroll-animation": () => import("@/app/video-scroll-animation/page"),
  "/website-builder-html-export": () => import("@/app/website-builder-html-export/page"),
};

function words(html: string): number {
  const main = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<footer[\s\S]*<\/footer>/, "");
  return main.replace(/<[^>]+>/g, " ").split(/\s+/).filter((w) => /\w/.test(w)).length;
}

describe("guide pages", () => {
  it("has a page module for every guide", () => {
    expect(Object.keys(PAGES).sort()).toEqual(GUIDES.map((g) => g.path).sort());
  });

  it("keeps the navbar free of an h1, so each page's own is the only one", () => {
    expect(readFileSync("src/components/Navbar.tsx", "utf8")).not.toMatch(/<h1/);
    expect(readFileSync("src/components/SiteFooter.tsx", "utf8")).not.toMatch(/<h1/);
  });

  it.each(GUIDES)("$path: title and description fit search results", ({ title, description }) => {
    expect(title.length).toBeGreaterThan(10);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).not.toContain("ScrollCraft");
    expect(description.length).toBeGreaterThanOrEqual(120);
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it("gives every guide its own title and description", () => {
    expect(new Set(GUIDES.map((g) => g.title)).size).toBe(GUIDES.length);
    expect(new Set(GUIDES.map((g) => g.description)).size).toBe(GUIDES.length);
  });

  it.each(GUIDES)("$path: renders on the server with one h1, its metadata and real content", async ({ path, title, description }) => {
    const mod = await PAGES[path]();
    expect(mod.metadata.title).toBe(title);
    expect(mod.metadata.description).toBe(description);
    expect(mod.metadata.alternates?.canonical).toBe(path);

    const html = renderToStaticMarkup(createElement(mod.default));
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(/<h1[^>]*>([^<]*)<\/h1>/.exec(html)![1].replace(/\u2011/g, "-")).toBe(title.replace(/'/g, "&#x27;"));
    const n = words(html);
    expect(n, `${path} has ${n} words`).toBeGreaterThanOrEqual(800);
    expect(n, `${path} has ${n} words`).toBeLessThanOrEqual(1700);

    expect(html).toContain('href="/#write"');
    expect(html).toContain('href="/describe"');
    expect(html).toContain('href="/templates"');
    expect(html).toContain(">Questions</h2>");
    expect(html).not.toContain("—");

    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1]);
    expect(ld).toMatchObject({ "@type": "Article", headline: title, description, url: `${siteUrl}${path}` });
    expect(JSON.stringify(ld)).not.toMatch(/FAQPage|aggregateRating|review/);
  });

  it("lists every guide in the sitemap", () => {
    const urls = sitemap().map((e) => e.url);
    for (const g of GUIDES) expect(urls).toContain(`${siteUrl}${g.path}`);
  });

  it("links every guide from the footer under Guides", async () => {
    const { default: SiteFooter } = await import("@/components/SiteFooter");
    const html = renderToStaticMarkup(createElement(SiteFooter));
    expect(html).toContain(">Guides</h2>");
    for (const g of GUIDES) expect(html).toContain(`href="${g.path}"`);
  });
});
