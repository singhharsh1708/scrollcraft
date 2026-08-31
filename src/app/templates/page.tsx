import { TEMPLATES, templateCategories, templateScrollHeight, templateSectionCount } from "@/lib/templates";
import TemplatesClient, { type TemplateCard } from "./TemplatesClient";

/**
 * Server shell for the gallery.
 *
 * A card shows a name, a tagline, tags, a palette and two numbers. Importing the
 * catalogue from a client component shipped every template's full section copy with it,
 * which is the bulk of the file and none of this page. Reading it here keeps that on the
 * server and sends down only what a card renders.
 */
export default function TemplatesPage() {
  const templates: TemplateCard[] = TEMPLATES.map((t) => ({
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
