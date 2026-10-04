import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";

import { HOME_SLUG } from "@/lib/sitePages";
import { templateBySlug } from "@/lib/templates";
import { readFileSync } from "node:fs";

const rateLimitMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));

type Handler = typeof import("../app/api/export-site/route").POST;
let POST: Handler;

beforeEach(async () => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ allowed: true });
  ({ POST } = await import("../app/api/export-site/route"));
});

const kept = templateBySlug("kept")!;
const aura = templateBySlug("aurabeauty")!;

async function exportSite(body: Record<string, unknown>) {
  const res = await POST(
    new Request("https://scrollcraft.space/api/export-site", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ siteName: "Kept", frameCount: 10, fps: 24, ...body }),
    }) as unknown as NextRequest
  );
  return { status: res.status, body: await res.json() };
}

const threePages = [
  { slug: HOME_SLUG, title: "Home", sections: kept.sections },
  { slug: "about", title: "About", sections: aura.sections },
  { slug: "contact", title: "Contact", sections: kept.sections },
];

/**
 * Every template people buy has real pages behind the cards, and ours could only write
 * an index.html, so "Services" and "Contact" had nowhere to go.
 */

describe("a site can be more than one page", () => {
  it("writes a file per page, home first and named index.html", async () => {
    const { status, body } = await exportSite({ pages: threePages });
    expect(status).toBe(200);
    expect(body.pages.map((p: { path: string }) => p.path)).toEqual(["index.html", "about.html", "contact.html"]);
  });

  it("gives every page the same nav, marking the one you are on", async () => {
    const { body } = await exportSite({ pages: threePages });
    for (const page of body.pages) {
      expect(page.html).toContain('<nav id="site-nav" aria-label="Pages">');
      for (const href of ["index.html", "about.html", "contact.html"]) {
        expect(page.html).toContain(`href="${href}"`);
      }
      const nav = /<nav id="site-nav"[\s\S]*?<\/nav>/.exec(page.html)![0];
      expect(nav.match(/aria-current="page"/g)).toHaveLength(1);
    }
    expect(body.pages[1].html).toContain('<a href="about.html" aria-current="page">About</a>');
  });

  it("links to files, so the folder works before it is ever hosted", async () => {
    // Double-clicking index.html is how most people check an export first.
    const { body } = await exportSite({ pages: threePages });
    const written = new Set(body.pages.map((p: { path: string }) => p.path));
    const hrefs = [...String(body.pages[0].html).matchAll(/<nav id="site-nav"[\s\S]*?<\/nav>/g)]
      .flatMap((m) => [...m[0].matchAll(/href="([^"]+)"/g)].map((h) => h[1]));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href).not.toMatch(/^(https?:|\/)/);
      expect(written.has(href), `${href} is linked but never written`).toBe(true);
    }
  });

  it("titles each page for the tab and the share card", async () => {
    const { body } = await exportSite({ pages: threePages });
    expect(body.pages[1].html).toContain("<title>About</title>");
    expect(body.pages[1].html).toContain('<meta property="og:title" content="About" />');
  });

  it("gives each page its own sections, not the home page's", async () => {
    const { body } = await exportSite({ pages: threePages });
    expect(body.pages[1].html).toContain(aura.sections[0].heading!);
    expect(body.pages[1].html).not.toContain(kept.sections[0].heading!);
  });

  it("points every page at the one frames folder rather than a copy each", async () => {
    const { body } = await exportSite({ pages: threePages, frameCount: 10 });
    for (const page of body.pages) {
      expect(page.html).not.toMatch(/about\/frames|contact\/frames/);
    }
  });
});

