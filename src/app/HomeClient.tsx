"use client";
import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import PromptHero from "@/components/PromptHero";
import dynamic from "next/dynamic";
import type { HeroTemplate } from "@/components/HeroSequence";
import Navbar from "@/components/Navbar";
import StylePreview from "@/components/StylePreview";
import type { Style2D } from "@/lib/generate2DFrames";
import PluginInstall from "@/components/PluginInstall";
import SiteFooter from "@/components/SiteFooter";

/** FrostBrew, from the catalogue. */
const FROST_COLORS: [string, string, string] = ["#38bdf8", "#3b82f6", "#020818"];

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const subscribeReducedMotion = (onChange: () => void) => {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const getReducedMotionSnapshot = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;
const getReducedMotionServerSnapshot = () => false;

function useReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, getReducedMotionServerSnapshot);
}

export type ExampleCard = { slug: string; name: string; tagline: string };
export type TemplateSlice = {
  slug: string;
  name: string;
  category: string;
  style: Style2D;
  colors: [string, string, string];
};
export type EditorSample = {
  name: string;
  slug: string;
  style: Style2D;
  colors: [string, string, string];
  sections: { kind: string; heading: string; eyebrow: string }[];
};
export type HomeStats = { templates: number; categories: number };

// Below the first screen, so it loads as its own chunk.
const HeroSequence = dynamic(() => import("@/components/HeroSequence"));

/**
 * Whether a site made with each tool can be downloaded and hosted anywhere, and what that
 * costs. Every row was read off the company's own help or pricing page on the date below.
 */
export const OWNERSHIP_CHECKED = "19 September 2026";
export const OWNERSHIP: { tool: string; answer: string; cost: string; source?: string }[] = [
  { tool: "ScrollCraft", answer: "Yes, as a plain HTML ZIP", cost: "Free to edit and export; first two written sites free, then 5 for $20" },
  { tool: "Webflow", answer: "HTML and CSS; CMS content stays behind", cost: "Core Workspace plan, $19/mo billed yearly", source: "https://webflow.com/pricing" },
  { tool: "Carrd", answer: "Yes", cost: "Pro Plus plan, $49/yr", source: "https://carrd.com/pro" },
  { tool: "Squarespace", answer: "Content only, as XML for WordPress", cost: "Not offered for the design", source: "https://support.squarespace.com/hc/en-us/articles/206566687-Exporting-your-site" },
  { tool: "Framer", answer: "No", cost: "Not offered", source: "https://www.framer.com/help/articles/can-i-export-my-website-to-html-and-self-host-it/" },
  { tool: "Wix", answer: "No, sites run on Wix's servers", cost: "Not offered", source: "https://support.wix.com/en/article/exporting-or-embedding-your-wix-site-elsewhere" },
];

/** Every entry an export writes, in the order the editor adds them. */
const EXPORT_FILES: Array<[string, string]> = [
  ["index.html", "your page"],
  ["404.html", "not-found page"],
  ["favicon.svg", "tab icon"],
  ["apple-touch-icon.png", "home-screen icon"],
  ["og-image.jpg", "social card"],
  ["robots.txt", "crawlers"],
  ["README.md", "how to deploy it"],
  ["netlify.toml", "Netlify"],
  ["vercel.json", "Vercel"],
  [".nojekyll", "GitHub Pages"],
  ["frames/", "the background"],
  ["frames-mobile/", "portrait set, if made"],
  ["audio/", "your track, if added"],
];

const FAQ = [
  { q: "What does it cost?", a: "The editor, the templates and the export are free, with no account. Having a site written from your description is what costs money: your first two sites are free, then 5 more are $20, paid once. Nothing renews." },
  { q: "Do I need to know how to code?", a: "No. Describe the business or pick a template, change the words and colours, and download. What you get is plain HTML, CSS and JavaScript that any host will serve." },
  { q: "How does the scroll animation work?", a: "The page draws a sequence of frames on a canvas and shows the one that matches how far the reader has scrolled. There is no WebGL and no animation library, and the frames are drawn in your browser." },
  { q: "Does it take over my visitors' scrolling?", a: "No. The page scrolls exactly the way the visitor's wheel, trackpad or finger normally scrolls it, and the background follows along. Nothing slows, smooths or snaps the scroll, and visitors who ask their system for less motion get a still page." },
  { q: "Where can I host the exported site?", a: "Anywhere that serves static files: Netlify, Vercel, Cloudflare Pages, GitHub Pages or your own server. Unzip it and upload the folder." },
];

