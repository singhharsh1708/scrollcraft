import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import { templateScrollHeight, templateSectionCount, type Template } from "@/lib/templates";
import {
  backgroundLabel,
  breadcrumbJsonLd,
  categoryPath,
  jsonLdHtml,
  relatedTemplates,
  templateCrumbs,
  templateHeading,
  templateJsonLd,
  templateOutline,
  templateUse,
} from "@/lib/templateSeo";

export default function TemplateDetails({ template: t }: { template: Template }) {
  const crumbs = templateCrumbs(t);
  const outline = templateOutline(t);
  const related = relatedTemplates(t);
  const swatches = [...new Set([...t.colors, t.theme.accent, t.theme.ink].filter((c): c is string => Boolean(c)))];
  const fonts = [t.theme.fontDisplay, t.theme.fontBody].filter(Boolean);

  return (
    <div className="relative z-10 bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd(crumbs)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(templateJsonLd(t)) }} />

      <section id="about" aria-labelledby="about-template" className="mx-auto max-w-5xl border-t border-border px-4 pb-20 pt-16 sm:px-6">
        <nav aria-label="Breadcrumb" className="lc-mono mb-8 text-xs text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-x-2 md:gap-y-1">
            {crumbs.slice(1).map((c, i, all) => (
              <li key={c.path} className="flex items-center gap-2">
                {i < all.length - 1 ? (
                  <>
                    <Link href={c.path} className="inline-flex items-center max-md:min-h-11 underline-offset-4 hover:text-foreground hover:underline">{c.name}</Link>
                    <span aria-hidden="true">/</span>
                  </>
                ) : (
                  <span aria-current="page" className="text-foreground">{c.name}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <h1 id="about-template" className="lc-display text-4xl sm:text-5xl">{templateHeading(t)}</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          {t.tagline}. {templateSectionCount(t)} sections, free to edit in your browser and export as plain HTML.
        </p>

        <div className="mt-14 grid gap-12 md:grid-cols-2">
          <section>
            <h2 className="text-xl font-medium tracking-[-0.02em]">Who it is for</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">{templateUse(t).forWhom}</p>

            <h2 className="mt-10 text-xl font-medium tracking-[-0.02em]">What is on the page</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground marker:text-muted-foreground/70">
              {outline.map((line) => <li key={line}>{line}</li>)}
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-medium tracking-[-0.02em]">Look</h2>
            <ul className="mt-4 flex flex-wrap gap-3" aria-label="Palette">
              {swatches.map((c) => (
                <li key={c} className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full border border-border" style={{ background: c }} aria-hidden="true" />
                  <span className="lc-mono text-xs text-muted-foreground">{c}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {fonts.length > 0 && (
                <>
                  <dt className="text-muted-foreground">Fonts</dt>
                  <dd>{fonts.join(" and ")}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Background</dt>
              <dd>{backgroundLabel(t)}, drawn on a canvas as you scroll</dd>
              <dt className="text-muted-foreground">Length</dt>
              <dd>{templateScrollHeight(t).toLocaleString("en-US")}px of scroll</dd>
            </dl>

            <h2 className="mt-10 text-xl font-medium tracking-[-0.02em]">How to use it</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>Open it in the editor. It is free and needs no account.</li>
              <li>Change the words, colours, fonts and buttons to fit your business.</li>
              <li>Export a ZIP of plain HTML, with its CSS and JavaScript, and host it anywhere: GitHub Pages, Netlify, Vercel or your own server.</li>
            </ol>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`/editor?template=${t.slug}`} className="lc-btn lc-btn-solid lc-btn-sm max-md:h-11">Use this template</Link>
              <Link href={categoryPath(t.category)} className="lc-btn lc-btn-ghost lc-btn-sm max-md:h-11">{crumbs[2].name}</Link>
            </div>
          </section>
        </div>

        <section className="mt-16">
          <h2 className="text-xl font-medium tracking-[-0.02em]">Related templates</h2>
          <ul className="mt-5 grid gap-5 sm:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug} className="overflow-hidden rounded-lg border border-border bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element -- committed still, as on the gallery */}
                <img src={`/template-previews/${r.slug}.jpg`} alt="" width={800} height={500} loading="lazy" className="aspect-[16/10] w-full object-cover" />
                <div className="p-4">
                  <Link href={`/templates/${r.slug}`} className="inline-flex items-center max-md:min-h-11 font-medium underline-offset-4 hover:underline">{r.name}</Link>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.tagline}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-muted-foreground">
            Or{" "}
            <Link href="/describe" className="underline underline-offset-4 hover:text-foreground">
              have one written from your description
            </Link>
            , first two free.
          </p>
        </section>
      </section>
      <SiteFooter />
    </div>
  );
}
