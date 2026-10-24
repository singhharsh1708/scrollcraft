import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { pageMeta } from "@/lib/pageMeta";
import { templateCategories, templateScrollHeight, templateSectionCount } from "@/lib/templates";
import {
  breadcrumbJsonLd,
  categoryBySlug,
  categoryCrumbs,
  categoryInfo,
  categoryMetaTitle,
  categoryPath,
  categoryTitle,
  jsonLdHtml,
  templatesIn,
  templateUse,
} from "@/lib/templateSeo";

export const dynamicParams = false;

export function generateStaticParams() {
  return templateCategories().map((c) => ({ category: categoryInfo(c).slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category: slug } = await params;
  const category = categoryBySlug(slug);
  if (!category) return {};
  return pageMeta({
    title: categoryMetaTitle(category),
    description: categoryInfo(category).description,
    path: categoryPath(category),
  });
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: slug } = await params;
  const category = categoryBySlug(slug);
  if (!category) notFound();

  const info = categoryInfo(category);
  const templates = templatesIn(category);
  const crumbs = categoryCrumbs(category);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd(crumbs)) }} />
      <Navbar />

      <div className="mx-auto max-w-5xl px-4 pt-20 sm:px-6">
        <nav aria-label="Breadcrumb" className="lc-mono mb-8 text-xs text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-x-2 md:gap-y-2">
            <li><Link href="/templates" className="inline-flex items-center max-md:min-h-11 underline-offset-4 hover:text-foreground hover:underline">Templates</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-foreground">{crumbs[2].name}</li>
          </ol>
        </nav>
        <h1 className="lc-display text-4xl sm:text-5xl md:text-6xl">{categoryTitle(category)}</h1>
        <div className="mt-8 max-w-2xl space-y-4 text-lg leading-relaxed text-muted-foreground">
          {info.guidance.map((p) => <p key={p}>{p}</p>)}
        </div>
      </div>

      <section className="mx-auto max-w-5xl px-4 pb-16 pt-14 sm:px-6" aria-labelledby="category-grid">
        <h2 id="category-grid" className="lc-mono mb-5 text-sm text-muted-foreground">
          {templates.length} {templates.length === 1 ? "template" : "templates"}, each free to edit and export
        </h2>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <li key={t.slug} className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-foreground/25">
              <div className={`relative aspect-[16/10] bg-gradient-to-br ${t.gradient}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- committed still, as on the gallery */}
                <img
                  src={`/template-previews/${t.slug}.jpg`}
                  alt={`The ${t.name} template, at its opening heading`}
                  width={800}
                  height={500}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-medium tracking-[-0.02em]">
                    <Link href={`/templates/${t.slug}`} className="inline-flex items-center max-md:min-h-11 underline-offset-4 hover:underline">{t.name}</Link>
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">{templateUse(t).forWhom}</p>
                </div>
                <p className="lc-mono mt-auto text-xs text-muted-foreground">
                  {templateSectionCount(t)} sections · {templateScrollHeight(t).toLocaleString("en-US")}px of scroll
                </p>
                <div className="flex gap-2">
                  <Link href={`/templates/${t.slug}`} aria-label={`Preview ${t.name}`} className="lc-btn lc-btn-ghost lc-btn-sm max-md:h-11 flex-1">Preview</Link>
                  <Link href={`/editor?template=${t.slug}`} aria-label={`Use ${t.name}`} className="lc-btn lc-btn-solid lc-btn-sm max-md:h-11 flex-1">Use</Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-border px-4 pb-24 pt-16 text-center sm:px-6">
        <h2 className="lc-display text-3xl sm:text-4xl">Want one written for your business?</h2>
        <p className="mx-auto mt-5 max-w-md text-muted-foreground">
          Describe what you do in a paragraph and get a scroll site back with your own copy. The first two are free.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/describe" className="lc-btn lc-btn-solid">Describe your business</Link>
          <Link href="/templates" className="lc-btn lc-btn-ghost">All templates</Link>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