function PanelFrame({ label, meta, children }: { label: string; meta?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-primary-ink/25 bg-card/60 p-2.5 shadow-[0_40px_120px_-50px_rgba(0,109,221,0.7)]">
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <div className="lc-mono flex items-center justify-between gap-4 border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span className="truncate">{label}</span>
          {meta && <span className="shrink-0">{meta}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}

function DescribePanel() {
  return (
    <PanelFrame label="/describe" meta="a paragraph in, a site out">
      <div className="space-y-3 p-4">
        <div className="rounded-md border border-border bg-background p-3">
          <p className="text-sm leading-relaxed text-foreground">
            A two-chair barbershop on Mill Road in Cambridge, open since 2011. Walk-ins
            before noon, appointments after. Fades, beard trims and hot towel shaves. We do
            not do colour.
          </p>
        </div>
        <p className="lc-mono text-[11px] text-muted-foreground">six sections written from it</p>
        <ul className="space-y-1.5">
          {[
            ["Mill Road, Cambridge", "Two chairs on Mill Road since 2011."],
            ["Before noon", "Walk in before twelve. No booking needed."],
            ["What we don't do", "We do not do colour."],
          ].map(([eyebrow, heading]) => (
            <li key={eyebrow} className="rounded-md border border-border bg-card px-3 py-2">
              <p className="lc-mono text-[10px] uppercase tracking-[0.14em] text-primary-ink">{eyebrow}</p>
              <p className="mt-1 text-sm text-foreground">{heading}</p>
            </li>
          ))}
        </ul>
      </div>
    </PanelFrame>
  );
}

function EditPanel({ sample }: { sample: EditorSample }) {
  const rows = sample.sections.slice(0, 8);
  const lead = sample.sections.find((s) => s.kind !== "spacer");
  return (
    <PanelFrame label={`editor · ${sample.name}`} meta="undo · redo">
      <div className="grid grid-cols-[42%_1fr]">
        <ol className="space-y-0.5 border-r border-border p-2">
          {rows.map((s, i) => (
            <li
              key={i}
              className={`rounded px-2.5 py-1.5 text-[12px] leading-snug ${
                i === 0 ? "border border-primary-ink/35 bg-primary/15 text-foreground" : "text-muted-foreground"
              }`}
            >
              {s.kind === "spacer" ? <span className="italic">Spacer</span> : <span className="line-clamp-1">{s.heading}</span>}
            </li>
          ))}
        </ol>
        <div className="relative min-h-[240px] bg-black">
          <StylePreview style={sample.style} colors={sample.colors} paused className="absolute inset-0 h-full w-full" />
          {lead && (
            <div className="absolute inset-x-5 bottom-5">
              {lead.eyebrow && (
                <p className="lc-mono mb-1.5 text-[10px] uppercase tracking-[0.14em] text-white/80">{lead.eyebrow}</p>
              )}
              <p className="text-xl font-light leading-tight tracking-[-0.02em] text-white">{lead.heading}</p>
            </div>
          )}
        </div>
      </div>
    </PanelFrame>
  );
}

function ExportPanel() {
  return (
    <PanelFrame label="your-site.zip" meta={`${EXPORT_FILES.length} entries`}>
      <ul className="lc-mono px-5 py-4 text-[12.5px] leading-[1.9]">
        {EXPORT_FILES.map(([file, note], i) => (
          <li key={file} className="flex items-baseline justify-between gap-6">
            {/* A filename never breaks; on a phone the note gives way instead. */}
            <span className="shrink-0 whitespace-nowrap text-foreground">
              <span className="text-muted-foreground">{i === EXPORT_FILES.length - 1 ? "└── " : "├── "}</span>
              {file}
            </span>
            <span className="min-w-0 truncate text-right text-muted-foreground">{note}</span>
          </li>
        ))}
      </ul>
    </PanelFrame>
  );
}


function SectionHead({ title, link }: { title: string; link?: { label: string; href: string } }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <h2 className="lc-display text-3xl sm:text-4xl lg:text-5xl">{title}</h2>
      {link && (
        <Link href={link.href} className="lc-link">
          {link.label} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export default function HomeClient({
  heroTemplate,
  templates,
  editorSample,
  examples,
  stats,
}: {
  heroTemplate: HeroTemplate;
  templates: TemplateSlice[];
  editorSample: EditorSample | null;
  examples: ExampleCard[];
  stats: HomeStats;
}) {
  const reduced = useReducedMotion();
  const template = templates[0];

  const steps: { id: string; title: string; body: string; panel: ReactNode }[] = [
    {
      id: "describe",
      title: "Describe",
      body: "Write a few sentences about your business and add a photo or two. You get a first draft with the sections, colours and fonts already chosen.",
      panel: <DescribePanel />,
    },
    {
      id: "edit",
      title: "Edit",
      body: "Change any word, colour or section and check it at phone and desktop sizes. Add your own video or a soundtrack if you want one.",
      panel: editorSample ? <EditPanel sample={editorSample} /> : null,
    },
    {
      id: "export",
      title: "Publish",
      body: "Download one ZIP and upload it to a free Netlify, Vercel or GitHub Pages account. It is plain HTML with no build step.",
      panel: <ExportPanel />,
    },
  ];

  return (
    <main className="min-h-screen overflow-x-clip bg-background text-foreground">
      <Navbar variant="floating" />

      {/* Hero */}
      <PromptHero reducedMotion={reduced} />

      <HeroSequence template={heroTemplate} templateCount={stats.templates} reducedMotion={reduced}>
        <h2 className="lc-display text-[2.2rem] sm:text-5xl lg:text-[3.2rem]">
          <span className="block text-foreground">This is what comes out.</span>
          <span className="block text-primary-ink">Scroll, and the screen plays it.</span>
        </h2>
        <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
          A real template, drawn frame by frame as you scroll. Your exported site works the
          same way on your own host.
        </p>
      </HeroSequence>

      {/* Examples */}
      {examples.length > 0 && (
        <section className="border-t border-border px-6 py-20 sm:py-24">
          <div className="mx-auto max-w-[1360px]">
            <SectionHead title="Sites made with it" link={{ label: "All examples", href: "/examples" }} />
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {examples.map((e) => (
                <a
                  key={e.slug}
                  href={`/examples/${e.slug}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- a still of the
                      exported page, sized once at build time. */}
                  <img
                    src={`/example-previews/${e.slug}.jpg`}
                    loading="lazy"
                    alt={`The ${e.name} site, scrolled to its opening section`}
                    width={1000}
                    height={625}
                    className="aspect-[16/10] w-full object-cover"
                  />
                  <div className="flex flex-1 items-end justify-between gap-4 p-5">
                    <div>
                      <h3 className="text-lg text-foreground">{e.name}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{e.tagline}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <section id="how" className="border-t border-border px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-[1360px]">
          <SectionHead title="How it works" />
          <ol className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-6">
            {steps.map((s, i) => (
              <li key={s.id} className="flex min-w-0 flex-col">
                <p className="lc-mono text-sm text-primary-ink">{i + 1}</p>
                <h3 className="lc-display mt-2 text-2xl sm:text-3xl">{s.title}</h3>
                <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">{s.body}</p>
                <div className="mt-6">{s.panel}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Other ways to start */}
      <section className="border-t border-border px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-[1360px]">
          <SectionHead title="Other ways to start" />
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {template && (
              <Link
                href="/templates"
                className="group grid overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/30 sm:grid-cols-[42%_1fr]"
              >
                <div className="relative aspect-[16/10] bg-black sm:aspect-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element -- the same committed
                      still the gallery card uses. */}
                  <img
                    src={`/template-previews/${template.slug}.jpg`}
                    loading="lazy"
                    alt={`The ${template.name} template, at its opening heading`}
                    width={800}
                    height={500}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl text-foreground">Start from a template</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {stats.templates} finished sites across {stats.categories} categories. Pick one and change the words.
                  </p>
                  <span className="lc-link mt-5">
                    Browse templates <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            )}
            <Link
              href="/create"
              className="group grid overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/30 sm:grid-cols-[42%_1fr]"
            >
              <div className="relative aspect-[16/10] bg-black sm:aspect-auto">
                <StylePreview style="wave" colors={FROST_COLORS} paused={reduced} maxProgress={0.35} className="absolute inset-0 h-full w-full" />
              </div>
              <div className="p-6">
                <h3 className="text-xl text-foreground">Use your own video</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Upload an MP4, MOV or WebM and it plays as the page scrolls. The file never leaves your device.
                </p>
                <span className="lc-link mt-5">
                  Upload a video <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </div>
            </Link>
          </div>
          {/* Lets the plugin card's grid shrink on a phone instead of clipping its commands. */}
          <div className="mt-5 [&_.grid>*]:min-w-0">
            <PluginInstall />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border px-6 py-20 sm:py-24">
        <div className="mx-auto grid max-w-[1360px] gap-10 lg:grid-cols-[1fr_1.6fr]">
          <h2 className="lc-display text-3xl sm:text-4xl lg:text-5xl">Questions</h2>
          <div className="border-t border-border">
            {/* Native disclosure, so the answers are in the HTML before anyone clicks. */}
            {FAQ.map((item) => (
              <details key={item.q} className="group border-b border-border">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left">
                  <span className="text-lg font-light tracking-[-0.01em]">{item.q}</span>
                  <span
                    aria-hidden="true"
                    className="flex-shrink-0 text-lg leading-none text-muted-foreground transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <div className="max-w-2xl pb-6 leading-relaxed text-muted-foreground">{item.a}</div>
              </details>
            ))}
            <details className="group border-b border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left">
                <span className="text-lg font-light tracking-[-0.01em]">Can I download my site and host it anywhere?</span>
                <span
                  aria-hidden="true"
                  className="flex-shrink-0 text-lg leading-none text-muted-foreground transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="pb-6">
                <p className="max-w-2xl leading-relaxed text-muted-foreground">Yes. Here is how that compares with other builders.</p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-0 border-collapse text-left text-sm">
                    <thead>
                      <tr className="lc-mono border-b border-border text-xs text-muted-foreground">
                        <th scope="col" className="py-2 pr-4 font-normal">Tool</th>
                        <th scope="col" className="py-2 pr-4 font-normal">Download and host anywhere</th>
                        <th scope="col" className="py-2 font-normal">What it takes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {OWNERSHIP.map((row) => (
                        <tr key={row.tool} className="border-b border-border align-top">
                          <th scope="row" className="py-3 pr-4 font-medium">{row.tool}</th>
                          <td className="py-3 pr-4">{row.answer}</td>
                          <td className="py-3 text-muted-foreground">{row.cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Checked on {OWNERSHIP_CHECKED} against each company&apos;s own pages:{" "}
                  {OWNERSHIP.filter((r) => r.source).map((r, i, all) => (
                    <span key={r.tool}>
                      <a href={r.source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
                        {r.tool}
                      </a>
                      {i < all.length - 1 ? ", " : "."}
                    </span>
                  ))}
                </p>
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border px-6">
        <div className="mx-auto flex max-w-[1360px] flex-col items-center py-20 text-center sm:py-28">
          <h2 className="lc-display text-4xl text-primary-ink sm:text-5xl lg:text-6xl">Start your scroll site</h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
            Your first two sites are free, then 5 for $20. The editor and export are always free.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/#write" className="lc-btn lc-btn-solid">
              Describe your business
            </Link>
            <Link href="/templates" className="lc-btn lc-btn-ghost">
              Browse templates
            </Link>
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            Need something built for you?{" "}
            <Link href="/contact?topic=custom" className="underline underline-offset-4 hover:text-foreground">
              Tell us about the project
            </Link>
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
