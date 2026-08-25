"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Layers, Loader2 } from "lucide-react";
import ScrollEngine from "@/components/ScrollEngine";
import { generate2DFrames } from "@/lib/generate2DFrames";
import { loadFrames, storeFrames } from "@/lib/frameStorage";
import { layoutStyle } from "@/lib/layoutStyles";
import { compileTheme } from "@/lib/themeCss";
import type { Section, SiteStyle, Theme } from "@/lib/siteSchema";

const INTRO_BUFFER = 1000;

export interface SiteRendererProps {
  name: string;
  sections: Section[];
  theme?: Theme | null;
  /** Background recipe: frames are regenerated in the visitor's browser. */
  styleSpec?: SiteStyle | null;
  /** Pre-rendered frames by URL; wins over styleSpec when present. */
  frameUrls?: string[] | null;
  /** IndexedDB key for regenerated frames, so a revisit is instant. Omit to skip caching. */
  cacheKey?: string | null;
  /** Sanitised site CSS. The caller sanitises; this component only injects. */
  customCss?: string;
  /** "Made with ScrollCraft" corner badge, shown on free-plan published pages. */
  badge?: boolean;
  /** Fixed chrome rendered above the site (back links, CTAs). */
  children?: React.ReactNode;
}

export default function SiteRenderer({
  name,
  sections,
  theme = null,
  styleSpec = null,
  frameUrls = null,
  cacheKey = null,
  customCss = "",
  badge = false,
  children,
}: SiteRendererProps) {
  const [frames, setFrames] = useState<string[]>(frameUrls ?? []);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(Boolean(frameUrls?.length));
  const [error, setError] = useState(false);
  const startedKey = useRef<string | null>(null);

  const compiled = compileTheme(theme);
  const visible = sections.filter((s) => s.visible !== false);
  const totalScrollHeight =
    visible.reduce((acc, s) => acc + (s.scrollHeight ?? 1000), 0) + INTRO_BUFFER;

  useEffect(() => {
    if (frameUrls?.length || !styleSpec) return;
    const key = cacheKey ?? `nocache-${name}`;
    if (startedKey.current === key) return;
    startedKey.current = key;

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

    (cacheKey ? loadFrames(cacheKey).catch(() => null) : Promise.resolve(null))
      .then((cached) => {
        if (cancelled) return;
        if (cached && cached.length) {
          show(cached);
          return;
        }
        return generate2DFrames(
          {
            style: styleSpec.style,
            color1: styleSpec.colors[0],
            color2: styleSpec.colors[1],
            color3: styleSpec.colors[2],
            frameCount, width, height,
          },
          (p) => { if (!cancelled) setProgress(Math.round(p)); }
        ).then((generated) => {
          show(generated);
          if (cacheKey) return storeFrames(cacheKey, generated).catch(() => {});
        });
      })
      .catch(() => { if (!cancelled) setError(true); });

    return () => { cancelled = true; };
  }, [frameUrls, styleSpec, cacheKey, name]);

  const ink = compiled.vars["--sc-ink"] ?? "#fff";
  const loaderGround = styleSpec?.colors[2] ?? "#05070c";

  return (
    <div
      className="relative"
      style={{
        background: compiled.vars["--sc-ground"] ?? "#000",
        overflowX: "clip",
        color: ink,
        fontFamily: compiled.fontBody
          ? `'${compiled.fontBody}', system-ui, sans-serif`
          : undefined,
        ...compiled.vars,
      }}
    >
      {compiled.fontHref && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={compiled.fontHref} />
        </>
      )}
      {customCss ? <style dangerouslySetInnerHTML={{ __html: customCss }} /> : null}

      {!ready && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6"
          style={{ background: `linear-gradient(135deg, ${loaderGround}, #000)` }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Layers className="w-4 h-4" style={{ color: compiled.vars["--sc-accent-text"] ?? "#fff" }} />
            </div>
            <span className="font-bold text-lg">{name}</span>
          </div>
          <div className="w-56 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{ width: `${progress}%`, background: compiled.vars["--sc-accent-text"] ?? "#fff" }}
            />
          </div>
          {error ? (
            <div className="flex flex-col items-center gap-3 text-sm text-white/60">
              <p>Couldn&apos;t build this page in your browser.</p>
              <Button
                size="sm" variant="outline"
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
        altText={`Animated background for ${name}`}
      />

      {children}

      <div className="relative z-10 pointer-events-none" style={{ height: totalScrollHeight }}>
        <div style={{ height: "100vh" }} />
        {visible.map((s, i) => {
          const L = layoutStyle(s.layout);
          const align = (s.textAlign ?? L.textAlign) as "left" | "center" | "right";
          const stack = align === "center" ? "0 auto 1.5rem" : "0 0 1.5rem";
          if (s.kind === "spacer") {
            return (
              <section
                key={i} aria-hidden="true"
                data-sc-section={i} data-sc-kind="spacer"
                style={{ height: s.scrollHeight ?? 1000 }}
              />
            );
          }
          return (
            <section
              key={i}
              data-sc-section={i} data-sc-kind={s.kind ?? "text"}
              style={{ height: s.scrollHeight ?? 1000, position: "relative" }}
            >
              <div
                style={{
                  position: "sticky", top: 0, height: "100vh", display: "flex",
                  alignItems: s.align ?? L.align,
                  justifyContent: s.justify ?? L.justify,
                  overflow: "hidden",
                }}
              >
                <div className="pointer-events-auto" style={{ textAlign: align, padding: L.pad, maxWidth: L.maxWidth }}>
                  {s.eyebrow && (
                    <p style={{
                      fontSize: "0.875rem", fontWeight: 600, letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: s.accentColor ?? "var(--sc-accent-text, #ede9fe)",
                      marginBottom: "0.75rem",
                    }}>{s.eyebrow}</p>
                  )}
                  {s.heading && (
                    <h2 style={{
                      fontFamily: "var(--sc-font-display, var(--sc-font-body, inherit))",
                      fontSize: s.kind === "statement"
                        ? "clamp(2.75rem,11vw,9rem)"
                        : "var(--sc-heading-size, clamp(2rem,5vw,4rem))",
                      fontWeight: "var(--sc-display-weight, 900)" as unknown as number,
                      lineHeight: s.kind === "statement" ? 0.92 : 1,
                      letterSpacing: "var(--sc-display-tracking, -0.03em)",
                      textTransform: "var(--sc-display-case, none)" as "none" | "uppercase",
                      color: s.headingColor ?? "var(--sc-ink, #fff)",
                      marginBottom: "1rem",
                    }}>{s.heading}</h2>
                  )}
                  {s.body && (
                    <p style={{
                      fontSize: "var(--sc-body-size, 1.125rem)", lineHeight: 1.7,
                      color: s.bodyColor ?? "var(--sc-muted, rgba(255,255,255,0.72))",
                      maxWidth: "var(--sc-measure, 600px)",
                      margin: stack,
                    }}>{s.body}</p>
                  )}
                  {s.ctaLabel && (
                    <span style={{
                      display: "inline-block",
                      background: s.accentColor ?? "var(--sc-accent, #7c3aed)",
                      color: "#fff", padding: "0.875rem 2rem",
                      borderRadius: "var(--sc-radius, 8px)", fontWeight: 600, fontSize: "1rem",
                    }}>{s.ctaLabel}</span>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {badge && (
        <Link
          href="/"
          className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-xs text-white/80 backdrop-blur hover:text-white"
        >
          <Layers className="w-3 h-3" /> Made with ScrollCraft
        </Link>
      )}
    </div>
  );
}