describe("a one page site is exactly what it was", () => {
  it("writes no nav when there is nothing to navigate to", async () => {
    const { body } = await exportSite({ sections: kept.sections });
    expect(body.html).not.toContain("site-nav");
    expect(body.pages.map((p: { path: string }) => p.path)).toEqual(["index.html"]);
  });

  it("still answers with html for a client that has not been updated", async () => {
    const { body } = await exportSite({ sections: kept.sections });
    expect(body.html).toContain("<!DOCTYPE html>");
    expect(body.html).toBe(body.pages[0].html);
  });

  it("builds the same page whether it arrives as sections or as one page", async () => {
    const asSections = await exportSite({ sections: kept.sections });
    const asPage = await exportSite({ pages: [{ slug: HOME_SLUG, title: "Kept", sections: kept.sections }] });
    // The title is the one difference: a page carries its own.
    const strip = (html: string) => html.replace(/<title>[^<]*<\/title>/, "").replace(/og:title" content="[^"]*"/, "");
    expect(strip(asPage.body.pages[0].html)).toBe(strip(asSections.body.pages[0].html));
  });
});

describe("a page cannot break the export it sits in", () => {
  it("refuses a page whose address would overwrite another file", async () => {
    const { status, body } = await exportSite({
      pages: [{ slug: HOME_SLUG, title: "Home", sections: kept.sections }, { slug: "404", title: "Oops", sections: kept.sections }],
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/pages/);
  });

  it("refuses a page that tries to write outside the folder", async () => {
    const { status } = await exportSite({
      pages: [{ slug: HOME_SLUG, title: "Home", sections: kept.sections }, { slug: "../evil", title: "X", sections: kept.sections }],
    });
    expect(status).toBe(400);
  });

  it("insists the first page is the home page, so index.html always exists", async () => {
    const { status, body } = await exportSite({
      pages: [{ slug: "about", title: "About", sections: kept.sections }],
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/home page/i);
  });

  it("names the page that has nothing to show, rather than failing the whole export blindly", async () => {
    const { status, body } = await exportSite({
      pages: [
        { slug: HOME_SLUG, title: "Home", sections: kept.sections },
        { slug: "about", title: "About", sections: [{ heading: "Hidden", visible: false, scrollHeight: 1000 }] },
      ],
    });
    expect(status).toBe(400);
    expect(body.error).toContain("About");
  });

  it("escapes a page title rather than letting it into the markup", async () => {
    const { body } = await exportSite({
      pages: [
        { slug: HOME_SLUG, title: "Home", sections: kept.sections },
        { slug: "about", title: '<img src=x onerror=alert(1)>', sections: kept.sections },
      ],
    });
    expect(body.pages[0].html).not.toContain("<img src=x onerror");
    expect(body.pages[0].html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});

describe("a button that points at another page actually goes there", () => {
  it("keeps the link instead of rewriting it to nothing", async () => {
    // Measured in a browser before this: the schema accepted contact.html and the
    // exporter rewrote it to "#", so the one button on the page did nothing.
    const { body } = await exportSite({
      pages: [
        { slug: HOME_SLUG, title: "Home", sections: [{ heading: "Home", ctaLabel: "Book a visit", ctaHref: "contact.html", scrollHeight: 1000 }] },
        { slug: "contact", title: "Contact", sections: kept.sections },
      ],
    });
    expect(body.pages[0].html).toContain('href="contact.html"');
    expect(body.pages[0].html).not.toMatch(/href="#"[^>]*>Book a visit/);
  });

  it("is judged by one rule, not three copies of it", () => {
    // The schema, the exporter and the editor preview each had their own allowlist.
    for (const file of ["src/app/api/export-site/route.ts", "src/components/SiteRenderer.tsx"]) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} carries its own href allowlist`).not.toMatch(/mailto:\|tel:/);
      expect(source).toContain("isAllowedHref");
    }
  });
});

describe("the browser tab says what the site is called", () => {
  it("titles a one page export with the site name, not with the word Home", async () => {
    // Shipped broken in #426: every single page export since then said "Home" in the tab
    // and in its share card, because the page list calls its first entry that.
    const { body } = await exportSite({ sections: kept.sections, siteName: "Riverbank Books" });
    expect(body.html).toContain("<title>Riverbank Books</title>");
    expect(body.html).toContain('<meta property="og:title" content="Riverbank Books" />');
  });

  it("titles a one page site sent the way the editor sends it", async () => {
    // The editor posts a page list, and its lone page is called Home. Fixing only the
    // sections path left every export made in the editor saying Home in the tab.
    const { body } = await exportSite({
      pages: [{ slug: HOME_SLUG, title: "Home", sections: kept.sections }],
      siteName: "Riverbank Books",
    });
    expect(body.html).toContain("<title>Riverbank Books</title>");
  });

  it("still titles each page of a real site with its own name", async () => {
    const { body } = await exportSite({ pages: threePages, siteName: "Northgate" });
    expect(body.pages[0].html).toContain("<title>Home</title>");
    expect(body.pages[2].html).toContain("<title>Contact</title>");
  });
});

describe("a catalogue template can be exported by name", () => {
  it("fills in the sections, theme, style, name and description from the catalogue", async () => {
    const { status, body } = await exportSite({ template: "weft", siteName: undefined, sections: undefined });
    expect(status).toBe(200);
    const weft = templateBySlug("weft")!;
    expect(body.html).toContain(weft.sections[0].heading!);
    expect(body.html).toContain(`<title>${weft.name}</title>`);
    expect(body.html).toContain(weft.theme.fontDisplay!.replace(" ", "+"));
    expect(body.siteName).toBe(weft.name);
  });

  it("lets what is sent win over what the catalogue holds", async () => {
    const { body } = await exportSite({ template: "weft", siteName: "My studio" });
    expect(body.html).toContain("<title>My studio</title>");
  });

  it("names a template it does not have, rather than exporting something else", async () => {
    const { status, body } = await exportSite({ template: "not-a-template" });
    expect(status).toBe(400);
    expect(body.error).toMatch(/no template called not-a-template/);
  });
});

describe("the gate that measures an export", () => {
  const SCRIPT = readFileSync("scripts/check-export.mjs", "utf8");

  it("fails under the scores we already ship", () => {
    expect(SCRIPT).toContain('opt("performance", 95)');
    expect(SCRIPT).toContain('opt("accessibility", 100)');
    expect(SCRIPT).toMatch(/process\.exit\(1\)/);
  });

  it("serves the export as a folder, which is how it is hosted", () => {
    expect(SCRIPT).toContain("createServer");
    expect(SCRIPT).toContain("index.html");
  });

  it("does not block its own server while Lighthouse runs", () => {
    // spawnSync blocks the event loop, so the server answers nothing and Chrome dies
    // with "Target closed" against a server that is listening and deaf.
    expect(SCRIPT, "spawnSync would deafen the server").not.toMatch(/spawnSync\s*\(/);
    expect(SCRIPT).toContain('import { spawn }');
  });

  it("is a command rather than a thing to remember", () => {
    expect(readFileSync("package.json", "utf8")).toContain('"check:export"');
    expect(readFileSync("docs/DEPLOY.md", "utf8")).toContain("npm run check:export");
  });
});

describe("the exported page is legible on a light palette too", () => {
  it("does not dim the muted colour a second time", async () => {
    // --sc-muted already carries its own alpha. The footer's legal line dimmed it again
    // with opacity: 0.75, which compounded to 54% and measured 3.73:1 on Pare's light
    // ground. The export gate refused it at accessibility 95.
    const route = readFileSync("src/app/api/export-site/route.ts", "utf8");
    const footer = route.slice(route.indexOf(".footer-legal"), route.indexOf(".footer-legal") + 200);
    expect(footer).not.toMatch(/opacity:\s*0\.\d+/);
  });

  it("paints a light palette's own ground, whenever one ships", async () => {
    // No light template is in the catalogue today, so this exercises the path directly.
    const { body } = await exportSite({
      sections: [{ heading: "On a pale page", scrollHeight: 1000 }],
      siteName: "Pale",
      styleJson: JSON.stringify({ style: "geometric", colors: ["#1b3a8f", "#8a5a2b", "#eff2f6"] }),
      themeJson: JSON.stringify({ ink: "#111823", ground: "#eff2f6" }),
    });
    expect(body.html).toContain("#eff2f6");
  });
});
