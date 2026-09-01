"use client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles, Zap, Download, Play, Check } from "lucide-react";
import Navbar from "@/components/Navbar";
import StylePreview from "@/components/StylePreview";
import type { Style2D } from "@/lib/generate2DFrames";
import SponsorCard from "@/components/SponsorCard";
import PluginInstall from "@/components/PluginInstall";
import GitHubMark from "@/components/GitHubMark";
import { AUTHOR_NAME, AUTHOR_SITE_URL, GITHUB_REPO_URL } from "@/lib/links";
import SiteFooter from "@/components/SiteFooter";

/**
 * The hero animation, drawn rather than fetched.
 *
 * Same drawFrame2D the product itself uses, on a canvas, for no network requests - cheap
 * enough to run on a phone as well as a desktop.
 */
const HERO_STYLE: Style2D = "gradient";
/** The Chromatic preset's own palette, so the hero shows a real one from the catalogue. */
const HERO_COLORS: [string, string, string] = ["#8b5cf6", "#c026d3", "#12031a"];

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const subscribeReducedMotion = (onChange: () => void) => {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const getReducedMotionSnapshot = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;
const getReducedMotionServerSnapshot = () => false;

export interface FeaturedPreset {
  name: string;
  category: string;
  style: Style2D;
  colors: [string, string, string];
}

const pipeline = (presetCount: number) => [
  { step: "01", title: "Pick a preset", desc: `Choose from ${presetCount} production-ready templates across SaaS, agency, e-commerce, and more.` },
  { step: "02", title: "Pick a template", desc: "Browse ready-made scroll sites by category and open the one closest to what you want." },
  { step: "03", title: "Frames render in your browser", desc: "The template's palette and style are drawn to canvas locally — instant, and nothing leaves your machine." },
  { step: "04", title: "Tune colors & sections", desc: "Adjust the palette, frame count, and section content live in the editor — no rerendering, no waiting." },
  { step: "05", title: "Scroll engine maps frames", desc: "The rendered frames are mapped to scroll position automatically — 10–40 FPS, no WebGL." },
  { step: "06", title: "Deploy as HTML/CSS/JS", desc: "Download a production-ready ZIP and deploy to Vercel, Netlify, or any static host instantly." },
];

const FEATURES = [
  { icon: Sparkles, title: "2D Canvas Generation", desc: "Pick a style — gradient, geometric, particles, or wave. Frames generate in seconds, in-browser." },
  { icon: Zap, title: "Smooth Frame Playback", desc: "Canvas-based engine plays frames as you scroll. No WebGL, no external dependencies." },
  { icon: Play, title: "Scroll Engine", desc: "Canvas-based engine maps scroll to frames at 10–40 FPS. Works on every device." },
  { icon: Download, title: "One-Click Export", desc: "Production-ready HTML/CSS/JS ZIP. Deploy anywhere in under a minute." },
];


const FAQ = [
  { q: "Do I need to know how to code?", a: "Not at all. Pick a template, edit the copy and colours, and export. The result is pure HTML/CSS/JS you can deploy anywhere." },
  { q: "How does the scroll animation work?", a: "ScrollCraft generates 2D canvas frames in your browser, then a scroll engine displays the correct frame as you scroll. No WebGL, no external dependencies." },
  { q: "Can I use my own video?", a: "Yes. On the /create page you can upload your own MP4, MOV, or WebM and we'll extract frames from it and build the scroll around them." },
  { q: "Where can I host the exported site?", a: "Anywhere that serves static files — Vercel, Netlify, Cloudflare Pages, GitHub Pages, or your own server. Just unzip and upload." },
  { q: "How are the frames generated?", a: "Frames are rendered in your browser on canvas from the style and palette the template carries. Nothing is sent to a server, so it is instant and works offline." },
];

function HeroPreview() {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  return (
    <StylePreview
      style={HERO_STYLE}
      colors={HERO_COLORS}
      paused={reducedMotion}
      durationSec={9}
      maxProgress={0.55}
      className="w-full h-full"
    />
  );
}

export default function HomeClient({ presetCount, featured }: { presetCount: number; featured: FeaturedPreset[] }) {
  const PIPELINE = pipeline(presetCount);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  // Only the hovered featured card animates.
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <Navbar position="fixed" />

      {/* Hero */}
      <section className="relative px-6 pt-28 pb-20 lg:pt-32 lg:pb-28">
        <div className="absolute top-1/3 left-1/4 w-[700px] h-[700px] rounded-full bg-primary/8 blur-[140px] pointer-events-none" />
        <div className="absolute top-2/3 right-1/4 w-[300px] h-[300px] rounded-full bg-blue-500/6 blur-[100px] pointer-events-none" />

        {/* Two columns from lg up: the copy and the thing it describes, side by side. The
            demo used to sit 733px down a 900px viewport behind a fade, so a visitor read
            three paragraphs about a scroll animation before seeing one. */}
        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <Badge variant="outline" className="mb-6 border-primary/40 text-primary-ink bg-primary/10 px-4 py-1.5">
              <Sparkles className="w-3 h-3 mr-1.5" /> Ready-made templates · No code · Animated scroll
            </Badge>

            <h1 className="text-5xl sm:text-6xl xl:text-7xl font-black tracking-tighter mb-6 leading-[0.95]">
              Build cinematic{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400">
                scroll websites
              </span>{" "}
              in minutes
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
              Pick a style. ScrollCraft generates smooth animated canvas frames,
              and wires them up as a silky scroll experience, exported as pure HTML. No code.
            </p>

            <div className="flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-4">
              <Link href="/create">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base font-semibold shadow-lg shadow-primary/25">
                  Create your site <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="/presets">
                <Button size="lg" variant="outline" className="border-white/10 hover:bg-white/5 px-8 py-6 text-base">
                  Browse presets
                </Button>
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center lg:justify-start justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["No account", "Runs in your browser", "MIT licensed"].map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-primary-ink" /> {t}
                </div>
              ))}
            </div>
          </div>

          {/* The product, at first paint. */}
          <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60 bg-black/40">
            <HeroPreview />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/40 uppercase tracking-widest pointer-events-none">
              Live preview
            </div>
          </div>
        </div>
      </section>

      {/* Social proof strip */}
      <section className="py-10 border-y border-white/5 bg-white/2">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-center gap-8 text-muted-foreground text-sm">
          {["Up to 200 frames per site", "Sub-2s load time", "10–40 FPS", "Works on every device", "No WebGL required", "Deploy anywhere"].map((t) => (
            <div key={t} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              {t}
            </div>
          ))}
        </div>
      </section>

      {/* Pipeline */}
      <section className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 border-white/10">The pipeline</Badge>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter">
              From template to production<br />
              <span className="text-muted-foreground">in 6 steps</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {PIPELINE.map((p) => (
              <div key={p.step} className="relative p-6 rounded-2xl border border-white/8 bg-card hover:border-primary/20 transition-colors group">
                <div aria-hidden="true" style={{ "--ornament": `"${p.step}"` } as React.CSSProperties} className="sc-ornament text-5xl font-black text-white/4 group-hover:text-primary-ink/10 transition-colors mb-4 leading-none" />
                <h3 className="font-semibold mb-2">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-32 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 border-white/10">Core technology</Badge>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter">
              Everything you need.<br />
              <span className="text-muted-foreground">Nothing you don&apos;t.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="relative p-6 rounded-2xl border border-white/8 bg-card hover:border-primary/30 transition-colors group">
                <div aria-hidden="true" style={{ "--ornament": `"${i + 1}"` } as React.CSSProperties} className="sc-ornament absolute top-4 right-4 text-4xl font-black text-white/4 group-hover:text-primary-ink/8 transition-colors" />
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-primary-ink" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Presets showcase */}
      <section className="py-32 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between mb-12">
            <div>
              <Badge variant="outline" className="mb-4 border-white/10">{presetCount} presets & counting</Badge>
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter">Start from a preset</h2>
              <p className="text-muted-foreground mt-3 max-w-lg">
                Production-tested starters with finished scroll layouts, copy structure, and palettes.
              </p>
            </div>
            <Link href="/presets" aria-label="View all presets">
              <Button variant="outline" className="border-white/10 hover:bg-white/5 hidden md:flex">
                View all presets <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {featured.map((p) => (
              // Links to the preset itself — this previously dropped everyone on the
              // gallery index while the button read "Use preset".
              <Link key={p.name} href={`/create?template=${encodeURIComponent(p.name)}`}>
                <div
                  className="group relative rounded-2xl border border-white/8 overflow-hidden hover:border-white/20 transition-all hover:-translate-y-1 cursor-pointer"
                  onMouseEnter={() => setHoveredPreset(p.name)}
                  onMouseLeave={() => setHoveredPreset((h) => (h === p.name ? null : h))}
                >
                  <div className="aspect-video flex items-end p-5 relative bg-black">
                    <StylePreview
                      style={p.style}
                      colors={p.colors}
                      paused={hoveredPreset !== p.name}
                      className="absolute inset-0 w-full h-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="relative z-10">
                      <p className="font-bold text-white">{p.name}</p>
                      <p className="text-sm text-white/60">{p.category}</p>
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50">
                    <Button size="sm" className="bg-primary text-white">
                      Use preset <ArrowRight className="ml-1 w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/presets" aria-label="View all presets">
              <Button variant="outline" className="border-white/10 hover:bg-white/5 md:hidden">
                View all presets <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Who builds this */}
      <section className="py-28 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="outline" className="mb-4 border-white/10">Who builds this</Badge>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-5">
            One engineer, in the open.
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto mb-8">
            ScrollCraft is built and maintained by {AUTHOR_NAME}. There is no launch-day
            testimonial wall here yet, because there are no customers to quote yet — what
            there is instead is the whole source tree, the commit history, and an issue
            tracker you can read before you trust any of it.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="border-white/10 gap-2">
                <GitHubMark className="w-4 h-4" /> Read the source
              </Button>
            </a>
            <a href={AUTHOR_SITE_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="border-white/10">
                {AUTHOR_NAME}
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="py-32 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="outline" className="mb-5 border-white/10">Pricing</Badge>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4">
            Free.<br />
            <span className="text-muted-foreground">Genuinely.</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
            Every template, the editor and ZIP export cost nothing. No account, no card,
            no server holding your work hostage. It runs in your browser.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/create">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base font-semibold">
                Start building <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/templates">
              <Button size="lg" variant="outline" className="border-white/10 hover:bg-white/5 px-8 py-6 text-base">
                Browse templates
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-white/10">FAQ</Badge>
            <h2 className="text-3xl font-black tracking-tighter">Frequently asked</h2>
          </div>
          <div className="space-y-2">
            {FAQ.map((item, i) => (
              <div key={i} className="rounded-xl border border-white/8 bg-card overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-white/3 transition-colors"
                  aria-expanded={openFaq === i}
                  aria-controls={`faq-answer-${i}`}
                  id={`faq-question-${i}`}
                >
                  <span className="font-medium text-sm">{item.q}</span>
                  <span aria-hidden="true" className={`text-muted-foreground text-lg leading-none transition-transform flex-shrink-0 ${openFaq === i ? "rotate-45" : ""}`}>+</span>
                </button>
                {openFaq === i && (
                  <div
                    id={`faq-answer-${i}`}
                    role="region"
                    aria-labelledby={`faq-question-${i}`}
                    className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-white/5 pt-3"
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
      <section className="px-6 pb-6 max-w-5xl mx-auto">
        <PluginInstall />
      </section>

      {/* Open source */}
      <section className="px-6 pb-4 max-w-5xl mx-auto">
        <SponsorCard />
      </section>

      {/* Final CTA */}
      <section className="py-32 px-6 text-center border-t border-white/5">
        <div className="relative max-w-3xl mx-auto">
          <div className="absolute inset-0 rounded-3xl bg-primary/5 blur-3xl" />
          <div className="relative">
            <h2 className="text-5xl md:text-6xl font-black tracking-tighter mb-6">
              Ready to build?
            </h2>
            <p className="text-xl text-muted-foreground mb-10">
              No design skills. No code. Just pick a template and make it yours.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/create">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-10 py-7 text-lg font-semibold shadow-xl shadow-primary/30">
                  Start building <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="/templates">
                <Button size="lg" variant="outline" className="border-white/10 hover:bg-white/5 px-10 py-7 text-lg">
                  Browse templates
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
