import { HOME_SLUG, MAX_PAGES, RESERVED_SLUGS, pageSlugFromTitle } from "@/lib/sitePages";

/**
 * The page list the editor edits.
 *
 * Pure functions, because the editor already holds more state than any one person can
 * hold in their head, and because what matters here is the rules: a home page that
 * cannot be removed or renamed out of existence, and addresses that stay unique.
 *
 * Generic over the section type: the editor holds a stricter shape than the exporter, and
 * neither should have to cast to use these.
 */
export type PageList<S> = { slug: string; title: string; sections: S[] }[];

export function uniquePageSlug<S>(pages: PageList<S>, wanted: string, ignoreIndex = -1): string {
  const taken = new Set(pages.filter((_, i) => i !== ignoreIndex).map((p) => p.slug));
  const base = pageSlugFromTitle(wanted);
  if (!taken.has(base) && !RESERVED_SLUGS.includes(base as (typeof RESERVED_SLUGS)[number])) return base;
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export function canAddPage<S>(pages: PageList<S>): boolean {
  return pages.length < MAX_PAGES;
}

export function addPage<S>(pages: PageList<S>, title: string, sections: S[]): PageList<S> {
  if (!canAddPage(pages)) return pages;
  const clean = title.trim() || `Page ${pages.length + 1}`;
  return [...pages, { slug: uniquePageSlug(pages, clean), title: clean.slice(0, 60), sections }];
}

export function renamePage<S>(pages: PageList<S>, index: number, title: string): PageList<S> {
  const clean = title.trim().slice(0, 60);
  if (!clean || !pages[index]) return pages;
  return pages.map((page, i) => {
    if (i !== index) return page;
    // The home page keeps index.html whatever it is called, because every host looks for it.
    const slug = page.slug === HOME_SLUG ? HOME_SLUG : uniquePageSlug(pages, clean, index);
    return { ...page, title: clean, slug };
  });
}

export function removePage<S>(pages: PageList<S>, index: number): PageList<S> {
  // Index 0 is the home page: without it there is no index.html to open.
  if (index <= 0 || index >= pages.length || pages.length === 1) return pages;
  return pages.filter((_, i) => i !== index);
}

/** The page list with the sections currently on screen written back into the open page. */
export function withLiveSections<S>(pages: PageList<S>, openIndex: number, sections: S[]): PageList<S> {
  return pages.map((page, i) => (i === openIndex ? { ...page, sections } : page));
}
