import { describe, it, expect } from "vitest";
import {
  HOME_SLUG,
  RESERVED_SLUGS,
  pageFileName,
  pageSlugFromTitle,
  navLinks,
  pagesSchema,
  asPages,
} from "@/lib/sitePages";
import { templateBySlug } from "@/lib/templates";

/**
 * A business site is rarely one page. Buyers judge a template by what sits behind the
 * cards, and ours could only ever produce an index.html, so "Services" and "Contact" had
 * nowhere to go.
 */

const sections = templateBySlug("kept")!.sections;

describe("a site is a list of pages, and the first one is home", () => {
  it("writes the home page as index.html and the rest beside it", () => {
    expect(pageFileName(HOME_SLUG)).toBe("index.html");
    expect(pageFileName("about")).toBe("about.html");
    expect(pageFileName("our-services")).toBe("our-services.html");
  });

  it("turns a title a person typed into a slug that survives a URL", () => {
    expect(pageSlugFromTitle("About us")).toBe("about-us");
    expect(pageSlugFromTitle("  Prices & Plans  ")).toBe("prices-plans");
    expect(pageSlugFromTitle("Café")).toBe("cafe");
    expect(pageSlugFromTitle("***")).toBe("page");
  });

  it("treats a plain list of sections as a single home page, so nothing old breaks", () => {
    const pages = asPages({ sections });
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ slug: HOME_SLUG, title: "Home" });
    expect(pages[0].sections).toHaveLength(sections.length);
  });
});

describe("the links between pages work from a folder as well as a host", () => {
  const pages = [
    { slug: HOME_SLUG, title: "Home", sections },
    { slug: "about", title: "About", sections },
    { slug: "contact", title: "Contact", sections },
  ];

  it("points at files, so opening the folder works without a server", () => {
    // A site is often opened by double-clicking index.html before it is ever hosted.
    expect(navLinks(pages, "about").map((l) => l.href)).toEqual(["index.html", "about.html", "contact.html"]);
  });

  it("marks the page you are on, for a screen reader as much as for the eye", () => {
    const links = navLinks(pages, "about");
    expect(links.map((l) => l.current)).toEqual([false, true, false]);
  });

  it("carries the page's own title as the link text", () => {
    expect(navLinks(pages, HOME_SLUG).map((l) => l.label)).toEqual(["Home", "About", "Contact"]);
  });
});

describe("a page cannot overwrite the rest of the export", () => {
  it("knows the names the export already uses", () => {
    for (const reserved of ["404", "robots", "favicon", "og-image", "README", "netlify", "vercel", "frames", "frames-mobile", "audio"]) {
      expect(RESERVED_SLUGS).toContain(reserved);
    }
  });

  it("refuses a slug that would collide with one of them", () => {
    const parsed = pagesSchema.safeParse([
      { slug: HOME_SLUG, title: "Home", sections },
      { slug: "404", title: "Oops", sections },
    ]);
    expect(parsed.success).toBe(false);
  });

  it("refuses a slug that tries to climb out of the folder", () => {
    for (const slug of ["../secrets", "a/b", "with space", "UPPER", ""]) {
      expect(pagesSchema.safeParse([{ slug, title: "X", sections }]).success, slug).toBe(false);
    }
  });

  it("refuses two pages that would write the same file", () => {
    const parsed = pagesSchema.safeParse([
      { slug: "about", title: "About", sections },
      { slug: "about", title: "About again", sections },
    ]);
    expect(parsed.success).toBe(false);
  });

  it("holds a site to a sane number of pages", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ slug: `page-${i}`, title: `Page ${i}`, sections }));
    expect(pagesSchema.safeParse(many).success).toBe(false);
  });

  it("validates each page's sections the way the renderer will read them", () => {
    const bad = [{ slug: HOME_SLUG, title: "Home", sections: [{ layout: "diagonal", heading: "x" }] }];
    expect(pagesSchema.safeParse(bad).success).toBe(false);
  });
});

describe("a button can point at another page", () => {
  it("accepts a page file, with or without an anchor", () => {
    for (const href of ["contact.html", "our-services.html", "about.html#team"]) {
      expect(pagesSchema.safeParse([{ slug: HOME_SLUG, title: "Home", sections: [{ heading: "x", ctaLabel: "Go", ctaHref: href, scrollHeight: 1000 }] }]).success, href).toBe(true);
    }
  });

  it("still refuses a scheme, a subfolder or a name no page can have", () => {
    // Root and ./ paths were always allowed and the exporter already handles them; what
    // the new rule must not open up is a scheme, a path separator, or a stray filename.
    for (const href of ["javascript:alert(1).html", "a/b.html", "CONTACT.html", "data:text/html,x.html"]) {
      expect(pagesSchema.safeParse([{ slug: HOME_SLUG, title: "Home", sections: [{ heading: "x", ctaLabel: "Go", ctaHref: href, scrollHeight: 1000 }] }]).success, href).toBe(false);
    }
  });
});
