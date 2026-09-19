import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import Link from "next/link";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";

/**
 * Three finished sites, served as the bundles they export to.
 *
 * The template gallery previews a site by re-rendering it in React. This page does not:
 * every card links to `public/examples/<slug>/index.html`, which is the same
 * self-contained bundle a reader downloads, built from the committed spec by the same
 * scripts. So "what will it look like" is answered by the artefact rather than a mock-up
 * of it.
 *
 * A server component on purpose. There is nothing to interact with, so it ships no
 * JavaScript of its own.
 */

export const metadata: Metadata = pageMeta({
  title: "Examples — three finished ScrollCraft sites",
  description:
    "Three complete scroll sites, each served as the exported bundle it produces: an architecture practice, a distillery and a deep-ocean survey programme.",
  path: "/examples",
});

type Example = {
  slug: string;
  name: string;
  tagline: string;
  note: string;
  style: string;
};

type Measured = {
  slug: string;
  htmlBytes: number;
  totalBytes: number;
  frameCount: number;
  sectionCount: number;
  scrollHeight: number;
};

function read<T>(path: string, fallback: T): T {
  // The bundles are generated, not committed. A checkout that has not run the build step
  // should still render this page, just without the weights.
  try {
    return JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as T;
  } catch {
    return fallback;
  }
}

const EXAMPLES = read<Example[]>("examples/manifest.json", []);
const MEASURED = read<Measured[]>("public/examples/built.json", []);

const kib = (n: number) => `${Math.round(n / 1024)} KiB`;
const mib = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MiB`;

export default function ExamplesPage() {
  const byIdentity = new Map(MEASURED.map((m) => [m.slug, m]));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      <section className="px-6 pb-12 pt-20 text-center">
        <p className="lc-mono mb-6 text-sm text-primary-ink">Finished sites</p>
        <h1 className="lc-display text-5xl md:text-6xl lg:text-7xl">
          <span className="block">What you</span>
          <span className="block text-primary-ink">actually get</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Three complete sites. Each link opens the exported bundle itself, not a preview of
          it, so what you scroll is what a download contains.
        </p>
      </section>

      <div className="max-w-5xl mx-auto px-6 pb-8">
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          {[
            ["Built from a committed spec", "Every example is one scrollcraft.json in the repository, built by the same scripts the skill ships."],
            ["Checked, not asserted", "verify.mjs drives headless Chrome over each one: the canvas has to advance, and every line of copy has to clear 4.5:1 against the pixels behind it."],
            ["One outside request", "CSS, JavaScript and frames all ship in the bundle. The only thing it fetches from elsewhere is Google Fonts, for its typefaces."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-lg border border-border bg-card p-5">
              <p className="lc-mono mb-2 text-sm text-primary-ink">{title}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-20 space-y-5">
        {EXAMPLES.map((e) => {
          const m = byIdentity.get(e.slug);
          const href = `/examples/${e.slug}/index.html`;
          return (
            <article
              key={e.slug}
              className="group rounded-lg border border-border bg-card overflow-hidden md:flex focus-within:border-primary-ink/50 hover:border-foreground/25 transition-colors"
            >
              <a
                href={href}
                className="block md:w-1/2 shrink-0"
                aria-label={`Open the ${e.name} example`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a still of the
                    exported page, sized once at build time; next/image would add a
                    loader for one fixed asset. */}
                <img
                  src={`/example-previews/${e.slug}.jpg`}
                  alt={`The ${e.name} site, scrolled to its opening section`}
                  width={1000}
                  height={625}
                  className="w-full h-full object-cover"
                />
              </a>

              <div className="p-6 flex flex-col gap-3 md:w-1/2">
                <div>
                  <span className="lc-mono text-xs text-primary-ink">{e.style} frames</span>
                  <h2 className="lc-display mt-2 text-4xl">{e.name}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{e.tagline}</p>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">{e.note}</p>

                {m && (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mt-1">
                    {[
                      ["Page", kib(m.htmlBytes)],
                      ["Whole bundle", mib(m.totalBytes)],
                      ["Sections", String(m.sectionCount)],
                      ["Scroll track", `${m.scrollHeight.toLocaleString("en-GB")}px over ${m.frameCount} frames`],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="lc-mono text-muted-foreground">{k}</dt>
                        <dd className="tabular-nums">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                <div className="flex flex-wrap gap-2 mt-auto pt-2">
                  <a href={href} className="lc-btn lc-btn-solid lc-btn-sm">
                    Open the site <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                  <a
                    href={`https://github.com/singhharsh1708/scrollcraft/blob/main/examples/${e.slug}/scrollcraft.json`}
                    target="_blank"
                    rel="noreferrer"
                    className="lc-btn lc-btn-ghost lc-btn-sm"
                  >
                    Read its spec <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <section className="max-w-5xl mx-auto px-6 pb-24 text-center">
        <div className="rounded-lg border border-border bg-card p-10 sm:p-14">
          <h2 className="lc-display mb-5 text-4xl sm:text-5xl">
            <span className="block">Start from a</span>
            <span className="block text-primary-ink">template instead</span>
          </h2>
          <p className="mx-auto mb-8 max-w-md text-muted-foreground">
            These three were written from scratch. The library has 21 sites you can edit in
            the browser and export the same way.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/templates" className="lc-btn lc-btn-solid">
              Browse templates <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/create" className="lc-btn lc-btn-ghost">
              Build your own <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
