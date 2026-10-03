"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Search, Eye } from "lucide-react";
import Navbar from "@/components/Navbar";
import type { Style2D } from "@/lib/generate2DFrames";
import SiteFooter from "@/components/SiteFooter";
import {
  ALL,
  BACKGROUND_LABELS,
  EMPTY_FILTERS,
  SORTS,
  backgroundCounts,
  categoryCounts,
  filterTemplates,
  filtersFromQuery,
  filtersToQuery,
  hasActiveFilters,
  sortTemplates,
  type TemplateFilters,
  type TemplateSort,
} from "@/lib/templateFilters";

/**
 * What a gallery card renders. Deliberately not `Template`: the full record carries every
 * section's copy for all of them, which is most of the catalogue and none of this page.
 */
export interface TemplateCard {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  tags: string[];
  style: Style2D;
  colors: [string, string, string];
  gradient: string;
  sectionCount: number;
  scrollHeight: number;
}

export default function TemplatesClient({ templates, categories: allCategories }: { templates: TemplateCard[]; categories: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // The URL is the starting state, so a filtered gallery can be linked, bookmarked and
  // sent to somebody else rather than described to them.
  const fromUrl = useMemo(() => filtersFromQuery(params, { categories: allCategories }), [params, allCategories]);
  const [filters, setFilters] = useState<TemplateFilters>(fromUrl.filters);
  const [sort, setSort] = useState<TemplateSort>(fromUrl.sort);

  useEffect(() => {
    const query = filtersToQuery(filters, sort);
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [filters, sort, pathname, router]);

  const categories = useMemo(() => [ALL, ...allCategories], [allCategories]);
  const counts = useMemo(() => categoryCounts(templates, filters), [templates, filters]);
  const backgrounds = useMemo(() => backgroundCounts(templates, filters), [templates, filters]);
  const filtered = useMemo(() => sortTemplates(filterTemplates(templates, filters), sort), [templates, filters, sort]);
  const search = filters.q;
  const setSearch = (q: string) => setFilters((f) => ({ ...f, q }));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      <section className="px-6 pb-12 pt-20 text-center">
        <p className="lc-mono mb-6 text-sm text-primary-ink">{templates.length} templates, all free</p>
        <h1 className="lc-display text-5xl md:text-6xl lg:text-7xl">
          <span className="block">Start from a</span>
          <span className="block text-primary-ink">finished site</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Every template ships with its own palette, typography, pacing and copy structure.
          Open one, change the words, export it.
        </p>
      </section>

      <div className="px-6 pb-8 max-w-7xl mx-auto space-y-4">
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="template-search" className="sr-only">Search templates</label>
          <Input
            id="template-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates"
            className="lc-mono h-11 pl-9 bg-card border-border"
          />
        </div>

        <fieldset className="flex flex-wrap gap-2 justify-center">
          <legend className="lc-mono mb-2 w-full text-center text-xs uppercase tracking-[0.18em] text-muted-foreground">What it is for</legend>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilters((f) => ({ ...f, category: c }))}
              aria-pressed={filters.category === c}
              disabled={(counts[c] ?? 0) === 0 && c !== filters.category}
              className={`lc-mono h-9 px-4 rounded-full text-[0.8rem] border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                filters.category === c
                  ? "border-primary-ink/60 bg-primary-ink/15 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {c} <span className="tabular-nums opacity-80">{counts[c] ?? 0}</span>
            </button>
          ))}
        </fieldset>

        <fieldset className="flex flex-wrap gap-2 justify-center">
          <legend className="lc-mono mb-2 w-full text-center text-xs uppercase tracking-[0.18em] text-muted-foreground">How the background moves</legend>
          {[ALL, ...Object.keys(BACKGROUND_LABELS)].map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setFilters((f) => ({ ...f, background: b }))}
              aria-pressed={filters.background === b}
              disabled={(backgrounds[b] ?? 0) === 0 && b !== filters.background}
              className={`lc-mono h-9 px-4 rounded-full text-[0.8rem] border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                filters.background === b
                  ? "border-primary-ink/60 bg-primary-ink/15 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {b === ALL ? ALL : BACKGROUND_LABELS[b]} <span className="tabular-nums opacity-80">{backgrounds[b] ?? 0}</span>
            </button>
          ))}
        </fieldset>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <p className="lc-mono text-xs text-muted-foreground" aria-live="polite">
            {filtered.length} of {templates.length} templates
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="template-sort" className="lc-mono text-xs text-muted-foreground">Order</label>
            <select
              id="template-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as TemplateSort)}
              className="lc-mono h-9 rounded-md border border-border bg-card px-2 text-xs text-foreground"
            >
              {SORTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {hasActiveFilters(filters) && (
            <Button variant="outline" size="sm" className="lc-mono h-9 border-border text-xs" onClick={() => setFilters(EMPTY_FILTERS)}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <section className="px-6 pb-24 max-w-7xl mx-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-20 border border-border rounded-lg bg-card">
            <p className="font-medium mb-1">No template matches that</p>
            <p className="text-sm text-muted-foreground mb-5">
              Clear the filters, or <Link href="/contact?topic=custom" className="underline underline-offset-4">tell us what you were looking for</Link>.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="border-border"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              Show all templates
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((t) => (
              <article
                key={t.slug}
                className="group rounded-lg border border-border bg-card overflow-hidden flex flex-col focus-within:border-primary-ink/50 hover:border-foreground/25 transition-colors"
              >
                <div className={`relative aspect-[16/10] bg-gradient-to-br ${t.gradient}`}>
                  {/* A still of the template's own first screen. The card used to draw only
                      its background on a paused canvas, which for the dark particle and
                      geometric templates was a black rectangle. */}
                  {/* eslint-disable-next-line @next/next/no-img-element -- captured once by
                      scripts/capture-template-previews.mjs and committed. */}
                  <img
                    src={`/template-previews/${t.slug}.jpg`}
                    alt={`The ${t.name} template, at its opening heading`}
                    width={800}
                    height={500}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                    <span className="lc-mono text-[11px] text-white/80">{t.category}</span>
                  </div>
                </div>

                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div className="space-y-1">
                    <h2 className="text-lg font-medium tracking-[-0.02em]">{t.name}</h2>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t.tagline}</p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {t.tags.map((tag) => (
                      <span key={tag} className="lc-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <p className="lc-mono text-[11px] text-muted-foreground mt-auto">
                    {t.sectionCount} sections ·{" "}
                    {t.scrollHeight.toLocaleString()}px of scroll
                  </p>

                  <div className="flex gap-2">
                    <Link href={`/templates/${t.slug}`} className="flex-1">
                      <Button variant="outline" size="sm" className="lc-mono w-full border-border text-xs h-9 gap-1.5">
                        <Eye className="w-3.5 h-3.5" /> Preview
                      </Button>
                    </Link>
                    <Link href={`/editor?template=${t.slug}`} className="flex-1">
                      <Button size="sm" className="lc-mono w-full text-xs h-9 gap-1.5">
                        Use <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-border px-6 pb-28 pt-24 text-center">
        <h2 className="lc-display text-4xl sm:text-5xl">None of these fit?</h2>
        <p className="mx-auto mb-10 mt-6 max-w-md text-lg text-muted-foreground">
          Start from a blank page with your own style or footage, or ask for a site built for you.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/create" className="lc-btn lc-btn-solid">
            Create from scratch
          </Link>
          <Link href="/contact?topic=custom" className="lc-btn lc-btn-ghost">
            Ask for a custom build
          </Link>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
