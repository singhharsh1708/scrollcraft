"use client";
import { useEffect, useRef, useState } from "react";
import { drawFrame2D, type Style2D } from "@/lib/generate2DFrames";

interface StylePreviewProps {
  style: Style2D;
  colors: [string, string, string];
  /** Animation loop length in seconds (default 6s) */
  durationSec?: number;
  /** Pause the rAF loop to save CPU (e.g. when off-screen / not selected) */
  paused?: boolean;
  /**
   * Upper bound of the scrubbed range, 0..1.
   *
   * Every style lerps toward its third colour as progress rises, and most palettes end
   * near black because that is what a scroll background does under the closing sections.
   * A preview that has to look good in isolation can stop short of that.
   */
  maxProgress?: number;
  className?: string;
}

type FrameOptions = Parameters<typeof drawFrame2D>[4];

/**
 * Where a preview rests while it is not animating: the brightest of a few points across
 * its loop, measured once per style and palette on a small offscreen canvas and cached.
 *
 * Frame 0 is where every style starts and, for about half the catalogue, it is close to
 * black. Measured on the live templates gallery, nine of the 21 cards had a mean luma
 * under 4 out of 255 while they waited to be hovered.
 */
const REST_CACHE = new Map<string, number>();
const REST_CANDIDATES = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9];

function restingProgress(opts: FrameOptions, maxProgress: number): number {
  const key = `${opts.style}|${opts.color1}|${opts.color2}|${opts.color3}|${maxProgress}`;
  const cached = REST_CACHE.get(key);
  if (cached !== undefined) return cached;
  let best = 0;
  if (typeof document !== "undefined") {
    const probe = document.createElement("canvas");
    probe.width = 64;
    probe.height = 40;
    const ctx = probe.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      let brightest = -1;
      for (const f of REST_CANDIDATES) {
        const p = f * maxProgress;
        drawFrame2D(ctx, 64, 40, p, opts);
        const d = ctx.getImageData(0, 0, 64, 40).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        if (sum > brightest) {
          brightest = sum;
          best = p;
        }
      }
    }
  }
  REST_CACHE.set(key, best);
  return best;
}

/**
 * Renders a live, looping animation of a 2D style directly to a canvas via
 * requestAnimationFrame — no JPEG encoding, no IndexedDB. Cheap enough to mount
 * several at once for the create-flow style gallery.
 */
export default function StylePreview({
  style,
  colors,
  durationSec = 6,
  paused = false,
  maxProgress = 1,
  className = "",
}: StylePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 1, h: 1 });

  // Whether the canvas is anywhere near the viewport. The landing page's hero kept
  // drawing at 60fps while scrolled thousands of pixels out of sight, which costs a
  // phone battery for pixels nobody can see. Starts true so a browser without the
  // observer, or a canvas measured before layout settles, still animates.
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      // A margin, so the animation is already running by the time it scrolls in.
      { rootMargin: "200px" }
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // The running loop reads its draw options from a ref, so recoloring mid-loop
  // repaints on the next tick instead of tearing the loop down and snapping to p=0.
  const optsRef = useRef({ style, color1: colors[0], color2: colors[1], color3: colors[2], frameCount: 1 });
  const maxRef = useRef(maxProgress);
  useEffect(() => {
    optsRef.current = { style, color1: colors[0], color2: colors[1], color3: colors[2], frameCount: 1 };
    maxRef.current = maxProgress;
  });

  // Keep the backing store matched to the element's rendered size, capped DPR for perf.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(rect.width, 1);
      const h = Math.max(rect.height, 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      // Assigning width/height resets the transform, so re-apply the DPR scale.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      // Repaint immediately so a resize never leaves the canvas blank; a running
      // loop overwrites this on its next tick.
      drawFrame2D(ctx, w, h, restingProgress(optsRef.current, maxRef.current), optsRef.current);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (paused || !inView) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let start = 0;
    // Begin the loop at the frame it was resting on, so hovering a card does not flash
    // it back to its darkest frame before it brightens.
    const restPhaseMs = maxProgress > 0 ? (restingProgress(optsRef.current, maxProgress) / maxProgress) * durationSec * 1000 : 0;

    const tick = (ts: number) => {
      if (!start) start = ts - restPhaseMs;
      const elapsed = (ts - start) / 1000;
      // Ping-pong 0->1->0 instead of a 0..1 sawtooth: the draw functions are not periodic
      // in p, so a sawtooth snaps at the wrap. A triangle wave is continuous at both ends.
      const phase = (elapsed / durationSec) % 2;
      const p = (phase <= 1 ? phase : 2 - phase) * maxProgress;
      const { w, h } = sizeRef.current;
      drawFrame2D(ctx, w, h, p, optsRef.current);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [paused, inView, durationSec, maxProgress]);

  // While the loop is not running, redraw the static frame on restyle.
  useEffect(() => {
    if (!paused && inView) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const opts = { style, color1: colors[0], color2: colors[1], color3: colors[2], frameCount: 1 };
    drawFrame2D(ctx, w, h, restingProgress(opts, maxRef.current), opts);
  }, [paused, inView, style, colors]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
