"use client";
import { useEffect, useRef, useState, use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Layers, Loader2 } from "lucide-react";
import ScrollEngine from "@/components/ScrollEngine";
import { generate2DFrames } from "@/lib/generate2DFrames";
import { loadFrames, storeFrames } from "@/lib/frameStorage";
import { templateBySlug, templateScrollHeight } from "@/lib/templates";
import { LAYOUT_STYLES } from "@/lib/layoutStyles";

export default function TemplatePreview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const template = templateBySlug(slug);

  const [frames, setFrames] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const generatedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!template) return;
    const cacheKey = `scrollcraft_template_${slug}`;
    if (generatedKey.current === cacheKey) return;
    generatedKey.current = cacheKey;

    const isMobileViewport = window.innerWidth < 768;
    const frameCount = isMobileViewport ? 60 : 90;
    const width = isMobileViewport ? 640 : 1280;
    const height = isMobileViewport ? 360 : 720;

    let cancelled = false;
    const show = (f: string[]) => {
      if (cancelled) return;
      setFrames(f);
      setProgress(100);
      setReady(true);
    };

    loadFrames(cacheKey)
      .catch(() => null)
      .then((cached) => {
        if (cancelled) return;
        if (cached && cached.length) {
          show(cached);
          return;
        }
        return generate2DFrames(
          {
            style: template.style,
            color1: template.colors[0],
            color2: template.colors[1],
            color3: template.colors[2],
            frameCount, width, height,
          },
          (p) => { if (!cancelled) setProgress(Math.round(p)); }
        ).then((generated) => {
          show(generated);
          return storeFrames(cacheKey, generated).catch(() => {});
        });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => { cancelled = true; };
  }, [template, slug]);

  if (!template) {
    notFound();
  }

  const totalScrollHeight = templateScrollHeight(template);
  const theme = template.theme;
  const visible = template.sections.filter((s) => s.visible !== false);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: "#000",
        color: theme.ink ?? "#fff",
        ["--sc-accent" as string]: theme.accent ?? "#7c3aed",
        ["--sc-accent-text" as string]: theme.accentText ?? "#ede9fe",
        ["--sc-muted" as string]: theme.muted ?? "rgba(255,255,255,0.72)",
      }}
    >
      {!ready && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6"
          style={{ background: `linear-gradient(135deg, ${template.colors[2]}, #000)` }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Layers className="w-4 h-4" style={{ color: theme.accentText ?? "#fff" }} />
            </div>
            <span className="font-bold text-lg">{template.name}</span>
          </div>
          <div className="w-56 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{ width: `${progress}%`, background: theme.accentText ?? "#fff" }}
            />
          </div>
          {error ? (
            <div className="flex flex-col items-center gap-3 text-sm text-white/60">
              <p>Couldn&apos;t build this preview in your browser.</p>
              <Button
                size="sm"
                variant="outline"
                className="border-white/20 bg-white/10 hover:bg-white/20"
                onClick={() => window.location.reload()}
              >
                Try again
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-white/40">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Rendering frames…
            </div>
          )}
        </div>
      )}

      <ScrollEngine
        frames={frames}
        totalScrollHeight={totalScrollHeight}
        altText={`Animated ${template.style} background for the ${template.name} template`}
      />

      <div className="fixed top-4 left-4 right-4 z-40 flex items-center justify-between gap-3 pointer-events-none">
        <Link href="/templates" className="pointer-events-auto">
          <Button size="sm" variant="outline" className="border-white/15 bg-black/50 backdrop-blur h-8 text-xs gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Templates
          </Button>
        </Link>
        <Link href={`/editor?template=${template.slug}`} className="pointer-events-auto">
          <Button size="sm" className="h-8 text-xs gap-1.5">
            Use this template <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>

      <div className="relative z-10 pointer-events-none" style={{ height: totalScrollHeight }}>
        <div style={{ height: "100vh" }} />
        {visible.map((s, i) => {
          const L = LAYOUT_STYLES[s.layout ?? "center"] ?? LAYOUT_STYLES.center;
          if (s.kind === "spacer") {
            return <section key={i} aria-hidden="true" style={{ height: s.scrollHeight ?? 1000 }} />;
          }
          return (
            <section key={i} style={{ height: s.scrollHeight ?? 1000, position: "relative" }}>
              <div
                style={{
                  position: "sticky", top: 0, height: "100vh", display: "flex",
                  alignItems: s.align ?? L.align,
                  justifyContent: s.justify ?? L.justify,
                  overflow: "hidden",
                }}
              >
                <div
                  className="pointer-events-auto"
                  style={{ textAlign: (s.textAlign ?? L.textAlign) as "left" | "center" | "right", padding: L.pad, maxWidth: L.maxWidth }}
                >
                  {s.eyebrow && (
                    <p style={{
                      fontSize: "0.875rem", fontWeight: 600, letterSpacing: "0.1em",
                      textTransform: "uppercase", color: s.accentColor ?? theme.accentText ?? "#ede9fe",
                      marginBottom: "0.75rem",
                    }}>{s.eyebrow}</p>
                  )}
                  {s.heading && (
                    <h2 style={{
                      fontSize: s.kind === "statement" ? "clamp(2.75rem,11vw,9rem)" : "clamp(2rem,5vw,4rem)",
                      fontWeight: theme.displayWeight ?? 900,
                      lineHeight: s.kind === "statement" ? 0.92 : 1,
                      letterSpacing: `${theme.displayTracking ?? -0.03}em`,
                      textTransform: theme.displayCase === "upper" ? "uppercase" : "none",
                      color: s.headingColor ?? theme.ink ?? "#fff",
                      marginBottom: "1rem",
                    }}>{s.heading}</h2>
                  )}
                  {s.body && (
                    <p style={{
                      fontSize: "1.125rem", lineHeight: 1.7,
                      color: s.bodyColor ?? theme.muted ?? "rgba(255,255,255,0.72)",
                      maxWidth: 600,
                      margin: (s.textAlign ?? L.textAlign) === "center" ? "0 auto 1.5rem" : "0 0 1.5rem",
                    }}>{s.body}</p>
                  )}
                  {s.ctaLabel && (
                    <span style={{
                      display: "inline-block", background: s.accentColor ?? theme.accent ?? "#7c3aed",
                      color: "#fff", padding: "0.875rem 2rem",
                      borderRadius: theme.radius ?? 8, fontWeight: 600, fontSize: "1rem",
                    }}>{s.ctaLabel}</span>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
