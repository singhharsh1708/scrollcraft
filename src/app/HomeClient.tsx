"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowUpRight, Film, LayoutTemplate, Terminal } from "lucide-react";
import Navbar from "@/components/Navbar";
import StylePreview from "@/components/StylePreview";
import type { Style2D } from "@/lib/generate2DFrames";
import PluginInstall from "@/components/PluginInstall";
import SiteFooter from "@/components/SiteFooter";
import Lifecycle, { type LifecycleStep } from "@/components/Lifecycle";
import { GITHUB_REPO_URL } from "@/lib/links";

/**
 * The hero animation, drawn rather than fetched.
 *
 * Same drawFrame2D the product itself uses, on a canvas, for no network requests. It is
 * the hero's backdrop rather than a box beside the copy, so all of it is in view at
 * first paint.
 */
const HERO_STYLE: Style2D = "gradient";
/** TripVault's own palette: the catalogue's closest match to the page's navy and cyan. */
const HERO_COLORS: [string, string, string] = ["#0284c7", "#0891b2", "#020c1a"];
/** NeuralPath and Halo, for the canvases further down. Both from the catalogue. */
const PARTICLE_COLORS: [string, string, string] = ["#2563eb", "#0891b2", "#02101c"];
const WAVE_COLORS: [string, string, string] = ["#3b82f6", "#4338ca", "#040a1a"];
/** FrostBrew: the brightest blue in the catalogue, for the closing particle field. */
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

const DEPLOY_TARGETS = ["Netlify", "Vercel", "GitHub Pages", "Cloudflare Pages", "Any static host"];

/** Every entry an export writes, in the order the editor adds them. */
const EXPORT_FILES: Array<[string, string]> = [
  ["index.html", "your page"],
  ["lenis.min.js", "smooth scroll"],
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

const GENERATE_STYLES: Style2D[] = ["gradient", "geometric", "particles", "wave"];

const TERMINAL_LINES = [
  "/plugin marketplace add singhharsh1708/scrollcraft",
  "/plugin install scrollcraft@scrollcraft",
  "build me a scroll site from hero.mp4",
];

// Deterministic, so the server and the browser draw the same bars.
const BARS = Array.from({ length: 48 }, (_, i) =>
  Math.round((0.25 + 0.75 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.43))) * 100)
);

const FAQ = [
  { q: "Do I need to know how to code?", a: "No. Pick a template, change the copy and colours, and export. What you download is plain HTML, CSS and JavaScript that any host will serve." },
  { q: "How does the scroll animation work?", a: "ScrollCraft draws a sequence of frames on a canvas, and the page shows the frame that matches how far the reader has scrolled. There is no WebGL and no animation library." },
  { q: "Can I use my own video?", a: "Yes. On the create page you can upload an MP4, MOV or WebM. Its frames are extracted in your browser, and the file never leaves your device." },
  { q: "Where can I host the exported site?", a: "Anywhere that serves static files: Netlify, Vercel, Cloudflare Pages, GitHub Pages or your own server. Unzip it and upload the folder." },
  { q: "How are the frames generated?", a: "They are drawn in your browser from the style and palette the template carries. Nothing is sent to a server to make them." },
];

function HeroPreview() {
  const reducedMotion = useReducedMotion();
  return (
    <StylePreview
      style={HERO_STYLE}
      colors={HERO_COLORS}
      paused={reducedMotion}
      durationSec={9}
      maxProgress={0.55}
      className="h-full w-full"
    />
  );
}

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

function PickPanel({ templates, total }: { templates: TemplateSlice[]; total: number }) {
  return (
    <PanelFrame label="/templates" meta={`${total} sites`}>
      <div className="grid grid-cols-2 gap-3 p-4">
        {templates.map((t) => (
          <div key={t.slug} className="overflow-hidden rounded-md border border-border bg-card">
            <div className="relative aspect-[16/10] bg-black">
              <StylePreview style={t.style} colors={t.colors} paused className="absolute inset-0 h-full w-full" />
            </div>
            <div className="px-3 py-2.5">
              <p className="text-sm text-foreground">{t.name}</p>
              <p className="lc-mono text-[11px] text-muted-foreground">{t.category}</p>
            </div>
          </div>
        ))}
      </div>
    </PanelFrame>
  );
}

