import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  PROJECT_FORMAT,
  PROJECT_VERSION,
  buildProjectFile,
  parseProjectFile,
  projectFileName,
  backgroundTravels,
  projectPages,
  type ProjectDocument,
} from "@/lib/projectFile";
import { templateBySlug } from "@/lib/templates";

/**
 * Work made here lived in one browser's IndexedDB and nowhere else, so clearing browsing
 * data, switching laptop or handing a site to someone else all lost it. These pin the one
 * file that carries a site off the machine it was made on.
 */

const kept = templateBySlug("kept")!;

const doc: ProjectDocument = {
  name: "Kept",
  description: "A launch page",
  sections: kept.sections,
  themeJson: JSON.stringify(kept.theme),
  styleJson: JSON.stringify({ style: kept.style, colors: kept.colors }),
  customHead: "",
  customCss: "body { letter-spacing: 0 }",
  fps: 24,
  framesFromRecipe: true,
};

describe("a site survives the browser it was made in", () => {
  it("comes back out of the file the way it went in", () => {
    const parsed = parseProjectFile(buildProjectFile(doc));
    expect(parsed.ok, parsed.ok ? "" : parsed.error).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.document).toMatchObject({
      name: "Kept",
      description: "A launch page",
      themeJson: doc.themeJson,
      styleJson: doc.styleJson,
      customCss: "body { letter-spacing: 0 }",
      fps: 24,
      framesFromRecipe: true,
    });
    expect(parsed.value.document.sections).toHaveLength(kept.sections.length);
    expect(parsed.value.document.sections[0].heading).toBe(kept.sections[0].heading);
    expect(parsed.value.document.sections.at(-1)?.ctaLabel).toBe(kept.sections.at(-1)?.ctaLabel);
  });

  it("stamps the format and version so a later reader knows what it holds", () => {
    const file = JSON.parse(buildProjectFile(doc));
    expect(file.format).toBe(PROJECT_FORMAT);
    expect(file.version).toBe(PROJECT_VERSION);
    expect(Date.parse(file.exportedAt)).not.toBeNaN();
  });

  it("names the file after the site, so a folder of them can be told apart", () => {
    expect(projectFileName("Kept")).toBe("kept.scrollcraft.json");
    expect(projectFileName("Harsh's Café & Co")).toBe("harsh-s-cafe-co.scrollcraft.json");
    expect(projectFileName("   ")).toBe("site.scrollcraft.json");
    expect(projectFileName("x".repeat(200)).length).toBeLessThanOrEqual(80);
  });
});

describe("a file that is not ours, or not sound, is refused in words a person can act on", () => {
  it("refuses something that is not JSON at all", () => {
    const parsed = parseProjectFile("not json {");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(/not a ScrollCraft project file/i);
  });

  it("refuses JSON that is some other tool's file", () => {
    const parsed = parseProjectFile(JSON.stringify({ version: 1, pages: [] }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(/not a ScrollCraft project file/i);
  });

  it("says so plainly when the file was written by a newer version", () => {
    const file = JSON.parse(buildProjectFile(doc));
    file.version = PROJECT_VERSION + 1;
    const parsed = parseProjectFile(JSON.stringify(file));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(/newer version/i);
  });

  it("refuses a file whose sections would not survive the renderer", () => {
    const file = JSON.parse(buildProjectFile(doc));
    file.document.sections[1].layout = "diagonal";
    const parsed = parseProjectFile(JSON.stringify(file));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(/section/i);
  });

  it("drops anything the editor did not put there", () => {
    const file = JSON.parse(buildProjectFile(doc));
    file.document.onOpen = "alert(1)";
    file.document.sections[0].script = "alert(1)";
    const parsed = parseProjectFile(JSON.stringify(file));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.document).not.toHaveProperty("onOpen");
    expect(parsed.value.document.sections[0]).not.toHaveProperty("script");
  });

  it("refuses a file too large to be a document rather than reading it in", () => {
    const parsed = parseProjectFile(`{"format":"${PROJECT_FORMAT}","version":1,"document":{"customCss":"${"a".repeat(6_000_000)}"}}`);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(/too large/i);
  });
});

describe("the editor offers it, and stops promising safety it cannot give", () => {
  const EDITOR = readFileSync("src/app/editor/page.tsx", "utf8");

  it("puts both controls in the toolbar, labelled for someone who is not a developer", () => {
    expect(EDITOR).toContain("handleDownloadProject");
    expect(EDITOR).toContain("handleOpenProject");
    expect(EDITOR).toContain('aria-label="Download a copy you can move to another computer"');
    expect(EDITOR).toContain('aria-label="Open a copy from your computer"');
  });

  it("tells people where Save actually puts their work", () => {
    // "Saved in this browser" read as reassurance, and the work was one cleared cache from gone.
    expect(EDITOR).toContain("Saved in this browser only. Download a copy to keep it anywhere else.");
  });
});

describe("it says what will not travel", () => {
  it("knows a drawn background comes back anywhere", () => {
    expect(backgroundTravels(doc)).toBe(true);
  });

  it("knows a background made from someone's own video does not", () => {
    // Those frames are pixels in this browser, not a recipe, and far too large for a file
    // meant to be mailed around. The editor has to say so rather than lose it silently.
    expect(backgroundTravels({ ...doc, framesFromRecipe: false })).toBe(false);
    expect(backgroundTravels({ ...doc, styleJson: null })).toBe(false);
  });
});

describe("a file carries every page of a site", () => {
  const twoPages = {
    ...doc,
    pages: [
      { slug: "index", title: "Home", sections: kept.sections },
      { slug: "contact", title: "Contact", sections: kept.sections.slice(0, 3) },
    ],
  };

  it("round trips the pages, not only the open one", () => {
    const parsed = parseProjectFile(buildProjectFile(twoPages));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(projectPages(parsed.value.document).map((p) => p.slug)).toEqual(["index", "contact"]);
    expect(projectPages(parsed.value.document)[1].sections).toHaveLength(3);
  });

  it("reads a file written before pages existed as a single home page", () => {
    const v1 = JSON.parse(buildProjectFile(doc));
    v1.version = 1;
    delete v1.document.pages;
    const parsed = parseProjectFile(JSON.stringify(v1));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const pages = projectPages(parsed.value.document);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ slug: "index", title: "Home" });
    expect(pages[0].sections).toHaveLength(kept.sections.length);
  });

  it("refuses a page list the exporter would reject", () => {
    const bad = JSON.parse(buildProjectFile(twoPages));
    bad.document.pages[1].slug = "404";
    expect(parseProjectFile(JSON.stringify(bad)).ok).toBe(false);
  });
});
