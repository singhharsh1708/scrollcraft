import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { GUIDES, guide } from "@/lib/guides";
import { siteUrl } from "@/lib/env";
import { AUTHOR_NAME, AUTHOR_SITE_URL } from "@/lib/links";

export type Faq = { q: string; a: ReactNode };

export const PROSE =
  "prose prose-invert max-w-none prose-headings:font-light prose-headings:tracking-[-0.02em] prose-h2:mt-16 prose-h2:text-3xl prose-h3:text-xl prose-a:text-primary-ink prose-a:underline-offset-4 prose-p:leading-relaxed prose-li:leading-relaxed prose-pre:border prose-pre:border-border prose-pre:bg-card prose-code:before:content-none prose-code:after:content-none";

export default function GuideArticle({
  path,
  lede,
  demo,
  faq,
  children,
}: {
  path: string;
  lede: ReactNode;
  demo?: ReactNode;
  faq: Faq[];
  children: ReactNode;
}) {
  const { title, description } = guide(path);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: `${siteUrl}${path}`,
    inLanguage: "en",
    author: { "@type": "Person", name: AUTHOR_NAME, url: AUTHOR_SITE_URL },
    publisher: { "@type": "Organization", name: "ScrollCraft", url: siteUrl },
  };
  const related = GUIDES.filter((g) => g.path !== path);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Navbar />

      <header className="px-6 pb-14 pt-20 sm:pt-24">
        <div className="mx-auto max-w-3xl">
          <p className="lc-mono mb-5 text-sm text-primary-ink">Guide</p>
          <h1 className="lc-display text-balance text-4xl sm:text-5xl md:text-6xl">{title.replace(/-/g, "\u2011")}</h1>
          <div className="mt-7 text-lg leading-relaxed text-muted-foreground">{lede}</div>
        </div>
      </header>

      {demo && <div className="mx-auto max-w-[1100px] px-6 pb-8">{demo}</div>}

      <article className="mx-auto max-w-3xl px-6 pb-8">
        <div className={PROSE}>{children}</div>
      </article>

      <section className="px-6 pb-20 pt-8" aria-labelledby="faq">
        <div className="mx-auto max-w-3xl">
          <h2 id="faq" className="lc-display mb-8 text-3xl sm:text-4xl">Questions</h2>
          <dl className="divide-y divide-border border-y border-border">
            {faq.map(({ q, a }) => (
              <div key={q} className="py-6">
                <dt className="text-lg font-medium tracking-[-0.01em]">{q}</dt>
                <dd className="mt-2 leading-relaxed text-muted-foreground [&_a]:text-primary-ink [&_a]:underline [&_a]:underline-offset-4">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-t border-border px-6 py-20 text-center">
        <h2 className="lc-display text-4xl sm:text-5xl">
          <span className="block">Try it on</span>
          <span className="block text-primary-ink">your own business</span>
        </h2>
        <p className="mx-auto mb-9 mt-5 max-w-md text-lg text-muted-foreground">
          Describe what you do in a paragraph and get a finished scroll site to edit and export,
          or start from a template.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/#write" className="lc-btn lc-btn-solid">
            Write my site <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/templates" className="lc-btn lc-btn-ghost">
            Browse templates
          </Link>
        </div>
        <nav aria-label="More guides" className="mx-auto mt-14 max-w-3xl">
          <p className="lc-mono mb-4 text-sm text-muted-foreground">More guides</p>
          <ul className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {related.map((g) => (
              <li key={g.path}>
                <Link href={g.path} className="lc-link">
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      <SiteFooter />
    </main>
  );
}
