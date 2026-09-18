"use client";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { Space_Grotesk } from "next/font/google";
import { drawFrame2D, type Style2D } from "@/lib/generate2DFrames";

// TripVault's own display face, so the demo reads as somebody else's site inside this one.
// Next serves it from this origin, one weight. Change it with HERO_SLUG in page.tsx.
const display = Space_Grotesk({ subsets: ["latin"], weight: "700", display: "swap" });

export type HeroTemplate = {
  slug: string;
  name: string;
  style: Style2D;
  colors: [string, string, string];
  ink: string;
  muted: string;
  scenes: { eyebrow: string; heading: string }[];
};

/** Share of the track over which the screen grows from a card to the whole viewport. It
 * waits until the page's own copy has mostly cleared, so the two never overlap. */
const GROW_START = 0.06;
const GROW_END = 0.42;
/**
 * The part of the style's range the scroll plays. Every palette lerps toward its dark
 * third colour, so the end of the range is a black screen.
 */
const CANVAS_FROM = 0.04;
const CANVAS_SPAN = 0.36;
/** When each of the template's sections is on screen, as [in-start, in-end, out-start, out-end]. */
const SCENE_WINDOWS: [number, number, number, number][] = [
  [-1, -1, 0.52, 0.58],
  [0.58, 0.64, 0.76, 0.82],
  [0.82, 0.88, 2, 2],
];

/** Most pixels the canvas redraws per frame. */
const PIXEL_BUDGET = 1_000_000;

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const band = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

type Rect = { x: number; y: number; w: number; h: number };

/**
 * Where the screen sits before the visitor scrolls. On a wide screen it is larger than its
 * column and runs past the right edge, angled away; on a phone it sits below the copy.
 */
function cardRect(W: number, H: number): Rect {
  if (W >= 1024) {
    const container = Math.min(W, 1360);
    const inner = container - 48;
    const w = Math.min(inner * 0.6, (H - 150) * 1.6);
    const h = w / 1.6;
    return { x: (W - container) / 2 + 24 + inner - w * 0.9, y: (H - h) / 2 + 30, w, h };
  }
  const w = W - 48;
  const h = w / 1.6;
  return { x: 24, y: H - h - 36, w, h };
}

/**
 * The landing page's hero performs the product on itself.
 *
 * A template's screen sits beside the headline. Scrolling pins the stage, grows the
 * screen until it fills the viewport, scrubs its background with the scroll, and steps
 * through the template's own sections. It is the same drawFrame2D and the same catalogue
 * entry the template gallery uses, drawn in the visitor's browser, so there is nothing
 * to download and nothing that can drift from the real template.
 */
