import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import { TEMPLATES, templateCategories, templateScrollHeight, templateSectionCount } from "@/lib/templates";
import TemplatesClient, { type TemplateCard } from "./TemplatesClient";
import { filtersFromQuery } from "@/lib/templateFilters";

export const metadata: Metadata = pageMeta({
  title: "Templates",
  description: `${TEMPLATES.length} finished scroll sites across ${templateCategories().length} categories. Open one in the editor, change the words and export it as plain HTML.`,
  path: "/templates",
});

/** Launch pages are among the most asked-for kinds of site, so the one that is leads the gallery. */
const LEAD_SLUG = "kept";

/**
 * Server shell for the gallery.
 *
 * A card shows a name, a tagline, tags, a palette and two numbers. Importing the
 * catalogue from a client component shipped every template's full section copy with it,
 * which is the bulk of the file and none of this page. Reading it here keeps that on the
 * server and sends down only what a card renders.
 */
export default async function TemplatesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ordered = [...TEMPLATES].sort((a, b) => Number(b.slug === LEAD_SLUG) - Number(a.slug === LEAD_SLUG));
  const templates: TemplateCard[] = ordered.map((t) => ({
    slug: t.slug,
    name: t.name,
    tagline: t.tagline,
    category: t.category,
    tags: t.tags,
    style: t.style,
    colors: t.colors,
    gradient: t.gradient,
    sectionCount: templateSectionCount(t),
    scrollHeight: templateScrollHeight(t),
  }));

  // Filters are read here rather than in the browser. Reading them client-side put the
  // whole gallery behind a Suspense boundary, and the served HTML then carried none of
  // the 22 cards: a crawler, and anyone arriving from search, saw an empty page.
  const categories = templateCategories();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") query.set(key, value);
  }
  const { filters, sort } = filtersFromQuery(query, { categories });

  return <TemplatesClient templates={templates} categories={categories} initialFilters={filters} initialSort={sort} />;
}
