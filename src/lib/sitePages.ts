import { string, object, array, type infer as zInfer } from "zod";
import { sectionsSchema, type Section } from "@/lib/siteSchema";

/**
 * A site is a list of pages. The first is the home page and becomes index.html; the rest
 * sit beside it as flat files, so every page can reference one frames folder and the
 * links work from a folder on disk as well as from a host.
 */

export const HOME_SLUG = "index";

/** Names the export already writes. A page may not take one, or it would overwrite it. */
export const RESERVED_SLUGS = [
  "404",
  "robots",
  "favicon",
  "og-image",
  "apple-touch-icon",
  "README",
  "netlify",
  "vercel",
  "frames",
  "frames-mobile",
  "audio",
] as const;

export const MAX_PAGES = 20;

const slugSchema = string()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "a page address may use lowercase letters, numbers and hyphens")
  .refine((s) => !RESERVED_SLUGS.includes(s as (typeof RESERVED_SLUGS)[number]), "that address is used by another file in the export");

export const pageSchema = object({
  slug: slugSchema,
  title: string().min(1).max(60),
  sections: sectionsSchema,
}).strip();

export const pagesSchema = array(pageSchema)
  .min(1)
  .max(MAX_PAGES)
  .refine((pages) => new Set(pages.map((p) => p.slug)).size === pages.length, "two pages share one address");

export type SitePage = Omit<zInfer<typeof pageSchema>, "sections"> & { sections: Section[] };

export function pageFileName(slug: string): string {
  return slug === HOME_SLUG ? "index.html" : `${slug}.html`;
}

export function pageSlugFromTitle(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug && !RESERVED_SLUGS.includes(slug as (typeof RESERVED_SLUGS)[number]) ? slug : "page";
}

export function navLinks(pages: SitePage[], currentSlug: string) {
  return pages.map((page) => ({
    href: pageFileName(page.slug),
    label: page.title,
    current: page.slug === currentSlug,
  }));
}

/** A document that predates pages is one home page, so an old save and an old file still open. */
export function asPages(doc: { pages?: SitePage[] | null; sections?: Section[] | null }): SitePage[] {
  if (doc.pages?.length) return doc.pages;
  return [{ slug: HOME_SLUG, title: "Home", sections: doc.sections ?? [] }];
}
