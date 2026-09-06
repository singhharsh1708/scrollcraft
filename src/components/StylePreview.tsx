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
  useEffect(() => {
    optsRef.current = { style, color1: colors[0], color2: colors[1], color3: colors[2], frameCount: 1 };
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
      drawFrame2D(ctx, w, h, 0, optsRef.current);
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

    const tick = (ts: number) => {
      if (!start) start = ts;
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
    drawFrame2D(ctx, w, h, 0, { style, color1: colors[0], color2: colors[1], color3: colors[2], frameCount: 1 });
  }, [paused, inView, style, colors]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
