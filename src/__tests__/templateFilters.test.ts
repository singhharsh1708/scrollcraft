import { describe, it, expect } from "vitest";
import {
  ALL,
  EMPTY_FILTERS,
  filterTemplates,
  sortTemplates,
  categoryCounts,
  backgroundCounts,
  filtersToQuery,
  filtersFromQuery,
  hasActiveFilters,
  type TemplateFilters,
} from "@/lib/templateFilters";
import { TEMPLATES, templateCategories } from "@/lib/templates";

/**
 * The gallery had one filter and a search box. Every listing people actually buy from
 * carries two axes and a count beside each value, because a filter that would return
 * nothing is worth knowing about before it is clicked.
 */

const all = TEMPLATES.map((t) => ({ name: t.name, tagline: t.tagline, category: t.category, tags: t.tags, style: t.style }));
const categories = templateCategories();

describe("finding a template in a catalogue of 22", () => {
  it("filters by what the site is for", () => {
    const launch = filterTemplates(all, { ...EMPTY_FILTERS, category: "Launch" });
    expect(launch.length).toBeGreaterThan(0);
    expect(launch.every((t) => t.category === "Launch")).toBe(true);
  });

  it("filters by how the background moves", () => {
    const waves = filterTemplates(all, { ...EMPTY_FILTERS, background: "wave" });
    expect(waves.length).toBeGreaterThan(0);
    expect(waves.every((t) => t.style === "wave")).toBe(true);
  });

  it("narrows on both axes at once", () => {
    const f: TemplateFilters = { q: "", category: "SaaS", background: "gradient" };
    expect(filterTemplates(all, f).every((t) => t.category === "SaaS" && t.style === "gradient")).toBe(true);
  });

  it("searches names, taglines, categories, tags and the background's name", () => {
    expect(filterTemplates(all, { ...EMPTY_FILTERS, q: "kept" }).map((t) => t.name)).toContain("Kept");
    expect(filterTemplates(all, { ...EMPTY_FILTERS, q: "waitlist" }).length).toBeGreaterThan(0);
    expect(filterTemplates(all, { ...EMPTY_FILTERS, q: "particles" }).every((t) => t.style === "particles")).toBe(true);
  });

  it("returns everything when nothing is asked of it", () => {
    expect(filterTemplates(all, EMPTY_FILTERS)).toHaveLength(all.length);
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, category: "Launch" })).toBe(true);
  });

  it("sorts by name when asked, and keeps the catalogue's own order otherwise", () => {
    expect(sortTemplates(all, "Catalogue order").map((t) => t.name)).toEqual(all.map((t) => t.name));
    const az = sortTemplates(all, "A to Z").map((t) => t.name);
    expect(az).toEqual([...az].sort((a, b) => a.localeCompare(b)));
  });
});

describe("the count beside each filter answers what happens if you click it", () => {
  it("counts every template when nothing else is filtered", () => {
    const counts = categoryCounts(all, EMPTY_FILTERS);
    expect(counts[ALL]).toBe(all.length);
    for (const category of categories) {
      expect(counts[category] ?? 0).toBe(all.filter((t) => t.category === category).length);
    }
  });

  it("counts one axis with the other applied, not with itself applied", () => {
    // Choosing Launch must not reduce the Launch count to Launch-only, or the number
    // stops meaning "what you would get".
    const f: TemplateFilters = { ...EMPTY_FILTERS, category: "Launch" };
    const counts = categoryCounts(all, f);
    expect(counts[ALL]).toBe(all.length);
    expect(counts.Launch).toBe(all.filter((t) => t.category === "Launch").length);
  });

  it("shows a background count that reflects the chosen category", () => {
    const f: TemplateFilters = { ...EMPTY_FILTERS, category: "SaaS" };
    const counts = backgroundCounts(all, f);
    const saas = all.filter((t) => t.category === "SaaS");
    expect(counts[ALL]).toBe(saas.length);
    for (const style of ["gradient", "geometric", "particles", "wave"]) {
      expect(counts[style] ?? 0).toBe(saas.filter((t) => t.style === style).length);
    }
  });

  it("every count matches what the filter actually returns", () => {
    for (const category of categories) {
      const f: TemplateFilters = { ...EMPTY_FILTERS, category };
      expect(filterTemplates(all, f)).toHaveLength(categoryCounts(all, EMPTY_FILTERS)[category]);
    }
  });
});

describe("a filtered view is a link someone can send", () => {
  it("puts the filters in the query string, and leaves out the defaults", () => {
    expect(filtersToQuery(EMPTY_FILTERS, "Catalogue order")).toBe("");
    expect(filtersToQuery({ q: "cafe", category: "Launch", background: "wave" }, "A to Z"))
      .toBe("q=cafe&for=Launch&background=wave&sort=az");
  });

  it("reads them back", () => {
    const query = filtersToQuery({ q: "clinic", category: "Launch", background: "wave" }, "A to Z");
    const read = filtersFromQuery(new URLSearchParams(query), { categories });
    expect(read.filters).toEqual({ q: "clinic", category: "Launch", background: "wave" });
    expect(read.sort).toBe("A to Z");
  });

  it("ignores a category or background that does not exist, rather than showing nothing", () => {
    const read = filtersFromQuery(new URLSearchParams("for=Nonsense&background=plaid"), { categories });
    expect(read.filters.category).toBe(ALL);
    expect(read.filters.background).toBe(ALL);
  });

  it("caps a search term from the URL", () => {
    const read = filtersFromQuery(new URLSearchParams(`q=${"a".repeat(500)}`), { categories });
    expect(read.filters.q.length).toBeLessThanOrEqual(100);
  });
});
