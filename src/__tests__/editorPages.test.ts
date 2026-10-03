import { describe, it, expect } from "vitest";
import { addPage, removePage, renamePage, uniquePageSlug, canAddPage, withLiveSections } from "@/lib/editorPages";
import { HOME_SLUG, MAX_PAGES, pagesSchema } from "@/lib/sitePages";
import type { Section } from "@/lib/siteSchema";

const section = (heading: string): Section => ({ id: `s-${heading}`, heading, scrollHeight: 1000 });
const home = { slug: HOME_SLUG, title: "Home", sections: [section("Welcome")] };

describe("adding pages", () => {
  it("names a new page's address after its title", () => {
    const pages = addPage([home], "About us", [section("About")]);
    expect(pages[1]).toMatchObject({ slug: "about-us", title: "About us" });
  });

  it("will not let two pages take one address", () => {
    const pages = addPage(addPage([home], "About", [section("A")]), "About", [section("B")]);
    expect(pages.map((p) => p.slug)).toEqual([HOME_SLUG, "about", "about-2"]);
  });

  it("steps around an address the export already uses", () => {
    expect(uniquePageSlug([home], "404")).not.toBe("404");
    expect(uniquePageSlug([home], "Frames")).not.toBe("frames");
  });

  it("stops at a sane number of pages rather than growing forever", () => {
    let pages = [home];
    for (let i = 0; i < MAX_PAGES + 5; i++) pages = addPage(pages, `Page ${i}`, [section(`${i}`)]);
    expect(pages).toHaveLength(MAX_PAGES);
    expect(canAddPage(pages)).toBe(false);
  });

  it("produces a list the exporter will accept", () => {
    const pages = addPage(addPage([home], "Our services", [section("S")]), "Contact", [section("C")]);
    expect(pagesSchema.safeParse(pages).success).toBe(true);
  });
});

describe("renaming pages", () => {
  it("moves the address with the title", () => {
    const pages = renamePage(addPage([home], "About", [section("A")]), 1, "Our story");
    expect(pages[1]).toMatchObject({ title: "Our story", slug: "our-story" });
  });

  it("keeps the home page at index.html whatever it is called", () => {
    // Every host looks for index.html, so the home page's address is not the owner's to change.
    const pages = renamePage([home], 0, "Start here");
    expect(pages[0]).toMatchObject({ title: "Start here", slug: HOME_SLUG });
  });

  it("ignores an empty name rather than leaving a nameless tab", () => {
    const pages = renamePage([home], 0, "   ");
    expect(pages[0].title).toBe("Home");
  });

  it("does not collide with a sibling when renamed onto its name", () => {
    const pages = addPage(addPage([home], "About", [section("A")]), "Contact", [section("C")]);
    expect(renamePage(pages, 2, "About")[2].slug).toBe("about-2");
  });
});

describe("removing pages", () => {
  it("removes the page asked for", () => {
    const pages = addPage(addPage([home], "About", [section("A")]), "Contact", [section("C")]);
    expect(removePage(pages, 1).map((p) => p.title)).toEqual(["Home", "Contact"]);
  });

  it("refuses to remove the home page, so there is always an index.html", () => {
    const pages = addPage([home], "About", [section("A")]);
    expect(removePage(pages, 0)).toEqual(pages);
  });
});

describe("the page being edited", () => {
  it("writes what is on screen back into the open page, and leaves the others alone", () => {
    const pages = addPage([home], "About", [section("Old about")]);
    const edited = withLiveSections(pages, 1, [section("New about")]);
    expect(edited[1].sections[0].heading).toBe("New about");
    expect(edited[0].sections[0].heading).toBe("Welcome");
  });
});