function GeneratePanel({ reduced }: { reduced: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = window.setInterval(() => setI((v) => (v + 1) % GENERATE_STYLES.length), 3200);
    return () => window.clearInterval(t);
  }, [reduced]);
  const style = GENERATE_STYLES[i];
  return (
    <PanelFrame label="/create" meta="drawn in your browser">
      <div className="relative aspect-[16/10] bg-black">
        <StylePreview style={style} colors={PARTICLE_COLORS} paused={reduced} maxProgress={0.6} className="absolute inset-0 h-full w-full" />
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-1.5">
          {GENERATE_STYLES.map((s) => (
            <span
              key={s}
              className={`lc-mono rounded border px-2.5 py-1 text-[11px] backdrop-blur ${
                s === style ? "border-primary-ink/60 bg-black/60 text-white" : "border-white/15 bg-black/40 text-white/70"
              }`}
            >
              {s}
            </span>
          ))}
        </div>
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

function ScorePanel() {
  return (
    <PanelFrame label="audio/track.mp3" meta="follows the scroll">
      <div className="px-6 pb-7 pt-8">
        <div className="flex h-36 items-center gap-[3px]" aria-hidden="true">
          {BARS.map((h, i) => {
            const ramp = Math.min(1, i / (BARS.length * 0.55));
            return (
              <span
                key={i}
                className="flex-1 rounded-full bg-primary-ink"
                style={{ height: `${h}%`, opacity: Math.round((0.12 + 0.88 * ramp) * 100) / 100 }}
              />
            );
          })}
        </div>
        <div className="lc-mono mt-5 flex justify-between gap-4 text-[11px] text-muted-foreground">
          <span>top of the page</span>
          <span className="text-center">fades in as the reader scrolls</span>
          <span>end</span>
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

function DeployPanel({ example }: { example: ExampleCard }) {
  return (
    <PanelFrame label={`examples/${example.slug}/index.html`} meta="served as exported">
      {/* eslint-disable-next-line @next/next/no-img-element -- a still of an exported
          page, sized once at build time. */}
      <img
        src={`/example-previews/${example.slug}.jpg`}
        loading="lazy"
        alt={`The ${example.name} example, as deployed`}
        width={1000}
        height={625}
        className="block aspect-[16/10] w-full object-cover"
      />
    </PanelFrame>
  );
}

function TerminalPanel() {
  return (
    <div className="lc-mono absolute inset-0 flex flex-col justify-center gap-3 px-5 text-[11.5px] leading-relaxed text-[#cce9ff]">
      {TERMINAL_LINES.map((line) => (
        <p key={line} className="truncate">
          <span className="text-[#7fc8ff]">&gt; </span>
          {line}
        </p>
      ))}
    </div>
  );
}

function InlineLink({ label, href, external, className = "" }: { label: string; href: string; external?: boolean; className?: string }) {
  const inner = (
    <>
      {label} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`lc-link ${className}`}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={`lc-link ${className}`}>
      {inner}
    </Link>
  );
}

export default function HomeClient({
  templates,
  editorSample,
  examples,
  stats,
}: {
  templates: TemplateSlice[];
  editorSample: EditorSample | null;
  examples: ExampleCard[];
  stats: HomeStats;
}) {
  const reduced = useReducedMotion();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const steps: LifecycleStep[] = [
    {
      id: "pick",
      label: "Pick",
      title: "Pick",
      subtitle: "Start from a finished site. Keep the pacing, change the words.",
      bullets: [
        ["Browse", ` ${stats.templates} templates across ${stats.categories} categories`],
        ["Preview", " any of them before you open it"],
        ["Open", " one in the editor with a click"],
      ],
      links: [
        { label: "Templates", href: "/templates" },
        { label: "Presets", href: "/presets" },
      ],
      panel: <PickPanel templates={templates} total={stats.templates} />,
    },
    {
      id: "generate",
      label: "Generate",
      title: "Generate",
      subtitle: "Frames drawn in your browser, or taken from footage you already shot.",
      bullets: [
        ["Choose", " gradient, geometric, particles or wave, and a palette"],
        ["Upload", " a video and its frames are extracted on your device"],
        ["Add", " a portrait set, so a phone gets a background shaped for it"],
      ],
      links: [{ label: "Create a site", href: "/create" }],
      panel: <GeneratePanel reduced={reduced} />,
    },
    {
      id: "edit",
      label: "Edit",
      title: "Edit",
      subtitle: "Every section in place, and every change one undo away.",
      bullets: [
        ["Change", " headings, body copy, buttons and colours"],
        ["Reorder", " sections, and set how long each one holds"],
        ["Preview", " at desktop, tablet and phone widths"],
      ],
      links: editorSample ? [{ label: "Open the editor", href: `/editor?template=${editorSample.slug}` }] : [],
      panel: editorSample ? <EditPanel sample={editorSample} /> : null,
    },
    {
      id: "score",
      label: "Score",
      title: "Score",
      subtitle: "A soundtrack that follows the reader down the page.",
      bullets: [
        ["Attach", " one track to the whole site"],
        ["Fade", " it in as the reader scrolls, and out when they stop"],
        ["Ship", " it inside the export with everything else"],
      ],
      links: [{ label: "How audio works", href: `${GITHUB_REPO_URL}#features`, external: true }],
      panel: <ScorePanel />,
    },
    {
      id: "export",
      label: "Export",
      title: "Export",
      subtitle: "One ZIP holding everything a host needs, and nothing it does not.",
      bullets: [
        ["Ships", " a 404 page, favicon, social card and robots.txt"],
        ["Includes", " config for Netlify, Vercel and GitHub Pages"],
        ["Needs", " no build step and no install"],
      ],
      links: [{ label: "See an exported site", href: "/examples" }],
      panel: <ExportPanel />,
    },
    {
      id: "deploy",
      label: "Deploy",
      title: "Deploy",
      subtitle: "Drag the folder onto a host, and it is live.",
      bullets: [
        ["Upload", " to Netlify, Vercel or Cloudflare Pages"],
        ["Push", " to GitHub Pages and it serves as it is"],
        ["Host", " it anywhere that serves static files"],
      ],
      links: [
        { label: "Examples", href: "/examples" },
        { label: "GitHub", href: GITHUB_REPO_URL, external: true },
      ],
      panel: examples[0] ? <DeployPanel example={examples[0]} /> : <ExportPanel />,
    },
  ];

  const ways = [
    {
      icon: LayoutTemplate,
      name: "templates",
      title: "Edit a finished site in the browser",
      sub: `For launching fast from one of ${stats.templates} designed sites`,
      link: { label: "Browse templates", href: "/templates" },
      panel: <StylePreview style="wave" colors={WAVE_COLORS} paused={reduced} className="absolute inset-0 h-full w-full" />,
    },
    {
      icon: Film,
      name: "your-footage",
      title: "Scroll through video you already shot",
      sub: "For brands with film that deserves more than autoplay",
      link: { label: "Upload a video", href: "/create" },
      panel: <StylePreview style="particles" colors={FROST_COLORS} paused={reduced} maxProgress={0.3} className="absolute inset-0 h-full w-full" />,
    },
    {
      icon: Terminal,
      name: "claude-code",
      title: "Build it from your terminal",
      sub: "For developers who want the site in version control",
      link: { label: "Read the plugin docs", href: `${GITHUB_REPO_URL}#installing-the-skill`, external: true },
      panel: <TerminalPanel />,
    },
  ];

  return (
    <main className="min-h-screen overflow-x-clip bg-background text-foreground">
      <Navbar />

      {/* Hero */}
      <section className="relative -mt-[76px] flex min-h-[92svh] flex-col overflow-hidden pt-[76px]">
        <div aria-hidden="true" className="absolute inset-0">
          <HeroPreview />
        </div>
        {/* Dark behind the copy and open at the edges, so the animation reads as the art
            around the headline. It used to be the other way round, lightest behind the
            text and near black everywhere else, which hid the one thing the hero shows. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_46%_52%_at_50%_44%,rgba(3,7,16,0.9)_0%,rgba(3,7,16,0.8)_45%,rgba(3,7,16,0.35)_80%,rgba(3,7,16,0.15)_100%)]"
        />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />

        <div className="relative mx-auto flex w-full max-w-[1360px] flex-1 flex-col items-center justify-center px-6 pb-12 pt-20 text-center sm:pt-24">
          <h1 className="lc-display text-[2.6rem] sm:text-6xl lg:text-[4.6rem]">
            <span className="block text-foreground">Cinematic scroll websites</span>
            <span className="block text-primary-ink">exported as plain HTML</span>
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Pick a finished template, change the words, download a ZIP. The background moves
            as your reader scrolls, and nothing needs installing.
          </p>
          <div className="mt-10 grid w-full max-w-sm grid-cols-2 gap-3 sm:flex sm:w-auto sm:max-w-none">
            <Link href="/create" className="lc-btn lc-btn-solid">
              Start building
            </Link>
            <Link href="/examples" className="lc-btn lc-btn-ghost">
              See examples
            </Link>
          </div>
          <p className="lc-mono mt-8 text-sm text-muted-foreground">No account · Runs in your browser · MIT licensed</p>
        </div>

        {/* Social proof strip */}
        <div className="relative border-t border-border bg-background/50 backdrop-blur-sm">
          <div className="mx-auto flex max-w-[1360px] flex-col items-center gap-5 px-6 py-8 lg:flex-row lg:justify-between">
            <p className="lc-mono shrink-0 text-xs uppercase tracking-[0.16em] text-muted-foreground">Exports deploy to</p>
            <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 lg:justify-end">
              {DEPLOY_TARGETS.map((t) => (
                <li key={t} className="text-lg font-light tracking-[-0.01em] text-foreground/85 sm:text-xl">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Lifecycle */}
      <section className="px-6 pb-16 pt-28 sm:pt-36">
        <div className="mx-auto max-w-[1360px]">
          <h2 className="lc-display text-center text-4xl text-primary-ink sm:text-5xl lg:text-[3.6rem]">
            <span className="block">The whole path, from a template</span>
            <span className="block">to a site anyone can visit</span>
          </h2>
          <Lifecycle steps={steps} />
        </div>
      </section>

      {/* Three ways */}
      <section className="band-light">
        <div className="mx-auto max-w-[1360px] px-6 py-28 sm:py-32">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
            <h2 className="lc-display text-4xl sm:text-5xl lg:text-[3.6rem]">Three ways to build a scroll site</h2>
            <p className="max-w-lg text-lg leading-relaxed text-muted-foreground lg:justify-self-end">
              Edit a finished template in the browser, scroll through footage you already shot,
              or build the whole thing from your terminal. All three produce the same bundle.
            </p>
          </div>
          <div className="mt-16 grid gap-12 md:grid-cols-3 md:gap-6">
            {ways.map((w) => (
              <article key={w.name} className="flex flex-col">
                <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-[#0a1122]">{w.panel}</div>
                <div className="mt-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-foreground text-background">
                    <w.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="lc-mono text-lg">{w.name}</span>
                </div>
                <h3 className="lc-display mt-5 text-[1.9rem] leading-tight">{w.title}</h3>
                <p className="mt-3 text-muted-foreground">{w.sub}</p>
                <InlineLink {...w.link} className="mt-auto pt-6" />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Finished sites. The stages above say how it works; this says what comes out of
          it, and each card opens the exported bundle rather than a preview of it. */}
      {examples.length > 0 && (
        <section className="band-light border-t border-border">
          <div className="relative mx-auto max-w-[1360px] px-6 py-28 sm:py-32">
            <div aria-hidden="true" className="absolute bottom-0 left-6 top-0 hidden w-px bg-border lg:block" />
            <div aria-hidden="true" className="absolute left-6 top-40 hidden h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-primary lg:block" />
            <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto] lg:pl-[14%]">
              <h2 className="lc-display text-4xl sm:text-5xl lg:text-[3.6rem]">
                <span className="block">See what it produces,</span>
                <span className="block">not a mock-up of it</span>
              </h2>
              <Link href="/examples" className="lc-btn lc-btn-solid w-fit">
                All examples
              </Link>
            </div>
            <div className="mt-14 grid gap-5 md:grid-cols-3 lg:pl-[14%]">
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
                  <div className="flex flex-1 flex-col p-6">
                    <p className="lc-mono text-sm text-muted-foreground">{e.name}</p>
                    <h3 className="lc-display mt-3 text-2xl leading-snug">{e.tagline}</h3>
                    <span className="lc-link mt-auto pt-8">
                      Open the site <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Numbers */}
      <section className="band-light border-t border-border">
        <div className="mx-auto max-w-[1360px] px-6 py-28 sm:py-32">
          <h2 className="lc-display text-4xl sm:text-5xl lg:pl-[14%] lg:text-[3.6rem]">
            <span className="block">Free, open source,</span>
            <span className="block">and yours to keep</span>
          </h2>
          <dl className="mt-16 grid gap-12 sm:grid-cols-3 lg:pl-[14%]">
            {[
              [String(stats.templates), "Finished templates"],
              [String(stats.categories), "Categories covered"],
              ["0", "Accounts, databases or paywalls"],
            ].map(([n, label]) => (
              <div key={label} className="flex flex-col-reverse">
                <dt className="lc-mono mt-3 text-sm text-muted-foreground">{label}</dt>
                <dd className="lc-display text-7xl lg:text-[6rem]">{n}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-28 sm:py-32">
        <div className="mx-auto grid max-w-[1360px] gap-12 lg:grid-cols-[1fr_1.35fr]">
          <h2 className="lc-display text-4xl text-primary-ink sm:text-5xl">
            <span className="block">Questions people</span>
            <span className="block">ask first</span>
          </h2>
          <div className="border-t border-border">
            {FAQ.map((item, i) => (
              <div key={item.q} className="border-b border-border">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left"
                  aria-expanded={openFaq === i}
                  aria-controls={`faq-answer-${i}`}
                  id={`faq-question-${i}`}
                >
                  <span className="text-lg font-light tracking-[-0.01em] sm:text-xl">{item.q}</span>
                  <span aria-hidden="true" className={`text-muted-foreground text-lg leading-none transition-transform flex-shrink-0 ${openFaq === i ? "rotate-45" : ""}`}>+</span>
                </button>
                {openFaq === i && (
                  <div
                    id={`faq-answer-${i}`}
                    role="region"
                    aria-labelledby={`faq-question-${i}`}
                    className="max-w-2xl pb-6 leading-relaxed text-muted-foreground"
                  >
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plugin */}
      <section className="px-6 pb-28">
        <div className="mx-auto max-w-[1360px]">
          <PluginInstall />
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border px-6">
        <div className="mx-auto grid max-w-[1360px] items-center gap-12 py-24 sm:py-32 lg:grid-cols-2">
          <div aria-hidden="true" className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black">
            {/* Waves rather than particles: particles are a sparse field of small dots, and as
                the last image on the page it read as an empty frame. Held to the bright start
                of its range, since every style lerps toward the palette's dark third colour. */}
            <StylePreview style="wave" colors={FROST_COLORS} paused={reduced} maxProgress={0.35} className="absolute inset-0 h-full w-full" />
          </div>
          <div>
            <h2 className="lc-display text-5xl text-primary-ink sm:text-6xl lg:text-[4.2rem]">
              <span className="block">Start your first</span>
              <span className="block">scroll site</span>
            </h2>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/create" className="lc-btn lc-btn-solid">
                Start building
              </Link>
              <Link href="/templates" className="lc-btn lc-btn-ghost">
                Browse templates
              </Link>
            </div>
            <p className="mt-10 max-w-md text-lg leading-relaxed text-foreground/90">
              Pick a template, change the words, download a ZIP. No account, nothing to
              install, nothing to pay.
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
