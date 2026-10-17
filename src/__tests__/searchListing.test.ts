import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import Home from "@/app/page";
import { siteUrl } from "@/lib/env";
import { AUTHOR_NAME, AUTHOR_SITE_URL, GITHUB_REPO_URL } from "@/lib/links";

type ScriptProps = { type?: string; dangerouslySetInnerHTML?: { __html: string } };

function scripts(node: ReactNode): ReactElement<ScriptProps>[] {
  if (Array.isArray(node)) return node.flatMap(scripts);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  const own = node.type === "script" ? [node as ReactElement<ScriptProps>] : [];
  return [...own, ...scripts(node.props.children)];
}

describe("the home page describes the site to search engines", () => {
  const blocks = scripts(Home()).filter((s) => s.props.type === "application/ld+json");
  const html = blocks[0]?.props.dangerouslySetInnerHTML?.__html ?? "";
  const data = JSON.parse(html || "{}");
  const node = (type: string) => data["@graph"]?.find((n: { "@type": string }) => n["@type"] === type);

  it("renders one JSON-LD block with the site, its owner and the app", () => {
    expect(blocks).toHaveLength(1);
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@graph"].map((n: { "@type": string }) => n["@type"])).toEqual(["WebSite", "Organization", "WebApplication"]);
  });

  it("escapes < as the Next guide does", () => {
    expect(html).not.toContain("<");
    expect(readFileSync("src/app/page.tsx", "utf8")).toContain('.replace(/</g, "\\\\u003c")');
  });

  it("takes every address from configuration, so a fork names itself", () => {
    expect(node("WebSite")).toMatchObject({ name: "ScrollCraft", alternateName: new URL(siteUrl).host, url: siteUrl });
    expect(node("Organization")).toMatchObject({
      url: siteUrl,
      logo: `${siteUrl}/icon-512.png`,
      sameAs: [GITHUB_REPO_URL],
      founder: { "@type": "Person", name: AUTHOR_NAME, url: AUTHOR_SITE_URL },
    });
    expect(existsSync("public/icon-512.png")).toBe(true);
  });

  it("offers only what is free, and claims no ratings or reviews", () => {
    expect(node("WebApplication")).toMatchObject({
      applicationCategory: "DesignApplication",
      operatingSystem: "Any",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    });
    expect(html).not.toMatch(/aggregateRating|"review"|FAQPage/);
  });
});

describe("each page's title says what it is", () => {
  function pageMetaTitles(dir: string): [string, string][] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry): [string, string][] => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return pageMetaTitles(full);
      if (!/\.tsx?$/.test(entry.name)) return [];
      const m = /pageMeta\(\{\s*title: ["`]([^"`]+)["`]/.exec(readFileSync(full, "utf8"));
      return m ? [[full, m[1]]] : [];
    });
  }

  it("leaves the brand to the title template, which already adds it", () => {
    const titles = pageMetaTitles("src/app");
    expect(titles.length).toBeGreaterThan(5);
    for (const [file, title] of titles) expect(title, file).not.toContain("ScrollCraft");
  });
});

describe("the gallery links each template by its name", () => {
  const CLIENT = readFileSync("src/app/templates/TemplatesClient.tsx", "utf8");

  it("makes the card's name the link to its preview", () => {
    expect(CLIENT).toMatch(/<h2[^>]*>\s*<Link href=\{`\/templates\/\$\{t\.slug\}`\}[^>]*>\s*\{t\.name\}\s*<\/Link>\s*<\/h2>/);
    expect(CLIENT).toContain("aria-label={`Preview ${t.name}`}");
  });

  it("offers a written site to someone no template fits", () => {
    const end = CLIENT.slice(CLIENT.indexOf("None of these fit?"));
    expect(end).toContain('href="/describe"');
  });
});
