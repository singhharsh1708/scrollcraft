import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import { TEMPLATES, templateCategories, templateScrollHeight, templateSectionCount } from "@/lib/templates";
import TemplatesClient, { type TemplateCard } from "./TemplatesClient";

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
export default function TemplatesPage() {
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

  return <TemplatesClient templates={templates} categories={templateCategories()} />;
}