export default function HeroSequence({
  template,
  templateCount,
  reducedMotion,
  children,
}: {
  template: HeroTemplate;
  templateCount: number;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  const trackRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const sceneRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    const screen = screenRef.current;
    const canvas = canvasRef.current;
    const box = boxRef.current;
    const copy = copyRef.current;
    const caption = captionRef.current;
    const ctx = canvas?.getContext("2d");
    if (!track || !stage || !screen || !canvas || !box || !copy || !caption || !ctx) return;

    const opts = { style: template.style, color1: template.colors[0], color2: template.colors[1], color3: template.colors[2], frameCount: 1 };
    let W = 0;
    let H = 0;
    let lastQ = -1;
    let raf = 0;

    const resize = () => {
      W = stage.clientWidth;
      H = stage.clientHeight;
      // Soft shapes upscale cleanly, so the backing store is held to about a million pixels.
      // Capping only the width let a 3x portrait phone draw 1170x2532 every frame, which
      // measured at 30fps; the budget keeps it near 60.
      const scale = Math.min(window.devicePixelRatio || 1, Math.sqrt(PIXEL_BUDGET / Math.max(W * H, 1)));
      canvas.width = Math.round(W * scale);
      canvas.height = Math.round(H * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      lastQ = -1;
    };

    const apply = () => {
      raf = 0;
      const travel = Math.max(1, track.offsetHeight - H);
      const p = reducedMotion ? 0 : clamp(-track.getBoundingClientRect().top / travel);
      const g = ease(band(p, GROW_START, GROW_END));
      const c = cardRect(W, H);
      const r = { x: c.x * (1 - g), y: c.y * (1 - g), w: c.w + (W - c.w) * g, h: c.h + (H - c.h) * g };

      screen.style.clipPath = `inset(${r.y}px ${W - r.x - r.w}px ${H - r.y - r.h}px ${r.x}px round ${18 * (1 - g)}px)`;
      screen.style.transformOrigin = `${r.x + r.w / 2}px ${r.y + r.h / 2}px`;
      // Angled away while it is a card, facing the visitor by the time it fills the screen.
      const tilt = W >= 1024 ? 1 - g : 0;
      screen.style.transform = `perspective(${Math.round(W * 1.1)}px) rotateY(${-18 * tilt}deg) rotateX(${6 * tilt}deg) rotate(${-2 * (1 - g)}deg)`;
      screen.style.opacity = "1";

      // The canvas is drawn at the size of the viewport and scaled into the card, so the
      // card is a miniature of the whole screen rather than a crop of one edge of it.
      const s = Math.max(r.w / W, r.h / H);
      canvas.style.transform = `translate(${r.x + r.w / 2 - W / 2}px, ${r.y + r.h / 2 - H / 2}px) scale(${s})`;

      box.style.left = `${r.x}px`;
      box.style.top = `${r.y}px`;
      box.style.width = `${r.w}px`;
      box.style.height = `${r.h}px`;
      box.style.fontSize = `${clamp(Math.max(r.w * 0.068, r.h * 0.05), 16, 108)}px`;

      const fade = 1 - band(p, 0, 0.09);
      copy.style.opacity = String(fade);
      copy.style.transform = `translateX(${-48 * (1 - fade)}px)`;
      copy.style.pointerEvents = fade < 0.5 ? "none" : "";

      SCENE_WINDOWS.forEach(([ia, ib, oa, ob], i) => {
        const el = sceneRefs.current[i];
        if (!el) return;
        const inO = ia < 0 ? 1 : band(p, ia, ib);
        const outO = oa > 1 ? 1 : 1 - band(p, oa, ob);
        const o = Math.min(inO, outO);
        el.style.opacity = String(o);
        el.style.transform = `translateY(${(1 - inO) * 24}px)`;
      });

      const cap = band(p, 0.9, 0.97);
      caption.style.opacity = String(cap);
      caption.style.pointerEvents = cap > 0.5 ? "" : "none";

      const q = CANVAS_FROM + CANVAS_SPAN * p;
      if (Math.abs(q - lastQ) > 0.0015) {
        drawFrame2D(ctx, W, H, q, opts);
        lastQ = q;
      }
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    resize();
    apply();
    const observer = new ResizeObserver(() => {
      resize();
      apply();
    });
    observer.observe(stage);
    if (!reducedMotion) window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      cancelAnimationFrame(raf);
    };
  }, [template, reducedMotion]);

  return (
    <section ref={trackRef} className="relative -mt-[76px]" style={{ height: reducedMotion ? undefined : "280svh" }}>
      <div
        ref={stageRef}
        className={`${reducedMotion ? "relative" : "sticky top-0"} h-svh min-h-[600px] overflow-hidden bg-background`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_72%_52%,rgba(17,82,107,0.32),transparent_70%)] max-lg:bg-[radial-gradient(ellipse_80%_40%_at_50%_80%,rgba(17,82,107,0.32),transparent_70%)]"
        />

        {/* The template: a full-viewport canvas clipped to a card, then let out. */}
        <div
          ref={screenRef}
          aria-hidden="true"
          className="absolute inset-0 opacity-0 shadow-[0_50px_120px_-40px_rgba(0,0,0,0.95)] transition-opacity duration-500"
          style={{ background: template.colors[2], clipPath: "inset(100% 0 0 0)" }}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full origin-center" />
          <div ref={boxRef} className="absolute flex items-center justify-center text-center">
            {template.scenes.slice(0, SCENE_WINDOWS.length).map((s, i) => (
              <div
                key={i}
                ref={(el) => {
                  sceneRefs.current[i] = el;
                }}
                className="absolute inset-x-[8%] flex flex-col items-center"
                style={{ opacity: i === 0 ? 1 : 0 }}
              >
                <p
                  className="mb-[0.7em] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: template.muted, fontSize: "max(10px, 0.24em)" }}
                >
                  {s.eyebrow}
                </p>
                <p
                  className={`${display.className} leading-[1.02] tracking-[-0.035em]`}
                  style={{ color: template.ink, fontSize: i === 0 ? "1em" : "0.68em" }}
                >
                  {s.heading}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* The page's own copy, which steps aside as the template takes over. */}
        <div className="relative z-10 mx-auto grid h-full w-full max-w-[1360px] grid-cols-1 px-6 pt-[76px] lg:grid-cols-2 lg:items-center">
          <div ref={copyRef} className="flex flex-col items-start pt-10 sm:pt-16 lg:pt-0">
            {children}
          </div>
        </div>

        <div
          ref={captionRef}
          className="absolute inset-x-0 bottom-8 z-10 flex justify-center px-6 opacity-0"
          style={{ pointerEvents: "none" }}
        >
          <p className="max-w-xl rounded-2xl border border-white/15 bg-black/55 px-5 py-3 text-center text-sm leading-relaxed text-white/90 backdrop-blur-md">
            That was {template.name}, one of {templateCount} templates, drawn live in your browser as you
            scrolled.{" "}
            <Link href={`/templates/${template.slug}`} className="whitespace-nowrap font-medium text-white underline underline-offset-4">
              Open it
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
