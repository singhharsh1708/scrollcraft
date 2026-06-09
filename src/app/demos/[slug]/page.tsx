"use client";
import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowLeft, ArrowRight, Loader2, ExternalLink } from "lucide-react";
import ScrollEngine from "@/components/ScrollEngine";
import { generate2DFrames } from "@/lib/generate2DFrames";
import { DEMO_SITES } from "@/lib/demoSites";

const TOTAL_SCROLL = 4600; // 3 sections × 1200 + 1000 intro buffer

export default function DemoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const demo = DEMO_SITES.find((d) => d.slug === slug);

  const [frames, setFrames] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const generatedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!demo) return;
    const cacheKey = `scrollcraft_demo_${slug}`;
    if (generatedKey.current === cacheKey) return;
    generatedKey.current = cacheKey;

    // Reduce resolution on mobile to avoid CPU strain (#157)
    const isMobileViewport = window.innerWidth < 768;
    const frameCount = isMobileViewport ? 60 : 90;
    const width = isMobileViewport ? 640 : 1280;
    const height = isMobileViewport ? 360 : 720;

    // Use sessionStorage cache so revisiting is instant.
    // Defer setState to avoid react-hooks/set-state-in-effect warning (#149).
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        Promise.resolve(JSON.parse(cached) as string[]).then((f) => {
          setFrames(f);
          setProgress(100);
          setReady(true);
        });
        return;
      }
    } catch {
      // sessionStorage full or unavailable — fall through to regenerate
    }

    generate2DFrames(
      { style: demo.style, color1: demo.color1, color2: demo.color2, color3: demo.color3, frameCount, width, height },
      (p) => setProgress(Math.round(p))
    ).then((generated) => {
      setFrames(generated);
      setProgress(100);
      setReady(true);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(generated));
      } catch {
        // quota exceeded — not critical, frames are in memory
      }
    });
  }, [demo, slug]);

  if (!demo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-center px-6">
        <div>
          <p className="text-2xl font-bold mb-2">Demo not found</p>
          <p className="text-muted-foreground mb-6">That demo doesn&apos;t exist (yet).</p>
          <Link href="/showcase">
            <Button variant="outline">Back to showcase</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-black text-white overflow-hidden">
      {/* Loading screen */}
      {!ready && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6"
          style={{ background: `linear-gradient(135deg, ${demo.color3}, #000)` }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4" style={{ color: demo.accentColor }} />
            </div>
            <span className="font-bold text-lg">{demo.name}</span>
          </div>
          <div className="w-56 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{ width: `${progress}%`, background: demo.accentColor }}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-white/40">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Generating frames… {progress}%
          </div>
        </div>
      )}

      {/* Sticky nav bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-3 bg-black/60 backdrop-blur-xl border-b border-white/8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back to showcase</span>
        </button>
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: demo.accentColor }}
          />
          <span className="font-semibold text-sm">{demo.name}</span>
          <span className="text-xs text-white/40 ml-1 hidden sm:inline">{demo.category}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/create?template=${encodeURIComponent(demo.name)}&prompt=${encodeURIComponent(demo.tagline)}`}>
            <Button
              size="sm"
              className="text-xs h-7 px-3"
              style={{ background: demo.accentColor, color: "#000" }}
            >
              Use this <ArrowRight className="ml-1 w-3 h-3" />
            </Button>
          </Link>
          <Link href="/showcase">
            <Button size="sm" variant="ghost" className="text-xs h-7 px-3 text-white/60 hover:text-white">
              <ExternalLink className="w-3 h-3 mr-1" /> All demos
            </Button>
          </Link>
        </div>
      </div>

      {/* Scroll container — window handles scroll, this div just provides the scroll height */}
      <div
        className="relative"
        style={{ height: TOTAL_SCROLL }}
      >
        {/* Canvas background — fixed, driven by window scroll (#148) */}
        {ready && (
          <ScrollEngine
            frames={frames}
            totalScrollHeight={TOTAL_SCROLL}
            position="fixed"
            className="fixed inset-0"
          />
        )}

        {/* Hero intro */}
        <div style={{ position: "sticky", top: 0, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, pointerEvents: "none" }}>
          <div className="text-center px-6 max-w-3xl">
            <p
              className="text-sm font-semibold uppercase tracking-widest mb-4 opacity-80"
              style={{ color: demo.accentColor }}
            >
              {demo.category} · ScrollCraft Demo
            </p>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none mb-6">
              {demo.name}
            </h1>
            <p className="text-lg md:text-xl text-white/60 max-w-lg mx-auto">
              {demo.tagline}
            </p>
            <div className="mt-10 flex items-center justify-center gap-2 text-white/30 text-xs animate-bounce">
              <span>Scroll to explore</span>
              <ArrowRight className="w-3 h-3 rotate-90" />
            </div>
          </div>
        </div>

        {/* Content sections */}
        {demo.sections.map((section, i) => (
          <div key={i} style={{ position: "relative", height: section.scrollHeight, zIndex: 10 }}>
            <div
              style={{
                position: "sticky",
                top: 0,
                height: "100vh",
                display: "flex",
                alignItems: section.align,
                justifyContent: section.justify,
                padding: "2rem",
                overflow: "hidden",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  textAlign: section.textAlign,
                  maxWidth: 640,
                  pointerEvents: "auto",
                }}
                className="section-content"
              >
                <p
                  className="text-xs font-semibold uppercase tracking-widest mb-4"
                  style={{ color: section.accentColor }}
                >
                  {section.eyebrow}
                </p>
                <h2
                  className="font-black tracking-tighter leading-none mb-5"
                  style={{ fontSize: "clamp(2rem,5vw,3.5rem)" }}
                >
                  {section.heading}
                </h2>
                <p className="text-white/60 leading-relaxed mb-6" style={{ fontSize: "1.0625rem" }}>
                  {section.body}
                </p>
                {section.cta && (
                  <Link href="/create">
                    <button
                      className="px-6 py-3 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
                      style={{ background: section.accentColor, color: "#000" }}
                    >
                      {section.cta}
                    </button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* End card */}
        <div style={{ position: "sticky", top: 0, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
          <div className="text-center px-6 max-w-2xl">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-6 flex items-center justify-center border border-white/15" style={{ background: `${demo.accentColor}22` }}>
              <Sparkles className="w-6 h-6" style={{ color: demo.accentColor }} />
            </div>
            <p className="text-sm font-semibold uppercase tracking-widest mb-3 text-white/40">
              Built with ScrollCraft
            </p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-5">
              Create yours in 2 minutes.
            </h2>
            <p className="text-white/50 mb-8">
              Start from this preset or describe your own vision. No design skills needed.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href={`/create?template=${encodeURIComponent(demo.name)}`}>
                <Button
                  size="lg"
                  className="px-8 py-5 font-semibold text-sm"
                  style={{ background: demo.accentColor, color: "#000" }}
                >
                  Use {demo.name} preset <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link href="/showcase">
                <Button size="lg" variant="outline" className="border-white/15 px-8 py-5 text-sm">
                  See all demos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .section-content {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                      transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .section-content.visible {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>

      <IntersectionDriver />
    </div>
  );
}

function IntersectionDriver() {
  useEffect(() => {
    const els = document.querySelectorAll(".section-content");
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
          else e.target.classList.remove("visible");
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
  return null;
}
