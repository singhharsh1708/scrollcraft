"use client";
import Link from "next/link";
import { useState, useEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles, Zap, Download, Play, Check } from "lucide-react";
import Navbar from "@/components/Navbar";
import StylePreview from "@/components/StylePreview";
import { findPreset } from "@/lib/presets";

const DEMO_COUNT = 60;
const demoFrames = Array.from({ length: DEMO_COUNT }, (_, i) => `/api/demo-frame?i=${i}&total=${DEMO_COUNT}`);

// Mobile skips the hero autoplay so it never fires 60 concurrent frame requests (#156).
// Server-rendered as mobile so the initial HTML never references the frame URLs.
const MOBILE_HERO_QUERY = "(max-width: 767px)";
const subscribeMobileHero = (onChange: () => void) => {
  const mq = window.matchMedia(MOBILE_HERO_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const getMobileHeroSnapshot = () => window.matchMedia(MOBILE_HERO_QUERY).matches;
const getMobileHeroServerSnapshot = () => true;

const PIPELINE = [
  { step: "01", title: "Pick a preset", desc: "Choose from 12+ production-ready templates across SaaS, agency, e-commerce, and more." },
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

// Featured selection drawn from the shared catalogue rather than restated here — the
// local copy had already drifted (StackForge was "Dev Tool" against "Developer Tool",
// and the gradients no longer matched the gallery).
const FEATURED_PRESET_NAMES = ["OrbitCRM", "TripVault", "Shopnest", "VisionForge", "StackForge", "Meridian"];
const FEATURED_PRESETS = FEATURED_PRESET_NAMES
  .map((n) => findPreset(n))
  .filter((p): p is NonNullable<typeof p> => Boolean(p));

const TESTIMONIALS = [
  { name: "Isabella R.", location: "Italy", role: "E-commerce founder", quote: "Sales converted from day one. The animated scroll background made our product page feel like a luxury brand site overnight." },
  { name: "Arjun M.", location: "India", role: "Startup founder", quote: "Replaced a $4,000 agency quote with a 15-minute session. The output was honestly better than what they proposed." },
  { name: "Priya S.", location: "India", role: "Restaurant owner", quote: "Built my restaurant's full site in under 10 minutes. Customers keep asking who designed it." },
  { name: "Lukas B.", location: "Germany", role: "Indie developer", quote: "Launched my SaaS landing page before the weekend was over. The scroll animation is unlike anything I could have hand-coded." },
  { name: "Amara O.", location: "Ghana", role: "Consultant", quote: "My clients think I hired a design agency. I pick a template, change the copy, and export the ZIP." },
];

const FAQ = [
  { q: "Do I need to know how to code?", a: "Not at all. Pick a template, edit the copy and colours, and export. The result is pure HTML/CSS/JS you can deploy anywhere." },
  { q: "How does the scroll animation work?", a: "ScrollCraft generates 2D canvas frames in your browser, then a scroll engine displays the correct frame as you scroll. No WebGL, no external dependencies." },
  { q: "Can I use my own video?", a: "Yes. On the /create page you can upload your own MP4, MOV, or WebM and we'll extract frames from it and build the scroll around them." },
  { q: "Where can I host the exported site?", a: "Anywhere that serves static files — Vercel, Netlify, Cloudflare Pages, GitHub Pages, or your own server. Just unzip and upload." },
  { q: "How are the frames generated?", a: "Frames are rendered in your browser on canvas from the style and palette the template carries. Nothing is sent to a server, so it is instant and works offline." },
];

function HeroPreview() {
  const isMobileHero = useSyncExternalStore(
    subscribeMobileHero,
    getMobileHeroSnapshot,
    getMobileHeroServerSnapshot
  );
  const [heroFrameIdx, setHeroFrameIdx] = useState(0);
  // Cycle through demo frames automatically at ~10fps (no user scroll required).
  useEffect(() => {
    if (isMobileHero) return;
    let frame = 0;
    let last = 0;
    let rafId: number;
    const INTERVAL = 100; // ms per frame → ~10fps
    const tick = (ts: number) => {
      if (ts - last >= INTERVAL) {
        frame = (frame + 1) % DEMO_COUNT;
        setHeroFrameIdx(frame);
        last = ts;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isMobileHero]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={demoFrames[heroFrameIdx]}
        alt="ScrollCraft scroll animation preview"
        className="w-full aspect-video object-cover"
      />
    </>
  );
}

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  // Only the hovered featured card animates.
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <Navbar position="fixed" />

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center min-h-screen text-center px-6 pt-20">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-primary/8 blur-[140px] pointer-events-none" />
        <div className="absolute top-2/3 left-1/4 w-[300px] h-[300px] rounded-full bg-blue-500/6 blur-[100px] pointer-events-none" />

        {/* Product Hunt badge */}
        <a
          href="https://www.producthunt.com/posts/scrollcraft"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mb-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=scrollcraft&theme=dark"
            alt="ScrollCraft on Product Hunt"
            width={220}
            height={48}
          />
        </a>

        <Badge variant="outline" className="mb-6 border-primary/40 text-primary bg-primary/10 px-4 py-1.5">
          <Sparkles className="w-3 h-3 mr-1.5" /> Ready-made templates · No code · Animated scroll
        </Badge>

        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 leading-none">
          Build cinematic<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400">
            scroll websites
          </span><br />
          in minutes
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
          Pick a style. ScrollCraft generates smooth animated canvas frames,
          and wires them up as a silky scroll experience — exported as pure HTML. No code.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
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

        <div className="mt-6 flex items-center gap-6 text-sm text-muted-foreground">
          {["7-day free trial", "No credit card", "Deploy anywhere"].map((t) => (
            <div key={t} className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-primary" /> {t}
            </div>
          ))}
        </div>

        {/* Hero visual — live scroll demo (desktop only; mobile skips 60 concurrent requests) */}
        <div className="relative mt-16 w-full max-w-5xl mx-auto rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60">
          {/* Autoplay animation — owns its own frame state so the ~10fps loop re-renders
              only this image, not the whole landing page. */}
          <HeroPreview />
          {/* Fade-out at bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" style={{ zIndex: 2 }} />
          {/* Label */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/30 uppercase tracking-widest pointer-events-none" style={{ zIndex: 3 }}>
            Live preview
          </div>
        </div>
      </section>

      {/* Social proof strip */}
      <section className="py-10 border-y border-white/5 bg-white/2">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-center gap-8 text-muted-foreground text-sm">
          {["400+ frames per site", "Sub-2s load time", "10–40 FPS", "Works on every device", "No WebGL required", "Deploy anywhere"].map((t) => (
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
                <div className="text-5xl font-black text-white/4 group-hover:text-primary/10 transition-colors mb-4 leading-none">{p.step}</div>
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
                <div className="absolute top-4 right-4 text-4xl font-black text-white/4 group-hover:text-primary/8 transition-colors">{i + 1}</div>
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-primary" />
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
              <Badge variant="outline" className="mb-4 border-white/10">12 presets & counting</Badge>
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter">Start from a preset</h2>
              <p className="text-muted-foreground mt-3 max-w-lg">
                Production-tested starters with finished scroll layouts, copy structure, and palettes.
              </p>
            </div>
            <Link href="/presets">
              <Button variant="outline" className="border-white/10 hover:bg-white/5 hidden md:flex">
                View all presets <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURED_PRESETS.map((p) => (
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
            <Link href="/presets">
              <Button variant="outline" className="border-white/10 hover:bg-white/5 md:hidden">
                View all presets <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-32 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 border-white/10">From our users</Badge>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter">
              Real sites. Real results.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="p-6 rounded-2xl border border-white/8 bg-card flex flex-col gap-4">
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-3 border-t border-white/8">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role} · {t.location}</p>
                  </div>
                </div>
              </div>
            ))}
            {/* Filler CTA card */}
            <div className="p-6 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center text-center gap-3 bg-primary/3">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <p className="font-semibold">Your site could be next</p>
              <p className="text-xs text-muted-foreground">Build and launch in under 15 minutes</p>
              <Link href="/create">
                <Button size="sm" className="bg-primary text-white mt-1">Start free</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="py-32 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="outline" className="mb-5 border-white/10">Pricing</Badge>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4">
            Free to start.<br />
            <span className="text-muted-foreground">Scales with you.</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
            Every template is free on every plan. No card required. Upgrade only to keep more websites saved.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/create">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base font-semibold">
                Start free trial <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="border-white/10 hover:bg-white/5 px-8 py-6 text-base">
                View pricing
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
                >
                  <span className="font-medium text-sm">{item.q}</span>
                  <span className={`text-muted-foreground text-lg leading-none transition-transform flex-shrink-0 ${openFaq === i ? "rotate-45" : ""}`}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-white/5 pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
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
                  Start for free <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="border-white/10 hover:bg-white/5 px-10 py-7 text-lg">
                  See pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-primary" />
                </div>
                <span className="font-semibold">ScrollCraft</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Ready-made cinematic scroll templates with animated canvas backgrounds. Ship a site in minutes.</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Product</p>
              <div className="space-y-2.5">
                {[["Features", "/#features"], ["Presets", "/presets"], ["Pricing", "/pricing"], ["Builder", "/create"]].map(([label, href]) => (
                  <Link key={label} href={href} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">{label}</Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Company</p>
              <div className="space-y-2.5">
                {[["About", "/about"], ["Blog", "/changelog"], ["Changelog", "/changelog"], ["Contact", "/contact"]].map(([label, href]) => (
                  <Link key={label} href={href} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">{label}</Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Legal</p>
              <div className="space-y-2.5">
                {[["Privacy Policy", "/privacy"], ["Terms of Service", "/terms"], ["Cookie Policy", "/cookies"]].map(([label, href]) => (
                  <Link key={label} href={href} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">{label}</Link>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/5 gap-4">
            <p className="text-xs text-muted-foreground">© 2026 ScrollCraft. All rights reserved.</p>
            <p className="text-xs text-muted-foreground">Built with Next.js</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
