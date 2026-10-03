/**
 * What the gallery filters on.
 *
 * Two axes, because one was not enough to find anything in a catalogue this size: what
 * the site is for, and how its background moves. Counts come with them, since a filter
 * value that would return nothing is worth knowing before it is clicked.
 */

export const ALL = "All";

export const BACKGROUND_LABELS: Record<string, string> = {
  gradient: "Gradient",
  geometric: "Geometric",
  particles: "Particles",
  wave: "Wave",
};

export type FilterableTemplate = {
  name: string;
  tagline: string;
  category: string;
  tags: string[];
  style: string;
};

export type TemplateFilters = { q: string; category: string; background: string };

export const EMPTY_FILTERS: TemplateFilters = { q: "", category: ALL, background: ALL };

export const SORTS = ["Catalogue order", "A to Z"] as const;
export type TemplateSort = (typeof SORTS)[number];

function matchesSearch(t: FilterableTemplate, q: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    t.name.toLowerCase().includes(needle) ||
    t.tagline.toLowerCase().includes(needle) ||
    t.category.toLowerCase().includes(needle) ||
    (BACKGROUND_LABELS[t.style] ?? t.style).toLowerCase().includes(needle) ||
    t.tags.some((tag) => tag.toLowerCase().includes(needle))
  );
}

export function matchesFilters(t: FilterableTemplate, f: TemplateFilters): boolean {
  if (f.category !== ALL && t.category !== f.category) return false;
  if (f.background !== ALL && t.style !== f.background) return false;
  return matchesSearch(t, f.q);
}

export function filterTemplates<T extends FilterableTemplate>(templates: T[], f: TemplateFilters): T[] {
  return templates.filter((t) => matchesFilters(t, f));
}

export function sortTemplates<T extends FilterableTemplate>(templates: T[], sort: TemplateSort): T[] {
  return sort === "A to Z" ? [...templates].sort((a, b) => a.name.localeCompare(b.name)) : templates;
}

/**
 * How many templates each value of one axis would return.
 *
 * Counted with the other axis applied but not this one, so the numbers answer "what
 * happens if I click this" rather than "what is selected now".
 */
function countsFor<T extends FilterableTemplate>(
  templates: T[],
  f: TemplateFilters,
  axis: "category" | "background",
  valueOf: (t: T) => string
): Record<string, number> {
  const others: TemplateFilters = { ...f, [axis]: ALL };
  const counts: Record<string, number> = { [ALL]: 0 };
  for (const t of templates) {
    if (!matchesFilters(t, others)) continue;
    counts[ALL] += 1;
    const value = valueOf(t);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

export function categoryCounts<T extends FilterableTemplate>(templates: T[], f: TemplateFilters) {
  return countsFor(templates, f, "category", (t) => t.category);
}

export function backgroundCounts<T extends FilterableTemplate>(templates: T[], f: TemplateFilters) {
  return countsFor(templates, f, "background", (t) => t.style);
}

export function hasActiveFilters(f: TemplateFilters): boolean {
  return f.q.trim() !== "" || f.category !== ALL || f.background !== ALL;
}

/** The filters as a query string, so a filtered view can be linked and shared. */
export function filtersToQuery(f: TemplateFilters, sort: TemplateSort): string {
  const params = new URLSearchParams();
  if (f.q.trim()) params.set("q", f.q.trim());
  if (f.category !== ALL) params.set("for", f.category);
  if (f.background !== ALL) params.set("background", f.background);
  if (sort !== SORTS[0]) params.set("sort", "az");
  return params.toString();
}

export function filtersFromQuery(
  params: { get(key: string): string | null },
  known: { categories: string[] }
): { filters: TemplateFilters; sort: TemplateSort } {
  const category = params.get("for") ?? "";
  const background = params.get("background") ?? "";
  return {
    filters: {
      q: (params.get("q") ?? "").slice(0, 100),
      category: known.categories.includes(category) ? category : ALL,
      background: background in BACKGROUND_LABELS ? background : ALL,
    },
    sort: params.get("sort") === "az" ? "A to Z" : SORTS[0],
  };
}
